"""
Phoenix Update Engine

Bereitet sichere Updates vor.
"""

import subprocess
from pathlib import Path
from typing import Any

from app.core.git_engine import GitEngine
from app.core.rollback_engine import RollbackEngine
from app.core.snapshot_engine import SnapshotEngine
from app.core.context_paths import ContextPaths


class UpdateEngine:
    """Engine für sichere Update-Vorbereitung."""

    ROOT = ContextPaths.PROJECT_ROOT

    @staticmethod
    def run_tests() -> dict[str, Any]:
        """Führt die Tests aus."""
        result = subprocess.run(
            ["python3", "-m", "unittest", "discover", "-s", "tests"],
            cwd=UpdateEngine.ROOT,
            capture_output=True,
            text=True,
            check=False,
        )

        return {
            "ok": result.returncode == 0,
            "returncode": result.returncode,
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
        }

    @staticmethod
    def check() -> dict[str, Any]:
        """Prüft, ob ein Update vorbereitet werden kann."""
        tests = UpdateEngine.run_tests()

        return {
            "git": {
                "branch": GitEngine.current_branch(),
                "commit": GitEngine.current_commit(),
                "message": GitEngine.last_commit_message(),
                "clean": GitEngine.is_clean(),
                "changed_files": GitEngine.changed_files(),
            },
            "tests": tests,
            "ready": GitEngine.is_clean() and tests["ok"],
        }

    @staticmethod
    def dry_run() -> dict[str, Any]:
        """Simuliert ein Update ohne Änderungen."""
        check = UpdateEngine.check()

        return {
            "ok": check["ready"],
            "mode": "dry-run",
            "check": check,
            "would_create_snapshot": check["ready"],
        }

    @staticmethod
    def prepare() -> dict[str, Any]:
        """Bereitet ein Update vor und erstellt einen Snapshot."""
        check = UpdateEngine.check()

        if not check["ready"]:
            return {
                "ok": False,
                "snapshot": None,
                "check": check,
                "reason": "Repository ist nicht bereit für ein Update.",
            }

        snapshot = SnapshotEngine.create()

        return {
            "ok": True,
            "snapshot": snapshot,
            "check": check,
        }

    @staticmethod
    def execute_update() -> dict[str, Any]:
        """Führt den Update-Schritt aus.

        Aktuell ist dies bewusst ein sicherer Platzhalter.
        Der echte Update-Mechanismus wird in einem späteren Schritt ergänzt.
        """
        return {
            "ok": True,
            "mode": "dry-run",
            "changed": False,
            "message": "Update-Schritt simuliert. Es wurden keine Dateien geändert.",
        }

    @staticmethod
    def run() -> dict[str, Any]:
        """Führt den sicheren Update-Ablauf aus."""
        prepared = UpdateEngine.prepare()

        if not prepared["ok"]:
            return {
                "ok": False,
                "stage": "prepare",
                "prepared": prepared,
                "update": None,
                "post_tests": None,
                "reason": prepared["reason"],
            }

        update = UpdateEngine.execute_update()
        post_tests = UpdateEngine.run_tests()
        rollback = None

        if not update["ok"] or not post_tests["ok"]:
            rollback = RollbackEngine.rollback(prepared["snapshot"]["id"], force=True)

        return {
            "ok": update["ok"] and post_tests["ok"],
            "stage": "complete" if update["ok"] and post_tests["ok"] else "rollback",
            "prepared": prepared,
            "snapshot": prepared["snapshot"],
            "update": update,
            "post_tests": post_tests,
            "rollback": rollback,
        }
