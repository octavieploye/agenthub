# AgentHub — Claude CLI agent container
# Base: node:20-slim (keeps image lean, ~400-500MB with Claude CLI)
FROM node:20-slim

# Build arg: macOS default UID (501). Override with --build-arg AGENT_UID=<your-uid>
ARG AGENT_UID=501

# Install system deps: git (lead agent git ops), curl, ca-certs
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Create non-root agent user with configurable UID
RUN groupadd -g ${AGENT_UID} agent && \
    useradd -u ${AGENT_UID} -g agent -m -s /bin/bash agent

# Install Claude CLI globally (pinned via npm, runs as root so /usr/local/bin is writable)
RUN npm install -g @anthropic-ai/claude-code

# Switch to non-root user for runtime
USER agent
WORKDIR /workspace

# Verify Claude CLI installed
RUN claude --version

# Default: keep container alive (agents exec into it)
CMD ["tail", "-f", "/dev/null"]
