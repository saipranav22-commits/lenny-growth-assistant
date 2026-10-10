"""HTTP client for the Pi Coding Agent Node.js bridge."""
from __future__ import annotations
import logging
import httpx
from config import settings

logger = logging.getLogger(__name__)


class BridgeError(Exception):
    """Raised when the Pi bridge returns a non-2xx response or times out."""
    def __init__(self, message: str, status_code: int = 500, retry_after: int = 0):
        super().__init__(message)
        self.status_code = status_code
        self.retry_after = retry_after


async def call_bridge(
    session_id: str,
    message: str,
    history: list[dict[str, str]],
    disable_tools: bool = False,
    provider: str = None,
    model: str = None
) -> dict:
    """
    POST /generate to the Pi bridge and return the structured response.

    Args:
        session_id: UUID string of the conversation.
        message: Current user message.
        history: List of {"role": "user"|"assistant", "content": "..."} dicts.

    Returns:
        Dict with keys: answer, provider, model, requestId.

    Raises:
        BridgeError: on timeout, connection failure, or bridge error.
    """
    payload = {
        "sessionId": session_id,
        "message": message,
        "history": history,
        "disableTools": disable_tools,
    }
    if provider:
        payload["provider"] = provider
    if model:
        payload["model"] = model

    try:
        async with httpx.AsyncClient(
            base_url=settings.pi_bridge_url,
            timeout=httpx.Timeout(settings.model_request_timeout + 5),
        ) as client:
            resp = await client.post("/generate", json=payload)
    except httpx.TimeoutException as exc:
        logger.error("Pi bridge timed out: %s", exc)
        raise BridgeError("AI model request timed out", status_code=504) from exc
    except httpx.ConnectError as exc:
        logger.error("Pi bridge connection refused: %s", exc)
        raise BridgeError(
            "AI bridge is not reachable. Is the Pi bridge running?",
            status_code=503,
        ) from exc

    if resp.status_code == 200:
        return resp.json()

    # Propagate structured errors from the bridge
    try:
        detail = resp.json().get("error", "Unknown bridge error")
    except Exception:
        detail = resp.text

    logger.error("Pi bridge error %s: %s", resp.status_code, detail)

    if resp.status_code == 504:
        raise BridgeError(detail, status_code=504)
    if resp.status_code == 504:
        raise BridgeError(detail, status_code=504)
    if resp.status_code == 503:
        raise BridgeError(detail, status_code=503)
    if resp.status_code == 429:
        retry_after = int(resp.headers.get('retry-after', 5))
        raise BridgeError(detail, status_code=429, retry_after=retry_after)
    raise BridgeError(detail, status_code=resp.status_code)
