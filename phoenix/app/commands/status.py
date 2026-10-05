"""
Phoenix Status Command

Zeigt den aktuellen Projekt- und Git-Status an.
"""

from app.core.project_engine import ProjectEngine


def run() -> None:
    """Führt den Status-Befehl aus."""
    summary = ProjectEngine.summary()
    git = summary["git"]

    print("Phoenix Status: OK")
    print("")
    print(f"Projekt:       {summary['project']}")
    print(f"Version:       {summary['version']}")
    print(f"Meilenstein:   {summary['milestone']}")
    print("")
    print(f"Branch:        {git['branch']}")
    print(f"Commit:        {git['commit']}")
    print(f"Commit-Text:   {git['message']}")
    print(f"Working Tree:  {'clean' if git['clean'] else 'dirty'}")

    if git["changed_files"]:
        print("")
        print("Geänderte Dateien:")
        for file in git["changed_files"]:
            print(f"  - {file}")
