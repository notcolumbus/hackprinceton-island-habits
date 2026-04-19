import json
import os
import re
from typing import Optional, Tuple

import requests

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")
GOOGLE_MODEL = os.environ.get("GOOGLE_MODEL", "gemma-4-26b-a4b-it")
GOOGLE_API_URL = os.environ.get("GOOGLE_API_URL", "https://generativelanguage.googleapis.com/v1beta")


def _strip_json_fences(raw: str) -> str:
    return re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip(), flags=re.DOTALL).strip()


def _extract_text_from_generate_content(resp_json: dict) -> str:
    candidates = resp_json.get("candidates") or []
    if not candidates:
        return ""
    content = (candidates[0] or {}).get("content") or {}
    parts = content.get("parts") or []
    if not parts:
        return ""
    # Prefer non-thought parts when available.
    for part in parts:
        if part.get("thought") is True:
            continue
        text = part.get("text")
        if text:
            return str(text).strip()
    # Fallback: return the last text part.
    for part in reversed(parts):
        text = part.get("text")
        if text:
            return str(text).strip()
    return ""


def call_gemma_vision_json(
    prompt: str,
    image_base64: str,
    mime_type: str = "image/jpeg",
    max_output_tokens: int = 220,
) -> Tuple[dict, Optional[str]]:
    if not GOOGLE_API_KEY:
        raise RuntimeError("Missing GOOGLE_API_KEY")

    url = f"{GOOGLE_API_URL}/models/{GOOGLE_MODEL}:generateContent?key={GOOGLE_API_KEY}"
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": prompt},
                    {
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": image_base64,
                        }
                    },
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": max_output_tokens,
            "responseMimeType": "application/json",
        },
    }
    r = requests.post(
        url,
        headers={"Content-Type": "application/json"},
        json=payload,
        timeout=45,
    )
    r.raise_for_status()
    raw_text = _extract_text_from_generate_content(r.json())
    cleaned = _strip_json_fences(raw_text)
    try:
        return json.loads(cleaned), None
    except json.JSONDecodeError:
        # Fallback: attempt to parse the last JSON object in the output.
        for m in reversed(list(re.finditer(r"\{[\s\S]*\}", cleaned))):
            try:
                return json.loads(m.group(0)), None
            except json.JSONDecodeError:
                continue
        raise ValueError(f"Gemma returned non-JSON: {raw_text}")
