from fastapi import APIRouter

from app.services.inventory import phoenix_inventory_data

router = APIRouter()


@router.get("/api/phoenix/inventory")
@router.get("/api/inventory")
async def phoenix_inventory():
    data = phoenix_inventory_data()

    return {
        "status": "ok",
        "source": "phoenix_inventory_api",
        **data,
    }
