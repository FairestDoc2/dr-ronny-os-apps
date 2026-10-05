"""
Phoenix Resume Command

Zeigt den aktuellen Projektstatus zum Fortsetzen an.
"""

from json import JSONDecodeError

from app.core.project_engine import ProjectEngine


def run() -> None:
    """Führt den Resume-Befehl aus."""
    try:
        summary = ProjectEngine.summary()
        git = summary["git"]
    except FileNotFoundError:
        print("Phoenix Resume: FEHLER")
        print("Statusdatei nicht gefunden.")
        print("Lege zuerst eine gültige state.json an.")
        return
    except JSONDecodeError:
        print("Phoenix Resume: FEHLER")
        print("Statusdatei enthält ungültiges JSON.")
        return
    except ValueError as error:
        print("Phoenix Resume: FEHLER")
        print(error)
        return

    print("Phoenix Resume: OK")
    print("")
    print(f"Projekt:          {summary['project']}")
    print(f"Version:          {summary['version']}")
    print(f"Meilenstein:      {summary['milestone']}")
    print(f"Nächste Aufgabe:  {summary['next_task']}")
    print("")
    print("Git:")
    print(f"  Branch:         {git['branch']}")
    print(f"  Commit:         {git['commit']}")
    print(f"  Commit-Text:    {git['message']}")
    print(f"  Working Tree:   {'clean' if git['clean'] else 'dirty'}")

    if git["changed_files"]:
        print("")
        print("Geänderte Dateien:")
        for file in git["changed_files"]:
            print(f"  - {file}")
