import random
import time
from typing import Any, Optional

import requests


RETRYABLE_STATUS_CODES = {408, 425, 429, 500, 502, 503, 504}
RETRYABLE_EXCEPTIONS = (
    requests.exceptions.Timeout,
    requests.exceptions.ConnectionError,
)


def post_json_with_retry(
    url: str,
    *,
    headers: Optional[dict[str, str]] = None,
    params: Optional[dict[str, Any]] = None,
    json: Optional[dict[str, Any]] = None,
    timeout: int = 30,
    max_attempts: int = 3,
    backoff_seconds: float = 0.6,
    jitter_seconds: float = 0.25,
) -> requests.Response:
    last_error: Optional[BaseException] = None
    last_response: Optional[requests.Response] = None

    for attempt in range(1, max_attempts + 1):
        try:
            response = requests.post(
                url,
                headers=headers,
                params=params,
                json=json,
                timeout=timeout,
            )
            last_response = response
            if response.status_code not in RETRYABLE_STATUS_CODES:
                return response
        except RETRYABLE_EXCEPTIONS as exc:
            last_error = exc
        except Exception:
            raise

        if attempt == max_attempts:
            break

        delay = backoff_seconds * (2 ** (attempt - 1))
        delay += random.random() * jitter_seconds
        time.sleep(min(delay, 5.0))

    if last_response is not None:
        return last_response
    if last_error is not None:
        raise last_error
    raise RuntimeError("HTTP request failed without response")

