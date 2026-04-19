from flask import jsonify

from jobs import jobs_bp
from jobs.convex_client import get_client
from jobs.k2 import generate_weekly_summary
from jobs.photon import send_island_message


def _name_from_phone(phone: str) -> str:
    if "@" in phone:
        return phone.split("@", 1)[0]
    digits = "".join(c for c in phone if c.isdigit())
    return f"Player {digits[-4:]}" if len(digits) >= 4 else phone


def _build_name_lookup(details: dict) -> dict:
    members = details.get("members") or []
    name_by_phone: dict = {}
    for member in members:
        phone = member.get("phoneNumber")
        if not phone:
            continue
        raw = (member.get("displayName") or "").strip()
        name_by_phone[phone] = raw.split(" ")[0] if raw else _name_from_phone(phone)
    return name_by_phone


def _build_per_user_breakdown(stats: dict, name_by_phone: dict) -> list[dict]:
    all_phones = set(stats["user_checkins"].keys()) | set(stats["user_misses"].keys())
    rows = [
        {
            "name": name_by_phone.get(phone, phone),
            "completed": stats["user_checkins"].get(phone, 0),
            "missed": stats["user_misses"].get(phone, 0),
        }
        for phone in all_phones
    ]
    rows.sort(key=lambda r: r["completed"], reverse=True)
    return rows


def _summarize_island(db, island: dict, events: list):
    details = db.query(
        "islands:getIslandDetails",
        {"islandId": island["_id"]},
    ) or {}
    stats = _aggregate_stats(events, island)
    name_by_phone = _build_name_lookup(details)
    per_user = _build_per_user_breakdown(stats, name_by_phone)
    top_completer_name = name_by_phone.get(stats["top_completer"]) or "nobody"
    top_misser_name = name_by_phone.get(stats["top_misser"]) if stats["top_misser"] else None

    print(
        f"[weekly-summary] K2 call for island {island['_id']} "
        f"(checkins={stats['total_checkins']}, misses={stats['total_misses']}, "
        f"members={len(per_user)})"
    )
    narrative, reasoning = generate_weekly_summary(
        stats["total_checkins"],
        stats["total_misses"],
        stats["builds_completed"],
        top_completer_name,
        per_user_breakdown=per_user,
        completion_rate=stats["completion_rate"],
        top_misser=top_misser_name,
    )
    print(f"[weekly-summary] K2 → {narrative[:120]}")
    return details, stats, narrative, reasoning


def _record_weekly_summary(db, island: dict, details: dict, stats: dict, narrative: str, reasoning: str | None):
    log_stats = {**stats}
    if reasoning:
        log_stats["reasoning"] = reasoning

    agents = details.get("agents") or []
    island_agent = agents[0] if agents else None
    db.mutation("jobMutations:recordWeeklySummary", {
        "islandId": island["_id"],
        "agentId": island_agent["_id"] if island_agent else None,
        "content": narrative,
        "stats": log_stats,
    })


@jobs_bp.post("/weekly-summary")
def weekly_summary():
    """Run the weekly recap for every island that just crossed a 7-day boundary.

    The `islandsReadyForWeeklySummary` Convex query filters down to islands
    where dayCount is a multiple of 7 AND we haven't already sent a summary
    for that boundary. That lets callers invoke this endpoint daily (or
    even hourly) without spamming the group iMessage.
    """
    db = get_client()

    islands = db.query("jobQueries:islandsReadyForWeeklySummary")
    print(f"[weekly-summary] {len(islands)} islands due for summary")
    sent = 0
    failed = 0

    for entry in islands:
        try:
            island = entry["island"]
            phones = entry["phones"]
            events = entry["events"]

            if not phones:
                print(f"[weekly-summary] island {island['_id']} has no phones — skip")
                continue

            details, stats, narrative, reasoning = _summarize_island(db, island, events)

            send_island_message(island["_id"], narrative)
            _record_weekly_summary(db, island, details, stats, narrative, reasoning)

            sent += 1
        except Exception as exc:
            failed += 1
            print(f"[weekly-summary] island failed: {exc}")
            continue

    return jsonify({"ok": True, "summaries_sent": sent, "failed": failed})


def _aggregate_stats(events: list, island: dict) -> dict:
    check_ins = [e for e in events if e["type"] == "check_in"]
    misses = [e for e in events if e["type"] == "miss"]
    builds_complete = [e for e in events if e["type"] == "build_complete"]
    damages = [e for e in events if e["type"] == "damage"]

    total = len(check_ins) + len(misses)
    completion_rate = (len(check_ins) / total) if total > 0 else 0.0

    user_checkins: dict = {}
    for e in check_ins:
        pid = (e.get("payload") or {}).get("phoneNumber", "unknown")
        user_checkins[pid] = user_checkins.get(pid, 0) + 1

    user_misses: dict = {}
    for e in misses:
        pid = (e.get("payload") or {}).get("phoneNumber", "unknown")
        user_misses[pid] = user_misses.get(pid, 0) + 1

    top_completer = max(user_checkins, key=user_checkins.get) if user_checkins else None
    top_misser = max(user_misses, key=user_misses.get) if user_misses else None

    return {
        "completion_rate": completion_rate,
        "total_checkins": len(check_ins),
        "total_misses": len(misses),
        "builds_completed": len(builds_complete),
        "buildings_damaged": len(damages),
        "top_completer": top_completer,
        "top_misser": top_misser,
        "user_checkins": user_checkins,
        "user_misses": user_misses,
        "island_level": island.get("islandLevel", 1),
    }
