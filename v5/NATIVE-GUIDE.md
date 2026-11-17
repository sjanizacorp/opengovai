# OpenGovAI native client

**Authored by Aniza Inc.**

Extract the archive that matches your macOS or Linux host and CPU. On
Linux use a glibc-based distribution with glibc 2.36 or later. Install
CPython 3.12 with virtual-environment support. The initial dependency
installation uses pip and requires access to your configured package index.

Run `./install.sh` in the extracted directory. Setup creates the first
administrator and optionally connects a running local model for policy
drafting. It prints the dashboard address and records the paths in
`setup.log`. The dashboard listens on the loopback interface by default.

| Command | Action |
| --- | --- |
| `./start.sh` | Start the workspace and wait for readiness |
| `./stop.sh` | Stop this installation |
| `./opengovai status` | Show whether this installation is running |
| `./uninstall.sh` | Remove the installed environment and keep configuration, logs, and data |
| `./opengovai manage --help` | Manage accounts and deployment credentials |

## Govern a local model deployment

1. In the dashboard, choose **Deployment setup → Local language model**.
   Enter the exact model ID and a stable deployment identifier.
2. Download `inventory.json` and save the issued token in your runner's
   secret store as `OPENGOVAI_INTEGRATION_TOKEN`. Set `OPENGOVAI_URL` to the
   workspace address and `OPENGOVAI_LOCAL_MODEL_URL` to the model API base URL.
3. For Ollama, set `OPENGOVAI_LOCAL_MODEL_RUNTIME=ollama` to record its
   model digest. For LM Studio or another compatible server, use its
   versioned base URL and record the immutable deployment reference. Update
   the reference and increment `source_revision` when the deployment changes.
4. Run `./opengovai local-model-sync inventory.json`, then **Verify connection**.
   Bind a policy and open **Governance scans**. Local deployments use the
   same evidence, control, monitoring, review, and release checks as cloud
   deployments. Schedule the runner to keep inventory current.

A same-machine model can use loopback HTTP. Use HTTPS for an authenticated
remote server. To allow a keyless model on a private HTTP address, opt in
with `OPENGOVAI_LOCAL_MODEL_ALLOW_HTTP=true`. The runner checks inventory
without sending an inference prompt.
