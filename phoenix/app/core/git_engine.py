"""
Phoenix Git Engine

Liest Git-Informationen für das aktuelle Projekt aus.
"""

import subprocess
from pathlib import Path
from app.core.context_paths import ContextPaths


class GitEngine:
    """Zentrale Engine für Git-Informationen."""

    ROOT = ContextPaths.PROJECT_ROOT

    @staticmethod
    def _run_git(args: list[str]) -> str:
        """Führt einen Git-Befehl aus und gibt die Ausgabe zurück."""
        result = subprocess.run(
            ["git", *args],
            cwd=GitEngine.ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()

    @staticmethod
    def current_branch() -> str:
        """Gibt den aktuellen Git-Branch zurück."""
        return GitEngine._run_git(["branch", "--show-current"])

    @staticmethod
    def current_commit() -> str:
        """Gibt den aktuellen kurzen Commit-Hash zurück."""
        return GitEngine._run_git(["rev-parse", "--short", "HEAD"])

    @staticmethod
    def last_commit_message() -> str:
        """Gibt die letzte Commit-Nachricht zurück."""
        return GitEngine._run_git(["log", "-1", "--pretty=%s"])

    @staticmethod
    def short_status() -> str:
        """Gibt den Git-Status im Short-Format zurück."""
        return GitEngine._run_git(["status", "--short"])

    @staticmethod
    def is_clean() -> bool:
        """Prüft, ob der Working Tree sauber ist."""
        return GitEngine.short_status() == ""

    @staticmethod
    def changed_files() -> list[str]:
        """Gibt eine Liste der geänderten Dateien zurück."""
        status = GitEngine.short_status()

        if not status:
            return []

        files: list[str] = []

        for line in status.splitlines():
            # Format von "git status --short":
            # " M tools/phoenix.py"
            # "A  app/core/file.py"
            # "?? neue_datei.py"
            if len(line) >= 3:
                files.append(line[2:].strip())

        return files
