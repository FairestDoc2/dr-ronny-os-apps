"""
Phoenix Project Engine

Bündelt Projekt-, Version-, Roadmap-, State- und Git-Informationen.
"""

import subprocess
from pathlib import Path
from typing import Any

from app.core.context_manager import ContextManager
from app.core.context_registry import ContextRegistry
from app.core.git_engine import GitEngine


class ProjectEngine:
    """Zentrale Engine für den aktuellen Projektzustand."""

    @staticmethod
    def load_version() -> dict[str, Any]:
        """Lädt die Projektversion."""
        return ContextManager.load_json(Path("manifest/version.json"))

    @staticmethod
    def load_roadmap() -> dict[str, Any]:
        """Lädt die Phoenix-Roadmap."""
        return ContextManager.load_json(Path("roadmap.json"))

    @staticmethod
    def load_state() -> dict[str, Any]:
        """Lädt den Phoenix-Laufzeitstatus."""
        return ContextManager.load_json(ContextRegistry.STATE)

    @staticmethod
    def summary() -> dict[str, Any]:
        """Erzeugt eine vollständige Projektzusammenfassung."""
        version = ProjectEngine.load_version()
        roadmap = ProjectEngine.load_roadmap()
        state = ProjectEngine.load_state()

        try:
            git = {
                "branch": GitEngine.current_branch(),
                "commit": GitEngine.current_commit(),
                "message": GitEngine.last_commit_message(),
                "clean": GitEngine.is_clean(),
                "changed_files": GitEngine.changed_files(),
                "available": True,
            }
        except subprocess.CalledProcessError:
            git = {
                "branch": None,
                "commit": None,
                "message": None,
                "clean": None,
                "changed_files": [],
                "available": False,
            }

        return {
            "project": version.get("name", "Unbekannt"),
            "version": version.get("version", "0.0.0"),
            "stage": version.get("stage", ""),
            "milestone": roadmap.get("current_milestone", ""),
            "next_task": roadmap.get("next_task", ""),
            "state": state,
            "roadmap": roadmap,
            "git": git,
        }
