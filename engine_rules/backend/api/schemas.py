"""Pydantic request and response schemas for Scam Intelligence API."""

from __future__ import annotations

from typing import List
from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    """Incoming request payload for scam intelligence analysis."""

    text: str = Field(
        ...,
        description="Raw text of the job advertisement, invitation, or chat message to analyze.",
        examples=["Pay ₹2,000 to unlock your task earnings."],
    )


class AnalyzeResponse(BaseModel):
    """Outgoing structured response conforming to the team API specification."""

    scam_stage: str = Field(
        ...,
        description="Classified scam progression stage (job_offer, registration_fee, task_deposit, withdrawal_block, advance_fee, unknown).",
        examples=["task_deposit"],
    )
    risk_score: int = Field(
        ...,
        description="Deterministic heuristic severity index between 0 and 100.",
        ge=0,
        le=100,
        examples=[85],
    )
    risk_level: str = Field(
        ...,
        description="Qualitative risk classification: LOW, MEDIUM, HIGH, CRITICAL.",
        examples=["HIGH"],
    )
    indicators: List[str] = Field(
        default_factory=list,
        description="List of detected indicator category identifiers.",
        examples=[["task_deposit"]],
    )
    evidence: List[str] = Field(
        default_factory=list,
        description="Verbatim supporting text snippets extracted from the input message.",
        examples=[["Pay ₹2,000 to unlock your task earnings"]],
    )
    explanations: List[str] = Field(
        default_factory=list,
        description="Security rationale explaining why the extracted snippets are suspicious.",
    )


class HealthResponse(BaseModel):
    """API health status response."""

    status: str = Field(default="healthy")
    service: str = Field(default="scam_intelligence_engine")
    version: str = Field(default="1.0.0")
