from flask import jsonify, request

from jobs import jobs_bp
from jobs.k2 import generate_ascension_finale as _generate_ascension_finale
from jobs.photon import send_group_message


@jobs_bp.post("/ascension-finale")
def ascension_finale():
    body = request.get_json(silent=True) or {}
    total_days = body.get("total_days")
    total_buildings = body.get("total_buildings")
    total_goals = body.get("total_goals")
    island_phones = body.get("island_phones") or []

    if total_days is None or total_buildings is None or total_goals is None:
        return jsonify({"error": "total_days, total_buildings, and total_goals are required"}), 400

    try:
        narrative, reasoning = _generate_ascension_finale(total_days, total_buildings, total_goals)
    except ValueError as e:
        return jsonify({"error": "Gemini returned non-JSON", "raw": str(e)}), 502

    if island_phones:
        send_group_message(island_phones, narrative)

    res = {"narrative": narrative}
    if reasoning:
        res["reasoning"] = reasoning
    return jsonify(res)
