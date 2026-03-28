# OpenGovAI v4.0
## AI Governance, Risk & Compliance Platform
### Author: Shahryar Jahangir

---

## Quick Start (Native, no Docker)

```bash
# First time install:
tar -xzf opengovai_v4.tar.gz
cd opengovai
chmod +x *.sh
./install-native.sh      # installs Python deps, Node deps, builds frontend, configures nginx

# Start:
./start-native.sh

# Open: http://localhost:3000
```

## Updating from a previous version

> **Important:** After extracting a new archive, you MUST rebuild the frontend.
> The `build/` directory is not included in the archive (it's generated locally).

```bash
cd /Users/sj/Downloads/opengovai
./stop-native.sh

# Extract new source files:
cd ..
tar -xzf opengovai_v4.tar.gz

# Rebuild and restart (one command):
cd opengovai
./update.sh
```

The `update.sh` script:
1. Stops the running server
2. Rebuilds the React frontend from the new source files
3. Verifies control counts are correct (prints them to screen)
4. Restarts the server

## Troubleshooting

**Compliance card shows wrong control count (e.g. 10 instead of 48 for OWASP):**
The frontend build is stale. Run: `./update.sh`

**"View All Controls" shows fewer controls than expected:**
Same fix: `./update.sh`

**Start script fails with "unbound variable":**
Run: `python3 -c "import re; open('.install-config','w').write('\n'.join(l for l in re.sub(r'[^\x00-\x7F]','',open('.install-config','rb').read().decode('ascii','ignore')).splitlines() if re.match(r'^[A-Z_]+=',l))+'\n')"`

**Port already in use:**
Run: `./stop-native.sh`

## Management Scripts

| Script | Purpose |
|--------|---------|
| `./start-native.sh` | Start API + frontend server |
| `./stop-native.sh` | Stop all processes |
| `./restart-native.sh` | Stop + start |
| `./update.sh` | Apply new archive + rebuild frontend |
| `./rebuild-frontend.sh` | Rebuild frontend only (after .jsx changes) |
| `./status-native.sh` | Show running status + recent logs |
| `./diagnose.sh` | Test connectivity on both ports |
| `./fix-nginx.sh` | Repair nginx configuration |
| `./dev.sh` | Development mode (hot reload) |

## Compliance Frameworks

| Framework | Controls | Source |
|-----------|----------|--------|
| EU AI Act 2024/1689 | 34 | eur-lex.europa.eu |
| NIST AI RMF 1.0 + GenAI Profile | 68 | airc.nist.gov |
| OWASP LLM Top 10 2025 | 48 | owasp.org |
| ISO/IEC 42001:2023 | 36 | iso.org |
| 21 CFR Part 11 + FDA AI/ML 2024 | 30 | ecfr.gov |

Total: **216 controls** across 5 frameworks.
