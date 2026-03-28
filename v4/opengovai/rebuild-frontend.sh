#!/usr/bin/env bash
# OpenGovAI — Rebuild frontend only (no reinstall)
# Run this after any changes to frontend/src/ files
set -eo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'

echo -e "${CYAN}[OpenGovAI]${NC} Rebuilding frontend..."

cd "$ROOT/frontend"
VITE_API_URL="/api/v1" npm run build 2>&1 | tail -5

if [ -f "$ROOT/frontend/build/index.html" ]; then
  echo -e "${GREEN}[✓]${NC} Frontend rebuilt successfully"
  echo ""
  echo "Restart the server to serve the new build:"
  echo "  ./stop-native.sh && ./start-native.sh"
else
  echo -e "${RED}[✗]${NC} Build failed — check output above"
  exit 1
fi
