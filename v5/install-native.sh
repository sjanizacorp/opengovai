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

set -euo pipefail
umask 077
here=$(cd "$(dirname "$0")" && pwd -P)
version='5.1.2'
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
    -h|--help) printf '%s\n' 'Run bash install-native.sh to detect your platform and install. Use --print-platform to see the selected download.'; exit 0 ;;
esac
if [[ "$platform-$arch" == '' && -x "$here/install.sh" ]]; then
    exec "$here/install.sh" "$@"
fi
directory="$PWD/$name"
if [[ -e "$directory" ]]; then
    if [[ -x "$directory/install.sh" ]]; then exec "$directory/install.sh" "$@"; fi
    printf 'The installation directory already exists: %s\n' "$directory" >&2
    exit 1
fi
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
mv "$scratch/$name" "$directory"
"$directory/install.sh" "$@"
