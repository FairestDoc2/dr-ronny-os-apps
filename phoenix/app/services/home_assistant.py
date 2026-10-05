import asyncio
import json
import os

import websocket


def _ha_ws_call_sync(command: dict):
    token = (
        os.environ.get("SUPERVISOR_TOKEN")
        or os.environ.get("HASS_TOKEN")
        or ""
    )

    urls = [
        "ws://supervisor/core/websocket",
        "ws://homeassistant.local:8123/api/websocket",
        "ws://127.0.0.1:8123/api/websocket",
    ]

    last_error = None

    for url in urls:
        ws = None

        try:
            headers = []

            if token:
                headers.append(f"Authorization: Bearer {token}")

            ws = websocket.create_connection(
                url,
                timeout=10,
                header=headers,
            )

            hello = json.loads(ws.recv())

            if hello.get("type") == "auth_required":
                ws.send(json.dumps({
                    "type": "auth",
                    "access_token": token,
                }))

                auth = json.loads(ws.recv())

                if auth.get("type") != "auth_ok":
                    last_error = auth
                    continue

            request = dict(command)
            request["id"] = 1

            ws.send(json.dumps(request))

            while True:
                msg = json.loads(ws.recv())

                if msg.get("id") == 1:
                    if msg.get("success"):
                        return {
                            "ok": True,
                            "result": msg.get("result"),
                        }

                    return {
                        "ok": False,
                        "error": msg.get("error"),
                    }

        except Exception as exc:
            last_error = str(exc)

        finally:
            if ws is not None:
                try:
                    ws.close()
                except Exception:
                    pass

    return {
        "ok": False,
        "error": last_error or "Home Assistant WebSocket nicht erreichbar",
    }


async def ha_ws_call(command: dict):
    return await asyncio.to_thread(_ha_ws_call_sync, command)


def _ha_rest_call_sync(
    method: str,
    path: str,
    data=None,
):
    """Führt einen authentifizierten REST-Aufruf gegen Home Assistant aus."""
    from urllib import request as urllib_request
    from urllib import error as urllib_error

    token = (
        os.environ.get("SUPERVISOR_TOKEN")
        or os.environ.get("HASS_TOKEN")
        or ""
    )

    bases = [
        "http://supervisor/core/api",
        "http://homeassistant.local:8123/api",
        "http://127.0.0.1:8123/api",
    ]

    body = None

    if data is not None:
        body = json.dumps(data).encode("utf-8")

    last_error = None

    for base in bases:
        url = f"{base}/{path.lstrip('/')}"

        headers = {
            "Content-Type": "application/json",
        }

        if token:
            headers["Authorization"] = f"Bearer {token}"

        req = urllib_request.Request(
            url,
            data=body,
            headers=headers,
            method=method.upper(),
        )

        try:
            with urllib_request.urlopen(
                req,
                timeout=10,
            ) as response:
                raw = response.read().decode("utf-8")

                if not raw:
                    result = None
                else:
                    try:
                        result = json.loads(raw)
                    except json.JSONDecodeError:
                        result = raw

                return {
                    "ok": True,
                    "status_code": response.status,
                    "result": result,
                }

        except urllib_error.HTTPError as exc:
            raw = exc.read().decode(
                "utf-8",
                errors="replace",
            )

            last_error = {
                "status_code": exc.code,
                "body": raw,
            }

            # Ein echter HA-HTTP-Fehler soll nicht gegen
            # weitere Adressen erneut ausgeführt werden.
            return {
                "ok": False,
                "status_code": exc.code,
                "error": last_error,
            }

        except Exception as exc:
            last_error = str(exc)

    return {
        "ok": False,
        "error": last_error or
        "Home Assistant REST API nicht erreichbar",
    }


async def ha_rest_call(
    method: str,
    path: str,
    data=None,
):
    return await asyncio.to_thread(
        _ha_rest_call_sync,
        method,
        path,
        data,
    )
