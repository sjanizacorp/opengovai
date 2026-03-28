#!/usr/bin/env bash
# OpenGovAI — Status (native mode)
set -euo pipefail

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'

ROOT="$(cd "$(dirname "$0")" && pwd)"
PIDFILE="$ROOT/.pids"
OS="$(uname -s)"
[ -f "$ROOT/.install-config" ] && source "$ROOT/.install-config"
API_PORT="${API_PORT:-8000}"
NGINX_PORT="${NGINX_PORT:-3000}"
API_HOST="${API_HOST:-127.0.0.1}"

echo ""
echo -e "${BOLD}${CYAN}OpenGovAI — System Status${NC}"
echo -e "${CYAN}─────────────────────────────────────────${NC}"

# API health
if curl -sf "http://${API_HOST}:${API_PORT}/api/v1/health" >/dev/null 2>&1; then
  HEALTH=$(curl -s "http://${API_HOST}:${API_PORT}/api/v1/health" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('version','?'))" 2>/dev/null || echo "?")
  echo -e "  API            ${GREEN}● running${NC}  http://localhost:${API_PORT}  (v${HEALTH})"
else
  echo -e "  API            ${RED}○ stopped${NC}"
fi

# Frontend / nginx
if curl -sf "http://localhost:${NGINX_PORT}" >/dev/null 2>&1; then
  echo -e "  Frontend       ${GREEN}● running${NC}  http://localhost:${NGINX_PORT}"
else
  echo -e "  Frontend       ${RED}○ stopped${NC}"
fi

# systemd
if [[ "$OS" == "Linux" ]] && command -v systemctl >/dev/null 2>&1; then
  if systemctl is-active --quiet opengovai 2>/dev/null; then
    echo -e "  systemd svc    ${GREEN}● active${NC}"
  else
    echo -e "  systemd svc    ${YELLOW}○ inactive${NC}"
  fi
fi

# Tracked PIDs
if [ -f "$PIDFILE" ]; then
  echo ""
  echo -e "  ${CYAN}Tracked processes:${NC}"
  while IFS='=' read -r key pid; do
    [ -z "$pid" ] && continue
    if kill -0 "$pid" 2>/dev/null; then
      echo -e "    ${key}: ${GREEN}PID ${pid}${NC}"
    else
      echo -e "    ${key}: ${RED}PID ${pid} (dead)${NC}"
    fi
  done < "$PIDFILE"
fi

# Log tail
LOGDIR="$ROOT/logs"
if [ -f "$LOGDIR/api.log" ]; then
  echo ""
  echo -e "  ${CYAN}Last 5 API log lines:${NC}"
  tail -5 "$LOGDIR/api.log" 2>/dev/null | sed 's/^/    /'
fi

echo ""
echo -e "  ${YELLOW}Logs:${NC}    tail -f ${ROOT}/logs/api.log"
echo -e "  ${YELLOW}Stop:${NC}    ./stop-native.sh"
echo ""
