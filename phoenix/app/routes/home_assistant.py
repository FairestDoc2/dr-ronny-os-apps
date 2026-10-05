"""
Phoenix Home Assistant API.

Read-only endpoints for the Home Assistant integration.
"""

import json

from fastapi import APIRouter, Body

from app.services.home_assistant import ha_ws_call, ha_rest_call
from app.services.supervisor import supervisor_request
from app.core.context_paths import ContextPaths


router = APIRouter()


def _load_ronny_ai_state() -> dict:
    path = ContextPaths.RONNY_AI_STATE_FILE

    if not path.exists():
        return {
            "ignored": [],
            "history": [],
        }

    try:
        data = json.loads(
            path.read_text(
                encoding="utf-8"
            )
        )
    except Exception:
        return {
            "ignored": [],
            "history": [],
        }

    if not isinstance(data, dict):
        return {
            "ignored": [],
            "history": [],
        }

    ignored = data.get("ignored")
    history = data.get("history")

    return {
        "ignored":
            ignored
            if isinstance(ignored, list)
            else [],
        "history":
            history
            if isinstance(history, list)
            else [],
    }


def _save_ronny_ai_state(
    state: dict,
) -> None:
    path = ContextPaths.RONNY_AI_STATE_FILE

    path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    path.write_text(
        json.dumps(
            state,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )



@router.get("/api/phoenix/home-assistant/ronny-ai/state")
async def phoenix_home_assistant_ronny_ai_state():
    state = _load_ronny_ai_state()

    return {
        "status": "ok",
        **state,
    }


@router.post("/api/phoenix/home-assistant/ronny-ai/ignore")
async def phoenix_home_assistant_ronny_ai_ignore(
    payload: dict = Body(...),
):
    key = str(
        payload.get("key") or ""
    ).strip()

    if not key:
        return {
            "status": "error",
            "error": "missing_key",
        }

    state = _load_ronny_ai_state()

    ignored = list(state.get("ignored") or [])

    if key not in ignored:
        ignored.append(key)

    state["ignored"] = ignored

    _save_ronny_ai_state(state)

    return {
        "status": "ok",
        "ignored": ignored,
    }


@router.post("/api/phoenix/home-assistant/ronny-ai/unignore")
async def phoenix_home_assistant_ronny_ai_unignore(
    payload: dict = Body(...),
):
    key = str(
        payload.get("key") or ""
    ).strip()

    if not key:
        return {
            "status": "error",
            "error": "missing_key",
        }

    state = _load_ronny_ai_state()

    ignored = [
        item
        for item in (
            state.get("ignored") or []
        )
        if item != key
    ]

    state["ignored"] = ignored

    _save_ronny_ai_state(state)

    return {
        "status": "ok",
        "ignored": ignored,
    }


@router.delete("/api/phoenix/home-assistant/ronny-ai/history/{entry_id}")
async def phoenix_home_assistant_ronny_ai_history_delete(
    entry_id: str,
):
    state = _load_ronny_ai_state()

    history = list(
        state.get("history") or []
    )

    before = len(history)

    state["history"] = [
        entry
        for entry in history
        if str(
            entry.get("id") or ""
        ) != entry_id
    ]

    _save_ronny_ai_state(state)

    return {
        "status": "ok",
        "removed": (
            before -
            len(state["history"])
        ),
        "count": len(
            state["history"]
        ),
    }


@router.post("/api/phoenix/home-assistant/ronny-ai/history")
async def phoenix_home_assistant_ronny_ai_history(
    payload: dict = Body(...),
):
    state = _load_ronny_ai_state()

    history = list(
        state.get("history") or []
    )

    entry = {
        "id": str(
            payload.get("id") or ""
        ),
        "type": str(
            payload.get("type") or ""
        ),
        "action": str(
            payload.get("action") or ""
        ),
        "target_id": str(
            payload.get("target_id") or ""
        ),
        "target_name": str(
            payload.get("target_name") or ""
        ),
        "old_value": payload.get(
            "old_value"
        ),
        "new_value": payload.get(
            "new_value"
        ),
        "meta": payload.get("meta") or {},
        "timestamp": str(
            payload.get("timestamp") or ""
        ),
    }

    history.insert(
        0,
        entry
    )

    # Verlauf begrenzen,
    # damit die Datei nicht endlos wächst.
    state["history"] = history[:500]

    _save_ronny_ai_state(state)

    return {
        "status": "ok",
        "entry": entry,
        "count": len(
            state["history"]
        ),
    }


@router.get("/api/phoenix/home-assistant/status")
async def phoenix_home_assistant_status():
    """Liest zentrale Home-Assistant-Systemdaten read-only."""
    import socket
    import time
    from datetime import datetime, timezone
    from urllib.parse import urlparse

    started_at = time.perf_counter()

    result = await ha_ws_call({
        "type": "get_config",
    })

    response_time_ms = round(
        (time.perf_counter() - started_at) * 1000,
        1,
    )

    if not result.get("ok"):
        return {
            "status": "error",
            "connected": False,
            "error": result.get(
                "error",
                "Home Assistant nicht erreichbar",
            ),
        }

    config = result.get("result") or {}

    internal_url = config.get("internal_url")

    internal_host = None
    ip_address = None

    if internal_url:
        try:
            internal_host = urlparse(
                internal_url
            ).hostname

            if internal_host:
                ip_address = socket.gethostbyname(
                    internal_host
                )
        except (OSError, ValueError):
            ip_address = None

    checked_at = datetime.now(
        timezone.utc
    ).isoformat()

    states_result = await ha_ws_call({
        "type": "get_states",
    })

    states = (
        states_result.get("result") or []
        if states_result.get("ok")
        else []
    )

    def find_state(*entity_ids):
        for entity_id in entity_ids:
            for item in states:
                if item.get("entity_id") == entity_id:
                    return item
        return None

    core_update = find_state(
        "update.home_assistant_core_update",
        "update.home_assistant_core",
    )

    uptime = find_state(
        "sensor.uptime",
        "sensor.home_assistant_uptime",
    )

    last_boot = find_state(
        "sensor.last_boot",
        "sensor.home_assistant_last_boot",
    )

    update_data = None

    if core_update:
        attributes = core_update.get("attributes") or {}

        update_data = {
            "state": core_update.get("state"),
            "installed_version":
                attributes.get("installed_version"),
            "latest_version":
                attributes.get("latest_version"),
            "release_url":
                attributes.get("release_url"),
        }

    components = config.get("components") or []

    supervisor_data = {}
    core_data = {}
    os_data = {}
    network_data = {}
    primary_network = None

    try:
        core_result = supervisor_request(
            "GET",
            "/core/info",
        )
        core_data = core_result.get("data") or {}
    except Exception:
        core_data = {}

    try:
        supervisor_result = supervisor_request(
            "GET",
            "/supervisor/info",
        )
        supervisor_data = (
            supervisor_result.get("data") or {}
        )
    except Exception:
        supervisor_data = {}

    try:
        os_result = supervisor_request(
            "GET",
            "/os/info",
        )
        os_data = os_result.get("data") or {}
    except Exception:
        os_data = {}

    try:
        network_result = supervisor_request(
            "GET",
            "/network/info",
        )
        network_data = (
            network_result.get("data") or {}
        )

        for interface in (
            network_data.get("interfaces") or []
        ):
            if interface.get("primary") is True:
                primary_network = interface
                break

    except Exception:
        network_data = {}
        primary_network = None

    lan_ip = None
    gateway = None

    if primary_network:
        ipv4 = primary_network.get("ipv4") or {}
        addresses = ipv4.get("address") or []

        if addresses:
            lan_ip = str(
                addresses[0]
            ).split("/", 1)[0]

        gateway = ipv4.get("gateway")

    return {
        "status": "ok",
        "connected": True,
        "response_time_ms": response_time_ms,
        "checked_at": checked_at,
        "home_assistant": {
            "host": internal_host,
            "ip_address": ip_address,
            "location_name":
                config.get("location_name"),
            "version":
                config.get("version"),
            "time_zone":
                config.get("time_zone"),
            "unit_system":
                config.get("unit_system"),
            "internal_url":
                config.get("internal_url"),
            "external_url":
                config.get("external_url"),
            "country":
                config.get("country"),
            "language":
                config.get("language"),
            "state":
                config.get("state"),
            "safe_mode":
                config.get("safe_mode"),
            "recovery_mode":
                config.get("recovery_mode"),
            "components_count":
                len(components),
            "core_update":
                update_data,
            "uptime":
                uptime.get("state")
                if uptime else None,
            "last_boot":
                last_boot.get("state")
                if last_boot else None,
        },
        "system": {
            "core": {
                "version":
                    core_data.get("version"),
                "latest_version":
                    core_data.get("version_latest"),
                "update_available":
                    core_data.get("update_available"),
                "machine":
                    core_data.get("machine"),
                "architecture":
                    core_data.get("arch"),
            },
            "supervisor": {
                "version":
                    supervisor_data.get("version"),
                "latest_version":
                    supervisor_data.get("version_latest"),
                "update_available":
                    supervisor_data.get("update_available"),
                "architecture":
                    supervisor_data.get("arch"),
                "channel":
                    supervisor_data.get("channel"),
                "healthy":
                    supervisor_data.get("healthy"),
                "supported":
                    supervisor_data.get("supported"),
                "timezone":
                    supervisor_data.get("timezone"),
            },
            "os": {
                "version":
                    os_data.get("version"),
                "latest_version":
                    os_data.get("version_latest"),
                "update_available":
                    os_data.get("update_available"),
                "board":
                    os_data.get("board"),
                "boot":
                    os_data.get("boot"),
                "data_disk":
                    os_data.get("data_disk"),
            },
            "network": {
                "interface":
                    primary_network.get("interface")
                    if primary_network else None,
                "connected":
                    primary_network.get("connected")
                    if primary_network else None,
                "ip_address":
                    lan_ip,
                "gateway":
                    gateway,
                "host_internet":
                    network_data.get("host_internet"),
                "supervisor_internet":
                    network_data.get("supervisor_internet"),
            },
        },
    }


@router.get("/api/phoenix/home-assistant/translations")
async def phoenix_home_assistant_translations(
    language: str = "de",
):
    """Liest Home-Assistant-Service-Übersetzungen read-only ein."""

    result = await ha_ws_call({
        "type": "frontend/get_translations",
        "language": language,
        "category": "services",
    })

    if not result.get("ok"):
        return {
            "status": "error",
            "language": language,
            "translations": {},
            "error": result.get(
                "error",
                "Home-Assistant-Übersetzungen nicht erreichbar",
            ),
        }

    return {
        "status": "ok",
        "language": language,
        "translations": result.get("result") or {},
    }


@router.get("/api/phoenix/home-assistant/services")
async def phoenix_home_assistant_services():
    """Liest die verfügbaren Home-Assistant-Aktionen/Dienste ein."""

    result = await ha_rest_call(
        "GET",
        "services",
    )

    if not result.get("ok"):
        return {
            "status": "error",
            "count": 0,
            "services": [],
            "error": result.get(
                "error",
                "Home-Assistant-Aktionen nicht erreichbar",
            ),
        }

    raw_domains = result.get("result") or []
    services = []

    for domain_data in raw_domains:
        domain = domain_data.get("domain")

        if not domain:
            continue

        for service_name, service_data in (
            domain_data.get("services") or {}
        ).items():
            services.append({
                "action": f"{domain}.{service_name}",
                "domain": domain,
                "service": service_name,
                "name": (
                    service_data.get("name")
                    or service_name
                ),
                "description": (
                    service_data.get("description")
                    or ""
                ),
                "fields": (
                    service_data.get("fields")
                    or {}
                ),
                "target": (
                    service_data.get("target")
                    or {}
                ),
            })

    services.sort(
        key=lambda item: item["action"]
    )

    return {
        "status": "ok",
        "count": len(services),
        "services": services,
    }


@router.get("/api/phoenix/home-assistant/themes")
async def phoenix_home_assistant_themes():
    """Liest verfügbare Home-Assistant-Themes read-only ein."""

    result = await ha_ws_call({
        "type": "frontend/get_themes",
    })

    if not result.get("ok"):
        return {
            "status": "error",
            "count": 0,
            "themes": [],
            "error": result.get(
                "error",
                "Home-Assistant-Themes nicht erreichbar",
            ),
        }

    payload = result.get("result") or {}
    themes = payload.get("themes") or {}

    names = sorted(
        [
            str(name)
            for name in themes.keys()
            if name
        ],
        key=str.lower,
    )

    if "default" not in names:
        names.insert(0, "default")

    return {
        "status": "ok",
        "count": len(names),
        "themes": names,
        "default_theme": payload.get("default_theme"),
        "default_dark_theme": payload.get("default_dark_theme"),
    }


@router.get("/api/phoenix/home-assistant/config-entries")
async def phoenix_home_assistant_config_entries():
    """Liest Home-Assistant-Config-Entries read-only ein."""

    result = await ha_ws_call({
        "type": "config_entries/get",
    })

    if not result.get("ok"):
        return {
            "status": "error",
            "count": 0,
            "config_entries": [],
            "error": result.get(
                "error",
                "Home-Assistant-Config-Entries nicht erreichbar",
            ),
        }

    entries = []

    for item in result.get("result") or []:
        entry_id = item.get("entry_id")

        if not entry_id:
            continue

        entries.append({
            "entry_id": entry_id,
            "domain": item.get("domain") or "",
            "title": item.get("title") or entry_id,
            "state": item.get("state"),
            "disabled_by": item.get("disabled_by"),
        })

    entries.sort(
        key=lambda item: (
            item["title"].lower(),
            item["domain"].lower(),
            item["entry_id"],
        )
    )

    return {
        "status": "ok",
        "count": len(entries),
        "config_entries": entries,
    }


@router.get("/api/phoenix/home-assistant/conversation-agents")
async def phoenix_home_assistant_conversation_agents():
    """Liest verfügbare Home-Assistant-Conversation-Agents read-only ein."""

    result = await ha_ws_call({
        "type": "conversation/agent/list",
    })

    if not result.get("ok"):
        return {
            "status": "error",
            "count": 0,
            "agents": [],
            "error": result.get(
                "error",
                "Home-Assistant-Conversation-Agents nicht erreichbar",
            ),
        }

    payload = result.get("result") or {}
    source_agents = payload.get("agents") or []
    agents = []

    for item in source_agents:
        agent_id = item.get("id")

        if not agent_id:
            continue

        agents.append({
            "id": agent_id,
            "name": item.get("name") or agent_id,
            "supported_languages": item.get("supported_languages"),
        })

    agents.sort(
        key=lambda item: (
            item["name"].lower(),
            item["id"],
        )
    )

    return {
        "status": "ok",
        "count": len(agents),
        "agents": agents,
    }


@router.get("/api/phoenix/home-assistant/statistics")
async def phoenix_home_assistant_statistics():
    """Liest verfügbare Home-Assistant-Statistik-IDs read-only ein."""

    result = await ha_ws_call({
        "type": "recorder/list_statistic_ids",
    })

    if not result.get("ok"):
        return {
            "status": "error",
            "count": 0,
            "statistics": [],
            "error": result.get(
                "error",
                "Home-Assistant-Statistiken nicht erreichbar",
            ),
        }

    statistics = []

    for item in result.get("result") or []:
        statistic_id = item.get("statistic_id")

        if not statistic_id:
            continue

        statistics.append({
            "statistic_id": statistic_id,
            "name": item.get("name"),
            "unit": item.get(
                "display_unit_of_measurement"
            ),
            "source": item.get("source"),
        })

    statistics.sort(
        key=lambda item: item["statistic_id"].lower()
    )

    return {
        "status": "ok",
        "count": len(statistics),
        "statistics": statistics,
    }


@router.get("/api/phoenix/home-assistant/entities")
async def phoenix_home_assistant_entities():
    """Liest Home-Assistant-Entities read-only ein."""

    result = await ha_ws_call({
        "type": "get_states",
    })

    if not result.get("ok"):
        return {
            "status": "error",
            "count": 0,
            "entities": [],
            "error": result.get(
                "error",
                "Home-Assistant-Entities nicht erreichbar",
            ),
        }

    states = result.get("result") or []
    entities = []

    for state in states:
        entity_id = state.get("entity_id")

        if not entity_id:
            continue

        attributes = state.get("attributes") or {}

        entities.append({
            "entity_id": entity_id,
            "domain": entity_id.split(".", 1)[0],
            "state": state.get("state"),
            "name": attributes.get(
                "friendly_name",
                entity_id,
            ),
            "options": (
                attributes.get("options")
                if isinstance(attributes.get("options"), list)
                else []
            ),
            "list_attributes": {
                key: value
                for key, value in attributes.items()
                if isinstance(value, list)
            },
        })

    entities.sort(
        key=lambda item: (
            item["domain"],
            item["name"].lower(),
            item["entity_id"],
        )
    )

    return {
        "status": "ok",
        "count": len(entities),
        "entities": entities,
    }


@router.get("/api/phoenix/home-assistant/devices")
async def phoenix_home_assistant_devices():
    """Liest die Home-Assistant-Geräte-Registry read-only ein."""

    result = await ha_ws_call({
        "type": "config/device_registry/list",
    })

    if not result.get("ok"):
        return {
            "status": "error",
            "count": 0,
            "devices": [],
            "error": result.get(
                "error",
                "Home-Assistant-Geräte nicht erreichbar",
            ),
        }

    registry = result.get("result") or []
    devices = []

    for device in registry:
        device_id = device.get("id")

        if not device_id:
            continue

        devices.append({
            "id": device_id,
            "name": (
                device.get("name_by_user")
                or device.get("name")
                or device_id
            ),
            "manufacturer": device.get("manufacturer"),
            "model": device.get("model"),
            "area_id": device.get("area_id"),
            "labels": device.get("labels") or [],
            "disabled_by": device.get("disabled_by"),
        })

    devices.sort(
        key=lambda item: (
            item["name"].lower(),
            item["id"],
        )
    )

    return {
        "status": "ok",
        "count": len(devices),
        "devices": devices,
    }


@router.get("/api/phoenix/home-assistant/floors")
async def phoenix_home_assistant_floors():
    """Liest die Home-Assistant-Etagen-Registry read-only ein."""

    result = await ha_ws_call({
        "type": "config/floor_registry/list",
    })

    if not result.get("ok"):
        return {
            "status": "error",
            "count": 0,
            "floors": [],
            "error": result.get(
                "error",
                "Home-Assistant-Etagen nicht erreichbar",
            ),
        }

    registry = result.get("result") or []
    floors = []

    for floor in registry:
        floor_id = floor.get("floor_id")

        if not floor_id:
            continue

        floors.append({
            "floor_id": floor_id,
            "name": floor.get("name") or floor_id,
            "icon": floor.get("icon"),
            "aliases": floor.get("aliases") or [],
            "level": floor.get("level"),
        })

    floors.sort(
        key=lambda item: (
            item["name"].lower(),
            item["floor_id"],
        )
    )

    return {
        "status": "ok",
        "count": len(floors),
        "floors": floors,
    }


@router.get("/api/phoenix/home-assistant/areas")
async def phoenix_home_assistant_areas():
    """Liest die Home-Assistant-Bereichs-Registry read-only ein."""

    result = await ha_ws_call({
        "type": "config/area_registry/list",
    })

    if not result.get("ok"):
        return {
            "status": "error",
            "count": 0,
            "areas": [],
            "error": result.get(
                "error",
                "Home-Assistant-Bereiche nicht erreichbar",
            ),
        }

    registry = result.get("result") or []
    areas = []

    for area in registry:
        area_id = area.get("area_id")

        if not area_id:
            continue

        areas.append({
            "area_id": area_id,
            "name": area.get("name") or area_id,
            "floor_id": area.get("floor_id"),
            "icon": area.get("icon"),
            "aliases": area.get("aliases") or [],
            "labels": area.get("labels") or [],
            "temperature_entity_id": (
                area.get("temperature_entity_id")
            ),
            "humidity_entity_id": (
                area.get("humidity_entity_id")
            ),
        })

    areas.sort(
        key=lambda item: (
            item["name"].lower(),
            item["area_id"],
        )
    )

    return {
        "status": "ok",
        "count": len(areas),
        "areas": areas,
    }


@router.get("/api/phoenix/home-assistant/entity-registry")
async def phoenix_home_assistant_entity_registry():
    """Liest die Home-Assistant-Entity-Registry read-only ein."""

    result = await ha_ws_call({
        "type": "config/entity_registry/list",
    })

    if not result.get("ok"):
        return {
            "status": "error",
            "count": 0,
            "entities": [],
            "error": result.get(
                "error",
                "Home-Assistant-Entity-Registry nicht erreichbar",
            ),
        }

    registry = result.get("result") or []
    entities = []

    for entity in registry:
        entity_id = entity.get("entity_id")

        if not entity_id:
            continue

        entities.append({
            "entity_id": entity_id,
            "registry_id": entity.get("id"),
            "device_id": entity.get("device_id"),
            "area_id": entity.get("area_id"),
            "name": entity.get("name"),
            "original_name": entity.get("original_name"),
            "platform": entity.get("platform"),
            "disabled_by": entity.get("disabled_by"),
            "hidden_by": entity.get("hidden_by"),
            "entity_category": entity.get("entity_category"),
            "labels": entity.get("labels") or [],
        })

    entities.sort(
        key=lambda item: item["entity_id"]
    )

    return {
        "status": "ok",
        "count": len(entities),
        "entities": entities,
    }


@router.get("/api/phoenix/home-assistant/assignments")
async def phoenix_home_assistant_assignments():
    """Ermittelt die effektiven Bereichszuordnungen read-only."""

    areas_result = await ha_ws_call({
        "type": "config/area_registry/list",
    })
    devices_result = await ha_ws_call({
        "type": "config/device_registry/list",
    })
    entities_result = await ha_ws_call({
        "type": "config/entity_registry/list",
    })

    results = {
        "areas": areas_result,
        "devices": devices_result,
        "entities": entities_result,
    }

    for source, result in results.items():
        if not result.get("ok"):
            return {
                "status": "error",
                "error": result.get(
                    "error",
                    f"{source} nicht erreichbar",
                ),
            }

    areas = areas_result.get("result") or []
    devices = devices_result.get("result") or []
    entities = entities_result.get("result") or []

    area_map = {
        area.get("area_id"): {
            "area_id": area.get("area_id"),
            "name": area.get("name") or area.get("area_id"),
            "labels": area.get("labels") or [],
        }
        for area in areas
        if area.get("area_id")
    }

    device_map = {
        device.get("id"): device
        for device in devices
        if device.get("id")
    }

    device_items = []

    for device in devices:
        device_id = device.get("id")

        if not device_id:
            continue

        area_id = device.get("area_id")

        device_items.append({
            "device_id": device_id,
            "name": (
                device.get("name_by_user")
                or device.get("name")
                or device_id
            ),
            "area_id": area_id,
            "area_name": (
                area_map.get(area_id, {}).get("name")
                if area_id
                else None
            ),
        })

    entity_items = []

    for entity in entities:
        entity_id = entity.get("entity_id")

        if not entity_id:
            continue

        device_id = entity.get("device_id")
        own_area_id = entity.get("area_id")

        device = device_map.get(device_id) or {}
        device_area_id = device.get("area_id")

        if own_area_id:
            effective_area_id = own_area_id
            area_source = "entity"
        elif device_area_id:
            effective_area_id = device_area_id
            area_source = "device"
        else:
            effective_area_id = None
            area_source = "none"

        entity_items.append({
            "entity_id": entity_id,
            "device_id": device_id,
            "entity_area_id": own_area_id,
            "device_area_id": device_area_id,
            "effective_area_id": effective_area_id,
            "effective_area_name": (
                area_map.get(
                    effective_area_id,
                    {},
                ).get("name")
                if effective_area_id
                else None
            ),
            "area_source": area_source,
        })

    device_items.sort(
        key=lambda item: (
            item["name"].lower(),
            item["device_id"],
        )
    )

    entity_items.sort(
        key=lambda item: item["entity_id"]
    )

    return {
        "status": "ok",
        "counts": {
            "areas": len(area_map),
            "devices": len(device_items),
            "entities": len(entity_items),
            "devices_with_area": sum(
                1 for item in device_items
                if item["area_id"]
            ),
            "entities_with_own_area": sum(
                1 for item in entity_items
                if item["area_source"] == "entity"
            ),
            "entities_inheriting_device_area": sum(
                1 for item in entity_items
                if item["area_source"] == "device"
            ),
            "entities_without_area": sum(
                1 for item in entity_items
                if item["area_source"] == "none"
            ),
        },
        "areas": sorted(
            area_map.values(),
            key=lambda item: item["name"].lower(),
        ),
        "devices": device_items,
        "entities": entity_items,
    }



@router.post("/api/phoenix/home-assistant/areas")
async def phoenix_home_assistant_create_area(
    name: str,
    confirm: bool = False,
):
    """Erstellt sicher einen neuen Home-Assistant-Bereich."""

    name = name.strip()

    if not name:
        return {
            "status": "error",
            "created": False,
            "error": "Bereichsname darf nicht leer sein",
        }

    if not confirm:
        return {
            "status": "confirmation_required",
            "created": False,
            "name": name,
        }

    areas_result = await ha_ws_call({
        "type": "config/area_registry/list",
    })

    if not areas_result.get("ok"):
        return {
            "status": "error",
            "created": False,
            "name": name,
            "error": areas_result.get(
                "error",
                "Area Registry nicht erreichbar",
            ),
        }

    areas = areas_result.get("result") or []

    if any(
        str(area.get("name") or "").strip().casefold()
        == name.casefold()
        for area in areas
    ):
        return {
            "status": "error",
            "created": False,
            "name": name,
            "error": "Bereich existiert bereits",
        }

    create_result = await ha_ws_call({
        "type": "config/area_registry/create",
        "name": name,
    })

    if not create_result.get("ok"):
        return {
            "status": "error",
            "created": False,
            "name": name,
            "error": create_result.get(
                "error",
                "Bereich konnte nicht erstellt werden",
            ),
        }

    area = create_result.get("result") or {}

    return {
        "status": "ok",
        "created": True,
        "area_id": area.get("area_id"),
        "name": area.get("name") or name,
        "area": area,
    }


@router.post("/api/phoenix/home-assistant/areas/{area_id}/rename")
async def phoenix_home_assistant_rename_area(
    area_id: str,
    name: str,
    confirm: bool = False,
):
    """Benennt einen Home-Assistant-Bereich sicher um."""

    name = name.strip()

    if not name:
        return {
            "status": "error",
            "updated": False,
            "area_id": area_id,
            "error": "Bereichsname darf nicht leer sein",
        }

    if not confirm:
        return {
            "status": "confirmation_required",
            "updated": False,
            "area_id": area_id,
            "name": name,
        }

    areas_result = await ha_ws_call({
        "type": "config/area_registry/list",
    })

    if not areas_result.get("ok"):
        return {
            "status": "error",
            "updated": False,
            "area_id": area_id,
            "error": areas_result.get(
                "error",
                "Area Registry nicht erreichbar",
            ),
        }

    areas = areas_result.get("result") or []

    area = next(
        (
            item for item in areas
            if item.get("area_id") == area_id
        ),
        None,
    )

    if area is None:
        return {
            "status": "error",
            "updated": False,
            "area_id": area_id,
            "error": "Bereich nicht gefunden",
        }

    if any(
        item.get("area_id") != area_id
        and str(item.get("name") or "").strip().casefold()
        == name.casefold()
        for item in areas
    ):
        return {
            "status": "error",
            "updated": False,
            "area_id": area_id,
            "name": name,
            "error": "Bereichsname existiert bereits",
        }

    update_result = await ha_ws_call({
        "type": "config/area_registry/update",
        "area_id": area_id,
        "name": name,
    })

    if not update_result.get("ok"):
        return {
            "status": "error",
            "updated": False,
            "area_id": area_id,
            "name": name,
            "error": update_result.get(
                "error",
                "Bereich konnte nicht umbenannt werden",
            ),
        }

    updated_area = update_result.get("result") or {}

    return {
        "status": "ok",
        "updated": True,
        "area_id": updated_area.get("area_id") or area_id,
        "name": updated_area.get("name") or name,
        "area": updated_area,
    }


@router.post("/api/phoenix/home-assistant/areas/{area_id}/delete")
async def phoenix_home_assistant_delete_area(
    area_id: str,
    confirm: bool = False,
):
    """Löscht einen leeren Home-Assistant-Bereich sicher."""

    if not confirm:
        return {
            "status": "confirmation_required",
            "deleted": False,
            "area_id": area_id,
        }

    areas_result = await ha_ws_call({
        "type": "config/area_registry/list",
    })

    if not areas_result.get("ok"):
        return {
            "status": "error",
            "deleted": False,
            "area_id": area_id,
            "error": areas_result.get(
                "error",
                "Area Registry nicht erreichbar",
            ),
        }

    areas = areas_result.get("result") or []

    area = next(
        (
            item for item in areas
            if item.get("area_id") == area_id
        ),
        None,
    )

    if area is None:
        return {
            "status": "error",
            "deleted": False,
            "area_id": area_id,
            "error": "Bereich nicht gefunden",
        }

    devices_result = await ha_ws_call({
        "type": "config/device_registry/list",
    })

    if not devices_result.get("ok"):
        return {
            "status": "error",
            "deleted": False,
            "area_id": area_id,
            "error": devices_result.get(
                "error",
                "Device Registry nicht erreichbar",
            ),
        }

    entities_result = await ha_ws_call({
        "type": "config/entity_registry/list",
    })

    if not entities_result.get("ok"):
        return {
            "status": "error",
            "deleted": False,
            "area_id": area_id,
            "error": entities_result.get(
                "error",
                "Entity Registry nicht erreichbar",
            ),
        }

    devices = devices_result.get("result") or []
    entities = entities_result.get("result") or []

    area_device_ids = {
        item.get("id")
        for item in devices
        if item.get("area_id") == area_id
        and item.get("id")
    }

    direct_entities = [
        item for item in entities
        if item.get("area_id") == area_id
    ]

    inherited_entities = [
        item for item in entities
        if (
            not item.get("area_id")
            and item.get("device_id") in area_device_ids
        )
    ]

    if area_device_ids or direct_entities or inherited_entities:
        return {
            "status": "blocked",
            "deleted": False,
            "area_id": area_id,
            "error": "Bereich ist noch in Verwendung",
            "dependencies": {
                "devices": len(area_device_ids),
                "direct_entities": len(direct_entities),
                "inherited_entities": len(inherited_entities),
            },
        }

    delete_result = await ha_ws_call({
        "type": "config/area_registry/delete",
        "area_id": area_id,
    })

    if not delete_result.get("ok"):
        return {
            "status": "error",
            "deleted": False,
            "area_id": area_id,
            "error": delete_result.get(
                "error",
                "Bereich konnte nicht gelöscht werden",
            ),
        }

    return {
        "status": "ok",
        "deleted": True,
        "area_id": area_id,
        "name": area.get("name") or area_id,
    }


@router.post("/api/phoenix/home-assistant/devices/{device_id}/rename")
async def phoenix_home_assistant_rename_device(
    device_id: str,
    name: str = Body(..., embed=True),
):
    """Ändert den benutzerdefinierten Namen eines Home-Assistant-Geräts."""

    name = name.strip()

    if not name:
        return {
            "status": "error",
            "updated": False,
            "device_id": device_id,
            "error": "Gerätename darf nicht leer sein",
        }

    devices_result = await ha_ws_call({
        "type": "config/device_registry/list",
    })

    if not devices_result.get("ok"):
        return {
            "status": "error",
            "updated": False,
            "device_id": device_id,
            "error": devices_result.get(
                "error",
                "Device Registry nicht erreichbar",
            ),
        }

    devices = devices_result.get("result") or []

    device = next(
        (
            item
            for item in devices
            if item.get("id") == device_id
        ),
        None,
    )

    if device is None:
        return {
            "status": "error",
            "updated": False,
            "device_id": device_id,
            "error": "Gerät nicht gefunden",
        }

    update_result = await ha_ws_call({
        "type": "config/device_registry/update",
        "device_id": device_id,
        "name_by_user": name,
    })

    if not update_result.get("ok"):
        return {
            "status": "error",
            "updated": False,
            "device_id": device_id,
            "error": update_result.get(
                "error",
                "Gerät konnte nicht umbenannt werden",
            ),
        }

    return {
        "status": "ok",
        "updated": True,
        "device_id": device_id,
        "name": name,
    }


@router.post("/api/phoenix/home-assistant/devices/{device_id}/name")
async def phoenix_home_assistant_set_device_name(
    device_id: str,
    name: str | None = None,
    confirm: bool = False,
):
    """Ändert den Anzeigenamen eines Home-Assistant-Geräts."""

    clean_name = (
        name.strip()
        if isinstance(name, str) and name.strip()
        else None
    )

    if not confirm:
        return {
            "status": "confirmation_required",
            "updated": False,
            "device_id": device_id,
            "name": clean_name,
        }

    devices_result = await ha_ws_call({
        "type": "config/device_registry/list",
    })

    if not devices_result.get("ok"):
        return {
            "status": "error",
            "updated": False,
            "device_id": device_id,
            "error": devices_result.get(
                "error",
                "Device Registry nicht erreichbar",
            ),
        }

    devices = devices_result.get("result") or []

    device = next(
        (
            item
            for item in devices
            if item.get("id") == device_id
        ),
        None,
    )

    if device is None:
        return {
            "status": "error",
            "updated": False,
            "device_id": device_id,
            "error": "Gerät nicht gefunden",
        }

    update_result = await ha_ws_call({
        "type": "config/device_registry/update",
        "device_id": device_id,
        "name_by_user": clean_name,
    })

    if not update_result.get("ok"):
        return {
            "status": "error",
            "updated": False,
            "device_id": device_id,
            "error": update_result.get(
                "error",
                "Gerätename konnte nicht geändert werden",
            ),
        }

    return {
        "status": "ok",
        "updated": True,
        "device_id": device_id,
        "name": clean_name,
    }


@router.post("/api/phoenix/home-assistant/devices/{device_id}/area")
async def phoenix_home_assistant_set_device_area(
    device_id: str,
    area_id: str | None = None,
    confirm: bool = False,
):
    """Ändert die Bereichszuordnung eines HA-Geräts."""

    if not confirm:
        return {
            "status": "confirmation_required",
            "updated": False,
            "device_id": device_id,
            "area_id": area_id,
        }

    devices_result = await ha_ws_call({
        "type": "config/device_registry/list",
    })

    if not devices_result.get("ok"):
        return {
            "status": "error",
            "updated": False,
            "device_id": device_id,
            "error": devices_result.get(
                "error",
                "Device Registry nicht erreichbar",
            ),
        }

    devices = devices_result.get("result") or []

    device = next(
        (
            item
            for item in devices
            if item.get("id") == device_id
        ),
        None,
    )

    if device is None:
        return {
            "status": "error",
            "updated": False,
            "device_id": device_id,
            "error": "Gerät nicht gefunden",
        }

    if area_id is not None:
        areas_result = await ha_ws_call({
            "type": "config/area_registry/list",
        })

        if not areas_result.get("ok"):
            return {
                "status": "error",
                "updated": False,
                "device_id": device_id,
                "area_id": area_id,
                "error": areas_result.get(
                    "error",
                    "Area Registry nicht erreichbar",
                ),
            }

        areas = areas_result.get("result") or []

        if not any(
            area.get("area_id") == area_id
            for area in areas
        ):
            return {
                "status": "error",
                "updated": False,
                "device_id": device_id,
                "area_id": area_id,
                "error": "Bereich nicht gefunden",
            }

    update_result = await ha_ws_call({
        "type": "config/device_registry/update",
        "device_id": device_id,
        "area_id": area_id,
    })

    if not update_result.get("ok"):
        return {
            "status": "error",
            "updated": False,
            "device_id": device_id,
            "area_id": area_id,
            "error": update_result.get(
                "error",
                "Gerätezuordnung konnte nicht geändert werden",
            ),
        }

    return {
        "status": "ok",
        "updated": True,
        "device_id": device_id,
        "area_id": area_id,
    }


@router.post("/api/phoenix/home-assistant/entities/{entity_id}/name")
async def phoenix_home_assistant_set_entity_name(
    entity_id: str,
    name: str | None = None,
    confirm: bool = False,
):
    """Ändert den Anzeigenamen einer Home-Assistant-Entität."""

    clean_name = (
        name.strip()
        if isinstance(name, str) and name.strip()
        else None
    )

    if not confirm:
        return {
            "status": "confirmation_required",
            "updated": False,
            "entity_id": entity_id,
            "name": clean_name,
        }

    entities_result = await ha_ws_call({
        "type": "config/entity_registry/list",
    })

    if not entities_result.get("ok"):
        return {
            "status": "error",
            "updated": False,
            "entity_id": entity_id,
            "error": entities_result.get(
                "error",
                "Entity Registry nicht erreichbar",
            ),
        }

    entities = entities_result.get("result") or []

    entity = next(
        (
            item
            for item in entities
            if item.get("entity_id") == entity_id
        ),
        None,
    )

    if entity is None:
        return {
            "status": "error",
            "updated": False,
            "entity_id": entity_id,
            "error": "Entity nicht gefunden",
        }

    update_result = await ha_ws_call({
        "type": "config/entity_registry/update",
        "entity_id": entity_id,
        "name": clean_name,
    })

    if not update_result.get("ok"):
        return {
            "status": "error",
            "updated": False,
            "entity_id": entity_id,
            "error": update_result.get(
                "error",
                "Entitätsname konnte nicht geändert werden",
            ),
        }

    return {
        "status": "ok",
        "updated": True,
        "entity_id": entity_id,
        "name": clean_name,
    }


@router.post("/api/phoenix/home-assistant/entities/{entity_id}/area")
async def phoenix_home_assistant_set_entity_area(
    entity_id: str,
    area_id: str | None = None,
    confirm: bool = False,
):
    """Ändert die eigene Bereichszuordnung einer HA-Entity."""

    if not confirm:
        return {
            "status": "confirmation_required",
            "updated": False,
            "entity_id": entity_id,
            "area_id": area_id,
        }

    entities_result = await ha_ws_call({
        "type": "config/entity_registry/list",
    })

    if not entities_result.get("ok"):
        return {
            "status": "error",
            "updated": False,
            "entity_id": entity_id,
            "error": entities_result.get(
                "error",
                "Entity Registry nicht erreichbar",
            ),
        }

    entities = entities_result.get("result") or []

    entity = next(
        (
            item
            for item in entities
            if item.get("entity_id") == entity_id
        ),
        None,
    )

    if entity is None:
        return {
            "status": "error",
            "updated": False,
            "entity_id": entity_id,
            "error": "Entity nicht gefunden",
        }

    if area_id is not None:
        areas_result = await ha_ws_call({
            "type": "config/area_registry/list",
        })

        if not areas_result.get("ok"):
            return {
                "status": "error",
                "updated": False,
                "entity_id": entity_id,
                "area_id": area_id,
                "error": areas_result.get(
                    "error",
                    "Area Registry nicht erreichbar",
                ),
            }

        areas = areas_result.get("result") or []

        if not any(
            area.get("area_id") == area_id
            for area in areas
        ):
            return {
                "status": "error",
                "updated": False,
                "entity_id": entity_id,
                "area_id": area_id,
                "error": "Bereich nicht gefunden",
            }

    update_result = await ha_ws_call({
        "type": "config/entity_registry/update",
        "entity_id": entity_id,
        "area_id": area_id,
    })

    if not update_result.get("ok"):
        return {
            "status": "error",
            "updated": False,
            "entity_id": entity_id,
            "area_id": area_id,
            "error": update_result.get(
                "error",
                "Entity-Zuordnung konnte nicht geändert werden",
            ),
        }

    return {
        "status": "ok",
        "updated": True,
        "entity_id": entity_id,
        "area_id": area_id,
    }


@router.get("/api/phoenix/home-assistant/labels")
async def phoenix_home_assistant_labels():
    """Liest die Home-Assistant-Label-Registry read-only."""

    result = await ha_ws_call({
        "type": "config/label_registry/list",
    })

    if not result.get("ok"):
        return {
            "status": "error",
            "error": result.get(
                "error",
                "Home-Assistant-Label-Registry nicht erreichbar",
            ),
        }

    registry = result.get("result") or []
    labels = []

    for label in registry:
        label_id = label.get("label_id")

        if not label_id:
            continue

        labels.append({
            "label_id": label_id,
            "name": label.get("name"),
            "color": label.get("color"),
            "icon": label.get("icon"),
            "description": label.get("description"),
        })

    labels.sort(
        key=lambda item: (
            item.get("name") or item["label_id"]
        ).casefold()
    )

    return {
        "status": "ok",
        "count": len(labels),
        "labels": labels,
    }


@router.post("/api/phoenix/home-assistant/labels")
async def phoenix_home_assistant_create_label(
    name: str,
    confirm: bool = False,
):
    """Erstellt ein Home-Assistant-Label nach expliziter Bestätigung."""

    clean_name = name.strip()

    if not clean_name:
        return {
            "status": "error",
            "created": False,
            "error": "Labelname darf nicht leer sein",
        }

    if not confirm:
        return {
            "status": "confirmation_required",
            "created": False,
            "name": clean_name,
        }

    registry_result = await ha_ws_call({
        "type": "config/label_registry/list",
    })

    if not registry_result.get("ok"):
        return {
            "status": "error",
            "created": False,
            "error": registry_result.get(
                "error",
                "Home-Assistant-Label-Registry nicht erreichbar",
            ),
        }

    registry = registry_result.get("result") or []

    duplicate = next(
        (
            label
            for label in registry
            if str(label.get("name") or "").casefold()
            == clean_name.casefold()
        ),
        None,
    )

    if duplicate:
        return {
            "status": "error",
            "created": False,
            "error": "Ein Label mit diesem Namen existiert bereits",
            "label_id": duplicate.get("label_id"),
        }

    result = await ha_ws_call({
        "type": "config/label_registry/create",
        "name": clean_name,
    })

    if not result.get("ok"):
        return {
            "status": "error",
            "created": False,
            "error": result.get(
                "error",
                "Label konnte nicht erstellt werden",
            ),
        }

    label = result.get("result") or {}

    return {
        "status": "ok",
        "created": True,
        "label": {
            "label_id": label.get("label_id"),
            "name": label.get("name"),
            "color": label.get("color"),
            "icon": label.get("icon"),
            "description": label.get("description"),
        },
    }


@router.post(
    "/api/phoenix/home-assistant/labels/{label_id}/rename"
)
async def phoenix_home_assistant_rename_label(
    label_id: str,
    name: str,
    confirm: bool = False,
):
    """Benennt ein Home-Assistant-Label sicher um."""

    clean_name = name.strip()

    if not clean_name:
        return {
            "status": "error",
            "updated": False,
            "error": "Labelname darf nicht leer sein",
        }

    if not confirm:
        return {
            "status": "confirmation_required",
            "updated": False,
            "label_id": label_id,
            "name": clean_name,
        }

    registry_result = await ha_ws_call({
        "type": "config/label_registry/list",
    })

    if not registry_result.get("ok"):
        return {
            "status": "error",
            "updated": False,
            "error": registry_result.get(
                "error",
                "Home-Assistant-Label-Registry nicht erreichbar",
            ),
        }

    registry = registry_result.get("result") or []

    current = next(
        (
            label
            for label in registry
            if label.get("label_id") == label_id
        ),
        None,
    )

    if current is None:
        return {
            "status": "error",
            "updated": False,
            "error": "Label wurde nicht gefunden",
        }

    duplicate = next(
        (
            label
            for label in registry
            if label.get("label_id") != label_id
            and str(label.get("name") or "").casefold()
            == clean_name.casefold()
        ),
        None,
    )

    if duplicate:
        return {
            "status": "error",
            "updated": False,
            "error": "Ein Label mit diesem Namen existiert bereits",
            "duplicate_label_id": duplicate.get("label_id"),
        }

    result = await ha_ws_call({
        "type": "config/label_registry/update",
        "label_id": label_id,
        "name": clean_name,
    })

    if not result.get("ok"):
        return {
            "status": "error",
            "updated": False,
            "error": result.get(
                "error",
                "Label konnte nicht umbenannt werden",
            ),
        }

    label = result.get("result") or {}

    return {
        "status": "ok",
        "updated": True,
        "label": {
            "label_id": label.get(
                "label_id",
                label_id,
            ),
            "name": label.get(
                "name",
                clean_name,
            ),
            "color": label.get("color"),
            "icon": label.get("icon"),
            "description": label.get("description"),
        },
    }


@router.post(
    "/api/phoenix/home-assistant/labels/{label_id}/delete"
)
async def phoenix_home_assistant_delete_label(
    label_id: str,
    confirm: bool = False,
):
    """Löscht ein HA-Label nur, wenn keine geschützten Abhängigkeiten bestehen."""

    if not confirm:
        return {
            "status": "confirmation_required",
            "deleted": False,
            "label_id": label_id,
        }

    registry_result = await ha_ws_call({
        "type": "config/label_registry/list",
    })

    if not registry_result.get("ok"):
        return {
            "status": "error",
            "deleted": False,
            "error": registry_result.get(
                "error",
                "Home-Assistant-Label-Registry nicht erreichbar",
            ),
        }

    registry = registry_result.get("result") or []

    current = next(
        (
            label
            for label in registry
            if label.get("label_id") == label_id
        ),
        None,
    )

    if current is None:
        return {
            "status": "error",
            "deleted": False,
            "error": "Label wurde nicht gefunden",
        }

    area_result = await ha_ws_call({
        "type": "config/area_registry/list",
    })

    device_result = await ha_ws_call({
        "type": "config/device_registry/list",
    })

    entity_result = await ha_ws_call({
        "type": "config/entity_registry/list",
    })

    for result, message in (
        (area_result, "Area-Registry nicht erreichbar"),
        (device_result, "Device-Registry nicht erreichbar"),
        (entity_result, "Entity-Registry nicht erreichbar"),
    ):
        if not result.get("ok"):
            return {
                "status": "error",
                "deleted": False,
                "error": result.get("error", message),
            }

    areas = [
        area
        for area in (area_result.get("result") or [])
        if label_id in (area.get("labels") or [])
    ]

    devices = [
        device
        for device in (device_result.get("result") or [])
        if label_id in (device.get("labels") or [])
    ]

    entities = [
        entity
        for entity in (entity_result.get("result") or [])
        if label_id in (entity.get("labels") or [])
    ]

    dependencies = {
        "areas": len(areas),
        "devices": len(devices),
        "entities": len(entities),
    }

    if any(dependencies.values()):
        return {
            "status": "blocked",
            "deleted": False,
            "label_id": label_id,
            "name": current.get("name"),
            "dependencies": dependencies,
        }

    result = await ha_ws_call({
        "type": "config/label_registry/delete",
        "label_id": label_id,
    })

    if not result.get("ok"):
        return {
            "status": "error",
            "deleted": False,
            "error": result.get(
                "error",
                "Label konnte nicht gelöscht werden",
            ),
        }

    return {
        "status": "ok",
        "deleted": True,
        "label_id": label_id,
        "name": current.get("name"),
    }


@router.post(
    "/api/phoenix/home-assistant/devices/{device_id}/labels"
)
async def phoenix_home_assistant_device_labels(
    device_id: str,
    labels: list[str],
    confirm: bool = False,
):
    """Setzt die Labels eines HA-Geräts nach expliziter Bestätigung."""

    clean_labels = list(dict.fromkeys(
        label.strip()
        for label in labels
        if label and label.strip()
    ))

    if not confirm:
        return {
            "status": "confirmation_required",
            "updated": False,
            "device_id": device_id,
            "labels": clean_labels,
        }

    device_result = await ha_ws_call({
        "type": "config/device_registry/list",
    })

    if not device_result.get("ok"):
        return {
            "status": "error",
            "updated": False,
            "error": device_result.get(
                "error",
                "Device-Registry nicht erreichbar",
            ),
        }

    device = next(
        (
            item
            for item in (device_result.get("result") or [])
            if item.get("id") == device_id
        ),
        None,
    )

    if device is None:
        return {
            "status": "error",
            "updated": False,
            "error": "Gerät wurde nicht gefunden",
        }

    label_result = await ha_ws_call({
        "type": "config/label_registry/list",
    })

    if not label_result.get("ok"):
        return {
            "status": "error",
            "updated": False,
            "error": label_result.get(
                "error",
                "Label-Registry nicht erreichbar",
            ),
        }

    known_labels = {
        item.get("label_id")
        for item in (label_result.get("result") or [])
        if item.get("label_id")
    }

    unknown_labels = [
        label
        for label in clean_labels
        if label not in known_labels
    ]

    if unknown_labels:
        return {
            "status": "error",
            "updated": False,
            "error": "Unbekannte Labels",
            "unknown_labels": unknown_labels,
        }

    result = await ha_ws_call({
        "type": "config/device_registry/update",
        "device_id": device_id,
        "labels": clean_labels,
    })

    if not result.get("ok"):
        return {
            "status": "error",
            "updated": False,
            "error": result.get(
                "error",
                "Geräte-Labels konnten nicht gespeichert werden",
            ),
        }

    return {
        "status": "ok",
        "updated": True,
        "device_id": device_id,
        "labels": clean_labels,
    }


@router.post(
    "/api/phoenix/home-assistant/entities/{entity_id}/labels"
)
async def phoenix_home_assistant_entity_labels(
    entity_id: str,
    labels: list[str],
    confirm: bool = False,
):
    """Setzt die Labels einer HA-Entität nach expliziter Bestätigung."""

    clean_labels = list(dict.fromkeys(
        label.strip()
        for label in labels
        if label and label.strip()
    ))

    if not confirm:
        return {
            "status": "confirmation_required",
            "updated": False,
            "entity_id": entity_id,
            "labels": clean_labels,
        }

    entity_result = await ha_ws_call({
        "type": "config/entity_registry/list",
    })

    if not entity_result.get("ok"):
        return {
            "status": "error",
            "updated": False,
            "error": entity_result.get(
                "error",
                "Entity-Registry nicht erreichbar",
            ),
        }

    entity = next(
        (
            item
            for item in (entity_result.get("result") or [])
            if item.get("entity_id") == entity_id
        ),
        None,
    )

    if entity is None:
        return {
            "status": "error",
            "updated": False,
            "error": "Entität wurde nicht gefunden",
        }

    label_result = await ha_ws_call({
        "type": "config/label_registry/list",
    })

    if not label_result.get("ok"):
        return {
            "status": "error",
            "updated": False,
            "error": label_result.get(
                "error",
                "Label-Registry nicht erreichbar",
            ),
        }

    known_labels = {
        item.get("label_id")
        for item in (label_result.get("result") or [])
        if item.get("label_id")
    }

    unknown_labels = [
        label
        for label in clean_labels
        if label not in known_labels
    ]

    if unknown_labels:
        return {
            "status": "error",
            "updated": False,
            "error": "Unbekannte Labels",
            "unknown_labels": unknown_labels,
        }

    result = await ha_ws_call({
        "type": "config/entity_registry/update",
        "entity_id": entity_id,
        "labels": clean_labels,
    })

    if not result.get("ok"):
        return {
            "status": "error",
            "updated": False,
            "error": result.get(
                "error",
                "Entitäts-Labels konnten nicht gespeichert werden",
            ),
        }

    return {
        "status": "ok",
        "updated": True,
        "entity_id": entity_id,
        "labels": clean_labels,
    }


@router.post(
    "/api/phoenix/home-assistant/areas/{area_id}/labels"
)
async def phoenix_home_assistant_area_labels(
    area_id: str,
    labels: list[str],
    confirm: bool = False,
):
    """Setzt die Labels eines HA-Bereichs nach expliziter Bestätigung."""

    clean_labels = list(dict.fromkeys(
        label.strip()
        for label in labels
        if label and label.strip()
    ))

    if not confirm:
        return {
            "status": "confirmation_required",
            "updated": False,
            "area_id": area_id,
            "labels": clean_labels,
        }

    area_result = await ha_ws_call({
        "type": "config/area_registry/list",
    })

    if not area_result.get("ok"):
        return {
            "status": "error",
            "updated": False,
            "error": area_result.get(
                "error",
                "Area-Registry nicht erreichbar",
            ),
        }

    area = next(
        (
            item
            for item in (area_result.get("result") or [])
            if item.get("area_id") == area_id
        ),
        None,
    )

    if area is None:
        return {
            "status": "error",
            "updated": False,
            "error": "Bereich wurde nicht gefunden",
        }

    label_result = await ha_ws_call({
        "type": "config/label_registry/list",
    })

    if not label_result.get("ok"):
        return {
            "status": "error",
            "updated": False,
            "error": label_result.get(
                "error",
                "Label-Registry nicht erreichbar",
            ),
        }

    known_labels = {
        item.get("label_id")
        for item in (label_result.get("result") or [])
        if item.get("label_id")
    }

    unknown_labels = [
        label
        for label in clean_labels
        if label not in known_labels
    ]

    if unknown_labels:
        return {
            "status": "error",
            "updated": False,
            "error": "Unbekannte Labels",
            "unknown_labels": unknown_labels,
        }

    result = await ha_ws_call({
        "type": "config/area_registry/update",
        "area_id": area_id,
        "labels": clean_labels,
    })

    if not result.get("ok"):
        return {
            "status": "error",
            "updated": False,
            "error": result.get(
                "error",
                "Bereichs-Labels konnten nicht gespeichert werden",
            ),
        }

    return {
        "status": "ok",
        "updated": True,
        "area_id": area_id,
        "labels": clean_labels,
    }


@router.get(
    "/api/phoenix/home-assistant/labels/usage"
)
async def phoenix_home_assistant_label_usage():
    """Liefert die Verwendung aller HA-Labels in Areas, Devices und Entities."""

    label_result = await ha_ws_call({
        "type": "config/label_registry/list",
    })

    if not label_result.get("ok"):
        return {
            "status": "error",
            "error": label_result.get(
                "error",
                "Label-Registry nicht erreichbar",
            ),
        }

    area_result = await ha_ws_call({
        "type": "config/area_registry/list",
    })

    device_result = await ha_ws_call({
        "type": "config/device_registry/list",
    })

    entity_result = await ha_ws_call({
        "type": "config/entity_registry/list",
    })

    for result, message in (
        (area_result, "Area-Registry nicht erreichbar"),
        (device_result, "Device-Registry nicht erreichbar"),
        (entity_result, "Entity-Registry nicht erreichbar"),
    ):
        if not result.get("ok"):
            return {
                "status": "error",
                "error": result.get(
                    "error",
                    message,
                ),
            }

    areas = area_result.get("result") or []
    devices = device_result.get("result") or []
    entities = entity_result.get("result") or []

    usage = []

    for label in label_result.get("result") or []:
        label_id = label.get("label_id")

        if not label_id:
            continue

        area_ids = [
            item.get("area_id")
            for item in areas
            if label_id in (item.get("labels") or [])
        ]

        device_ids = [
            item.get("id")
            for item in devices
            if label_id in (item.get("labels") or [])
        ]

        entity_ids = [
            item.get("entity_id")
            for item in entities
            if label_id in (item.get("labels") or [])
        ]

        area_ids = [
            item for item in area_ids if item
        ]
        device_ids = [
            item for item in device_ids if item
        ]
        entity_ids = [
            item for item in entity_ids if item
        ]

        total = (
            len(area_ids)
            + len(device_ids)
            + len(entity_ids)
        )

        usage.append({
            "label_id": label_id,
            "name": label.get("name"),
            "areas": len(area_ids),
            "devices": len(device_ids),
            "entities": len(entity_ids),
            "total": total,
            "unused": total == 0,
            "area_ids": area_ids,
            "device_ids": device_ids,
            "entity_ids": entity_ids,
        })

    usage.sort(
        key=lambda item: (
            item.get("name") or item["label_id"]
        ).casefold()
    )

    return {
        "status": "ok",
        "count": len(usage),
        "used": sum(
            1 for item in usage
            if not item["unused"]
        ),
        "unused": sum(
            1 for item in usage
            if item["unused"]
        ),
        "labels": usage,
    }

@router.get("/api/phoenix/home-assistant/automations")
async def phoenix_home_assistant_automations():
    """Liest Automationen inklusive Home-Assistant-Labels ein."""

    states_result = await ha_ws_call({
        "type": "get_states",
    })

    registry_result = await ha_ws_call({
        "type": "config/entity_registry/list",
    })

    if not states_result.get("ok"):
        return {
            "status": "error",
            "count": 0,
            "automations": [],
            "error": states_result.get(
                "error",
                "Home-Assistant-Automationen nicht erreichbar",
            ),
        }

    if not registry_result.get("ok"):
        return {
            "status": "error",
            "count": 0,
            "automations": [],
            "error": registry_result.get(
                "error",
                "Home-Assistant-Entity-Registry nicht erreichbar",
            ),
        }

    registry_map = {
        item.get("entity_id"): item
        for item in (registry_result.get("result") or [])
        if item.get("entity_id")
    }

    automations = []

    for state in states_result.get("result") or []:
        entity_id = state.get("entity_id") or ""

        if not entity_id.startswith("automation."):
            continue

        attributes = state.get("attributes") or {}
        registry = registry_map.get(entity_id) or {}

        automations.append({
            "entity_id": entity_id,
            "name": attributes.get("friendly_name") or entity_id,
            "state": state.get("state"),
            "last_changed": state.get("last_changed"),
            "last_triggered": attributes.get("last_triggered"),
            "mode": attributes.get("mode"),
            "current": attributes.get("current"),
            "id": attributes.get("id"),
            "labels": registry.get("labels") or [],
        })

    automations.sort(
        key=lambda item: item["name"].lower()
    )

    return {
        "status": "ok",
        "count": len(automations),
        "automations": automations,
    }


@router.post("/api/phoenix/home-assistant/automations/{entity_id}/action")
async def phoenix_home_assistant_automation_action(
    entity_id: str,
    action: str,
):
    """Aktiviert, deaktiviert oder startet eine Home-Assistant-Automation."""

    if not entity_id.startswith("automation."):
        return {
            "status": "error",
            "error": "Ungültige Automation",
        }

    services = {
        "turn_on": "turn_on",
        "turn_off": "turn_off",
        "trigger": "trigger",
    }

    service = services.get(action)

    if service is None:
        return {
            "status": "error",
            "error": "Ungültige Automation-Aktion",
        }

    result = await ha_ws_call({
        "type": "call_service",
        "domain": "automation",
        "service": service,
        "service_data": {},
        "target": {
            "entity_id": entity_id,
        },
        "return_response": False,
    })

    if not result.get("ok"):
        return {
            "status": "error",
            "action": action,
            "entity_id": entity_id,
            "error": result.get(
                "error",
                "Automation-Aktion fehlgeschlagen",
            ),
        }

    return {
        "status": "ok",
        "action": action,
        "entity_id": entity_id,
    }


@router.get("/api/phoenix/home-assistant/automations/{automation_id}/config")
async def phoenix_home_assistant_automation_config(
    automation_id: str,
):
    """Liest die Konfiguration einer Home-Assistant-Automation."""

    result = await ha_rest_call(
        "GET",
        f"config/automation/config/{automation_id}",
    )

    if not result.get("ok"):
        return {
            "status": "error",
            "automation_id": automation_id,
            "error": result.get("error"),
        }

    return {
        "status": "ok",
        "automation_id": automation_id,
        "config": result.get("result"),
    }


@router.post(
    "/api/phoenix/home-assistant/"
    "ronny-ai/orphaned-automation/"
    "{entity_id}/cleanup"
)
async def phoenix_home_assistant_cleanup_orphaned_automation(
    entity_id: str,
    confirm: bool = False,
):
    """Entfernt ausschließlich bestätigte, verwaiste Automation-Entities."""

    if not confirm:
        return {
            "status": "confirmation_required",
            "removed": False,
            "entity_id": entity_id,
        }

    if not entity_id.startswith("automation."):
        return {
            "status": "error",
            "removed": False,
            "entity_id": entity_id,
            "error": "Keine Automation-Entity",
        }

    registry_result = await ha_ws_call({
        "type": "config/entity_registry/list",
    })

    if not registry_result.get("ok"):
        return {
            "status": "error",
            "removed": False,
            "entity_id": entity_id,
            "error": registry_result.get(
                "error",
                "Entity Registry konnte nicht geladen werden",
            ),
        }

    entities = registry_result.get("result") or []

    entity = next(
        (
            item
            for item in entities
            if item.get("entity_id") == entity_id
        ),
        None,
    )

    if entity is None:
        return {
            "status": "error",
            "removed": False,
            "entity_id": entity_id,
            "error": "Entity nicht gefunden",
        }

    if entity.get("platform") != "automation":
        return {
            "status": "error",
            "removed": False,
            "entity_id": entity_id,
            "error": "Registry-Eintrag ist keine Automation",
        }

    capabilities = entity.get("capabilities") or {}

    automation_id = (
        capabilities.get("id")
        or entity.get("unique_id")
    )

    if not automation_id:
        return {
            "status": "error",
            "removed": False,
            "entity_id": entity_id,
            "error": "Automation-ID konnte nicht ermittelt werden",
        }

    config_result = await ha_rest_call(
        "GET",
        f"config/automation/config/{automation_id}",
    )

    # Existiert die Config wieder, darf nichts entfernt werden.
    if config_result.get("ok"):
        return {
            "status": "error",
            "removed": False,
            "entity_id": entity_id,
            "automation_id": automation_id,
            "error": (
                "Automation-Konfiguration existiert. "
                "Bereinigung wurde abgebrochen."
            ),
        }

    config_error = config_result.get("error") or {}

    status_code = (
        config_error.get("status_code")
        if isinstance(config_error, dict)
        else None
    )

    # Nur ein eindeutiges 404 gilt als verwaiste Automation.
    if status_code != 404:
        return {
            "status": "error",
            "removed": False,
            "entity_id": entity_id,
            "automation_id": automation_id,
            "error": (
                "Automation konnte nicht eindeutig als "
                "verwaist bestätigt werden."
            ),
            "config_error": config_error,
        }

    remove_result = await ha_ws_call({
        "type": "config/entity_registry/remove",
        "entity_id": entity_id,
    })

    if not remove_result.get("ok"):
        return {
            "status": "error",
            "removed": False,
            "entity_id": entity_id,
            "automation_id": automation_id,
            "error": remove_result.get(
                "error",
                "Registry-Eintrag konnte nicht entfernt werden",
            ),
        }

    return {
        "status": "ok",
        "removed": True,
        "entity_id": entity_id,
        "automation_id": automation_id,
    }


@router.delete("/api/phoenix/home-assistant/automations/{automation_id}")
async def phoenix_home_assistant_delete_automation(
    automation_id: str,
    confirm: bool = False,
):
    """Löscht eine Home-Assistant-Automation nach ausdrücklicher Bestätigung."""

    if not confirm:
        return {
            "status": "confirmation_required",
            "deleted": False,
            "automation_id": automation_id,
        }

    # Vor dem Löschen prüfen, ob die Automation existiert.
    config_result = await ha_rest_call(
        "GET",
        f"config/automation/config/{automation_id}",
    )

    if not config_result.get("ok"):
        return {
            "status": "error",
            "deleted": False,
            "automation_id": automation_id,
            "error": config_result.get("error"),
        }

    result = await ha_rest_call(
        "DELETE",
        f"config/automation/config/{automation_id}",
    )

    if not result.get("ok"):
        return {
            "status": "error",
            "deleted": False,
            "automation_id": automation_id,
            "error": result.get("error"),
        }

    return {
        "status": "ok",
        "deleted": True,
        "automation_id": automation_id,
    }


@router.post("/api/phoenix/home-assistant/automations/{automation_id}/config")
async def phoenix_home_assistant_save_automation(
    automation_id: str,
    config: dict = Body(...),
):
    """Erstellt oder aktualisiert eine Home-Assistant-Automation."""

    if not automation_id.strip():
        return {
            "status": "error",
            "saved": False,
            "error": "Ungültige Automation-ID",
        }

    if not isinstance(config, dict):
        return {
            "status": "error",
            "saved": False,
            "error": "Ungültige Automation-Konfiguration",
        }

    result = await ha_rest_call(
        "POST",
        f"config/automation/config/{automation_id}",
        config,
    )

    if not result.get("ok"):
        return {
            "status": "error",
            "saved": False,
            "automation_id": automation_id,
            "error": result.get("error"),
        }

    reload_result = await ha_ws_call({
        "type": "call_service",
        "domain": "automation",
        "service": "reload",
        "service_data": {},
        "return_response": False,
    })

    if not reload_result.get("ok"):
        return {
            "status": "error",
            "saved": True,
            "reloaded": False,
            "automation_id": automation_id,
            "error": reload_result.get(
                "error",
                "Automation wurde gespeichert, konnte aber nicht neu geladen werden",
            ),
        }

    return {
        "status": "ok",
        "saved": True,
        "reloaded": True,
        "automation_id": automation_id,
        "result": result.get("result"),
    }

@router.get("/api/phoenix/home-assistant/scripts")
async def phoenix_home_assistant_scripts():
    """Liest Home-Assistant-Skripte inklusive Labels ein."""

    states_result = await ha_ws_call({"type": "get_states"})
    registry_result = await ha_ws_call({"type": "config/entity_registry/list"})

    if not states_result.get("ok"):
        return {"status": "error", "count": 0, "scripts": [], "error": states_result.get("error", "Home-Assistant-Skripte nicht erreichbar")}

    registry_map = {}
    if registry_result.get("ok"):
        for item in registry_result.get("result") or []:
            entity_id = item.get("entity_id")
            if entity_id:
                registry_map[entity_id] = item

    scripts = []
    for state in states_result.get("result") or []:
        entity_id = state.get("entity_id") or ""
        if not entity_id.startswith("script."):
            continue

        attributes = state.get("attributes") or {}
        registry = registry_map.get(entity_id) or {}
        scripts.append({
            "entity_id": entity_id,
            "name": attributes.get("friendly_name") or entity_id,
            "state": state.get("state"),
            "last_changed": state.get("last_changed"),
            "last_triggered": attributes.get("last_triggered"),
            "mode": attributes.get("mode"),
            "current": attributes.get("current"),
            "id": attributes.get("id"),
            "labels": registry.get("labels") or [],
        })

    scripts.sort(key=lambda item: item["name"].lower())

    return {"status": "ok", "count": len(scripts), "scripts": scripts}


@router.post("/api/phoenix/home-assistant/scripts/{entity_id}/action")
async def phoenix_home_assistant_script_action(entity_id: str, action: str):
    """Startet oder stoppt ein Home-Assistant-Skript."""

    if not entity_id.startswith("script."):
        return {"status": "error", "error": "Ungültiges Skript"}

    services = {"turn_on": "turn_on", "turn_off": "turn_off"}
    service = services.get(action)

    if service is None:
        return {"status": "error", "error": "Ungültige Skript-Aktion"}

    result = await ha_ws_call({
        "type": "call_service",
        "domain": "script",
        "service": service,
        "service_data": {},
        "target": {"entity_id": entity_id},
        "return_response": False,
    })

    if not result.get("ok"):
        return {
            "status": "error",
            "action": action,
            "entity_id": entity_id,
            "error": result.get("error", "Skript-Aktion fehlgeschlagen"),
        }

    return {"status": "ok", "action": action, "entity_id": entity_id}


@router.get("/api/phoenix/home-assistant/scripts/{script_id}/config")
async def phoenix_home_assistant_script_config(script_id: str):
    """Liest die Konfiguration eines Home-Assistant-Skripts."""

    if not script_id.strip():
        return {"status": "error", "script_id": script_id, "error": "Ungültige Skript-ID"}

    result = await ha_rest_call(
        "GET",
        f"config/script/config/{script_id}",
    )

    if not result.get("ok"):
        return {
            "status": "error",
            "script_id": script_id,
            "error": result.get("error"),
        }

    return {
        "status": "ok",
        "script_id": script_id,
        "config": result.get("result"),
    }


@router.delete("/api/phoenix/home-assistant/scripts/{script_id}")
async def phoenix_home_assistant_delete_script(script_id: str, confirm: bool = False):
    """Löscht ein Home-Assistant-Skript nach ausdrücklicher Bestätigung."""

    if not confirm:
        return {
            "status": "confirmation_required",
            "deleted": False,
            "script_id": script_id,
        }

    config_result = await ha_rest_call(
        "GET",
        f"config/script/config/{script_id}",
    )

    if not config_result.get("ok"):
        return {
            "status": "error",
            "deleted": False,
            "script_id": script_id,
            "error": config_result.get("error"),
        }

    result = await ha_rest_call(
        "DELETE",
        f"config/script/config/{script_id}",
    )

    if not result.get("ok"):
        return {
            "status": "error",
            "deleted": False,
            "script_id": script_id,
            "error": result.get("error"),
        }

    reload_result = await ha_ws_call({
        "type": "call_service",
        "domain": "script",
        "service": "reload",
        "service_data": {},
        "return_response": False,
    })

    return {
        "status": "ok",
        "deleted": True,
        "reloaded": reload_result.get("ok", False),
        "script_id": script_id,
    }


@router.post("/api/phoenix/home-assistant/scripts/{script_id}/config")
async def phoenix_home_assistant_save_script(script_id: str, config: dict = Body(...)):
    """Erstellt oder aktualisiert ein Home-Assistant-Skript."""

    if not script_id.strip():
        return {"status": "error", "saved": False, "error": "Ungültige Skript-ID"}

    if not isinstance(config, dict):
        return {"status": "error", "saved": False, "error": "Ungültige Skript-Konfiguration"}

    result = await ha_rest_call(
        "POST",
        f"config/script/config/{script_id}",
        config,
    )

    if not result.get("ok"):
        return {
            "status": "error",
            "saved": False,
            "script_id": script_id,
            "error": result.get("error"),
        }

    reload_result = await ha_ws_call({
        "type": "call_service",
        "domain": "script",
        "service": "reload",
        "service_data": {},
        "return_response": False,
    })

    if not reload_result.get("ok"):
        return {
            "status": "error",
            "saved": True,
            "reloaded": False,
            "script_id": script_id,
            "error": reload_result.get("error", "Skript wurde gespeichert, konnte aber nicht neu geladen werden"),
        }

    return {
        "status": "ok",
        "saved": True,
        "reloaded": True,
        "script_id": script_id,
        "result": result.get("result"),
    }


@router.get("/api/phoenix/home-assistant/devices/{device_id}/automation-triggers")
async def phoenix_home_assistant_device_automation_triggers(device_id: str):
    """Liest die verfügbaren Home-Assistant-Auslöser eines Geräts."""

    if not device_id.strip():
        return {
            "status": "error",
            "count": 0,
            "triggers": [],
            "error": "Ungültige Geräte-ID",
        }

    result = await ha_ws_call({
        "type": "device_automation/trigger/list",
        "device_id": device_id,
    })

    if not result.get("ok"):
        return {
            "status": "error",
            "count": 0,
            "triggers": [],
            "device_id": device_id,
            "error": result.get(
                "error",
                "Geräte-Auslöser nicht erreichbar",
            ),
        }

    triggers = result.get("result") or []

    return {
        "status": "ok",
        "count": len(triggers),
        "device_id": device_id,
        "triggers": triggers,
    }


@router.get("/api/phoenix/home-assistant/devices/{device_id}/automation-conditions")
async def phoenix_home_assistant_device_automation_conditions(device_id: str):
    """Liest die verfügbaren Home-Assistant-Bedingungen eines Geräts."""

    if not device_id.strip():
        return {
            "status": "error",
            "count": 0,
            "conditions": [],
            "error": "Ungültige Geräte-ID",
        }

    result = await ha_ws_call({
        "type": "device_automation/condition/list",
        "device_id": device_id,
    })

    if not result.get("ok"):
        return {
            "status": "error",
            "count": 0,
            "conditions": [],
            "device_id": device_id,
            "error": result.get(
                "error",
                "Geräte-Bedingungen nicht erreichbar",
            ),
        }

    conditions = result.get("result") or []

    return {
        "status": "ok",
        "count": len(conditions),
        "device_id": device_id,
        "conditions": conditions,
    }


@router.get("/api/phoenix/home-assistant/devices/{device_id}/automation-actions")
async def phoenix_home_assistant_device_automation_actions(device_id: str):
    """Liest die verfügbaren Home-Assistant-Aktionen eines Geräts."""

    if not device_id.strip():
        return {
            "status": "error",
            "count": 0,
            "actions": [],
            "error": "Ungültige Geräte-ID",
        }

    result = await ha_ws_call({
        "type": "device_automation/action/list",
        "device_id": device_id,
    })

    if not result.get("ok"):
        return {
            "status": "error",
            "count": 0,
            "actions": [],
            "device_id": device_id,
            "error": result.get(
                "error",
                "Geräte-Aktionen nicht erreichbar",
            ),
        }

    actions = result.get("result") or []

    return {
        "status": "ok",
        "count": len(actions),
        "device_id": device_id,
        "actions": actions,
    }
