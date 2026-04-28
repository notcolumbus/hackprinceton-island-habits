from flask import jsonify, request

from jobs import jobs_bp
from jobs.k2 import generate_personality as _generate_personality


@jobs_bp.post("/generate-personality")
def generate_personality():
    body = request.get_json(silent=True) or {}
    player_name = (body.get("player_name") or "").strip()
    approved_goals = body.get("approved_goals") or []
    random_seed_trait = (body.get("random_seed_trait") or "").strip()

    if not player_name or not approved_goals or not random_seed_trait:
        return jsonify({"error": "player_name, approved_goals, and random_seed_trait are required"}), 400

    try:
        result, reasoning = _generate_personality(player_name, approved_goals, random_seed_trait)
        if reasoning:
            result["_reasoning"] = reasoning
    except ValueError as e:
        return jsonify({"error": "Gemini returned non-JSON", "raw": str(e)}), 502

    return jsonify(result)
