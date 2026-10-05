"""
Phoenix Snapshot Command

Erstellt, prüft und verwaltet Phoenix-Projekt-Snapshots.
"""

import sys
from typing import Any

from app.core.snapshot_engine import SnapshotEngine


def show_help() -> None:
    """Zeigt die Snapshot-Hilfe."""
    print("Phoenix Snapshot")
    print("")
    print("Verwendung:")
    print("  python3 tools/phoenix.py snapshot <aktion>")
    print("")
    print("Aktionen:")
    print("  create")
    print("  list")
    print("  metadata")
    print("  info <id>")
    print("  verify <id>")
    print("  restore <id> [--force]")
    print("  delete <id> [--force]")


def require_snapshot_id(action: str) -> str | None:
    """Liest die Snapshot-ID aus den CLI-Argumenten."""
    if len(sys.argv) >= 4:
        return sys.argv[3]

    print(f"Phoenix Snapshot {action.title()}: FEHLER")
    print("Snapshot-ID fehlt.")
    print(f"Nutze: python3 tools/phoenix.py snapshot {action} <id>")
    return None


def handle_create() -> None:
    """Erstellt einen Snapshot."""
    metadata = SnapshotEngine.create()
    print("Phoenix Snapshot: OK")
    print(f"ID:     {metadata['id']}")
    print(f"Datei:  {metadata['file']}")
    print(f"Größe:  {metadata['size_bytes']} Bytes")
    print(f"SHA256: {metadata['sha256']}")


def handle_list() -> None:
    """Listet Snapshot-Dateien."""
    snapshots = SnapshotEngine.list()

    print("Phoenix Snapshots:")

    if not snapshots:
        print("Keine Snapshots vorhanden.")
        return

    for snapshot in snapshots:
        print(f"  - {snapshot}")


def handle_metadata() -> None:
    """Listet Snapshot-Metadaten."""
    metadata_files = SnapshotEngine.metadata_files()

    print("Phoenix Snapshot Metadata:")

    if not metadata_files:
        print("Keine Metadaten vorhanden.")
        return

    for metadata_file in metadata_files:
        print(f"  - {metadata_file}")


def handle_info() -> None:
    """Zeigt Snapshot-Informationen."""
    snapshot_id = require_snapshot_id("info")
    if snapshot_id is None:
        return

    metadata = SnapshotEngine.info(snapshot_id)
    git: dict[str, Any] = metadata.get("git", {})

    print("Phoenix Snapshot Info")
    print("")
    print(f"ID:                {metadata.get('id', '')}")
    print(f"Erstellt:          {metadata.get('created', '')}")
    print(f"Datei:             {metadata.get('file', '')}")
    print(f"Metadaten:         {metadata.get('metadata_file', '')}")
    print(f"Größe:             {metadata.get('size_bytes', '')} Bytes")
    print(f"SHA256:            {metadata.get('sha256', '')}")
    print("")
    print("Projekt:")
    print(f"  Name:            {metadata.get('project', '')}")
    print(f"  Version:         {metadata.get('version', '')}")
    print(f"  Meilenstein:     {metadata.get('milestone', '')}")
    print(f"  Nächste Aufgabe: {metadata.get('next_task', '')}")
    print("")
    print("Git:")
    print(f"  Branch:          {git.get('branch', '')}")
    print(f"  Commit:          {git.get('commit', '')}")
    print(f"  Commit-Text:     {git.get('message', '')}")
    print(f"  Working Tree:    {'clean' if git.get('clean') else 'dirty'}")


def handle_verify() -> None:
    """Prüft einen Snapshot."""
    snapshot_id = require_snapshot_id("verify")
    if snapshot_id is None:
        return

    result = SnapshotEngine.verify(snapshot_id)

    if result["ok"]:
        print("Phoenix Snapshot Verify: OK")
        print(f"ID:     {result['id']}")
        print(f"Datei:  {result['file']}")
        print(f"SHA256: {result['actual_sha256']}")
        return

    print("Phoenix Snapshot Verify: FEHLER")
    print(f"ID:      {result['id']}")
    print(f"Grund:   {result.get('reason', 'Prüfsumme stimmt nicht')}")

    if "expected_sha256" in result:
        print(f"Erwartet: {result['expected_sha256']}")
        print(f"Aktuell:  {result['actual_sha256']}")


def handle_restore() -> None:
    """Stellt einen Snapshot wieder her oder simuliert es."""
    snapshot_id = require_snapshot_id("restore")
    if snapshot_id is None:
        return

    force = "--force" in sys.argv[4:]
    result = SnapshotEngine.restore(snapshot_id, force=force)

    if not result["ok"]:
        print("Phoenix Snapshot Restore: FEHLER")
        print(f"ID:    {result['id']}")
        print(f"Grund: {result.get('reason', '')}")
        return

    if result["restored"]:
        print("Phoenix Snapshot Restore: OK")
        print(f"ID:      {result['id']}")
        print(f"Datei:   {result['file']}")
        print(f"Dateien: {result['files']}")
        return

    print("Phoenix Snapshot Restore: DRY-RUN")
    print(f"ID:      {result['id']}")
    print(f"Datei:   {result['file']}")
    print(f"Dateien: {result['files']}")
    print("")
    print("Es wurde noch nichts überschrieben.")
    print("Zum echten Wiederherstellen nutze:")
    print(f"  python3 tools/phoenix.py snapshot restore {result['id']} --force")


def handle_delete() -> None:
    """Löscht einen Snapshot oder simuliert es."""
    snapshot_id = require_snapshot_id("delete")
    if snapshot_id is None:
        return

    force = "--force" in sys.argv[4:]
    result = SnapshotEngine.delete(snapshot_id, force=force)

    if result["deleted"]:
        print("Phoenix Snapshot Delete: OK")
        print(f"ID: {result['id']}")
        for file in result["files"]:
            print(f"Gelöscht: {file}")
        return

    print("Phoenix Snapshot Delete: DRY-RUN")
    print(f"ID: {result['id']}")
    for file in result["files"]:
        print(f"Würde löschen: {file}")
    print("")
    print("Es wurde noch nichts gelöscht.")
    print("Zum echten Löschen nutze:")
    print(f"  python3 tools/phoenix.py snapshot delete {result['id']} --force")


COMMANDS = {
    "create": handle_create,
    "delete": handle_delete,
    "info": handle_info,
    "list": handle_list,
    "metadata": handle_metadata,
    "restore": handle_restore,
    "verify": handle_verify,
}


def run() -> None:
    """Führt den Snapshot-Befehl aus."""
    action = sys.argv[2].lower() if len(sys.argv) >= 3 else "create"

    if action in {"help", "-h", "--help"}:
        show_help()
        return

    if action not in COMMANDS:
        print(f"Unbekannte Snapshot-Aktion: {action}")
        show_help()
        return

    COMMANDS[action]()
