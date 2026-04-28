from flask import jsonify, request

from jobs import jobs_bp
from jobs.k2 import generate_chat_reply


def _fallback_message(player_name: str, latest: str) -> str:
    first = (player_name or "friend").strip().split(" ")[0] or "friend"
    if latest.strip():
        return (
            f"I hear you, {first}. Quick heads-up: my AI brain is reconnecting, "
            f"but I'm still here with you on the island."
        )
    return f"I’m here, {first}. My AI brain is reconnecting right now."


@jobs_bp.post("/chat-reply")
def chat_reply():
    body = request.get_json(silent=True) or {}
    player_name = (body.get("player_name") or "friend").strip()
    island_context = (body.get("island_context") or "").strip()
    history = body.get("history") or []
    latest = (body.get("latest") or "").strip()

    if not latest:
        return jsonify({"error": "latest is required"}), 400
    if not isinstance(history, list):
        return jsonify({"error": "history must be a list"}), 400

    try:
        message, reasoning = generate_chat_reply(player_name, island_context, history, latest)
    except Exception as exc:
        print(f"[chat-reply] model call failed; using fallback: {exc}")
        return jsonify({"message": _fallback_message(player_name, latest), "reasoning": "fallback:model_error"}), 200

    res = {"message": message}
    if reasoning:
        res["reasoning"] = reasoning
    return jsonify(res)
