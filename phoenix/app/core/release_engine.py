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
