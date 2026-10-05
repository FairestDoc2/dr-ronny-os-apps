"""
Phoenix Plugin Manager
"""

from __future__ import annotations

from typing import Any

from app.core.plugin_loader import PluginLoader
from app.core.plugin_registry import PluginRegistry


class PluginManager:
    """Verwaltet geladene Phoenix Plugins."""

    _status: dict[str, str] = {}

    @classmethod
    def load_all(cls) -> dict[str, Any]:
        """Lädt alle Plugins über den PluginLoader."""
        result = PluginLoader.load()

        for plugin in result["loaded"]:
            cls._status.setdefault(plugin["id"], "loaded")

        return result

    @classmethod
    def list(cls) -> list[dict[str, Any]]:
        """Listet Plugins inklusive Status."""
        plugins = []

        for plugin in PluginRegistry.list():
            item = dict(plugin)
            item["status"] = cls._status.get(plugin["id"], "unknown")
            plugins.append(item)

        return plugins

    @classmethod
    def status(cls, plugin_id: str) -> dict[str, Any]:
        """Gibt den Status eines Plugins zurück."""
        plugin = PluginRegistry.get(plugin_id)

        if plugin is None:
            return {
                "ok": False,
                "id": plugin_id,
                "status": "missing",
                "reason": "Plugin nicht gefunden.",
            }

        return {
            "ok": True,
            "id": plugin_id,
            "status": cls._status.get(plugin_id, "unknown"),
            "plugin": plugin,
        }

    @classmethod
    def start(cls, plugin_id: str) -> dict[str, Any]:
        """Markiert ein Plugin als gestartet."""
        if not PluginRegistry.exists(plugin_id):
            return {
                "ok": False,
                "id": plugin_id,
                "status": "missing",
                "reason": "Plugin nicht gefunden.",
            }

        cls._status[plugin_id] = "started"

        return {
            "ok": True,
            "id": plugin_id,
            "status": "started",
        }

    @classmethod
    def stop(cls, plugin_id: str) -> dict[str, Any]:
        """Markiert ein Plugin als gestoppt."""
        if not PluginRegistry.exists(plugin_id):
            return {
                "ok": False,
                "id": plugin_id,
                "status": "missing",
                "reason": "Plugin nicht gefunden.",
            }

        cls._status[plugin_id] = "stopped"

        return {
            "ok": True,
            "id": plugin_id,
            "status": "stopped",
        }

    @classmethod
    def clear(cls) -> None:
        """Leert Manager-Status und Registry."""
        cls._status.clear()
        PluginRegistry.clear()
