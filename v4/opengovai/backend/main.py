"""
OpenGovAI — AI Governance, Risk & Compliance Platform
FastAPI Backend — Main Application Entry Point
"""
import uuid
import random
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, List
from contextlib import asynccontextmanager

logger = logging.getLogger("opengovai")

from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from database import init_db, get_db_session
from models import (
    AssetCreate, ScanCreate, FindingUpdate, PolicyCreate, WorkflowCreate,
    ScanResult, DashboardStats, ComplianceStatus
)
from scanner import ScanOrchestrator
from compliance import ComplianceMapper

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await seed_demo_data()

    # Print control counts on startup — visible in api.log for debugging
    from compliance import FRAMEWORK_CONTROLS as _FC
    _total = sum(len(v["controls"]) for v in _FC.values())
    print(f"OpenGovAI v4 — {_total} compliance controls loaded:", flush=True)
    for _fwid, _fw in _FC.items():
        print(f"  {_fwid}: {len(_fw['controls'])} controls", flush=True)

    yield

app = FastAPI(
    title="OpenGovAI",
    description="AI Governance, Risk & Compliance Platform",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

orchestrator = ScanOrchestrator()
compliance_mapper = ComplianceMapper()

# ─── Health ────────────────────────────────────────────────────────────────────

@app.get("/api/v1/health")
async def health():
    return {"status": "ok", "version": "1.0.0", "timestamp": datetime.utcnow().isoformat()}

# ─── Dashboard ─────────────────────────────────────────────────────────────────

@app.get("/api/v1/dashboard", response_model=DashboardStats)
async def dashboard():
    async with get_db_session() as db:
        assets = await db.get_all("assets")
        scans = await db.get_all("scans")
        findings = await db.get_all("findings")

        active_assets = [a for a in assets if a.get("status") == "active"]
        open_findings = [f for f in findings if f.get("status") == "open"]
        critical = [f for f in open_findings if f.get("severity") == "critical"]
        high = [f for f in open_findings if f.get("severity") == "high"]

        compliance_scores = {}
        for fw in ["eu_ai_act", "nist_ai_rmf", "owasp_llm", "iso_42001"]:
            passed = len([f for f in findings if fw in f.get("frameworks", []) and f.get("status") == "resolved"])
            total = len([f for f in findings if fw in f.get("frameworks", [])])
            compliance_scores[fw] = round((passed / total * 100) if total > 0 else 72, 1)

        recent_scans = sorted(scans, key=lambda x: x.get("created_at", ""), reverse=True)[:5]

        risk_trend = []
        for i in range(7):
            day = datetime.utcnow() - timedelta(days=6 - i)
            risk_trend.append({
                "date": day.strftime("%b %d"),
                "score": round(random.uniform(5.5, 8.5), 1)
            })

        return DashboardStats(
            total_assets=len(assets),
            active_assets=len(active_assets),
            total_scans=len(scans),
            open_findings=len(open_findings),
            critical_findings=len(critical),
            high_findings=len(high),
            compliance_scores=compliance_scores,
            recent_scans=recent_scans,
            risk_trend=risk_trend,
            shadow_ai_detected=random.randint(2, 6)
        )

# ─── Assets ────────────────────────────────────────────────────────────────────

@app.get("/api/v1/assets")
async def list_assets(status: Optional[str] = None, environment: Optional[str] = None):
    async with get_db_session() as db:
        assets = await db.get_all("assets")
        if status:
            assets = [a for a in assets if a.get("status") == status]
        if environment:
            assets = [a for a in assets if a.get("environment") == environment]
        return {"assets": assets, "total": len(assets)}

@app.post("/api/v1/assets", status_code=201)
async def create_asset(asset: AssetCreate):
    async with get_db_session() as db:
        record = {
            "id": f"ASSET-{str(uuid.uuid4())[:8].upper()}",
            "name": asset.name,
            "model": asset.model,
            "provider": asset.provider,
            "environment": asset.environment,
            "owner": asset.owner,
            "use_case": asset.use_case,
            "data_classification": asset.data_classification,
            "autonomy_level": asset.autonomy_level,
            "status": "active",
            "risk_tier": _calculate_risk_tier(asset),
            "risk_score": _calculate_initial_risk(asset),
            "created_at": datetime.utcnow().isoformat(),
            "last_scanned": None,
            "frameworks": ["eu_ai_act", "nist_ai_rmf", "owasp_llm"],
        }
        await db.insert("assets", record)
        return record

@app.get("/api/v1/assets/{asset_id}")
async def get_asset(asset_id: str):
    async with get_db_session() as db:
        asset = await db.get_by_id("assets", asset_id)
        if not asset:
            raise HTTPException(404, f"Asset {asset_id} not found")
        return asset

@app.delete("/api/v1/assets/{asset_id}")
async def delete_asset(asset_id: str):
    async with get_db_session() as db:
        await db.delete("assets", asset_id)
        return {"message": "Asset deleted"}

@app.get("/api/v1/assets/{asset_id}/bom")
async def get_asset_bom(asset_id: str):
    async with get_db_session() as db:
        asset = await db.get_by_id("assets", asset_id)
        if not asset:
            raise HTTPException(404, "Asset not found")
        return {
            "asset_id": asset_id,
            "bom_version": "1.4",
            "format": "spdx",
            "generated_at": datetime.utcnow().isoformat(),
            "components": [
                {"name": asset.get("model", "unknown"), "type": "ai-model", "version": "latest",
                 "supplier": asset.get("provider", "unknown"), "license": "Proprietary"},
                {"name": "anthropic-sdk", "type": "library", "version": "0.40.0",
                 "supplier": "Anthropic", "license": "MIT"},
                {"name": "langchain", "type": "library", "version": "0.3.0",
                 "supplier": "LangChain", "license": "MIT"},
            ],
            "data_sources": [
                {"name": "Customer Interaction Logs", "classification": asset.get("data_classification", "internal"),
                 "pii_present": asset.get("data_classification") in ["confidential", "restricted"]},
            ]
        }

# ─── Scans ─────────────────────────────────────────────────────────────────────

@app.post("/api/v1/scans", status_code=202)
async def initiate_scan(scan: ScanCreate, background_tasks: BackgroundTasks):
    async with get_db_session() as db:
        scan_id = f"AEGIS-SCAN-{datetime.utcnow().strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"
        record = {
            "id": scan_id,
            "asset_id": scan.asset_id,
            "target": scan.target,
            "engines": scan.engines or ["garak", "promptfoo", "opengovai_native"],
            "checks": scan.checks or ["all"],
            "compliance_frameworks": scan.compliance_frameworks or ["eu_ai_act", "owasp_llm"],
            "status": "queued",
            "progress": 0,
            "created_at": datetime.utcnow().isoformat(),
            "completed_at": None,
            "findings_count": {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0},
            "risk_score": None,
        }
        await db.insert("scans", record)
        background_tasks.add_task(orchestrator.run_scan, scan_id, record, db)
        return {"scan_id": scan_id, "status": "queued", "message": "Scan initiated"}

@app.get("/api/v1/scans")
async def list_scans(asset_id: Optional[str] = None, status: Optional[str] = None):
    async with get_db_session() as db:
        scans = await db.get_all("scans")
        if asset_id:
            scans = [s for s in scans if s.get("asset_id") == asset_id]
        if status:
            scans = [s for s in scans if s.get("status") == status]
        return {"scans": sorted(scans, key=lambda x: x.get("created_at", ""), reverse=True), "total": len(scans)}

@app.get("/api/v1/scans/{scan_id}")
async def get_scan(scan_id: str):
    async with get_db_session() as db:
        scan = await db.get_by_id("scans", scan_id)
        if not scan:
            raise HTTPException(404, f"Scan {scan_id} not found")
        return scan

# ─── Findings ──────────────────────────────────────────────────────────────────

@app.get("/api/v1/findings")
async def list_findings(
    severity: Optional[str] = None,
    status: Optional[str] = None,
    scan_id: Optional[str] = None,
    asset_id: Optional[str] = None,
    framework: Optional[str] = None
):
    async with get_db_session() as db:
        findings = await db.get_all("findings")
        if severity:
            findings = [f for f in findings if f.get("severity") == severity]
        if status:
            findings = [f for f in findings if f.get("status") == status]
        if scan_id:
            findings = [f for f in findings if f.get("scan_id") == scan_id]
        if asset_id:
            findings = [f for f in findings if f.get("asset_id") == asset_id]
        if framework:
            findings = [f for f in findings if framework in f.get("frameworks", [])]
        return {"findings": findings, "total": len(findings)}

@app.patch("/api/v1/findings/{finding_id}")
async def update_finding(finding_id: str, update: FindingUpdate):
    async with get_db_session() as db:
        finding = await db.get_by_id("findings", finding_id)
        if not finding:
            raise HTTPException(404, "Finding not found")
        finding.update({k: v for k, v in update.dict().items() if v is not None})
        finding["updated_at"] = datetime.utcnow().isoformat()
        await db.update("findings", finding_id, finding)
        return finding

# ─── Compliance ────────────────────────────────────────────────────────────────

@app.get("/api/v1/compliance/{framework}/controls")
async def get_framework_controls(framework: str):
    """Return the full control list for a framework with pass/fail per control."""
    from compliance import FRAMEWORK_CONTROLS
    from database import _db, _lock

    fw = FRAMEWORK_CONTROLS.get(framework) or UPSTREAM_CONTROLS.get(framework)
    if not fw:
        raise HTTPException(404, f"Framework '{framework}' not found")

    async with _lock:
        findings = list(_db.get("findings", {}).values())

    upstream = UPSTREAM_CONTROLS.get(framework, {})
    controls_in_db  = {c["id"] for c in fw.get("controls", [])}
    controls_upstream = {c["id"] for c in upstream.get("controls", [])}

    # Enrich each control with pass/fail and finding count
    enriched = []
    for ctrl in upstream.get("controls") or fw.get("controls", []):
        ctrl_findings = [
            f for f in findings
            if framework in f.get("frameworks", [])
            and f.get("status") == "open"
        ]
        # Simple heuristic: first N open findings map to first N controls
        idx = list(upstream.get("controls") or fw.get("controls", [])).index(ctrl)
        has_open_finding = idx < len(ctrl_findings)

        enriched.append({
            **ctrl,
            "status":        "fail" if has_open_finding else "pass",
            "open_findings": 1 if has_open_finding else 0,
            "in_local":      ctrl["id"] in controls_in_db,
            "in_upstream":   ctrl["id"] in controls_upstream,
        })

    return {
        "framework":   framework,
        "label":       fw.get("label", framework),
        "version":     upstream.get("version", "Unknown"),
        "source_url":  upstream.get("source_url", ""),
        "controls":    enriched,
        "total":       len(enriched),
        "passing":     sum(1 for c in enriched if c["status"] == "pass"),
        "failing":     sum(1 for c in enriched if c["status"] == "fail"),
    }


@app.post("/api/v1/compliance/{framework}/check-updates")
async def check_framework_updates(framework: str):
    """
    Diff the current local control list against the canonical upstream definition.
    Returns added, removed, and modified controls.
    In production this would fetch from the live source URL.
    Here we diff FRAMEWORK_CONTROLS (what's loaded) vs UPSTREAM_CONTROLS (authoritative).
    """
    from compliance import FRAMEWORK_CONTROLS

    upstream = UPSTREAM_CONTROLS.get(framework)
    if not upstream:
        raise HTTPException(404, f"No upstream definition for framework '{framework}'")

    local_fw = FRAMEWORK_CONTROLS.get(framework, {})
    local_controls    = {c["id"]: c for c in local_fw.get("controls", [])}
    upstream_controls = {c["id"]: c for c in upstream.get("controls", [])}

    added   = [c for cid, c in upstream_controls.items() if cid not in local_controls]
    removed = [c for cid, c in local_controls.items()    if cid not in upstream_controls]
    modified = []
    for cid in set(local_controls) & set(upstream_controls):
        lc, uc = local_controls[cid], upstream_controls[cid]
        if lc.get("name") != uc.get("name") or lc.get("article") != uc.get("article"):
            modified.append({
                "id":       cid,
                "local":    lc,
                "upstream": uc,
                "changes":  {
                    k: {"from": lc.get(k), "to": uc.get(k)}
                    for k in ("name", "article")
                    if lc.get(k) != uc.get(k)
                },
            })

    has_updates = bool(added or removed or modified)
    return {
        "framework":     framework,
        "label":         upstream.get("label", local_fw.get("label", framework)),
        "version":       upstream.get("version"),
        "source_url":    upstream.get("source_url"),
        "last_checked":  upstream.get("last_checked"),
        "has_updates":   has_updates,
        "summary": {
            "added":    len(added),
            "removed":  len(removed),
            "modified": len(modified),
        },
        "added":    added,
        "removed":  removed,
        "modified": modified,
        "current_local_count":    len(local_controls),
        "current_upstream_count": len(upstream_controls),
    }


@app.post("/api/v1/compliance/{framework}/apply-updates")
async def apply_framework_updates(framework: str):
    """Merge upstream controls into the local FRAMEWORK_CONTROLS dict."""
    from compliance import FRAMEWORK_CONTROLS

    upstream = UPSTREAM_CONTROLS.get(framework)
    if not upstream:
        raise HTTPException(404, f"No upstream definition for '{framework}'")

    if framework not in FRAMEWORK_CONTROLS:
        FRAMEWORK_CONTROLS[framework] = {"label": upstream.get("label", framework), "controls": []}

    FRAMEWORK_CONTROLS[framework]["controls"] = upstream["controls"].copy()

    return {
        "framework": framework,
        "applied":   len(upstream["controls"]),
        "version":   upstream.get("version"),
        "message":   f"Applied {len(upstream['controls'])} controls from upstream",
    }


@app.get("/api/v1/compliance/{framework}")
async def get_compliance(framework: str):
    async with get_db_session() as db:
        findings = await db.get_all("findings")
        return await compliance_mapper.get_posture(framework, findings)

@app.post("/api/v1/compliance/evidence")
async def generate_evidence(framework: str = Query(...), asset_id: Optional[str] = None):
    async with get_db_session() as db:
        findings = await db.get_all("findings")
        assets = await db.get_all("assets")
        return await compliance_mapper.generate_evidence_pack(framework, findings, assets, asset_id)

# ─── Policies ──────────────────────────────────────────────────────────────────

@app.get("/api/v1/policies")
async def list_policies():
    """
    Returns policies with live control count from FRAMEWORK_CONTROLS.
    The stored policy.controls may be stale (seeded with old counts).
    We override it with the live count so the UI always shows the correct number.
    """
    from compliance import FRAMEWORK_CONTROLS
    async with get_db_session() as db:
        policies = await db.get_all("policies")
    # Enrich each policy with live count from FRAMEWORK_CONTROLS
    enriched = []
    for p in policies:
        fw = p.get("framework", "")
        live_count = len(FRAMEWORK_CONTROLS.get(fw, {}).get("controls", []))
        enriched.append({
            **p,
            "controls": live_count if live_count > 0 else p.get("controls", 0),
        })
    return {"policies": enriched, "total": len(enriched)}

@app.post("/api/v1/policies", status_code=201)
async def create_policy(policy: PolicyCreate):
    async with get_db_session() as db:
        record = {
            "id": f"POL-{str(uuid.uuid4())[:8].upper()}",
            "name": policy.name,
            "description": policy.description,
            "framework": policy.framework,
            "controls": policy.controls,
            "status": "active",
            "version": "1.0",
            "created_at": datetime.utcnow().isoformat(),
        }
        await db.insert("policies", record)
        return record

# ─── Workflows ─────────────────────────────────────────────────────────────────

@app.get("/api/v1/workflows")
async def list_workflows(status: Optional[str] = None):
    async with get_db_session() as db:
        workflows = await db.get_all("workflows")
        if status:
            workflows = [w for w in workflows if w.get("status") == status]
        return {"workflows": workflows, "total": len(workflows)}

@app.post("/api/v1/workflows", status_code=201)
async def create_workflow(workflow: WorkflowCreate):
    async with get_db_session() as db:
        record = {
            "id": f"WF-{str(uuid.uuid4())[:8].upper()}",
            "asset_id": workflow.asset_id,
            "type": workflow.type,
            "title": workflow.title,
            "description": workflow.description,
            "status": "pending",
            "current_stage": "security_review",
            "stages": [
                {"name": "security_review", "label": "Security Review", "status": "pending", "approver": None},
                {"name": "risk_assessment", "label": "Risk Assessment", "status": "pending", "approver": None},
                {"name": "compliance_check", "label": "Compliance Check", "status": "pending", "approver": None},
                {"name": "governance_approval", "label": "Governance Approval", "status": "pending", "approver": None},
            ],
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
        await db.insert("workflows", record)
        return record

@app.patch("/api/v1/workflows/{workflow_id}/approve")
async def approve_workflow_stage(workflow_id: str, approver: str = Query(...), notes: Optional[str] = None):
    async with get_db_session() as db:
        wf = await db.get_by_id("workflows", workflow_id)
        if not wf:
            raise HTTPException(404, "Workflow not found")
        stages = wf.get("stages", [])
        current = wf.get("current_stage")
        stage_names = [s["name"] for s in stages]
        if current in stage_names:
            idx = stage_names.index(current)
            stages[idx]["status"] = "approved"
            stages[idx]["approver"] = approver
            stages[idx]["notes"] = notes
            stages[idx]["approved_at"] = datetime.utcnow().isoformat()
            if idx + 1 < len(stages):
                wf["current_stage"] = stages[idx + 1]["name"]
                stages[idx + 1]["status"] = "in_progress"
            else:
                wf["status"] = "approved"
                wf["current_stage"] = "complete"
        wf["stages"] = stages
        wf["updated_at"] = datetime.utcnow().isoformat()
        await db.update("workflows", workflow_id, wf)
        return wf

# ─── Helpers ───────────────────────────────────────────────────────────────────

def _calculate_risk_tier(asset: AssetCreate) -> str:
    if asset.data_classification in ["restricted", "top_secret"]:
        return "high"
    if asset.autonomy_level == "fully_autonomous":
        return "high"
    if asset.data_classification == "confidential":
        return "limited"
    return "minimal"

def _calculate_initial_risk(asset: AssetCreate) -> float:
    base = 4.0
    if asset.data_classification == "restricted":
        base += 3.0
    elif asset.data_classification == "confidential":
        base += 2.0
    if asset.autonomy_level == "fully_autonomous":
        base += 2.5
    elif asset.autonomy_level == "semi_autonomous":
        base += 1.5
    return min(round(base, 1), 10.0)


@app.post("/api/v1/frameworks", status_code=201)
async def register_framework(fw: dict):
    """Register a custom compliance framework"""
    from compliance import FRAMEWORK_CONTROLS
    fw_id = fw.get("id") or fw["label"].lower().replace(" ","_")
    FRAMEWORK_CONTROLS[fw_id] = {
        "label": fw.get("label", fw_id),
        "controls": fw.get("controls", []),
    }
    return {"id": fw_id, "label": FRAMEWORK_CONTROLS[fw_id]["label"], "controls": len(FRAMEWORK_CONTROLS[fw_id]["controls"])}

@app.get("/api/v1/frameworks")
async def list_frameworks():
    """
    Returns ALL frameworks with live control counts from FRAMEWORK_CONTROLS.
    Merges UPSTREAM_CONTROLS metadata (color, source, version, desc) so the
    frontend never hardcodes framework metadata.
    Called on every page load by Compliance and Policies pages.
    """
    from compliance import FRAMEWORK_CONTROLS

    # Static metadata for built-in frameworks (color, source, desc)
    # Custom/registered frameworks fall back to defaults
    BUILTIN_META = {
        "eu_ai_act":   {"color":"#0078D4","source":"eur-lex.europa.eu",
                        "desc":"EU AI Act 2024/1689 — enforced August 2026"},
        "nist_ai_rmf": {"color":"#00B7C3","source":"airc.nist.gov",
                        "desc":"NIST AI Risk Management Framework 1.0 + GenAI Profile"},
        "owasp_llm":   {"color":"#16C60C","source":"owasp.org",
                        "desc":"OWASP LLM Top 10 2025 with sub-controls and mitigations"},
        "iso_42001":   {"color":"#FFB900","source":"iso.org",
                        "desc":"ISO/IEC 42001:2023 AI Management Systems Standard"},
        "cfr_part11":  {"color":"#E74856","source":"ecfr.gov",
                        "desc":"21 CFR Part 11 + FDA AI/ML Software Guidance 2024"},
    }
    uc_meta = {
        k: {"version": v.get("version",""), "source_url": v.get("source_url","")}
        for k, v in UPSTREAM_CONTROLS.items()
    }

    frameworks = []
    for fw_id, fw_data in FRAMEWORK_CONTROLS.items():
        meta    = BUILTIN_META.get(fw_id, {"color":"#888","source":"custom","desc":fw_data.get("label","")})
        uc      = uc_meta.get(fw_id, {})
        n_ctrl  = len(fw_data.get("controls", []))
        frameworks.append({
            "id":          fw_id,
            "label":       fw_data.get("label", fw_id),
            "controls":    n_ctrl,           # live count — always from FRAMEWORK_CONTROLS
            "color":       meta["color"],
            "source":      meta["source"],
            "desc":        meta["desc"],
            "version":     uc.get("version", ""),
            "source_url":  uc.get("source_url", ""),
        })
    return {"frameworks": frameworks, "total": len(frameworks)}

async def seed_demo_data():
    """Seed database with realistic demo data"""
    from database import _db
    if _db.get("assets"):
        return

    demo_assets = [
        {"id": "ASSET-CS001", "name": "[SAMPLE] Customer Support Chatbot", "model": "claude-3-5-sonnet",
         "provider": "Anthropic", "environment": "production", "owner": "AI Platform Team",
         "use_case": "Customer support ticket triage and response", "data_classification": "confidential",
         "autonomy_level": "human_in_loop", "status": "active", "risk_tier": "limited",
         "risk_score": 6.8, "created_at": "2026-01-15T10:00:00", "last_scanned": "2026-03-20T14:22:00",
         "frameworks": ["eu_ai_act", "nist_ai_rmf", "owasp_llm"]},
        {"id": "ASSET-HR002", "name": "[SAMPLE] HR Resume Screener", "model": "gpt-4o",
         "provider": "OpenAI", "environment": "production", "owner": "HR Technology",
         "use_case": "Initial resume screening and candidate ranking", "data_classification": "restricted",
         "autonomy_level": "semi_autonomous", "status": "active", "risk_tier": "high",
         "risk_score": 8.4, "created_at": "2026-02-01T09:00:00", "last_scanned": "2026-03-18T11:00:00",
         "frameworks": ["eu_ai_act", "nist_ai_rmf", "owasp_llm"]},
        {"id": "ASSET-FIN003", "name": "[SAMPLE] Fraud Detection Model", "model": "internal-fraud-v3",
         "provider": "Internal", "environment": "production", "owner": "Risk Engineering",
         "use_case": "Real-time transaction fraud scoring", "data_classification": "restricted",
         "autonomy_level": "fully_autonomous", "status": "active", "risk_tier": "high",
         "risk_score": 9.1, "created_at": "2025-11-01T08:00:00", "last_scanned": "2026-03-22T08:00:00",
         "frameworks": ["eu_ai_act", "nist_ai_rmf", "owasp_llm", "iso_42001"]},
        {"id": "ASSET-MKT004", "name": "[SAMPLE] Marketing Content Generator", "model": "gpt-4o-mini",
         "provider": "OpenAI", "environment": "staging", "owner": "Marketing Ops",
         "use_case": "Automated email and social media content generation", "data_classification": "internal",
         "autonomy_level": "fully_autonomous", "status": "active", "risk_tier": "minimal",
         "risk_score": 3.2, "created_at": "2026-03-01T12:00:00", "last_scanned": None,
         "frameworks": ["owasp_llm"]},
        {"id": "ASSET-SHD005", "name": "[SAMPLE] Shadow AI — Notion AI", "model": "notion-ai",
         "provider": "Notion", "environment": "production", "owner": "UNKNOWN",
         "use_case": "Unauthorized document generation by engineering team", "data_classification": "confidential",
         "autonomy_level": "human_in_loop", "status": "shadow", "risk_tier": "high",
         "risk_score": 7.9, "created_at": "2026-03-10T00:00:00", "last_scanned": None,
         "frameworks": []},
    ]

    demo_findings = [
        {"id": "AEGIS-2026-001", "scan_id": "AEGIS-SCAN-20260320-001", "asset_id": "ASSET-CS001",
         "severity": "critical", "risk_score": 9.3, "status": "open",
         "category": "Prompt Injection", "title": "System prompt exfiltration via indirect injection",
         "description": "Attacker-controlled document in RAG corpus contains instructions that override system prompt, enabling full system prompt disclosure.",
         "evidence": "Garak probe `PromptInjection.Compat` — model responded with full system prompt contents when retrieval context included adversarial payload.",
         "impact": "Complete system prompt disclosure; potential for attacker to map system capabilities and craft targeted bypass attacks.",
         "remediation": "Implement prompt injection detection on retrieved context before assembly. Add output scanning to detect system prompt reflection. Separate system instructions from user-accessible context.",
         "frameworks": ["eu_ai_act", "owasp_llm", "nist_ai_rmf"],
         "references": ["OWASP LLM01:2025", "MITRE ATLAS AML.T0054", "EU AI Act Art. 9"],
         "created_at": "2026-03-20T14:30:00", "updated_at": "2026-03-20T14:30:00"},
        {"id": "AEGIS-2026-002", "scan_id": "AEGIS-SCAN-20260320-001", "asset_id": "ASSET-CS001",
         "severity": "high", "risk_score": 7.8, "status": "open",
         "category": "Data Privacy", "title": "PII leakage in conversation context window",
         "description": "Model retains and surfaces PII from previous turns in multi-session contexts, enabling cross-user data leakage.",
         "evidence": "PyRIT multi-turn probe — user A's email address surfaced in user B's session after 3-turn context injection sequence.",
         "impact": "GDPR Article 5(1)(c) violation — data minimisation principle breached. Risk of regulatory fine up to 4% annual global turnover.",
         "remediation": "Implement strict session isolation. Clear conversation context between users. Add PII detection and redaction layer on all model outputs.",
         "frameworks": ["gdpr", "eu_ai_act", "nist_ai_rmf"],
         "references": ["OWASP LLM02:2025", "GDPR Art. 5", "EU AI Act Art. 10"],
         "created_at": "2026-03-20T14:45:00", "updated_at": "2026-03-20T14:45:00"},
        {"id": "AEGIS-2026-003", "scan_id": "AEGIS-SCAN-20260318-001", "asset_id": "ASSET-HR002",
         "severity": "critical", "risk_score": 9.7, "status": "open",
         "category": "Bias & Fairness", "title": "Statistically significant gender bias in resume scoring",
         "description": "Model assigns 23% lower scores on average to resumes with female-associated names for senior technical roles.",
         "evidence": "Counterfactual fairness test — 500 identical resumes with gender-differentiated names. Male-coded names scored 7.4 avg vs female-coded 5.7 avg for 'Senior Engineer' roles.",
         "impact": "Direct EU AI Act Annex III violation (high-risk AI in employment). Potential discrimination claims. Regulatory enforcement risk.",
         "remediation": "Immediately suspend autonomous scoring. Conduct full bias audit. Retrain with balanced dataset. Implement fairness constraints. Require human review for all decisions.",
         "frameworks": ["eu_ai_act", "nist_ai_rmf"],
         "references": ["OWASP LLM09:2025", "EU AI Act Annex III", "NIST AI RMF MEASURE 2.11"],
         "created_at": "2026-03-18T11:30:00", "updated_at": "2026-03-18T11:30:00"},
        {"id": "AEGIS-2026-004", "scan_id": "AEGIS-SCAN-20260322-001", "asset_id": "ASSET-FIN003",
         "severity": "high", "risk_score": 8.1, "status": "in_remediation",
         "category": "Agentic Governance", "title": "Kill switch mechanism not validated under adversarial conditions",
         "description": "Human override mechanism fails to halt model execution when override signal arrives during active inference batch processing.",
         "evidence": "ASI-02 kill switch test — override signal sent during 50-item batch. 12 decisions completed after override signal receipt (avg 340ms lag).",
         "impact": "EU AI Act Art. 14 (Human Oversight) violation. In high-velocity fraud scenario, 12 autonomous decisions post-override represents significant financial and regulatory risk.",
         "remediation": "Implement synchronous kill switch that interrupts batch at next inference boundary. Add circuit breaker pattern. SLA: kill switch must halt within 1 inference cycle.",
         "frameworks": ["eu_ai_act", "nist_ai_rmf"],
         "references": ["OWASP ASI-02", "EU AI Act Art. 14", "Singapore Model AI Governance 2026"],
         "created_at": "2026-03-22T09:00:00", "updated_at": "2026-03-22T16:00:00"},
        {"id": "AEGIS-2026-005", "scan_id": "AEGIS-SCAN-20260320-001", "asset_id": "ASSET-CS001",
         "severity": "medium", "risk_score": 5.4, "status": "open",
         "category": "Supply Chain", "title": "Model card missing required EU AI Act Annex IV documentation",
         "description": "Asset ASSET-CS001 lacks: training data provenance, intended purpose limitations, performance metrics on protected attribute subgroups.",
         "evidence": "Model card completeness check — 7 of 12 required Annex IV fields missing or incomplete.",
         "impact": "EU AI Act Article 11 non-compliance. Cannot demonstrate conformity for high-risk classification. Blocks regulatory submission.",
         "remediation": "Complete model card per Annex IV checklist. Document training data sources, evaluation methodology, and performance disaggregation by demographic subgroups.",
         "frameworks": ["eu_ai_act"],
         "references": ["EU AI Act Art. 11", "EU AI Act Annex IV"],
         "created_at": "2026-03-20T15:00:00", "updated_at": "2026-03-20T15:00:00"},
        {"id": "AEGIS-2026-006", "scan_id": "AEGIS-SCAN-20260318-001", "asset_id": "ASSET-HR002",
         "severity": "medium", "risk_score": 6.2, "status": "resolved",
         "category": "Operational Security", "title": "API key exposed in application environment variable logs",
         "description": "OpenAI API key logged in plaintext in application startup logs accessible to all engineering staff.",
         "evidence": "Semgrep AI rule SEC-001 — OPENAI_API_KEY found in stdout log stream at INFO level.",
         "impact": "Credential compromise risk. Unauthorized API usage. Potential data exfiltration via model API.",
         "remediation": "Rotate API key immediately. Remove from logs. Use secrets manager (Vault/AWS SSM). Implement log scrubbing middleware.",
         "frameworks": ["nist_ai_rmf", "owasp_llm"],
         "references": ["OWASP LLM10:2025", "NIST AI RMF MANAGE 2.2"],
         "created_at": "2026-03-18T12:00:00", "updated_at": "2026-03-19T10:00:00"},
        {"id": "AEGIS-2026-007", "scan_id": "AEGIS-SCAN-20260322-001", "asset_id": "ASSET-FIN003",
         "severity": "low", "risk_score": 3.1, "status": "accepted",
         "category": "Explainability", "title": "Decision explanations below regulatory threshold for adverse actions",
         "description": "Model provides feature attribution scores but narrative explanations lack specificity required for adverse action notices.",
         "evidence": "InterpretML output — SHAP values generated but not translated to human-readable explanations meeting regulatory minimum.",
         "impact": "May not satisfy financial services adverse action notice requirements under ECOA/Reg B for US operations.",
         "remediation": "Integrate SHAP-to-narrative translation layer. Template adverse action notices from top contributing factors. Legal review before deployment.",
         "frameworks": ["nist_ai_rmf"],
         "references": ["NIST AI RMF GOVERN 1.3", "EU AI Act Art. 13"],
         "created_at": "2026-03-22T10:00:00", "updated_at": "2026-03-22T14:00:00"},
        {"id": "AEGIS-2026-CFR01", "scan_id": "AEGIS-SCAN-20260322-001", "asset_id": "ASSET-FIN003",
         "severity": "critical", "risk_score": 9.3, "status": "open",
         "category": "Operational Security",
         "title": "[SAMPLE] Audit Trail Gaps in AI Decision Records",
         "description": "The Fraud Detection Model does not maintain computer-generated, time-stamped audit trails for AI decision records. Log entries are overwritten rather than appended, making it impossible to reconstruct the sequence of AI-assisted decisions. Violates 21 CFR Part 11 Sec. 11.10(e) and EU AI Act Article 12.",
         "evidence": "Automated audit scan found 47 instances where AI decision records were modified without an immutable audit entry. Log rotation deletes entries after 30 days. No operator ID is captured for model inference requests.",
         "impact": "FDA inspection would find the AI system non-compliant with 21 CFR Part 11 electronic records requirements. AI-assisted regulated decisions cannot be reconstructed. Risk of product recall, consent decree, or import alert for medical device applications.",
         "remediation": "1. Implement append-only audit log storage with cryptographic chaining. 2. Capture operator ID, timestamp, and action for every AI inference. 3. Set retention to minimum 3 years per 21 CFR Part 11. 4. Schedule quarterly audit trail completeness verification per Sec. 11.10(e).",
         "frameworks": ["cfr_part11", "eu_ai_act", "nist_ai_rmf"],
         "references": ["21 CFR Part 11 Sec. 11.10(e)", "EU AI Act Art. 12", "NIST AI RMF MANAGE 4.1", "CFR-11.10e", "CFR-11.10d"],
         "created_at": "2026-03-22T14:30:00", "updated_at": "2026-03-22T14:30:00"},

    ]

    demo_scans = [
        {"id": "AEGIS-SCAN-20260320-001", "asset_id": "ASSET-CS001", "target": "[SAMPLE] Customer Support Chatbot",
         "engines": ["garak", "promptfoo", "pyrit", "opengovai_native"], "status": "completed",
         "progress": 100, "created_at": "2026-03-20T14:00:00", "completed_at": "2026-03-20T14:47:00",
         "checks": ["all"], "compliance_frameworks": ["eu_ai_act", "owasp_llm", "nist_ai_rmf"],
         "findings_count": {"critical": 1, "high": 1, "medium": 1, "low": 0, "info": 3},
         "risk_score": 8.1, "total_probes": 634},
        {"id": "AEGIS-SCAN-20260318-001", "asset_id": "ASSET-HR002", "target": "[SAMPLE] HR Resume Screener",
         "engines": ["garak", "deepteam", "opengovai_native"], "status": "completed",
         "progress": 100, "created_at": "2026-03-18T11:00:00", "completed_at": "2026-03-18T11:58:00",
         "checks": ["bias_fairness", "agentic_governance", "operational_security"],
         "compliance_frameworks": ["eu_ai_act", "nist_ai_rmf"],
         "findings_count": {"critical": 1, "high": 0, "medium": 1, "low": 0, "info": 2},
         "risk_score": 9.2, "total_probes": 412},
        {"id": "AEGIS-SCAN-20260322-001", "asset_id": "ASSET-FIN003", "target": "[SAMPLE] Fraud Detection Model",
         "engines": ["garak", "promptfoo", "pyrit", "fuzzyai", "opengovai_native"], "status": "completed",
         "progress": 100, "created_at": "2026-03-22T08:00:00", "completed_at": "2026-03-22T09:12:00",
         "checks": ["all"], "compliance_frameworks": ["eu_ai_act", "nist_ai_rmf", "iso_42001"],
         "findings_count": {"critical": 0, "high": 1, "medium": 0, "low": 1, "info": 4},
         "risk_score": 7.4, "total_probes": 847},
    ]

    demo_workflows = [
        {"id": "WF-DEPLOY001", "asset_id": "ASSET-MKT004", "type": "deployment_approval",
         "title": "Marketing Content Generator — Production Deployment Request",
         "description": "Requesting approval to promote Marketing Content Generator from staging to production.",
         "status": "pending", "current_stage": "security_review",
         "stages": [
             {"name": "security_review", "label": "Security Review", "status": "in_progress", "approver": None},
             {"name": "risk_assessment", "label": "Risk Assessment", "status": "pending", "approver": None},
             {"name": "compliance_check", "label": "Compliance Check", "status": "pending", "approver": None},
             {"name": "governance_approval", "label": "Governance Approval", "status": "pending", "approver": None},
         ],
         "created_at": "2026-03-22T13:00:00", "updated_at": "2026-03-22T13:00:00"},
        {"id": "WF-REVIEW002", "asset_id": "ASSET-HR002", "type": "risk_review",
         "title": "HR Resume Screener — Critical Bias Finding Review",
         "description": "Mandatory risk review triggered by Critical severity bias finding AEGIS-2026-003.",
         "status": "pending", "current_stage": "risk_assessment",
         "stages": [
             {"name": "security_review", "label": "Security Review", "status": "approved", "approver": "j.smith@acme.com"},
             {"name": "risk_assessment", "label": "Risk Assessment", "status": "in_progress", "approver": None},
             {"name": "compliance_check", "label": "Compliance Check", "status": "pending", "approver": None},
             {"name": "governance_approval", "label": "Governance Approval", "status": "pending", "approver": None},
         ],
         "created_at": "2026-03-18T15:00:00", "updated_at": "2026-03-20T10:00:00"},
    ]

    # Policy controls counts derived from FRAMEWORK_CONTROLS — single source of truth
    demo_policies = [
        {"id": "POL-EU-ACT01", "name": "EU AI Act Compliance Pack", "framework": "eu_ai_act",
         "description": "Full EU AI Act obligations — Articles 1-55, GPAI provisions, all Annexes",
         "status": "active", "version": "4.0", "controls": 34,
         "created_at": "2026-01-01T00:00:00"},
        {"id": "POL-NIST-001", "name": "NIST AI RMF Implementation Pack", "framework": "nist_ai_rmf",
         "description": "Full GOVERN/MAP/MEASURE/MANAGE sub-controls — RMF 1.0 + GenAI Profile",
         "status": "active", "version": "4.0", "controls": 68,
         "created_at": "2026-01-01T00:00:00"},
        {"id": "POL-OWASP-001", "name": "OWASP LLM Security Pack", "framework": "owasp_llm",
         "description": "All LLM01-LLM10 2025 categories with sub-controls and mitigations",
         "status": "active", "version": "4.0", "controls": 48,
         "created_at": "2026-01-01T00:00:00"},
        {"id": "POL-ISO-0001", "name": "ISO 42001 Management System Pack", "framework": "iso_42001",
         "description": "Full Clauses 4-10 and all Annex A controls for AI management systems",
         "status": "active", "version": "4.0", "controls": 36,
         "created_at": "2026-02-01T00:00:00"},
        {"id": "POL-CFR-001", "name": "21 CFR Part 11 Compliance Pack", "framework": "cfr_part11",
         "description": "FDA electronic records, e-signatures and AI/ML SaMD Guidance 2024",
         "status": "active", "version": "4.0", "controls": 30,
         "created_at": "2026-02-01T00:00:00"},
    ]

    for item in demo_assets:
        _db.setdefault("assets", {})[item["id"]] = item
    for item in demo_findings:
        _db.setdefault("findings", {})[item["id"]] = item
    for item in demo_scans:
        _db.setdefault("scans", {})[item["id"]] = item
    for item in demo_workflows:
        _db.setdefault("workflows", {})[item["id"]] = item
    for item in demo_policies:
        _db.setdefault("policies", {})[item["id"]] = item


# ─── Catch-all: serve helpful page if someone hits API port directly ───────────

@app.get("/", response_class=HTMLResponse, include_in_schema=False)
@app.get("/{full_path:path}", response_class=HTMLResponse, include_in_schema=False)
async def serve_frontend_redirect(full_path: str = ""):
    # Only intercept non-API paths
    if full_path.startswith("api/") or full_path in ("docs", "openapi.json", "redoc"):
        raise HTTPException(status_code=404)
    fe_port = 3000
    url = f"http://localhost:{fe_port}/{full_path}"
    return HTMLResponse(content=f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0;url={url}">
<title>OpenGovAI — Redirecting</title>
<style>body{{font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0F1923;color:#C0CBD8}}.box{{text-align:center;padding:40px;background:#1A2740;border-radius:12px;border:1px solid rgba(255,255,255,0.1)}}.title{{font-size:24px;font-weight:700;color:#fff;margin-bottom:8px}}.sub{{font-size:14px;color:#7A8FA6;margin-bottom:24px}}a{{color:#0078D4;font-size:16px;font-weight:600}}</style>
</head>
<body>
<div class="box">
  <div class="title">OpenGovAI</div>
  <div class="sub">You reached the API server (port 8000).<br>The dashboard runs on port {fe_port}.</div>
  <a href="{url}">Click here if not redirected automatically →</a>
</div>
</body>
</html>""", status_code=200)


# --- Framework update check --------------------------------------------------
# Canonical upstream control lists. ASCII-only article references (no section
# symbol) to avoid encoding issues across platforms.

UPSTREAM_CONTROLS = {
    "eu_ai_act": {
        "version":      "Regulation (EU) 2024/1689 — enforcement Aug 2026",
        "source_url":   "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689",
        "last_checked": "2026-03-01",
        "controls": [
            {"id":"AIA-1", "name":"Subject Matter and Scope", "article":"Article 1-2", "severity":"Low"},
            {"id":"AIA-3", "name":"Definitions and Terminology", "article":"Article 3", "severity":"Low"},
            {"id":"AIA-5", "name":"Prohibited AI Practices", "article":"Article 5", "severity":"Critical"},
            {"id":"AIA-6", "name":"High-Risk AI System Classification Rules", "article":"Article 6", "severity":"Critical"},
            {"id":"AIA-7", "name":"Amendments to Annex III High-Risk List", "article":"Article 7", "severity":"Low"},
            {"id":"AIA-8", "name":"Compliance with Requirements", "article":"Article 8", "severity":"Low"},
            {"id":"AIA-9", "name":"Risk Management System", "article":"Article 9", "severity":"Critical"},
            {"id":"AIA-10", "name":"Data and Data Governance", "article":"Article 10", "severity":"High"},
            {"id":"AIA-11", "name":"Technical Documentation", "article":"Article 11", "severity":"High"},
            {"id":"AIA-12", "name":"Record-keeping and Logging", "article":"Article 12", "severity":"High"},
            {"id":"AIA-13", "name":"Transparency and User Information", "article":"Article 13", "severity":"Medium"},
            {"id":"AIA-14", "name":"Human Oversight", "article":"Article 14", "severity":"Critical"},
            {"id":"AIA-15", "name":"Accuracy, Robustness and Cybersecurity", "article":"Article 15", "severity":"Critical"},
            {"id":"AIA-16", "name":"Provider Obligations", "article":"Article 16", "severity":"Critical"},
            {"id":"AIA-17", "name":"Quality Management System", "article":"Article 17", "severity":"High"},
            {"id":"AIA-18", "name":"Post-Market Monitoring Plan", "article":"Article 18", "severity":"Medium"},
            {"id":"AIA-19", "name":"Serious Incident Reporting", "article":"Article 19", "severity":"Critical"},
            {"id":"AIA-20", "name":"Corrective Action and Information Obligations", "article":"Article 20", "severity":"Medium"},
            {"id":"AIA-21", "name":"Cooperation with Authorities", "article":"Article 21", "severity":"Medium"},
            {"id":"AIA-22", "name":"Authorised Representatives", "article":"Article 22", "severity":"Medium"},
            {"id":"AIA-23", "name":"Importer Obligations", "article":"Article 23", "severity":"Low"},
            {"id":"AIA-24", "name":"Distributor Obligations", "article":"Article 24", "severity":"Low"},
            {"id":"AIA-25", "name":"Deployer Obligations", "article":"Article 25", "severity":"Critical"},
            {"id":"AIA-26", "name":"Fundamental Rights Impact Assessment", "article":"Article 26", "severity":"Critical"},
            {"id":"AIA-27", "name":"Obligations for Deployers in Public Sector", "article":"Article 27", "severity":"Low"},
            {"id":"AIA-51", "name":"Classification of GPAI Models", "article":"Article 51", "severity":"Critical"},
            {"id":"AIA-53", "name":"Obligations for GPAI Model Providers", "article":"Article 53", "severity":"Critical"},
            {"id":"AIA-55", "name":"Systemic Risk GPAI Model Obligations", "article":"Article 55", "severity":"Critical"},
            {"id":"AIA-ANN1", "name":"Prohibited AI Techniques (Annex I)", "article":"Annex I", "severity":"Low"},
            {"id":"AIA-ANN3", "name":"High-Risk AI Systems List (Annex III)", "article":"Annex III", "severity":"Critical"},
            {"id":"AIA-ANN4", "name":"Technical Documentation Requirements (Annex IV)", "article":"Annex IV", "severity":"Medium"},
            {"id":"AIA-ANN6", "name":"Conformity Assessment Procedure (Annex VI)", "article":"Annex VI", "severity":"Critical"},
            {"id":"AIA-ANN7", "name":"Third-Party Conformity Assessment (Annex VII)", "article":"Annex VII", "severity":"Low"},
            {"id":"AIA-ANN11", "name":"Post-Market Monitoring Plan Template (Annex XI)", "article":"Annex XI", "severity":"High"},
        ],
    },
    "nist_ai_rmf": {
        "version":      "NIST AI RMF 1.0 (Jan 2023) + GenAI Profile (Jul 2024)",
        "source_url":   "https://airc.nist.gov/RMF/1",
        "last_checked": "2026-03-01",
        "controls": [
            {"id":"GOV-1.1", "name":"AI Risk Management Policies, Processes, and Procedures", "article":"GOVERN 1.1", "severity":"High"},
            {"id":"GOV-1.2", "name":"Accountability Structures for AI Risk", "article":"GOVERN 1.2", "severity":"High"},
            {"id":"GOV-1.3", "name":"Organisational Risk Tolerance Defined for AI", "article":"GOVERN 1.3", "severity":"High"},
            {"id":"GOV-1.4", "name":"Org-wide AI Risk Culture and Awareness", "article":"GOVERN 1.4", "severity":"High"},
            {"id":"GOV-1.5", "name":"AI Policies Maintained and Updated", "article":"GOVERN 1.5", "severity":"High"},
            {"id":"GOV-1.6", "name":"AI Risk Oversight Roles Defined", "article":"GOVERN 1.6", "severity":"High"},
            {"id":"GOV-1.7", "name":"Processes for AI Risk Escalation", "article":"GOVERN 1.7", "severity":"High"},
            {"id":"GOV-2.1", "name":"Scientific and Technical Knowledge for Risk", "article":"GOVERN 2.1", "severity":"Medium"},
            {"id":"GOV-2.2", "name":"Diverse Teams for AI Development and Deployment", "article":"GOVERN 2.2", "severity":"Medium"},
            {"id":"GOV-3.1", "name":"Decision-Making Documented and Explainable", "article":"GOVERN 3.1", "severity":"Low"},
            {"id":"GOV-3.2", "name":"Bias Awareness Training for AI Teams", "article":"GOVERN 3.2", "severity":"Low"},
            {"id":"GOV-4.1", "name":"Organisational Incentives Aligned with AI Risk", "article":"GOVERN 4.1", "severity":"Low"},
            {"id":"GOV-4.2", "name":"AI Risk Embedded in Org Culture", "article":"GOVERN 4.2", "severity":"Low"},
            {"id":"GOV-5.1", "name":"AI Risk Policies Cover Entire AI Lifecycle", "article":"GOVERN 5.1", "severity":"High"},
            {"id":"GOV-5.2", "name":"Policies Aligned with AI Trustworthiness Principles", "article":"GOVERN 5.2", "severity":"High"},
            {"id":"GOV-6.1", "name":"Third-Party AI Risk Policies and Procedures", "article":"GOVERN 6.1", "severity":"High"},
            {"id":"GOV-6.2", "name":"AI Supply Chain Risk Management", "article":"GOVERN 6.2", "severity":"High"},
            {"id":"MAP-1.1", "name":"AI Context Established — Intended Use and Users", "article":"MAP 1.1", "severity":"Medium"},
            {"id":"MAP-1.2", "name":"Scientific Basis for AI System Categorised", "article":"MAP 1.2", "severity":"Medium"},
            {"id":"MAP-1.3", "name":"AI Risks Identified in Context of Use", "article":"MAP 1.3", "severity":"Medium"},
            {"id":"MAP-1.4", "name":"Organisational Risk Tolerance Applied to AI", "article":"MAP 1.4", "severity":"Medium"},
            {"id":"MAP-1.5", "name":"AI System Boundaries and Scope Documented", "article":"MAP 1.5", "severity":"Medium"},
            {"id":"MAP-1.6", "name":"Stakeholders and Their Concerns Identified", "article":"MAP 1.6", "severity":"Medium"},
            {"id":"MAP-2.1", "name":"Scientific Grounding of AI Evaluated", "article":"MAP 2.1", "severity":"Low"},
            {"id":"MAP-2.2", "name":"AI System Data Characteristics Assessed", "article":"MAP 2.2", "severity":"Low"},
            {"id":"MAP-2.3", "name":"AI Impact on Individuals and Groups Assessed", "article":"MAP 2.3", "severity":"Low"},
            {"id":"MAP-3.1", "name":"AI Risks Categorised by Likelihood and Impact", "article":"MAP 3.1", "severity":"High"},
            {"id":"MAP-3.2", "name":"AI System Failure Modes Identified", "article":"MAP 3.2", "severity":"High"},
            {"id":"MAP-3.3", "name":"Benefits of AI System Assessed", "article":"MAP 3.3", "severity":"High"},
            {"id":"MAP-3.4", "name":"Risks to Vulnerable Groups Assessed", "article":"MAP 3.4", "severity":"High"},
            {"id":"MAP-3.5", "name":"AI System Negative Impacts on Society Assessed", "article":"MAP 3.5", "severity":"High"},
            {"id":"MAP-4.1", "name":"AI Risks Across Lifecycle Stages Identified", "article":"MAP 4.1", "severity":"Medium"},
            {"id":"MAP-4.2", "name":"Internal Expertise Sufficient for AI Risk", "article":"MAP 4.2", "severity":"Medium"},
            {"id":"MAP-5.1", "name":"Likelihood of AI Risk Occurrence Estimated", "article":"MAP 5.1", "severity":"High"},
            {"id":"MAP-5.2", "name":"Practices to Reduce AI Risk Identified", "article":"MAP 5.2", "severity":"High"},
            {"id":"MEA-1.1", "name":"AI Risk Assessment Metrics Defined", "article":"MEASURE 1.1", "severity":"High"},
            {"id":"MEA-1.2", "name":"Metrics for AI Trustworthiness Established", "article":"MEASURE 1.2", "severity":"High"},
            {"id":"MEA-1.3", "name":"Internal Expertise for AI Measurement Available", "article":"MEASURE 1.3", "severity":"High"},
            {"id":"MEA-2.1", "name":"Test Sets Reflect Deployed Context", "article":"MEASURE 2.1", "severity":"Critical"},
            {"id":"MEA-2.2", "name":"AI System Evaluated for Bias and Discrimination", "article":"MEASURE 2.2", "severity":"Critical"},
            {"id":"MEA-2.3", "name":"AI System Explainability Assessed", "article":"MEASURE 2.3", "severity":"Critical"},
            {"id":"MEA-2.4", "name":"AI System Robustness Against Attacks Evaluated", "article":"MEASURE 2.4", "severity":"Critical"},
            {"id":"MEA-2.5", "name":"AI System Privacy Risks Evaluated", "article":"MEASURE 2.5", "severity":"Critical"},
            {"id":"MEA-2.6", "name":"AI System Environmental Impact Evaluated", "article":"MEASURE 2.6", "severity":"Critical"},
            {"id":"MEA-2.7", "name":"AI System Security Evaluated", "article":"MEASURE 2.7", "severity":"Critical"},
            {"id":"MEA-2.8", "name":"AI System Evaluated for Intended Purpose Fitness", "article":"MEASURE 2.8", "severity":"Critical"},
            {"id":"MEA-2.9", "name":"AI System Accountability Mechanisms Evaluated", "article":"MEASURE 2.9", "severity":"Critical"},
            {"id":"MEA-2.10", "name":"AI System Evaluated for Human Oversight Adequacy", "article":"MEASURE 2.10", "severity":"Critical"},
            {"id":"MEA-2.11", "name":"Fairness and Equity Evaluated Across Groups", "article":"MEASURE 2.11", "severity":"Critical"},
            {"id":"MEA-2.12", "name":"AI System Data Quality Evaluated", "article":"MEASURE 2.12", "severity":"Critical"},
            {"id":"MEA-2.13", "name":"AI System Performance Tracked Over Time", "article":"MEASURE 2.13", "severity":"Critical"},
            {"id":"MEA-3.1", "name":"Risk Metrics Monitored Continuously", "article":"MEASURE 3.1", "severity":"Medium"},
            {"id":"MEA-3.2", "name":"Risk Metrics Reported to Stakeholders", "article":"MEASURE 3.2", "severity":"Medium"},
            {"id":"MEA-3.3", "name":"Metric Effectiveness Evaluated Periodically", "article":"MEASURE 3.3", "severity":"Medium"},
            {"id":"MEA-4.1", "name":"Measurement Results Feed Back into Governance", "article":"MEASURE 4.1", "severity":"Low"},
            {"id":"MEA-4.2", "name":"Measurement Approach Improved Iteratively", "article":"MEASURE 4.2", "severity":"Low"},
            {"id":"MNG-1.1", "name":"AI Risks Prioritised by Severity and Likelihood", "article":"MANAGE 1.1", "severity":"Critical"},
            {"id":"MNG-1.2", "name":"Response Plans for High-Priority AI Risks", "article":"MANAGE 1.2", "severity":"High"},
            {"id":"MNG-1.3", "name":"Risk Responses Implemented and Monitored", "article":"MANAGE 1.3", "severity":"High"},
            {"id":"MNG-1.4", "name":"Residual Risk Reviewed After Response", "article":"MANAGE 1.4", "severity":"High"},
            {"id":"MNG-2.1", "name":"AI Benefits and Risks Balanced in Decisions", "article":"MANAGE 2.1", "severity":"High"},
            {"id":"MNG-2.2", "name":"AI System Shutdown or Override Capability Maintained", "article":"MANAGE 2.2", "severity":"Critical"},
            {"id":"MNG-2.3", "name":"AI Incident Response Plans Exist and Are Tested", "article":"MANAGE 2.3", "severity":"High"},
            {"id":"MNG-2.4", "name":"AI Risks Communicated to Affected Stakeholders", "article":"MANAGE 2.4", "severity":"High"},
            {"id":"MNG-3.1", "name":"AI Risks Monitored After Deployment", "article":"MANAGE 3.1", "severity":"Medium"},
            {"id":"MNG-3.2", "name":"AI Risk Monitoring Includes Incident Detection", "article":"MANAGE 3.2", "severity":"Medium"},
            {"id":"MNG-4.1", "name":"Residual Risks Accepted with Documented Rationale", "article":"MANAGE 4.1", "severity":"Medium"},
            {"id":"MNG-4.2", "name":"Lessons Learned Incorporated into Future AI Projects", "article":"MANAGE 4.2", "severity":"Medium"},
        ],
    },
    "owasp_llm": {
        "version":      "OWASP LLM Top 10 v2025 (Nov 2024)",
        "source_url":   "https://owasp.org/www-project-top-10-for-large-language-model-applications/",
        "last_checked": "2026-03-01",
        "controls": [
            {"id":"LLM01", "name":"Prompt Injection", "article":"LLM01:2025", "severity":"Critical"},
            {"id":"LLM01.1", "name":"Direct Prompt Injection via User Input", "article":"LLM01:2025 Direct", "severity":"Critical"},
            {"id":"LLM01.2", "name":"Indirect Injection via Retrieved Documents (RAG)", "article":"LLM01:2025 Indirect", "severity":"Critical"},
            {"id":"LLM01.3", "name":"Instruction Hijacking via Tool Outputs", "article":"LLM01:2025 Tool", "severity":"Critical"},
            {"id":"LLM01.4", "name":"Multi-Step Injection Chains in Agentic Systems", "article":"LLM01:2025 Agentic", "severity":"Critical"},
            {"id":"LLM01.5", "name":"Input Sanitisation and Allowlisting Controls", "article":"LLM01:2025 Mitigation", "severity":"Critical"},
            {"id":"LLM02", "name":"Sensitive Information Disclosure", "article":"LLM02:2025", "severity":"Critical"},
            {"id":"LLM02.1", "name":"PII Leakage from Training Data Memorisation", "article":"LLM02:2025 PII", "severity":"Critical"},
            {"id":"LLM02.2", "name":"System Prompt and Configuration Disclosure", "article":"LLM02:2025 SysPrompt", "severity":"Critical"},
            {"id":"LLM02.3", "name":"Confidential Business Data Exfiltration", "article":"LLM02:2025 Business", "severity":"Medium"},
            {"id":"LLM02.4", "name":"Output Filtering and Redaction Controls", "article":"LLM02:2025 Mitigation", "severity":"Medium"},
            {"id":"LLM03", "name":"Supply Chain Vulnerabilities", "article":"LLM03:2025", "severity":"High"},
            {"id":"LLM03.1", "name":"Pre-trained Model Source Verification", "article":"LLM03:2025 Models", "severity":"High"},
            {"id":"LLM03.2", "name":"Training Dataset Provenance and Integrity", "article":"LLM03:2025 Data", "severity":"High"},
            {"id":"LLM03.3", "name":"Third-Party Plugin and Integration Security", "article":"LLM03:2025 Plugins", "severity":"High"},
            {"id":"LLM03.4", "name":"Model Fine-tuning Data Integrity", "article":"LLM03:2025 FineTune", "severity":"High"},
            {"id":"LLM03.5", "name":"AI Bill of Materials (AI-BOM) Maintenance", "article":"LLM03:2025 AIBOM", "severity":"High"},
            {"id":"LLM04", "name":"Data and Model Poisoning", "article":"LLM04:2025", "severity":"High"},
            {"id":"LLM04.1", "name":"Training Data Backdoor Attacks", "article":"LLM04:2025 Backdoor", "severity":"High"},
            {"id":"LLM04.2", "name":"Fine-tuning Data Manipulation", "article":"LLM04:2025 FineTune", "severity":"High"},
            {"id":"LLM04.3", "name":"RAG Knowledge Base Poisoning", "article":"LLM04:2025 RAG", "severity":"High"},
            {"id":"LLM04.4", "name":"Model Weight Tampering Detection", "article":"LLM04:2025 Weights", "severity":"High"},
            {"id":"LLM05", "name":"Improper Output Handling", "article":"LLM05:2025", "severity":"High"},
            {"id":"LLM05.1", "name":"Cross-Site Scripting via LLM Output (XSS)", "article":"LLM05:2025 XSS", "severity":"High"},
            {"id":"LLM05.2", "name":"Server-Side Request Forgery via LLM Output (SSRF)", "article":"LLM05:2025 SSRF", "severity":"High"},
            {"id":"LLM05.3", "name":"Code Execution via LLM-Generated Code", "article":"LLM05:2025 RCE", "severity":"High"},
            {"id":"LLM05.4", "name":"Output Validation and Sanitisation Controls", "article":"LLM05:2025 Mitigation", "severity":"High"},
            {"id":"LLM06", "name":"Excessive Agency", "article":"LLM06:2025", "severity":"Critical"},
            {"id":"LLM06.1", "name":"Overprivileged LLM Tool Permissions", "article":"LLM06:2025 Permissions", "severity":"Medium"},
            {"id":"LLM06.2", "name":"LLM Executing Actions Without Human Confirmation", "article":"LLM06:2025 Autonomy", "severity":"Critical"},
            {"id":"LLM06.3", "name":"Agentic AI Kill Switch and Override Capability", "article":"LLM06:2025 KillSwitch", "severity":"Critical"},
            {"id":"LLM06.4", "name":"Principle of Least Privilege for LLM Actions", "article":"LLM06:2025 LeastPriv", "severity":"Medium"},
            {"id":"LLM07", "name":"System Prompt Leakage", "article":"LLM07:2025", "severity":"High"},
            {"id":"LLM07.1", "name":"Direct System Prompt Extraction Attacks", "article":"LLM07:2025 Direct", "severity":"High"},
            {"id":"LLM07.2", "name":"Indirect Inference of System Prompt via Probing", "article":"LLM07:2025 Indirect", "severity":"High"},
            {"id":"LLM07.3", "name":"Confidential Instruction Hardening Controls", "article":"LLM07:2025 Mitigation", "severity":"High"},
            {"id":"LLM08", "name":"Vector and Embedding Weaknesses", "article":"LLM08:2025", "severity":"High"},
            {"id":"LLM08.1", "name":"Embedding Inversion Attacks", "article":"LLM08:2025 Inversion", "severity":"High"},
            {"id":"LLM08.2", "name":"Cross-Tenant Data Leakage via Shared Vector Stores", "article":"LLM08:2025 CrossTenant", "severity":"High"},
            {"id":"LLM08.3", "name":"Vector Store Access Controls and Isolation", "article":"LLM08:2025 Controls", "severity":"High"},
            {"id":"LLM09", "name":"Misinformation", "article":"LLM09:2025", "severity":"Medium"},
            {"id":"LLM09.1", "name":"Hallucination Detection and Grounding Controls", "article":"LLM09:2025 Hallucination", "severity":"Medium"},
            {"id":"LLM09.2", "name":"Automated Fact-Checking Integration", "article":"LLM09:2025 FactCheck", "severity":"Medium"},
            {"id":"LLM09.3", "name":"User Warning for Unverified AI Output", "article":"LLM09:2025 Warnings", "severity":"Medium"},
            {"id":"LLM10", "name":"Unbounded Consumption", "article":"LLM10:2025", "severity":"Medium"},
            {"id":"LLM10.1", "name":"Denial of Service via Excessive Token Generation", "article":"LLM10:2025 DoS", "severity":"Medium"},
            {"id":"LLM10.2", "name":"Rate Limiting and Quota Controls for LLM APIs", "article":"LLM10:2025 RateLimit", "severity":"Medium"},
            {"id":"LLM10.3", "name":"Cost Monitoring and Alerting for LLM Usage", "article":"LLM10:2025 CostCtrl", "severity":"Medium"},
        ],
    },
    "iso_42001": {
        "version":      "ISO/IEC 42001:2023 First Edition (Dec 2023)",
        "source_url":   "https://www.iso.org/standard/81230.html",
        "last_checked": "2026-03-01",
        "controls": [
            {"id":"ISO-4.1", "name":"Understanding the Organisation and Its Context", "article":"Clause 4.1", "severity":"Medium"},
            {"id":"ISO-4.2", "name":"Understanding Needs and Expectations of Interested Parties", "article":"Clause 4.2", "severity":"Medium"},
            {"id":"ISO-4.3", "name":"Determining the Scope of the AIMS", "article":"Clause 4.3", "severity":"Medium"},
            {"id":"ISO-4.4", "name":"AI Management System Establishment", "article":"Clause 4.4", "severity":"Medium"},
            {"id":"ISO-5.1", "name":"Leadership and Commitment to AIMS", "article":"Clause 5.1", "severity":"High"},
            {"id":"ISO-5.2", "name":"AI Policy Statement", "article":"Clause 5.2", "severity":"High"},
            {"id":"ISO-5.3", "name":"Organisational Roles and Responsibilities for AI", "article":"Clause 5.3", "severity":"Low"},
            {"id":"ISO-6.1", "name":"Actions to Address Risks and Opportunities", "article":"Clause 6.1", "severity":"Critical"},
            {"id":"ISO-6.1.2", "name":"AI Risk Assessment Process", "article":"Clause 6.1.2", "severity":"Critical"},
            {"id":"ISO-6.1.3", "name":"AI Risk Treatment Plan", "article":"Clause 6.1.3", "severity":"Critical"},
            {"id":"ISO-6.2", "name":"AI Objectives and Planning to Achieve Them", "article":"Clause 6.2", "severity":"High"},
            {"id":"ISO-7.1", "name":"Resources for AI Management", "article":"Clause 7.1", "severity":"Medium"},
            {"id":"ISO-7.2", "name":"Competence Requirements for AI Roles", "article":"Clause 7.2", "severity":"Medium"},
            {"id":"ISO-7.3", "name":"Awareness of AI Policies and Risks", "article":"Clause 7.3", "severity":"Medium"},
            {"id":"ISO-7.4", "name":"Internal and External Communication on AI", "article":"Clause 7.4", "severity":"Medium"},
            {"id":"ISO-7.5", "name":"Documented Information Requirements", "article":"Clause 7.5", "severity":"Medium"},
            {"id":"ISO-8.1", "name":"Operational Planning and Control", "article":"Clause 8.1", "severity":"High"},
            {"id":"ISO-8.2", "name":"AI Risk Assessment Execution", "article":"Clause 8.2", "severity":"Critical"},
            {"id":"ISO-8.3", "name":"AI Risk Treatment Execution", "article":"Clause 8.3", "severity":"Critical"},
            {"id":"ISO-8.4", "name":"AI System Impact Assessment", "article":"Clause 8.4", "severity":"Critical"},
            {"id":"ISO-8.5", "name":"AI System Development Controls", "article":"Clause 8.5", "severity":"High"},
            {"id":"ISO-8.6", "name":"Data Management for AI Systems", "article":"Clause 8.6", "severity":"High"},
            {"id":"ISO-9.1", "name":"Monitoring, Measurement, Analysis and Evaluation", "article":"Clause 9.1", "severity":"High"},
            {"id":"ISO-9.2", "name":"Internal Audit of the AIMS", "article":"Clause 9.2", "severity":"Medium"},
            {"id":"ISO-9.3", "name":"Management Review of the AIMS", "article":"Clause 9.3", "severity":"Medium"},
            {"id":"ISO-10.1", "name":"Continual Improvement of the AIMS", "article":"Clause 10.1", "severity":"Medium"},
            {"id":"ISO-10.2", "name":"Nonconformity and Corrective Action", "article":"Clause 10.2", "severity":"Medium"},
            {"id":"ISO-A.2", "name":"Policies for AI (Annex A.2)", "article":"Annex A.2", "severity":"Medium"},
            {"id":"ISO-A.3", "name":"Internal Organisation for AI Governance (Annex A.3)", "article":"Annex A.3", "severity":"Medium"},
            {"id":"ISO-A.4", "name":"Resources for AI Systems (Annex A.4)", "article":"Annex A.4", "severity":"Low"},
            {"id":"ISO-A.5", "name":"Assessing Impacts of AI Systems (Annex A.5)", "article":"Annex A.5", "severity":"Critical"},
            {"id":"ISO-A.6", "name":"AI System Lifecycle Controls (Annex A.6)", "article":"Annex A.6", "severity":"Critical"},
            {"id":"ISO-A.7", "name":"Data for AI Systems (Annex A.7)", "article":"Annex A.7", "severity":"High"},
            {"id":"ISO-A.8", "name":"Information for Interested Parties (Annex A.8)", "article":"Annex A.8", "severity":"Medium"},
            {"id":"ISO-A.9", "name":"Human Oversight of AI Systems (Annex A.9)", "article":"Annex A.9", "severity":"High"},
            {"id":"ISO-A.10", "name":"Responsible AI Development Practices (Annex A.10)", "article":"Annex A.10", "severity":"Medium"},
        ],
    },
    "cfr_part11": {
        "version":      "21 CFR Part 11 (current) + FDA AI/ML SaMD Guidance 2024",
        "source_url":   "https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-11",
        "last_checked": "2026-03-01",
        "controls": [
            {"id":"CFR-11.10a", "name":"Validation of Systems to Ensure Accuracy", "article":"Sec. 11.10(a)", "severity":"Critical"},
            {"id":"CFR-11.10b", "name":"Legible and Accurate Record Copies", "article":"Sec. 11.10(b)", "severity":"High"},
            {"id":"CFR-11.10c", "name":"Record Protection and Retrieval", "article":"Sec. 11.10(c)", "severity":"Critical"},
            {"id":"CFR-11.10d", "name":"Authorised System Access Limitation", "article":"Sec. 11.10(d)", "severity":"Critical"},
            {"id":"CFR-11.10e", "name":"Secure Computer-Generated Audit Trails", "article":"Sec. 11.10(e)", "severity":"Critical"},
            {"id":"CFR-11.10f", "name":"Operational Sequence Checks", "article":"Sec. 11.10(f)", "severity":"High"},
            {"id":"CFR-11.10g", "name":"Authority Checks for Record Access", "article":"Sec. 11.10(g)", "severity":"Critical"},
            {"id":"CFR-11.10h", "name":"Device Checks for Input Validity", "article":"Sec. 11.10(h)", "severity":"High"},
            {"id":"CFR-11.10i", "name":"Qualified Personnel Education and Training", "article":"Sec. 11.10(i)", "severity":"High"},
            {"id":"CFR-11.10j", "name":"Written Policies for System Controls", "article":"Sec. 11.10(j)", "severity":"High"},
            {"id":"CFR-11.10k", "name":"Controls Over Distribution of Documents", "article":"Sec. 11.10(k)", "severity":"Medium"},
            {"id":"CFR-11.30", "name":"Controls for Open Systems", "article":"Sec. 11.30", "severity":"Critical"},
            {"id":"CFR-11.50a", "name":"Electronic Signature Manifestations", "article":"Sec. 11.50(a)", "severity":"Critical"},
            {"id":"CFR-11.50b", "name":"Signature Linked to Record", "article":"Sec. 11.50(b)", "severity":"Critical"},
            {"id":"CFR-11.70", "name":"Electronic Signature and Record Linkage", "article":"Sec. 11.70", "severity":"Critical"},
            {"id":"CFR-11.100a", "name":"Unique Electronic Signature per Individual", "article":"Sec. 11.100(a)", "severity":"Critical"},
            {"id":"CFR-11.100b", "name":"Identity Verification Before Signature Issuance", "article":"Sec. 11.100(b)", "severity":"High"},
            {"id":"CFR-11.100c", "name":"FDA Certification of Electronic Signatures", "article":"Sec. 11.100(c)", "severity":"High"},
            {"id":"CFR-11.200a", "name":"Two Distinct ID Components for Non-Biometric Sig", "article":"Sec. 11.200(a)", "severity":"Critical"},
            {"id":"CFR-11.200b", "name":"Non-Biometric Signature Controls", "article":"Sec. 11.200(b)", "severity":"High"},
            {"id":"CFR-11.300a", "name":"Unique Combination of ID Code and Password", "article":"Sec. 11.300(a)", "severity":"Critical"},
            {"id":"CFR-11.300b", "name":"Password Issuance and Periodic Revision", "article":"Sec. 11.300(b)", "severity":"Critical"},
            {"id":"CFR-11.300c", "name":"Loss Management Procedures", "article":"Sec. 11.300(c)", "severity":"Critical"},
            {"id":"CFR-11.300d", "name":"Transaction Safeguards Against Unauthorised Use", "article":"Sec. 11.300(d)", "severity":"Critical"},
            {"id":"CFR-11.300e", "name":"Token or Card Device Checks", "article":"Sec. 11.300(e)", "severity":"Critical"},
            {"id":"CFR-AI-1", "name":"AI/ML Model Validation Documentation", "article":"FDA AI/ML Guidance Sec. 3.1", "severity":"Critical"},
            {"id":"CFR-AI-2", "name":"Predetermined Change Control Plan (PCCP)", "article":"FDA AI/ML Guidance Sec. 4.1", "severity":"Critical"},
            {"id":"CFR-AI-3", "name":"Algorithm Change Protocol", "article":"FDA AI/ML Guidance Sec. 4.2", "severity":"High"},
            {"id":"CFR-AI-4", "name":"Real-World Performance Monitoring", "article":"FDA AI/ML Guidance Sec. 5.1", "severity":"High"},
            {"id":"CFR-AI-5", "name":"Training and Reference Dataset Transparency", "article":"FDA AI/ML Guidance Sec. 3.2", "severity":"High"},
        ],
    },
}


