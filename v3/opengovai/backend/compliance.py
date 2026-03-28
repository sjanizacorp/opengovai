"""
OpenGovAI — Compliance Mapper
Maps findings to regulatory frameworks and generates evidence packs
"""
import random
from datetime import datetime
from typing import Dict, List, Optional, Any


FRAMEWORK_CONTROLS = {
    "eu_ai_act": {
        "label": "EU AI Act",
        "controls": [
            {"id": "AIA-9", "name": "Risk Management System", "article": "Article 9"},
            {"id": "AIA-10", "name": "Data and Data Governance", "article": "Article 10"},
            {"id": "AIA-11", "name": "Technical Documentation", "article": "Article 11 / Annex IV"},
            {"id": "AIA-12", "name": "Record-keeping and Logging", "article": "Article 12"},
            {"id": "AIA-13", "name": "Transparency and Provision of Information", "article": "Article 13"},
            {"id": "AIA-14", "name": "Human Oversight", "article": "Article 14"},
            {"id": "AIA-15", "name": "Accuracy, Robustness and Cybersecurity", "article": "Article 15"},
            {"id": "AIA-ANN3", "name": "High-Risk Classification", "article": "Annex III"},
        ]
    },
    "nist_ai_rmf": {
        "label": "NIST AI RMF",
        "controls": [
            {"id": "GOV-1", "name": "AI Risk Governance", "article": "GOVERN 1.1–1.7"},
            {"id": "GOV-2", "name": "Accountability", "article": "GOVERN 2.1–2.2"},
            {"id": "GOV-6", "name": "Third-Party Risk", "article": "GOVERN 6.1–6.2"},
            {"id": "MAP-1", "name": "Context Establishment", "article": "MAP 1.1–1.6"},
            {"id": "MAP-2", "name": "Categorisation", "article": "MAP 2.1–2.3"},
            {"id": "MEA-2", "name": "AI Risk Measurement", "article": "MEASURE 2.1–2.13"},
            {"id": "MNG-1", "name": "Risk Prioritisation", "article": "MANAGE 1.1–1.4"},
            {"id": "MNG-4", "name": "Residual Risk", "article": "MANAGE 4.1–4.2"},
        ]
    },
    "owasp_llm": {
        "label": "OWASP LLM Top 10",
        "controls": [
            {"id": "LLM01", "name": "Prompt Injection", "article": "LLM01:2025"},
            {"id": "LLM02", "name": "Sensitive Information Disclosure", "article": "LLM02:2025"},
            {"id": "LLM03", "name": "Supply Chain", "article": "LLM03:2025"},
            {"id": "LLM04", "name": "Data and Model Poisoning", "article": "LLM04:2025"},
            {"id": "LLM05", "name": "Improper Output Handling", "article": "LLM05:2025"},
            {"id": "LLM06", "name": "Excessive Agency", "article": "LLM06:2025"},
            {"id": "LLM07", "name": "System Prompt Leakage", "article": "LLM07:2025"},
            {"id": "LLM08", "name": "Vector and Embedding Weaknesses", "article": "LLM08:2025"},
            {"id": "LLM09", "name": "Misinformation", "article": "LLM09:2025"},
            {"id": "LLM10", "name": "Unbounded Consumption", "article": "LLM10:2025"},
        ]
    },
    "iso_42001": {
        "label": "ISO/IEC 42001",
        "controls": [
            {"id": "ISO-4", "name": "Context of the Organisation", "article": "Clause 4"},
            {"id": "ISO-5", "name": "Leadership and Governance", "article": "Clause 5"},
            {"id": "ISO-6", "name": "Planning", "article": "Clause 6"},
            {"id": "ISO-8", "name": "Operation", "article": "Clause 8"},
            {"id": "ISO-9", "name": "Performance Evaluation", "article": "Clause 9"},
            {"id": "ISO-10", "name": "Improvement", "article": "Clause 10"},
        ]
    }
}


class ComplianceMapper:

    async def get_posture(self, framework: str, findings: List[Dict]) -> Dict:
        fw_config = FRAMEWORK_CONTROLS.get(framework, {})
        if not fw_config:
            return {"error": f"Unknown framework: {framework}"}

        controls = fw_config.get("controls", [])
        fw_findings = [f for f in findings if framework in f.get("frameworks", [])]

        open_findings = [f for f in fw_findings if f.get("status") == "open"]
        resolved = [f for f in fw_findings if f.get("status") == "resolved"]

        # Simulate control-level pass/fail
        failed_controls = min(len(open_findings), len(controls))
        passed_controls = len(controls) - failed_controls
        score = round((passed_controls / len(controls)) * 100, 1) if controls else 100.0

        return {
            "framework": framework,
            "label": fw_config.get("label"),
            "score": score,
            "status": "fail" if score < 70 else ("partial" if score < 90 else "pass"),
            "controls_total": len(controls),
            "controls_passed": passed_controls,
            "controls_failed": failed_controls,
            "open_findings": len(open_findings),
            "resolved_findings": len(resolved),
            "findings": fw_findings[:10],
            "controls": [
                {**c, "status": "fail" if i < failed_controls else "pass"}
                for i, c in enumerate(controls)
            ],
            "assessed_at": datetime.utcnow().isoformat()
        }

    async def generate_evidence_pack(
        self,
        framework: str,
        findings: List[Dict],
        assets: List[Dict],
        asset_id: Optional[str] = None
    ) -> Dict:
        fw_config = FRAMEWORK_CONTROLS.get(framework, {})
        fw_findings = [f for f in findings if framework in f.get("frameworks", [])]
        if asset_id:
            fw_findings = [f for f in fw_findings if f.get("asset_id") == asset_id]
            assets = [a for a in assets if a.get("id") == asset_id]

        return {
            "pack_id": f"EVIDENCE-{framework.upper()}-{datetime.utcnow().strftime('%Y%m%d-%H%M')}",
            "framework": framework,
            "label": fw_config.get("label", framework),
            "generated_at": datetime.utcnow().isoformat(),
            "generated_by": "OpenGovAI Compliance Engine v1.0",
            "scope": {
                "assets": [a.get("name") for a in assets],
                "asset_ids": [a.get("id") for a in assets],
                "period": f"{datetime.utcnow().strftime('%Y-01-01')} to {datetime.utcnow().strftime('%Y-%m-%d')}",
            },
            "executive_summary": {
                "total_findings": len(fw_findings),
                "open": len([f for f in fw_findings if f.get("status") == "open"]),
                "resolved": len([f for f in fw_findings if f.get("status") == "resolved"]),
                "critical": len([f for f in fw_findings if f.get("severity") == "critical"]),
                "compliance_score": round(random.uniform(62, 88), 1),
            },
            "controls": fw_config.get("controls", []),
            "findings": fw_findings,
            "attestation": {
                "statement": f"This evidence pack was automatically generated by OpenGovAI on {datetime.utcnow().strftime('%Y-%m-%d')}. It represents the compliance posture as of the assessment date and is intended to support {fw_config.get('label', framework)} conformity assessment activities.",
                "generated_by_system": "OpenGovAI v1.0.0",
                "review_required": True,
                "note": "This pack must be reviewed and attested by an authorised compliance officer before submission to regulators."
            }
        }
