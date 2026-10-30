from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_chatbot_service, get_scam_service, rule_engine_readiness_status
from app.integrations.llm_client import LLMUnavailable
from app.schemas.chat import ChatMessageRequest, ChatMessageResponse
from app.schemas.scam import ScamAnalysisRequest, ScamAnalysisResponse
from app.services.chatbot import ChatbotService
from app.services.scam_analysis import RuleEngineFailure, ScamAnalysisService

router = APIRouter(prefix="/api/v1")


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
async def ready(service: ChatbotService = Depends(get_chatbot_service)) -> dict[str, object]:
    components = {
        "rule_engine": rule_engine_readiness_status(),
        "llm": await service.readiness_status(),
    }
    return {"status": "ready" if all(value == "ready" for value in components.values()) else "degraded", "components": components}


@router.post("/scam/analyze", response_model=ScamAnalysisResponse, summary="Analyze a job or task offer", response_description="Structured risk assessment with explainable indicators.")
async def analyze(request: ScamAnalysisRequest, service: ScamAnalysisService = Depends(get_scam_service)) -> ScamAnalysisResponse:
    try:
        return service.analyze(request)
    except RuleEngineFailure as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Scam analysis is unavailable") from exc


@router.post("/chat/messages", response_model=ChatMessageResponse, summary="Send a chatbot message", response_description="Safe scam-awareness guidance for the submitted message.")
async def chat(request: ChatMessageRequest, service: ChatbotService = Depends(get_chatbot_service)) -> ChatMessageResponse:
    try:
        return await service.respond(request)
    except (LLMUnavailable, RuleEngineFailure) as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Chat service is unavailable") from exc
