"""
Phoenix Context Manager

Verwaltet die Phoenix-Verzeichnisstruktur und JSON-Kontextdateien.
"""

import json
from pathlib import Path
from typing import Any

from app.core.context_paths import ContextPaths


class ContextManager:
    """Verwaltet die Phoenix-Kontextstruktur."""

    @staticmethod
    def create_structure() -> None:
        """Erstellt alle benötigten Phoenix-Verzeichnisse."""
        for directory in ContextPaths.required_directories():
            directory.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def check_structure() -> bool:
        """Prüft, ob alle benötigten Verzeichnisse vorhanden sind."""
        return all(
            directory.exists() and directory.is_dir()
            for directory in ContextPaths.required_directories()
        )

    @staticmethod
    def load_json(path: Path) -> dict[str, Any]:
        """Lädt eine JSON-Datei und gibt den Inhalt als Dictionary zurück."""
        if not path.exists():
            raise FileNotFoundError(f"JSON-Datei nicht gefunden: {path}")

        with path.open("r", encoding="utf-8") as file:
            data = json.load(file)

        if not isinstance(data, dict):
            raise ValueError(f"JSON-Datei enthält kein Dictionary: {path}")

        return data

    @staticmethod
    def save_json(path: Path, data: dict[str, Any]) -> None:
        """Speichert ein Dictionary als JSON-Datei."""
        path.parent.mkdir(parents=True, exist_ok=True)

        with path.open("w", encoding="utf-8") as file:
            json.dump(data, file, indent=2, ensure_ascii=False)

    @staticmethod
    def create_json(path: Path, default_data: dict[str, Any] | None = None) -> None:
        """Erstellt eine JSON-Datei, falls sie noch nicht existiert."""
        if path.exists():
            return

        ContextManager.save_json(path, default_data or {})

    @staticmethod
    def validate_json(path: Path) -> bool:
        """Prüft, ob eine JSON-Datei gültig und ein Dictionary ist."""
        try:
            ContextManager.load_json(path)
            return True
        except (FileNotFoundError, json.JSONDecodeError, ValueError):
            return False
