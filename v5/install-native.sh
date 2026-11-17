#!/usr/bin/env bash
native_fetch() {
    if command -v curl >/dev/null; then
        curl --fail --location --silent --show-error --retry 2 --proto '=https' --proto-redir '=https' "$1" -o "$2"
    elif command -v wget >/dev/null; then
        wget --https-only --timeout=30 --tries=3 --quiet "$1" -O "$2"
    elif command -v python3 >/dev/null; then
        python3 -I - "$1" "$2" <<'PY'
import shutil
import sys
from urllib.request import urlopen

with urlopen(sys.argv[1], timeout=30) as response:
    if not response.geturl().startswith("https://"):
        raise ValueError("The download redirected to an insecure address.")
    with open(sys.argv[2], "wb") as destination:
        shutil.copyfileobj(response, destination)
PY
    else
        printf '%s\n' 'Downloading requires curl, wget, or an existing Python 3 with HTTPS support.' >&2
        return 1
    fi
}

setup_parse_install_dir() {
    setup_install_dir=''
    setup_install_dir_given=false
    setup_directory_interactive=false
    setup_directory_args=()
    [[ ! -t 0 ]] || setup_directory_interactive=true
    while (( $# )); do
        case "$1" in
            --install-dir)
                if (( $# < 2 )) || [[ -z "$2" || "$2" == --* ]]; then
                    printf '%s\n' 'Provide a folder after --install-dir.' >&2
                    return 1
                fi
                setup_install_dir=$2
                setup_install_dir_given=true
                shift 2 ;;
            --non-interactive)
                setup_directory_interactive=false
                setup_directory_args+=("$1"); shift ;;
            --port|--admin|--unit|--admin-password-file)
                if (( $# < 2 )); then printf 'Missing value for %s.\n' "$1" >&2; return 1; fi
                local value=$2
                if [[ "$1" == --admin-password-file && "$value" != /* ]]; then value="$PWD/$value"; fi
                setup_directory_args+=("$1" "$value"); shift 2 ;;
            *) setup_directory_args+=("$1"); shift ;;
        esac
    done
}

setup_resolve_install_dir() {
    local default=$1
    if [[ "$setup_install_dir_given" == false && "$setup_directory_interactive" == true ]]; then
        read -r -p "Installation folder [$default]: " setup_install_dir ||
            { printf '%s\n' 'Setup cancelled before selecting a folder.' >&2; return 1; }
    fi
    setup_install_dir=${setup_install_dir:-$default}
    case "$setup_install_dir" in
        '~') setup_install_dir=$HOME ;;
        '~/'*) setup_install_dir="$HOME/${setup_install_dir#\~/}" ;;
    esac
    if [[ "$setup_install_dir" != /* ]]; then setup_install_dir="$PWD/$setup_install_dir"; fi
    mkdir -p -- "$setup_install_dir" &&
        setup_install_dir=$(cd -- "$setup_install_dir" && pwd -P)
}

setup_same_package() {
    [[ -f "$1/.opengovai-package" && -x "$1/install.sh" ]] &&
        [[ "$(cat "$1/.opengovai-package")" == "$2" ]]
}

setup_require_empty_dir() (
    shopt -s nullglob dotglob
    local -a contents=("$1"/*)
    if (( ${#contents[@]} )); then
        printf 'Choose an empty installation folder, or run the installer already in %s.\n' "$1" >&2
        exit 1
    fi
)

setup_copy_package() (
    local source=$1 target=$2 item staging
    shift 2
    setup_require_empty_dir "$target" || exit 1
    for item in "$@"; do
        if [[ "$target" == "$source/$item" || "$target" == "$source/$item/"* ]]; then
            printf 'Choose an installation folder outside %s/%s.\n' "$source" "$item" >&2
            exit 1
        fi
    done
    staging=$(mktemp -d "$target/.opengovai-files.XXXXXX") || exit 1
    trap 'rm -rf -- "$staging"' EXIT
    for item in "$@"; do
        if [[ -e "$source/$item" ]]; then
            cp -Rp -- "$source/$item" "$staging/" || exit 1
        fi
    done
    for item in "$@"; do
        if [[ -e "$staging/$item" ]]; then
            mv -- "$staging/$item" "$target/$item" || exit 1
        fi
    done
)

set -euo pipefail
umask 077
here=$(cd "$(dirname "$0")" && pwd -P)
version='5.1.4'
base="https://github.com/sjanizacorp/opengovai/releases/download/v$version"
case "$(uname -s)" in
    Darwin) platform=macos; system=macOS ;;
    Linux)
        platform=linux
        system=$(awk -F= '$1=="PRETTY_NAME" {sub(/^PRETTY_NAME=/,""); gsub(/^"|"$/,""); print; exit}' /etc/os-release 2>/dev/null || true)
        system=${system:-Linux} ;;
    *) printf '%s\n' 'Native OpenGovAI requires macOS or Linux.' >&2; exit 1 ;;
esac
machine=$(uname -m)
if [[ "$platform" == macos && $(sysctl -n hw.optional.arm64 2>/dev/null || true) == 1 ]]; then
    machine=arm64
fi
case "$platform/$machine" in
    macos/arm64) arch=arm64; artifact=macos-apple-silicon-arm64 ;;
    macos/x86_64|macos/amd64) arch=amd64; artifact=macos-intel-x86-64 ;;
    linux/arm64|linux/aarch64) arch=arm64; artifact=linux-arm64 ;;
    linux/x86_64|linux/amd64) arch=amd64; artifact=linux-x86-64 ;;
    *) printf '%s\n' 'Native OpenGovAI requires ARM64 or x86-64.' >&2; exit 1 ;;
esac
name="opengovai-$version-native-$artifact"
case "${1:-}" in
    --print-platform) printf '%s\n' "$system ($arch): $name.tar.gz"; exit 0 ;;
    -h|--help) printf '%s\n' 'Run bash install-native.sh to detect your platform and install. Use --install-dir DIR to choose a destination or --print-platform to see the selected download.'; exit 0 ;;
esac
if [[ "$platform-$arch" == '' && -x "$here/install.sh" ]]; then
    exec "$here/install.sh" "$@"
fi
setup_parse_install_dir "$@"
setup_resolve_install_dir "$PWD/$name"
directory=$setup_install_dir
set -- ${setup_directory_args[@]+"${setup_directory_args[@]}"}
if setup_same_package "$directory" "native:$version:$platform-$arch"; then
    exec "$directory/install.sh" --install-dir "$directory" "$@"
fi
setup_require_empty_dir "$directory"
scratch=$(mktemp -d "$PWD/.native-download.XXXXXX")
cleanup() { rm -rf -- "$scratch"; }
trap cleanup EXIT
checksums="$here/NATIVE-SHA256SUMS"
if [[ ! -r "$checksums" ]]; then
    checksums="$scratch/NATIVE-SHA256SUMS"
    native_fetch "$base/NATIVE-SHA256SUMS" "$checksums"
fi
expected=$(awk -v name="$name.tar.gz" '$2 == name { print $1 }' "$checksums")
[[ "$expected" =~ ^[[:xdigit:]]{64}$ ]] || { printf '%s\n' 'The release checksum is missing.' >&2; exit 1; }
printf 'Detected %s (%s). Downloading %s.tar.gz.\n' "$system" "$arch" "$name"
archive="$scratch/client.tar.gz"
native_fetch "$base/$name.tar.gz" "$archive"
if command -v sha256sum >/dev/null; then actual=$(sha256sum "$archive"); else actual=$(shasum -a 256 "$archive"); fi
[[ "$expected" == "${actual%% *}" ]] || { printf '%s\n' 'SHA-256 verification failed.' >&2; exit 1; }
tar -xzf "$archive" -C "$scratch"
setup_copy_package "$scratch/$name" "$directory" install.sh install-native.sh start.sh stop.sh uninstall.sh \
    opengovai README.md .env.example runtime web manuals .opengovai-package
"$directory/install.sh" --install-dir "$directory" "$@"
