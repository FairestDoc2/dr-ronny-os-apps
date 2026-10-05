"""
Phoenix Version Command

Zeigt die aktuelle Phoenix-Version aus der zentralen Versionsdatei an.
"""

from app.core.version import get_version_info


def run() -> None:
    """Zeigt die Phoenix-Version."""
    info = get_version_info()

    print("Phoenix CLI")

    if not info.get("ok"):
        print("Version: unbekannt")
        print(f"Fehler: {info.get('error', 'Unbekannter Fehler')}")
        return

    print(f"Version: {info['version']}")
    print(f"Stage: {info['stage']}")
