#!/bin/sh
set -eu

cd "$(dirname "$0")"
umask 077
case "$(docker info --format '{{.OSType}}/{{.Architecture}}')" in
    linux/aarch64|linux/arm64) arch=arm64 ;;
    linux/x86_64|linux/amd64) arch=amd64 ;;
    *) echo "OpenGovAI requires an ARM64 or x86-64 Linux Docker engine." >&2; exit 1 ;;
esac
docker compose version >/dev/null
if [ -f .env ] && grep -q '^OPENGOVAI_IMAGE_ARCH=' .env && ! grep -qx "OPENGOVAI_IMAGE_ARCH=$arch" .env; then
    echo "The existing .env targets another Docker architecture." >&2
    exit 1
fi
image="images-$arch.tar.gz"
test -f "$image" || { echo "The $arch image archive is missing." >&2; exit 1; }
expected=$(awk -v image="$image" '$2 == image { print $1 }' SHA256SUMS)
if command -v sha256sum >/dev/null 2>&1; then
    actual=$(sha256sum "$image")
else
    actual=$(shasum -a 256 "$image")
fi
if [ -z "$expected" ] || [ "${actual%% *}" != "$expected" ]; then
    echo "The $arch image archive failed its SHA-256 check." >&2
    exit 1
fi
docker image load --input "$image"
[ -f .env ] || cp .env.example .env
grep -qx "OPENGOVAI_IMAGE_ARCH=$arch" .env || printf '\nOPENGOVAI_IMAGE_ARCH=%s\n' "$arch" >> .env
export OPENGOVAI_IMAGE_ARCH="$arch"
docker compose up -d --no-build --pull never --wait
printf 'OpenGovAI dashboard: http://%s\n' "$(docker compose port nginx 80)"
