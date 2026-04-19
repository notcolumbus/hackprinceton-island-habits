from datetime import datetime, timedelta, timezone

from flask import jsonify

from jobs import jobs_bp
from jobs.convex_client import get_client
from jobs.k2 import generate_group_morning_reminder
from jobs.photon import send_island_message


@jobs_bp.get("/debug-members")
def debug_members():
    db = get_client()
    result = db.query("jobQueries:debugMemberPipeline")
    return jsonify(result)


def _format_name_list(rows: list, key: str) -> str:
    """Join ["Hùng", "An"] → "Hùng and An"; ["A","B","C"] → "A, B, and C"."""
    names = [r.get("displayName") or r.get("phone") for r in rows if r.get(key, 0) > 0]
    if not names:
        return ""
    if len(names) == 1:
        return names[0]
    if len(names) == 2:
        return f"{names[0]} and {names[1]}"
    return ", ".join(names[:-1]) + f", and {names[-1]}"


def _friendly_name(member: dict) -> str:
    """Best-effort readable name: Clerk displayName, email local part, or last-4 digits."""
    display = member.get("displayName")
    if display and isinstance(display, str) and display.strip():
        return display.strip().split(" ")[0]
    phone = member.get("phoneNumber", "")
    if "@" in phone:
        return phone.split("@", 1)[0]
    digits = "".join(c for c in phone if c.isdigit())
    return f"Player {digits[-4:]}" if len(digits) >= 4 else (phone or "teammate")


def _build_island_recap(db, island_id: str, yesterday: str) -> str:
    stats = db.query(
        "jobQueries:getYesterdayIslandStats",
        {"islandId": island_id, "date": yesterday},
    ) or {"completed": [], "missed": []}
    completed_names = _format_name_list(stats.get("completed", []), "completed")
    missed_names = _format_name_list(stats.get("missed", []), "missed")
    parts: list[str] = []
    if completed_names:
        parts.append(f"Yesterday {completed_names} hit their goals.")
    if missed_names:
        parts.append(f"{missed_names} missed theirs.")
    return " ".join(parts) if parts else "Yesterday was quiet on the island."


def _build_roster(island_members: list[dict]) -> list[dict]:
    return [
        {
            "name": _friendly_name(member),
            "goals": [g["text"] for g in (member.get("goals") or [])],
        }
        for member in island_members
    ]


def _log_group_message(db, island_members: list[dict], message: str, reasoning: str | None, today: str, team_recap: str, member_count: int):
    agent = next((m.get("agent") for m in island_members if m.get("agent")), None)
    if not agent:
        return

    context = {
        "date": today,
        "teamRecap": team_recap,
        "memberCount": member_count,
    }
    if reasoning:
        context["reasoning"] = reasoning
    db.mutation("jobMutations:logAiMessage", {
        "agentId": agent["_id"],
        "channel": "imessage_group",
        "content": message,
        "context": context,
    })


def _send_island_morning_message(db, island_id: str, island_members: list[dict], today: str, yesterday: str):
    team_recap = _build_island_recap(db, island_id, yesterday)
    roster = _build_roster(island_members)

    print(f"[morning-reminder] K2 call for island {island_id} (members={len(roster)})")
    message, reasoning = generate_group_morning_reminder(roster, team_recap)
    print(f"[morning-reminder] K2 → {message[:100]}")

    send_island_message(island_id, message)
    _log_group_message(
        db=db,
        island_members=island_members,
        message=message,
        reasoning=reasoning,
        today=today,
        team_recap=team_recap,
        member_count=len(roster),
    )


@jobs_bp.post("/morning-reminder")
def morning_reminder():
    """Send one K2-generated group iMessage per island.

    All members (with or without goals) are mentioned in the same message,
    which is delivered to the island's group iMessage thread — not DMs.
    """
    db = get_client()
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    yesterday = (now - timedelta(days=1)).strftime("%Y-%m-%d")

    members = db.query("jobQueries:getAllMembersForReminder")
    print(f"[morning-reminder] {len(members)} members across islands")

    # Bucket members by island so we send one group message per island.
    by_island: dict = {}
    for m in members:
        island_id = m["island"]["_id"]
        by_island.setdefault(island_id, []).append(m)

    sent = 0
    failed = 0

    for island_id, island_members in by_island.items():
        try:
            _send_island_morning_message(db, island_id, island_members, today, yesterday)
            sent += 1
        except Exception as exc:
            failed += 1
            print(f"[morning-reminder] island {island_id} failed: {exc}")
            continue

    return jsonify({"ok": True, "islands_sent": sent, "failed": failed})
