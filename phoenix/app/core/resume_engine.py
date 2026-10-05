"""
Phoenix Resume Engine

Erstellt eine Resume-Zusammenfassung über den zentralen ProjectEngine.
"""

from typing import Any

from app.core.project_engine import ProjectEngine


class ResumeEngine:
    """Erstellt Informationen zum Fortsetzen eines Projekts."""

    @staticmethod
    def summary() -> dict[str, Any]:
        """Erzeugt eine kompakte Projektzusammenfassung."""
        return ProjectEngine.summary()
