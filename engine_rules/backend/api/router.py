"""FastAPI router for Scam Intelligence endpoints."""

from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException, status

from backend.api.schemas import AnalyzeRequest, AnalyzeResponse, HealthResponse
from backend.intelligence.classifier import classify_scam

logger = logging.getLogger("scam_intelligence_api")

router = APIRouter(prefix="/api/intelligence", tags=["Scam Intelligence"])


@router.post(
    "/analyze",
    response_model=AnalyzeResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyze message for job and task scam indicators",
    description=(
        "Analyzes raw job advertisement or messaging text using deterministic "
        "multilingual rule matching, computes a 0-100 risk score, classifies "
        "the scam progression stage, and extracts explainable evidence snippets."
    ),
)
def analyze_message(payload: AnalyzeRequest) -> AnalyzeResponse:
    """Analyze input text and return structured scam intelligence output."""
    raw_text = payload.text

    # Validate that input is not empty or whitespace only
    if not raw_text or not raw_text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Input text cannot be empty or contain only whitespace.",
        )

    try:
        result = classify_scam(raw_text)
        api_data = result.to_api_dict()
        return AnalyzeResponse(**api_data)
    except Exception as exc:
        logger.error(f"Internal error during scam analysis: {exc}", exc_info=True)
        # Avoid leaking internal exceptions or stack traces to callers
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while processing the intelligence analysis request.",
        ) from exc


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Health check for the Scam Intelligence module",
)
def intelligence_health() -> HealthResponse:
    """Return operational health status."""
    return HealthResponse()
