"""
Phoenix Plugin Command
"""

import sys

from app.core.plugin_manager import PluginManager


def show_help() -> None:
    print("Phoenix Plugin")
    print("")
    print("Verwendung:")
    print("  python3 tools/phoenix.py plugin load")
    print("  python3 tools/phoenix.py plugin list")
    print("  python3 tools/phoenix.py plugin info <plugin_id>")
    print("  python3 tools/phoenix.py plugin start <plugin_id>")
    print("  python3 tools/phoenix.py plugin stop <plugin_id>")


def run() -> None:
    action = sys.argv[2].lower() if len(sys.argv) >= 3 else "list"

    if action == "load":
        result = PluginManager.load_all()
        print("Phoenix Plugin Load")
        print("")
        print(f"Status: {'OK' if result['ok'] else 'FEHLER'}")
        print(f"Geladen: {result['count']}")

        if result["errors"]:
            print("")
            print("Fehler:")
            for error in result["errors"]:
                print(f"  - {error['file']}: {error['error']}")
        return

    if action == "list":
        PluginManager.load_all()
        plugins = PluginManager.list()

        print("Phoenix Plugin List")
        print("")

        if not plugins:
            print("Keine Plugins gefunden.")
            return

        for plugin in plugins:
            print(f"- {plugin['id']} | {plugin['name']} | {plugin['version']} | {plugin['status']}")
        return

    if action == "info":
        if len(sys.argv) < 4:
            show_help()
            return

        PluginManager.load_all()
        result = PluginManager.status(sys.argv[3])

        print("Phoenix Plugin Info")
        print("")

        if not result["ok"]:
            print("Status: FEHLER")
            print(result["reason"])
            return

        plugin = result["plugin"]
        print(f"ID:      {plugin['id']}")
        print(f"Name:    {plugin['name']}")
        print(f"Version: {plugin['version']}")
        print(f"Autor:   {plugin['author']}")
        print(f"Status:  {result['status']}")
        return

    if action == "start":
        if len(sys.argv) < 4:
            show_help()
            return

        PluginManager.load_all()
        result = PluginManager.start(sys.argv[3])
        print("Phoenix Plugin Start")
        print("")
        print(f"Status: {'OK' if result['ok'] else 'FEHLER'}")
        print(f"Plugin: {result['id']}")

        if not result["ok"]:
            print(result["reason"])
        return

    if action == "stop":
        if len(sys.argv) < 4:
            show_help()
            return

        PluginManager.load_all()
        result = PluginManager.stop(sys.argv[3])
        print("Phoenix Plugin Stop")
        print("")
        print(f"Status: {'OK' if result['ok'] else 'FEHLER'}")
        print(f"Plugin: {result['id']}")

        if not result["ok"]:
            print(result["reason"])
        return

    show_help()
