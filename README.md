# OpenGovAI

**AI Governance, Risk & Compliance Platform**

> Govern your AI before it governs you.

OpenGovAI is an open-source, self-hostable platform for discovering, assessing, governing, and continuously monitoring AI systems. It unifies the capabilities of leading commercial tools (Credo AI, IBM Watsonx.governance, Holistic AI) with open-source scan engines (Garak, Promptfoo, PyRIT, DeepTeam, FuzzyAI).

---

## Quick Start

### Auto-detect (recommended)

```bash
tar -xzf opengovai.tar.gz && cd opengovai
chmod +x deploy.sh
./deploy.sh          # detects Docker automatically; falls back to native
```

### Force Docker

```bash
./deploy.sh --docker
```

### Force Native (no Docker required)

```bash
./deploy.sh --native
```

Open http://localhost:3000 once started.

---

## Deployment Options

| Method | Requires | Best for |
|--------|----------|----------|
| **Docker** | Docker Desktop or Engine | Easiest, most isolated |
| **Native** | Python 3.11+, Node 20+, nginx | Servers without Docker, bare metal, VMs |

Both methods are fully supported and produce an identical running application.

---

## Docker Deployment

**Prerequisites:** Docker Desktop (Mac/Windows) or Docker Engine + Compose (Linux)

```bash
./deploy.sh --docker [--port PORT]
```

**What it does:**
- Builds API container (Python/FastAPI)
- Builds frontend container (React → nginx static)
- Starts nginx reverse proxy
- Health-checks the API before declaring success

**Manage:**
```bash
docker compose down          # stop
docker compose up -d         # start again
docker compose logs -f       # logs
docker compose restart api   # restart API only
```

---

## Native Deployment (No Docker)

**Prerequisites:** Python 3.11+, Node.js 20+ (auto-installed if missing)

```bash
./deploy.sh --native                   # default port 3000
./deploy.sh --native --port 8080       # custom port
./deploy.sh --native --no-nginx        # skip nginx (uses Python fallback server)
./deploy.sh --native --no-systemd      # skip service install
```

**What the native installer does:**

1. Detects OS (macOS/Ubuntu/RHEL) and installs missing deps via Homebrew or apt/dnf
2. Creates a Python virtual environment in `.venv/`
3. Installs Python dependencies from `backend/requirements.txt`
4. Runs `npm run build` to produce the production React bundle in `frontend/build/`
5. Configures nginx to serve static files and proxy `/api/*` to FastAPI
6. Installs a systemd service (Linux) or launchd agent (macOS) for auto-start on boot
7. Starts everything and health-checks

**Native management scripts:**

```bash
./start-native.sh      # start API + nginx
./stop-native.sh       # stop everything
./restart-native.sh    # restart
./status-native.sh     # show running status + last log lines
./uninstall-native.sh  # remove services, venv, build artifacts
```

**Without nginx** (`--no-nginx`):
A lightweight Python proxy server is started instead, serving the React SPA and proxying `/api/*` to FastAPI on a single port. Suitable for development or internal-only deployments.

**Systemd (Linux):**
After native install, the API runs as a systemd service:
```bash
sudo systemctl status opengovai
sudo systemctl restart opengovai
journalctl -u opengovai -f
```

**launchd (macOS):**
A LaunchAgent is installed for the current user:
```bash
launchctl list | grep opengovai
```

---

## Custom Port

```bash
# Docker
./deploy.sh --docker --port 8080

# Native
./deploy.sh --native --port 8080
```

---

## Configuration

Edit `config/opengovai.config.yaml` before deploying:

```yaml
organization:
  name: "Your Org"
  industry: "financial_services"
  regulatory_scope: [eu_ai_act, nist_ai_rmf, iso_42001]

scan_engine:
  enabled_tools:
    garak: true
    promptfoo: true
    fuzzyai: false   # Enable for deep genetic fuzzing (CPU intensive)
```

Edit `.env` to add API keys for scanning real models:
```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Project Structure

```
opengovai/
├── backend/                  Python FastAPI application
│   ├── main.py               API routes (assets, scans, findings, compliance...)
│   ├── scanner.py            Scan orchestrator (Garak, Promptfoo, PyRIT, native)
│   ├── compliance.py         Framework compliance mapper + evidence packs
│   ├── database.py           Async DB layer
│   ├── models.py             Pydantic models
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                 React SPA
│   ├── src/
│   │   ├── App.js            Root with routing
│   │   ├── api.js            API client
│   │   ├── index.css         Dark terminal design system
│   │   └── pages/            Dashboard, Assets, Scans, Findings,
│   │                         Compliance, Policies, Workflows
│   ├── public/
│   ├── package.json
│   └── Dockerfile
├── nginx/
│   └── nginx.conf            Docker reverse proxy config
├── config/
│   └── opengovai.config.yaml Platform configuration
├── deploy.sh                 Universal deploy (Docker or native)
├── install-native.sh         Native install (deps, build, nginx, systemd)
├── start-native.sh           Start API + frontend server
├── stop-native.sh            Stop all services
├── restart-native.sh         Restart
├── status-native.sh          Show status + logs
├── uninstall-native.sh       Full cleanup
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## API Reference

Interactive docs: `http://localhost:8000/docs`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Health check |
| GET | `/api/v1/dashboard` | Risk posture overview |
| GET/POST | `/api/v1/assets` | List / register AI assets |
| POST | `/api/v1/scans` | Initiate security scan |
| GET | `/api/v1/scans/{id}` | Scan status + results |
| GET | `/api/v1/findings` | Findings (filterable by severity/status) |
| PATCH | `/api/v1/findings/{id}` | Update finding status |
| GET | `/api/v1/compliance/{framework}` | Framework posture |
| POST | `/api/v1/compliance/evidence` | Generate evidence pack |
| GET/POST | `/api/v1/policies` | Policy management |
| GET/POST | `/api/v1/workflows` | Governance approval workflows |
| PATCH | `/api/v1/workflows/{id}/approve` | Approve workflow stage |

---

## Compliance Frameworks

| Framework | Coverage |
|-----------|----------|
| EU AI Act (2024, enforced 2026) | Risk tier classification, Annex IV, Art. 9/10/11/13/14 |
| NIST AI RMF 1.0 | GOVERN, MAP, MEASURE, MANAGE functions |
| OWASP LLM Top 10 (2025) | All 10 categories with automated probes |
| OWASP Agentic AI Top 10 (2026) | ASI-01 to ASI-07 — kill switches, memory poisoning |
| ISO/IEC 42001 | AI Management System controls |
| GDPR / CCPA | Data governance and privacy checks |
| MITRE ATLAS | TTP-level finding attribution |

---

## Troubleshooting

**Port already in use:**
```bash
./deploy.sh --native --port 8080
```

**API won't start (native):**
```bash
tail -50 logs/api.log
./status-native.sh
```

**Frontend build fails:**
```bash
cd frontend && npm install --legacy-peer-deps && npm run build
```

**Reinstall from scratch:**
```bash
./uninstall-native.sh
./deploy.sh --native
```

---

## License

MIT License — see LICENSE file.

---

*OpenGovAI — Govern your AI before it governs you.*
