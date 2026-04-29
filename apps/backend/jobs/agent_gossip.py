import logging
from flask import jsonify, request

from jobs import jobs_bp
from jobs.k2 import generate_agent_gossip as _generate_agent_gossip

logger = logging.getLogger(__name__)


@jobs_bp.post("/agent-gossip")
def agent_gossip():
    body = request.get_json(silent=True) or {}
    logger.info(f"[gossip] body keys: {list(body.keys())}, raw content-type: {request.content_type!r}")
    agent_a_personality = body.get("agent_a_personality") or body.get("agent_personality")
    agent_b_personality = body.get("agent_b_personality") or {}
    recent_events = body.get("recent_events") or []

    if not agent_a_personality:
        logger.error(f"[gossip] 400: agent_a_personality={agent_a_personality!r}, body={body!r}")
        return jsonify({"error": "agent_a_personality is required"}), 400

    try:
        result, reasoning = _generate_agent_gossip(agent_a_personality, agent_b_personality, recent_events)
        if reasoning:
            result["_reasoning"] = reasoning
    except ValueError as e:
        return jsonify({"error": "Gemini returned non-JSON", "raw": str(e)}), 502

    return jsonify(result)
