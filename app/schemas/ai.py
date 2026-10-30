from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class AIEnrichmentEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, strict=True)

    indicator: str = Field(min_length=1, max_length=100)
    explanation: str = Field(min_length=1, max_length=500)


IndicatorCategory = Literal[
    "upfront_registration_fee", "task_deposit", "withdrawal_fee",
    "unrealistic_earnings", "urgency_pressure", "sensitive_credentials", "advance_fee",
]


class AIIndicatorDetection(BaseModel):
    """A provider detection that is eligible for fusion only after quote validation."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, strict=True)

    category: IndicatorCategory
    quote: str = Field(min_length=1, max_length=450)
    explanation: str = Field(min_length=1, max_length=500)
    confidence: float = Field(ge=0, le=1)


class AIEnrichment(BaseModel):
    """Contextual Groq guidance; it never replaces deterministic risk fields."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, strict=True)

    summary: str = Field(min_length=1, max_length=1_000)
    evidence: list[AIEnrichmentEvidence] = Field(default_factory=list, max_length=25)
    verification_status: Literal["not_checked", "unavailable"]
    recommendations: list[str] = Field(min_length=1, max_length=10)
    suspected_scam: bool = False
    detected_indicators: list[AIIndicatorDetection] = Field(default_factory=list, max_length=25)


class GroqAnalysisResponse(BaseModel):
    """Aditya's provider response, validated before non-authoritative fields are discarded."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, strict=True)

    risk_level: Literal["low", "medium", "high", "unknown"]
    scam_stage: Literal["job_offer", "registration_fee", "task_deposit", "withdrawal_block", "advance_fee", "unknown"] | None
    summary: str = Field(min_length=1, max_length=1_000)
    evidence: list[AIEnrichmentEvidence] = Field(default_factory=list, max_length=25)
    verification_status: Literal["not_checked", "unavailable", "verified", "suspicious"]
    recommendations: list[str] = Field(min_length=1, max_length=10)
    suspected_scam: bool
    detected_indicators: list[AIIndicatorDetection] = Field(default_factory=list, max_length=25)
