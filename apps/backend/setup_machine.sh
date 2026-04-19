#!/bin/bash
# Backend setup script — runs on Dedalus Machine
# All output is captured to /home/machine/backend_setup.log by the caller.
set -uo pipefail

BACKEND_DIR="/home/machine/app/apps/backend"
LOG="/home/machine/backend.log"

echo "=== Backend Setup: $(date) ==="
echo "shell: $BASH_VERSION"
echo "user:  $(whoami)"
echo "home:  $HOME"

# ── Python ────────────────────────────────────────────────────────────
PYTHON=""
for candidate in python3 python3.12 python3.11 python3.10 /usr/bin/python3; do
  if command -v "$candidate" &>/dev/null; then
    PYTHON="$candidate"
    break
  fi
done

if [ -z "$PYTHON" ]; then
  echo "[python] No system Python found — downloading standalone..."
  PY_URL="https://github.com/astral-sh/python-build-standalone/releases/download/20241002/cpython-3.12.7+20241002-x86_64-unknown-linux-gnu-install_only.tar.gz"
  curl -fsSL --retry 3 --retry-delay 2 "$PY_URL" -o /home/machine/cpython.tar.gz
  tar -xzf /home/machine/cpython.tar.gz -C /home/machine/
  rm /home/machine/cpython.tar.gz
  PYTHON="/home/machine/python/bin/python3"
fi
echo "[python] Using: $PYTHON ($($PYTHON --version 2>&1))"

# ── pip ───────────────────────────────────────────────────────────────
if ! $PYTHON -m pip --version &>/dev/null 2>&1; then
  echo "[pip] Bootstrapping pip..."
  curl -fsSL https://bootstrap.pypa.io/get-pip.py | $PYTHON - --user -q
fi
PIP="$PYTHON -m pip"
echo "[pip] $($PIP --version 2>&1)"

# ── Dependencies ──────────────────────────────────────────────────────
echo "[pip] Installing requirements..."
$PIP install --user -r "$BACKEND_DIR/requirements.txt" -q
echo "[pip] Done."

# ── Start Flask ───────────────────────────────────────────────────────
pkill -f "app.py" 2>/dev/null && sleep 1 || true
cd "$BACKEND_DIR"
setsid $PYTHON app.py > "$LOG" 2>&1 &
FLASK_PID=$!
echo "[flask] Started PID=$FLASK_PID, log=$LOG"

# ── Cron ──────────────────────────────────────────────────────────────
CRONTAB_LINE_1="0 12 * * * curl -s -X POST http://localhost:5001/jobs/morning-reminder >> /home/machine/cron.log 2>&1"
CRONTAB_LINE_2="59 3 * * * curl -s -X POST http://localhost:5001/jobs/end-of-day-miss >> /home/machine/cron.log 2>&1"
CRONTAB_LINE_3="0 0 * * 1 curl -s -X POST http://localhost:5001/jobs/weekly-summary >> /home/machine/cron.log 2>&1"
CRONTAB_LINE_4="0 * * * * curl -s -X POST http://localhost:5001/jobs/build-progress-tick >> /home/machine/cron.log 2>&1"
(
  crontab -l 2>/dev/null | grep -v 'morning-reminder\|end-of-day\|weekly-summary\|build-progress' || true
  echo "$CRONTAB_LINE_1"
  echo "$CRONTAB_LINE_2"
  echo "$CRONTAB_LINE_3"
  echo "$CRONTAB_LINE_4"
) | crontab - 2>/dev/null || echo "[cron] WARNING: crontab unavailable"
echo "[cron] Entries installed."

# ── Health check ──────────────────────────────────────────────────────
sleep 4
HEALTH=$(curl -s http://localhost:5001/health 2>/dev/null || echo "not_ready")
echo "[health] $HEALTH"
echo "=== Backend Setup Complete ==="
