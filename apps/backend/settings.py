import os
from typing import Any


_TRUTHY = {"1", "true", "yes", "on"}


def env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in _TRUTHY


def startup_diagnostics() -> dict[str, Any]:
    required_for_ai = ("K2_API_KEY",)
    optional = (
        "ELEVENLABS_API_KEY",
        "CONVEX_URL",
        "AGENT_URL",
        "KNOT_CLIENT_ID",
        "KNOT_SECRET",
    )

    missing_required = [key for key in required_for_ai if not os.getenv(key)]
    missing_optional = [key for key in optional if not os.getenv(key)]
    strict = env_bool("STRICT_STARTUP_VALIDATION", True)

    return {
        "strict": strict,
        "missing_required": missing_required,
        "missing_optional": missing_optional,
        "ready": len(missing_required) == 0,
    }


def enforce_startup_requirements() -> dict[str, Any]:
    diagnostics = startup_diagnostics()
    if diagnostics["strict"] and diagnostics["missing_required"]:
        missing = ", ".join(diagnostics["missing_required"])
        raise RuntimeError(
            f"Missing required env vars for AI backend startup: {missing}. "
            "Set them in your deployment settings or disable strict mode with "
            "STRICT_STARTUP_VALIDATION=false."
        )
    return diagnostics

