from pathlib import Path
import json
from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.home_assistant import ha_ws_call


router = APIRouter()


def _load_storage(filename: str, key: str):
    for base in ["/homeassistant/.storage", "/config/.storage"]:
        path = Path(base) / filename
        if path.exists():
            try:
                data = json.loads(path.read_text())
                value = data.get("data", {}).get(key, [])
                return value if isinstance(value, list) else []
            except Exception:
                return []
    return []


@router.get("/api/labels")
async def phoenix_labels():
    labels = _load_storage("core.label_registry", "labels")
    entities = _load_storage("core.entity_registry", "entities")
    devices = _load_storage("core.device_registry", "devices")

    rows = []

    for label in labels:
        lid = label.get("label_id") or label.get("id") or label.get("name") or ""
        name = label.get("name") or lid or "Unbenannt"
        icon = label.get("icon") or "🏷️"

        e_count = 0
        d_count = 0
        samples = []

        for e in entities:
            labs = e.get("labels", []) or []
            if lid in labs or name in labs:
                e_count += 1
                if len(samples) < 8:
                    samples.append(e.get("entity_id", ""))

        for d in devices:
            labs = d.get("labels", []) or []
            if lid in labs or name in labs:
                d_count += 1

        rows.append({
            "id": lid,
            "name": name,
            "icon": icon,
            "entities": e_count,
            "devices": d_count,
            "total": e_count + d_count,
            "unused": (e_count + d_count) == 0,
            "samples": samples
        })

    rows.sort(key=lambda x: (x["unused"], -x["total"], x["name"].lower()))

    return {
        "status": "ok",
        "count": len(rows),
        "used": len([x for x in rows if not x["unused"]]),
        "unused": len([x for x in rows if x["unused"]]),
        "labels": rows
    }



# ==================================================
# Phoenix Order Center – API-Eingabemodelle
# Müssen vor den POST-Routen definiert sein
# ==================================================

class PhoenixLabelPayload(BaseModel):
    id: Optional[str] = None
    name: str
    icon: Optional[str] = None
    color: Optional[str] = None


class PhoenixAreaPayload(BaseModel):
    id: Optional[str] = None
    name: str
    icon: Optional[str] = None


class PhoenixAssignPayload(BaseModel):
    target_type: str
    target_id: str
    area_id: Optional[str] = None
    labels: List[str] = Field(default_factory=list)


@router.post("/api/order-center/label/create")
async def phoenix_create_label(payload: PhoenixLabelPayload):
    cmd = {"type": "config/label_registry/create", "name": payload.name}
    if payload.icon: cmd["icon"] = payload.icon
    if payload.color: cmd["color"] = payload.color
    return await ha_ws_call(cmd)

@router.post("/api/order-center/label/update")
async def phoenix_update_label(payload: PhoenixLabelPayload):
    cmd = {"type": "config/label_registry/update", "label_id": payload.id, "name": payload.name}
    if payload.icon is not None: cmd["icon"] = payload.icon
    if payload.color is not None: cmd["color"] = payload.color
    return await ha_ws_call(cmd)

@router.post("/api/order-center/label/delete")
async def phoenix_delete_label(payload: PhoenixLabelPayload):
    return await ha_ws_call({"type": "config/label_registry/delete", "label_id": payload.id})

@router.post("/api/order-center/area/create")
async def phoenix_create_area(payload: PhoenixAreaPayload):
    cmd = {"type": "config/area_registry/create", "name": payload.name}
    if payload.icon: cmd["icon"] = payload.icon
    return await ha_ws_call(cmd)

@router.post("/api/order-center/area/update")
async def phoenix_update_area(payload: PhoenixAreaPayload):
    cmd = {"type": "config/area_registry/update", "area_id": payload.id, "name": payload.name}
    if payload.icon is not None: cmd["icon"] = payload.icon
    return await ha_ws_call(cmd)

@router.post("/api/order-center/area/delete")
async def phoenix_delete_area(payload: PhoenixAreaPayload):
    return await ha_ws_call({"type": "config/area_registry/delete", "area_id": payload.id})

@router.post("/api/order-center/assign")
async def phoenix_assign(payload: PhoenixAssignPayload):
    if payload.target_type == "device":
        return await ha_ws_call({
            "type": "config/device_registry/update",
            "device_id": payload.target_id,
            "area_id": payload.area_id or None,
            "labels": payload.labels
        })

    if payload.target_type == "entity":
        return await ha_ws_call({
            "type": "config/entity_registry/update",
            "entity_id": payload.target_id,
            "area_id": payload.area_id or None,
            "labels": payload.labels
        })

    return {"ok": False, "error": "target_type muss device oder entity sein"}


# === Phoenix Order Center API START ===
@router.get("/api/order-center")
@router.get("/api/phoenix/order-center")
async def phoenix_order_center():
    labels = _load_storage("core.label_registry", "labels")
    areas = _load_storage("core.area_registry", "areas")
    devices = _load_storage("core.device_registry", "devices")
    entities = _load_storage("core.entity_registry", "entities")

    label_rows = []
    for l in labels:
        lid = l.get("label_id") or l.get("id") or l.get("name") or ""
        label_rows.append({
            "id": lid,
            "name": l.get("name") or lid or "Unbenannt",
            "icon": l.get("icon") or "🏷️",
            "color": l.get("color") or ""
        })

    area_rows = []
    for a in areas:
        aid = a.get("area_id") or a.get("id") or a.get("name") or ""
        area_rows.append({
            "id": aid,
            "name": a.get("name") or aid or "Unbenannt",
            "icon": a.get("icon") or "📍"
        })

    device_rows = []
    for d in devices:
        did = d.get("id") or ""
        ents = [
            e.get("entity_id")
            for e in entities
            if e.get("device_id") == did and e.get("entity_id")
        ]

        device_rows.append({
            "id": did,
            "name": d.get("name_by_user") or d.get("name") or d.get("model") or "Unbenanntes Gerät",
            "manufacturer": d.get("manufacturer") or "",
            "model": d.get("model") or "",
            "area_id": d.get("area_id") or "",
            "labels": d.get("labels", []) or [],
            "entity_count": len(ents),
            "sample_entities": ents[:8],
            "type": "device"
        })

    entity_rows = []
    for e in entities:
        eid = e.get("entity_id") or ""
        entity_rows.append({
            "id": eid,
            "name": e.get("name") or e.get("original_name") or eid,
            "device_id": e.get("device_id") or "",
            "area_id": e.get("area_id") or "",
            "labels": e.get("labels", []) or [],
            "platform": e.get("platform") or "",
            "type": "entity"
        })

    return {
        "status": "ok",
        "labels": label_rows,
        "areas": area_rows,
        "devices": device_rows,
        "entities": entity_rows,
        "stats": {
            "labels": len(label_rows),
            "areas": len(area_rows),
            "devices": len(device_rows),
            "entities": len(entity_rows),
            "devices_without_area": len([d for d in device_rows if not d["area_id"]]),
            "devices_without_labels": len([d for d in device_rows if not d["labels"]]),
            "entities_without_area": len([e for e in entity_rows if not e["area_id"]]),
            "entities_without_labels": len([e for e in entity_rows if not e["labels"]])
        }
    }
# === Phoenix Order Center API END ===
