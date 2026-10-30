from typing import Protocol

from app.schemas.scam import ScamAnalysisRequest, ScamAnalysisResponse


class RuleEngine(Protocol):
    def analyze(self, request: ScamAnalysisRequest) -> ScamAnalysisResponse: ...


class RuleEngineUnavailable:
    """Integration seam for Karan's rule engine; never fabricates an assessment."""

    def analyze(self, request: ScamAnalysisRequest) -> ScamAnalysisResponse:
        raise RuntimeError("Scam rule engine is not configured")
