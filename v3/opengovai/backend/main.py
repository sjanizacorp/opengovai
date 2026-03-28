"""
OpenGovAI — AI Governance, Risk & Compliance Platform
FastAPI Backend — Main Application Entry Point
"""
import uuid
import random
import asyncio
from datetime import datetime, timedelta
from typing import Optional, List
from contextlib import asynccontextmanager

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
    async with get_db_session() as db:
        policies = await db.get_all("policies")
        return {"policies": policies, "total": len(policies)}

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
    from compliance import FRAMEWORK_CONTROLS
    return {"frameworks": [
        {"id": k, "label": v.get("label",k), "controls": len(v.get("controls",[]))}
        for k,v in FRAMEWORK_CONTROLS.items()
    ]}

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

    demo_policies = [
        {"id": "POL-EU-ACT01", "name": "EU AI Act Compliance Pack", "framework": "eu_ai_act",
         "description": "Full EU AI Act Article 9, 10, 11, 13, 14 control implementation",
         "status": "active", "version": "1.2", "controls": 24,
         "created_at": "2026-01-01T00:00:00"},
        {"id": "POL-NIST-001", "name": "NIST AI RMF Implementation Pack", "framework": "nist_ai_rmf",
         "description": "GOVERN, MAP, MEASURE, MANAGE function controls",
         "status": "active", "version": "1.0", "controls": 18,
         "created_at": "2026-01-01T00:00:00"},
        {"id": "POL-OWASP-001", "name": "OWASP LLM Security Pack", "framework": "owasp_llm",
         "description": "All 10 OWASP LLM Top 10 2025 controls with automated probes",
         "status": "active", "version": "2.0", "controls": 30,
         "created_at": "2026-01-01T00:00:00"},
        {"id": "POL-ISO-0001", "name": "ISO 42001 Management System Pack", "framework": "iso_42001",
         "description": "AI Management System controls for ISO/IEC 42001 certification",
         "status": "active", "version": "1.0", "controls": 15,
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
