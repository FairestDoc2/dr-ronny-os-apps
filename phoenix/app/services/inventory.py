import json
import os
import re
import urllib.request
from pathlib import Path


def get_states():
    token = os.getenv("SUPERVISOR_TOKEN", "")

    try:
        req = urllib.request.Request(
            "http://supervisor/core/api/states",
            headers={"Authorization": f"Bearer {token}"},
        )

        with urllib.request.urlopen(req, timeout=8) as response:
            return json.loads(response.read().decode("utf-8"))

    except Exception:
        return []


def storage_count(filename: str, key: str) -> int:
    for base in ["/config/.storage", "/homeassistant/.storage"]:
        try:
            path = Path(base) / filename

            if path.exists():
                data = json.loads(path.read_text(encoding="utf-8"))
                items = data.get("data", {}).get(key, [])

                return len(items) if isinstance(items, list) else 0

        except Exception:
            pass

    return 0


def phoenix_inventory_data():
    states = get_states()

    return {
        "entities": len(states),
        "automations": len([
            item for item in states
            if item.get("entity_id", "").startswith("automation.")
        ]),
        "areas": storage_count("core.area_registry", "areas"),
        "labels": storage_count("core.label_registry", "labels"),
        "devices": storage_count("core.device_registry", "devices"),
        "integrations": storage_count("core.config_entries", "entries"),
        "scripts": len([
            item for item in states
            if item.get("entity_id", "").startswith("script.")
        ]),
        "scenes": len([
            item for item in states
            if item.get("entity_id", "").startswith("scene.")
        ]),
    }


def inject_inventory_numbers(html: str) -> str:
    data = phoenix_inventory_data()

    for key, value in data.items():
        html = re.sub(
            rf'<b data-inventory-value="{key}">.*?</b>',
            f'<b data-inventory-value="{key}">{value:,}</b>'.replace(",", "."),
            html,
        )

    return html
