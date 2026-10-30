"""FastAPI application entrypoint for CrediHire Scam Intelligence Engine."""

from __future__ import annotations

import os
from typing import List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.router import router as intelligence_router

# Default allowed frontend origins for local development (React/Vite/Next.js)
DEFAULT_ALLOWED_ORIGINS: List[str] = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8080",
]


def get_allowed_origins() -> List[str]:
    """Retrieve allowed CORS origins from environment or default to local dev origins.

    Configured via comma-separated ALLOWED_ORIGINS environment variable.
    Prevents insecure wildcard origins when credentials are enabled.
    """
    raw_env = os.getenv("ALLOWED_ORIGINS", "")
    if raw_env.strip():
        parsed = [orig.strip() for orig in raw_env.split(",") if orig.strip()]
        # Disallow insecure wildcard when credentials are true
        parsed = [p for p in parsed if p != "*"]
        if parsed:
            return parsed
    return list(DEFAULT_ALLOWED_ORIGINS)


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="CrediHire - Scam Intelligence Engine",
        description=(
            "Deterministic, multilingual Fake Job and Task-Scam Detection Engine. "
            "Exposes high-precision indicator verification, explainable evidence extraction, "
            "risk severity scoring (0-100), and stage classification."
        ),
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # Configure CORS with explicit, configurable origins (no wildcard with credentials)
    allowed_origins = get_allowed_origins()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    # Register intelligence API router
    app.include_router(intelligence_router)

    @app.get("/health", tags=["System"])
    def root_health():
        return {
            "status": "healthy",
            "service": "scam_intelligence_engine",
            "version": "1.0.0",
        }

    @app.get("/", tags=["System"])
    def root_info():
        return {
            "name": "CrediHire Scam Intelligence API",
            "version": "1.0.0",
            "documentation": "/docs",
            "endpoints": {
                "analyze": "POST /api/intelligence/analyze",
                "health": "GET /api/intelligence/health",
            },
        }

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
