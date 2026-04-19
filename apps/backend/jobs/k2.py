import json
import os
import re
from pathlib import Path
from typing import Optional, Tuple

import requests

K2_API_URL = os.environ.get("K2_API_URL", "https://api.k2think.ai/v1/chat/completions")
K2_API_KEY = os.environ.get("K2_API_KEY", "")
K2_MODEL = os.environ.get("K2_MODEL", "MBZUAI-IFM/K2-Think-v2")

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def _load(name: str) -> str:
    return (PROMPTS_DIR / name).read_text()


def call_k2(system: str, user: str, max_tokens: int = 200) -> Tuple[str, Optional[str]]:
    r = requests.post(
        K2_API_URL,
        headers={"Authorization": f"Bearer {K2_API_KEY}", "Content-Type": "application/json"},
        json={
            "model": K2_MODEL,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "max_tokens": max_tokens,
        },
        timeout=30,
    )
    r.raise_for_status()
    content = r.json()["choices"][0]["message"]["content"]
    reasoning = None

    if "</think>" in content:
        parts = content.split("</think>", 1)
        reasoning_raw = parts[0]
        content = parts[1].strip()
        if "<think>" in reasoning_raw:
            reasoning_raw = reasoning_raw.split("<think>", 1)[1]
        reasoning = reasoning_raw.strip()
    elif "<think>" in content:
        parts = content.split("<think>", 1)
        reasoning = parts[1].strip()
        content = parts[0].strip()

    return content, reasoning


def call_k2_json(system: str, user: str, max_tokens: int = 200) -> Tuple[dict, Optional[str]]:
    raw, reasoning = call_k2(system, user, max_tokens)
    # Strip markdown code fences
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.DOTALL).strip()
    # Try parsing the full string first (handles nested structures like {"lines": [...]})
    try:
        return json.loads(raw), reasoning
    except json.JSONDecodeError:
        pass
    # Fall back: try each flat {...} block from last to first
    for m in reversed(list(re.finditer(r"\{[^{}]+\}", raw, re.DOTALL))):
        try:
            return json.loads(m.group(0)), reasoning
        except json.JSONDecodeError:
            continue
    raise ValueError(f"K2 returned non-JSON: {raw}")


# ── Named helpers ─────────────────────────────────────────────────────────────

def generate_morning_reminder(
    personality: dict,
    goal_texts: list,
    miss_streak: int,
    team_recap: str = "",
) -> Tuple[str, Optional[str]]:
    streak_note = f"Miss streak: {miss_streak} days." if miss_streak >= 3 else ""
    recap_note = f"Yesterday on the island: {team_recap}" if team_recap else ""
    user = (
        f"Agent personality: {json.dumps(personality)}\n"
        f"Today's goal: {', '.join(goal_texts)}\n"
        f"{recap_note}\n"
        f"{streak_note}"
    ).strip()
    return call_k2(_load("prompt_morning_reminder.md"), user, max_tokens=140)


def generate_group_morning_reminder(
    members: list,
    team_recap: str = "",
) -> Tuple[str, Optional[str]]:
    """Generate one morning iMessage addressed to the whole island group.

    `members` is a list of `{"name": str, "goals": list[str]}`. K2 writes a
    short group-chat-style message that greets the team, pokes at yesterday's
    recap, and nudges each person (or the team collectively) toward today's
    goals. Reuses the morning-reminder prompt but with a team-scoped payload.
    """
    if not members:
        members = [{"name": "team", "goals": ["stay consistent today"]}]
    lines = []
    for m in members:
        name = m.get("name") or "teammate"
        goals = m.get("goals") or []
        if goals:
            lines.append(f"- {name}: {', '.join(goals)}")
        else:
            lines.append(f"- {name}: (no goals yet)")
    recap_note = f"Yesterday on the island: {team_recap}" if team_recap else ""
    user = (
        "Audience: one iMessage group chat with every islander reading.\n"
        "Address the team collectively; name-check people whose progress "
        "(or miss) makes it interesting. Don't list every goal verbatim.\n"
        "Members and today's goals:\n"
        f"{chr(10).join(lines)}\n"
        f"{recap_note}"
    ).strip()
    return call_k2(_load("prompt_morning_reminder.md"), user, max_tokens=220)


def generate_weekly_summary(
    total_completed: int,
    total_missed: int,
    buildings_constructed: int,
    top_performer: str,
    per_user_breakdown: Optional[list] = None,
    completion_rate: Optional[float] = None,
    top_misser: Optional[str] = None,
) -> Tuple[str, Optional[str]]:
    """Build a team-style weekly recap prompt.

    `per_user_breakdown` is a list of `{"name", "completed", "missed"}` so
    K2 can name-check individuals instead of referring to phone numbers.
    Falls back to the old summary shape when breakdown isn't supplied.
    """
    lines = [
        f"Total completed: {total_completed}",
        f"Total missed: {total_missed}",
        f"Buildings constructed: {buildings_constructed}",
        f"Top performer: {top_performer}",
    ]
    if completion_rate is not None:
        lines.append(f"Completion rate: {round(completion_rate * 100)}%")
    if top_misser:
        lines.append(f"Most missed: {top_misser}")
    if per_user_breakdown:
        lines.append("Per-user breakdown:")
        for row in per_user_breakdown:
            name = row.get("name") or "teammate"
            done = row.get("completed", 0)
            missed = row.get("missed", 0)
            lines.append(f"- {name}: {done} check-ins, {missed} misses")
    user = "\n".join(lines)
    return call_k2(_load("prompt_weekly_summary.md"), user, max_tokens=260)


def generate_low_motivation_message(personality: dict, motivation: int) -> Tuple[str, Optional[str]]:
    user = (
        f"Failing players: [player]\n"
        f"Missed goals: multiple goals\n"
        f"Agent personality: {json.dumps(personality)}\n"
        f"Motivation level: {motivation}/100"
    )
    return call_k2(_load("prompt_mutiny_intervention.md"), user, max_tokens=150)


def generate_personality(
    player_name: str,
    approved_goals: list,
    random_seed_trait: str,
) -> dict:
    user = (
        f"Player name: {player_name}\n"
        f"Approved goals: {', '.join(approved_goals)}\n"
        f"Random seed trait: {random_seed_trait}"
    )
    return call_k2_json(_load("prompt_personality_generator.md"), user, max_tokens=200)


def roast_goal(player_name: str, proposed_goal: str) -> Tuple[str, Optional[str]]:
    user = f"Player name: {player_name}\nProposed goal: {proposed_goal}"
    return call_k2(_load("prompt_goal_roaster.md"), user, max_tokens=120)


def generate_chat_reply(
    player_name: str,
    island_context: str,
    history: list,
    latest: str,
) -> Tuple[str, Optional[str]]:
    lines = []
    for h in history[-12:]:
        who = h.get("who") or "user"
        txt = (h.get("text") or "").strip()
        if txt:
            lines.append(f"{who}: {txt}")
    transcript = "\n".join(lines) if lines else "(no prior messages)"
    user = (
        f"Island context:\n{island_context}\n\n"
        f"Sender: {player_name}\n\n"
        f"Recent group chat (oldest→newest):\n{transcript}\n\n"
        f"Latest message from {player_name}: {latest}"
    )
    return call_k2(_load("prompt_chat_reply.md"), user, max_tokens=200)


def generate_agent_gossip(agent_a_personality: dict, agent_b_personality: dict, recent_events: list) -> Tuple[dict, Optional[str]]:
    user = (
        f"Agent A personality: {json.dumps(agent_a_personality)}\n"
        f"Agent B personality: {json.dumps(agent_b_personality)}\n"
        f"Recent island events: {json.dumps(recent_events)}"
    )
    return call_k2_json(_load("prompt_agent_gossip.md"), user, max_tokens=400)


def generate_reward_item(completed_goal: str, agent_personality: dict) -> Tuple[dict, Optional[str]]:
    user = (
        f"Completed goal: {completed_goal}\n"
        f"Agent personality: {json.dumps(agent_personality)}"
    )
    return call_k2_json(_load("prompt_generative_item.md"), user, max_tokens=120)


def generate_ascension_finale(
    total_days: int,
    total_buildings: int,
    total_goals: int,
) -> str:
    user = (
        f"Total days on island: {total_days}\n"
        f"Total buildings constructed: {total_buildings}\n"
        f"Total goals completed: {total_goals}"
    )
    return call_k2(_load("prompt_ascension_finale.md"), user, max_tokens=350)
