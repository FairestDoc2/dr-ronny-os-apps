"""
Phoenix Plugin Loader
"""

from __future__ import annotations

import importlib.util
import inspect
from pathlib import Path
from typing import Any

from app.core.plugin_base import PluginBase
from app.core.plugin_registry import PluginRegistry
from app.core.context_paths import ContextPaths


class PluginLoader:
    """Lädt Phoenix Plugins aus einem Plugin-Verzeichnis."""

    ROOT = ContextPaths.PROJECT_ROOT
    PLUGIN_DIR = ROOT / "plugins"

    @staticmethod
    def plugin_files(plugin_dir: Path | None = None) -> list[Path]:
        """Findet alle plugin.py Dateien."""
        base_dir = plugin_dir or PluginLoader.PLUGIN_DIR

        if not base_dir.exists():
            return []

        return sorted(base_dir.glob("*/plugin.py"))

    @staticmethod
    def load_module(path: Path) -> Any:
        """Lädt ein Python-Modul aus einer Datei."""
        module_name = f"phoenix_plugin_{path.parent.name}"
        spec = importlib.util.spec_from_file_location(module_name, path)

        if spec is None or spec.loader is None:
            raise ImportError(f"Plugin konnte nicht geladen werden: {path}")

        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    @staticmethod
    def plugin_classes(module: Any) -> list[type[PluginBase]]:
        """Findet PluginBase-Unterklassen in einem Modul."""
        classes = []

        for _, obj in inspect.getmembers(module, inspect.isclass):
            if obj is PluginBase:
                continue

            if issubclass(obj, PluginBase):
                classes.append(obj)

        return classes

    @staticmethod
    def load(plugin_dir: Path | None = None) -> dict[str, Any]:
        """Lädt alle Plugins und registriert ihre Metadaten."""
        loaded = []
        errors = []

        for path in PluginLoader.plugin_files(plugin_dir):
            try:
                module = PluginLoader.load_module(path)
                classes = PluginLoader.plugin_classes(module)

                for plugin_class in classes:
                    plugin = plugin_class()
                    metadata = plugin.metadata()
                    PluginRegistry.register(metadata["id"], metadata)
                    loaded.append(metadata)

            except Exception as error:
                errors.append(
                    {
                        "file": str(path),
                        "error": str(error),
                    }
                )

        return {
            "ok": len(errors) == 0,
            "loaded": loaded,
            "errors": errors,
            "count": len(loaded),
        }
