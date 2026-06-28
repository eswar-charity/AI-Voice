import time
from typing import Callable, TypeVar

import httpx
from httpcore import RemoteProtocolError
from supabase import Client, create_client
from supabase.lib.client_options import SyncClientOptions

from .config import settings

_client: Client | None = None

T = TypeVar("T")


def _configure_rest_session(client: Client) -> None:
    """Use HTTP/1.1 — HTTP/2 to Supabase often drops with 'Server disconnected' on Windows."""
    old = client.postgrest.session
    client.postgrest.session = httpx.Client(
        base_url=old.base_url,
        headers=old.headers,
        timeout=old.timeout,
        follow_redirects=True,
        http2=False,
    )
    try:
        old.close()
    except Exception:
        pass


def _build_client() -> Client:
    client = create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_KEY,
        options=SyncClientOptions(
            postgrest_client_timeout=30,
        ),
    )
    _configure_rest_session(client)
    return client


def reset_supabase() -> None:
    global _client
    if _client is not None:
        try:
            _client.postgrest.session.close()
        except Exception:
            pass
    _client = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        _client = _build_client()
    return _client


def run_db_query(fn: Callable[[], T], *, retries: int = 3) -> T:
    """Retry transient Supabase/httpx disconnects."""
    last_exc: Exception | None = None
    for attempt in range(retries):
        try:
            return fn()
        except (httpx.RemoteProtocolError, httpx.ConnectError, RemoteProtocolError) as exc:
            last_exc = exc
            reset_supabase()
            if attempt < retries - 1:
                time.sleep(0.25 * (attempt + 1))
    assert last_exc is not None
    raise last_exc
