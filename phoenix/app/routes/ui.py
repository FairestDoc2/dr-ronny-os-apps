from pathlib import Path
from typing import Callable

from fastapi import APIRouter
from fastapi.responses import HTMLResponse


def create_ui_router(
    render_index: Callable,
    web_dir: Path,
) -> APIRouter:
    router = APIRouter()

    @router.get("/")
    def root():
        return render_index()

    @router.get("/ui")
    def ui():
        return render_index()

    @router.get("/ui/")
    def ui_slash():
        return render_index()

    @router.get("/delivery")
    def delivery():
        return HTMLResponse(
            (web_dir / "delivery.html").read_text(encoding="utf-8"),
            headers={
                "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
                "Pragma": "no-cache",
                "Expires": "0",
            },
        )

    @router.get("/ui/delivery")
    def ui_delivery():
        return HTMLResponse(
            (web_dir / "delivery.html").read_text(encoding="utf-8"),
            headers={
                "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
                "Pragma": "no-cache",
                "Expires": "0",
            },
        )

    return router
