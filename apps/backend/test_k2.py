#!/usr/bin/env python3
"""
test_k2.py — Test script for K2 Think V2 API integration.

Tests the K2 Think V2 open reasoning model (MBZUAI-IFM) with prompts
modeled after our Island of Habits agent personality generation.

Usage:
    python3 test_k2.py                    # Run all tests
    python3 test_k2.py --test personality  # Run only personality test
    python3 test_k2.py --test motivation   # Run only motivation test
    python3 test_k2.py --test curl         # Print the equivalent curl command
"""

import argparse
import json
import os
import sys

from dotenv import load_dotenv

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────
K2_API_KEY = os.getenv("K2_API_KEY", "")
K2_API_URL = os.getenv("K2_API_URL", "https://api.k2think.ai/v1/chat/completions")
K2_MODEL = os.getenv("K2_MODEL", "MBZUAI-IFM/K2-Think-v2")

if not K2_API_KEY:
    print("❌  K2_API_KEY not found.  Set it in apps/backend/.env")
    sys.exit(1)


# ── Helpers ───────────────────────────────────────────────────────────

def call_k2(messages: list[dict], stream: bool = False) -> str:
    """Call K2 Think V2 and return the assistant's reply (non-streaming)."""
    import requests

    headers = {
        "accept": "application/json",
        "Authorization": f"Bearer {K2_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": K2_MODEL,
        "messages": messages,
        "stream": stream,
    }

    print(f"\n📡  Calling K2 Think V2 ({K2_MODEL})...")
    print(f"    URL: {K2_API_URL}")
    print(f"    Messages: {json.dumps(messages, indent=2)}")
    print(f"    Stream: {stream}")
    print("    ─" * 30)

    resp = requests.post(K2_API_URL, headers=headers, json=payload, timeout=120)
    _ensure_ok_response(resp)
    if stream:
        return _read_streaming_response(resp)
    return _read_non_streaming_response(resp)


def _ensure_ok_response(resp):
    if resp.ok:
        return
    print(f"❌  HTTP {resp.status_code}: {resp.text}")
    sys.exit(1)


def _read_streaming_response(resp) -> str:
    full_text = ""
    print("\n🔄  Streaming response:\n")
    for line in resp.iter_lines(decode_unicode=True):
        content = _extract_stream_delta(line)
        if content is None:
            if line and line.startswith("data: ") and line[len("data: "):].strip() == "[DONE]":
                break
            continue
        print(content, end="", flush=True)
        full_text += content
    print("\n")
    return full_text


def _extract_stream_delta(line: str | None) -> str | None:
    if not line or not line.startswith("data: "):
        return None
    data = line[len("data: "):]
    if data.strip() == "[DONE]":
        return None
    try:
        chunk = json.loads(data)
        delta = chunk["choices"][0].get("delta", {})
        return delta.get("content", "") or None
    except (json.JSONDecodeError, KeyError, IndexError):
        return None


def _read_non_streaming_response(resp) -> str:
    data = resp.json()
    content = data["choices"][0]["message"]["content"]
    print(f"\n✅  Response:\n{content}\n")
    return content


# ── Test scenarios ────────────────────────────────────────────────────

def test_basic():
    """Basic connectivity test — simple hello."""
    print("=" * 60)
    print("TEST: Basic connectivity")
    print("=" * 60)
    return call_k2([
        {"role": "user", "content": "hi there"}
    ], stream=True)


def test_personality_generation():
    """
    Simulate personality generation for an Island of Habits agent.
    This mirrors what createAgent (convex/agents.ts) will call.
    """
    print("=" * 60)
    print("TEST: Agent personality generation (emotional context)")
    print("=" * 60)

    goals = ["Exercise 30 min daily", "Read 20 pages", "Meditate for 10 min"]
    system_prompt = (
        "You are an AI personality designer for a multiplayer habit-tracking game "
        "called Island of Habits. Players live on a shared virtual island. Each "
        "player has a personal AI agent that motivates them.\n\n"
        "Given the player's goals, generate a unique agent personality. Return a "
        "JSON object with these fields:\n"
        "  - name: a creative character name\n"
        "  - archetype: one of [coach, sage, trickster, guardian, explorer]\n"
        "  - tone: the emotional tone this agent uses (e.g., warm, playful, stern)\n"
        "  - catchphrase: a short motivational catchphrase\n"
        "  - backstory: 1-2 sentences about where this character came from\n"
        "  - reminder_style: how they remind the player (gentle, humorous, direct)\n\n"
        "Be creative and make the personality feel alive."
    )
    user_prompt = (
        f"Generate an agent personality for a player whose goals are:\n"
        f"1. {goals[0]}\n2. {goals[1]}\n3. {goals[2]}\n\n"
        f"The player seems motivated but often forgets their habits after lunch. "
        f"Give the agent a warm, slightly playful personality."
    )

    return call_k2([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ], stream=True)


def test_motivation_message():
    """
    Simulate a low-motivation nudge — the agent sends a message when
    the player's motivation drops below 30%.
    """
    print("=" * 60)
    print("TEST: Low-motivation agent message (emotional nudge)")
    print("=" * 60)

    system_prompt = (
        "You are Kai, a warm and playful island companion in a habit-tracking game. "
        "Your archetype is 'coach'. You speak with gentle humor and always end with "
        "encouragement. Keep messages under 2 sentences."
    )
    user_prompt = (
        "The player's motivation just dropped to 25%. They missed 'Exercise 30 min' "
        "and 'Read 20 pages' yesterday. Write a short, in-character message to send "
        "them via iMessage. Be empathetic, not guilt-tripping."
    )

    return call_k2([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ], stream=True)


def test_weekly_summary():
    """
    Simulate a weekly summary from the island's perspective.
    """
    print("=" * 60)
    print("TEST: Weekly island summary (narrative generation)")
    print("=" * 60)

    system_prompt = (
        "You are the narrator of Island of Habits, a shared virtual island game. "
        "Write from the island's perspective in a warm, storytelling tone. "
        "Keep it under 4 sentences."
    )
    user_prompt = (
        "This week on the island:\n"
        "- 3 players, 15 goals total\n"
        "- 11 goals completed (73% rate)\n"
        "- Top performer: Player A (100%)\n"
        "- Player C missed 3 days in a row\n"
        "- 1 new building placed: Library\n"
        "- Island level: 3 → 4\n"
        "- Average motivation: 68%\n\n"
        "Write the weekly summary message to send to the group chat."
    )

    return call_k2([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ], stream=True)


def print_curl():
    """Print the equivalent curl command for manual testing."""
    print("=" * 60)
    print("CURL: Copy-paste this to test from your terminal")
    print("=" * 60)
    curl = f"""curl -X 'POST' \\
  '{K2_API_URL}' \\
  -H 'accept: application/json' \\
  -H 'Authorization: Bearer {K2_API_KEY}' \\
  -H 'Content-Type: application/json' \\
  -d '{{
  "model": "{K2_MODEL}",
  "messages": [
    {{
      "role": "user",
      "content": "hi there"
    }}
  ],
  "stream": true
}}'"""
    print(curl)


# ── Main ──────────────────────────────────────────────────────────────

TESTS = {
    "basic": test_basic,
    "personality": test_personality_generation,
    "motivation": test_motivation_message,
    "summary": test_weekly_summary,
    "curl": print_curl,
}


def main():
    parser = argparse.ArgumentParser(description="Test K2 Think V2 API for Island of Habits")
    parser.add_argument(
        "--test", "-t",
        choices=list(TESTS.keys()),
        default=None,
        help="Run a specific test (default: run all)",
    )
    args = parser.parse_args()

    print("🏝️  Island of Habits — K2 Think V2 Test Suite")
    print(f"   API Key: {K2_API_KEY[:8]}...{K2_API_KEY[-4:]}")
    print(f"   Model:   {K2_MODEL}")
    print(f"   URL:     {K2_API_URL}")
    print()

    if args.test:
        TESTS[args.test]()
    else:
        # Run all tests except curl
        for name, fn in TESTS.items():
            if name != "curl":
                fn()
                print()

    print("🏁  Done!")


if __name__ == "__main__":
    main()
