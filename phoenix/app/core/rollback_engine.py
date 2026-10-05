"""Rollback Engine für Phoenix."""

from __future__ import annotations

from typing import Any

from app.core.git_engine import GitEngine
from app.core.snapshot_engine import SnapshotEngine


class RollbackEngine:
    """Bereitet Rollbacks vor, prüft Snapshots und führt sichere Restores aus."""

    @staticmethod
    def prepare(snapshot_id: str) -> dict[str, Any]:
        """Prüft, ob ein Rollback grundsätzlich möglich ist."""
        verify = SnapshotEngine.verify(snapshot_id)
        clean = GitEngine.is_clean()

        return {
            "id": snapshot_id,
            "ok": verify["ok"] and clean,
            "git": {
                "clean": clean,
                "changed_files": GitEngine.changed_files(),
            },
            "snapshot": verify,
            "ready": verify["ok"] and clean,
        }

    @staticmethod
    def rollback(snapshot_id: str, force: bool = False) -> dict[str, Any]:
        """Führt einen Rollback aus oder simuliert ihn ohne force."""
        prepared = RollbackEngine.prepare(snapshot_id)

        if not prepared["ready"]:
            return {
                "id": snapshot_id,
                "ok": False,
                "rolled_back": False,
                "prepared": prepared,
                "reason": "Rollback nicht möglich. Snapshot ungültig oder Working Tree nicht clean.",
            }

        restore = SnapshotEngine.restore(snapshot_id, force=force)

        return {
            "id": snapshot_id,
            "ok": restore["ok"],
            "rolled_back": force and restore["ok"],
            "prepared": prepared,
            "restore": restore,
        }
