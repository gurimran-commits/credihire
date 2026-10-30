from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl


class ScamAnalysisRequest(BaseModel):
    job_text: str = Field(min_length=1, max_length=12_000)
    job_url: HttpUrl | None = None
    company_name: str | None = Field(default=None, max_length=200)
    contact_details: str | None = Field(default=None, max_length=1_000)


class Indicator(BaseModel):
    code: str = Field(min_length=1, max_length=100)
    severity: Literal["low", "medium", "high"]
    message: str = Field(min_length=1, max_length=500)


class ScamAnalysisResponse(BaseModel):
    analysis_id: UUID
    risk_level: Literal["low", "medium", "high"]
    risk_score: int = Field(ge=0, le=100)
    indicators: list[Indicator]
    summary: str = Field(max_length=1_000)
    disclaimer: str
