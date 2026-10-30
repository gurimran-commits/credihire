from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.dependencies import get_chatbot_service, get_scam_service, get_url_credibility_service, rule_engine_readiness_status
from app.core.config import get_settings
from app.integrations.llm_client import LLMRateLimited, LLMUnavailable
from app.schemas.chat import ChatMessageRequest, ChatMessageResponse
from app.schemas.scam import ScamAnalysisRequest, ScamAnalysisResponse
from app.schemas.upload import UploadAnalysisResponse
from app.schemas.url import UrlAnalysisRequest, UrlAnalysisResponse
from app.services.chatbot import ChatbotService
from app.services.scam_analysis import RuleEngineFailure, ScamAnalysisService
from app.services.upload_extraction import MAX_UPLOAD_BYTES, UploadExtractionError, UploadTextExtractor
from app.services.url_credibility import UrlCredibilityService

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
        return await service.analyze_with_enrichment(request)
    except RuleEngineFailure as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Scam analysis is unavailable") from exc


@router.post("/url/analyze", response_model=UrlAnalysisResponse, summary="Analyze recruitment website URL credibility", response_description="Structured safety, SSRF-safe redirect, and impersonation assessment for recruitment URLs.")
async def analyze_url(request: UrlAnalysisRequest, service: UrlCredibilityService = Depends(get_url_credibility_service)) -> UrlAnalysisResponse:
    try:
        return await service.analyze(request)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="URL analysis service is temporarily unavailable") from exc


@router.post("/scam/analyze/upload", response_model=UploadAnalysisResponse, summary="Analyze an uploaded PDF or screenshot", response_description="Extracted text plus deterministic scam analysis.")
async def analyze_upload(file: UploadFile = File(...), service: ScamAnalysisService = Depends(get_scam_service)) -> UploadAnalysisResponse:
    try:
        data = await file.read(MAX_UPLOAD_BYTES + 1)
        extracted = UploadTextExtractor(get_settings().tesseract_cmd).extract(file.filename, file.content_type, data)
        analysis = await service.analyze_with_enrichment(ScamAnalysisRequest(job_text=extracted.text))
        return UploadAnalysisResponse(media_type=extracted.media_type, extracted_text=extracted.text, analysis=analysis)
    except UploadExtractionError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    except RuleEngineFailure as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Scam analysis is unavailable") from exc
    finally:
        await file.close()


@router.post("/chat/messages", response_model=ChatMessageResponse, summary="Send a chatbot message", response_description="Safe scam-awareness guidance for the submitted message.")
async def chat(request: ChatMessageRequest, service: ChatbotService = Depends(get_chatbot_service)) -> ChatMessageResponse:
    try:
        return await service.respond(request)
    except LLMRateLimited as exc:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Chat service is temporarily rate-limited") from exc
    except (LLMUnavailable, RuleEngineFailure) as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Chat service is unavailable") from exc
