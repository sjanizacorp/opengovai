#!/usr/bin/env bash
# =============================================================================
# OpenGovAI — Native Start Script
# =============================================================================
# NOTE: Do NOT use `set -u` — .install-config may have been written with
# corrupted variable names (non-ASCII suffixes) that trigger "unbound variable"
# before we can sanitise them. We handle missing vars with :- defaults instead.
set -eo pipefail

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${CYAN}[OpenGovAI]${NC} $*"; }
success() { echo -e "${GREEN}[✓]${NC} $*"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*"; }
die()     { echo -e "\n${RED}[✗]${NC} $*" >&2; exit 1; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIDFILE="$ROOT/.pids"
LOGDIR="$ROOT/logs"
mkdir -p "$LOGDIR"

# ── Load and sanitise .install-config ────────────────────────────────────────
# We read it with Python (not `source`) to safely extract only valid KEY=VALUE
# pairs, stripping any non-ASCII garbage that corrupts bash variable names.
[ -f "$ROOT/.install-config" ] || die "Not installed. Run: ./install-native.sh"

eval "$(python3 - "$ROOT/.install-config" << 'PYEOF'
import sys, re

path = sys.argv[1]
with open(path, 'rb') as f:
    raw = f.read()

# Strip non-ASCII bytes and carriage returns
text = raw.decode('ascii', errors='ignore').replace('\r', '')

for line in text.splitlines():
    line = line.strip()
    # Only export lines that are strictly KEY=value (ASCII letters, digits, underscores)
    m = re.match(r'^([A-Z_][A-Z0-9_]*)=(.*)$', line)
    if m:
        key, val = m.group(1), m.group(2)
        # Emit as a safe shell assignment
        # Escape single quotes in val just in case
        val_safe = val.replace("'", "'\\''")
        print(f"{key}='{val_safe}'")
PYEOF
)"

# ── Apply defaults for any missing variables ──────────────────────────────────
API_PORT="${API_PORT:-8000}"
FE_PORT="${NGINX_PORT:-3000}"
API_HOST="${API_HOST:-127.0.0.1}"
VENV_DIR="${VENV_DIR:-$ROOT/.venv}"
NGINX_CONFIGURED="${NGINX_CONFIGURED:-false}"
OS="${OS:-$(uname -s)}"

# Resolve python — always prefer venv
if [ -f "$VENV_DIR/bin/python3" ]; then
  PYTHON="$VENV_DIR/bin/python3"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON="$(command -v python3)"
else
  die "python3 not found"
fi

BUILD="$ROOT/frontend/build"

echo ""
echo -e "${CYAN}  OpenGovAI — Starting${NC}"
echo -e "  API port:      $API_PORT"
echo -e "  Frontend port: $FE_PORT"
echo -e "  Python:        $PYTHON"
echo ""

# ── Already running? ──────────────────────────────────────────────────────────
if [ -f "$PIDFILE" ]; then
  OLD="$(grep '^API=' "$PIDFILE" 2>/dev/null | cut -d= -f2 || true)"
  if [ -n "$OLD" ] && kill -0 "$OLD" 2>/dev/null; then
    warn "Already running (API PID $OLD). Use ./stop-native.sh first."
    exit 0
  fi
  rm -f "$PIDFILE"
fi

# ── Preconditions ─────────────────────────────────────────────────────────────
[ -f "$VENV_DIR/bin/activate" ] || die "Virtualenv missing — run: ./install-native.sh"
[ -f "$BUILD/index.html" ]      || die "Frontend not built — run: ./install-native.sh"
[ -f "$ROOT/server.py" ]        || die "server.py missing — re-extract the archive"

# ── Load .env ─────────────────────────────────────────────────────────────────
[ -f "$ROOT/.env" ] && { set -a; source "$ROOT/.env"; set +a; }

# ── Backend import check ──────────────────────────────────────────────────────
info "Checking backend…"
IMPORT_CHECK=$(cd "$ROOT/backend" && "$PYTHON" -c "
import sys; sys.path.insert(0,'.')
try:
    import database, models, scanner, compliance, main
    print('OK')
except Exception as e:
    print('FAIL:' + str(e))
" 2>&1)
[ "$IMPORT_CHECK" = "OK" ] || { echo "$IMPORT_CHECK"; die "Backend error — run: ./install-native.sh"; }
success "Backend OK"

# ── Port checks ───────────────────────────────────────────────────────────────
if lsof -Pi ":${API_PORT}" -sTCP:LISTEN -t >/dev/null 2>&1; then
  die "Port $API_PORT in use. Run: ./stop-native.sh"
fi
if lsof -Pi ":${FE_PORT}" -sTCP:LISTEN -t >/dev/null 2>&1; then
  die "Port $FE_PORT in use. Run: ./stop-native.sh"
fi

# ── Start API ─────────────────────────────────────────────────────────────────
info "Starting API on port $API_PORT…"
cd "$ROOT/backend"
"$PYTHON" -m uvicorn main:app \
  --host "$API_HOST" \
  --port "$API_PORT" \
  --workers 2 \
  --log-level info \
  >> "$LOGDIR/api.log" 2>&1 &
API_PID=$!
cd "$ROOT"
echo "API=$API_PID" > "$PIDFILE"

info "Waiting for API…"
for i in $(seq 1 30); do
  if curl -sf "http://${API_HOST}:${API_PORT}/api/v1/health" >/dev/null 2>&1; then
    success "API ready (PID $API_PID)"
    break
  fi
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo -e "${RED}API crashed:${NC}"; tail -20 "$LOGDIR/api.log"
    die "Fix above then run ./start-native.sh"
  fi
  [ "$i" -eq 30 ] && { tail -10 "$LOGDIR/api.log"; die "API timed out"; }
  printf '.'; sleep 1
done
echo ""

# ── Start frontend ────────────────────────────────────────────────────────────
# Strategy: try nginx if NGINX_CONFIGURED=true AND it actually returns HTTP 200.
# Otherwise fall back to Python server.py — no exceptions.

USE_NGINX=false

if [ "$NGINX_CONFIGURED" = "true" ] && command -v nginx >/dev/null 2>&1; then
  NGINX_CONF=""
  for loc in \
    "$(brew --prefix 2>/dev/null)/etc/nginx/servers/opengovai.conf" \
    "/etc/nginx/sites-enabled/opengovai.conf" \
    "/etc/nginx/conf.d/opengovai.conf"; do
    [ -f "$loc" ] && NGINX_CONF="$loc" && break
  done

  if [ -n "$NGINX_CONF" ]; then
    info "Trying nginx (config: $NGINX_CONF)…"
    if [[ "$OS" == "Darwin" ]]; then
      brew services restart nginx >/dev/null 2>&1 || nginx -s reload 2>/dev/null || true
    else
      sudo systemctl restart nginx 2>/dev/null || true
    fi
    sleep 2
    if lsof -Pi ":${FE_PORT}" -sTCP:LISTEN -t >/dev/null 2>&1; then
      HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${FE_PORT}/" 2>/dev/null || echo "000")
      if [ "$HTTP_CODE" = "200" ]; then
        success "nginx serving frontend (HTTP 200)"
        USE_NGINX=true
      else
        warn "nginx on port $FE_PORT but GET / → HTTP $HTTP_CODE (not 200)"
        warn "Stopping nginx, switching to Python server. Run ./fix-nginx.sh to repair nginx."
        brew services stop nginx 2>/dev/null || sudo systemctl stop nginx 2>/dev/null || true
        sleep 1
      fi
    else
      warn "nginx didn't bind port $FE_PORT — using Python server"
    fi
  fi
fi

if [ "$USE_NGINX" = "false" ]; then
  # Wait for port to be free
  for i in $(seq 1 5); do
    lsof -Pi ":${FE_PORT}" -sTCP:LISTEN -t >/dev/null 2>&1 || break
    sleep 1
  done
  lsof -Pi ":${FE_PORT}" -sTCP:LISTEN -t >/dev/null 2>&1 \
    && die "Port $FE_PORT still busy. Run: ./stop-native.sh"

  info "Starting Python frontend server on port $FE_PORT…"
  "$PYTHON" "$ROOT/server.py" \
    "$BUILD" \
    "http://${API_HOST}:${API_PORT}" \
    "$FE_PORT" \
    >> "$LOGDIR/frontend.log" 2>&1 &
  FE_PID=$!
  echo "FRONTEND=$FE_PID" >> "$PIDFILE"

  BOUND=false
  for i in $(seq 1 8); do
    sleep 1
    if ! kill -0 "$FE_PID" 2>/dev/null; then
      echo -e "${RED}Frontend server crashed:${NC}"
      cat "$LOGDIR/frontend.log"
      die "Fix above then run ./start-native.sh"
    fi
    if lsof -Pi ":${FE_PORT}" -sTCP:LISTEN -t >/dev/null 2>&1; then
      BOUND=true; break
    fi
    printf '.'
  done
  echo ""
  [ "$BOUND" = "true" ] || { cat "$LOGDIR/frontend.log"; die "Frontend didn't bind port $FE_PORT"; }

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${FE_PORT}/" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    success "Frontend ready — GET / → HTTP 200 ✓"
  else
    warn "Frontend bound port $FE_PORT but GET / → HTTP $HTTP_CODE"
    cat "$LOGDIR/frontend.log"
  fi
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
success "OpenGovAI is running!"
echo ""
echo -e "  ${GREEN}Dashboard:${NC}   http://localhost:${FE_PORT}"
echo -e "  ${GREEN}API Health:${NC}  http://localhost:${API_PORT}/api/v1/health"
echo -e "  ${GREEN}API Docs:${NC}    http://localhost:${API_PORT}/docs"
echo ""
echo -e "  Logs:   tail -f $LOGDIR/api.log"
echo -e "          tail -f $LOGDIR/frontend.log"
echo -e "  Stop:   ./stop-native.sh"
echo ""
