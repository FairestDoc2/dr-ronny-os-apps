from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.core.version import get_version_info

router = APIRouter()


@router.get("/api/phoenix/build-marker")
def phoenix_build_marker():
    info = get_version_info()

    return {
        "build": "order-center-fix-20260710-0651",
        "version": info.get("version", "unknown"),
        "stage": info.get("stage", "unknown"),
    }


@router.get("/api/phoenix/info")
def phoenix_info():
    info = get_version_info()

    return JSONResponse({
        "name": info.get("name", "Dr. Ronny OS Phoenix"),
        "version": info.get("version", "unknown"),
        "stage": info.get("stage", "unknown"),
        "edition": "Phoenix",
    })
