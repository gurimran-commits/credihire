from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.scam import ScamAnalysisResponse


class UploadAnalysisResponse(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{"media_type": "pdf", "extracted_text": "Job offer text extracted from the uploaded file.", "analysis": {"analysis_id": "123e4567-e89b-12d3-a456-426614174000", "risk_level": "high", "risk_score": 80, "indicators": [], "evidence": [], "scam_stage": "payment_request", "recommendations": ["Do not pay upfront fees."], "summary": "Engine-provided summary.", "disclaimer": "Automated guidance only; independently verify employers and requests for money or personal data."}}]})

    media_type: Literal["pdf", "image"]
    extracted_text: str = Field(min_length=1, max_length=12_000)
    analysis: ScamAnalysisResponse
