"""
Phoenix Doctor Command

Prüft die Phoenix-Verzeichnisstruktur.
"""

from app.core.context_manager import ContextManager


def run() -> None:
    """Führt den Doctor-Check aus."""
    if ContextManager.check_structure():
        print("Phoenix Doctor: OK")
        print("Alle Phoenix-Verzeichnisse sind vorhanden.")
    else:
        print("Phoenix Doctor: FEHLER")
        print("Mindestens ein Phoenix-Verzeichnis fehlt.")
        print("Nutze: python3 tools/phoenix.py init")
