from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.scam import ScamAnalysisResponse


class ChatMessageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, json_schema_extra={"examples": [{"message": "Does this job offer look safe?", "session_id": "123e4567-e89b-12d3-a456-426614174000", "analyze_message": True}]})

    message: str = Field(min_length=1, max_length=4_000, strict=True, description="Question for the scam-safety assistant.")
    session_id: UUID | None = Field(default=None, description="Optional client-generated conversation identifier.")
    analysis_id: UUID | None = Field(default=None, description="Optional prior scam-analysis identifier.")
    analyze_message: bool = Field(default=False, strict=True, description="Run deterministic scam analysis on this message before replying.")


class ChatMessageResponse(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{"session_id": "123e4567-e89b-12d3-a456-426614174000", "message_id": "123e4567-e89b-12d3-a456-426614174001", "reply": "Avoid sending money or identity documents until the employer is independently verified.", "disclaimer": "Automated guidance only; independently verify employers and requests for money or personal data."}]})

    session_id: UUID
    message_id: UUID
    reply: str = Field(min_length=1, max_length=8_000)
    disclaimer: str
    analysis: ScamAnalysisResponse | None = Field(default=None, description="Deterministic analysis when analyze_message is true.")
