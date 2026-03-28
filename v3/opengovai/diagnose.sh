#!/usr/bin/env bash
# OpenGovAI — Connectivity Diagnostic
echo ""
echo "=== OpenGovAI Connectivity Diagnostic ==="
echo ""

API_PORT=8000
FE_PORT=3000

echo "--- Port Status ---"
echo -n "Port $API_PORT (API):      "
lsof -Pi ":${API_PORT}" -sTCP:LISTEN -P 2>/dev/null | grep -v COMMAND | awk '{print $1, "PID="$2}' || echo "NOTHING LISTENING"

echo -n "Port $FE_PORT (Frontend): "
lsof -Pi ":${FE_PORT}" -sTCP:LISTEN -P 2>/dev/null | grep -v COMMAND | awk '{print $1, "PID="$2}' || echo "NOTHING LISTENING"

echo ""
echo "--- HTTP Tests ---"
echo -n "curl http://localhost:${API_PORT}/api/v1/health  → "
curl -s -o /dev/null -w "HTTP %{http_code}" "http://localhost:${API_PORT}/api/v1/health" 2>/dev/null || echo "FAILED"
echo ""

echo -n "curl http://localhost:${FE_PORT}/               → "
CODE=$(curl -s -o /tmp/og_diag.html -w "%{http_code}" "http://localhost:${FE_PORT}/" 2>/dev/null || echo "000")
echo "HTTP $CODE"

if [ "$CODE" = "200" ]; then
    echo "  Content-Type: $(curl -sI http://localhost:${FE_PORT}/ 2>/dev/null | grep -i content-type | tr -d '\r')"
    echo "  Body preview: $(head -c 100 /tmp/og_diag.html 2>/dev/null)"
    echo ""
    echo "✓ Frontend is serving correctly on port $FE_PORT"
    echo "  → Open http://localhost:${FE_PORT} in your browser"
elif [ "$CODE" = "404" ]; then
    echo "  Body: $(cat /tmp/og_diag.html 2>/dev/null | head -c 200)"
    echo ""
    echo "✗ Port $FE_PORT is returning 404"
    echo "  Check: cat logs/frontend.log"
else
    echo ""
    echo "✗ Port $FE_PORT returned HTTP $CODE or is not listening"
fi

echo ""
echo "--- Process Check ---"
cat .pids 2>/dev/null || echo ".pids file missing"
echo ""
