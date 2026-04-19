import os
import requests

AGENT_URL = os.environ.get("AGENT_URL", "http://localhost:3001")


def send_message(phone: str, message: str) -> None:
    try:
        resp = requests.post(
            f"{AGENT_URL}/send",
            headers={"Content-Type": "application/json"},
            json={"to": phone, "message": message},
            timeout=30,
        )
        resp.raise_for_status()
        print(f"[photon] sent to {phone} ({resp.status_code})")
    except requests.exceptions.ConnectionError:
        print(f"[photon] ERROR: agent bot not reachable at {AGENT_URL} — is it running?")
        raise
    except Exception as e:
        print(f"[photon] send_message failed for {phone}: {e}")
        raise


def send_group_message(phones: list[str], message: str) -> None:
    try:
        resp = requests.post(
            f"{AGENT_URL}/send-group",
            headers={"Content-Type": "application/json"},
            json={"participants": phones, "message": message},
            timeout=30,
        )
        resp.raise_for_status()
        print(f"[photon] sent group to {len(phones)} phones ({resp.status_code})")
    except requests.exceptions.ConnectionError:
        print(f"[photon] ERROR: agent bot not reachable at {AGENT_URL} — is it running?")
        raise
    except Exception as e:
        print(f"[photon] send_group_message failed: {e}")
        raise


def send_island_message(island_id: str, message: str) -> None:
    """Send a group iMessage scoped to a specific island.

    The agent bot resolves islandId → participants via Convex, so callers
    don't need to pass phone numbers. This avoids the ambiguity of
    `im.space(...phones)` when the same set of phones maps to multiple
    islands (e.g. two test islands created by the same trio).
    """
    try:
        resp = requests.post(
            f"{AGENT_URL}/send-island",
            headers={"Content-Type": "application/json"},
            json={"islandId": island_id, "message": message},
            timeout=30,
        )
        resp.raise_for_status()
        print(f"[photon] sent to island {island_id} ({resp.status_code})")
    except requests.exceptions.ConnectionError:
        print(f"[photon] ERROR: agent bot not reachable at {AGENT_URL} — is it running?")
        raise
    except Exception as e:
        print(f"[photon] send_island_message failed for {island_id}: {e}")
        raise
