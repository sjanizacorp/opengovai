# OpenGovAI v5 client deployment

Download the [complete offline client package](https://github.com/sjanizacorp/opengovai/releases/download/v5/opengovai-5.0.0-client.tar.gz), extract it, and run `./install.sh` with Docker and Docker Compose available.

If you already have this expanded deployment directory, download the image archive for your Docker engine from the [v5 release](https://github.com/sjanizacorp/opengovai/releases/tag/v5). Save it alongside `install.sh`.

| Docker engine architecture | Required file |
| --- | --- |
| x86-64 | [images-amd64.tar.gz](https://github.com/sjanizacorp/opengovai/releases/download/v5/images-amd64.tar.gz) |
| ARM64 | [images-arm64.tar.gz](https://github.com/sjanizacorp/opengovai/releases/download/v5/images-arm64.tar.gz) |

Run `./install.sh`. The installer verifies the image archive against the included SHA-256 checksum. Follow the [client deployment guide](CLIENT-GUIDE.md) to create an administrator and configure the workspace. The [user manual](USER-GUIDE.md) covers daily governance tasks.
