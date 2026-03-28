#!/usr/bin/env bash
# OpenGovAI — Uninstall (native mode)
# Removes services, nginx config, venv, and build artifacts
set -euo pipefail

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${CYAN}[OpenGovAI]${NC} $*"; }
success() { echo -e "${GREEN}[✓]${NC} $*"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*"; }

ROOT="$(cd "$(dirname "$0")" && pwd)"
OS="$(uname -s)"
[ -f "$ROOT/.install-config" ] && source "$ROOT/.install-config"

echo ""
warn "This will remove OpenGovAI services, nginx config, .venv, and built frontend."
read -rp "Continue? [y/N] " CONFIRM
[[ "$CONFIRM" =~ ^[Yy]$ ]] || { echo "Cancelled."; exit 0; }
echo ""

# Stop first
"$ROOT/stop-native.sh" 2>/dev/null || true

# systemd
if [[ "$OS" == "Linux" ]] && [ -f /etc/systemd/system/opengovai.service ]; then
  sudo systemctl disable opengovai 2>/dev/null || true
  sudo rm -f /etc/systemd/system/opengovai.service
  sudo systemctl daemon-reload
  success "Removed systemd service"
fi

# launchd
if [[ "$OS" == "Darwin" ]]; then
  PLIST="$HOME/Library/LaunchAgents/com.opengovai.api.plist"
  [ -f "$PLIST" ] && rm -f "$PLIST" && success "Removed launchd plist"
fi

# nginx config
for loc in \
  "$(brew --prefix 2>/dev/null)/etc/nginx/servers/opengovai.conf" \
  "/etc/nginx/sites-available/opengovai.conf" \
  "/etc/nginx/sites-enabled/opengovai.conf" \
  "/etc/nginx/conf.d/opengovai.conf"; do
  [ -f "$loc" ] && sudo rm -f "$loc" && success "Removed nginx config: $loc"
done

# Reload nginx
command -v nginx >/dev/null 2>&1 && { sudo nginx -s reload 2>/dev/null || true; }

# Remove build artifacts and venv
rm -rf "$ROOT/frontend/build" "$ROOT/frontend/node_modules" "$ROOT/.venv" \
       "$ROOT/logs" "$ROOT/.pids" "$ROOT/.install-config" "$ROOT/.static_server.py"
success "Removed build artifacts and virtual environment"

echo ""
success "OpenGovAI uninstalled. Source code is intact at: $ROOT"
echo ""
