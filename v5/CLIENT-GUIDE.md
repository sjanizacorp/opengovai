# OpenGovAI client deployment

**OpenGovAI is authored by Aniza Inc.**

This release includes deployment images for x86-64 and ARM64 Linux Docker
engines. Docker Desktop can run the release in Linux-container mode. Use a
local deployment terminal with Docker Engine and the Compose plugin available.

## Illustrated operator manuals

- [Administration](manuals/OpenGovAI-Administration.pdf) covers first sign-in,
  accounts, assets, reviews, scans, and recovery.
- [Configuration](manuals/OpenGovAI-Configuration.pdf) covers cloud and VMware
  setup, policy, monitoring, identity, and storage.
- [API](manuals/OpenGovAI-API.pdf) walks through readiness, inventory,
  evaluation, runtime observations, and release checks.

## Install and sign in

1. Start Docker on macOS, Linux, or Windows with WSL integration. Extract the
   client archive and run `./install.sh`. In the expanded GitHub `v5`
   directory, use `./install.sh --download` to fetch the matching download.
2. Optionally connect an existing Ollama, LM Studio, or keyless OpenAI-compatible
   server. Enter its base URL and exact model ID. The installer sends a test
   prompt and records the result in `setup.log`. On native Linux Docker, the
   default `opengovai-model-host` points to the Docker host. Bind the server
   to an interface reachable by that engine. Docker Desktop uses
   `host.docker.internal`.
3. Choose a username, business unit, and a password of at least 12 characters.
   Open the printed URL and sign in. Progress and the paths to configuration,
   the installer, and operational commands appear in `setup.log`.
4. Create an independent reviewer when you are ready to request approvals.
   Use the same unit as your administrator.

   ```sh
   docker compose exec api opengovai manage create-user release-reviewer --role reviewer --unit default
   ```

Set `PORT` in `.env` to change the dashboard port. For remote access, use TLS
ingress and enable `OPENGOVAI_SECURE_COOKIE=true`. For unattended setup, pass
`--non-interactive --admin-password-file FILE` and optionally `--admin USER`
and `--unit UNIT`. Use `--skip-admin` when provisioning accounts separately.

### Accounts and directory access

Use `opengovai manage` through the API container for local accounts, OIDC
provisioning, and credential management. Roles include `admin`, `contributor`,
`reviewer`, and `auditor`. A business unit scopes access to workspace records.
Run `docker compose exec api opengovai manage --help` for account and integration
commands. `disable-user USERNAME` revokes that account’s active sessions.

For OIDC, register `https://YOUR-HOST/api/v1/auth/oidc/callback` with your
identity provider and configure the OIDC settings in `.env`. Use authorization
code flow with S256 PKCE and a confidential client. Provision each user with
`opengovai manage provision-oidc USER --subject SUBJECT --role ROLE --unit UNIT`.
Confirm administrator SSO before disabling password login. Exclude callback
query strings from ingress logs.

For SCIM, configure the token, unit and non-admin role settings in `.env`.
Use `https://YOUR-HOST/api/v1/scim/v2` and map SCIM `externalId` to the stable
OIDC identifier. Verify creation and session revocation on suspension before
launch. Protect configuration and credentials as deployment secrets.

## Connect inventory

1. An administrator opens **Cloud setup** and selects Azure Machine Learning,
   Google Cloud Vertex AI, IBM Cloud watsonx.ai, Oracle Cloud Data Science, or
   VMware ESXi. Enter the identifier requested by the wizard, the deployed
   model, owning team, environment, and the immutable deployment reference.

   ![Guided setup platform selection](screenshots/cloud-provider.png)

2. Create the connection. Save the issued token as
   `OPENGOVAI_INTEGRATION_TOKEN`, and download `inventory.json`. For Azure,
   Google Cloud, IBM Cloud, and Oracle Cloud, use the wizard’s command from a
   pipeline that can reach the OpenGovAI URL over HTTPS.
3. For VMware, copy the inventory file to a runner with HTTPS access to ESXi or
   vCenter. Put the OpenGovAI URL, token, and VMware read-only credentials in a
   protected `vmware.env` file. Set `OPENGOVAI_URL`, `OPENGOVAI_VSPHERE_URL`,
   `OPENGOVAI_VSPHERE_USERNAME`, and `OPENGOVAI_VSPHERE_PASSWORD`. Set
   `OPENGOVAI_VSPHERE_CA_FILE` or `OPENGOVAI_CA_FILE` for private CAs and mount
   the corresponding files read-only at those paths inside the container.

   ```sh
   docker compose run --rm --no-deps --env-from-file vmware.env \
     -v "$PWD/inventory.json:/input/inventory.json:ro" \
     api opengovai vsphere-sync /input/inventory.json
   ```

4. In the wizard, choose **Verify connection**. After inventory is received,
   bind a release policy and proceed to the governance workflow. Schedule the
   runner before any inventory age limit. Increment the source revision and
   update the deployment reference when releasing a changed deployment.
5. **Rotate token** replaces the runner credential. Publish again and verify
   the new token. **Disable token** stops publishing and revokes the associated
   runtime gateway keys.

### AWS and other runners

Create an integration token with
`docker compose exec api opengovai manage create-integration registry-feed --unit operations`.
Supply the integration token and the HTTPS `OPENGOVAI_PUBLIC_URL` in the
runner’s protected environment file. Use
`docker compose run --rm --no-deps --env-from-file runner.env api opengovai COMMAND --help`
to view the parameters for the following commands:

| Command | Input |
| --- | --- |
| `aws-sync` | Read-only AWS identity, regions, owner, and environment. Discovers in-service SageMaker endpoints and Bedrock provisioned throughput. |
| `mlflow-sync` | Tracking URI and read-only authentication. Use rules to import measured results from registered model runs. |
| `prometheus-sync` | Prometheus connection and a mounted feed configuration containing deployment-specific PromQL and observation timestamps. |
| `release-check` | Asset ID, asset version, and deployment reference. Stop promotion on any nonzero exit. |

Pass files using read-only mounts and keep AWS and service credentials outside
the application’s files. Set `AWS_PROFILE` and mount credential configuration
read-only when using a named profile. Check a runner’s exit status and verify
its new data in OpenGovAI.

## Import or create a policy

1. Sign in as an administrator and open **Policies**. Choose **Import
   document** to load a text-based PDF, Word `.docx`, or Excel `.xlsx` up to
   5 MB. Use **Download Excel template** for a new custom policy.
2. For the template, replace the sample values on **Policy** and enter one
   control ID per row in **Controls**. Use the framework and control IDs on
   **Catalog**. Save the completed workbook as `.xlsx` and upload it.
3. Select **Extract text locally** for local processing or choose a configured
   AI engine for optional drafting. Review the extracted text and suggested
   controls, edit the policy, and publish.

![A template imported into the editable policy review screen](screenshots/policy-document-import.png)

### Connect a local or hosted language model

1. In **Policies → Policy AI settings**, select **Add connection**. Pick
   OpenAI, Google Gemini, or an OpenAI-compatible endpoint approved by the
   deployment operator.
2. Enter a name, the provider's model ID, and its API key if required. Save
   and select **Test connection** to check that the engine can return a draft
   from a sample prompt.
3. In **Policies → Import document**, select the connection under **Drafting
   method** and authorize sharing extracted text. Review the draft and
   suggested controls. Structured Excel templates are imported locally.

![Policy AI settings after testing a local model](screenshots/policy-ai-settings.png)

To enable saved credentials, set `OPENGOVAI_POLICY_AI_STATE_KEY` in `.env`.
Generate a Fernet key with the installed API container's Python:

```sh
docker compose exec -T api python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'
```

Protect the key and retain it securely for backup restores. To add a local
or custom model server, register its base URL in `.env`, for example:

```dotenv
OPENGOVAI_POLICY_AI_ENDPOINTS='[{"id":"ollama","label":"Local Ollama","base_url":"http://host.docker.internal:11434/v1","allow_http":true}]'
```

Use an address the API container can reach. Docker Desktop provides
`host.docker.internal`. In a shared Docker network, use the model server's
service name. Private HTTP endpoints support keyless requests. Configure
HTTPS for connections that use API keys. Set
`OPENGOVAI_POLICY_AI_ALLOW_PUBLIC=false` if you want to disable the built-in
public endpoints. Apply changes with `docker compose up -d --wait`.

## Configure runtime monitoring and enforcement

1. Publish a control policy in **Policies**. Bind it in the asset’s **Release
   gate** or in the guided setup. Set evidence and inventory ages according to
   source refresh intervals. Require monitoring or dependencies when needed.
2. In **Runtime monitoring**, select **Configure monitor** for the active
   connected deployment and create a scalar or distribution rule. Send measured
   aggregate observations for that monitor ID and deployment reference. Include
   the actual observation timestamp and sample count or histogram.
3. Verify status and history using **Refresh signals** and **View history**.
   Review the incidents and the reassessments they open.
4. Use `release-check` from CI after updating inventory and evidence. For
   gateway enforcement, mint a separate, version-bound runtime key:

   ```sh
   docker compose exec api opengovai manage create-runtime-key production-gateway \
     --integration registry-feed --asset ASSET_ID --version 2 --deployment-ref BUILD_DIGEST
   ```

   Configure the trusted gateway to issue a GET authorization subrequest to
   `/api/v1/integrations/runtime-authorize` with the runtime key as a bearer
   token. Disable authorization response caching and omit the inference body
   and caller headers. Proceed only on HTTP 204. Keep existing client
   authentication and prevent direct access to the inference backend. Verify
   denial and API outage behavior before production use.

## Operate and recover

- Run `docker compose ps` and check `/api/v1/health` for readiness. To diagnose
  a service, use `docker compose logs --tail=100 api nginx`. Open the dashboard
  and use its sidebar to find the asset registry and governance scans.
- Keep `.env` and database backups under access control. The default SQLite
  database uses the Compose data volume. Schedule a cold backup with all
  writers stopped, and verify restoration in a disposable deployment. For
  PostgreSQL, configure `OPENGOVAI_DATABASE_URL` and use the
  `opengovai operations backup` and `verify-restore` commands with your
  PostgreSQL service credentials and restore test target.
- For audit retention, configure `OPENGOVAI_AUDIT_URL` and
  `OPENGOVAI_AUDIT_TOKEN`. Run `opengovai operations forward-audit DESTINATION`
  on a schedule and monitor its exit status. Use **Audit log** to inspect
  activity in the workspace.
- Before updating, verify a restorable backup. Preserve the Compose project
  name, its data volume, and the local `.env` when applying a new release.
  Run the new release’s installer and verify sign-in, a scan, and an evidence
  export. Use `docker compose stop` for maintenance.

Third-party notices for the web bundle are available at
`/third-party-licenses.md`. Runtime image package notices are retained in the
included image files.
