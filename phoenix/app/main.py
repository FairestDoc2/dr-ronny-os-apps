from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.routes.system import router as system_router
from app.routes.system_control import router as system_control_router
from app.routes.weather import router as weather_router
from app.routes.inventory import router as inventory_router
from app.routes.home_assistant import router as home_assistant_router
from app.routes.order_center import router as order_center_router
from app.routes.ui import create_ui_router
from app.services.ui_renderer import render_index

APP_DIR = Path(__file__).parent
WEB_DIR = APP_DIR / "web"

app = FastAPI(title="Dr. Ronny OS Phoenix")


@app.middleware("http")
async def normalize_ingress_path(request, call_next):
    """Normalize duplicate leading slashes added by Home Assistant ingress."""
    path = request.scope.get("path", "/")
    if path.startswith("//"):
        request.scope["path"] = "/" + path.lstrip("/")
        request.scope["raw_path"] = request.scope["path"].encode("utf-8")
    return await call_next(request)

app.include_router(system_router)
app.include_router(system_control_router)
app.include_router(weather_router)
app.include_router(inventory_router)
app.include_router(home_assistant_router)
app.include_router(order_center_router)

app.include_router(create_ui_router(render_index, WEB_DIR))

app.mount("/ui/assets", StaticFiles(directory=WEB_DIR / "assets"), name="ui_assets")
app.mount("/assets", StaticFiles(directory=WEB_DIR / "assets"), name="assets")

app.mount("/core", StaticFiles(directory=WEB_DIR / "core"), name="core")
app.mount("/lang", StaticFiles(directory=WEB_DIR / "lang"), name="lang")

app.mount(
    "/phoenix_v2",
    StaticFiles(directory=WEB_DIR / "phoenix_v2"),
    name="phoenix_v2",
)

# ==================================================
# Phoenix Catch-All Route
# MUSS ganz am Ende stehen, sonst blockiert sie /api/*
# ==================================================
@app.get("/{full_path:path}")
def catch_all(full_path: str):
    return render_index()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8099)

