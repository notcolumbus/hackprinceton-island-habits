from flask import jsonify, request

from jobs import jobs_bp
from jobs.gemma import call_gemma_vision_json


PROMPT_TEMPLATE = """You are a strict habit-checkin photo validator.

Task:
- Decide if this photo is credible proof that the user completed ONE of their goals today.
- If yes, pick the single best matching goal index.
- If no, return no match.

Return JSON only with this exact schema:
{{
  "is_task_proof": boolean,
  "matched_goal_index": number | null,
  "confidence": number,
  "reason": string
}}

Rules:
- Be conservative; uncertain => is_task_proof=false.
- matched_goal_index is 1-based and must match one listed goal.
- If no clear match, matched_goal_index=null.
- confidence must be between 0 and 1.

Goals:
{goals_block}
"""


def _normalize_b64_and_mime(image_base64: str, mime_type: str):
    raw = image_base64.strip()
    mt = (mime_type or "image/jpeg").strip() or "image/jpeg"
    if raw.startswith("data:") and ";base64," in raw:
        header, encoded = raw.split(";base64,", 1)
        raw = encoded
        guessed = header.replace("data:", "").strip()
        if guessed:
            mt = guessed
    return raw, mt


@jobs_bp.post("/analyze-task-photo")
def analyze_task_photo():
    body = request.get_json(silent=True) or {}
    goals = body.get("goals") or []
    image_base64 = (body.get("image_base64") or "").strip()
    mime_type = (body.get("mime_type") or "image/jpeg").strip()

    if not isinstance(goals, list) or not goals:
        return jsonify({"error": "goals must be a non-empty list"}), 400
    goals = [str(g).strip() for g in goals if str(g).strip()]
    if not goals:
        return jsonify({"error": "goals must contain non-empty strings"}), 400
    if not image_base64:
        return jsonify({"error": "image_base64 is required"}), 400

    image_base64, mime_type = _normalize_b64_and_mime(image_base64, mime_type)
    goals_block = "\n".join([f"{idx + 1}. {goal}" for idx, goal in enumerate(goals)])
    prompt = PROMPT_TEMPLATE.format(goals_block=goals_block)

    try:
        result, _ = call_gemma_vision_json(
            prompt=prompt,
            image_base64=image_base64,
            mime_type=mime_type,
            max_output_tokens=220,
        )
    except ValueError as e:
        return jsonify({"error": "Gemma returned non-JSON", "raw": str(e)}), 502
    except Exception as e:
        return jsonify({"error": "Gemma call failed", "raw": str(e)}), 502

    is_task_proof = bool(result.get("is_task_proof", False))
    idx_raw = result.get("matched_goal_index")
    confidence_raw = result.get("confidence", 0)
    reason = str(result.get("reason", "")).strip()

    try:
        confidence = float(confidence_raw)
    except (TypeError, ValueError):
        confidence = 0.0
    confidence = max(0.0, min(1.0, confidence))

    matched_goal_index = None
    if isinstance(idx_raw, int):
        matched_goal_index = idx_raw
    elif isinstance(idx_raw, str) and idx_raw.isdigit():
        matched_goal_index = int(idx_raw)

    if matched_goal_index is not None and not (1 <= matched_goal_index <= len(goals)):
        matched_goal_index = None
        is_task_proof = False
        reason = reason or "Model returned invalid goal index."

    if not is_task_proof:
        matched_goal_index = None

    return jsonify(
        {
            "is_task_proof": is_task_proof,
            "matched_goal_index": matched_goal_index,
            "confidence": confidence,
            "reason": reason,
        }
    )
