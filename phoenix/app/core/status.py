from app.core.version import get_version_info


def get_status():
    info = get_version_info()

    return {
        "name": info.get("name"),
        "version": info.get("version"),
        "stage": info.get("stage"),
        "architecture_locked": info.get("architecture_locked"),
    }
