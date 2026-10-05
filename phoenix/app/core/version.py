import json
from pathlib import Path
from datetime import datetime

VERSION_FILE = Path("manifest/version.json")

DEFAULT_VERSION = {
    "name": "Dr. Ronny OS Phoenix",
    "version": "unknown",
    "stage": "unknown",
    "architecture_locked": False
}

def get_version_info():
    """
    Liest die zentrale Phoenix-Version aus manifest/version.json.
    Diese Datei ist die einzige Quelle für die aktuelle Version.
    """
    if not VERSION_FILE.exists():
        return {
            "ok": False,
            "error": "manifest/version.json fehlt",
            **DEFAULT_VERSION
        }

    try:
        with VERSION_FILE.open("r", encoding="utf-8") as f:
            data = json.load(f)

        return {
            "ok": True,
            "name": data.get("name", DEFAULT_VERSION["name"]),
            "version": data.get("version", DEFAULT_VERSION["version"]),
            "stage": data.get("stage", DEFAULT_VERSION["stage"]),
            "architecture_locked": data.get("architecture_locked", DEFAULT_VERSION["architecture_locked"]),
            "loaded_at": datetime.now().isoformat(timespec="seconds")
        }

    except json.JSONDecodeError as e:
        return {
            "ok": False,
            "error": f"Ungültiges JSON in manifest/version.json: {e}",
            **DEFAULT_VERSION
        }

    except Exception as e:
        return {
            "ok": False,
            "error": str(e),
            **DEFAULT_VERSION
        }

def get_version_string():
    info = get_version_info()
    if not info.get("ok"):
        return "Dr. Ronny OS Phoenix Version unbekannt"
    return f"{info['name']} {info['version']} ({info['stage']})"

def is_architecture_locked():
    info = get_version_info()
    return bool(info.get("architecture_locked", False))
