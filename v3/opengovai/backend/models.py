"""
OpenGovAI — Pydantic Models
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel


class AssetCreate(BaseModel):
    name: str
    model: str
    provider: str
    environment: str = "staging"
    owner: str
    use_case: str
    data_classification: str = "internal"
    autonomy_level: str = "human_in_loop"


class ScanCreate(BaseModel):
    asset_id: Optional[str] = None
    target: str
    engines: Optional[List[str]] = None
    checks: Optional[List[str]] = None
    compliance_frameworks: Optional[List[str]] = None


class FindingUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    assignee: Optional[str] = None
    due_date: Optional[str] = None


class PolicyCreate(BaseModel):
    name: str
    description: str
    framework: str
    controls: Optional[int] = 0


class WorkflowCreate(BaseModel):
    asset_id: str
    type: str
    title: str
    description: str


class ScanResult(BaseModel):
    scan_id: str
    status: str
    progress: int
    findings_count: Dict[str, int]
    risk_score: Optional[float] = None


class DashboardStats(BaseModel):
    total_assets: int
    active_assets: int
    total_scans: int
    open_findings: int
    critical_findings: int
    high_findings: int
    compliance_scores: Dict[str, float]
    recent_scans: List[Dict]
    risk_trend: List[Dict]
    shadow_ai_detected: int


class ComplianceStatus(BaseModel):
    framework: str
    score: float
    status: str
    controls_passed: int
    controls_failed: int
    controls_total: int
    findings: List[Dict]
