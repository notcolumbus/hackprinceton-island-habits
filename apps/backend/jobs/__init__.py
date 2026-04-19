from flask import Blueprint

jobs_bp = Blueprint("jobs", __name__, url_prefix="/jobs")

from jobs import (  # noqa: E402, F401
    morning_reminder, end_of_day_miss, build_progress_tick, weekly_summary,
    roast_goal, generate_personality, agent_gossip, agent_tts, reward_item, ascension_finale,
    chat_reply, debug,
)
