from functools import lru_cache
from importlib import import_module

from app.core.config import get_settings
from app.intelligence.engine import RuleEngineUnavailable
from app.integrations.llm_client import LLMClient
from app.services.chatbot import ChatbotService
from app.services.scam_analysis import ScamAnalysisService


@lru_cache
def get_scam_service() -> ScamAnalysisService:
    factory_path = get_settings().rule_engine_factory
    if not factory_path:
        return ScamAnalysisService(RuleEngineUnavailable())
    try:
        module_name, factory_name = factory_path.split(":", 1)
        engine = getattr(import_module(module_name), factory_name)()
        if not callable(getattr(engine, "analyze", None)):
            raise TypeError("Rule engine must define analyze")
        return ScamAnalysisService(engine)
    except Exception:
        # Third-party team adapters must not make the public API leak implementation failures.
        return ScamAnalysisService(RuleEngineUnavailable())


def rule_engine_readiness_status() -> str:
    if not get_settings().rule_engine_factory:
        return "unconfigured"
    return "unavailable" if isinstance(get_scam_service().engine, RuleEngineUnavailable) else "ready"


@lru_cache
def get_chatbot_service() -> ChatbotService:
    return ChatbotService(LLMClient(get_settings()))
