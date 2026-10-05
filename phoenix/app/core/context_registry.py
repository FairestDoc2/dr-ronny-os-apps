"""
Phoenix Context Registry

Zentrale Registrierung aller Phoenix-Kontextdateien.
"""

from pathlib import Path

from app.core.context_paths import ContextPaths


class ContextRegistry:
    """Zentrale Registry für Phoenix-Dateien."""

    ROOT = ContextPaths.PHOENIX_ROOT

    STATE = ContextPaths.STATE_FILE
    PROJECT = ContextPaths.CONFIG_DIR / "project.json"
    ROADMAP = ContextPaths.ROADMAP_FILE
    RESUME = ContextPaths.RUNTIME_DIR / "resume.json"
    VERSION = ContextPaths.CONFIG_DIR / "version.json"

    @classmethod
    def all(cls) -> dict[str, Path]:
        """Gibt alle registrierten Dateien zurück."""
        return {
            "state": cls.STATE,
            "project": cls.PROJECT,
            "roadmap": cls.ROADMAP,
            "resume": cls.RESUME,
            "version": cls.VERSION,
        }

    @classmethod
    def get(cls, name: str) -> Path:
        """Gibt den Pfad einer registrierten Datei zurück."""
        registry = cls.all()

        if name not in registry:
            raise KeyError(f"Unbekannte Registry-Datei: {name}")

        return registry[name]
