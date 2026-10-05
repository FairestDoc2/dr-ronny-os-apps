"""
Phoenix Init Command

Erstellt die Phoenix-Verzeichnisstruktur.
"""

from app.core.context_manager import ContextManager


def run() -> None:
    """Initialisiert die Phoenix-Struktur."""
    ContextManager.create_structure()

    print("Phoenix Init: OK")
    print("Phoenix-Verzeichnisstruktur wurde geprüft/erstellt.")
