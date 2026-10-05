"""
Phoenix System Control API.

Read-only Systeminformationen für die Phoenix-V2-Settings-Seite.
"""

from pathlib import Path

from fastapi import APIRouter, Body, HTTPException

from app.core.context_manager import ContextManager
from app.core.project_engine import ProjectEngine
from app.core.snapshot_engine import SnapshotEngine
from app.core.version import get_version_info


router = APIRouter()


OWNER_MARKER = Path(
    "/config/dr_ronny_os/.owner_installation"
)

DEVELOPER_MARKER = Path(
    "/config/dr_ronny_os/.developer_mode"
)


def _phoenix_owner_installation() -> bool:
    """
    Kennzeichnet ausschließlich Ronnys lokale
    Entwicklungsinstallation.
    """
    try:
        return OWNER_MARKER.is_file()
    except Exception:
        return False


def _phoenix_developer_mode_enabled() -> bool:
    """
    Developer Mode funktioniert nur auf der
    gekennzeichneten Owner-Installation.
    """
    if not _phoenix_owner_installation():
        return False

    try:
        return DEVELOPER_MARKER.is_file()
    except Exception:
        return False


@router.get("/api/phoenix/system-control/status")
def phoenix_system_control_status():
    """Liefert den zentralen Phoenix-Systemstatus."""

    version = get_version_info()
    project = ProjectEngine.summary()
    doctor_ok = ContextManager.check_structure()
    developer_mode = _phoenix_developer_mode_enabled()
    owner_installation = _phoenix_owner_installation()

    # Interne Git-Informationen niemals an normale
    # Installationen ausliefern.
    if (
        not developer_mode
        and isinstance(project, dict)
    ):
        project = dict(project)
        project.pop("git", None)

    return {
        "status": "ok",
        "developer_mode": developer_mode,
        "owner_installation": owner_installation,
        "phoenix": {
            "name": version.get("name", "Dr. Ronny OS Phoenix"),
            "version": version.get("version", "unknown"),
            "stage": version.get("stage", "unknown"),
            "architecture_locked": bool(
                version.get("architecture_locked", False)
            ),
        },
        "doctor": {
            "ok": doctor_ok,
        },
        "project": project,
    }



@router.get(
    "/api/phoenix/system-control/developer-mode"
)
def phoenix_system_control_developer_mode():
    """Liest den lokalen Developer Mode."""

    owner = _phoenix_owner_installation()

    return {
        "status": "ok",
        "owner_installation": owner,
        "enabled": (
            _phoenix_developer_mode_enabled()
            if owner
            else False
        ),
    }


@router.post(
    "/api/phoenix/system-control/developer-mode"
)
def phoenix_system_control_set_developer_mode(
    enabled: bool = Body(..., embed=True),
):
    """
    Schaltet den Developer Mode ausschließlich
    auf der lokalen Owner-Installation.
    """

    if not _phoenix_owner_installation():
        raise HTTPException(
            status_code=403,
            detail="Developer Mode ist auf dieser Installation nicht verfügbar.",
        )

    DEVELOPER_MARKER.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    if enabled:
        DEVELOPER_MARKER.touch(
            exist_ok=True
        )
    elif DEVELOPER_MARKER.exists():
        DEVELOPER_MARKER.unlink()

    return {
        "status": "ok",
        "owner_installation": True,
        "enabled": _phoenix_developer_mode_enabled(),
    }


@router.post("/api/phoenix/system-control/snapshots")
def phoenix_system_control_create_snapshot():
    """Erstellt einen neuen Phoenix-Snapshot."""
    metadata = SnapshotEngine.create()

    return {
        "status": "ok",
        "snapshot": metadata,
    }


@router.get("/api/phoenix/system-control/snapshots")
def phoenix_system_control_snapshots():
    """Listet vorhandene Phoenix-Snapshots read-only auf."""

    snapshots = []

    for path in reversed(SnapshotEngine.list()):
        snapshot_id = path.stem.removeprefix("phoenix_snapshot_")

        try:
            metadata = SnapshotEngine.info(snapshot_id)
            verification = SnapshotEngine.verify(snapshot_id)

            snapshots.append({
                "id": snapshot_id,
                "file": path.name,
                "metadata": metadata,
                "verified": bool(verification.get("ok", False)),
            })
        except (FileNotFoundError, KeyError, ValueError) as exc:
            snapshots.append({
                "id": snapshot_id,
                "file": path.name,
                "metadata": None,
                "verified": False,
                "error": str(exc),
            })

    return {
        "status": "ok",
        "count": len(snapshots),
        "snapshots": snapshots,
    }


@router.post("/api/phoenix/system-control/snapshots/{snapshot_id}/restore")
def phoenix_system_control_restore_snapshot(
    snapshot_id: str,
    confirm: bool = False,
):
    """Stellt einen verifizierten Snapshot nur nach Bestätigung wieder her."""

    if not confirm:
        return {
            "status": "confirmation_required",
            "id": snapshot_id,
            "restored": False,
        }

    try:
        safety_snapshot = SnapshotEngine.create()
    except Exception as exc:
        return {
            "status": "error",
            "id": snapshot_id,
            "restored": False,
            "reason": "Pre-Restore-Snapshot konnte nicht erstellt werden",
            "error": str(exc),
        }

    result = SnapshotEngine.restore(
        snapshot_id,
        force=True,
    )

    return {
        "status": "ok" if result.get("ok") else "error",
        "safety_snapshot": safety_snapshot,
        "restore": result,
    }


@router.post("/api/phoenix/system-control/snapshots/{snapshot_id}/rename")
def phoenix_system_control_rename_snapshot(
    snapshot_id: str,
    name: str = Body(..., embed=True),
):
    """Ändert den Anzeigenamen eines Snapshots, nicht seine technische ID."""
    try:
        result = SnapshotEngine.rename(snapshot_id, name)
        return {
            "status": "ok",
            "snapshot": result,
        }
    except (FileNotFoundError, KeyError, ValueError) as exc:
        return {
            "status": "error",
            "id": snapshot_id,
            "error": str(exc),
        }


@router.post("/api/phoenix/system-control/snapshots/{snapshot_id}/verify")
def phoenix_system_control_verify_snapshot(snapshot_id: str):
    """Prüft einen Snapshot gegen seine gespeicherte SHA-256-Prüfsumme."""
    try:
        result = SnapshotEngine.verify(snapshot_id)
        return {
            "status": "ok" if result.get("ok") else "error",
            "verification": result,
        }
    except (FileNotFoundError, KeyError, ValueError) as exc:
        return {
            "status": "error",
            "id": snapshot_id,
            "error": str(exc),
        }


@router.delete("/api/phoenix/system-control/snapshots/{snapshot_id}")
def phoenix_system_control_delete_snapshot(
    snapshot_id: str,
    confirm: bool = False,
):
    """Löscht Snapshot und Metadaten nur nach ausdrücklicher Bestätigung."""
    if not confirm:
        return {
            "status": "confirmation_required",
            "id": snapshot_id,
            "deleted": False,
        }

    try:
        result = SnapshotEngine.delete(snapshot_id, force=True)
        return {
            "status": "ok" if result.get("ok") else "error",
            "delete": result,
        }
    except (FileNotFoundError, KeyError, ValueError) as exc:
        return {
            "status": "error",
            "id": snapshot_id,
            "deleted": False,
            "error": str(exc),
        }


# === Phoenix HA Backup API ===

def _phoenix_supervisor_backup_request(
    method: str,
    endpoint: str,
    payload: dict | None = None,
):
    """Spricht die Supervisor-Backup-API direkt an."""
    import json
    import os
    from urllib import request
    from urllib.error import HTTPError, URLError

    token = os.environ.get("SUPERVISOR_TOKEN", "")

    if not token:
        raise RuntimeError(
            "SUPERVISOR_TOKEN ist nicht verfügbar."
        )

    url = (
        "http://supervisor"
        + endpoint
    )

    body = None

    if payload is not None:
        body = json.dumps(payload).encode("utf-8")

    req = request.Request(
        url,
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
            timeout=300,
        ) as response:
            raw = response.read().decode("utf-8")

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


@router.get(
    "/api/phoenix/system-control/ha-backups"
)
def phoenix_system_control_ha_backups():
    """
    Listet ausschließlich die von Phoenix angelegten
    Home-Assistant-Änderungssicherungen.
    """

    try:
        result = _phoenix_supervisor_backup_request(
            "GET",
            "/backups",
        )

        if result.get("result") != "ok":
            return {
                "status": "error",
                "error": result.get(
                    "message",
                    "HA-Backups konnten nicht gelesen werden",
                ),
            }

        data = result.get("data") or {}
        backups = data.get("backups") or []

        phoenix_backups = []

        for backup in backups:
            name = str(
                backup.get("name") or ""
            )

            if not name.startswith(
                "Ronny HA ·"
            ):
                continue

            content = (
                backup.get("content") or {}
            )

            phoenix_backups.append({
                "type": "home_assistant",
                "slug": backup.get("slug"),
                "name": name,
                "date": backup.get("date"),
                "size": backup.get("size"),
                "protected": backup.get(
                    "protected",
                    False,
                ),
                "compressed": backup.get(
                    "compressed",
                    True,
                ),
                "homeassistant": bool(
                    content.get("homeassistant")
                ),
            })

        phoenix_backups.sort(
            key=lambda item:
                item.get("date") or "",
            reverse=True,
        )

        return {
            "status": "ok",
            "type": "home_assistant",
            "count": len(phoenix_backups),
            "backups": phoenix_backups,
        }

    except Exception as exc:
        return {
            "status": "error",
            "error": str(exc),
        }


@router.post(
    "/api/phoenix/system-control/ha-backups"
)
def phoenix_system_control_create_ha_backup(
    name: str | None = None,
):
    """
    Erstellt einen nativen HA-Teilbackup.
    Enthalten ist Home Assistant selbst,
    nicht Phoenix und nicht alle Add-ons.
    """
    from datetime import datetime

    clean_name = str(name or "").strip()

    if not clean_name:
        clean_name = (
            "Änderungen "
            + datetime.now().strftime(
                "%d.%m.%Y %H:%M"
            )
        )

    if len(clean_name) > 100:
        clean_name = clean_name[:100]

    backup_name = (
        f"Ronny HA · {clean_name}"
    )

    try:
        result = _phoenix_supervisor_backup_request(
            "POST",
            "/backups/new/partial",
            {
                "name": backup_name,
                "homeassistant": True,
                "compressed": True,
                "background": False,
            },
        )

        if result.get("result") != "ok":
            return {
                "status": "error",
                "created": False,
                "error": result.get(
                    "message",
                    "HA-Backup konnte nicht erstellt werden",
                ),
            }

        data = result.get("data") or {}

        return {
            "status": "ok",
            "created": True,
            "type": "home_assistant",
            "slug": data.get("slug"),
            "job_id": data.get("job_id"),
            "name": backup_name,
        }

    except Exception as exc:
        return {
            "status": "error",
            "created": False,
            "error": str(exc),
        }


@router.post(
    "/api/phoenix/system-control/ha-backups/{slug}/restore"
)
def phoenix_system_control_restore_ha_backup(
    slug: str,
    confirm: bool = False,
):
    """
    Stellt nur Home Assistant aus einem HA-Backup wieder her.
    Vorher wird automatisch ein neuer HA-Sicherheitsbackup erstellt.
    """
    from datetime import datetime

    if not confirm:
        return {
            "status": "confirmation_required",
            "type": "home_assistant",
            "slug": slug,
            "restored": False,
        }

    try:
        safety_name = (
            "Ronny HA · Sicherheitskopie vor Restore "
            + datetime.now().strftime(
                "%d.%m.%Y %H:%M"
            )
        )

        safety_result = (
            _phoenix_supervisor_backup_request(
                "POST",
                "/backups/new/partial",
                {
                    "name": safety_name,
                    "homeassistant": True,
                    "compressed": True,
                    "background": False,
                },
            )
        )

        if safety_result.get("result") != "ok":
            return {
                "status": "error",
                "restored": False,
                "error": (
                    "HA-Sicherheitsbackup vor Restore "
                    "konnte nicht erstellt werden."
                ),
            }

        restore_result = (
            _phoenix_supervisor_backup_request(
                "POST",
                f"/backups/{slug}/restore/partial",
                {
                    "homeassistant": True,
                    "background": True,
                },
            )
        )

        if restore_result.get("result") != "ok":
            return {
                "status": "error",
                "restored": False,
                "safety_backup":
                    safety_result.get("data"),
                "error": restore_result.get(
                    "message",
                    "HA-Restore konnte nicht gestartet werden",
                ),
            }

        return {
            "status": "ok",
            "restored": True,
            "type": "home_assistant",
            "slug": slug,
            "safety_backup":
                safety_result.get("data"),
            "restore":
                restore_result.get("data"),
        }

    except Exception as exc:
        return {
            "status": "error",
            "restored": False,
            "error": str(exc),
        }


@router.delete(
    "/api/phoenix/system-control/ha-backups/{slug}"
)
def phoenix_system_control_delete_ha_backup(
    slug: str,
    confirm: bool = False,
):
    """Löscht ausschließlich den gewählten nativen HA-Backup."""

    if not confirm:
        return {
            "status": "confirmation_required",
            "type": "home_assistant",
            "slug": slug,
            "deleted": False,
        }

    try:
        result = _phoenix_supervisor_backup_request(
            "DELETE",
            f"/backups/{slug}",
        )

        if result.get("result") != "ok":
            return {
                "status": "error",
                "deleted": False,
                "error": result.get(
                    "message",
                    "HA-Backup konnte nicht gelöscht werden",
                ),
            }

        return {
            "status": "ok",
            "deleted": True,
            "type": "home_assistant",
            "slug": slug,
        }

    except Exception as exc:
        return {
            "status": "error",
            "deleted": False,
            "error": str(exc),
        }

