"""
Phoenix Plugin Registry
"""

from __future__ import annotations

from typing import Any


class PluginRegistry:
    """Speichert Plugin-Metadaten im Speicher."""

    _plugins: dict[str, dict[str, Any]] = {}

    @classmethod
    def register(cls, plugin_id: str, metadata: dict[str, Any]) -> dict[str, Any]:
        """Registriert ein Plugin."""
        if not plugin_id:
            raise ValueError("plugin_id darf nicht leer sein")

        plugin = {
            "id": plugin_id,
            **metadata,
        }

        cls._plugins[plugin_id] = plugin
        return plugin

    @classmethod
    def list(cls) -> list[dict[str, Any]]:
        """Listet alle registrierten Plugins."""
        return [cls._plugins[key] for key in sorted(cls._plugins)]

    @classmethod
    def get(cls, plugin_id: str) -> dict[str, Any] | None:
        """Gibt ein Plugin zurück oder None."""
        return cls._plugins.get(plugin_id)

    @classmethod
    def exists(cls, plugin_id: str) -> bool:
        """Prüft, ob ein Plugin existiert."""
        return plugin_id in cls._plugins

    @classmethod
    def clear(cls) -> None:
        """Leert die Registry. Hauptsächlich für Tests."""
        cls._plugins.clear()
