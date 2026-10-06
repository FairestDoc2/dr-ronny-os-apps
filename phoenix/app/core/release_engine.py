"""
Phoenix Release Engine

Bereitet die Veröffentlichung neuer Phoenix-Versionen vor.
"""

import json
from pathlib import Path
from typing import Any

from app.core.context_paths import ContextPaths


class ReleaseEngine:
    """Zentrale Engine für Phoenix-Veröffentlichungen."""

    ROOT = ContextPaths.PROJECT_ROOT
    VERSION_FILE = ROOT / "manifest" / "version.json"
    RELEASE_FILE = ROOT / "manifest" / "release.json"

    @staticmethod
    def get_published_version() -> str:
        """Liest die zuletzt veröffentlichte Phoenix-Version."""
        if not ReleaseEngine.RELEASE_FILE.is_file():
            raise RuntimeError(
                "manifest/release.json fehlt."
            )

        try:
            data = json.loads(
                ReleaseEngine.RELEASE_FILE.read_text(
                    encoding="utf-8"
                )
            )
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                f"Ungültiges JSON in manifest/release.json: {exc}"
            ) from exc

        version = data.get("published_version")

        if not isinstance(version, str) or not version.strip():
            raise RuntimeError(
                "Keine gültige veröffentlichte Version "
                "in manifest/release.json."
            )

        return version.strip()

    @staticmethod
    def write_published_version(
        version: str,
    ) -> dict[str, Any]:
        """Speichert die zuletzt veröffentlichte Phoenix-Version."""
        data = {
            "published_version": version
        }

        ReleaseEngine.RELEASE_FILE.write_text(
            json.dumps(
                data,
                indent=2,
                ensure_ascii=False,
            ) + "\n",
            encoding="utf-8",
        )

        return {
            "ok": True,
            "published_version": version,
            "file": str(
                ReleaseEngine.RELEASE_FILE
            ),
        }

    @staticmethod
    def write_release_copy_published_version(
        repository: Path,
        version: str,
    ) -> dict[str, Any]:
        """
        Schreibt die veröffentlichte Version gezielt
        in die Phoenix-Release-Kopie.
        """
        release_file = (
            repository
            / "phoenix"
            / "manifest"
            / "release.json"
        )

        release_file.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        data = {
            "published_version": version
        }

        release_file.write_text(
            json.dumps(
                data,
                indent=2,
                ensure_ascii=False,
            ) + "\n",
            encoding="utf-8",
        )

        return {
            "ok": True,
            "published_version": version,
            "file": str(release_file),
        }

    @staticmethod
    def get_current_version() -> str:
        """Liest die aktuelle Version aus der zentralen Versionsdatei."""
        if not ReleaseEngine.VERSION_FILE.is_file():
            raise RuntimeError(
                "manifest/version.json fehlt."
            )

        try:
            data = json.loads(
                ReleaseEngine.VERSION_FILE.read_text(
                    encoding="utf-8"
                )
            )
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                f"Ungültiges JSON in manifest/version.json: {exc}"
            ) from exc

        version = data.get("version")

        if not isinstance(version, str) or not version.strip():
            raise RuntimeError(
                "Keine gültige Version in manifest/version.json."
            )

        return version.strip()

    @staticmethod
    def next_patch_version(
        version: str | None = None,
    ) -> str:
        """
        Erhöht ausschließlich die Patch-Version.

        Beispiel:
        1.0.25 -> 1.0.26
        """
        current = (
            version
            if version is not None
            else ReleaseEngine.get_current_version()
        )

        parts = current.split(".")

        if len(parts) != 3:
            raise RuntimeError(
                f"Ungültiges Versionsformat: {current}"
            )

        try:
            major, minor, patch = (
                int(part) for part in parts
            )
        except ValueError as exc:
            raise RuntimeError(
                f"Ungültiges Versionsformat: {current}"
            ) from exc

        return f"{major}.{minor}.{patch + 1}"

    @staticmethod
    def preview() -> dict[str, Any]:
        """Zeigt die nächste Version ohne Änderungen an."""
        current = ReleaseEngine.get_current_version()
        next_version = ReleaseEngine.next_patch_version(
            current
        )

        return {
            "ok": True,
            "current_version": current,
            "next_version": next_version,
            "changed": False,
        }

    @staticmethod
    def set_development_version(
        version: str,
    ) -> dict[str, Any]:
        """
        Setzt die gewünschte Entwicklerversion.

        Erlaubt ausschließlich das Format X.Y.Z.
        """
        import re

        version = version.strip()

        if not re.fullmatch(
            r"\d+\.\d+\.\d+",
            version,
        ):
            raise RuntimeError(
                "Ungültige Entwicklerversion. "
                "Erwartet wird das Format X.Y.Z."
            )

        published_version = (
            ReleaseEngine.get_published_version()
        )

        def version_tuple(value: str) -> tuple[int, int, int]:
            return tuple(
                int(part)
                for part in value.split(".")
            )

        if version_tuple(version) <= version_tuple(
            published_version
        ):
            raise RuntimeError(
                "Die Entwicklerversion muss höher "
                "als die veröffentlichte Version sein."
            )

        manifest_original = (
            ReleaseEngine.VERSION_FILE.read_text(
                encoding="utf-8"
            )
        )

        config_original = (
            ReleaseEngine.CONFIG_FILE.read_text(
                encoding="utf-8"
            )
        )

        try:
            ReleaseEngine.write_version(version)
            ReleaseEngine.write_config_version(version)
        except Exception:
            ReleaseEngine.VERSION_FILE.write_text(
                manifest_original,
                encoding="utf-8",
            )
            ReleaseEngine.CONFIG_FILE.write_text(
                config_original,
                encoding="utf-8",
            )
            raise

        return {
            "ok": True,
            "development_version": version,
            "published_version": published_version,
        }

    @staticmethod
    def write_version(version: str) -> dict[str, Any]:
        """Schreibt eine neue Version in manifest/version.json."""
        data = json.loads(
            ReleaseEngine.VERSION_FILE.read_text(
                encoding="utf-8"
            )
        )

        data["version"] = version

        ReleaseEngine.VERSION_FILE.write_text(
            json.dumps(
                data,
                indent=2,
                ensure_ascii=False,
            ) + "\n",
            encoding="utf-8",
        )

        return {
            "ok": True,
            "version": version,
            "file": str(
                ReleaseEngine.VERSION_FILE
            ),
        }

    CONFIG_FILE = ROOT / "config.yaml"

    @staticmethod
    def write_config_version(version: str) -> dict[str, Any]:
        """Schreibt dieselbe Version in config.yaml."""
        if not ReleaseEngine.CONFIG_FILE.is_file():
            raise RuntimeError(
                "config.yaml fehlt."
            )

        lines = ReleaseEngine.CONFIG_FILE.read_text(
            encoding="utf-8"
        ).splitlines()

        changed = False
        new_lines: list[str] = []

        for line in lines:
            if line.strip().startswith("version:"):
                indent = line[:len(line) - len(line.lstrip())]

                new_lines.append(
                    f'{indent}version: "{version}"'
                )

                changed = True
            else:
                new_lines.append(line)

        if not changed:
            raise RuntimeError(
                "Kein version:-Eintrag in config.yaml gefunden."
            )

        ReleaseEngine.CONFIG_FILE.write_text(
            "\n".join(new_lines) + "\n",
            encoding="utf-8",
        )

        return {
            "ok": True,
            "version": version,
            "file": str(
                ReleaseEngine.CONFIG_FILE
            ),
        }

    @staticmethod
    def bump_patch_version() -> dict[str, Any]:
        """
        Erhöht die Patch-Version und schreibt sie
        konsistent in manifest/version.json und config.yaml.
        """
        current = ReleaseEngine.get_current_version()
        next_version = ReleaseEngine.next_patch_version(
            current
        )

        manifest_original = (
            ReleaseEngine.VERSION_FILE.read_text(
                encoding="utf-8"
            )
        )

        config_original = (
            ReleaseEngine.CONFIG_FILE.read_text(
                encoding="utf-8"
            )
        )

        try:
            manifest_result = ReleaseEngine.write_version(
                next_version
            )

            config_result = ReleaseEngine.write_config_version(
                next_version
            )

        except Exception:
            ReleaseEngine.VERSION_FILE.write_text(
                manifest_original,
                encoding="utf-8",
            )

            ReleaseEngine.CONFIG_FILE.write_text(
                config_original,
                encoding="utf-8",
            )

            raise

        return {
            "ok": True,
            "previous_version": current,
            "version": next_version,
            "manifest": manifest_result,
            "config": config_result,
        }

    @staticmethod
    def push_release(
        repository: Path,
        token: str,
        branch: str = "main",
    ) -> dict[str, Any]:
        """
        Pusht einen vorbereiteten Release-Commit zu GitHub.

        Der GitHub-Token wird nicht in der Remote-URL
        gespeichert und nicht in der Ausgabe zurückgegeben.
        """
        import os
        import subprocess

        if not repository.is_dir():
            raise RuntimeError(
                "Release-Repository fehlt."
            )

        if not (repository / ".git").exists():
            raise RuntimeError(
                "Release-Verzeichnis ist kein Git-Repository."
            )

        token = token.strip()

        if not token:
            raise RuntimeError(
                "GitHub-Token ist nicht konfiguriert."
            )

        env = os.environ.copy()

        env["PHOENIX_GITHUB_TOKEN"] = token
        env["GIT_TERMINAL_PROMPT"] = "0"
        env["GIT_ASKPASS"] = "/bin/sh"
        env["GIT_USERNAME"] = "FairestDoc2"

        askpass = (
            'case "$1" in '
            '*Username*) printf "%s\\n" "$GIT_USERNAME" ;; '
            '*) printf "%s\\n" "$PHOENIX_GITHUB_TOKEN" ;; '
            'esac'
        )

        env["GIT_ASKPASS_REQUIRE"] = "force"
        env["GIT_ASKPASS"] = (
            str(repository / ".phoenix-git-askpass.sh")
        )

        askpass_path = Path(env["GIT_ASKPASS"])

        try:
            askpass_path.write_text(
                "#!/bin/sh\n" + askpass + "\n",
                encoding="utf-8",
            )

            askpass_path.chmod(0o700)

            result = subprocess.run(
                [
                    "git",
                    "-C",
                    str(repository),
                    "push",
                    "origin",
                    branch,
                ],
                capture_output=True,
                text=True,
                timeout=120,
                check=False,
                env=env,
            )

            if result.returncode != 0:
                raise RuntimeError(
                    result.stderr.strip()
                    or "GitHub-Push fehlgeschlagen."
                )

            return {
                "ok": True,
                "branch": branch,
                "pushed": True,
            }

        finally:
            try:
                askpass_path.unlink()
            except FileNotFoundError:
                pass

    @staticmethod
    def commit_release(
        repository: Path,
        version: str,
    ) -> dict[str, Any]:
        """
        Erstellt den Git-Commit für eine neue Phoenix-Version.
        """
        import subprocess

        if not repository.is_dir():
            raise RuntimeError(
                "Release-Repository fehlt."
            )

        if not (repository / ".git").exists():
            raise RuntimeError(
                "Release-Verzeichnis ist kein Git-Repository."
            )

        add_result = subprocess.run(
            [
                "git",
                "-C",
                str(repository),
                "add",
                "phoenix",
            ],
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
        )

        if add_result.returncode != 0:
            raise RuntimeError(
                add_result.stderr.strip()
                or "Git add fehlgeschlagen."
            )

        status_result = subprocess.run(
            [
                "git",
                "-C",
                str(repository),
                "diff",
                "--cached",
                "--quiet",
            ],
            timeout=30,
            check=False,
        )

        if status_result.returncode == 0:
            raise RuntimeError(
                "Keine Änderungen für Release-Commit vorhanden."
            )

        if status_result.returncode != 1:
            raise RuntimeError(
                "Git-Status konnte nicht geprüft werden."
            )

        message = f"Release Phoenix {version}"

        commit_result = subprocess.run(
            [
                "git",
                "-C",
                str(repository),
                "commit",
                "-m",
                message,
            ],
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
        )

        if commit_result.returncode != 0:
            raise RuntimeError(
                commit_result.stderr.strip()
                or commit_result.stdout.strip()
                or "Release-Commit fehlgeschlagen."
            )

        commit_hash = subprocess.run(
            [
                "git",
                "-C",
                str(repository),
                "rev-parse",
                "--short",
                "HEAD",
            ],
            capture_output=True,
            text=True,
            timeout=30,
            check=True,
        ).stdout.strip()

        return {
            "ok": True,
            "committed": True,
            "version": version,
            "commit": commit_hash,
            "message": message,
        }

    @staticmethod
    def get_repository_head(
        repository: Path,
    ) -> str:
        """Liest den aktuellen vollständigen Git-HEAD."""
        import subprocess

        result = subprocess.run(
            [
                "git",
                "-C",
                str(repository),
                "rev-parse",
                "HEAD",
            ],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )

        if result.returncode != 0:
            raise RuntimeError(
                result.stderr.strip()
                or "Git-HEAD konnte nicht gelesen werden."
            )

        return result.stdout.strip()

    @staticmethod
    def rollback_release_commit(
        repository: Path,
        commit: str,
    ) -> dict[str, Any]:
        """
        Setzt einen noch nicht veröffentlichten Release-Commit
        auf den vorher gemerkten Git-Stand zurück.
        """
        import subprocess

        if not commit:
            raise RuntimeError(
                "Rollback-Commit fehlt."
            )

        result = subprocess.run(
            [
                "git",
                "-C",
                str(repository),
                "reset",
                "--hard",
                commit,
            ],
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
        )

        if result.returncode != 0:
            raise RuntimeError(
                result.stderr.strip()
                or "Release-Commit-Rollback fehlgeschlagen."
            )

        clean_result = subprocess.run(
            [
                "git",
                "-C",
                str(repository),
                "clean",
                "-fd",
                "--",
                "phoenix",
            ],
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
        )

        if clean_result.returncode != 0:
            raise RuntimeError(
                clean_result.stderr.strip()
                or "Bereinigung der Release-Kopie fehlgeschlagen."
            )

        return {
            "ok": True,
            "rolled_back": True,
            "head": commit,
        }
