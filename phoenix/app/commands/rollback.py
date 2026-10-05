"""
Phoenix Rollback Command
"""

import sys

from app.core.rollback_engine import RollbackEngine


def show_help() -> None:
    print("Phoenix Rollback")
    print("")
    print("Verwendung:")
    print("  python3 tools/phoenix.py rollback prepare <snapshot_id>")
    print("  python3 tools/phoenix.py rollback run <snapshot_id>")
    print("  python3 tools/phoenix.py rollback force <snapshot_id>")


def run() -> None:
    if len(sys.argv) < 4:
        show_help()
        return

    action = sys.argv[2].lower()
    snapshot_id = sys.argv[3]

    if action == "prepare":
        print(RollbackEngine.prepare(snapshot_id))
        return

    if action == "run":
        print(RollbackEngine.rollback(snapshot_id))
        return

    if action == "force":
        print(RollbackEngine.rollback(snapshot_id, force=True))
        return

    show_help()
