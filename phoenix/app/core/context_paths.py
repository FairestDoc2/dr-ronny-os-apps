"""
Phoenix Context Paths

Single Source of Truth für alle wichtigen Projektpfade.
Im gesamten Projekt sollen keine Pfade mehr als Zeichenketten
hart codiert werden.
"""

from pathlib import Path


class ContextPaths:
    """Zentrale Definition aller Phoenix-Pfade."""

    # Projektwurzel
    #
    # Auf der Owner-/Entwicklungsinstallation ist
    # /addons/ronny_phoenix die persistente Arbeitsquelle.
    # Diese muss Vorrang vor dem internen /app-Code
    # des Containers haben.
    _SOURCE_ROOT = Path(__file__).resolve().parents[1]
    _PERSISTENT_ROOT = Path("/addons/ronny_phoenix")

    if (_PERSISTENT_ROOT / "manifest").exists():
        PROJECT_ROOT = _PERSISTENT_ROOT
    elif (_SOURCE_ROOT / "manifest").exists():
        PROJECT_ROOT = _SOURCE_ROOT
    else:
        PROJECT_ROOT = Path(__file__).resolve().parents[2]

    # Hauptordner
    PHOENIX_ROOT = PROJECT_ROOT / ".phoenix"

    CONFIG_DIR = PHOENIX_ROOT / "config"
    RUNTIME_DIR = PHOENIX_ROOT / "runtime"
    GENERATED_DIR = PHOENIX_ROOT / "generated"

    CACHE_DIR = PHOENIX_ROOT / "cache"
    LOGS_DIR = PHOENIX_ROOT / "logs"
    BACKUPS_DIR = PHOENIX_ROOT / "backups"
    TEMPLATES_DIR = PHOENIX_ROOT / "templates"

    # Konfigurationsdateien
    PROJECT_FILE = CONFIG_DIR / "project.json"
    ARCHITECTURE_FILE = CONFIG_DIR / "architecture.json"
    ROADMAP_FILE = CONFIG_DIR / "roadmap.json"
    MODULES_FILE = CONFIG_DIR / "modules.json"

    # Laufzeitdateien
    STATE_FILE = RUNTIME_DIR / "state.json"
    GIT_FILE = RUNTIME_DIR / "git.json"
    BUILD_FILE = RUNTIME_DIR / "build.json"
    HISTORY_FILE = RUNTIME_DIR / "history.json"
    RONNY_AI_STATE_FILE = Path("/data/ronny_ai_state.json")

    # Generierte Dateien
    CONTEXT_MD = GENERATED_DIR / "context.md"

    @classmethod
    def required_directories(cls):
        """Liste aller Verzeichnisse, die vorhanden sein müssen."""
        return [
            cls.CONFIG_DIR,
            cls.RUNTIME_DIR,
            cls.GENERATED_DIR,
            cls.CACHE_DIR,
            cls.LOGS_DIR,
            cls.BACKUPS_DIR,
            cls.TEMPLATES_DIR,
        ]
