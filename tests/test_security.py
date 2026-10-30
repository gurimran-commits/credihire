from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings, get_settings
from app.dependencies import get_chatbot_service, get_scam_service
from app.integrations.llm_client import LLMUnavailable
from app.main import create_app
from app.schemas.chat import ChatMessageRequest, ChatMessageResponse
from app.services.chatbot import ChatbotService


class SafeChatService:
    async def respond(self, request):
        return ChatMessageResponse(session_id=request.session_id or uuid4(), message_id=uuid4(), reply="Safe response", disclaimer="Test")

    async def readiness_status(self):
        return "unconfigured"


class SecretFailingChatService:
    async def respond(self, _):
        raise LLMUnavailable("provider key should never appear")

    async def readiness_status(self):
        return "unavailable"


@pytest.fixture(autouse=True)
def clear_caches():
    get_settings.cache_clear()
    get_scam_service.cache_clear()
    get_chatbot_service.cache_clear()
    yield
    get_settings.cache_clear()
    get_scam_service.cache_clear()
    get_chatbot_service.cache_clear()


def app_with_chat(service):
    app = create_app()
    app.dependency_overrides[get_chatbot_service] = lambda: service
    return app


def test_cors_allows_only_configured_origin():
    client = TestClient(app_with_chat(SafeChatService()))
    allowed = client.options("/api/v1/chat/messages", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"})
    blocked = client.options("/api/v1/chat/messages", headers={"Origin": "https://untrusted.example", "Access-Control-Request-Method": "POST"})
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "access-control-allow-origin" not in blocked.headers


def test_wildcard_cors_configuration_is_rejected():
    with pytest.raises(ValidationError):
        Settings(cors_origins=["*"])


def test_rate_limit_covers_readiness(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_PER_MINUTE", "1")
    client = TestClient(app_with_chat(SafeChatService()))
    assert client.get("/api/v1/ready").status_code == 200
    assert client.get("/api/v1/ready").status_code == 429


def test_request_size_and_validation_errors_do_not_echo_submitted_content(monkeypatch):
    monkeypatch.setenv("MAX_REQUEST_BYTES", "1024")
    client = TestClient(app_with_chat(SafeChatService()))
    oversized = client.post("/api/v1/chat/messages", content=b'{"message":"' + b"x" * 1_100 + b'"}', headers={"content-type": "application/json"})
    invalid = client.post("/api/v1/chat/messages", json={"message": "", "submitted_secret": "do-not-echo"})
    assert oversized.status_code == 413
    assert invalid.status_code == 422
    assert "do-not-echo" not in str(invalid.json())


def test_provider_error_does_not_leak_internal_details():
    response = TestClient(app_with_chat(SecretFailingChatService())).post("/api/v1/chat/messages", json={"message": "hello"})
    assert response.status_code == 503
    assert response.json() == {"detail": "Chat service is unavailable"}


def test_validation_logs_metadata_without_submitted_content(caplog):
    with caplog.at_level("WARNING", logger="credihire"):
        response = TestClient(app_with_chat(SafeChatService())).post("/api/v1/chat/messages", json={"message": "", "private_note": "do-not-log"})
    assert response.status_code == 422
    assert "request_validation_failed" in caplog.text
    assert "do-not-log" not in caplog.text


@pytest.mark.asyncio
async def test_chat_context_isolated_by_session():
    class CapturingClient:
        def __init__(self): self.calls = []
        async def reply(self, messages):
            self.calls.append(messages)
            return "reply"

    client = CapturingClient()
    service = ChatbotService(client)
    first_session, second_session = uuid4(), uuid4()
    await service.respond(ChatMessageRequest(session_id=first_session, message="First session content"))
    await service.respond(ChatMessageRequest(session_id=second_session, message="Second session content"))
    await service.respond(ChatMessageRequest(session_id=second_session, message="Follow up"))
    assert all("First session content" not in item["content"] for item in client.calls[-1])
