import base64
import os
import uuid
import logging
from typing import Any, Dict, List, Optional, Tuple

from dotenv import load_dotenv
load_dotenv()

import requests
from flask import Flask, jsonify, request
from flask_cors import CORS
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type

from jobs import jobs_bp
from jobs.convex_client import get_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

app.register_blueprint(jobs_bp)

KNOT_ENVIRONMENT = os.getenv("KNOT_ENVIRONMENT", "production")
KNOT_CLIENT_ID = os.getenv("KNOT_CLIENT_ID", "")
KNOT_SECRET = os.getenv("KNOT_SECRET", "")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
CONVEX_URL = os.getenv("CONVEX_URL", "")
KNOT_BASE_URL = (
    "https://production.knotapi.com"
    if KNOT_ENVIRONMENT == "production"
    else "https://development.knotapi.com"
)


def _knot_auth_header() -> str:
    credentials = f"{KNOT_CLIENT_ID}:{KNOT_SECRET}"
    encoded = base64.b64encode(credentials.encode("utf-8")).decode("utf-8")
    return f"Basic {encoded}"


@retry(wait=wait_exponential(multiplier=1, min=2, max=10), stop=stop_after_attempt(3), retry=retry_if_exception_type(requests.RequestException))
def _knot_request(
    method: str,
    path: str,
    *,
    params: Optional[Dict[str, Any]] = None,
    payload: Optional[Dict[str, Any]] = None,
    timeout: int = 30,
) -> requests.Response:
    headers = {
        "Authorization": _knot_auth_header(),
        "Content-Type": "application/json",
    }
    return requests.request(
        method=method.upper(),
        url=f"{KNOT_BASE_URL}{path}",
        params=params,
        json=payload,
        headers=headers,
        timeout=timeout,
    )


def _coerce_accounts_response(raw: Any) -> List[Dict[str, Any]]:
    if isinstance(raw, list):
        return [item for item in raw if isinstance(item, dict)]
    if isinstance(raw, dict):
        return [raw]
    return []


def _connected_transaction_merchants(
    external_user_id: str,
) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    response = _knot_request(
        "GET",
        "/accounts/get",
        params={"external_user_id": external_user_id, "type": "transaction_link"},
        timeout=20,
    )
    if not response.ok:
        return [], response.text

    payload = response.json()
    accounts = _coerce_accounts_response(payload)
    merchants: List[Dict[str, Any]] = []
    for account in accounts:
        merchant = account.get("merchant") or {}
        connection = account.get("connection") or {}
        status = str(connection.get("status") or "").lower()
        merchant_id = merchant.get("id")
        if status != "connected" or not isinstance(merchant_id, int):
            continue
        merchants.append({"id": merchant_id, "name": merchant.get("name")})
    return merchants, None


def _summarize_products(products: List[Any]) -> Optional[str]:
    names: List[str] = []
    for product in products[:3]:
        if not isinstance(product, dict):
            continue
        name = str(product.get("name") or "").strip()
        if name:
            names.append(name)
    if not names:
        return None
    if len(products) > len(names):
        return f"{', '.join(names)} +{len(products) - len(names)} more"
    return ", ".join(names)


def _sync_transactions_for_external_user(
    external_user_id: str,
    participant_id: str,
    merchant_id: int,
    merchant_name: Optional[str],
    *,
    max_pages: int = 3,
    per_page_limit: int = 50,
) -> Tuple[int, Optional[str]]:
    db = get_client()
    cursor = db.query(
        "knot:getCursor",
        {"externalUserId": external_user_id, "merchantId": merchant_id},
    )
    total_upserts = 0

    for _ in range(max_pages):
        payload: Dict[str, Any] = {
            "merchant_id": merchant_id,
            "external_user_id": external_user_id,
            "limit": per_page_limit,
        }
        if isinstance(cursor, str) and cursor:
            payload["cursor"] = cursor

        response = _knot_request("POST", "/transactions/sync", payload=payload, timeout=30)
        if not response.ok:
            raise RuntimeError(
                f"/transactions/sync failed ({response.status_code}): {response.text}"
            )

        data = response.json() or {}
        merchant = data.get("merchant") or {}
        effective_merchant_name = merchant_name or merchant.get("name")
        transactions = data.get("transactions") or []

        compact: List[Dict[str, Any]] = []
        for tx in transactions:
            if not isinstance(tx, dict):
                continue
            tx_id = str(tx.get("id") or "").strip()
            if not tx_id:
                continue
            price = tx.get("price") or {}
            compact.append(
                {
                    "id": tx_id,
                    "datetime": tx.get("datetime"),
                    "orderStatus": tx.get("order_status"),
                    "total": price.get("total"),
                    "currency": price.get("currency"),
                    "productSummary": _summarize_products(tx.get("products") or []),
                    "raw": tx,
                }
            )

        if compact:
            result = db.mutation(
                "knot:upsertTransactionBatch",
                {
                    "externalUserId": external_user_id,
                    "participantId": participant_id,
                    "merchantId": merchant_id,
                    "merchantName": effective_merchant_name,
                    "transactions": compact,
                },
            )
            total_upserts += int(result.get("inserted", 0)) + int(result.get("updated", 0))

        next_cursor = data.get("next_cursor")
        if isinstance(next_cursor, str) and next_cursor:
            db.mutation(
                "knot:upsertCursor",
                {
                    "externalUserId": external_user_id,
                    "merchantId": merchant_id,
                    "cursor": next_cursor,
                },
            )
            cursor = next_cursor
            continue

        cursor = None
        break

    return total_upserts, cursor


@app.get("/health")
def health():
    return jsonify({"ok": True})


@app.get("/healthz")
def healthz():
    missing_required = []
    if not GOOGLE_API_KEY:
        missing_required.append("GOOGLE_API_KEY")
    if not CONVEX_URL:
        missing_required.append("CONVEX_URL")
    return jsonify(
        {
            "ok": len(missing_required) == 0,
            "service": "island-habits-ai-backend",
            "strict": True,
            "missing_required": missing_required,
            "missing_optional": [],
        }
    ), (200 if len(missing_required) == 0 else 500)


@app.post("/api/knot/session")
def create_knot_session():
    if not KNOT_CLIENT_ID or not KNOT_SECRET:
        return jsonify({"error": "Missing KNOT_CLIENT_ID or KNOT_SECRET."}), 500

    body = request.get_json(silent=True) or {}
    raw_user_id = body.get("userId")
    user_id = str(raw_user_id).strip() if raw_user_id else f"island-habits-{uuid.uuid4()}"

    payload = {
        "type": "transaction_link",
        "external_user_id": user_id,
    }
    response = _knot_request("POST", "/session/create", payload=payload, timeout=30)

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

    participant_ids: List[str] = []
    raw_participant_ids = body.get("participantIds")
    if isinstance(raw_participant_ids, list):
        participant_ids.extend(str(item).strip() for item in raw_participant_ids if str(item).strip())
    participant_id = body.get("participantId")
    if participant_id:
        participant_ids.append(str(participant_id).strip())
    participant_ids = list(dict.fromkeys(participant_ids))

    if participant_ids:
        try:
            db = get_client()
            for pid in participant_ids:
                try:
                    db.mutation(
                        "knot:bindExternalUser",
                        {"participantId": pid, "externalUserId": user_id},
                    )
                except Exception as bind_error:
                    logger.error(f"[knot/session] failed to bind participant={pid}: {bind_error}")
        except Exception as convex_error:
            logger.error(f"[knot/session] failed to initialize Convex client: {convex_error}")

    return jsonify(response.json())


@app.post("/api/knot/sync-island")
def sync_knot_island():
    if not KNOT_CLIENT_ID or not KNOT_SECRET:
        return jsonify({"error": "Missing KNOT_CLIENT_ID or KNOT_SECRET."}), 500
    if not CONVEX_URL:
        return jsonify({"error": "Missing CONVEX_URL."}), 500

    body = request.get_json(silent=True) or {}
    island_id = str(body.get("islandId") or "").strip()
    if not island_id:
        return jsonify({"error": "islandId is required"}), 400

    db = get_client()
    try:
        candidates = db.query("knot:getExternalUserCandidatesForIsland", {"islandId": island_id}) or []
    except Exception as convex_error:
        return jsonify({"error": "Invalid islandId or Convex query failed", "detail": str(convex_error)}), 400
    synced_participants = 0
    skipped_participants = 0
    failed_syncs = 0
    total_transactions = 0
    details: List[Dict[str, Any]] = []

    for row in candidates:
        participant_id = str(row.get("participantId") or "").strip()
        external_candidates = row.get("externalUserIds") or []
        if not participant_id or not isinstance(external_candidates, list):
            skipped_participants += 1
            continue

        chosen_external: Optional[str] = None
        merchants: List[Dict[str, Any]] = []
        last_error: Optional[str] = None

        for external_user_id in external_candidates:
            ext = str(external_user_id or "").strip()
            if not ext:
                continue
            try:
                found_merchants, err = _connected_transaction_merchants(ext)
            except Exception as knot_error:
                last_error = str(knot_error)
                continue
            if found_merchants:
                chosen_external = ext
                merchants = found_merchants
                break
            if err:
                last_error = err

        if not chosen_external or not merchants:
            skipped_participants += 1
            details.append(
                {
                    "participantId": participant_id,
                    "synced": False,
                    "reason": "no_connected_transaction_link_accounts",
                    "lastError": last_error,
                }
            )
            continue

        # Persist the winning mapping so future syncs can skip candidate probing.
        db.mutation(
            "knot:bindExternalUser",
            {"participantId": participant_id, "externalUserId": chosen_external},
        )

        participant_upserts = 0
        for merchant in merchants:
            merchant_id = merchant["id"]
            merchant_name = merchant.get("name")
            try:
                upserts, _ = _sync_transactions_for_external_user(
                    chosen_external,
                    participant_id,
                    merchant_id,
                    merchant_name,
                )
                participant_upserts += upserts
            except Exception as sync_error:
                failed_syncs += 1
                details.append(
                    {
                        "participantId": participant_id,
                        "externalUserId": chosen_external,
                        "merchantId": merchant_id,
                        "synced": False,
                        "reason": "transaction_sync_failed",
                        "error": str(sync_error),
                    }
                )
                # Continue syncing other merchants/participants instead of aborting.
                continue

        synced_participants += 1
        total_transactions += participant_upserts
        details.append(
            {
                "participantId": participant_id,
                "externalUserId": chosen_external,
                "merchants": merchants,
                "upserts": participant_upserts,
                "synced": True,
            }
        )

    return jsonify(
        {
            "ok": True,
            "islandId": island_id,
            "participants": len(candidates),
            "synced_participants": synced_participants,
            "skipped_participants": skipped_participants,
            "failed_syncs": failed_syncs,
            "total_transactions": total_transactions,
            "details": details,
        }
    )


@app.post("/api/knot/webhook")
def knot_webhook():
    payload = request.get_json(silent=True) or {}
    event = payload.get("event") or payload.get("type")
    connection_status = payload.get("connection_status") or payload.get(
        "connectionStatus"
    )
    merchant = payload.get("merchant") or payload.get("merchant_name")

    if str(event).upper() == "AUTHENTICATED" and str(connection_status).lower() == "connected":
        logger.info(f"onSuccess merchant connected: {merchant}")

    return jsonify({"received": True})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=False, use_reloader=False)
