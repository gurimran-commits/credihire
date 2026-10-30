from uuid import uuid4

from pydantic import ValidationError

from app.intelligence.engine import RuleEngine
from app.schemas.scam import RuleEngineResult, ScamAnalysisRequest, ScamAnalysisResponse


class RuleEngineFailure(RuntimeError):
    pass


class ScamAnalysisService:
    def __init__(self, engine: RuleEngine) -> None:
        self.engine = engine

    def analyze(self, request: ScamAnalysisRequest) -> ScamAnalysisResponse:
        try:
            raw_result = self.engine.analyze(request)
        except Exception as exc:
            raise RuleEngineFailure("Scam analysis is unavailable") from exc
        try:
            if isinstance(raw_result, ScamAnalysisResponse):
                raw_result = raw_result.model_dump(exclude={"analysis_id", "disclaimer"})
            result = RuleEngineResult.model_validate(raw_result)
        except ValidationError as exc:
            raise RuleEngineFailure("Scam analysis returned an invalid result") from exc
        return ScamAnalysisResponse(analysis_id=uuid4(), disclaimer="Automated guidance only; independently verify employers and requests for money or personal data.", **result.model_dump())
