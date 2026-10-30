from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class UrlAnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, json_schema_extra={"examples": [{"url": "https://careers.google.com"}]})

    url: str = Field(min_length=1, max_length=2_048, description="Recruitment website URL to evaluate.")


class UrlIndicator(BaseModel):
    code: str = Field(min_length=1, max_length=100)
    severity: Literal["low", "medium", "high", "critical"]
    category: Literal["syntax", "network", "transport", "redirect", "brand_impersonation", "reputation"]
    message: str = Field(min_length=1, max_length=500)


class RedirectHop(BaseModel):
    hop_number: int = Field(ge=1, le=10)
    url: str = Field(max_length=2_048)
    status_code: int | None = Field(default=None, ge=100, le=599)


class SslCertificateInfo(BaseModel):
    is_valid: bool
    issuer: str | None = Field(default=None, max_length=300)
    subject: str | None = Field(default=None, max_length=300)
    expires_at: str | None = Field(default=None, max_length=100)
    error: str | None = Field(default=None, max_length=300)


class UrlAnalysisResponse(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{
        "analysis_id": "123e4567-e89b-12d3-a456-426614174000",
        "target_url": "https://careers.google.com",
        "final_url": "https://careers.google.com",
        "risk_level": "safe",
        "risk_score": 5,
        "is_redirected": False,
        "redirect_chain": [],
        "ssl_info": {"is_valid": True, "issuer": "Google Trust Services", "subject": "*.google.com"},
        "indicators": [],
        "recommendations": ["Verify job listings directly on the company's verified domain."],
        "summary": "No suspicious URL indicators detected.",
        "reputation_status": "not_checked",
        "disclaimer": "Automated URL safety check. Independently verify recruiter credentials and hiring processes."
    }]})

    analysis_id: UUID
    target_url: str = Field(max_length=2_048)
    final_url: str = Field(max_length=2_048)
    risk_level: Literal["safe", "low", "medium", "high", "critical"]
    risk_score: int = Field(ge=0, le=100)
    is_redirected: bool = False
    redirect_chain: list[RedirectHop] = Field(default_factory=list, max_length=10)
    ssl_info: SslCertificateInfo | None = None
    indicators: list[UrlIndicator] = Field(default_factory=list, max_length=30)
    recommendations: list[str] = Field(default_factory=list, max_length=10)
    summary: str = Field(min_length=1, max_length=1_000)
    reputation_status: Literal["not_checked", "safe", "suspicious", "malicious"] = "not_checked"
    disclaimer: str = Field(min_length=1, max_length=500)
