import json
import os
import urllib.request

from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()


@router.get("/api/phoenix/weather")
def phoenix_weather():
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
            return JSONResponse({
                "ready": False,
                "message": "weather.forecast_zuhause nicht verfügbar",
            })

        attributes = weather.get("attributes", {})

        return JSONResponse({
            "ready": True,
            "entity_id": weather.get("entity_id"),
            "state": weather.get("state"),
            "temperature": attributes.get("temperature"),
            "humidity": attributes.get("humidity"),
            "pressure": attributes.get("pressure"),
            "wind_speed": attributes.get("wind_speed"),
            "wind_bearing": attributes.get("wind_bearing"),
            "friendly_name": attributes.get("friendly_name"),
        })

    except Exception as error:
        return JSONResponse({
            "ready": False,
            "message": str(error),
        })
