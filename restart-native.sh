#!/usr/bin/env bash
# OpenGovAI — Restart (native mode)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
"$ROOT/stop-native.sh"
sleep 1
"$ROOT/start-native.sh"
