#!/usr/bin/env bash
# =============================================================================
# OpenGovAI — Simple direct launcher (no config file dependency)
# =============================================================================
set -eo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGDIR="$ROOT/logs"
mkdir -p "$LOGDIR"

GREEN='\033[0;32m'; CYAN='\033[0;36m'; RED='\033[0;31m'; NC='\033[0m'
ok()  { echo -e "${GREEN}[✓]${NC} $*"; }
die() { echo -e "${RED}[✗]${NC} $*" >&2; exit 1; }

# ── Ports — change these if needed ───────────────────────────────────────────
API_PORT=8000
FE_PORT=3000
API_HOST=127.0.0.1

# ── Find Python (venv preferred) ─────────────────────────────────────────────
PYTHON=""
for candidate in \
  "$ROOT/.venv/bin/python3" \
  "$(command -v python3 2>/dev/null)"; do
  [ -x "$candidate" ] && PYTHON="$candidate" && break
done
[ -n "$PYTHON" ] || die "python3 not found"

BUILD="$ROOT/frontend/build"

echo ""
echo -e "${CYAN}  OpenGovAI — Direct Launcher${NC}"
echo -e "  Python:   $PYTHON"
echo -e "  API port: $API_PORT"
echo -e "  Web port: $FE_PORT"
echo ""

# ── Checks ────────────────────────────────────────────────────────────────────
[ -f "$BUILD/index.html" ] || die "Frontend not built — run: ./install-native.sh"
[ -f "$ROOT/server.py" ]   || die "server.py missing — re-extract the archive"
[ -d "$ROOT/backend" ]     || die "backend/ directory missing"

lsof -Pi ":${API_PORT}" -sTCP:LISTEN -t >/dev/null 2>&1 \
  && die "Port $API_PORT already in use. Kill it: kill \$(lsof -ti :$API_PORT)"
lsof -Pi ":${FE_PORT}" -sTCP:LISTEN -t >/dev/null 2>&1 \
  && die "Port $FE_PORT already in use. Kill it: kill \$(lsof -ti :$FE_PORT)"

# ── Load .env if present ──────────────────────────────────────────────────────
[ -f "$ROOT/.env" ] && { set -a; source "$ROOT/.env"; set +a; }

# ── Start API ─────────────────────────────────────────────────────────────────
echo "Starting API..."
cd "$ROOT/backend"
"$PYTHON" -m uvicorn main:app \
  --host "$API_HOST" \
  --port "$API_PORT" \
  --workers 1 \
  --log-level info \
  >> "$LOGDIR/api.log" 2>&1 &
API_PID=$!
cd "$ROOT"

# Wait for health
for i in $(seq 1 20); do
  sleep 1
  curl -sf "http://${API_HOST}:${API_PORT}/api/v1/health" >/dev/null 2>&1 && break
  kill -0 "$API_PID" 2>/dev/null || { tail -20 "$LOGDIR/api.log"; die "API crashed"; }
  [ "$i" -eq 20 ] && die "API timed out"
  printf '.'
done
echo ""
ok "API running (PID $API_PID)"

# ── Start frontend ────────────────────────────────────────────────────────────
echo "Starting frontend server..."
"$PYTHON" "$ROOT/server.py" \
  "$BUILD" \
  "http://${API_HOST}:${API_PORT}" \
  "$FE_PORT" \
  >> "$LOGDIR/frontend.log" 2>&1 &
FE_PID=$!

# Wait for bind
for i in $(seq 1 10); do
  sleep 1
  kill -0 "$FE_PID" 2>/dev/null || { cat "$LOGDIR/frontend.log"; die "Frontend server crashed"; }
  lsof -Pi ":${FE_PORT}" -sTCP:LISTEN -t >/dev/null 2>&1 && break
  [ "$i" -eq 10 ] && { cat "$LOGDIR/frontend.log"; die "Frontend didn't bind port $FE_PORT"; }
  printf '.'
done
echo ""
ok "Frontend server running (PID $FE_PID)"

# ── Smoke test ────────────────────────────────────────────────────────────────
CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${FE_PORT}/" 2>/dev/null || echo 000)
if [ "$CODE" = "200" ]; then
  ok "GET http://localhost:${FE_PORT}/ → 200 ✓"
else
  echo "WARNING: GET / returned HTTP $CODE (expected 200)"
  echo "Frontend log:"
  cat "$LOGDIR/frontend.log"
fi

# ── Save PIDs ─────────────────────────────────────────────────────────────────
printf "API=%s\nFRONTEND=%s\n" "$API_PID" "$FE_PID" > "$ROOT/.pids"

echo ""
ok "OpenGovAI is running!"
echo ""
echo -e "  ${GREEN}Dashboard:${NC}   http://localhost:${FE_PORT}"
echo -e "  ${GREEN}API Health:${NC}  http://localhost:${API_PORT}/api/v1/health"
echo -e "  ${GREEN}API Docs:${NC}    http://localhost:${API_PORT}/docs"
echo ""
echo "  Logs:  tail -f $LOGDIR/api.log"
echo "         tail -f $LOGDIR/frontend.log"
echo "  Stop:  kill $API_PID $FE_PID"
echo "         (or: ./stop-native.sh)"
echo ""
