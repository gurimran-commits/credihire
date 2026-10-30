from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class ScamAnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, json_schema_extra={"examples": [{"job_text": "Remote data-entry role. Pay a registration fee to start.", "job_url": "https://jobs.example.com/data-entry", "company_name": "Example Staffing", "contact_details": "recruiter@example.com"}]})

    job_text: str = Field(min_length=1, max_length=12_000, strict=True, description="Full job or task offer text to assess.")
    job_url: HttpUrl | None = Field(default=None, description="Optional public URL for the offer.")
    company_name: str | None = Field(default=None, min_length=1, max_length=200, strict=True, description="Optional employer or platform name.")
    contact_details: str | None = Field(default=None, min_length=1, max_length=1_000, strict=True, description="Optional recruiter or contact details.")


class Indicator(BaseModel):
    code: str = Field(min_length=1, max_length=100)
    severity: Literal["low", "medium", "high", "critical"]
    message: str = Field(min_length=1, max_length=500)


class Evidence(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    source: str = Field(min_length=1, max_length=100)
    detail: str = Field(min_length=1, max_length=500)
    indicator_code: str | None = Field(default=None, min_length=1, max_length=100)


SafeRecommendation = Annotated[str, Field(min_length=1, max_length=300)]


class RuleEngineResult(BaseModel):
    """Validated result Karan's deterministic rule engine must return."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    risk_level: Literal["low", "medium", "high", "critical"]
    risk_score: int = Field(ge=0, le=100)
    indicators: list[Indicator] = Field(max_length=25)
    evidence: list[Evidence] = Field(default_factory=list, max_length=50)
    scam_stage: str | None = Field(default=None, min_length=1, max_length=100)
    recommendations: list[SafeRecommendation] = Field(default_factory=list, max_length=10)
    summary: str = Field(min_length=1, max_length=1_000)


class ScamAnalysisResponse(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{"analysis_id": "123e4567-e89b-12d3-a456-426614174000", "risk_level": "high", "risk_score": 80, "indicators": [{"code": "advance_fee", "severity": "high", "message": "The offer requests payment before work begins."}], "evidence": [{"source": "job_text", "detail": "Pay a registration fee to start.", "indicator_code": "advance_fee"}], "scam_stage": "payment_request", "recommendations": ["Do not pay upfront fees."], "summary": "The offer has high-risk indicators.", "disclaimer": "Automated guidance only; independently verify employers and requests for money or personal data."}]})

    analysis_id: UUID
    risk_level: Literal["low", "medium", "high", "critical"]
    risk_score: int = Field(ge=0, le=100)
    indicators: list[Indicator]
    evidence: list[Evidence] = Field(default_factory=list, max_length=50)
    scam_stage: str | None = Field(default=None, min_length=1, max_length=100)
    recommendations: list[SafeRecommendation] = Field(default_factory=list, max_length=10)
    summary: str = Field(min_length=1, max_length=1_000)
    disclaimer: str = Field(min_length=1, max_length=500)
