import json
import os
import urllib.request
from pathlib import Path

from fastapi.responses import HTMLResponse

from app.services.activity import inject_activity_numbers
from app.services.health import inject_health_numbers
from app.services.inventory import inject_inventory_numbers
from app.services.system import inject_system_numbers


APP_DIR = Path(__file__).resolve().parent.parent
WEB_DIR = APP_DIR / "web"


def get_phoenix_weather_data():
    try:
        token = os.environ.get("SUPERVISOR_TOKEN", "")
        target_entity = "weather.forecast_zuhause"

        req = urllib.request.Request(
            "http://supervisor/core/api/states/" + target_entity,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )

        with urllib.request.urlopen(req, timeout=5) as response:
            weather = json.loads(response.read().decode("utf-8"))

        if not weather or weather.get("state") in ["unknown", "unavailable"]:
            return None

        attributes = weather.get("attributes", {})

        return {
            "ready": True,
            "entity_id": weather.get("entity_id"),
            "state": weather.get("state"),
            "temperature": attributes.get("temperature"),
            "humidity": attributes.get("humidity"),
            "pressure": attributes.get("pressure"),
            "wind_speed": attributes.get("wind_speed"),
            "wind_bearing": attributes.get("wind_bearing"),
            "friendly_name": attributes.get("friendly_name"),
        }
    except Exception:
        return None


def render_index():
    html = (WEB_DIR / "phoenix_v2.html").read_text()

    html = inject_inventory_numbers(html)
    html = inject_health_numbers(html)
    html = inject_system_numbers(html)
    html = inject_activity_numbers(html)

    try:
        cfg_text = Path("/app/config.yaml").read_text()
        version = "unknown"

        for line in cfg_text.splitlines():
            if line.strip().startswith("version:"):
                version = line.split(":", 1)[1].strip().strip('"').strip("'")
                break

        html = html.replace("Phoenix lädt...", f"Phoenix {version}")
    except Exception:
        html = html.replace("Phoenix lädt...", "Phoenix unknown")

    weather = get_phoenix_weather_data()

    if weather:
        state = weather.get("state")

        icons = {
            "sunny": "☀️ ",
            "clear": "☀️ ",
            "clear-night": "🌙",
            "partlycloudy": "⛅",
            "cloudy": "☁️ ",
            "rainy": "🌧️ ",
            "pouring": "🌧️ ",
            "lightning": "⛈️ ",
            "snowy": "❄️ ",
            "fog": "🌫️ ",
            "windy": "💨",
            "hail": "🌨️ ",
        }

        names = {
            "sunny": "sonnig",
            "clear-night": "klare Nacht",
            "partlycloudy": "leicht bewölkt",
            "cloudy": "bewölkt",
            "rainy": "Regen",
            "pouring": "starker Regen",
            "lightning": "Gewitter",
            "snowy": "Schnee",
            "fog": "Nebel",
            "windy": "windig",
            "hail": "Hagel",
        }

        icon = icons.get(state, "🌤️ ")
        name = names.get(state, state or "Wetter")

        parts = [name]

        if weather.get("temperature") is not None:
            parts.append(f'{weather.get("temperature")}°C')

        if weather.get("humidity") is not None:
            parts.append(f'{weather.get("humidity")}% Luftfeuchte')

        if weather.get("wind_speed") is not None:
            parts.append(f'Wind {weather.get("wind_speed")} km/h')

        if weather.get("pressure") is not None:
            parts.append(f'{weather.get("pressure")} hPa')

        details = " · ".join(parts)

        html = html.replace(
            '🌤️ </span><b>Wetter</b><em id="weatherDetails">wird geladen</em>',
            f'{icon}</span><b>Wetter</b><em id="weatherDetails">{details}</em>',
        )

        html = html.replace(
            '<span id="weatherHeroIcon">🌤️ </span>',
            f'<span id="weatherHeroIcon">{icon}</span>',
        )

        html = html.replace(
            "Wetterdaten nicht erreichbar",
            details,
        )

    return HTMLResponse(
        html,
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )
