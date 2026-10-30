from uuid import uuid4

from app.intelligence.engine import RuleEngine
from app.schemas.scam import ScamAnalysisRequest, ScamAnalysisResponse


class ScamAnalysisService:
    def __init__(self, engine: RuleEngine) -> None:
        self.engine = engine

    def analyze(self, request: ScamAnalysisRequest) -> ScamAnalysisResponse:
        result = self.engine.analyze(request)
        return result.model_copy(update={"analysis_id": result.analysis_id or uuid4()})
