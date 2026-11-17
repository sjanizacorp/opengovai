#!/usr/bin/env bash
set -euo pipefail
umask 077
here=$(cd "$(dirname "$0")" && pwd -P)
version='5.1.0'
case "$(uname -s)" in
    Darwin) platform=macos ;;
    Linux) platform=linux ;;
    *) printf '%s\n' 'Native OpenGovAI requires macOS or Linux.' >&2; exit 1 ;;
esac
case "$(uname -m)" in
    arm64|aarch64) arch=arm64 ;;
    x86_64|amd64) arch=amd64 ;;
    *) printf '%s\n' 'Native OpenGovAI requires ARM64 or x86-64.' >&2; exit 1 ;;
esac
name="opengovai-$version-native-$platform-$arch"
directory="$PWD/$name"
if [[ -e "$directory" ]]; then
    printf 'Run %s/install.sh to resume setup.\n' "$directory"
    exit 1
fi
expected=$(awk -v name="$name.tar.gz" '$2 == name { print $1 }' "$here/NATIVE-SHA256SUMS")
[[ "$expected" =~ ^[[:xdigit:]]{64}$ ]] || { printf '%s\n' 'The release checksum is missing.' >&2; exit 1; }
scratch=$(mktemp -d "$PWD/.native-download.XXXXXX")
cleanup() { rm -rf -- "$scratch"; }
trap cleanup EXIT
printf 'Downloading the %s/%s native package.\n' "$platform" "$arch"
archive="$scratch/client.tar.gz"
curl --fail --location --silent --show-error --retry 2 \
    "https://github.com/sjanizacorp/opengovai/releases/download/v$version/$name.tar.gz" -o "$archive"
if command -v sha256sum >/dev/null; then actual=$(sha256sum "$archive"); else actual=$(shasum -a 256 "$archive"); fi
[[ "$expected" == "${actual%% *}" ]] || { printf '%s\n' 'SHA-256 verification failed.' >&2; exit 1; }
tar -xzf "$archive" -C "$scratch"
mv "$scratch/$name" "$directory"
"$directory/install.sh" "$@"
