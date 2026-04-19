#!/usr/bin/env python3
"""
deploy_dedalus.py — Deploy Island of Habits backend to a Dedalus Machine.

This script provisions a persistent Dedalus Machine and deploys the Flask
backend + cron scheduler onto it.

Usage:
    python3 deploy_dedalus.py                     # Full fresh deploy
    python3 deploy_dedalus.py --machine dm-xxx    # Redeploy to existing machine
    python3 deploy_dedalus.py --status            # Check machine status
    python3 deploy_dedalus.py --sleep             # Sleep all island machines
    python3 deploy_dedalus.py --wake              # Wake all island machines
    python3 deploy_dedalus.py --logs              # Tail backend logs

Environment:
    Reads all config from .env (loaded automatically).
"""

import argparse
import json
import os
import sys
import time

from dotenv import load_dotenv

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────

DEDALUS_API_KEY = os.getenv("DEDALUS_API_KEY", "")
if not DEDALUS_API_KEY:
    print("❌  DEDALUS_API_KEY not found in .env")
    sys.exit(1)

try:
    from dedalus_sdk import Dedalus  # noqa: E402
except ModuleNotFoundError:
    print("❌  dedalus_sdk not installed. Run:  pip install dedalus-sdk")
    sys.exit(1)

# DCS endpoint — production for dsk-live keys, dev for dsk-test keys
DCS_BASE_URL = os.getenv("DEDALUS_DCS_URL", "https://dcs.dedaluslabs.ai")

def get_client() -> Dedalus:
    """Create Dedalus client with correct DCS base URL and x-api-key auth."""
    return Dedalus(
        x_api_key=DEDALUS_API_KEY,
        base_url=DCS_BASE_URL,
    )

# Machine specs (fits comfortably in free tier)
BACKEND_SPEC = {"vcpu": 2, "memory_mib": 2048, "storage_gib": 10}
AGENT_SPEC = {"vcpu": 1, "memory_mib": 1024, "storage_gib": 10}

# Tags used to identify our machines
BACKEND_TAG = "island-habits-backend"
AGENT_TAG = "island-habits-agent"

# Repo and branch to deploy
REPO_URL = "https://github.com/notcolumbus/hackprinceton-island-habits.git"
DEPLOY_GIT_REF = os.getenv("DEPLOY_GIT_REF", "feature/resources")

# Path inside the Dedalus Machine
APP_DIR = "/home/machine/app"
BACKEND_DIR = f"{APP_DIR}/apps/backend"
AGENT_DIR = f"{APP_DIR}/apps/agent"

# Environment variables to inject (read from local .env)
ENV_VARS = {
    "KNOT_ENVIRONMENT": os.getenv("KNOT_ENVIRONMENT", "production"),
    "KNOT_CLIENT_ID": os.getenv("KNOT_CLIENT_ID", ""),
    "KNOT_SECRET": os.getenv("KNOT_SECRET", ""),
    "CONVEX_URL": os.getenv("CONVEX_URL", "https://tidy-vole-519.convex.cloud"),
    "K2_API_KEY": os.getenv("K2_API_KEY", ""),
    "K2_API_URL": os.getenv("K2_API_URL", "https://api.k2think.ai/v1/chat/completions"),
    "K2_MODEL": os.getenv("K2_MODEL", "MBZUAI-IFM/K2-Think-v2"),
    "DEDALUS_API_KEY": DEDALUS_API_KEY,
}


# ── Helpers ───────────────────────────────────────────────────────────

def exec_cmd(client: Dedalus, machine_id: str, command: list[str], label: str = "") -> str:
    """Run a command on a Dedalus Machine and return stdout."""
    if label:
        print(f"   ▸ {label}")

    exc = client.machines.executions.create(
        machine_id=machine_id,
        command=command,
    )

    # Poll for completion
    for _ in range(120):
        exc = client.machines.executions.retrieve(
            machine_id=machine_id,
            execution_id=exc.execution_id,
        )
        if exc.status in ("succeeded", "failed"):
            break
        time.sleep(1)

    output = client.machines.executions.output(
        machine_id=machine_id,
        execution_id=exc.execution_id,
    )

    if exc.status == "failed":
        print(f"   ❌  Command failed!")
        if output.stderr:
            print(f"      stderr: {output.stderr[:500]}")
        return ""

    return output.stdout or ""


def wait_for_running(client: Dedalus, machine_id: str, timeout: int = 120):
    """Block until machine reaches 'running' state."""
    print(f"   ⏳  Waiting for {machine_id} to start...")
    for i in range(timeout):
        dm = client.machines.retrieve(machine_id=machine_id)
        if dm.status.phase == "running":
            print(f"   ✅  Running! (took ~{i}s)")
            return dm
        if dm.status.phase in ("failed", "error"):
            print(f"   ❌  Machine entered '{dm.status.phase}'")
            sys.exit(1)
        time.sleep(1)
    print(f"   ❌  Timed out after {timeout}s")
    sys.exit(1)


def create_machine(client: Dedalus, spec: dict, label: str) -> str:
    """Create a new Dedalus Machine with retry."""
    print(f"\n🚀  Creating '{label}' machine ({spec['vcpu']} vCPU, {spec['memory_mib']} MiB)...")
    dm = None
    for attempt in range(5):
        try:
            dm = client.machines.create(**spec)
            break
        except Exception as e:
            wait = 2 ** attempt
            print(f"   ⚠️  Attempt {attempt + 1}: {type(e).__name__}. Retrying in {wait}s...")
            time.sleep(wait)
    if dm is None:
        print("   ❌  Failed to create machine")
        sys.exit(1)

    machine_id = dm.machine_id
    print(f"   Machine ID: {machine_id}")

    wait_for_running(client, machine_id)
    return machine_id


def write_env_file(client: Dedalus, machine_id: str, target_dir: str, env_vars: dict):
    """Write .env file onto the machine using echo (heredocs don't work in DCS exec API)."""
    lines = [f"{k}={v}" for k, v in env_vars.items() if v]
    # Build a chain of echo commands
    cmd_parts = [f"echo '{lines[0]}' > {target_dir}/.env"]
    for line in lines[1:]:
        cmd_parts.append(f"echo '{line}' >> {target_dir}/.env")
    cmd = " && ".join(cmd_parts)
    exec_cmd(client, machine_id, ["/bin/bash", "-c", cmd], "Writing .env file")


# ── Deploy Backend ────────────────────────────────────────────────────

def deploy_backend(client: Dedalus, machine_id: str = None):
    """Deploy Flask backend + cron to a Dedalus Machine."""
    if not machine_id:
        machine_id = create_machine(client, BACKEND_SPEC, BACKEND_TAG)
    else:
        print(f"\n♻️  Redeploying to existing machine: {machine_id}")
        # Wake if sleeping
        try:
            client.machines.update(machine_id=machine_id, desired_state="running")
        except Exception:
            pass
        wait_for_running(client, machine_id)

    print("\n📦  Setting up backend environment...")

    # Install system dependencies
    exec_cmd(client, machine_id, [
        "/bin/bash", "-c",
        "apt-get update -qq && apt-get install -y -qq python3-pip python3-venv git curl cron > /dev/null 2>&1"
    ], "Installing system packages (python3, git, curl, cron)")

    # Clone or update repo at the configured branch/ref.
    exec_cmd(client, machine_id, [
        "/bin/bash", "-c",
        (
            f"if [ -d {APP_DIR}/.git ]; then "
            f"cd {APP_DIR} && git fetch origin && git checkout {DEPLOY_GIT_REF} && git pull origin {DEPLOY_GIT_REF}; "
            f"else "
            f"git clone --branch {DEPLOY_GIT_REF} {REPO_URL} {APP_DIR}; "
            f"fi"
        )
    ], f"Cloning/updating repo from {REPO_URL} ({DEPLOY_GIT_REF})")

    # Install Python dependencies
    exec_cmd(client, machine_id, [
        "/bin/bash", "-c",
        f"cd {BACKEND_DIR} && pip3 install -r requirements.txt -q"
    ], "Installing Python dependencies")

    # Write .env
    write_env_file(client, machine_id, BACKEND_DIR, ENV_VARS)

    # Kill any existing Flask process
    exec_cmd(client, machine_id, [
        "/bin/bash", "-c",
        "pkill -f 'python3 app.py' 2>/dev/null || true"
    ], "Stopping previous Flask process (if any)")

    # Write startup script (persists across sleep/wake)
    exec_cmd(client, machine_id, [
        "/bin/bash", "-c",
        f"echo '#!/bin/bash' > {BACKEND_DIR}/start.sh && "
        f"echo 'cd {BACKEND_DIR}' >> {BACKEND_DIR}/start.sh && "
        f"echo 'exec python3 app.py > /tmp/backend.log 2>&1' >> {BACKEND_DIR}/start.sh && "
        f"chmod +x {BACKEND_DIR}/start.sh"
    ], "Writing startup script")

    # Start Flask server (setsid for reliable detach through exec API)
    exec_cmd(client, machine_id, [
        "/bin/bash", "-c",
        f"setsid {BACKEND_DIR}/start.sh </dev/null &>/dev/null & disown && sleep 3 && echo 'launched'"
    ], "Starting Flask server on port 5001")

    # Verify Flask is running
    time.sleep(2)
    health = exec_cmd(client, machine_id, [
        "/bin/bash", "-c",
        "curl -s http://localhost:5001/health || echo 'HEALTH_CHECK_FAILED'"
    ], "Health check")

    if "HEALTH_CHECK_FAILED" in health:
        print("   ⚠️  Flask might still be starting. Check logs with --logs")
    else:
        print(f"   🩺  Health: {health.strip()}")

    # Setup cron jobs
    print("\n⏰  Setting up cron scheduler...")
    cron_entries = (
        f"# Island of Habits cron jobs (times in UTC)\n"
        f"0 12 * * * curl -s -X POST http://localhost:5001/jobs/morning-reminder >> /tmp/cron.log 2>&1\n"
        f"59 3 * * * curl -s -X POST http://localhost:5001/jobs/end-of-day-miss >> /tmp/cron.log 2>&1\n"
        f"0 0 * * 1 curl -s -X POST http://localhost:5001/jobs/weekly-summary >> /tmp/cron.log 2>&1\n"
        f"0 * * * * curl -s -X POST http://localhost:5001/jobs/build-progress-tick >> /tmp/cron.log 2>&1\n"
    )
    exec_cmd(client, machine_id, [
        "/bin/bash", "-c",
        f"echo '{cron_entries}' | crontab - && service cron start 2>/dev/null || cron"
    ], "Installing crontab entries and starting cron daemon")

    # Verify cron
    crontab_out = exec_cmd(client, machine_id, [
        "/bin/bash", "-c", "crontab -l"
    ], "Verifying crontab")
    print(f"\n   📅  Active crontab:\n{crontab_out}")

    # Create preview URL
    print("\n🌐  Creating preview URL for port 5001...")
    try:
        preview = client.machines.previews.create(
            machine_id=machine_id,
            port=5001,
        )
        print(f"   🔗  Preview URL: {preview.url}")
    except Exception as e:
        print(f"   ⚠️  Preview creation failed: {e}")
        print("   (You can still access the backend via SSH or the Dedalus dashboard)")

    print(f"\n{'=' * 60}")
    print(f"✅  Backend deployed to Dedalus Machine: {machine_id}")
    print(f"   Flask API:  http://localhost:5001 (inside VM)")
    print(f"   Cron jobs:  4 scheduled tasks running")
    print(f"   Logs:       python3 deploy_dedalus.py --logs --machine {machine_id}")
    print(f"   Sleep:      python3 deploy_dedalus.py --sleep")
    print(f"{'=' * 60}")

    # Save machine ID for later use
    with open(".dedalus_machines.json", "w") as f:
        existing = {}
        try:
            with open(".dedalus_machines.json", "r") as r:
                existing = json.load(r)
        except (FileNotFoundError, json.JSONDecodeError):
            pass
        existing["backend"] = machine_id
        json.dump(existing, f, indent=2)

    return machine_id


# ── Deploy Agent ──────────────────────────────────────────────────────

def deploy_agent(client: Dedalus, machine_id: str = None):
    """Deploy the Node.js Photon agent to a Dedalus Machine."""
    if not machine_id:
        machine_id = create_machine(client, AGENT_SPEC, AGENT_TAG)
    else:
        print(f"\n♻️  Redeploying agent to existing machine: {machine_id}")
        try:
            client.machines.update(machine_id=machine_id, desired_state="running")
        except Exception:
            pass
        wait_for_running(client, machine_id)

    print("\n📦  Setting up agent environment...")

    # Install system dependencies
    exec_cmd(client, machine_id, [
        "/bin/bash", "-c",
        "apt-get update -qq && apt-get install -y -qq git curl > /dev/null 2>&1"
    ], "Installing system packages")

    # Install Node.js (v20 LTS)
    exec_cmd(client, machine_id, [
        "/bin/bash", "-c",
        "curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y -qq nodejs > /dev/null 2>&1"
    ], "Installing Node.js 20 LTS")

    # Clone or update repo at the configured branch/ref.
    exec_cmd(client, machine_id, [
        "/bin/bash", "-c",
        (
            f"if [ -d {APP_DIR}/.git ]; then "
            f"cd {APP_DIR} && git fetch origin && git checkout {DEPLOY_GIT_REF} && git pull origin {DEPLOY_GIT_REF}; "
            f"else "
            f"git clone --branch {DEPLOY_GIT_REF} {REPO_URL} {APP_DIR}; "
            f"fi"
        )
    ], f"Cloning/updating repo ({DEPLOY_GIT_REF})")

    # Install npm dependencies
    exec_cmd(client, machine_id, [
        "/bin/bash", "-c",
        f"cd {APP_DIR} && npm install --workspace=apps/agent"
    ], "Installing npm dependencies")

    # Write .env for agent
    agent_env = {
        "CONVEX_URL": ENV_VARS["CONVEX_URL"],
        "K2_API_KEY": ENV_VARS["K2_API_KEY"],
        "K2_API_URL": ENV_VARS["K2_API_URL"],
        "K2_MODEL": ENV_VARS["K2_MODEL"],
    }
    write_env_file(client, machine_id, AGENT_DIR, agent_env)

    # Kill any existing agent process
    exec_cmd(client, machine_id, [
        "/bin/bash", "-c",
        "pkill -f 'tsx src/index.ts' 2>/dev/null || true"
    ], "Stopping previous agent process (if any)")

    # Start agent (setsid for reliable detach through exec API)
    exec_cmd(client, machine_id, [
        "/bin/bash", "-c",
        f"echo '#!/bin/bash' > {AGENT_DIR}/start.sh && "
        f"echo 'cd {AGENT_DIR}' >> {AGENT_DIR}/start.sh && "
        f"echo 'exec npx tsx src/index.ts > /tmp/agent.log 2>&1' >> {AGENT_DIR}/start.sh && "
        f"chmod +x {AGENT_DIR}/start.sh && "
        f"setsid {AGENT_DIR}/start.sh </dev/null &>/dev/null & disown && sleep 3 && echo 'launched'"
    ], "Starting Photon agent on port 3001")

    print(f"\n{'=' * 60}")
    print(f"✅  Agent deployed to Dedalus Machine: {machine_id}")
    print(f"   Agent:  http://localhost:3001 (inside VM)")
    print(f"{'=' * 60}")

    # Save machine ID
    try:
        with open(".dedalus_machines.json", "r") as f:
            existing = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        existing = {}
    existing["agent"] = machine_id
    with open(".dedalus_machines.json", "w") as f:
        json.dump(existing, f, indent=2)

    return machine_id


# ── Lifecycle Commands ────────────────────────────────────────────────

def get_saved_machines() -> dict:
    """Read machine IDs from local state file."""
    try:
        with open(".dedalus_machines.json", "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def status_all(client: Dedalus):
    """Show status of all island machines."""
    machines = get_saved_machines()
    if not machines:
        print("📋  No deployed machines found. Run deploy first.")
        return
    for label, mid in machines.items():
        try:
            dm = client.machines.retrieve(machine_id=mid)
            print(f"   {label:10s}  {mid}  status={dm.status.phase}  vcpu={dm.vcpu}  mem={dm.memory_mib}MiB")
        except Exception as e:
            print(f"   {label:10s}  {mid}  ❌ {e}")


def sleep_all(client: Dedalus):
    """Sleep all island machines to save credits."""
    machines = get_saved_machines()
    for label, mid in machines.items():
        print(f"   💤  Sleeping {label} ({mid})...")
        try:
            client.machines.update(machine_id=mid, desired_state="sleeping")
            print(f"   ✅  {label} is sleeping")
        except Exception as e:
            print(f"   ⚠️  {e}")


def wake_all(client: Dedalus):
    """Wake all island machines."""
    machines = get_saved_machines()
    for label, mid in machines.items():
        print(f"   ☀️  Waking {label} ({mid})...")
        try:
            client.machines.update(machine_id=mid, desired_state="running")
        except Exception as e:
            print(f"   ⚠️  {e}")
    # Wait for all to be running
    for label, mid in machines.items():
        wait_for_running(client, mid)


def tail_logs(client: Dedalus, machine_id: str = None, service: str = "backend"):
    """Tail logs from a Dedalus Machine."""
    machines = get_saved_machines()
    if not machine_id:
        machine_id = machines.get(service)
    if not machine_id:
        print(f"❌  No {service} machine found. Deploy first.")
        return

    log_file = "/tmp/backend.log" if service == "backend" else "/tmp/agent.log"
    output = exec_cmd(client, machine_id, [
        "/bin/bash", "-c", f"tail -100 {log_file}"
    ], f"Tailing {log_file}")
    print(output)


# ── Main ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Deploy Island of Habits to Dedalus Labs")
    parser.add_argument("--machine", "-m", help="Existing machine ID to redeploy to")
    parser.add_argument("--status", action="store_true", help="Show machine status")
    parser.add_argument("--sleep", action="store_true", help="Sleep all machines")
    parser.add_argument("--wake", action="store_true", help="Wake all machines")
    parser.add_argument("--logs", action="store_true", help="Tail logs")
    parser.add_argument("--service", choices=["backend", "agent", "all"], default="all",
                        help="Which service to deploy/manage (default: all)")
    args = parser.parse_args()

    print("🏝️  Island of Habits — Dedalus Deployment")
    print(f"   API Key: {DEDALUS_API_KEY[:12]}...{DEDALUS_API_KEY[-4:]}")
    print(f"   DCS URL: {DCS_BASE_URL}")
    print()

    client = get_client()

    if args.status:
        status_all(client)
    elif args.sleep:
        sleep_all(client)
    elif args.wake:
        wake_all(client)
    elif args.logs:
        tail_logs(client, machine_id=args.machine, service=args.service if args.service != "all" else "backend")
    else:
        # Deploy
        if args.service in ("backend", "all"):
            backend_mid = args.machine if args.service == "backend" else None
            deploy_backend(client, machine_id=backend_mid)

        if args.service in ("agent", "all"):
            agent_mid = args.machine if args.service == "agent" else None
            deploy_agent(client, machine_id=agent_mid)

    print("\n🏁  Done!")


if __name__ == "__main__":
    main()
