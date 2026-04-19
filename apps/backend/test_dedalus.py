#!/usr/bin/env python3
"""
test_dedalus.py — Validate Dedalus Labs API key and basic machine ops.

Usage:
    python3 test_dedalus.py             # Create machine, run command, clean up
    python3 test_dedalus.py --keep      # Create machine and keep it running
    python3 test_dedalus.py --list      # List existing machines
"""

import argparse
import os
import sys
import time

from dotenv import load_dotenv

load_dotenv()

DEDALUS_API_KEY = os.getenv("DEDALUS_API_KEY", "")

if not DEDALUS_API_KEY:
    print("❌  DEDALUS_API_KEY not found. Set it in apps/backend/.env")
    sys.exit(1)

try:
    from dedalus_sdk import Dedalus  # noqa: E402
except ModuleNotFoundError:
    print("❌  dedalus_sdk not installed. Run:  pip install dedalus-sdk")
    sys.exit(1)

# DCS endpoint — production for dsk-live keys, dev for dsk-test keys
# Production is intermittently 503 (sponsor confirmed, being fixed)
DCS_BASE_URL = os.getenv("DEDALUS_DCS_URL", "https://dev.dcs.dedaluslabs.ai")


def get_client() -> Dedalus:
    """Create Dedalus client with correct DCS base URL and x-api-key auth."""
    return Dedalus(
        x_api_key=DEDALUS_API_KEY,
        base_url=DCS_BASE_URL,
    )


def list_machines(client: Dedalus):
    """List all existing machines."""
    print("📋  Listing machines...")
    try:
        machines = client.machines.list()
        found = False
        for m in machines:
            found = True
            print(f"   • {m.machine_id}  status={m.status.phase}  vcpu={m.vcpu}  mem={m.memory_mib}MiB")
        if not found:
            print("   (no machines)")
    except Exception as e:
        _handle_api_error(e)


def _handle_api_error(e: Exception):
    """Display a friendly error for common Dedalus API failures."""
    err_str = str(e)
    if "503" in err_str:
        print("   ⚠️  Dedalus API returned 503 — their service is temporarily unavailable.")
        print("   This is on their end, not yours. Try again in a few minutes.")
    elif "AUTH_INVALID" in err_str or "invalid" in err_str.lower():
        print("   ❌  API key is invalid for DCS Machines.")
        print("   Your key may only work for the Chat Completions API (api.dedaluslabs.ai).")
        print("   You need a DCS-specific key from https://dev.dcs.dedaluslabs.ai")
    elif "401" in err_str or "403" in err_str:
        print(f"   ❌  Authentication failed. Check your DEDALUS_API_KEY in .env")
    elif "credit" in err_str.lower() or "balance" in err_str.lower():
        print("   ❌  Out of credits. Claim credits at https://dedaluslabs.ai/dashboard/billing")
    else:
        print(f"   ❌  API error: {type(e).__name__}: {err_str[:200]}")


def _create_machine_with_retry(client: Dedalus):
    dm = None
    for attempt in range(5):
        try:
            dm = client.machines.create(vcpu=1, memory_mib=1024, storage_gib=10)
            break
        except Exception as e:
            err_str = str(e)
            if "AUTH_INVALID" in err_str:
                print("   ❌  API key is invalid for DCS Machines.")
                print("   Your key may only work for the Chat Completions API.")
                print("   Talk to the Dedalus sponsors for a DCS-specific key.")
                sys.exit(1)
            wait = 2 ** attempt
            print(f"   ⚠️  Attempt {attempt + 1} failed: {type(e).__name__}. Retrying in {wait}s...")
            time.sleep(wait)
    if dm is None:
        print("   ❌  Failed to create machine after 5 attempts")
        sys.exit(1)
    return dm


def _wait_until_running(client: Dedalus, machine_id: str):
    print("⏳  Waiting for machine to reach 'running' state...")
    for i in range(60):
        dm = client.machines.retrieve(machine_id=machine_id)
        phase = dm.status.phase
        if phase == "running":
            print(f"   ✅  Machine is running! (took ~{i}s)")
            return
        if phase in ("failed", "error"):
            print(f"   ❌  Machine entered '{phase}' state")
            sys.exit(1)
        time.sleep(1)
    print("   ❌  Timed out waiting for machine to start")
    sys.exit(1)


def _run_smoke_execution(client: Dedalus, machine_id: str):
    print("\n📡  Running 'whoami && uname -a' on the machine...")
    execution = client.machines.executions.create(
        machine_id=machine_id,
        command=["/bin/bash", "-c", "whoami && uname -a && echo '---' && free -h && df -h /home/machine"],
    )
    execution_id = execution.execution_id
    print(f"   Execution ID: {execution_id}")

    for _ in range(30):
        execution = client.machines.executions.retrieve(
            machine_id=machine_id,
            execution_id=execution_id,
        )
        if execution.status in ("succeeded", "failed"):
            break
        time.sleep(0.5)

    output = client.machines.executions.output(
        machine_id=machine_id,
        execution_id=execution_id,
    )
    print(f"\n   Status: {execution.status}")
    print(f"   stdout:\n{output.stdout}")
    if output.stderr:
        print(f"   stderr:\n{output.stderr}")


def _finalize_machine(client: Dedalus, machine_id: str, keep: bool):
    if keep:
        print(f"\n🏝️  Machine {machine_id} is running. Use it for deployment!")
        return
    print(f"\n🧹  Sleeping machine {machine_id} to save credits...")
    client.machines.update(machine_id=machine_id, desired_state="sleeping")
    print("   ✅  Machine is sleeping (filesystem persisted, no compute charges)")


def create_and_test(client: Dedalus, keep: bool):
    """Create a machine, run whoami, optionally clean up."""
    print("🚀  Creating Dedalus Machine (1 vCPU, 1024 MiB RAM, 10 GiB disk)...")
    print(f"   Base URL: {DCS_BASE_URL}")
    dm = _create_machine_with_retry(client)
    machine_id = dm.machine_id
    print(f"   Machine ID: {machine_id}")

    _wait_until_running(client, machine_id)

    # Wait for guest agent to initialize (per openclaw reference)
    print("   ⏳  Waiting 5s for guest agent...")
    time.sleep(5)

    _run_smoke_execution(client, machine_id)
    _finalize_machine(client, machine_id, keep)

    return machine_id


def main():
    parser = argparse.ArgumentParser(description="Test Dedalus Labs connectivity")
    parser.add_argument("--keep", action="store_true", help="Keep the machine running after test")
    parser.add_argument("--list", action="store_true", help="List existing machines")
    args = parser.parse_args()

    print("🔬  Dedalus Labs — Connectivity Test")
    print(f"   API Key: {DEDALUS_API_KEY[:12]}...{DEDALUS_API_KEY[-4:]}")
    print(f"   DCS URL: {DCS_BASE_URL}")
    print()

    client = get_client()

    if args.list:
        list_machines(client)
    else:
        create_and_test(client, keep=args.keep)

    print("\n🏁  Done!")


if __name__ == "__main__":
    main()
