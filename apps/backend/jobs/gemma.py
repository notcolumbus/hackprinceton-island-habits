import json
import os
import re
from typing import Any, Optional, Tuple

import requests

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")
GOOGLE_MODEL = os.environ.get("GOOGLE_MODEL", "gemma-4-26b-a4b-it")
GOOGLE_API_URL = os.environ.get("GOOGLE_API_URL", "https://generativelanguage.googleapis.com/v1beta")
GOOGLE_THINKING_BUDGET = os.environ.get("GOOGLE_THINKING_BUDGET", "0")


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
    visible_chunks: list[str] = []
    for part in parts:
        if part.get("thought") is True:
            continue
        text = part.get("text")
        if text:
            visible_chunks.append(str(text))
    if visible_chunks:
        return "".join(visible_chunks).strip()
    # Fallback: if provider only returned thought-tagged text, return it
    # instead of empty output.
    for part in parts:
        text = part.get("text")
        if text:
            return str(text).strip()
    return ""


def _split_reasoning(raw: str) -> Tuple[str, Optional[str]]:
    content = (raw or "").strip()
    if not content:
        return "", None
    reasoning = None
    if "</think>" in content:
        parts = content.split("</think>", 1)
        reasoning_raw = parts[0]
        content = parts[1].strip()
        if "<think>" in reasoning_raw:
            reasoning_raw = reasoning_raw.split("<think>", 1)[1]
        reasoning = reasoning_raw.strip() or None
    elif "<think>" in content:
        parts = content.split("<think>", 1)
        content = parts[0].strip()
        reasoning = parts[1].strip() or None
    return content, reasoning


def _call_gemma_raw(
    parts: list[dict[str, Any]],
    *,
    max_output_tokens: int,
    temperature: float,
    response_mime_type: Optional[str] = None,
    timeout: int = 45,
) -> str:
    if not GOOGLE_API_KEY:
        raise RuntimeError("Missing GOOGLE_API_KEY")

    url = f"{GOOGLE_API_URL}/models/{GOOGLE_MODEL}:generateContent?key={GOOGLE_API_KEY}"
    generation_config: dict[str, Any] = {
        "temperature": temperature,
        "maxOutputTokens": max_output_tokens,
    }
    try:
        thinking_budget = int(GOOGLE_THINKING_BUDGET)
        if thinking_budget >= 0:
            generation_config["thinkingConfig"] = {"thinkingBudget": thinking_budget}
    except ValueError:
        pass
    if response_mime_type:
        generation_config["responseMimeType"] = response_mime_type

    payload = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": generation_config,
    }
    response = requests.post(
        url,
        headers={"Content-Type": "application/json"},
        json=payload,
        timeout=timeout,
    )
    if response.status_code == 400 and "thinkingConfig" in generation_config:
        # Some legacy models do not support thinkingConfig. Retry once
        # without it so model switching never bricks generation.
        retry_payload = {
            "contents": payload["contents"],
            "generationConfig": {
                k: v for k, v in generation_config.items() if k != "thinkingConfig"
            },
        }
        response = requests.post(
            url,
            headers={"Content-Type": "application/json"},
            json=retry_payload,
            timeout=timeout,
        )
    response.raise_for_status()
    return _extract_text_from_generate_content(response.json())


def call_gemma_text(
    system: str,
    user: str,
    *,
    max_output_tokens: int = 200,
    temperature: float = 0.65,
) -> Tuple[str, Optional[str]]:
    prompt = (
        "System instructions:\n"
        f"{system}\n\n"
        "User input:\n"
        f"{user}"
    )
    raw_text = _call_gemma_raw(
        [{"text": prompt}],
        max_output_tokens=max_output_tokens,
        temperature=temperature,
    )
    return _split_reasoning(raw_text)


def _parse_json_response(raw_text: str) -> Tuple[dict, Optional[str]]:
    content, reasoning = _split_reasoning(raw_text)
    cleaned = _strip_json_fences(content)
    try:
        return json.loads(cleaned), reasoning
    except json.JSONDecodeError:
        for match in reversed(list(re.finditer(r"\{[\s\S]*\}", cleaned))):
            try:
                return json.loads(match.group(0)), reasoning
            except json.JSONDecodeError:
                continue
        raise ValueError(f"Gemini returned non-JSON: {raw_text}")


def call_gemma_json(
    system: str,
    user: str,
    *,
    max_output_tokens: int = 220,
    temperature: float = 0.2,
) -> Tuple[dict, Optional[str]]:
    prompt = (
        "System instructions:\n"
        f"{system}\n\n"
        "Respond with a single valid JSON object and no additional text.\n\n"
        "User input:\n"
        f"{user}"
    )
    raw_text = _call_gemma_raw(
        [{"text": prompt}],
        max_output_tokens=max_output_tokens,
        temperature=temperature,
        response_mime_type="application/json",
    )
    return _parse_json_response(raw_text)


def call_gemma_vision_json(
    prompt: str,
    image_base64: str,
    mime_type: str = "image/jpeg",
    max_output_tokens: int = 220,
) -> Tuple[dict, Optional[str]]:
    raw_text = _call_gemma_raw(
        [
            {"text": prompt},
            {
                "inlineData": {
                    "mimeType": mime_type,
                    "data": image_base64,
                }
            },
        ],
        max_output_tokens=max_output_tokens,
        temperature=0.1,
        response_mime_type="application/json",
    )
    return _parse_json_response(raw_text)
