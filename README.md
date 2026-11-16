# OpenGovAI v5

**Self-hosted AI deployment governance, authored by Aniza Inc.**

OpenGovAI helps an organization answer three operational questions about an AI system. **What version is deployed? Who approved it and on what evidence? Does it still meet the conditions for release or continued operation?** It gives model owners, reviewers, and platform operators a shared record for making and enforcing those decisions.

The objective is to make AI governance part of the release process. Each decision is anchored to an identifiable deployment version, with its owner, model, environment, and release reference. The workspace connects that version to the applicable policy, control evidence, upstream dependencies, and review history. Delivery pipelines and inference gateways can use the resulting decision at the point where they promote a release or forward traffic.

**Start here**

[Download the client release](https://github.com/sjanizacorp/opengovai/releases/tag/v5.0.2) · [Explore the deployment files](v5/README.md) · [Administration PDF](v5/manuals/OpenGovAI-Administration.pdf) · [Configuration PDF](v5/manuals/OpenGovAI-Configuration.pdf) · [API PDF](v5/manuals/OpenGovAI-API.pdf)

![OpenGovAI by Aniza Inc showing the AI governance overview, work queue, and recent activity](v5/screenshots/workspace-overview.png)

## What a governed release looks like

Consider a demand-forecasting model moving from build 2.3 to 2.4. Its owner registers the new deployment version, including the release reference and the dataset version it uses. The delivery job submits the evaluation results for 2.4. A reviewer checks the applicable controls and records a decision against that version. Before promotion, CI asks OpenGovAI whether 2.4 meets the current release policy. The approval receipt for 2.3 remains available for audit.

After release, a monitor receives aggregate observations such as inference latency or changes in output distribution. A stale or breached signal can open an incident and trigger reassessment. The operator can trace the incident back to the monitored version, policy, and approval. This gives the same deployment record a role before and after promotion.

## Capabilities

| Capability | How it works in practice |
| --- | --- |
| **Deployment inventory and version history** | Register an AI asset manually or connect a feed. Each record can identify the owner, intended use, model, provider, environment, and immutable deployment reference. Material changes create a new version, preserving the history of earlier releases. |
| **Policies and control assessments** | Select a control framework, choose required controls, and define evidence and inventory freshness limits. Record assessments directly or import measured evaluation results. Reviewed evidence mappings can reuse applicable evidence across frameworks for the same version. |
| **Upstream dependency tracking** | Connect deployed versions to pinned versions of upstream models, datasets, services, or tools. Inspect direct and transitive dependencies and flag changed versions that require attention. |
| **Review routing and approval receipts** | Route version-specific requests through configurable stages with assigned reviewers and deadlines. The approval records the decision, policy, and evidence snapshot with a digest that can be exported and retained with the release. |
| **Governance scans and findings** | Run an on-demand check of a version against its release conditions. Inspect the blockers, assign failed controls to an owner, record a retest, and complete a new review where reassessment is required. |
| **Runtime monitoring and reassessment** | Set scalar thresholds or distribution baselines, minimum sample counts, and signal age limits. Track observations and incidents for the deployed version and route required reassessments back into review. |
| **Enforcement in CI and at the gateway** | Check the exact asset, version, and release reference before promotion. For live enforcement, configure a trusted inference gateway to check a version-bound runtime credential before forwarding requests. |
| **Vendor evidence and audit** | Issue expiring, single-use questionnaires tied to an asset version. Preserve submitted responses with the applicable evidence. Administrators and auditors can inspect activity, and operators can forward audit events to an external collector. |
| **Access and deployment operations** | Assign workspace roles and business units. Configure local accounts or OIDC with optional SCIM provisioning. Use the included Docker package with SQLite or a configured PostgreSQL database. |

## Connect your deployment environment

| Environment | Inventory connection |
| --- | --- |
| **AWS** | A read-only runner discovers in-service Amazon SageMaker endpoints and Amazon Bedrock provisioned throughput deployments in configured regions. |
| **Azure, Google Cloud, IBM Cloud, and Oracle Cloud** | The guided setup captures the deployment identity and issues a scoped token. A CI or scheduled job publishes deployment metadata and the operator verifies receipt in the workspace. |
| **VMware ESXi and vCenter** | A read-only connector verifies the selected VM by BIOS UUID and refreshes inventory while the VM is connected and powered on. The application pipeline provides the model and release reference. |
| **MLflow, Prometheus, and custom pipelines** | MLflow can supply registry inventory and measured evaluation evidence. Prometheus can supply aggregate observations. A versioned API lets approved publishers submit data and check release decisions. |

## Who uses OpenGovAI

- **Model owners and delivery teams** maintain deployment identity, supply evidence, request review, and consume release decisions from CI.
- **Governance and model-risk teams** set policy, assess controls, route approvals, and investigate unresolved findings.
- **Platform operators** manage access, connect inventory and telemetry, configure gateways, and coordinate recovery.
- **Auditors and assurance teams** inspect retained evidence, decision receipts, and workspace activity in their authorized business unit.

## Start with one staging deployment

1. Download the [offline v5.0.2 client bundle](https://github.com/sjanizacorp/opengovai/releases/download/v5.0.2/opengovai-5.0.2-client.tar.gz). It includes prebuilt x86-64 and ARM64 Docker images.
2. Extract the archive and run `./install.sh` with Docker and Docker Compose available.
3. Use the [Administration Manual](v5/manuals/OpenGovAI-Administration.pdf) to create an administrator and a separate reviewer. Use the [Configuration Manual](v5/manuals/OpenGovAI-Configuration.pdf) to connect inventory and bind a policy.
4. Register one staging deployment, submit the required evidence, finish a review, and run a governance scan. Use the [API Manual](v5/manuals/OpenGovAI-API.pdf) to verify a feed or connect the release check to CI.

The manuals include screenshots, expected results, and recovery steps for operators.
