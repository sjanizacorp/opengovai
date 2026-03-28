#!/usr/bin/env python3
"""
OpenGovAI — Frontend static file server + API proxy.
Usage: python3 server.py [frontend_build_dir] [api_url] [port]
"""
import sys
import os
import http.server
import urllib.request
import urllib.error
from pathlib import Path

# ── Configuration — resolved from args or environment ─────────────────────────
BUILD   = Path(sys.argv[1] if len(sys.argv) > 1 else os.environ.get("OG_BUILD",   "frontend/build"))
API_URL = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("OG_API",    "http://127.0.0.1:8000")
PORT    = int(sys.argv[3] if len(sys.argv) > 3 else os.environ.get("OG_PORT",    "3000"))

# ── Validate ──────────────────────────────────────────────────────────────────
if not BUILD.exists():
    print(f"ERROR: build directory not found: {BUILD}", flush=True)
    print("Run: ./install-native.sh", flush=True)
    sys.exit(1)
if not (BUILD / "index.html").exists():
    print(f"ERROR: index.html missing in {BUILD}", flush=True)
    sys.exit(1)

# ── Handler ───────────────────────────────────────────────────────────────────
class Handler(http.server.SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BUILD), **kwargs)

    # ── API proxy ─────────────────────────────────────────────────────────────
    def _proxy(self, method):
        url    = API_URL + self.path
        length = int(self.headers.get("Content-Length", 0) or 0)
        body   = self.rfile.read(length) if length else None
        hdrs   = {
            k: v for k, v in self.headers.items()
            if k.lower() not in ("host", "transfer-encoding", "content-length")
        }
        if body:
            hdrs["Content-Length"] = str(len(body))
        try:
            req = urllib.request.Request(url, data=body, method=method, headers=hdrs)
            with urllib.request.urlopen(req, timeout=120) as resp:
                self.send_response(resp.status)
                for k, v in resp.headers.items():
                    if k.lower() not in ("transfer-encoding", "connection"):
                        self.send_header(k, v)
                self.end_headers()
                self.wfile.write(resp.read())
        except urllib.error.HTTPError as exc:
            data = exc.read()
            self.send_response(exc.code)
            for k, v in exc.headers.items():
                if k.lower() not in ("transfer-encoding", "connection"):
                    self.send_header(k, v)
            self.end_headers()
            self.wfile.write(data)
        except Exception as exc:
            self.send_error(502, str(exc))

    # ── SPA routing ───────────────────────────────────────────────────────────
    def _serve_spa(self):
        # Strip query string and leading slash to get relative path
        rel = self.path.split("?")[0].split("#")[0].lstrip("/")
        if rel:
            candidate = BUILD / rel
            # Serve the file directly if it exists and is not a directory
            if candidate.exists() and not candidate.is_dir():
                # Let parent serve it as-is
                super().do_GET()
                return
        # Everything else (routes, unknown paths, bare /) → index.html
        self.path = "/index.html"
        super().do_GET()

    # ── Dispatch ──────────────────────────────────────────────────────────────
    API_PREFIXES = ("/api/", "/docs", "/openapi.json", "/redoc")

    def do_GET(self):
        if self.path.startswith(self.API_PREFIXES):
            self._proxy("GET")
        else:
            self._serve_spa()

    def do_POST(self):    self._proxy("POST")
    def do_PUT(self):     self._proxy("PUT")
    def do_PATCH(self):   self._proxy("PATCH")
    def do_DELETE(self):  self._proxy("DELETE")
    def do_OPTIONS(self): self._proxy("OPTIONS")

    def log_message(self, fmt, *args):
        # Suppress noisy static asset logs; keep API + errors
        msg = fmt % args if args else fmt
        if any(x in msg for x in ["/api/", "/docs", " 4", " 5"]):
            super().log_message(fmt, *args)


# ── Start ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print(f"OpenGovAI frontend  →  http://localhost:{PORT}", flush=True)
    print(f"API proxy           →  {API_URL}", flush=True)
    print(f"Serving             →  {BUILD.resolve()}", flush=True)
    print(f"index.html exists   →  {(BUILD / 'index.html').exists()}", flush=True)

    server = http.server.HTTPServer(("0.0.0.0", PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.", flush=True)
