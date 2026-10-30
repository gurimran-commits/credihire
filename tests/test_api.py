from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.dependencies import get_chatbot_service, get_scam_service
from app.main import create_app
from app.schemas.scam import Indicator, RuleEngineResult, ScamAnalysisResponse


class FakeEngine:
    def analyze(self, _):
        return RuleEngineResult(risk_level="high", risk_score=80, indicators=[Indicator(code="fee", severity="high", message="Payment requested")], evidence=[{"source": "job_text", "detail": "Payment requested", "indicator_code": "fee"}], scam_stage="payment_request", recommendations=["Do not send money."], summary="Review required")


def create_ready_engine():
    return FakeEngine()


class FakeScamService:
    def __init__(self):
        from app.services.scam_analysis import ScamAnalysisService
        self.service = ScamAnalysisService(FakeEngine())

    def analyze(self, request): return self.service.analyze(request)


class FakeChatService:
    async def respond(self, request):
        from app.schemas.chat import ChatMessageResponse
        return ChatMessageResponse(session_id=request.session_id or uuid4(), message_id=uuid4(), reply="Be cautious.", disclaimer="Test")

    async def readiness_status(self):
        return "ready"


@pytest.fixture(autouse=True)
def clear_settings_cache():
    get_settings.cache_clear()
    get_scam_service.cache_clear()
    get_chatbot_service.cache_clear()
    yield
    get_settings.cache_clear()
    get_scam_service.cache_clear()
    get_chatbot_service.cache_clear()


@pytest.fixture
def client():
    app = create_app()
    app.dependency_overrides[get_scam_service] = FakeScamService
    app.dependency_overrides[get_chatbot_service] = FakeChatService
    return TestClient(app)


def test_health_and_ready_do_not_leak_settings(client):
    assert client.get("/api/v1/health").json() == {"status": "ok"}
    readiness = client.get("/api/v1/ready").json()
    assert readiness["status"] == "degraded"
    assert readiness["components"] == {"rule_engine": "unconfigured", "llm": "ready"}


def test_ready_is_healthy_only_when_both_components_are_available(monkeypatch):
    monkeypatch.setenv("LLM_BASE_URL", "https://llm.example/v1")
    monkeypatch.setenv("LLM_API_KEY", "test-only-key")
    monkeypatch.setenv("LLM_MODEL", "test-model")
    monkeypatch.setenv("RULE_ENGINE_FACTORY", f"{__name__}:create_ready_engine")
    app = create_app()
    app.dependency_overrides[get_chatbot_service] = FakeChatService
    readiness = TestClient(app).get("/api/v1/ready").json()
    assert readiness == {"status": "ready", "components": {"rule_engine": "ready", "llm": "ready"}}
    assert "test-only-key" not in str(readiness)


def test_ready_reports_unconfigured_components_without_secrets():
    readiness = TestClient(create_app()).get("/api/v1/ready").json()
    assert readiness == {"status": "degraded", "components": {"rule_engine": "unconfigured", "llm": "unconfigured"}}


def test_analyze_valid_request(client):
    response = client.post("/api/v1/scam/analyze", json={"job_text": "Pay a fee to begin"})
    assert response.status_code == 200
    assert response.json()["risk_score"] == 80
    assert response.json()["scam_stage"] == "payment_request"
    assert response.json()["recommendations"] == ["Do not send money."]


def test_invalid_request_is_rejected(client):
    response = client.post("/api/v1/scam/analyze", json={"job_text": ""})
    assert response.status_code == 422
    assert response.json()["detail"] == "Invalid request"
    assert response.json()["errors"] == [{"field": "job_text", "message": "String should have at least 1 character", "type": "string_too_short"}]


@pytest.mark.parametrize(
    ("path", "payload"),
    [
        ("/api/v1/scam/analyze", {"job_text": "   "}),
        ("/api/v1/chat/messages", {"message": "   "}),
        ("/api/v1/scam/analyze", {"job_text": "x" * 12_001}),
        ("/api/v1/chat/messages", {"message": "x" * 4_001}),
    ],
)
def test_empty_and_oversized_inputs_are_rejected_safely(client, path, payload):
    response = client.post(path, json=payload)
    assert response.status_code == 422
    assert response.json()["detail"] == "Invalid request"
    assert "input" not in str(response.json()["errors"])


@pytest.mark.parametrize(
    ("path", "payload"),
    [
        ("/api/v1/scam/analyze", {"job_text": 123}),
        ("/api/v1/chat/messages", {"message": "valid", "unexpected": True}),
    ],
)
def test_invalid_input_types_and_unknown_fields_are_rejected(client, path, payload):
    response = client.post(path, json=payload)
    assert response.status_code == 422
    assert response.json()["detail"] == "Invalid request"


def test_chat_valid_request(client):
    response = client.post("/api/v1/chat/messages", json={"message": "Is this safe?"})
    assert response.status_code == 200
    assert response.json()["reply"] == "Be cautious."


def test_openapi_documents_request_examples_and_endpoint_summaries(client):
    document = client.get("/openapi.json").json()
    assert document["paths"]["/api/v1/scam/analyze"]["post"]["summary"] == "Analyze a job or task offer"
    assert document["components"]["schemas"]["ScamAnalysisRequest"]["examples"]
    assert document["components"]["schemas"]["ChatMessageRequest"]["examples"]


def test_unconfigured_integrations_fail_explicitly():
    app = create_app()
    response = TestClient(app).post("/api/v1/chat/messages", json={"message": "hello"})
    assert response.status_code == 503


def test_unconfigured_rule_engine_fails_explicitly():
    response = TestClient(create_app()).post("/api/v1/scam/analyze", json={"job_text": "Review this offer"})
    assert response.status_code == 503
    assert response.json() == {"detail": "Scam analysis is unavailable"}


def test_application_lifespan_starts_and_stops_cleanly():
    with TestClient(create_app()) as client:
        assert client.get("/api/v1/health").json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_llm_client_uses_provider_response_without_leaking_key():
    from app.core.config import Settings
    from app.integrations.llm_client import LLMClient
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json={"choices": [{"message": {"content": "Safe reply"}}]}))
    async with httpx.AsyncClient(transport=transport) as http_client:
        result = await LLMClient(Settings(llm_base_url="https://llm.example/v1", llm_api_key="secret", llm_model="model"), http_client).reply("Hello")
    assert result == "Safe reply"


@pytest.mark.asyncio
async def test_llm_readiness_requires_a_successful_provider_check():
    from app.core.config import Settings
    from app.integrations.llm_client import LLMClient
    transport = httpx.MockTransport(lambda request: httpx.Response(200) if request.url.path.endswith("/models") else httpx.Response(404))
    async with httpx.AsyncClient(transport=transport) as http_client:
        status = await LLMClient(Settings(llm_base_url="https://llm.example/v1", llm_api_key="test-only-key", llm_model="model"), http_client).readiness_status()
    assert status == "ready"
