#!/usr/bin/env bash
# =============================================================================
# OpenGovAI — Fix nginx configuration and restart
# Run this once if you see "GET / 404 Not Found" in api.log
# =============================================================================
set -uo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
info() { echo -e "${CYAN}[fix-nginx]${NC} $*"; }
ok()   { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
die()  { echo -e "${RED}[✗]${NC} $*" >&2; exit 1; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$ROOT/.install-config" ] || die "Not installed — run ./install-native.sh first"
source "$ROOT/.install-config"

API_PORT="${API_PORT:-8000}"
FE_PORT="${NGINX_PORT:-3000}"
BUILD="$ROOT/frontend/build"

echo ""
echo -e "${CYAN}  OpenGovAI — nginx config repair${NC}"
echo ""

# ── Detect nginx prefix ───────────────────────────────────────────────────────
if [[ "${OS:-}" == "Darwin" ]]; then
  BREW_PREFIX="$(brew --prefix 2>/dev/null || echo /opt/homebrew)"
  NGINX_CONF_DIR="$BREW_PREFIX/etc/nginx/servers"
  NGINX_CONF="$NGINX_CONF_DIR/opengovai.conf"
  MIME_TYPES="$BREW_PREFIX/etc/nginx/mime.types"
  if [ ! -f "$MIME_TYPES" ]; then
    MIME_TYPES="/etc/nginx/mime.types"
  fi
else
  NGINX_CONF_DIR="/etc/nginx/sites-available"
  NGINX_CONF="/etc/nginx/sites-available/opengovai.conf"
  MIME_TYPES="/etc/nginx/mime.types"
fi

command -v nginx >/dev/null 2>&1 || die "nginx not found — using Python server instead (run ./start-native.sh)"

info "Writing nginx config to: $NGINX_CONF"
info "  Frontend build: $BUILD"
info "  API port:       $API_PORT"
info "  Frontend port:  $FE_PORT"
info "  mime.types:     $MIME_TYPES"

[ -d "$NGINX_CONF_DIR" ] || sudo mkdir -p "$NGINX_CONF_DIR"

# Write config via temp file then sudo copy (avoids heredoc + sudo tee issues)
TMPCONF="$(mktemp /tmp/opengovai-nginx-XXXX.conf)"
cat > "$TMPCONF" << NGINXEOF
# OpenGovAI native nginx config — generated $(date)
events {
    worker_connections 1024;
}

http {
    include       ${MIME_TYPES};
    default_type  application/octet-stream;
    sendfile      on;
    gzip          on;
    gzip_types    text/plain text/css application/json application/javascript;

    server {
        listen      ${FE_PORT};
        server_name localhost 127.0.0.1;

        # API proxy
        location /api/ {
            proxy_pass         http://127.0.0.1:${API_PORT};
            proxy_http_version 1.1;
            proxy_set_header   Host \$host;
            proxy_set_header   X-Real-IP \$remote_addr;
            proxy_read_timeout 120s;
        }
        location /docs         { proxy_pass http://127.0.0.1:${API_PORT}; }
        location /openapi.json { proxy_pass http://127.0.0.1:${API_PORT}; }
        location /redoc        { proxy_pass http://127.0.0.1:${API_PORT}; }

        # React SPA — serve static files, fall back to index.html
        location / {
            root      ${BUILD};
            index     index.html;
            try_files \$uri \$uri/ /index.html;
        }
    }
}
NGINXEOF

sudo cp "$TMPCONF" "$NGINX_CONF"
rm -f "$TMPCONF"
ok "Config written"

# Test config
if ! sudo nginx -t -c "$NGINX_CONF" 2>/dev/null; then
  warn "nginx -t failed with per-server config, trying system include approach"
  # On macOS Homebrew, the main nginx.conf already has events{} block
  # We only need the server{} block in servers/*.conf
  TMPCONF2="$(mktemp /tmp/opengovai-nginx-XXXX.conf)"
  cat > "$TMPCONF2" << NGINXEOF2
# OpenGovAI native nginx server block — $(date)
server {
    listen      ${FE_PORT};
    server_name localhost 127.0.0.1;

    location /api/ {
        proxy_pass         http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Host \$host;
        proxy_read_timeout 120s;
    }
    location /docs         { proxy_pass http://127.0.0.1:${API_PORT}; }
    location /openapi.json { proxy_pass http://127.0.0.1:${API_PORT}; }
    location /redoc        { proxy_pass http://127.0.0.1:${API_PORT}; }

    location / {
        root      ${BUILD};
        index     index.html;
        try_files \$uri \$uri/ /index.html;
    }
}
NGINXEOF2
  sudo cp "$TMPCONF2" "$NGINX_CONF"
  rm -f "$TMPCONF2"
  ok "Server-block-only config written"
fi

# ── Stop anything on port FE_PORT ────────────────────────────────────────────
info "Stopping anything on port $FE_PORT…"
# Kill Python frontend server if running
if [ -f "$ROOT/.pids" ]; then
  FE_PID="$(grep '^FRONTEND=' "$ROOT/.pids" 2>/dev/null | cut -d= -f2 || true)"
  if [ -n "$FE_PID" ] && kill -0 "$FE_PID" 2>/dev/null; then
    kill "$FE_PID" 2>/dev/null || true
    ok "Stopped Python server (PID $FE_PID)"
  fi
fi
# Stop nginx if running
if [[ "${OS:-}" == "Darwin" ]]; then
  brew services stop nginx 2>/dev/null || true
  sleep 1
  brew services start nginx 2>/dev/null || nginx 2>/dev/null || true
else
  sudo systemctl restart nginx 2>/dev/null || sudo service nginx restart 2>/dev/null || true
fi

sleep 2

# ── Verify ────────────────────────────────────────────────────────────────────
if lsof -Pi ":${FE_PORT}" -sTCP:LISTEN -t >/dev/null 2>&1; then
  ok "nginx listening on port $FE_PORT"
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${FE_PORT}/" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    ok "GET / → HTTP 200 ✓"
    echo ""
    ok "nginx is correctly serving the frontend!"
    echo -e "  Open: ${GREEN}http://localhost:${FE_PORT}${NC}"
  else
    warn "GET / returned HTTP $HTTP_CODE (expected 200)"
    echo "  Trying Python server fallback instead…"
    # Fall back to Python server
    VENV_PYTHON="$ROOT/.venv/bin/python3"
    [ -f "$VENV_PYTHON" ] || VENV_PYTHON="$(command -v python3)"
    brew services stop nginx 2>/dev/null || sudo systemctl stop nginx 2>/dev/null || true
    sleep 1
    "$VENV_PYTHON" "$ROOT/server.py" "$BUILD" "http://127.0.0.1:${API_PORT}" "$FE_PORT" \
      >> "$ROOT/logs/frontend.log" 2>&1 &
    FE_PID=$!
    sleep 2
    if kill -0 "$FE_PID" 2>/dev/null; then
      ok "Python server started (PID $FE_PID)"
      # Update pids
      grep -v '^FRONTEND=' "$ROOT/.pids" > /tmp/pids_tmp 2>/dev/null || true
      echo "FRONTEND=$FE_PID" >> /tmp/pids_tmp
      mv /tmp/pids_tmp "$ROOT/.pids"
      echo -e "  Open: ${GREEN}http://localhost:${FE_PORT}${NC}"
    fi
  fi
else
  warn "nginx didn't bind port $FE_PORT — using Python server"
  VENV_PYTHON="$ROOT/.venv/bin/python3"
  [ -f "$VENV_PYTHON" ] || VENV_PYTHON="$(command -v python3)"
  "$VENV_PYTHON" "$ROOT/server.py" "$BUILD" "http://127.0.0.1:${API_PORT}" "$FE_PORT" \
    >> "$ROOT/logs/frontend.log" 2>&1 &
  FE_PID=$!
  sleep 2
  kill -0 "$FE_PID" 2>/dev/null && ok "Python server started (PID $FE_PID) on port $FE_PORT" \
    || die "Python server also failed — check logs/frontend.log"
  echo -e "  Open: ${GREEN}http://localhost:${FE_PORT}${NC}"
fi
echo ""
