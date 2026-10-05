"""
Phoenix Snapshot Engine

Erstellt Projekt-Snapshots als ZIP-Datei mit Metadaten.
"""

import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable
from zipfile import ZIP_DEFLATED, ZipFile

from app.core.project_engine import ProjectEngine
from app.core.context_paths import ContextPaths


class SnapshotEngine:
    """Engine zum Erstellen und Auflisten von Phoenix-Snapshots."""

    ROOT = ContextPaths.PROJECT_ROOT

    # Im Home-Assistant-Add-on liegt /config auf persistentem Speicher.
    # In der lokalen Entwicklungsumgebung bleiben die bisherigen
    # Projekt-Snapshots unter backups/snapshots erhalten.
    SNAPSHOT_DIR = (
        Path("/config/dr_ronny_os/snapshots")
        if ROOT == Path("/app") and Path("/config").is_dir()
        else ROOT / "backups" / "snapshots"
    )

    EXCLUDE_PARTS = {
        ".git",
        "__pycache__",
        ".pytest_cache",
    }

    EXCLUDE_PREFIXES = (
        "backups/snapshots/",
    )

    @staticmethod
    def _should_include(path: Path) -> bool:
        """Prüft, ob eine Datei in den Snapshot gehört."""
        relative = path.relative_to(SnapshotEngine.ROOT).as_posix()

        if any(part in SnapshotEngine.EXCLUDE_PARTS for part in path.parts):
            return False

        if any(relative.startswith(prefix) for prefix in SnapshotEngine.EXCLUDE_PREFIXES):
            return False

        return path.is_file()

    @staticmethod
    def files() -> Iterable[Path]:
        """Gibt alle Dateien zurück, die gesichert werden sollen."""
        for path in SnapshotEngine.ROOT.rglob("*"):
            if SnapshotEngine._should_include(path):
                yield path

    @staticmethod
    def sha256(path: Path) -> str:
        """Berechnet den SHA-256-Wert einer Datei."""
        digest = hashlib.sha256()

        with path.open("rb") as file:
            for chunk in iter(lambda: file.read(1024 * 1024), b""):
                digest.update(chunk)

        return digest.hexdigest()

    @staticmethod
    def create() -> dict[str, Any]:
        """Erstellt einen Snapshot und gibt Metadaten zurück."""
        SnapshotEngine.SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)

        created = datetime.now()
        snapshot_id = created.strftime("%Y%m%d_%H%M%S")

        snapshot_path = SnapshotEngine.SNAPSHOT_DIR / f"phoenix_snapshot_{snapshot_id}.zip"
        metadata_path = SnapshotEngine.SNAPSHOT_DIR / f"phoenix_snapshot_{snapshot_id}.json"

        with ZipFile(snapshot_path, "w", compression=ZIP_DEFLATED) as archive:
            for file in SnapshotEngine.files():
                archive.write(file, file.relative_to(SnapshotEngine.ROOT))

        project = ProjectEngine.summary()

        metadata = {
            "id": snapshot_id,
            "name": f"Snapshot {snapshot_id}",
            "created": created.isoformat(timespec="seconds"),
            "file": snapshot_path.name,
            "metadata_file": metadata_path.name,
            "size_bytes": snapshot_path.stat().st_size,
            "sha256": SnapshotEngine.sha256(snapshot_path),
            "project": project["project"],
            "version": project["version"],
            "milestone": project["milestone"],
            "next_task": project["next_task"],
            "git": project["git"],
        }

        metadata_path.write_text(
            json.dumps(metadata, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )

        return metadata

    @staticmethod
    def list() -> list[Path]:
        """Listet vorhandene Snapshot-ZIP-Dateien auf."""
        if not SnapshotEngine.SNAPSHOT_DIR.exists():
            return []

        return sorted(SnapshotEngine.SNAPSHOT_DIR.glob("phoenix_snapshot_*.zip"))

    @staticmethod

    @staticmethod
    def read_metadata(snapshot_id: str) -> dict[str, Any]:
        """Lädt die Metadaten eines Snapshots."""
        metadata_path = SnapshotEngine.SNAPSHOT_DIR / f"phoenix_snapshot_{snapshot_id}.json"

        if not metadata_path.exists():
            raise FileNotFoundError(f"Snapshot-Metadaten nicht gefunden: {snapshot_id}")

        return json.loads(metadata_path.read_text(encoding="utf-8"))



    @staticmethod
    def snapshot_path_from_metadata(metadata: dict[str, Any]) -> Path:
        """Ermittelt den Snapshot-Pfad aus Metadaten."""
        snapshot_file = metadata["file"]
        snapshot_path = Path(snapshot_file)

        if not snapshot_path.is_absolute():
            snapshot_path = SnapshotEngine.SNAPSHOT_DIR / snapshot_file

        return snapshot_path


    @staticmethod
    def rename(snapshot_id: str, name: str) -> dict[str, Any]:
        """Ändert nur den Anzeigenamen eines Snapshots, niemals seine technische ID."""
        name = name.strip()

        if not name:
            raise ValueError("Snapshot-Name darf nicht leer sein.")

        if len(name) > 120:
            raise ValueError("Snapshot-Name darf maximal 120 Zeichen lang sein.")

        metadata_path = (
            SnapshotEngine.SNAPSHOT_DIR
            / f"phoenix_snapshot_{snapshot_id}.json"
        )

        metadata = SnapshotEngine.read_metadata(snapshot_id)
        metadata["name"] = name

        metadata_path.write_text(
            json.dumps(metadata, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )

        return {
            "id": snapshot_id,
            "ok": True,
            "name": name,
            "metadata_file": str(metadata_path),
        }

    @staticmethod
    def delete(snapshot_id: str, force: bool = False) -> dict[str, Any]:
        """Löscht einen Snapshot und seine Metadaten oder simuliert das Löschen."""
        metadata = SnapshotEngine.read_metadata(snapshot_id)
        snapshot_path = SnapshotEngine.snapshot_path_from_metadata(metadata)
        metadata_path = SnapshotEngine.SNAPSHOT_DIR / f"phoenix_snapshot_{snapshot_id}.json"

        targets = [snapshot_path, metadata_path]
        existing = [target for target in targets if target.exists()]

        if force:
            for target in existing:
                target.unlink()

        return {
            "id": snapshot_id,
            "ok": True,
            "deleted": force,
            "files": [str(target) for target in existing],
        }

    @staticmethod
    def restore(snapshot_id: str, force: bool = False) -> dict[str, Any]:
        """Stellt einen Snapshot wieder her oder simuliert die Wiederherstellung."""
        verification = SnapshotEngine.verify(snapshot_id)

        if not verification["ok"]:
            return {
                "id": snapshot_id,
                "ok": False,
                "restored": False,
                "reason": verification.get("reason", "Snapshot-Verifikation fehlgeschlagen"),
            }

        metadata = SnapshotEngine.read_metadata(snapshot_id)
        snapshot_path = SnapshotEngine.snapshot_path_from_metadata(metadata)

        with ZipFile(snapshot_path, "r") as archive:
            members = archive.namelist()

            root = SnapshotEngine.ROOT.resolve()

            for member in members:
                member_path = Path(member)

                if member_path.is_absolute():
                    return {
                        "id": snapshot_id,
                        "ok": False,
                        "restored": False,
                        "reason": "Unsicherer Pfad im Snapshot",
                    }

                target = (root / member_path).resolve()

                try:
                    target.relative_to(root)
                except ValueError:
                    return {
                        "id": snapshot_id,
                        "ok": False,
                        "restored": False,
                        "reason": "Unsicherer Pfad im Snapshot",
                    }

            if force:
                archive.extractall(SnapshotEngine.ROOT)

        return {
            "id": snapshot_id,
            "ok": True,
            "restored": force,
            "file": str(snapshot_path),
            "files": len(members),
        }

    @staticmethod
    def info(snapshot_id: str) -> dict[str, Any]:
        """Gibt die Metadaten eines Snapshots zurück."""
        return SnapshotEngine.read_metadata(snapshot_id)

    @staticmethod
    def verify(snapshot_id: str) -> dict[str, Any]:
        """Prüft, ob ein Snapshot zur gespeicherten Prüfsumme passt."""
        metadata = SnapshotEngine.read_metadata(snapshot_id)
        snapshot_path = SnapshotEngine.snapshot_path_from_metadata(metadata)

        if not snapshot_path.exists():
            return {
                "id": snapshot_id,
                "ok": False,
                "reason": "Snapshot-Datei nicht gefunden",
            }

        actual_sha256 = SnapshotEngine.sha256(snapshot_path)
        expected_sha256 = metadata.get("sha256", "")

        return {
            "id": snapshot_id,
            "ok": actual_sha256 == expected_sha256,
            "expected_sha256": expected_sha256,
            "actual_sha256": actual_sha256,
            "file": str(snapshot_path),
        }

    def metadata_files() -> list[Path]:
        """Listet vorhandene Snapshot-Metadaten auf."""
        if not SnapshotEngine.SNAPSHOT_DIR.exists():
            return []

        return sorted(SnapshotEngine.SNAPSHOT_DIR.glob("phoenix_snapshot_*.json"))
