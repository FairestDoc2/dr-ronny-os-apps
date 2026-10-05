from app.core.status import get_status
from app.core.inventory import get_inventory


def get_core():
    return {
        "status": get_status(),
        "inventory": get_inventory(),
    }
