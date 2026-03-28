#!/usr/bin/env bash
# OpenGovAI — Stop (native mode)
set -euo pipefail

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${CYAN}[OpenGovAI]${NC} $*"; }
success() { echo -e "${GREEN}[✓]${NC} $*"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*"; }

ROOT="$(cd "$(dirname "$0")" && pwd)"
PIDFILE="$ROOT/.pids"
OS="$(uname -s)"
[ -f "$ROOT/.install-config" ] && source "$ROOT/.install-config"

echo ""
info "Stopping OpenGovAI…"

STOPPED=0

# Stop via systemd if managed
if [[ "$OS" == "Linux" ]] && systemctl is-active --quiet opengovai 2>/dev/null; then
  sudo systemctl stop opengovai
  success "Stopped systemd service"
  STOPPED=1
fi

# Stop via launchd if managed
if [[ "$OS" == "Darwin" ]]; then
  PLIST="$HOME/Library/LaunchAgents/com.opengovai.api.plist"
  if [ -f "$PLIST" ]; then
    launchctl unload "$PLIST" 2>/dev/null && success "Stopped launchd agent" && STOPPED=1 || true
  fi
fi

# Kill tracked PIDs
if [ -f "$PIDFILE" ]; then
  while IFS='=' read -r key pid; do
    [ -z "$pid" ] && continue
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null && success "Stopped $key (PID $pid)" && STOPPED=1 || true
    fi
  done < "$PIDFILE"
  rm -f "$PIDFILE"
fi

# Belt-and-braces: kill any remaining uvicorn on our API port
API_PORT="${API_PORT:-8000}"
LEFTOVER=$(lsof -ti tcp:"$API_PORT" 2>/dev/null || true)
if [ -n "$LEFTOVER" ]; then
  kill $LEFTOVER 2>/dev/null && success "Killed remaining process on port $API_PORT" || true
fi

# Stop nginx (only if we own it)
if [ "${INSTALL_NGINX:-true}" = "true" ] && command -v nginx >/dev/null 2>&1; then
  if [[ "$OS" == "Darwin" ]]; then
    brew services stop nginx 2>/dev/null && success "Stopped nginx" || true
  else
    sudo systemctl stop nginx 2>/dev/null || sudo nginx -s stop 2>/dev/null || true
    success "Stopped nginx"
  fi
fi

rm -f "$ROOT/.static_server.py"

[ $STOPPED -eq 0 ] && warn "Nothing was running." || echo ""
echo -e "${GREEN}  OpenGovAI stopped.${NC}"
echo ""
