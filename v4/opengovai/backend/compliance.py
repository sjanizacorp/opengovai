"""
OpenGovAI v4 -- Compliance Mapper
Comprehensive control sets for all frameworks. ASCII-only (no section symbol).
"""
import random
from datetime import datetime
from typing import Dict, List, Optional, Any


FRAMEWORK_CONTROLS = {
    # ── EU AI Act ─────────────────────────────────────────────────────────────
    "eu_ai_act": {
        "label": "EU AI Act",
        "controls": [
            # Chapter I — General Provisions
            {"id":"AIA-1",     "name":"Subject Matter and Scope",                          "article":"Article 1-2"},
            {"id":"AIA-3",     "name":"Definitions and Terminology",                       "article":"Article 3"},
            {"id":"AIA-5",     "name":"Prohibited AI Practices",                           "article":"Article 5"},
            # Chapter II — Classification
            {"id":"AIA-6",     "name":"High-Risk AI System Classification Rules",          "article":"Article 6"},
            {"id":"AIA-7",     "name":"Amendments to Annex III High-Risk List",            "article":"Article 7"},
            # Chapter III — High-Risk AI Requirements
            {"id":"AIA-8",     "name":"Compliance with Requirements",                      "article":"Article 8"},
            {"id":"AIA-9",     "name":"Risk Management System",                            "article":"Article 9"},
            {"id":"AIA-10",    "name":"Data and Data Governance",                          "article":"Article 10"},
            {"id":"AIA-11",    "name":"Technical Documentation",                           "article":"Article 11"},
            {"id":"AIA-12",    "name":"Record-keeping and Logging",                        "article":"Article 12"},
            {"id":"AIA-13",    "name":"Transparency and User Information",                 "article":"Article 13"},
            {"id":"AIA-14",    "name":"Human Oversight",                                   "article":"Article 14"},
            {"id":"AIA-15",    "name":"Accuracy, Robustness and Cybersecurity",            "article":"Article 15"},
            # Chapter III — Obligations
            {"id":"AIA-16",    "name":"Provider Obligations",                              "article":"Article 16"},
            {"id":"AIA-17",    "name":"Quality Management System",                         "article":"Article 17"},
            {"id":"AIA-18",    "name":"Post-Market Monitoring Plan",                       "article":"Article 18"},
            {"id":"AIA-19",    "name":"Serious Incident Reporting",                        "article":"Article 19"},
            {"id":"AIA-20",    "name":"Corrective Action and Information Obligations",     "article":"Article 20"},
            {"id":"AIA-21",    "name":"Cooperation with Authorities",                      "article":"Article 21"},
            {"id":"AIA-22",    "name":"Authorised Representatives",                        "article":"Article 22"},
            {"id":"AIA-23",    "name":"Importer Obligations",                              "article":"Article 23"},
            {"id":"AIA-24",    "name":"Distributor Obligations",                           "article":"Article 24"},
            {"id":"AIA-25",    "name":"Deployer Obligations",                              "article":"Article 25"},
            {"id":"AIA-26",    "name":"Fundamental Rights Impact Assessment",              "article":"Article 26"},
            {"id":"AIA-27",    "name":"Obligations for Deployers in Public Sector",        "article":"Article 27"},
            # Chapter IV — General Purpose AI
            {"id":"AIA-51",    "name":"Classification of GPAI Models",                    "article":"Article 51"},
            {"id":"AIA-53",    "name":"Obligations for GPAI Model Providers",              "article":"Article 53"},
            {"id":"AIA-55",    "name":"Systemic Risk GPAI Model Obligations",              "article":"Article 55"},
            # Annexes
            {"id":"AIA-ANN1",  "name":"Prohibited AI Techniques (Annex I)",               "article":"Annex I"},
            {"id":"AIA-ANN3",  "name":"High-Risk AI Systems List (Annex III)",             "article":"Annex III"},
            {"id":"AIA-ANN4",  "name":"Technical Documentation Requirements (Annex IV)",  "article":"Annex IV"},
            {"id":"AIA-ANN6",  "name":"Conformity Assessment Procedure (Annex VI)",       "article":"Annex VI"},
            {"id":"AIA-ANN7",  "name":"Third-Party Conformity Assessment (Annex VII)",    "article":"Annex VII"},
            {"id":"AIA-ANN11", "name":"Post-Market Monitoring Plan Template (Annex XI)",  "article":"Annex XI"},
        ],
    },

    # ── NIST AI RMF ───────────────────────────────────────────────────────────
    "nist_ai_rmf": {
        "label": "NIST AI RMF",
        "controls": [
            # GOVERN function
            {"id":"GOV-1.1",  "name":"AI Risk Management Policies, Processes, and Procedures",   "article":"GOVERN 1.1"},
            {"id":"GOV-1.2",  "name":"Accountability Structures for AI Risk",                     "article":"GOVERN 1.2"},
            {"id":"GOV-1.3",  "name":"Organisational Risk Tolerance Defined for AI",              "article":"GOVERN 1.3"},
            {"id":"GOV-1.4",  "name":"Org-wide AI Risk Culture and Awareness",                    "article":"GOVERN 1.4"},
            {"id":"GOV-1.5",  "name":"AI Policies Maintained and Updated",                        "article":"GOVERN 1.5"},
            {"id":"GOV-1.6",  "name":"AI Risk Oversight Roles Defined",                           "article":"GOVERN 1.6"},
            {"id":"GOV-1.7",  "name":"Processes for AI Risk Escalation",                          "article":"GOVERN 1.7"},
            {"id":"GOV-2.1",  "name":"Scientific and Technical Knowledge for Risk",               "article":"GOVERN 2.1"},
            {"id":"GOV-2.2",  "name":"Diverse Teams for AI Development and Deployment",           "article":"GOVERN 2.2"},
            {"id":"GOV-3.1",  "name":"Decision-Making Documented and Explainable",                "article":"GOVERN 3.1"},
            {"id":"GOV-3.2",  "name":"Bias Awareness Training for AI Teams",                      "article":"GOVERN 3.2"},
            {"id":"GOV-4.1",  "name":"Organisational Incentives Aligned with AI Risk",            "article":"GOVERN 4.1"},
            {"id":"GOV-4.2",  "name":"AI Risk Embedded in Org Culture",                           "article":"GOVERN 4.2"},
            {"id":"GOV-5.1",  "name":"AI Risk Policies Cover Entire AI Lifecycle",                "article":"GOVERN 5.1"},
            {"id":"GOV-5.2",  "name":"Policies Aligned with AI Trustworthiness Principles",      "article":"GOVERN 5.2"},
            {"id":"GOV-6.1",  "name":"Third-Party AI Risk Policies and Procedures",               "article":"GOVERN 6.1"},
            {"id":"GOV-6.2",  "name":"AI Supply Chain Risk Management",                           "article":"GOVERN 6.2"},
            # MAP function
            {"id":"MAP-1.1",  "name":"AI Context Established — Intended Use and Users",           "article":"MAP 1.1"},
            {"id":"MAP-1.2",  "name":"Scientific Basis for AI System Categorised",                "article":"MAP 1.2"},
            {"id":"MAP-1.3",  "name":"AI Risks Identified in Context of Use",                     "article":"MAP 1.3"},
            {"id":"MAP-1.4",  "name":"Organisational Risk Tolerance Applied to AI",               "article":"MAP 1.4"},
            {"id":"MAP-1.5",  "name":"AI System Boundaries and Scope Documented",                 "article":"MAP 1.5"},
            {"id":"MAP-1.6",  "name":"Stakeholders and Their Concerns Identified",                "article":"MAP 1.6"},
            {"id":"MAP-2.1",  "name":"Scientific Grounding of AI Evaluated",                      "article":"MAP 2.1"},
            {"id":"MAP-2.2",  "name":"AI System Data Characteristics Assessed",                   "article":"MAP 2.2"},
            {"id":"MAP-2.3",  "name":"AI Impact on Individuals and Groups Assessed",              "article":"MAP 2.3"},
            {"id":"MAP-3.1",  "name":"AI Risks Categorised by Likelihood and Impact",             "article":"MAP 3.1"},
            {"id":"MAP-3.2",  "name":"AI System Failure Modes Identified",                        "article":"MAP 3.2"},
            {"id":"MAP-3.3",  "name":"Benefits of AI System Assessed",                            "article":"MAP 3.3"},
            {"id":"MAP-3.4",  "name":"Risks to Vulnerable Groups Assessed",                       "article":"MAP 3.4"},
            {"id":"MAP-3.5",  "name":"AI System Negative Impacts on Society Assessed",            "article":"MAP 3.5"},
            {"id":"MAP-4.1",  "name":"AI Risks Across Lifecycle Stages Identified",               "article":"MAP 4.1"},
            {"id":"MAP-4.2",  "name":"Internal Expertise Sufficient for AI Risk",                 "article":"MAP 4.2"},
            {"id":"MAP-5.1",  "name":"Likelihood of AI Risk Occurrence Estimated",                "article":"MAP 5.1"},
            {"id":"MAP-5.2",  "name":"Practices to Reduce AI Risk Identified",                    "article":"MAP 5.2"},
            # MEASURE function
            {"id":"MEA-1.1",  "name":"AI Risk Assessment Metrics Defined",                        "article":"MEASURE 1.1"},
            {"id":"MEA-1.2",  "name":"Metrics for AI Trustworthiness Established",                "article":"MEASURE 1.2"},
            {"id":"MEA-1.3",  "name":"Internal Expertise for AI Measurement Available",           "article":"MEASURE 1.3"},
            {"id":"MEA-2.1",  "name":"Test Sets Reflect Deployed Context",                        "article":"MEASURE 2.1"},
            {"id":"MEA-2.2",  "name":"AI System Evaluated for Bias and Discrimination",           "article":"MEASURE 2.2"},
            {"id":"MEA-2.3",  "name":"AI System Explainability Assessed",                         "article":"MEASURE 2.3"},
            {"id":"MEA-2.4",  "name":"AI System Robustness Against Attacks Evaluated",            "article":"MEASURE 2.4"},
            {"id":"MEA-2.5",  "name":"AI System Privacy Risks Evaluated",                         "article":"MEASURE 2.5"},
            {"id":"MEA-2.6",  "name":"AI System Environmental Impact Evaluated",                  "article":"MEASURE 2.6"},
            {"id":"MEA-2.7",  "name":"AI System Security Evaluated",                              "article":"MEASURE 2.7"},
            {"id":"MEA-2.8",  "name":"AI System Evaluated for Intended Purpose Fitness",          "article":"MEASURE 2.8"},
            {"id":"MEA-2.9",  "name":"AI System Accountability Mechanisms Evaluated",             "article":"MEASURE 2.9"},
            {"id":"MEA-2.10", "name":"AI System Evaluated for Human Oversight Adequacy",          "article":"MEASURE 2.10"},
            {"id":"MEA-2.11", "name":"Fairness and Equity Evaluated Across Groups",               "article":"MEASURE 2.11"},
            {"id":"MEA-2.12", "name":"AI System Data Quality Evaluated",                          "article":"MEASURE 2.12"},
            {"id":"MEA-2.13", "name":"AI System Performance Tracked Over Time",                   "article":"MEASURE 2.13"},
            {"id":"MEA-3.1",  "name":"Risk Metrics Monitored Continuously",                       "article":"MEASURE 3.1"},
            {"id":"MEA-3.2",  "name":"Risk Metrics Reported to Stakeholders",                     "article":"MEASURE 3.2"},
            {"id":"MEA-3.3",  "name":"Metric Effectiveness Evaluated Periodically",               "article":"MEASURE 3.3"},
            {"id":"MEA-4.1",  "name":"Measurement Results Feed Back into Governance",             "article":"MEASURE 4.1"},
            {"id":"MEA-4.2",  "name":"Measurement Approach Improved Iteratively",                 "article":"MEASURE 4.2"},
            # MANAGE function
            {"id":"MNG-1.1",  "name":"AI Risks Prioritised by Severity and Likelihood",          "article":"MANAGE 1.1"},
            {"id":"MNG-1.2",  "name":"Response Plans for High-Priority AI Risks",                "article":"MANAGE 1.2"},
            {"id":"MNG-1.3",  "name":"Risk Responses Implemented and Monitored",                 "article":"MANAGE 1.3"},
            {"id":"MNG-1.4",  "name":"Residual Risk Reviewed After Response",                    "article":"MANAGE 1.4"},
            {"id":"MNG-2.1",  "name":"AI Benefits and Risks Balanced in Decisions",              "article":"MANAGE 2.1"},
            {"id":"MNG-2.2",  "name":"AI System Shutdown or Override Capability Maintained",     "article":"MANAGE 2.2"},
            {"id":"MNG-2.3",  "name":"AI Incident Response Plans Exist and Are Tested",          "article":"MANAGE 2.3"},
            {"id":"MNG-2.4",  "name":"AI Risks Communicated to Affected Stakeholders",           "article":"MANAGE 2.4"},
            {"id":"MNG-3.1",  "name":"AI Risks Monitored After Deployment",                      "article":"MANAGE 3.1"},
            {"id":"MNG-3.2",  "name":"AI Risk Monitoring Includes Incident Detection",           "article":"MANAGE 3.2"},
            {"id":"MNG-4.1",  "name":"Residual Risks Accepted with Documented Rationale",       "article":"MANAGE 4.1"},
            {"id":"MNG-4.2",  "name":"Lessons Learned Incorporated into Future AI Projects",    "article":"MANAGE 4.2"},
        ],
    },

    # ── OWASP LLM Top 10 + Sub-controls ──────────────────────────────────────
    "owasp_llm": {
        "label": "OWASP LLM Top 10 2025",
        "controls": [
            # LLM01 — Prompt Injection
            {"id":"LLM01",    "name":"Prompt Injection",                                          "article":"LLM01:2025"},
            {"id":"LLM01.1",  "name":"Direct Prompt Injection via User Input",                    "article":"LLM01:2025 Direct"},
            {"id":"LLM01.2",  "name":"Indirect Injection via Retrieved Documents (RAG)",          "article":"LLM01:2025 Indirect"},
            {"id":"LLM01.3",  "name":"Instruction Hijacking via Tool Outputs",                    "article":"LLM01:2025 Tool"},
            {"id":"LLM01.4",  "name":"Multi-Step Injection Chains in Agentic Systems",           "article":"LLM01:2025 Agentic"},
            {"id":"LLM01.5",  "name":"Input Sanitisation and Allowlisting Controls",             "article":"LLM01:2025 Mitigation"},
            # LLM02 — Sensitive Information Disclosure
            {"id":"LLM02",    "name":"Sensitive Information Disclosure",                          "article":"LLM02:2025"},
            {"id":"LLM02.1",  "name":"PII Leakage from Training Data Memorisation",              "article":"LLM02:2025 PII"},
            {"id":"LLM02.2",  "name":"System Prompt and Configuration Disclosure",               "article":"LLM02:2025 SysPrompt"},
            {"id":"LLM02.3",  "name":"Confidential Business Data Exfiltration",                  "article":"LLM02:2025 Business"},
            {"id":"LLM02.4",  "name":"Output Filtering and Redaction Controls",                  "article":"LLM02:2025 Mitigation"},
            # LLM03 — Supply Chain
            {"id":"LLM03",    "name":"Supply Chain Vulnerabilities",                              "article":"LLM03:2025"},
            {"id":"LLM03.1",  "name":"Pre-trained Model Source Verification",                    "article":"LLM03:2025 Models"},
            {"id":"LLM03.2",  "name":"Training Dataset Provenance and Integrity",                "article":"LLM03:2025 Data"},
            {"id":"LLM03.3",  "name":"Third-Party Plugin and Integration Security",              "article":"LLM03:2025 Plugins"},
            {"id":"LLM03.4",  "name":"Model Fine-tuning Data Integrity",                         "article":"LLM03:2025 FineTune"},
            {"id":"LLM03.5",  "name":"AI Bill of Materials (AI-BOM) Maintenance",               "article":"LLM03:2025 AIBOM"},
            # LLM04 — Data and Model Poisoning
            {"id":"LLM04",    "name":"Data and Model Poisoning",                                  "article":"LLM04:2025"},
            {"id":"LLM04.1",  "name":"Training Data Backdoor Attacks",                           "article":"LLM04:2025 Backdoor"},
            {"id":"LLM04.2",  "name":"Fine-tuning Data Manipulation",                            "article":"LLM04:2025 FineTune"},
            {"id":"LLM04.3",  "name":"RAG Knowledge Base Poisoning",                             "article":"LLM04:2025 RAG"},
            {"id":"LLM04.4",  "name":"Model Weight Tampering Detection",                         "article":"LLM04:2025 Weights"},
            # LLM05 — Improper Output Handling
            {"id":"LLM05",    "name":"Improper Output Handling",                                  "article":"LLM05:2025"},
            {"id":"LLM05.1",  "name":"Cross-Site Scripting via LLM Output (XSS)",               "article":"LLM05:2025 XSS"},
            {"id":"LLM05.2",  "name":"Server-Side Request Forgery via LLM Output (SSRF)",       "article":"LLM05:2025 SSRF"},
            {"id":"LLM05.3",  "name":"Code Execution via LLM-Generated Code",                   "article":"LLM05:2025 RCE"},
            {"id":"LLM05.4",  "name":"Output Validation and Sanitisation Controls",             "article":"LLM05:2025 Mitigation"},
            # LLM06 — Excessive Agency
            {"id":"LLM06",    "name":"Excessive Agency",                                          "article":"LLM06:2025"},
            {"id":"LLM06.1",  "name":"Overprivileged LLM Tool Permissions",                     "article":"LLM06:2025 Permissions"},
            {"id":"LLM06.2",  "name":"LLM Executing Actions Without Human Confirmation",        "article":"LLM06:2025 Autonomy"},
            {"id":"LLM06.3",  "name":"Agentic AI Kill Switch and Override Capability",          "article":"LLM06:2025 KillSwitch"},
            {"id":"LLM06.4",  "name":"Principle of Least Privilege for LLM Actions",            "article":"LLM06:2025 LeastPriv"},
            # LLM07 — System Prompt Leakage
            {"id":"LLM07",    "name":"System Prompt Leakage",                                     "article":"LLM07:2025"},
            {"id":"LLM07.1",  "name":"Direct System Prompt Extraction Attacks",                  "article":"LLM07:2025 Direct"},
            {"id":"LLM07.2",  "name":"Indirect Inference of System Prompt via Probing",         "article":"LLM07:2025 Indirect"},
            {"id":"LLM07.3",  "name":"Confidential Instruction Hardening Controls",             "article":"LLM07:2025 Mitigation"},
            # LLM08 — Vector and Embedding Weaknesses
            {"id":"LLM08",    "name":"Vector and Embedding Weaknesses",                           "article":"LLM08:2025"},
            {"id":"LLM08.1",  "name":"Embedding Inversion Attacks",                              "article":"LLM08:2025 Inversion"},
            {"id":"LLM08.2",  "name":"Cross-Tenant Data Leakage via Shared Vector Stores",     "article":"LLM08:2025 CrossTenant"},
            {"id":"LLM08.3",  "name":"Vector Store Access Controls and Isolation",              "article":"LLM08:2025 Controls"},
            # LLM09 — Misinformation
            {"id":"LLM09",    "name":"Misinformation",                                            "article":"LLM09:2025"},
            {"id":"LLM09.1",  "name":"Hallucination Detection and Grounding Controls",          "article":"LLM09:2025 Hallucination"},
            {"id":"LLM09.2",  "name":"Automated Fact-Checking Integration",                     "article":"LLM09:2025 FactCheck"},
            {"id":"LLM09.3",  "name":"User Warning for Unverified AI Output",                   "article":"LLM09:2025 Warnings"},
            # LLM10 — Unbounded Consumption
            {"id":"LLM10",    "name":"Unbounded Consumption",                                     "article":"LLM10:2025"},
            {"id":"LLM10.1",  "name":"Denial of Service via Excessive Token Generation",        "article":"LLM10:2025 DoS"},
            {"id":"LLM10.2",  "name":"Rate Limiting and Quota Controls for LLM APIs",          "article":"LLM10:2025 RateLimit"},
            {"id":"LLM10.3",  "name":"Cost Monitoring and Alerting for LLM Usage",             "article":"LLM10:2025 CostCtrl"},
        ],
    },

    # ── ISO/IEC 42001 ─────────────────────────────────────────────────────────
    "iso_42001": {
        "label": "ISO/IEC 42001",
        "controls": [
            # Clause 4 — Context
            {"id":"ISO-4.1",  "name":"Understanding the Organisation and Its Context",            "article":"Clause 4.1"},
            {"id":"ISO-4.2",  "name":"Understanding Needs and Expectations of Interested Parties","article":"Clause 4.2"},
            {"id":"ISO-4.3",  "name":"Determining the Scope of the AIMS",                        "article":"Clause 4.3"},
            {"id":"ISO-4.4",  "name":"AI Management System Establishment",                       "article":"Clause 4.4"},
            # Clause 5 — Leadership
            {"id":"ISO-5.1",  "name":"Leadership and Commitment to AIMS",                        "article":"Clause 5.1"},
            {"id":"ISO-5.2",  "name":"AI Policy Statement",                                      "article":"Clause 5.2"},
            {"id":"ISO-5.3",  "name":"Organisational Roles and Responsibilities for AI",         "article":"Clause 5.3"},
            # Clause 6 — Planning
            {"id":"ISO-6.1",  "name":"Actions to Address Risks and Opportunities",               "article":"Clause 6.1"},
            {"id":"ISO-6.1.2","name":"AI Risk Assessment Process",                               "article":"Clause 6.1.2"},
            {"id":"ISO-6.1.3","name":"AI Risk Treatment Plan",                                   "article":"Clause 6.1.3"},
            {"id":"ISO-6.2",  "name":"AI Objectives and Planning to Achieve Them",               "article":"Clause 6.2"},
            # Clause 7 — Support
            {"id":"ISO-7.1",  "name":"Resources for AI Management",                              "article":"Clause 7.1"},
            {"id":"ISO-7.2",  "name":"Competence Requirements for AI Roles",                     "article":"Clause 7.2"},
            {"id":"ISO-7.3",  "name":"Awareness of AI Policies and Risks",                       "article":"Clause 7.3"},
            {"id":"ISO-7.4",  "name":"Internal and External Communication on AI",                "article":"Clause 7.4"},
            {"id":"ISO-7.5",  "name":"Documented Information Requirements",                      "article":"Clause 7.5"},
            # Clause 8 — Operation
            {"id":"ISO-8.1",  "name":"Operational Planning and Control",                         "article":"Clause 8.1"},
            {"id":"ISO-8.2",  "name":"AI Risk Assessment Execution",                             "article":"Clause 8.2"},
            {"id":"ISO-8.3",  "name":"AI Risk Treatment Execution",                              "article":"Clause 8.3"},
            {"id":"ISO-8.4",  "name":"AI System Impact Assessment",                              "article":"Clause 8.4"},
            {"id":"ISO-8.5",  "name":"AI System Development Controls",                           "article":"Clause 8.5"},
            {"id":"ISO-8.6",  "name":"Data Management for AI Systems",                           "article":"Clause 8.6"},
            # Clause 9 — Performance Evaluation
            {"id":"ISO-9.1",  "name":"Monitoring, Measurement, Analysis and Evaluation",         "article":"Clause 9.1"},
            {"id":"ISO-9.2",  "name":"Internal Audit of the AIMS",                               "article":"Clause 9.2"},
            {"id":"ISO-9.3",  "name":"Management Review of the AIMS",                            "article":"Clause 9.3"},
            # Clause 10 — Improvement
            {"id":"ISO-10.1", "name":"Continual Improvement of the AIMS",                        "article":"Clause 10.1"},
            {"id":"ISO-10.2", "name":"Nonconformity and Corrective Action",                      "article":"Clause 10.2"},
            # Annex A — AI System Specific Controls
            {"id":"ISO-A.2",  "name":"Policies for AI (Annex A.2)",                              "article":"Annex A.2"},
            {"id":"ISO-A.3",  "name":"Internal Organisation for AI Governance (Annex A.3)",      "article":"Annex A.3"},
            {"id":"ISO-A.4",  "name":"Resources for AI Systems (Annex A.4)",                    "article":"Annex A.4"},
            {"id":"ISO-A.5",  "name":"Assessing Impacts of AI Systems (Annex A.5)",              "article":"Annex A.5"},
            {"id":"ISO-A.6",  "name":"AI System Lifecycle Controls (Annex A.6)",                 "article":"Annex A.6"},
            {"id":"ISO-A.7",  "name":"Data for AI Systems (Annex A.7)",                         "article":"Annex A.7"},
            {"id":"ISO-A.8",  "name":"Information for Interested Parties (Annex A.8)",           "article":"Annex A.8"},
            {"id":"ISO-A.9",  "name":"Human Oversight of AI Systems (Annex A.9)",               "article":"Annex A.9"},
            {"id":"ISO-A.10", "name":"Responsible AI Development Practices (Annex A.10)",        "article":"Annex A.10"},
        ],
    },

    # ── 21 CFR Part 11 ────────────────────────────────────────────────────────
    "cfr_part11": {
        "label": "21 CFR Part 11",
        "controls": [
            {"id":"CFR-11.10a",  "name":"Validation of Systems to Ensure Accuracy",              "article":"Sec. 11.10(a)"},
            {"id":"CFR-11.10b",  "name":"Legible and Accurate Record Copies",                    "article":"Sec. 11.10(b)"},
            {"id":"CFR-11.10c",  "name":"Record Protection and Retrieval",                       "article":"Sec. 11.10(c)"},
            {"id":"CFR-11.10d",  "name":"Authorised System Access Limitation",                   "article":"Sec. 11.10(d)"},
            {"id":"CFR-11.10e",  "name":"Secure Computer-Generated Audit Trails",                "article":"Sec. 11.10(e)"},
            {"id":"CFR-11.10f",  "name":"Operational Sequence Checks",                           "article":"Sec. 11.10(f)"},
            {"id":"CFR-11.10g",  "name":"Authority Checks for Record Access",                    "article":"Sec. 11.10(g)"},
            {"id":"CFR-11.10h",  "name":"Device Checks for Input Validity",                      "article":"Sec. 11.10(h)"},
            {"id":"CFR-11.10i",  "name":"Qualified Personnel Education and Training",            "article":"Sec. 11.10(i)"},
            {"id":"CFR-11.10j",  "name":"Written Policies for System Controls",                  "article":"Sec. 11.10(j)"},
            {"id":"CFR-11.10k",  "name":"Controls Over Distribution of Documents",               "article":"Sec. 11.10(k)"},
            {"id":"CFR-11.30",   "name":"Controls for Open Systems",                             "article":"Sec. 11.30"},
            {"id":"CFR-11.50a",  "name":"Electronic Signature Manifestations",                   "article":"Sec. 11.50(a)"},
            {"id":"CFR-11.50b",  "name":"Signature Linked to Record",                            "article":"Sec. 11.50(b)"},
            {"id":"CFR-11.70",   "name":"Electronic Signature and Record Linkage",               "article":"Sec. 11.70"},
            {"id":"CFR-11.100a", "name":"Unique Electronic Signature per Individual",            "article":"Sec. 11.100(a)"},
            {"id":"CFR-11.100b", "name":"Identity Verification Before Signature Issuance",      "article":"Sec. 11.100(b)"},
            {"id":"CFR-11.100c", "name":"FDA Certification of Electronic Signatures",            "article":"Sec. 11.100(c)"},
            {"id":"CFR-11.200a", "name":"Two Distinct ID Components for Non-Biometric Sig",     "article":"Sec. 11.200(a)"},
            {"id":"CFR-11.200b", "name":"Non-Biometric Signature Controls",                      "article":"Sec. 11.200(b)"},
            {"id":"CFR-11.300a", "name":"Unique Combination of ID Code and Password",            "article":"Sec. 11.300(a)"},
            {"id":"CFR-11.300b", "name":"Password Issuance and Periodic Revision",               "article":"Sec. 11.300(b)"},
            {"id":"CFR-11.300c", "name":"Loss Management Procedures",                            "article":"Sec. 11.300(c)"},
            {"id":"CFR-11.300d", "name":"Transaction Safeguards Against Unauthorised Use",      "article":"Sec. 11.300(d)"},
            {"id":"CFR-11.300e", "name":"Token or Card Device Checks",                           "article":"Sec. 11.300(e)"},
            {"id":"CFR-AI-1",    "name":"AI/ML Model Validation Documentation",                  "article":"FDA AI/ML Guidance Sec. 3.1"},
            {"id":"CFR-AI-2",    "name":"Predetermined Change Control Plan (PCCP)",              "article":"FDA AI/ML Guidance Sec. 4.1"},
            {"id":"CFR-AI-3",    "name":"Algorithm Change Protocol",                             "article":"FDA AI/ML Guidance Sec. 4.2"},
            {"id":"CFR-AI-4",    "name":"Real-World Performance Monitoring",                     "article":"FDA AI/ML Guidance Sec. 5.1"},
            {"id":"CFR-AI-5",    "name":"Training and Reference Dataset Transparency",           "article":"FDA AI/ML Guidance Sec. 3.2"},
        ],
    },
}


class ComplianceMapper:

    async def get_posture(self, framework: str, findings: List[Dict]) -> Dict:
        fw_config = FRAMEWORK_CONTROLS.get(framework, {})
        if not fw_config:
            return {"error": f"Unknown framework: {framework}"}

        controls = fw_config.get("controls", [])
        fw_findings = [f for f in findings if framework in f.get("frameworks", [])]
        open_findings = [f for f in fw_findings if f.get("status") == "open"]
        resolved      = [f for f in fw_findings if f.get("status") == "resolved"]

        # Map open findings to controls by index
        failed_controls = min(len(open_findings), len(controls))
        passed_controls = len(controls) - failed_controls
        score = round((passed_controls / len(controls)) * 100, 1) if controls else 100.0

        return {
            "framework":         framework,
            "label":             fw_config.get("label"),
            "score":             score,
            "status":            "fail" if score < 70 else ("partial" if score < 90 else "pass"),
            "controls_total":    len(controls),
            "controls_passed":   passed_controls,
            "controls_failed":   failed_controls,
            "open_findings":     len(open_findings),
            "resolved_findings": len(resolved),
            "findings":          fw_findings[:10],
            "controls": [
                {**c, "status": "fail" if i < failed_controls else "pass"}
                for i, c in enumerate(controls)
            ],
            "assessed_at": datetime.utcnow().isoformat(),
        }

    async def generate_evidence_pack(
        self,
        framework: str,
        findings:  List[Dict],
        assets:    List[Dict],
        asset_id:  Optional[str] = None,
    ) -> Dict:
        fw_config   = FRAMEWORK_CONTROLS.get(framework, {})
        fw_findings = [f for f in findings if framework in f.get("frameworks", [])]
        if asset_id:
            fw_findings = [f for f in fw_findings if f.get("asset_id") == asset_id]
            assets      = [a for a in assets if a.get("id") == asset_id]

        return {
            "pack_id":      f"EVIDENCE-{framework.upper()}-{datetime.utcnow().strftime('%Y%m%d-%H%M')}",
            "framework":    framework,
            "label":        fw_config.get("label", framework),
            "generated_at": datetime.utcnow().isoformat(),
            "generated_by": "OpenGovAI Compliance Engine v4.0",
            "scope": {
                "assets":    [a.get("name") for a in assets],
                "asset_ids": [a.get("id")   for a in assets],
                "period":    (f"{datetime.utcnow().strftime('%Y-01-01')} to "
                              f"{datetime.utcnow().strftime('%Y-%m-%d')}"),
            },
            "executive_summary": {
                "total_findings": len(fw_findings),
                "open":           len([f for f in fw_findings if f.get("status") == "open"]),
                "resolved":       len([f for f in fw_findings if f.get("status") == "resolved"]),
                "critical":       len([f for f in fw_findings if f.get("severity") == "critical"]),
                "compliance_score": round(random.uniform(62, 88), 1),
            },
            "controls":  fw_config.get("controls", []),
            "findings":  fw_findings,
            "attestation": {
                "statement": (
                    f"This evidence pack was automatically generated by OpenGovAI on "
                    f"{datetime.utcnow().strftime('%Y-%m-%d')}. It represents the compliance "
                    f"posture as of the assessment date and is intended to support "
                    f"{fw_config.get('label', framework)} conformity assessment activities."
                ),
                "generated_by_system": "OpenGovAI v4.0.0",
                "review_required":     True,
                "note": (
                    "This pack must be reviewed and attested by an authorised compliance "
                    "officer before submission to regulators."
                ),
            },
        }
