from app.routes.auth import router as auth_router
from app.routes.admin import router as admin_router
from app.routes.pssr import admin_router as pssr_admin_router, pssr_router as pssr_initiator_router
from app.routes.team import router as team_router
from app.routes.area_owner import router as area_owner_router
from app.routes.health import health_router

# Export both PSSR admin and initiator routers
pssr_router = pssr_admin_router  # For backward compatibility

