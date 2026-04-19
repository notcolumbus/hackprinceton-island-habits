import os
import random

from flask import Response, jsonify, request

from jobs import jobs_bp
from jobs.http_utils import post_json_with_retry

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_MODEL_ID = os.getenv("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2")
ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1"
DEFAULT_VOICE_IDS = [
    "RDSy0QN68yhrjuOgqzQ4",
    "XJ2fW4ybq7HouelYYGcL",
    "342hpGp7PKo7DsTTVSdr",
    "OTMqA7lryJHXgAnPIQYt",
]


def _voice_pool() -> list[str]:
    raw = os.getenv("ELEVENLABS_VOICE_IDS", "").strip()
    if raw:
        parsed = [voice_id.strip() for voice_id in raw.split(",") if voice_id.strip()]
        if parsed:
            return parsed
    return DEFAULT_VOICE_IDS


@jobs_bp.post("/agent-tts")
def agent_tts():
    if not ELEVENLABS_API_KEY:
        return jsonify({"error": "Missing ELEVENLABS_API_KEY"}), 503

    body = request.get_json(silent=True) or {}
    text = str(body.get("text") or "").strip()
    if not text:
        return jsonify({"error": "text is required"}), 400

    speaker_hint = str(body.get("speaker") or "").strip()
    voice_ids = _voice_pool()
    voice_id = random.choice(voice_ids)

    response = post_json_with_retry(
        f"{ELEVENLABS_BASE_URL}/text-to-speech/{voice_id}",
        params={"output_format": "mp3_44100_128"},
        headers={
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
        json={
            "text": text[:500],
            "model_id": ELEVENLABS_MODEL_ID,
            "voice_settings": {
                "stability": 0.35,
                "similarity_boost": 0.8,
            },
        },
        timeout=30,
        max_attempts=3,
    )

    if not response.ok:
        return (
            jsonify(
                {
                    "error": "ElevenLabs TTS request failed",
                    "status_code": response.status_code,
                    "body": response.text[:600],
                    "voice_id": voice_id,
                    "speaker": speaker_hint,
                }
            ),
            response.status_code,
        )

    return Response(response.content, mimetype="audio/mpeg")
