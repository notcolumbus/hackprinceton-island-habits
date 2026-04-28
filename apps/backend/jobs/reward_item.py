from flask import jsonify, request

from jobs import jobs_bp
from jobs.k2 import generate_reward_item as _generate_reward_item


@jobs_bp.post("/reward-item")
def reward_item():
    body = request.get_json(silent=True) or {}
    completed_goal = (body.get("completed_goal") or "").strip()
    agent_personality = body.get("agent_personality")

    if not completed_goal or not agent_personality:
        return jsonify({"error": "completed_goal and agent_personality are required"}), 400

    try:
        result, reasoning = _generate_reward_item(completed_goal, agent_personality)
        if reasoning:
            result["_reasoning"] = reasoning
    except ValueError as e:
        return jsonify({"error": "Gemini returned non-JSON", "raw": str(e)}), 502

    return jsonify(result)
