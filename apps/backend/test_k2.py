#!/usr/bin/env python3
"""
test_k2.py — Gemini test script for Island of Habits.

This file keeps its legacy name for compatibility, but all model calls now use
Google Gemini/Gemma via the generateContent API.
"""

import argparse
import json
import os
import sys

from dotenv import load_dotenv

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
GOOGLE_API_URL = os.getenv("GOOGLE_API_URL", "https://generativelanguage.googleapis.com/v1beta")
GOOGLE_MODEL = os.getenv("GOOGLE_MODEL", "gemma-4-26b-a4b-it")

if not GOOGLE_API_KEY:
    print("❌  GOOGLE_API_KEY not found. Set it in apps/backend/.env")
    sys.exit(1)


def call_gemini(messages: list[dict]) -> str:
    """Call Gemini and return the primary text response."""
    import requests

    prompt_lines = []
    for msg in messages:
        role = str(msg.get("role") or "user").strip().upper()
        content = str(msg.get("content") or "").strip()
        if not content:
            continue
        prompt_lines.append(f"{role}:\n{content}")

    prompt = "\n\n".join(prompt_lines) if prompt_lines else "USER:\nhi there"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 512,
        },
    }

    url = f"{GOOGLE_API_URL}/models/{GOOGLE_MODEL}:generateContent?key={GOOGLE_API_KEY}"
    print(f"\n📡  Calling Gemini ({GOOGLE_MODEL})...")
    print(f"    URL: {url}")
    print(f"    Messages: {json.dumps(messages, indent=2)}")
    print("    ─" * 30)

    resp = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=120)
    if not resp.ok:
        print(f"❌  HTTP {resp.status_code}: {resp.text}")
        sys.exit(1)

    data = resp.json() or {}
    candidates = data.get("candidates") or []
    parts = ((candidates[0] or {}).get("content") or {}).get("parts") or []
    text_parts = [str(part.get("text") or "") for part in parts if isinstance(part, dict)]
    content = "\n".join([p for p in text_parts if p]).strip()
    print(f"\n✅  Response:\n{content}\n")
    return content


def test_basic():
    print("=" * 60)
    print("TEST: Basic connectivity")
    print("=" * 60)
    return call_gemini([
        {"role": "user", "content": "hi there"}
    ])


def test_personality_generation():
    print("=" * 60)
    print("TEST: Agent personality generation")
    print("=" * 60)

    goals = ["Exercise 30 min daily", "Read 20 pages", "Meditate for 10 min"]
    system_prompt = (
        "You are an AI personality designer for a multiplayer habit-tracking game "
        "called Island of Habits. Players live on a shared virtual island. Each "
        "player has a personal AI agent that motivates them.\n\n"
        "Given the player's goals, generate a unique agent personality. Return a "
        "JSON object with these fields:\n"
        "  - name\n"
        "  - archetype\n"
        "  - tone\n"
        "  - catchphrase\n"
        "  - backstory\n"
        "  - reminder_style\n"
    )
    user_prompt = (
        "Generate an agent personality for a player whose goals are:\n"
        f"1. {goals[0]}\n2. {goals[1]}\n3. {goals[2]}\n"
    )

    return call_gemini([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ])


def test_motivation_message():
    print("=" * 60)
    print("TEST: Low-motivation agent message")
    print("=" * 60)

    system_prompt = (
        "You are Kai, a warm and playful island companion in a habit-tracking game. "
        "Keep messages under 2 sentences."
    )
    user_prompt = (
        "The player's motivation dropped to 25%. They missed two goals yesterday. "
        "Write a short, empathetic message for iMessage."
    )

    return call_gemini([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ])


def test_weekly_summary():
    print("=" * 60)
    print("TEST: Weekly island summary")
    print("=" * 60)

    system_prompt = (
        "You are the narrator of Island of Habits. Write from the island's perspective "
        "in a warm tone. Keep it under 4 sentences."
    )
    user_prompt = (
        "This week on the island:\n"
        "- 3 players, 15 goals total\n"
        "- 11 goals completed\n"
        "- Top performer: Player A\n"
        "- 1 new building placed\n"
        "- Island level: 3 -> 4\n\n"
        "Write the weekly summary message to send to the group chat."
    )

    return call_gemini([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ])


def print_curl():
    print("=" * 60)
    print("CURL: Copy-paste this to test from your terminal")
    print("=" * 60)
    url = f"{GOOGLE_API_URL}/models/{GOOGLE_MODEL}:generateContent?key={GOOGLE_API_KEY}"
    curl = f"""curl -X POST '{url}' \\
  -H 'Content-Type: application/json' \\
  -d '{{
    "contents": [{{
      "role": "user",
      "parts": [{{"text": "USER:\\nhi there"}}]
    }}],
    "generationConfig": {{
      "temperature": 0.7,
      "maxOutputTokens": 128
    }}
  }}'"""
    print(curl)


TESTS = {
    "basic": test_basic,
    "personality": test_personality_generation,
    "motivation": test_motivation_message,
    "summary": test_weekly_summary,
    "curl": print_curl,
}


def main():
    parser = argparse.ArgumentParser(description="Test Gemini API for Island of Habits")
    parser.add_argument(
        "--test", "-t",
        choices=list(TESTS.keys()),
        default=None,
        help="Run a specific test (default: run all)",
    )
    args = parser.parse_args()

    print("🏝️  Island of Habits — Gemini Test Suite")
    print(f"   API Key: {GOOGLE_API_KEY[:8]}...{GOOGLE_API_KEY[-4:]}")
    print(f"   Model:   {GOOGLE_MODEL}")
    print(f"   URL:     {GOOGLE_API_URL}")
    print()

    if args.test:
        TESTS[args.test]()
    else:
        for name, fn in TESTS.items():
            if name != "curl":
                fn()
                print()

    print("🏁  Done!")


if __name__ == "__main__":
    main()
