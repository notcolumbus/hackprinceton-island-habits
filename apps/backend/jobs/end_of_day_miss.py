import logging
from datetime import datetime, timezone

from flask import jsonify

from jobs import jobs_bp
from jobs.convex_client import get_client
from jobs.k2 import generate_low_motivation_message
from jobs.photon import send_group_message

logger = logging.getLogger(__name__)

MOTIVATION_PENALTY = {"easy": 5, "normal": 10, "hard": 15}


@jobs_bp.post("/end-of-day-miss")
def end_of_day_miss():
    db = get_client()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    unchecked = db.query("jobQueries:getUncheckedGoalsForDate", {"date": today})
    failed = 0

    misses_to_process = []
    for entry in unchecked:
        try:
            goal = entry["goal"]
            island = entry["island"]
            phone_number = entry["phoneNumber"]
            agent = entry["agent"]

            penalty = MOTIVATION_PENALTY.get(island["difficulty"], 10)
            
            misses_to_process.append({
                "goalId": goal["_id"],
                "phoneNumber": phone_number,
                "islandId": island["_id"],
                "agentId": agent["_id"],
                "penalty": penalty,
                "date": today,
            })
        except Exception as exc:
            failed += 1
            logger.error(f"[end-of-day-miss] failed to prepare entry: {exc}")
            continue

    if not misses_to_process:
        return jsonify({"ok": True, "processed": 0, "failed": failed})

    try:
        crossed_threshold = db.mutation("jobMutations:processEndOfDayMissesBatch", {"misses": misses_to_process})
        
        for item in crossed_threshold:
            try:
                new_motivation = item["newMotivation"]
                message, reasoning = generate_low_motivation_message(item["personalityProfile"], new_motivation)
                phones = db.query("jobQueries:getIslandPhoneNumbers", {"islandId": item["islandId"]})
                send_group_message(phones, message)

                context = {"motivation": new_motivation}
                if reasoning:
                    context["reasoning"] = reasoning

                db.mutation("jobMutations:logAiMessage", {
                    "agentId": item["agentId"],
                    "channel": "imessage_group",
                    "content": message,
                    "context": context,
                })
            except Exception as exc:
                logger.error(f"[end-of-day-miss] failed to process low motivation message: {exc}")

        return jsonify({"ok": True, "processed": len(misses_to_process), "failed": failed})
    except Exception as exc:
        logger.error(f"[end-of-day-miss] failed to process batch: {exc}")
        return jsonify({"ok": False, "failed": len(misses_to_process) + failed})



