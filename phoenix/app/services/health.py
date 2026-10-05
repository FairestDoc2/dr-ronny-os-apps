import json
import os
import re
import urllib.request


def phoenix_health_data():
    token = os.getenv("SUPERVISOR_TOKEN", "")

    def get_states():
        try:
            req = urllib.request.Request(
                "http://supervisor/core/api/states",
                headers={"Authorization": f"Bearer {token}"},
            )

            with urllib.request.urlopen(req, timeout=8) as response:
                return json.loads(response.read().decode("utf-8"))

        except Exception:
            return []

    states = get_states()

    unavailable = [
        item
        for item in states
        if str(item.get("state", "")).lower() in ["unavailable", "unknown"]
    ]

    low_battery = []

    for item in states:
        entity_id = item.get("entity_id", "")
        state = item.get("state", "")
        attributes = item.get("attributes", {}) or {}
        device_class = attributes.get("device_class", "")

        if (
            device_class == "battery"
            or "battery" in entity_id.lower()
            or "akku" in entity_id.lower()
        ):
            try:
                value = float(state)

                if value <= 20:
                    low_battery.append(item)

            except Exception:
                pass

    offline_devices = [
        item
        for item in states
        if str(item.get("state", "")).lower() == "unavailable"
        and not item.get("entity_id", "").startswith(
            ("automation.", "script.", "scene.")
        )
    ]

    total = max(len(states), 1)
    penalty = len(unavailable) + (len(low_battery) * 2)

    score = max(
        0,
        min(
            100,
            round(100 - ((penalty / total) * 100)),
        ),
    )

    return {
        "health_score": f"{score}%",
        "unavailable": len(unavailable),
        "low_battery": len(low_battery),
        "offline_devices": len(offline_devices),
    }


def inject_health_numbers(html: str) -> str:
    data = phoenix_health_data()

    for key, value in data.items():
        html = re.sub(
            rf'<b data-health-value="{key}">.*?</b>',
            f'<b data-health-value="{key}">{value}</b>',
            html,
        )

    return html
