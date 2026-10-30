from uuid import UUID

from pydantic import BaseModel, Field


class ChatMessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4_000)
    session_id: UUID | None = None
    analysis_id: UUID | None = None


class ChatMessageResponse(BaseModel):
    session_id: UUID
    message_id: UUID
    reply: str = Field(min_length=1, max_length=8_000)
    disclaimer: str
