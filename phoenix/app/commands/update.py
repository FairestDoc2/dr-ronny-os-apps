"""
Phoenix Update Command

Prüft und bereitet sichere Phoenix-Updates vor.
"""

import sys

from app.core.update_engine import UpdateEngine


def show_check(check: dict) -> None:
    """Zeigt Update-Prüfungen an."""
    git = check["git"]
    tests = check["tests"]

    print("Git:")
    print(f"  Branch:        {git['branch']}")
    print(f"  Commit:        {git['commit']}")
    print(f"  Commit-Text:   {git['message']}")
    print(f"  Working Tree:  {'clean' if git['clean'] else 'dirty'}")

    if git["changed_files"]:
        print("  Geänderte Dateien:")
        for file in git["changed_files"]:
            print(f"    - {file}")

    print("")
    print("Tests:")
    print(f"  Status:        {'OK' if tests['ok'] else 'FEHLER'}")
    print(f"  Returncode:    {tests['returncode']}")


def show_help() -> None:
    print("Nutze:")
    print("  python3 tools/phoenix.py update check")
    print("  python3 tools/phoenix.py update dry-run")
    print("  python3 tools/phoenix.py update prepare")
    print("  python3 tools/phoenix.py update run")


def run() -> None:
    """Führt den Update-Befehl aus."""
    action = sys.argv[2].lower() if len(sys.argv) >= 3 else "check"

    if action == "check":
        check = UpdateEngine.check()
        print("Phoenix Update Check")
        print("")
        show_check(check)
        print("")
        print(f"Update bereit: {'JA' if check['ready'] else 'NEIN'}")
        return

    if action == "dry-run":
        result = UpdateEngine.dry_run()
        print("Phoenix Update Dry-Run")
        print("")
        show_check(result["check"])
        print("")
        print(f"Snapshot würde erstellt: {'JA' if result['would_create_snapshot'] else 'NEIN'}")
        print(f"Update bereit: {'JA' if result['ok'] else 'NEIN'}")
        return

    if action == "prepare":
        result = UpdateEngine.prepare()
        print("Phoenix Update Prepare")
        print("")
        show_check(result["check"])
        print("")

        if not result["ok"]:
            print("Status: FEHLER")
            print(result["reason"])
            return

        snapshot = result["snapshot"]
        print("Status: OK")
        print(f"Snapshot-ID: {snapshot['id']}")
        print(f"Snapshot:    {snapshot['file']}")
        print(f"SHA256:      {snapshot['sha256']}")
        return

    if action == "run":
        result = UpdateEngine.run()
        print("Phoenix Update Run")
        print("")

        prepared = result["prepared"]
        show_check(prepared["check"])
        print("")

        if not result["ok"] and result["stage"] == "prepare":
            print("Status: FEHLER")
            print(result["reason"])
            return

        snapshot = result["snapshot"]
        update = result["update"]
        post_tests = result["post_tests"]

        print("Snapshot:")
        print(f"  ID:      {snapshot['id']}")
        print(f"  Datei:   {snapshot['file']}")
        print(f"  SHA256:  {snapshot['sha256']}")
        print("")
        print("Update:")
        print(f"  Modus:   {update['mode']}")
        print(f"  Status:  {'OK' if update['ok'] else 'FEHLER'}")
        print(f"  Info:    {update['message']}")
        print("")
        print("Tests nach Update:")
        print(f"  Status:      {'OK' if post_tests['ok'] else 'FEHLER'}")
        print(f"  Returncode:  {post_tests['returncode']}")
        print("")
        print(f"Gesamtstatus: {'OK' if result['ok'] else 'FEHLER'}")
        return

    print(f"Unbekannte Update-Aktion: {action}")
    show_help()
