# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim

# Base tooling you likely want available during Codex sessions/shell
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    git bash ca-certificates curl jq yq ripgrep fd-find python3 python3-pip rsync nano less procps zsh \
 && ln -s /usr/bin/fdfind /usr/local/bin/fd \
 && rm -rf /var/lib/apt/lists/*

# Install Codex CLI globally (or you can rely on npx if you prefer)
ARG CODEX_NPM="@openai/codex"
ARG CODEX_VERSION="latest"
RUN npm i -g "${CODEX_NPM}@${CODEX_VERSION}" @playwright/mcp @upstash/context7-mcp

# Enable pnpm via corepack for Node 22 images
ENV COREPACK_HOME=/home/app/.cache/corepack
RUN mkdir -p "$COREPACK_HOME" && corepack enable && corepack prepare pnpm@latest --activate

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Non-root user
RUN useradd -m -s /usr/bin/zsh app && mkdir -p /work && chown app:app /work

# “Home” in the container is isolated (mounted as its own named volume by the wrapper)
WORKDIR /work
USER app

# Keep PID 1 sane
ENTRYPOINT ["/entrypoint.sh"]
