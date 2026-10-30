from uuid import uuid4

from app.integrations.llm_client import LLMClient
from app.schemas.chat import ChatMessageRequest, ChatMessageResponse

DISCLAIMER = "Automated guidance only; independently verify employers and requests for money or personal data."


class ChatbotService:
    def __init__(self, client: LLMClient) -> None:
        self.client = client

    async def respond(self, request: ChatMessageRequest) -> ChatMessageResponse:
        return ChatMessageResponse(
            session_id=request.session_id or uuid4(), message_id=uuid4(), reply=await self.client.reply(request.message), disclaimer=DISCLAIMER
        )

    async def readiness_status(self) -> str:
        return await self.client.readiness_status()
