#!/usr/bin/env bash
# =============================================================================
# OpenGovAI — Native Install Script
# macOS (Homebrew) · Linux (apt / dnf / yum)
# =============================================================================
set -uo pipefail          # NOTE: -e intentionally omitted; we handle errors manually

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${CYAN}[OpenGovAI]${NC} $*"; }
success() { echo -e "${GREEN}[✓]${NC} $*"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*"; }
die()     { echo -e "${RED}[✗] ERROR:${NC} $*"; exit 1; }

# ── Resolve install directory (works whether called as ./install-native.sh or bash install-native.sh)
INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$INSTALL_DIR/.venv"
OS="$(uname -s)"
ARCH="$(uname -m)"

# ── Defaults (overridden by flags)
API_PORT=8000
NGINX_PORT=3000
API_HOST="127.0.0.1"
SKIP_NGINX=false
SKIP_SYSTEMD=false
SKIP_PKG_INSTALL=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)          NGINX_PORT="$2"; shift 2 ;;
    --api-port)      API_PORT="$2";   shift 2 ;;
    --no-nginx)      SKIP_NGINX=true; shift ;;
    --no-systemd)    SKIP_SYSTEMD=true; shift ;;
    --no-pkg-install) SKIP_PKG_INSTALL=true; shift ;;
    --help)
      echo "Usage: ./install-native.sh [--port N] [--api-port N] [--no-nginx] [--no-systemd]"
      exit 0 ;;
    *) warn "Ignoring unknown arg: $1"; shift ;;
  esac
done

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     OpenGovAI — Native Installation              ║${NC}"
echo -e "${CYAN}║         No Docker Required                       ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo -e "  OS:       ${BOLD}${OS} ${ARCH}${NC}"
echo -e "  Dir:      ${BOLD}${INSTALL_DIR}${NC}"
echo -e "  API:      ${BOLD}http://127.0.0.1:${API_PORT}${NC}"
echo -e "  Web:      ${BOLD}http://localhost:${NGINX_PORT}${NC}"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — Detect package manager
# ─────────────────────────────────────────────────────────────────────────────
info "Step 1/6 — Detecting system…"
PKG_MANAGER=""
if [[ "$OS" == "Darwin" ]]; then
  if ! command -v brew >/dev/null 2>&1; then
    die "Homebrew is required on macOS. Install it from https://brew.sh then re-run this script."
  fi
  PKG_MANAGER="brew"
  success "macOS + Homebrew $(brew --version | head -1 | cut -d' ' -f2)"
elif command -v apt-get >/dev/null 2>&1; then
  PKG_MANAGER="apt"
  success "Debian / Ubuntu (apt)"
elif command -v dnf >/dev/null 2>&1; then
  PKG_MANAGER="dnf"
  success "RHEL / Fedora (dnf)"
elif command -v yum >/dev/null 2>&1; then
  PKG_MANAGER="yum"
  success "CentOS / RHEL (yum)"
else
  die "Unsupported OS. Please install Python 3.11+, Node.js 20+, and nginx manually, then run ./start-native.sh directly."
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — Install system dependencies
# ─────────────────────────────────────────────────────────────────────────────
info "Step 2/6 — Checking system dependencies…"

brew_install() {
  local formula="$1"
  if brew list "$formula" >/dev/null 2>&1; then
    success "$formula already installed"
  else
    info "  brew install $formula …"
    brew install "$formula" 2>&1 | tail -3 || warn "brew install $formula had warnings (continuing)"
    success "$formula installed"
  fi
}

if ! $SKIP_PKG_INSTALL; then

  # ── Python ──────────────────────────────────────────────────────────────────
  PYTHON=""
  for candidate in python3.12 python3.11 python3; do
    if command -v "$candidate" >/dev/null 2>&1; then
      if "$candidate" -c "import sys; exit(0 if sys.version_info >= (3,11) else 1)" 2>/dev/null; then
        PYTHON="$(command -v "$candidate")"
        break
      fi
    fi
  done

  if [ -z "$PYTHON" ]; then
    info "Installing Python 3.11+…"
    case "$PKG_MANAGER" in
      brew) brew_install python ;;
      apt)  sudo apt-get update -qq && sudo apt-get install -y -q python3 python3-pip python3-venv ;;
      dnf)  sudo dnf install -y python3 python3-pip ;;
      yum)  sudo yum install -y python3 python3-pip ;;
    esac
    PYTHON="$(command -v python3)"
  fi
  [ -z "$PYTHON" ] && die "Python 3.11+ not found and could not be installed."
  success "Python: $($PYTHON --version)"

  # Ensure venv module available (Linux may need separate package)
  if ! $PYTHON -m venv --help >/dev/null 2>&1; then
    info "Installing python3-venv…"
    case "$PKG_MANAGER" in
      apt) sudo apt-get install -y -q python3-venv ;;
      dnf) sudo dnf install -y python3-virtualenv ;;
      yum) sudo yum install -y python3-virtualenv ;;
    esac
  fi

  # ── Node.js ──────────────────────────────────────────────────────────────────
  NODE_OK=false
  if command -v node >/dev/null 2>&1; then
    NODE_VER=$(node -e "process.stdout.write(String(parseInt(process.version.slice(1))))" 2>/dev/null || echo "0")
    [ "$NODE_VER" -ge 18 ] 2>/dev/null && NODE_OK=true
  fi

  if ! $NODE_OK; then
    info "Installing Node.js 20+…"
    case "$PKG_MANAGER" in
      brew) brew_install node ;;
      apt)
        info "  Adding NodeSource repository…"
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - 2>&1 | tail -2
        sudo apt-get install -y -q nodejs
        ;;
      dnf)
        sudo dnf module enable -y nodejs:20 2>/dev/null || true
        sudo dnf install -y nodejs npm
        ;;
      yum)
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - 2>&1 | tail -2
        sudo yum install -y nodejs
        ;;
    esac
  fi
  command -v node >/dev/null 2>&1 || die "Node.js installation failed."
  success "Node: $(node --version)  npm: $(npm --version)"

  # ── nginx ────────────────────────────────────────────────────────────────────
  if ! $SKIP_NGINX; then
    if ! command -v nginx >/dev/null 2>&1; then
      info "Installing nginx…"
      case "$PKG_MANAGER" in
        brew) brew_install nginx ;;
        apt)  sudo apt-get install -y -q nginx ;;
        dnf)  sudo dnf install -y nginx ;;
        yum)  sudo yum install -y nginx ;;
      esac
    fi
    command -v nginx >/dev/null 2>&1 && success "nginx: $(nginx -v 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')" || warn "nginx install failed — will use Python fallback server"
  fi

  # ── curl ─────────────────────────────────────────────────────────────────────
  if ! command -v curl >/dev/null 2>&1; then
    case "$PKG_MANAGER" in
      brew) brew_install curl ;;
      apt)  sudo apt-get install -y -q curl ;;
      dnf)  sudo dnf install -y curl ;;
      yum)  sudo yum install -y curl ;;
    esac
  fi

else
  # --no-pkg-install: just find what's available
  PYTHON="$(command -v python3.12 || command -v python3.11 || command -v python3 || true)"
  [ -z "$PYTHON" ] && die "Python 3.11+ not found. Install it manually and re-run."
  success "Using existing Python: $($PYTHON --version)"
  command -v node >/dev/null 2>&1 && success "Using existing Node: $(node --version)" || die "Node.js not found."
fi

# Resolve PYTHON one more time in case it was set above the install block
PYTHON="${PYTHON:-$(command -v python3)}"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — Python virtual environment + backend deps
# ─────────────────────────────────────────────────────────────────────────────
info "Step 3/6 — Setting up Python environment…"

if [ ! -d "$VENV_DIR" ]; then
  info "  Creating virtualenv at .venv …"
  "$PYTHON" -m venv "$VENV_DIR" || die "Failed to create virtualenv. Try: $PYTHON -m pip install virtualenv"
fi

# Activate
# shellcheck source=/dev/null
source "$VENV_DIR/bin/activate"

info "  Upgrading pip…"
pip install --quiet --upgrade pip 2>&1 | tail -1 || true

info "  Installing backend dependencies…"
pip install --quiet -r "$INSTALL_DIR/backend/requirements.txt" \
  || die "pip install failed. Check $INSTALL_DIR/backend/requirements.txt and your internet connection."

success "Python environment ready ($(python --version))"
deactivate

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — Build React frontend with Vite
# ─────────────────────────────────────────────────────────────────────────────
info "Step 4/6 — Building React frontend…"

cd "$INSTALL_DIR/frontend"

if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
  info "  Installing npm packages (this takes ~30s)…"
  npm install --legacy-peer-deps 2>&1 \
    | grep -v "^npm warn" | grep -v "^$" | tail -5 \
    || die "npm install failed. Check your internet connection."
else
  success "node_modules already present"
fi

info "  Running Vite build…"
VITE_API_URL="/api/v1" npm run build 2>&1 \
  | grep -v "^$" \
  || die "Frontend build failed. Run 'cd frontend && npm run build' to see full error."

[ -f "$INSTALL_DIR/frontend/build/index.html" ] \
  || die "Build produced no index.html — Vite build may have failed silently."

success "Frontend built → frontend/build/ ($(du -sh "$INSTALL_DIR/frontend/build" | cut -f1))"

cd "$INSTALL_DIR"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 5 — nginx config
# ─────────────────────────────────────────────────────────────────────────────
NGINX_CONFIGURED=false

if ! $SKIP_NGINX && command -v nginx >/dev/null 2>&1; then
  info "Step 5/6 — Configuring nginx…"

  # Find the right conf directory
  NGINX_CONF_DIR=""
  if [[ "$OS" == "Darwin" ]]; then
    NGINX_PREFIX="$(brew --prefix nginx 2>/dev/null || brew --prefix)/etc/nginx"
    mkdir -p "$NGINX_PREFIX/servers"
    NGINX_CONF_DIR="$NGINX_PREFIX/servers"
  elif [ -d "/etc/nginx/sites-available" ]; then
    NGINX_CONF_DIR="/etc/nginx/sites-available"
  elif [ -d "/etc/nginx/conf.d" ]; then
    NGINX_CONF_DIR="/etc/nginx/conf.d"
  else
    warn "Cannot locate nginx config directory — skipping nginx config, will use Python server."
    SKIP_NGINX=true
  fi

  if ! $SKIP_NGINX; then
    NGINX_CONF="$NGINX_CONF_DIR/opengovai.conf"
    info "  Writing $NGINX_CONF …"

    # Use a temp file to avoid sudo heredoc quoting issues
    TMPCONF="$(mktemp)"
    cat > "$TMPCONF" << NGINXEOF
# OpenGovAI — generated by install-native.sh
server {
    listen ${NGINX_PORT};
    server_name _;

    root ${INSTALL_DIR}/frontend/build;
    index index.html;

    # React SPA — unknown paths fall back to index.html
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # FastAPI reverse proxy
    location /api/ {
        proxy_pass         http://${API_HOST}:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 120s;
        proxy_buffering    off;
    }

    location /docs        { proxy_pass http://${API_HOST}:${API_PORT}; }
    location /openapi.json { proxy_pass http://${API_HOST}:${API_PORT}; }

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
}
NGINXEOF

    if [[ "$OS" == "Darwin" ]]; then
      cp "$TMPCONF" "$NGINX_CONF"
    else
      sudo cp "$TMPCONF" "$NGINX_CONF"
    fi
    rm -f "$TMPCONF"

    # Enable on Debian/Ubuntu
    if [ -d "/etc/nginx/sites-enabled" ]; then
      sudo ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/opengovai.conf" 2>/dev/null || true
      # Remove the default site only if it would clash
      if grep -q "listen 80" /etc/nginx/sites-enabled/default 2>/dev/null && [ "$NGINX_PORT" = "80" ]; then
        sudo rm -f /etc/nginx/sites-enabled/default
      fi
    fi

    # Test nginx config before reloading
    if [[ "$OS" == "Darwin" ]]; then
      nginx -t 2>&1 | tail -2 || warn "nginx config test failed — check $NGINX_CONF"
    else
      sudo nginx -t 2>&1 | tail -2 || warn "nginx config test failed — check $NGINX_CONF"
    fi

    NGINX_CONFIGURED=true
    success "nginx configured (port $NGINX_PORT → $INSTALL_DIR/frontend/build)"
  fi
else
  info "Step 5/6 — Skipping nginx (will use Python fallback server)…"
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 6 — Service manager (systemd / launchd)
# ─────────────────────────────────────────────────────────────────────────────
info "Step 6/6 — Configuring service manager…"

if ! $SKIP_SYSTEMD; then

  if [[ "$OS" == "Darwin" ]]; then
    # ── launchd (macOS) ────────────────────────────────────────────────────────
    PLIST_DIR="$HOME/Library/LaunchAgents"
    mkdir -p "$PLIST_DIR"
    PLIST_FILE="$PLIST_DIR/com.opengovai.api.plist"
    mkdir -p "$INSTALL_DIR/logs"

    cat > "$PLIST_FILE" << PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>          <string>com.opengovai.api</string>
    <key>ProgramArguments</key>
    <array>
        <string>${VENV_DIR}/bin/uvicorn</string>
        <string>main:app</string>
        <string>--host</string>  <string>${API_HOST}</string>
        <string>--port</string>  <string>${API_PORT}</string>
        <string>--workers</string> <string>2</string>
    </array>
    <key>WorkingDirectory</key>   <string>${INSTALL_DIR}/backend</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>  <string>${VENV_DIR}/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
        <key>HOME</key>  <string>${HOME}</string>
    </dict>
    <key>RunAtLoad</key>           <false/>
    <key>KeepAlive</key>
    <dict><key>SuccessfulExit</key><false/></dict>
    <key>StandardOutPath</key>    <string>${INSTALL_DIR}/logs/api.log</string>
    <key>StandardErrorPath</key>  <string>${INSTALL_DIR}/logs/api-error.log</string>
</dict>
</plist>
PLISTEOF
    # Unload any stale version
    launchctl unload "$PLIST_FILE" 2>/dev/null || true
    success "macOS LaunchAgent installed → $PLIST_FILE"

  elif command -v systemctl >/dev/null 2>&1; then
    # ── systemd (Linux) ────────────────────────────────────────────────────────
    CURRENT_USER="$(whoami)"
    TMPUNIT="$(mktemp)"
    cat > "$TMPUNIT" << UNITEOF
[Unit]
Description=OpenGovAI API Server
After=network.target

[Service]
Type=simple
User=${CURRENT_USER}
WorkingDirectory=${INSTALL_DIR}/backend
Environment=PATH=${VENV_DIR}/bin:/usr/local/bin:/usr/bin:/bin
EnvironmentFile=-${INSTALL_DIR}/.env
ExecStart=${VENV_DIR}/bin/uvicorn main:app --host ${API_HOST} --port ${API_PORT} --workers 2
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=opengovai

[Install]
WantedBy=multi-user.target
UNITEOF
    sudo mv "$TMPUNIT" /etc/systemd/system/opengovai.service
    sudo systemctl daemon-reload
    sudo systemctl enable opengovai 2>/dev/null || true
    success "systemd service installed → opengovai.service"
  else
    info "No systemd available — service will be managed by start-native.sh"
  fi

else
  info "  Skipping service manager install (--no-systemd)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# .env
# ─────────────────────────────────────────────────────────────────────────────
if [ ! -f "$INSTALL_DIR/.env" ]; then
  cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
  KEY=$("$PYTHON" -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || echo "opengovai-$(date +%s)-changeme")
  # macOS-safe sed (no -i without backup extension on BSD sed)
  if [[ "$OS" == "Darwin" ]]; then
    sed -i '' "s/changeme-replace-with-strong-random-key/$KEY/" "$INSTALL_DIR/.env"
  else
    sed -i "s/changeme-replace-with-strong-random-key/$KEY/" "$INSTALL_DIR/.env"
  fi
  warn ".env created with random secret key — add LLM API keys before scanning real models"
else
  success ".env already exists"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Write .install-config for other scripts to source
# ─────────────────────────────────────────────────────────────────────────────
mkdir -p "$INSTALL_DIR/logs"
cat > "$INSTALL_DIR/.install-config" << CFGEOF
INSTALL_DIR=${INSTALL_DIR}
API_PORT=${API_PORT}
NGINX_PORT=${NGINX_PORT}
API_HOST=${API_HOST}
VENV_DIR=${VENV_DIR}
OS=${OS}
NGINX_CONFIGURED=${NGINX_CONFIGURED}
INSTALL_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
CFGEOF

# ─────────────────────────────────────────────────────────────────────────────
# Done
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           Installation Complete ✓                ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Start:${NC}     ./start-native.sh"
echo -e "  ${BOLD}Stop:${NC}      ./stop-native.sh"
echo -e "  ${BOLD}Status:${NC}    ./status-native.sh"
echo -e "  ${BOLD}Uninstall:${NC} ./uninstall-native.sh"
echo ""
echo -e "  After starting, open: ${CYAN}http://localhost:${NGINX_PORT}${NC}"
echo ""
