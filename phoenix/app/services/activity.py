import re
from datetime import datetime

from app.services.health import phoenix_health_data
from app.services.inventory import phoenix_inventory_data
from app.services.system import phoenix_system_data


def phoenix_activity_data():
    inventory = phoenix_inventory_data()
    health = phoenix_health_data()
    system = phoenix_system_data()

    now = datetime.now().strftime("%H:%M")

    unavailable = health.get("unavailable", 0)
    low_battery = health.get("low_battery", 0)
    devices = inventory.get("devices", 0)
    entities = inventory.get("entities", 0)

    score = health.get("health_score", "0%")
    cpu = system.get("cpu", "0%")
    ram = system.get("ram", "0%")
    disk = system.get("disk", "0%")

    return {
        "top": {
            "ha_status": "online",
            "ai_status": "bereit",
            "health_score": score,
            "devices": devices,
        },
        "activity": [
            (
                now,
                f"Inventory aktualisiert: {entities} Entitäten, {devices} Geräte",
            ),
            (
                now,
                f"Health Score berechnet: {score}, {unavailable} nicht verfügbar",
            ),
            (
                now,
                f"Batterieprüfung: {low_battery} kritisch",
            ),
            (
                now,
                f"Systemwerte: CPU {cpu}, RAM {ram}, Speicher {disk}",
            ),
        ],
    }


def inject_activity_numbers(html: str) -> str:
    data = phoenix_activity_data()

    for key, value in data.get("top", {}).items():
        html = re.sub(
            rf'<(p|em|strong) data-top-value="{key}">.*?</\1>',
            lambda match: (
                f'<{match.group(1)} data-top-value="{key}">'
                f'{value}</{match.group(1)}>'
            ),
            html,
        )

    for index, item in enumerate(data.get("activity", []), start=1):
        time_value, text_value = item

        html = re.sub(
            rf'<b data-activity-time="{index}">.*?</b>',
            f'<b data-activity-time="{index}">{time_value}</b>',
            html,
        )

        html = re.sub(
            rf'<span data-activity-text="{index}">.*?</span>',
            f'<span data-activity-text="{index}">{text_value}</span>',
            html,
        )

    return html
