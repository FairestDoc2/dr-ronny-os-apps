"""
Phoenix Plugin Base
"""

from __future__ import annotations

from typing import Any


class PluginBase:
    """Basisklasse für Phoenix Plugins."""

    plugin_id = ""
    name = ""
    version = "0.1.0"
    author = ""

    def metadata(self) -> dict[str, Any]:
        """Gibt Plugin-Metadaten zurück."""
        return {
            "id": self.plugin_id,
            "name": self.name,
            "version": self.version,
            "author": self.author,
        }

    def start(self) -> dict[str, Any]:
        """Startet das Plugin."""
        return {
            "ok": True,
            "plugin": self.plugin_id,
            "status": "started",
        }

    def stop(self) -> dict[str, Any]:
        """Stoppt das Plugin."""
        return {
            "ok": True,
            "plugin": self.plugin_id,
            "status": "stopped",
        }

    def health(self) -> dict[str, Any]:
        """Gibt den Plugin-Zustand zurück."""
        return {
            "ok": True,
            "plugin": self.plugin_id,
            "status": "healthy",
        }
