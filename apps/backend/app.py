import base64
import os
import uuid

from dotenv import load_dotenv
load_dotenv()

from flask import Flask, jsonify, request
from flask_cors import CORS

from jobs import jobs_bp
from jobs.http_utils import post_json_with_retry
from settings import enforce_startup_requirements, startup_diagnostics
KNOT_ENVIRONMENT = os.getenv("KNOT_ENVIRONMENT", "production")
KNOT_CLIENT_ID = os.getenv("KNOT_CLIENT_ID", "")
KNOT_SECRET = os.getenv("KNOT_SECRET", "")
KNOT_BASE_URL = (
    "https://production.knotapi.com"
    if KNOT_ENVIRONMENT == "production"
    else "https://development.knotapi.com"
)


def _knot_auth_header() -> str:
    credentials = f"{KNOT_CLIENT_ID}:{KNOT_SECRET}"
    encoded = base64.b64encode(credentials.encode("utf-8")).decode("utf-8")
    return f"Basic {encoded}"


def create_app() -> Flask:
    diagnostics = enforce_startup_requirements()
    if diagnostics["missing_optional"]:
        print(
            "[startup] optional env vars missing:",
            ", ".join(diagnostics["missing_optional"]),
        )

    app = Flask(__name__)
    CORS(app)
    app.register_blueprint(jobs_bp)

    @app.get("/health")
    def health():
        return jsonify({"ok": True})

    @app.get("/healthz")
    def healthz():
        current = startup_diagnostics()
        status = 200 if current["ready"] else 503
        return (
            jsonify(
                {
                    "ok": current["ready"],
                    "service": "island-habits-ai-backend",
                    "strict": current["strict"],
                    "missing_required": current["missing_required"],
                    "missing_optional": current["missing_optional"],
                }
            ),
            status,
        )

    @app.post("/api/knot/session")
    def create_knot_session():
        if not KNOT_CLIENT_ID or not KNOT_SECRET:
            return jsonify({"error": "Missing KNOT_CLIENT_ID or KNOT_SECRET."}), 500

        body = request.get_json(silent=True) or {}
        user_id = body.get("userId") or f"island-habits-{uuid.uuid4()}"

        payload = {
            "type": "transaction_link",
            "external_user_id": user_id,
        }
        headers = {
            "Authorization": _knot_auth_header(),
            "Content-Type": "application/json",
        }

        response = post_json_with_retry(
            f"{KNOT_BASE_URL}/session/create",
            json=payload,
            headers=headers,
            timeout=30,
            max_attempts=3,
        )

        if not response.ok:
            return (
                jsonify(
                    {
                        "error": "Knot session creation failed.",
                        "status_code": response.status_code,
                        "body": response.text,
                    }
                ),
                response.status_code,
            )

        return jsonify(response.json())

    @app.post("/api/knot/webhook")
    def knot_webhook():
        payload = request.get_json(silent=True) or {}
        event = payload.get("event") or payload.get("type")
        connection_status = payload.get("connection_status") or payload.get(
            "connectionStatus"
        )
        merchant = payload.get("merchant") or payload.get("merchant_name")

        if str(event).upper() == "AUTHENTICATED" and str(connection_status).lower() == "connected":
            print(f"onSuccess merchant connected: {merchant}")

        return jsonify({"received": True})

    return app


app = create_app()


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", "5001")),
        debug=False,
        use_reloader=False,
    )
