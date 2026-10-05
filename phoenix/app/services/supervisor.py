import json
import os
from urllib import request
from urllib.error import HTTPError, URLError


def supervisor_request(
    method: str,
    endpoint: str,
    payload: dict | None = None,
    timeout: int = 30,
):
    """Allgemeiner Zugriff auf die Home-Assistant-Supervisor-API."""

    token = os.environ.get(
        "SUPERVISOR_TOKEN",
        "",
    )

    if not token:
        raise RuntimeError(
            "SUPERVISOR_TOKEN ist nicht verfügbar."
        )

    body = None

    if payload is not None:
        body = json.dumps(
            payload
        ).encode("utf-8")

    req = request.Request(
        "http://supervisor" + endpoint,
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )

    try:
        with request.urlopen(
            req,
            timeout=timeout,
        ) as response:
            raw = response.read().decode(
                "utf-8"
            )

            if not raw:
                return {
                    "result": "ok",
                    "data": {},
                }

            return json.loads(raw)

    except HTTPError as exc:
        raw = exc.read().decode(
            "utf-8",
            errors="replace",
        )

        raise RuntimeError(
            f"Supervisor HTTP {exc.code}: {raw}"
        ) from exc

    except URLError as exc:
        raise RuntimeError(
            f"Supervisor nicht erreichbar: {exc}"
        ) from exc
