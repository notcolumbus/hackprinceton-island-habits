#!/bin/bash
# Frontend setup script — runs on Dedalus Machine
# VITE_BACKEND_URL must be exported by the caller.
set -uo pipefail

: "${VITE_BACKEND_URL:?VITE_BACKEND_URL must be set by caller}"

NODE_VERSION="v20.18.0"
NODE_DIR="/home/machine/node-${NODE_VERSION}-linux-x64"
NODE_BIN="$NODE_DIR/bin"
NODE_URL="https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-linux-x64.tar.gz"
APP_DIR="/home/machine/app"
FRONTEND_DIR="$APP_DIR/apps/app"
LOG="/home/machine/frontend.log"

echo "=== Frontend Setup: $(date) ==="
echo "VITE_BACKEND_URL=$VITE_BACKEND_URL"

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

# ── Vite build ────────────────────────────────────────────────────────
echo "[vite] Building (VITE_BACKEND_URL=$VITE_BACKEND_URL)..."
cd "$FRONTEND_DIR"
VITE_BACKEND_URL="$VITE_BACKEND_URL" npm run build 2>&1 | tail -15
echo "[vite] Build done."

# ── Serve dist ────────────────────────────────────────────────────────
pkill -f "serve -s" 2>/dev/null && sleep 1 || true
npm install -g serve --loglevel=error > /dev/null 2>&1
setsid serve -s "$FRONTEND_DIR/dist" -p 3000 > "$LOG" 2>&1 &
echo "[serve] Started PID=$!, log=$LOG"

sleep 3
HTTP=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000 2>/dev/null || echo "FAILED")
echo "[serve] HTTP $HTTP"
echo "=== Frontend Setup Complete ==="
