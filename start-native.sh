#!/usr/bin/env bash
# =============================================================================
# OpenGovAI — Native Start Script
# =============================================================================
set -uo pipefail

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${CYAN}[OpenGovAI]${NC} $*"; }
success() { echo -e "${GREEN}[✓]${NC} $*"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*"; }
die()     { echo -e "\n${RED}[✗] ERROR:${NC} $*"; exit 1; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIDFILE="$ROOT/.pids"
LOGDIR="$ROOT/logs"
OS="$(uname -s)"
mkdir -p "$LOGDIR"

# ── Load install config ────────────────────────────────────────────────────────
[ -f "$ROOT/.install-config" ] || die "Not installed. Run: ./install-native.sh"
source "$ROOT/.install-config"

API_PORT="${API_PORT:-8000}"
NGINX_PORT="${NGINX_PORT:-3000}"
API_HOST="${API_HOST:-127.0.0.1}"
VENV_DIR="${VENV_DIR:-$ROOT/.venv}"
# Read NGINX_CONFIGURED as a plain string comparison (avoids "false" being executed as a command)
NGINX_OK="${NGINX_CONFIGURED:-false}"

echo ""
echo -e "${CYAN}  OpenGovAI — Starting${NC}"
echo ""

# ── Guard: already running ─────────────────────────────────────────────────────
if [ -f "$PIDFILE" ]; then
  OLD_PID="$(grep '^API=' "$PIDFILE" 2>/dev/null | cut -d= -f2 || true)"
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    warn "Already running (PID $OLD_PID). Use ./stop-native.sh first."
    echo -e "  ${GREEN}Dashboard:${NC} http://localhost:${NGINX_PORT}"
    exit 0
  fi
  rm -f "$PIDFILE"
fi

# ── Sanity checks ──────────────────────────────────────────────────────────────
[ -f "$VENV_DIR/bin/activate" ]          || die "Virtualenv missing — run: ./install-native.sh"
[ -f "$ROOT/frontend/build/index.html" ] || die "Frontend not built — run: ./install-native.sh"

# ── Load .env ─────────────────────────────────────────────────────────────────
[ -f "$ROOT/.env" ] && { set -a; source "$ROOT/.env"; set +a; }

# ── Pre-flight import check ───────────────────────────────────────────────────
info "Checking backend…"
source "$VENV_DIR/bin/activate"
CHECK=$(cd "$ROOT/backend" && python3 - 2>&1 << 'PYEOF'
import sys
sys.path.insert(0, '.')
try:
    import database, models, scanner, compliance, main
    print("OK")
except Exception as e:
    print(f"ERROR: {e}")
PYEOF
)
deactivate

if [ "$CHECK" != "OK" ]; then
  echo -e "${RED}[✗] Backend import error:${NC}"
  echo "$CHECK"
  die "Run: ./install-native.sh  to reinstall dependencies."
fi
success "Backend OK"

# ── Check API port free ────────────────────────────────────────────────────────
if lsof -Pi ":${API_PORT}" -sTCP:LISTEN -t >/dev/null 2>&1; then
  die "Port ${API_PORT} in use. Run: ./stop-native.sh  or choose a different --api-port."
fi

# ── Start API ──────────────────────────────────────────────────────────────────
info "Starting API on http://${API_HOST}:${API_PORT} …"
source "$VENV_DIR/bin/activate"
cd "$ROOT/backend"
nohup uvicorn main:app \
  --host "$API_HOST" \
  --port "$API_PORT" \
  --workers 2 \
  --log-level info \
  >> "$LOGDIR/api.log" 2>&1 &
API_PID=$!
deactivate
cd "$ROOT"
echo "API=$API_PID" > "$PIDFILE"

# Brief pause then check it didn't die on import
sleep 2
if ! kill -0 "$API_PID" 2>/dev/null; then
  echo -e "${RED}[✗] API crashed immediately. Log:${NC}"
  tail -30 "$LOGDIR/api.log" 2>/dev/null
  die "Fix the error above, then run ./start-native.sh"
fi

# Poll health
info "Waiting for API to be ready…"
for i in $(seq 1 30); do
  if curl -sf "http://${API_HOST}:${API_PORT}/api/v1/health" >/dev/null 2>&1; then
    success "API is up (PID $API_PID)"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo -e "${RED}[✗] API did not respond. Log:${NC}"
    tail -30 "$LOGDIR/api.log" 2>/dev/null
    die "Full log: $LOGDIR/api.log"
  fi
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo -e "${RED}[✗] API process died. Log:${NC}"
    tail -30 "$LOGDIR/api.log" 2>/dev/null
    die "Fix the error above, then run ./start-native.sh"
  fi
  printf '.'
  sleep 1
done
echo ""

# ── Start frontend ─────────────────────────────────────────────────────────────
# Check if nginx has our config file (string comparison, not boolean eval)
NGINX_CONF_FOUND=false
for loc in \
  "$(brew --prefix 2>/dev/null)/etc/nginx/servers/opengovai.conf" \
  "/etc/nginx/sites-enabled/opengovai.conf" \
  "/etc/nginx/conf.d/opengovai.conf"; do
  [ -f "$loc" ] && NGINX_CONF_FOUND=true && break
done

if [ "$NGINX_CONF_FOUND" = "true" ] && command -v nginx >/dev/null 2>&1; then
  info "Starting nginx on port ${NGINX_PORT} …"
  if [[ "$OS" == "Darwin" ]]; then
    brew services start nginx >/dev/null 2>&1 \
      || brew services restart nginx >/dev/null 2>&1 \
      || nginx -c "$(brew --prefix)/etc/nginx/nginx.conf" 2>/dev/null \
      || warn "nginx could not start — falling through to Python server"
    # Verify nginx actually bound the port
    sleep 1
    if ! lsof -Pi ":${NGINX_PORT}" -sTCP:LISTEN -t >/dev/null 2>&1; then
      warn "nginx didn't bind port ${NGINX_PORT} — using Python server instead"
      NGINX_CONF_FOUND=false
    else
      success "nginx running on port ${NGINX_PORT}"
    fi
  else
    sudo systemctl start nginx 2>/dev/null \
      || sudo nginx 2>/dev/null \
      || warn "nginx could not start"
    sleep 1
    if ! lsof -Pi ":${NGINX_PORT}" -sTCP:LISTEN -t >/dev/null 2>&1; then
      warn "nginx didn't bind port ${NGINX_PORT} — using Python server instead"
      NGINX_CONF_FOUND=false
    else
      success "nginx running on port ${NGINX_PORT}"
    fi
  fi
fi

# Always fall through to Python server if nginx didn't bind the port
if [ "$NGINX_CONF_FOUND" = "false" ] || ! lsof -Pi ":${NGINX_PORT}" -sTCP:LISTEN -t >/dev/null 2>&1; then
  if lsof -Pi ":${NGINX_PORT}" -sTCP:LISTEN -t >/dev/null 2>&1; then
    die "Port ${NGINX_PORT} is already in use by something else. Run: ./stop-native.sh"
  fi

  info "Serving frontend on http://localhost:${NGINX_PORT} (Python server) …"

  # Write the proxy+static server script
  cat > "$ROOT/.static_server.py" << PYEOF
#!/usr/bin/env python3
"""
OpenGovAI — built-in combined server.
Serves the React SPA from frontend/build/ and proxies /api/* to FastAPI.
"""
import os, http.server, urllib.request, urllib.error
from pathlib import Path

BUILD   = Path("${ROOT}/frontend/build")
API_URL = "http://${API_HOST}:${API_PORT}"
PORT    = int(os.environ.get("PORT", "${NGINX_PORT}"))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(BUILD), **kw)

    def _proxy(self, method):
        url = API_URL + self.path
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else None
        hdrs = {k: v for k, v in self.headers.items()
                if k.lower() not in ("host", "transfer-encoding", "content-length")}
        if body:
            hdrs["Content-Length"] = str(len(body))
        try:
            req = urllib.request.Request(url, data=body, method=method, headers=hdrs)
            with urllib.request.urlopen(req, timeout=120) as r:
                self.send_response(r.status)
                for k, v in r.headers.items():
                    if k.lower() not in ("transfer-encoding", "connection"):
                        self.send_header(k, v)
                self.end_headers()
                self.wfile.write(r.read())
        except urllib.error.HTTPError as e:
            body = e.read()
            self.send_response(e.code)
            for k, v in e.headers.items():
                if k.lower() not in ("transfer-encoding", "connection"):
                    self.send_header(k, v)
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            self.send_error(502, str(e))

    def _spa(self):
        """Serve static file or fall back to index.html for SPA routing."""
        p = self.path.split("?")[0].lstrip("/")
        f = BUILD / p if p else BUILD / "index.html"
        if not f.exists() or f.is_dir():
            self.path = "/index.html"
        super().do_GET()

    def do_GET(self):
        if self.path.startswith(("/api/", "/docs", "/openapi.json", "/redoc")):
            self._proxy("GET")
        else:
            self._spa()

    def do_POST(self):   self._proxy("POST")
    def do_PUT(self):    self._proxy("PUT")
    def do_PATCH(self):  self._proxy("PATCH")
    def do_DELETE(self): self._proxy("DELETE")

    def log_message(self, fmt, *args):
        # Only log API calls, suppress static asset noise
        msg = str(args)
        if any(x in msg for x in ["/api/", "/docs", "404", "500", "502"]):
            super().log_message(fmt, *args)

print(f"OpenGovAI frontend → http://localhost:{PORT}", flush=True)
print(f"API proxy target   → {API_URL}", flush=True)
http.server.HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
PYEOF

  source "$VENV_DIR/bin/activate"
  PORT="$NGINX_PORT" nohup python3 "$ROOT/.static_server.py" \
    >> "$LOGDIR/frontend.log" 2>&1 &
  FE_PID=$!
  deactivate
  echo "FRONTEND=$FE_PID" >> "$PIDFILE"

  # Confirm it bound the port
  sleep 1
  if ! kill -0 "$FE_PID" 2>/dev/null; then
    echo -e "${RED}[✗] Frontend server crashed. Log:${NC}"
    tail -20 "$LOGDIR/frontend.log" 2>/dev/null
    die "Full log: $LOGDIR/frontend.log"
  fi
  if ! lsof -Pi ":${NGINX_PORT}" -sTCP:LISTEN -t >/dev/null 2>&1; then
    die "Frontend server started but port ${NGINX_PORT} is not bound. Log: $LOGDIR/frontend.log"
  fi
  success "Frontend server running (PID $FE_PID)"
fi

# ── Done ───────────────────────────────────────────────────────────────────────
echo ""
success "OpenGovAI is running!"
echo ""
echo -e "  ${GREEN}Dashboard:${NC}   http://localhost:${NGINX_PORT}"
echo -e "  ${GREEN}API Health:${NC}  http://localhost:${API_PORT}/api/v1/health"
echo -e "  ${GREEN}API Docs:${NC}    http://localhost:${API_PORT}/docs"
echo ""
echo -e "  ${YELLOW}Logs:${NC}   tail -f ${LOGDIR}/api.log"
echo -e "  ${YELLOW}Stop:${NC}   ./stop-native.sh"
echo ""
