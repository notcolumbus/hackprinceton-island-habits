#!/usr/bin/env python3
"""
deploy_dedalus.py — One-command deploy of Island of Habits to Dedalus Machines.

Each service is deployed in two exec_cmd calls maximum:
  1. git clone (or pull)
  2. run apps/<service>/setup_machine.sh

This avoids the Dedalus exec-API instability that causes multi-call sequences to fail.

Usage:
    python3 deploy_dedalus.py                           # Deploy all three services
    python3 deploy_dedalus.py --service backend
    python3 deploy_dedalus.py --service agent
    python3 deploy_dedalus.py --service frontend
    python3 deploy_dedalus.py --status
    python3 deploy_dedalus.py --sleep
    python3 deploy_dedalus.py --wake
    python3 deploy_dedalus.py --logs [--service backend|agent|frontend]
    python3 deploy_dedalus.py --delete   # destroy all machines + clear state
"""

import argparse
import json
import os
import sys
import time

from dotenv import load_dotenv

load_dotenv()
load_dotenv("../agent/.env", override=False)  # picks up PHOTON_PROJECT_ID/SECRET

# ── Config ────────────────────────────────────────────────────────────

DEDALUS_API_KEY = os.getenv("DEDALUS_API_KEY", "")
if not DEDALUS_API_KEY:
    print("❌  DEDALUS_API_KEY not found in .env")
    sys.exit(1)

try:
    from dedalus_sdk import Dedalus
except ModuleNotFoundError:
    print("❌  dedalus_sdk not installed. Run:  pip install dedalus-sdk")
    sys.exit(1)

DCS_BASE_URL = os.getenv("DEDALUS_DCS_URL", "https://dcs.dedaluslabs.ai")

BACKEND_SPEC  = {"vcpu": 2, "memory_mib": 2048, "storage_gib": 10}
AGENT_SPEC    = {"vcpu": 1, "memory_mib": 1024, "storage_gib": 10}
FRONTEND_SPEC = {"vcpu": 2, "memory_mib": 2048, "storage_gib": 10}

REPO_URL    = "https://github.com/JzJoker/hackprinceton-island-habits.git"
REPO_BRANCH = "dedalus-deploy"   # setup_machine.sh scripts live on this branch

APP_DIR      = "/home/machine/app"
BACKEND_DIR  = f"{APP_DIR}/apps/backend"
AGENT_DIR    = f"{APP_DIR}/apps/agent"
FRONTEND_DIR = f"{APP_DIR}/apps/app"

STATE_FILE = ".dedalus_machines.json"

# Agent env vars — not committed to git, written to machine at deploy time.
AGENT_ENV = {
    "PHOTON_PROJECT_ID": os.getenv("PHOTON_PROJECT_ID", ""),
    "PHOTON_SECRET":     os.getenv("PHOTON_SECRET", ""),
    "projid":            os.getenv("PHOTON_PROJECT_ID", ""),
    "secret":            os.getenv("PHOTON_SECRET", ""),
    "CONVEX_URL":        os.getenv("CONVEX_URL", "https://befitting-mink-857.convex.cloud"),
    "BOT_PHONE":         os.getenv("BOT_PHONE", ""),
    "K2_API_KEY":        os.getenv("K2_API_KEY", ""),
    "K2_API_URL":        os.getenv("K2_API_URL", "https://api.k2think.ai/v1/chat/completions"),
    "K2_MODEL":          os.getenv("K2_MODEL", "MBZUAI-IFM/K2-Think-v2"),
    "CLERK_SECRET_KEY":  os.getenv("CLERK_SECRET_KEY", ""),
}


# ── Client ────────────────────────────────────────────────────────────

def get_client() -> Dedalus:
    return Dedalus(x_api_key=DEDALUS_API_KEY, base_url=DCS_BASE_URL)


# ── exec_cmd ─────────────────────────────────────────────────────────

def exec_cmd(
    client: Dedalus,
    machine_id: str,
    command: list[str],
    label: str = "",
    timeout: int = 600,
) -> str:
    if label:
        print(f"   ▸ {label}")

    exc = client.machines.executions.create(machine_id=machine_id, command=command)

    for _ in range(timeout):
        exc = client.machines.executions.retrieve(
            machine_id=machine_id, execution_id=exc.execution_id
        )
        if exc.status in ("succeeded", "failed"):
            break
        time.sleep(1)
    else:
        print(f"   ⚠️  Timed out after {timeout}s waiting for execution")
        return ""

    output = client.machines.executions.output(
        machine_id=machine_id, execution_id=exc.execution_id
    )

    stdout = output.stdout or ""
    stderr = output.stderr or ""

    if exc.status == "failed":
        print(f"   ❌  Command failed!")
        if stderr:
            print(f"      stderr: {stderr[:800]}")
        if stdout:
            print(f"      stdout: {stdout[:400]}")
        return ""

    return stdout


# ── Machine lifecycle ─────────────────────────────────────────────────

def wait_for_running(client: Dedalus, machine_id: str, timeout: int = 120):
    print(f"   ⏳  Waiting for {machine_id}...")
    for i in range(timeout):
        dm = client.machines.retrieve(machine_id=machine_id)
        if dm.status.phase == "running":
            print(f"   ✅  Running! (took ~{i}s) — pausing 8s for guest agent...")
            time.sleep(8)
            return
        if dm.status.phase in ("failed", "error"):
            print(f"   ❌  Machine entered '{dm.status.phase}'")
            sys.exit(1)
        time.sleep(1)
    print(f"   ❌  Timed out after {timeout}s")
    sys.exit(1)


def get_or_create_machine(client: Dedalus, spec: dict, label: str, saved_id: str = "") -> str:
    """Return a running machine: reuse saved_id if valid, otherwise create fresh."""
    if saved_id:
        try:
            dm = client.machines.retrieve(machine_id=saved_id)
            if dm.status.phase == "running":
                print(f"   ♻️  Reusing {label} machine: {saved_id}")
                return saved_id
            print(f"   ☀️  Waking {label} machine: {saved_id} (phase={dm.status.phase})...")
            client.machines.update(machine_id=saved_id, desired_state="running")
            wait_for_running(client, saved_id)
            return saved_id
        except Exception as e:
            print(f"   ⚠️  Saved machine {saved_id} unavailable ({e}) — creating new one")

    print(f"\n🚀  Creating '{label}' machine ({spec['vcpu']} vCPU, {spec['memory_mib']} MiB)...")
    dm = None
    for attempt in range(5):
        try:
            dm = client.machines.create(**spec)
            break
        except Exception as e:
            err = str(e)
            if "MACHINE_QUOTA_EXCEEDED" in err:
                print("   ❌  Quota exceeded! Run: python3 deploy_dedalus.py --delete")
                sys.exit(1)
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


def create_preview(client: Dedalus, machine_id: str, port: int) -> str:
    try:
        preview = client.machines.previews.create(machine_id=machine_id, port=port)
        print(f"   🔗  {preview.url}")
        return preview.url
    except Exception as e:
        print(f"   ⚠️  Preview failed: {e}")
        return ""


# ── State ─────────────────────────────────────────────────────────────

def load_state() -> dict:
    try:
        with open(STATE_FILE) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def save_state(updates: dict):
    state = load_state()
    state.update(updates)
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


# ── Clone ─────────────────────────────────────────────────────────────

def clone_repo(client: Dedalus, machine_id: str):
    """Clone the dedalus-deploy branch (which contains setup_machine.sh scripts)."""
    out = exec_cmd(client, machine_id, [
        "/bin/bash", "-c",
        # Validate existing repo; nuke if corrupt; clone or pull
        f"if [ -d {APP_DIR}/.git ]; then "
        f"  git -C {APP_DIR} rev-parse HEAD >/dev/null 2>&1 || rm -rf {APP_DIR}; "
        f"fi && "
        f"if [ -d {APP_DIR}/.git ]; then "
        f"  cd {APP_DIR} && git pull; "
        f"else "
        f"  git clone --branch {REPO_BRANCH} {REPO_URL} {APP_DIR}; "
        f"fi && echo OK",
    ], "Cloning repo (branch: dedalus-deploy)", timeout=120)
    if "OK" not in out:
        print("   ⚠️  Clone may have issues — continuing anyway")


# ── Write agent .env ──────────────────────────────────────────────────

def write_agent_env(client: Dedalus, machine_id: str, backend_url: str, app_base_url: str = ""):
    """Write apps/agent/.env to the machine (file is not in git)."""
    env = {
        **AGENT_ENV,
        "BACKEND_URL":  backend_url,
        "APP_BASE_URL": app_base_url or "http://localhost:3000",
    }
    lines = [f"{k}={v}" for k, v in env.items() if v]
    # Build a chained echo > file command
    parts = [f"echo '{lines[0]}' > {AGENT_DIR}/.env"]
    for line in lines[1:]:
        parts.append(f"echo '{line}' >> {AGENT_DIR}/.env")
    exec_cmd(client, machine_id, ["/bin/bash", "-c", " && ".join(parts)],
             "Writing agent .env", timeout=30)


# ── Deploy services ───────────────────────────────────────────────────

def deploy_backend(client: Dedalus, machine_id: str = "", agent_url: str = "") -> tuple[str, str]:
    machine_id = get_or_create_machine(client, BACKEND_SPEC, "island-habits-backend", machine_id)

    print("\n📦  Setting up backend...")

    clone_repo(client, machine_id)

    # Inject AGENT_URL if known (appended — dotenv uses last value)
    if agent_url:
        exec_cmd(client, machine_id, [
            "/bin/bash", "-c",
            f"echo 'AGENT_URL={agent_url}' >> {BACKEND_DIR}/.env && echo ok",
        ], f"Injecting AGENT_URL into .env", timeout=15)

    out = exec_cmd(client, machine_id, [
        "/bin/bash", "-c",
        f"chmod +x {BACKEND_DIR}/setup_machine.sh && "
        f"bash {BACKEND_DIR}/setup_machine.sh 2>&1",
    ], "Running setup_machine.sh", timeout=600)
    print(f"      {out[-1200:].strip()}" if out else "      (no output)")

    print("\n🌐  Creating preview URL (port 5001)...")
    preview_url = create_preview(client, machine_id, 5001)
    save_state({"backend": machine_id, "backend_url": preview_url})

    print(f"\n✅  Backend live: {preview_url}")
    return machine_id, preview_url


def deploy_agent(
    client: Dedalus,
    backend_url: str,
    app_base_url: str = "",
    machine_id: str = "",
) -> tuple[str, str]:
    machine_id = get_or_create_machine(client, AGENT_SPEC, "island-habits-agent", machine_id)

    print("\n📦  Setting up agent...")

    clone_repo(client, machine_id)
    write_agent_env(client, machine_id, backend_url, app_base_url)

    out = exec_cmd(client, machine_id, [
        "/bin/bash", "-c",
        f"chmod +x {AGENT_DIR}/setup_machine.sh && "
        f"BACKEND_URL={backend_url} "
        f"APP_BASE_URL={app_base_url or 'http://localhost:3000'} "
        f"bash {AGENT_DIR}/setup_machine.sh 2>&1",
    ], "Running setup_machine.sh", timeout=600)
    print(f"      {out[-1200:].strip()}" if out else "      (no output)")

    print("\n🌐  Creating preview URL (port 3001)...")
    preview_url = create_preview(client, machine_id, 3001)
    save_state({"agent": machine_id, "agent_url": preview_url})

    print(f"\n✅  Agent live: {preview_url}")
    return machine_id, preview_url


def deploy_frontend(
    client: Dedalus,
    backend_url: str,
    machine_id: str = "",
) -> tuple[str, str]:
    machine_id = get_or_create_machine(client, FRONTEND_SPEC, "island-habits-frontend", machine_id)

    print("\n📦  Setting up frontend...")

    clone_repo(client, machine_id)

    out = exec_cmd(client, machine_id, [
        "/bin/bash", "-c",
        f"chmod +x {FRONTEND_DIR}/setup_machine.sh && "
        f"VITE_BACKEND_URL={backend_url} "
        f"bash {FRONTEND_DIR}/setup_machine.sh 2>&1",
    ], "Running setup_machine.sh", timeout=600)
    print(f"      {out[-1200:].strip()}" if out else "      (no output)")

    print("\n🌐  Creating preview URL (port 3000)...")
    preview_url = create_preview(client, machine_id, 3000)
    save_state({"frontend": machine_id, "frontend_url": preview_url})

    print(f"\n✅  Frontend live: {preview_url}")
    return machine_id, preview_url


def patch_and_restart(client: Dedalus, machine_id: str, env_file: str,
                      key: str, value: str, kill_pattern: str, restart_cmd: str):
    """Append a key to .env and restart the process in one exec_cmd call."""
    exec_cmd(client, machine_id, [
        "/bin/bash", "-c",
        f"echo '{key}={value}' >> {env_file} && "
        f"pkill -f '{kill_pattern}' 2>/dev/null; sleep 2 && "
        f"{restart_cmd} && echo restarted",
    ], f"Patching {key} + restart", timeout=30)


# ── Lifecycle ─────────────────────────────────────────────────────────

def status_all(client: Dedalus):
    state = load_state()
    if not state:
        print("📋  No machines in state. Deploy first.")
        return
    for label in ("backend", "agent", "frontend"):
        mid = state.get(label)
        if not mid:
            continue
        try:
            dm = client.machines.retrieve(machine_id=mid)
            url = state.get(f"{label}_url", "—")
            print(f"   {label:10s}  {mid}  phase={dm.status.phase}")
            print(f"             url={url}")
        except Exception as e:
            print(f"   {label:10s}  {mid}  ❌ {e}")


def sleep_all(client: Dedalus):
    state = load_state()
    for label in ("backend", "agent", "frontend"):
        mid = state.get(label)
        if not mid:
            continue
        print(f"   💤  Sleeping {label} ({mid})...")
        try:
            client.machines.update(machine_id=mid, desired_state="sleeping")
            print(f"   ✅  Sleeping")
        except Exception as e:
            print(f"   ⚠️  {e}")


def wake_all(client: Dedalus):
    state = load_state()
    for label in ("backend", "agent", "frontend"):
        mid = state.get(label)
        if not mid:
            continue
        print(f"   ☀️  Waking {label} ({mid})...")
        try:
            client.machines.update(machine_id=mid, desired_state="running")
        except Exception as e:
            print(f"   ⚠️  {e}")
    for label in ("backend", "agent", "frontend"):
        mid = state.get(label)
        if mid:
            try:
                wait_for_running(client, mid)
            except SystemExit:
                pass


def delete_all(client: Dedalus):
    state = load_state()
    if not state:
        print("📋  No machines in state.")
        return
    for label in ("backend", "agent", "frontend"):
        mid = state.get(label)
        if not mid:
            continue
        print(f"   🗑️  Deleting {label} ({mid})...")
        try:
            client.machines.delete(machine_id=mid)
            print(f"   ✅  Deleted")
        except Exception as e:
            print(f"   ⚠️  {e}")
    with open(STATE_FILE, "w") as f:
        json.dump({}, f)
    print("   ✅  State cleared — ready for a fresh deploy")


def tail_logs(client: Dedalus, service: str = "backend"):
    state = load_state()
    machine_id = state.get(service)
    if not machine_id:
        print(f"❌  No {service} machine in state.")
        return
    log_map = {"backend": "/home/machine/backend.log",
               "agent":   "/home/machine/agent.log",
               "frontend":"/home/machine/frontend.log"}
    out = exec_cmd(client, machine_id,
                   ["/bin/bash", "-c", f"tail -80 {log_map[service]}"],
                   f"Tailing {log_map[service]}", timeout=30)
    print(out)


# ── Main ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Deploy Island of Habits to Dedalus Machines"
    )
    parser.add_argument("--service",
                        choices=["backend", "agent", "frontend", "all"], default="all")
    parser.add_argument("--backend-url",  help="Override saved backend URL")
    parser.add_argument("--agent-url",    help="Override saved agent URL")
    parser.add_argument("--frontend-url", help="Override saved frontend URL")
    parser.add_argument("--status",  action="store_true")
    parser.add_argument("--sleep",   action="store_true")
    parser.add_argument("--wake",    action="store_true")
    parser.add_argument("--logs",    action="store_true")
    parser.add_argument("--delete",  action="store_true",
                        help="Destroy all machines + clear state (frees quota)")
    args = parser.parse_args()

    print("🏝️  Island of Habits — Dedalus Deploy")
    print(f"   Key: {DEDALUS_API_KEY[:16]}...{DEDALUS_API_KEY[-4:]}")
    print(f"   DCS: {DCS_BASE_URL}")
    print()

    client = get_client()
    state  = load_state()

    if args.delete:
        delete_all(client)

    elif args.status:
        status_all(client)

    elif args.sleep:
        sleep_all(client)

    elif args.wake:
        wake_all(client)

    elif args.logs:
        svc = args.service if args.service != "all" else "backend"
        tail_logs(client, service=svc)

    else:
        if args.service == "backend":
            deploy_backend(client,
                           machine_id=state.get("backend", ""),
                           agent_url=args.agent_url or state.get("agent_url", ""))

        elif args.service == "agent":
            backend_url = args.backend_url or state.get("backend_url", "")
            if not backend_url:
                print("❌  --backend-url required")
                sys.exit(1)
            deploy_agent(client, backend_url=backend_url,
                         app_base_url=args.frontend_url or state.get("frontend_url", ""),
                         machine_id=state.get("agent", ""))

        elif args.service == "frontend":
            backend_url = args.backend_url or state.get("backend_url", "")
            if not backend_url:
                print("❌  --backend-url required")
                sys.exit(1)
            deploy_frontend(client, backend_url=backend_url,
                            machine_id=state.get("frontend", ""))

        else:
            # Full deploy — reuse saved machines, handle circular dependency
            backend_mid, backend_url = deploy_backend(client,
                                                       machine_id=state.get("backend", ""))

            agent_mid, agent_url = deploy_agent(client, backend_url=backend_url,
                                                 machine_id=state.get("agent", ""))

            frontend_mid, frontend_url = deploy_frontend(client, backend_url=backend_url,
                                                          machine_id=state.get("frontend", ""))

            # Patch backend with agent URL now that we know it
            print(f"\n🔧  Patching backend AGENT_URL → {agent_url}")
            NODE_BIN = "/home/machine/node-v20.18.0-linux-x64/bin"
            CPYTHON  = "/home/machine/python/bin/python3"
            patch_and_restart(
                client, backend_mid,
                env_file=f"{BACKEND_DIR}/.env",
                key="AGENT_URL", value=agent_url,
                kill_pattern="app.py",
                restart_cmd=(
                    f"cd {BACKEND_DIR} && "
                    f"(command -v python3 >/dev/null 2>&1 && PYTHON=python3 || PYTHON={CPYTHON}) && "
                    f"setsid $PYTHON app.py > /home/machine/backend.log 2>&1 &"
                ),
            )

            # Patch agent with frontend URL
            print(f"\n🔧  Patching agent APP_BASE_URL → {frontend_url}")
            patch_and_restart(
                client, agent_mid,
                env_file=f"{AGENT_DIR}/.env",
                key="APP_BASE_URL", value=frontend_url,
                kill_pattern="tsx src/index.ts",
                restart_cmd=(
                    f"export PATH={NODE_BIN}:$PATH && "
                    f"cd {AGENT_DIR} && "
                    f"setsid npx tsx src/index.ts > /home/machine/agent.log 2>&1 &"
                ),
            )

            print(f"\n{'=' * 60}")
            print("🎉  Island of Habits is live!")
            print(f"   🌐  Frontend: {frontend_url}")
            print(f"   🔧  Backend:  {backend_url}")
            print(f"   🤖  Agent:    {agent_url}")
            print()
            print("   python3 deploy_dedalus.py --status")
            print("   python3 deploy_dedalus.py --sleep   # save credits")
            print("   python3 deploy_dedalus.py --wake    # before judging")
            print(f"{'=' * 60}")

    print("\n🏁  Done!")


if __name__ == "__main__":
    main()
