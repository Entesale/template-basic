#!/bin/bash
# One-time setup script run during snapshot creation.
# Installs opencode globally and ensures MCP binary is executable.
set -e

npm install -g opencode-ai

chmod +x /vercel/sandbox/mcp/unipile/dist/index.cjs 2>/dev/null || true

# Create workspace dir (gitignored) for per-agent runtime state
mkdir -p /vercel/sandbox/workspace

echo "✓ Setup complete"
