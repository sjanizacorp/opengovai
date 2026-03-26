#!/usr/bin/env bash
# OpenGovAI — Local Development Runner (no Docker)
# Starts FastAPI backend + Vite dev server in parallel
set -euo pipefail

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${CYAN}[OpenGovAI]${NC} $*"; }
ok()    { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
err()   { echo -e "${RED}[✗]${NC} $*"; exit 1; }

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo -e "${CYAN}  OpenGovAI — Dev Mode (Vite + FastAPI)${NC}"
echo ""

command -v python3 >/dev/null 2>&1 || err "Python 3.11+ required"
command -v node    >/dev/null 2>&1 || err "Node.js 18+ required"
command -v npm     >/dev/null 2>&1 || err "npm required"

# .env
[ -f "$ROOT/.env" ] || { cp "$ROOT/.env.example" "$ROOT/.env"; warn "Created .env"; }
set -a; source "$ROOT/.env" 2>/dev/null || true; set +a

# Backend venv
VENV="$ROOT/.venv"
if [ ! -d "$VENV" ]; then
  info "Creating Python virtual environment…"
  python3 -m venv "$VENV"
fi
source "$VENV/bin/activate"
info "Installing backend dependencies…"
pip install -q -r "$ROOT/backend/requirements.txt"
ok "Backend deps ready"
deactivate

# Frontend deps
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  info "Installing frontend dependencies (~30s)…"
  cd "$ROOT/frontend" && npm install --legacy-peer-deps --silent
  ok "Frontend deps ready"
fi

# Kill both on exit
cleanup() {
  echo ""
  info "Shutting down…"
  kill "$API_PID" "$FE_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Start API
info "Starting API on http://localhost:8000 …"
cd "$ROOT/backend"
source "$ROOT/.venv/bin/activate"
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
API_PID=$!
deactivate

# Start Vite dev server (has built-in /api proxy via vite.config.js)
info "Starting Vite on http://localhost:3000 …"
cd "$ROOT/frontend"
npm run dev &
FE_PID=$!

echo ""
ok "OpenGovAI running in dev mode"
echo -e "  ${GREEN}Dashboard:${NC} http://localhost:3000"
echo -e "  ${GREEN}API:${NC}       http://localhost:8000/api/v1/health"
echo -e "  ${GREEN}API Docs:${NC}  http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop"
wait
