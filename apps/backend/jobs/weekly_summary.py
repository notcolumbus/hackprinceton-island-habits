import logging
from flask import jsonify

from jobs import jobs_bp
from jobs.convex_client import get_client
from jobs.k2 import generate_weekly_summary
from jobs.photon import send_island_message

logger = logging.getLogger(__name__)


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
    logger.info(f"[weekly-summary] {len(islands)} islands due for summary")
    sent = 0
    failed = 0
    summaries_to_record = []

    for entry in islands:
        try:
            island = entry["island"]
            phones = entry["phones"]
            events = entry["events"]
            agents = entry.get("agents", [])
            member_details = entry.get("memberDetails", [])

            if not phones:
                logger.info(f"[weekly-summary] island {island['_id']} has no phones — skip")
                continue

            name_by_phone: dict = {}
            for m in member_details:
                phone = m.get("phoneNumber")
                if not phone:
                    continue
                name_by_phone[phone] = m.get("displayName") or phone

            stats = _aggregate_stats(events, island)

            # Build per-user breakdown that Gemini can reference by name.
            per_user = []
            all_phones = set(stats["user_checkins"].keys()) | set(stats["user_misses"].keys())
            for phone in all_phones:
                per_user.append({
                    "name": name_by_phone.get(phone, phone),
                    "completed": stats["user_checkins"].get(phone, 0),
                    "missed": stats["user_misses"].get(phone, 0),
                })
            per_user.sort(key=lambda r: r["completed"], reverse=True)

            top_completer_name = name_by_phone.get(stats["top_completer"]) or "nobody"
            top_misser_name = name_by_phone.get(stats["top_misser"]) if stats["top_misser"] else None

            logger.info(
                f"[weekly-summary] Gemini call for island {island['_id']} "
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
            logger.info(f"[weekly-summary] Gemini → {narrative[:120]}")

            log_stats = {**stats}
            if reasoning:
                log_stats["reasoning"] = reasoning

            send_island_message(island["_id"], narrative)

            island_agent = agents[0] if agents else None
            
            summaries_to_record.append({
                "islandId": island["_id"],
                "agentId": island_agent["_id"] if island_agent else None,
                "content": narrative,
                "stats": log_stats,
            })

            sent += 1
        except Exception as exc:
            failed += 1
            logger.error(f"[weekly-summary] island failed: {exc}")
            continue

    if summaries_to_record:
        try:
            db.mutation("jobMutations:recordWeeklySummariesBatch", {"summaries": summaries_to_record})
        except Exception as exc:
            logger.error(f"[weekly-summary] failed to record batch: {exc}")

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
