#!/bin/bash
# Agent setup script — runs on Dedalus Machine
# BACKEND_URL and APP_BASE_URL must be exported by the caller.
set -uo pipefail

NODE_VERSION="v20.18.0"
NODE_DIR="/home/machine/node-${NODE_VERSION}-linux-x64"
NODE_BIN="$NODE_DIR/bin"
NODE_URL="https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-linux-x64.tar.gz"
APP_DIR="/home/machine/app"
AGENT_DIR="$APP_DIR/apps/agent"
LOG="/home/machine/agent.log"

echo "=== Agent Setup: $(date) ==="
echo "BACKEND_URL=${BACKEND_URL:-not_set}"
echo "APP_BASE_URL=${APP_BASE_URL:-not_set}"

# ── Node.js ───────────────────────────────────────────────────────────
if [ ! -x "$NODE_BIN/node" ]; then
  echo "[node] Downloading Node.js $NODE_VERSION..."
  curl -fsSL --retry 3 --retry-delay 2 "$NODE_URL" -o /home/machine/node.tar.gz
  echo "[node] Extracting..."
  tar -xzf /home/machine/node.tar.gz -C /home/machine/
  rm /home/machine/node.tar.gz
fi
export PATH="$NODE_BIN:$PATH"
echo "[node] $(node --version)  npm $(npm --version)"

# ── npm install ───────────────────────────────────────────────────────
echo "[npm] Installing dependencies..."
cd "$APP_DIR"
npm install --loglevel=error 2>&1 | tail -5
echo "[npm] Done."

# ── Update .env with runtime URLs ─────────────────────────────────────
if [ -n "${BACKEND_URL:-}" ]; then
  # Append — dotenv uses the last occurrence
  echo "BACKEND_URL=$BACKEND_URL" >> "$AGENT_DIR/.env"
fi
if [ -n "${APP_BASE_URL:-}" ]; then
  echo "APP_BASE_URL=$APP_BASE_URL" >> "$AGENT_DIR/.env"
fi
echo "[env] .env updated."

# ── Start agent ───────────────────────────────────────────────────────
pkill -f "tsx src/index.ts" 2>/dev/null && sleep 1 || true
cd "$AGENT_DIR"
setsid npx tsx src/index.ts > "$LOG" 2>&1 &
echo "[agent] Started PID=$!, log=$LOG"

sleep 3
echo "=== Agent Setup Complete ==="
