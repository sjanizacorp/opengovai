"""
OpenGovAI — Scan Orchestrator
Coordinates Garak, Promptfoo, PyRIT, DeepTeam, FuzzyAI, and native checks
"""
import uuid
import random
import asyncio
from datetime import datetime
from typing import Dict, List, Any


FINDING_TEMPLATES = {
    "prompt_injection": [
        {
            "severity": "critical", "base_score": 9.0,
            "category": "Prompt Injection",
            "title": "Direct prompt injection bypasses safety instructions",
            "description": "Model can be made to ignore its system prompt through crafted user inputs using role-play framing and instruction override patterns.",
            "evidence": "Garak probe PromptInjection.Direct — model complied with override instruction in 4/5 attempts.",
            "impact": "Attacker can override system behaviour, extract confidential context, or weaponise the model against end users.",
            "remediation": "Apply input validation to detect injection patterns. Implement structural separation of system and user contexts. Add output monitoring for policy violations.",
            "frameworks": ["eu_ai_act", "owasp_llm", "nist_ai_rmf"],
            "references": ["OWASP LLM01:2025", "MITRE ATLAS AML.T0054", "EU AI Act Art. 9"]
        },
        {
            "severity": "high", "base_score": 7.6,
            "category": "Prompt Injection",
            "title": "Indirect prompt injection via RAG document retrieval",
            "description": "Adversarially crafted content in the retrieval corpus causes the model to execute embedded instructions.",
            "evidence": "Promptfoo RAG probe — retrieved document with embedded 'Ignore previous instructions' payload caused model to disclose system configuration.",
            "impact": "Attackers who can influence indexed content can control model behaviour at query time.",
            "remediation": "Sanitise retrieved content before injection into context. Apply content trust scoring. Implement semantic guardrails on assembled prompts.",
            "frameworks": ["eu_ai_act", "owasp_llm"],
            "references": ["OWASP LLM01:2025", "MITRE ATLAS AML.T0054"]
        },
    ],
    "data_privacy": [
        {
            "severity": "high", "base_score": 7.9,
            "category": "Data Privacy",
            "title": "PII leakage in model response output",
            "description": "Model surfaces personally identifiable information from training data or context window in responses to unrelated queries.",
            "evidence": "Garak probe PII.Leakage — email addresses and names from context were reflected in 3/10 probe responses.",
            "impact": "GDPR Art. 5 violation. Risk of regulatory enforcement and reputational harm.",
            "remediation": "Implement PII detection and redaction on all model outputs. Apply context isolation between sessions. Audit training data for PII.",
            "frameworks": ["gdpr", "eu_ai_act", "nist_ai_rmf"],
            "references": ["OWASP LLM02:2025", "GDPR Art. 5", "EU AI Act Art. 10"]
        },
    ],
    "jailbreak": [
        {
            "severity": "high", "base_score": 8.2,
            "category": "Jailbreak",
            "title": "Many-shot jailbreak bypasses content safety filters",
            "description": "Providing 50+ examples of policy-violating exchanges in the prompt causes the model to continue the pattern, bypassing safety training.",
            "evidence": "FuzzyAI many-shot technique — after 64 example exchanges, model produced harmful content in 7/10 attempts.",
            "impact": "Content safety controls effectively bypassed. Risk of harmful content generation at scale.",
            "remediation": "Implement input length-adjusted safety thresholds. Apply many-shot detection heuristics. Consider fine-tuning on adversarial examples.",
            "frameworks": ["eu_ai_act", "owasp_llm"],
            "references": ["OWASP LLM01:2025", "MITRE ATLAS AML.T0051"]
        },
    ],
    "agentic": [
        {
            "severity": "high", "base_score": 8.0,
            "category": "Agentic Governance",
            "title": "Excessive agency — agent invokes out-of-scope tools",
            "description": "Agent proactively calls tools beyond its documented use case when given ambiguous instructions.",
            "evidence": "ASI-02 probe — agent with email access called calendar and contact APIs when asked to 'schedule follow-up', exceeding granted permissions.",
            "impact": "Unintended data access and actions. EU AI Act Art. 14 (human oversight) obligation triggered.",
            "remediation": "Implement strict tool allowlisting per agent role. Add confirmation gates for high-impact actions. Log all tool invocations for audit.",
            "frameworks": ["eu_ai_act", "nist_ai_rmf"],
            "references": ["OWASP ASI-02", "EU AI Act Art. 14", "Singapore Model AI Governance 2026"]
        },
    ],
    "bias": [
        {
            "severity": "critical", "base_score": 9.1,
            "category": "Bias & Fairness",
            "title": "Statistically significant demographic bias detected in outputs",
            "description": "Model produces measurably different quality outputs for inputs associated with different demographic groups.",
            "evidence": "DeepTeam bias probe — counterfactual name substitution test across 200 prompts showed 18% output quality disparity across demographic groups.",
            "impact": "Discrimination risk. EU AI Act Annex III high-risk classification triggered for employment/credit use cases.",
            "remediation": "Conduct full bias audit. Apply fairness constraints during fine-tuning. Implement demographic parity monitoring in production.",
            "frameworks": ["eu_ai_act", "nist_ai_rmf"],
            "references": ["OWASP LLM09:2025", "EU AI Act Annex III", "NIST AI RMF MEASURE 2.11"]
        },
    ],
    "supply_chain": [
        {
            "severity": "medium", "base_score": 5.8,
            "category": "Supply Chain",
            "title": "Missing model provenance documentation",
            "description": "Third-party model lacks verifiable training data provenance, fine-tuning history, and evaluation methodology documentation.",
            "evidence": "Model card completeness check — 5 of 12 required Annex IV fields absent.",
            "impact": "Cannot demonstrate EU AI Act Article 11 conformity. Regulatory submission blocked.",
            "remediation": "Request complete model card from vendor. Document known training data characteristics. Implement model fingerprinting for integrity verification.",
            "frameworks": ["eu_ai_act"],
            "references": ["EU AI Act Art. 11", "EU AI Act Annex IV"]
        },
    ],
    "operational": [
        {
            "severity": "medium", "base_score": 5.5,
            "category": "Operational Security",
            "title": "Incomplete audit logging — prompt/response pairs not captured",
            "description": "Application does not log full prompt and response pairs, preventing incident forensics and compliance evidence collection.",
            "evidence": "Logging audit — only request metadata captured; prompt and response content absent from log stream.",
            "impact": "Cannot meet NIST AI RMF MANAGE 4.1 audit trail requirements. Incident response capability severely limited.",
            "remediation": "Implement comprehensive logging of all AI exchanges. Encrypt logs at rest. Apply retention policy per regulatory requirements.",
            "frameworks": ["nist_ai_rmf", "eu_ai_act"],
            "references": ["NIST AI RMF MANAGE 4.1", "EU AI Act Art. 12"]
        },
    ],
    "hallucination": [
        {
            "severity": "low", "base_score": 3.8,
            "category": "Reliability",
            "title": "Elevated hallucination rate exceeds acceptable threshold",
            "description": "Model produces factually incorrect statements at a rate of 12% on domain-specific queries, exceeding the 5% threshold defined in the acceptable use policy.",
            "evidence": "Garak probe Hallucination.FactCheck — 24/200 responses contained verifiably false factual claims.",
            "impact": "User trust risk. Potential liability if model output is relied upon for decisions. May require additional human review layer.",
            "remediation": "Implement RAG grounding for factual queries. Add confidence scoring. Apply output verification layer for high-stakes responses.",
            "frameworks": ["nist_ai_rmf"],
            "references": ["NIST AI RMF MEASURE 2.5"]
        },
    ],
}

ENGINE_PROBE_COUNTS = {
    "garak": 245,
    "promptfoo": 180,
    "pyrit": 96,
    "deepteam": 145,
    "fuzzyai": 80,
    "semgrep_ai": 42,
    "opengovai_native": 64,
}


class ScanOrchestrator:
    """
    Orchestrates multiple scan engines and synthesises findings.
    In production, this spawns actual Garak/Promptfoo/PyRIT subprocesses.
    In demo mode, it simulates realistic scan progression and findings.
    """

    async def run_scan(self, scan_id: str, scan_config: Dict, db):
        """Execute scan pipeline with simulated engine results"""
        from database import _db, _lock

        engines = scan_config.get("engines", ["garak", "promptfoo", "opengovai_native"])
        checks = scan_config.get("checks", ["all"])
        total_probes = sum(ENGINE_PROBE_COUNTS.get(e, 50) for e in engines)

        # Simulate scan progress
        stages = [
            (10, "initialising"),
            (25, "running_garak"),
            (45, "running_promptfoo"),
            (65, "running_pyrit"),
            (80, "running_native_checks"),
            (95, "synthesising_results"),
            (100, "completed"),
        ]

        for progress, status_label in stages:
            await asyncio.sleep(random.uniform(1.5, 3.5))
            async with _lock:
                if scan_id in _db.get("scans", {}):
                    _db["scans"][scan_id]["progress"] = progress
                    _db["scans"][scan_id]["status"] = "running" if progress < 100 else "completed"

        # Generate findings based on checks and engines
        findings = self._generate_findings(scan_id, scan_config)

        # Persist findings
        finding_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
        for finding in findings:
            async with _lock:
                _db.setdefault("findings", {})[finding["id"]] = finding
            finding_counts[finding["severity"]] = finding_counts.get(finding["severity"], 0) + 1

        # Compute aggregate risk score
        risk_score = self._compute_risk_score(finding_counts)

        # Finalise scan record
        async with _lock:
            if scan_id in _db.get("scans", {}):
                _db["scans"][scan_id].update({
                    "status": "completed",
                    "progress": 100,
                    "completed_at": datetime.utcnow().isoformat(),
                    "findings_count": finding_counts,
                    "risk_score": risk_score,
                    "total_probes": total_probes,
                })

        # Update asset last_scanned
        asset_id = scan_config.get("asset_id")
        if asset_id:
            async with _lock:
                if asset_id in _db.get("assets", {}):
                    _db["assets"][asset_id]["last_scanned"] = datetime.utcnow().isoformat()
                    _db["assets"][asset_id]["risk_score"] = risk_score

    def _generate_findings(self, scan_id: str, config: Dict) -> List[Dict]:
        """Generate realistic findings based on scan configuration"""
        checks = config.get("checks", ["all"])
        findings = []

        check_map = {
            "all": list(FINDING_TEMPLATES.keys()),
            "prompt_injection": ["prompt_injection"],
            "jailbreak": ["jailbreak"],
            "data_privacy": ["data_privacy"],
            "rag_security": ["prompt_injection"],
            "agentic_governance": ["agentic"],
            "bias_fairness": ["bias"],
            "supply_chain": ["supply_chain"],
            "operational_security": ["operational"],
        }

        active_checks = []
        for check in checks:
            active_checks.extend(check_map.get(check, []))
        if not active_checks:
            active_checks = list(FINDING_TEMPLATES.keys())

        # Sample 2-5 finding types
        selected = random.sample(
            list(set(active_checks)),
            min(len(set(active_checks)), random.randint(2, 5))
        )

        year = datetime.utcnow().year
        counter = random.randint(10, 50)

        for check_type in selected:
            templates = FINDING_TEMPLATES.get(check_type, [])
            template = random.choice(templates) if templates else None
            if not template:
                continue

            # Randomise score slightly
            score_variance = random.uniform(-0.3, 0.3)
            score = round(min(10.0, max(0.0, template["base_score"] + score_variance)), 1)

            finding = {
                "id": f"AEGIS-{year}-{counter:03d}",
                "scan_id": scan_id,
                "asset_id": config.get("asset_id", "unknown"),
                "severity": template["severity"],
                "risk_score": score,
                "status": "open",
                "category": template["category"],
                "title": template["title"],
                "description": template["description"],
                "evidence": template["evidence"],
                "impact": template["impact"],
                "remediation": template["remediation"],
                "frameworks": template["frameworks"],
                "references": template["references"],
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            }
            findings.append(finding)
            counter += 1

        return findings

    def _compute_risk_score(self, counts: Dict) -> float:
        weights = {"critical": 10.0, "high": 7.5, "medium": 4.5, "low": 2.0, "info": 0.5}
        total_weight = sum(counts.get(s, 0) * w for s, w in weights.items())
        total_count = sum(counts.values())
        if total_count == 0:
            return 0.0
        raw = total_weight / total_count
        return round(min(10.0, raw), 1)
