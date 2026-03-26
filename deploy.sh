#!/usr/bin/env bash
# =============================================================================
# OpenGovAI — Universal Deploy Script
# Auto-detects Docker availability and routes to the right deployment method
#
# Usage:
#   ./deploy.sh                  # auto-detect
#   ./deploy.sh --docker         # force Docker
#   ./deploy.sh --native         # force native (no Docker)
#   ./deploy.sh --native --port 8080
#   ./deploy.sh --help
# =============================================================================
set -euo pipefail

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${CYAN}[OpenGovAI]${NC} $*"; }
success() { echo -e "${GREEN}[✓]${NC} $*"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*"; }
error()   { echo -e "${RED}[✗]${NC} $*"; exit 1; }

ROOT="$(cd "$(dirname "$0")" && pwd)"
OS="$(uname -s)"
MODE=""
PORT=3000
EXTRA_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --docker)     MODE="docker"; shift ;;
    --native)     MODE="native"; shift ;;
    --port)       PORT="$2"; EXTRA_ARGS+=(--port "$2"); shift 2 ;;
    --api-port)   EXTRA_ARGS+=(--api-port "$2"); shift 2 ;;
    --no-nginx)   EXTRA_ARGS+=(--no-nginx); shift ;;
    --no-systemd) EXTRA_ARGS+=(--no-systemd); shift ;;
    --help|-h)
      echo ""
      echo -e "${BOLD}OpenGovAI — Universal Deploy Script${NC}"
      echo ""
      echo "Usage: ./deploy.sh [MODE] [OPTIONS]"
      echo ""
      echo "Modes:"
      echo "  (none)           Auto-detect Docker; fall back to native"
      echo "  --docker         Force Docker Compose deployment"
      echo "  --native         Force native deployment (no Docker)"
      echo ""
      echo "Options (native mode):"
      echo "  --port PORT      Web port nginx listens on (default: 3000)"
      echo "  --api-port PORT  FastAPI port (default: 8000)"
      echo "  --no-nginx       Skip nginx — use Python fallback server"
      echo "  --no-systemd     Skip systemd/launchd service installation"
      echo ""
      echo "Examples:"
      echo "  ./deploy.sh                        # auto-detect"
      echo "  ./deploy.sh --native               # native, port 3000"
      echo "  ./deploy.sh --native --port 8080   # native, custom port"
      echo "  ./deploy.sh --docker --port 4000   # docker, custom port"
      echo ""
      exit 0 ;;
    *) warn "Unknown argument: $1 (ignored)"; shift ;;
  esac
done

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║          OpenGovAI — Deploy                     ║${NC}"
echo -e "${CYAN}║   AI Governance, Risk & Compliance Platform      ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

if [ -z "$MODE" ]; then
  info "Auto-detecting deployment mode…"
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    MODE="docker"
    success "Docker is available → using Docker deployment"
  elif command -v docker >/dev/null 2>&1 && [[ "$OS" == "Darwin" ]]; then
    warn "Docker Desktop found but not running. Attempting to start…"
    open -a Docker 2>/dev/null || true
    echo -n "  Waiting for Docker Desktop"
    MAX=30; COUNT=0
    until docker info >/dev/null 2>&1; do
      COUNT=$((COUNT+1))
      if [ $COUNT -ge $MAX ]; then
        echo ""
        warn "Docker Desktop did not start — falling back to native deployment."
        MODE="native"
        break
      fi
      printf '.'; sleep 2
    done
    echo ""
    [ "$MODE" != "native" ] && MODE="docker" && success "Docker Desktop started → using Docker deployment"
  else
    MODE="native"
    warn "Docker not available → using native deployment"
  fi
fi

echo -e "  ${BOLD}Mode:${NC} ${MODE}"
echo ""

if [ "$MODE" = "docker" ]; then
  COMPOSE_CMD=""
  docker compose version >/dev/null 2>&1 && COMPOSE_CMD="docker compose"
  [ -z "$COMPOSE_CMD" ] && docker-compose version >/dev/null 2>&1 && COMPOSE_CMD="docker-compose"
  [ -z "$COMPOSE_CMD" ] && error "Docker Compose not found."

  if [ ! -f "$ROOT/.env" ]; then
    cp "$ROOT/.env.example" "$ROOT/.env"
    KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || echo "changeme-$(date +%s)")
    sed -i.bak "s/changeme-replace-with-strong-random-key/$KEY/" "$ROOT/.env" && rm -f "$ROOT/.env.bak"
    warn ".env created — add API keys to $ROOT/.env for model scanning"
  fi

  export PORT=$PORT
  info "Building Docker images…"
  $COMPOSE_CMD build --parallel

  info "Starting containers…"
  $COMPOSE_CMD up -d

  info "Waiting for API health check…"
  MAX=30; COUNT=0
  until curl -sf http://localhost:8000/api/v1/health >/dev/null 2>&1; do
    COUNT=$((COUNT+1))
    [ $COUNT -ge $MAX ] && error "API health check timed out.\n  Logs: $COMPOSE_CMD logs api"
    printf '.'; sleep 2
  done
  echo ""

  success "OpenGovAI is running (Docker)!"
  echo ""
  echo -e "  ${GREEN}Dashboard:${NC}  http://localhost:${PORT}"
  echo -e "  ${GREEN}API Docs:${NC}   http://localhost:8000/docs"
  echo ""
  echo -e "  ${YELLOW}Stop:${NC}   $COMPOSE_CMD down"
  echo -e "  ${YELLOW}Logs:${NC}   $COMPOSE_CMD logs -f"
  echo ""

else
  chmod +x \
    "$ROOT/install-native.sh" \
    "$ROOT/start-native.sh" \
    "$ROOT/stop-native.sh" \
    "$ROOT/restart-native.sh" \
    "$ROOT/status-native.sh" \
    "$ROOT/uninstall-native.sh"

  if [ ! -f "$ROOT/.install-config" ] || [ ! -f "$ROOT/frontend/build/index.html" ]; then
    info "Running native installation…"
    "$ROOT/install-native.sh" "${EXTRA_ARGS[@]}"
  else
    success "Already installed — skipping install"
  fi

  info "Starting services…"
  "$ROOT/start-native.sh"
fi
