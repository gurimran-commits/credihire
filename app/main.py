from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.routes import router
from app.core.config import get_settings
from app.core.errors import install_error_handlers
from app.core.rate_limit import RateLimitMiddleware


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Scam Detection API", version="1.0.0")
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["Content-Type"])
    app.add_middleware(RateLimitMiddleware, limit=settings.rate_limit_per_minute)
    app.include_router(router)
    install_error_handlers(app)
    return app


app = create_app()
