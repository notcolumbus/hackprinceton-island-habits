"""Debug endpoints to verify pipeline tier-by-tier.

Use these from a browser / curl to isolate which layer is broken:
- /jobs/test-k2        → only hit K2, skip DB + Photon
- /jobs/test-photon    → only hit Photon, skip K2
- /jobs/test-pipeline  → full flow end-to-end, short-circuited to 1 target
"""

from flask import jsonify, request

from jobs import jobs_bp
from jobs.convex_client import get_client
from jobs.k2 import generate_morning_reminder
from jobs.photon import send_message, send_island_message


DEMO_PERSONALITY = {
    "personality_type": "Cheerful Motivator",
    "tone": "warm and brief",
    "quirks": ["one sentence max"],
}


@jobs_bp.post("/test-k2")
def test_k2():
    """Call K2 with hard-coded input. Returns the raw message.

    Usage: curl -X POST <backend>/jobs/test-k2
    If K2 credentials are wrong, this fails loudly (not silently swallowed).
    """
    try:
        message, reasoning = generate_morning_reminder(
            DEMO_PERSONALITY,
            ["Drink 2L water", "Read 15 pages"],
            miss_streak=0,
            team_recap="Yesterday An hit their goals. Long missed theirs.",
        )
        return jsonify({
            "ok": True,
            "message": message,
            "reasoning_preview": (reasoning or "")[:200],
        })
    except Exception as exc:
        print(f"[test-k2] FAILED: {exc}")
        return jsonify({"ok": False, "error": str(exc)}), 500


@jobs_bp.post("/test-photon")
def test_photon():
    """Send a fixed message to a phone. Bypasses K2.

    Usage:
      curl -X POST -H 'Content-Type: application/json' \
           -d '{"to":"+15555551234"}' <backend>/jobs/test-photon

    Or supply islandId to test /send-island end-of-pipe:
      -d '{"islandId":"k170..."}'
    """
    body = request.get_json(silent=True) or {}
    message = body.get("message") or "🧪 Test message from /jobs/test-photon"
    try:
        if body.get("islandId"):
            send_island_message(body["islandId"], message)
            return jsonify({"ok": True, "mode": "island", "islandId": body["islandId"]})
        if body.get("to"):
            send_message(body["to"], message)
            return jsonify({"ok": True, "mode": "direct", "to": body["to"]})
        return jsonify({"ok": False, "error": "Provide 'to' or 'islandId'"}), 400
    except Exception as exc:
        print(f"[test-photon] FAILED: {exc}")
        return jsonify({"ok": False, "error": str(exc)}), 500


@jobs_bp.post("/test-pipeline")
def test_pipeline():
    """End-to-end: first member found → K2 call → Photon send. Use for demo.

    Usage: curl -X POST <backend>/jobs/test-pipeline
    """
    try:
        db = get_client()
        members = db.query("jobQueries:getActiveMembersWithGoals")
        if not members:
            return jsonify({"ok": False, "error": "No active members with goals found"}), 404

        entry = members[0]
        phone = entry["phoneNumber"]
        goals = [g["text"] for g in entry["goals"]]
        print(f"[test-pipeline] target={phone} goals={goals}")

        message, reasoning = generate_morning_reminder(
            entry["agent"].get("personalityProfile") or DEMO_PERSONALITY,
            goals,
            miss_streak=0,
            team_recap="",
        )
        print(f"[test-pipeline] K2 → {message[:80]}")

        send_message(phone, message)
        return jsonify({
            "ok": True,
            "sent_to": phone,
            "message": message,
            "reasoning_preview": (reasoning or "")[:200],
        })
    except Exception as exc:
        print(f"[test-pipeline] FAILED: {exc}")
        return jsonify({"ok": False, "error": str(exc)}), 500
