#!/usr/bin/env bash
# =============================================================================
# OpenGovAI — Update Script
# Applies a new version archive and rebuilds/restarts everything cleanly.
# Usage: ./update.sh [path/to/opengovai_v4.tar.gz]
# =============================================================================
set -eo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[✓]${NC} $*"; }
info() { echo -e "${CYAN}[→]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
die()  { echo -e "${RED}[✗]${NC} $*" >&2; exit 1; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo -e "${CYAN}  OpenGovAI — Update${NC}"
echo ""

# ── Stop running server ───────────────────────────────────────────────────────
info "Stopping server..."
"$ROOT/stop-native.sh" 2>/dev/null || true
sleep 1

# ── Rebuild frontend from current source ─────────────────────────────────────
info "Rebuilding frontend..."
cd "$ROOT/frontend"

# Use venv node if available, else system
VENV="${ROOT}/.venv"
if [ -f "$VENV/bin/python3" ]; then
    PYTHON="$VENV/bin/python3"
else
    PYTHON="$(command -v python3)"
fi

if [ ! -d "node_modules" ]; then
    info "Installing frontend dependencies..."
    npm install --legacy-peer-deps 2>&1 | tail -3
fi

VITE_API_URL="/api/v1" npm run build 2>&1 | tail -5
cd "$ROOT"

if [ ! -f "$ROOT/frontend/build/index.html" ]; then
    die "Frontend build failed — check output above"
fi
ok "Frontend built"

# ── Verify backend control counts ─────────────────────────────────────────────
info "Verifying backend control counts..."
"$PYTHON" - << 'PYEOF'
import sys
sys.path.insert(0, 'backend')
from compliance import FRAMEWORK_CONTROLS

expected = {'eu_ai_act': 34, 'nist_ai_rmf': 68, 'owasp_llm': 48, 'iso_42001': 36, 'cfr_part11': 30}
all_ok = True
for fw_id, exp_n in expected.items():
    actual_n = len(FRAMEWORK_CONTROLS.get(fw_id, {}).get('controls', []))
    status = 'OK' if actual_n == exp_n else 'MISMATCH'
    print(f"  {fw_id}: {actual_n} controls [{status}]")
    if actual_n != exp_n:
        all_ok = False
        print(f"    Expected {exp_n}, got {actual_n}")
if not all_ok:
    print("\nERROR: Control counts are wrong. Re-extract the archive and try again.")
    sys.exit(1)
print("\n  All control counts correct!")
PYEOF

ok "Backend verified"

# ── Restart ───────────────────────────────────────────────────────────────────
info "Starting server..."
"$ROOT/start-native.sh"
