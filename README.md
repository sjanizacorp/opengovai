# OpenGovAI v5 client deployment

**OpenGovAI is authored by Aniza Inc.**

Download the [complete offline v5.0.2 client package](https://github.com/sjanizacorp/opengovai/releases/download/v5.0.2/opengovai-5.0.2-client.tar.gz), extract it, and run `./install.sh` with Docker and Docker Compose available.

If you already have this expanded deployment directory, download the image archive for your Docker engine from the [v5.0.2 release](https://github.com/sjanizacorp/opengovai/releases/tag/v5.0.2). Save it alongside `install.sh`.

| Docker engine architecture | Required file |
| --- | --- |
| x86-64 | [images-amd64.tar.gz](https://github.com/sjanizacorp/opengovai/releases/download/v5.0.2/images-amd64.tar.gz) |
| ARM64 | [images-arm64.tar.gz](https://github.com/sjanizacorp/opengovai/releases/download/v5.0.2/images-arm64.tar.gz) |

The installer verifies the image archive against the included SHA-256 checksum.

## Illustrated PDF manuals

- [Administration](manuals/OpenGovAI-Administration.pdf) for installation, accounts, reviews, and recovery.
- [Configuration](manuals/OpenGovAI-Configuration.pdf) for provider setup, policy, monitoring, identity, and storage.
- [API](manuals/OpenGovAI-API.pdf) for readiness, credentials, inventory, evidence, telemetry, and release checks.

The [client deployment guide](CLIENT-GUIDE.md) and [user manual](USER-GUIDE.md) are also available as Markdown.
