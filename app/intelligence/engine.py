from typing import Protocol

from app.schemas.scam import RuleEngineResult, ScamAnalysisRequest


class RuleEngine(Protocol):
    def analyze(self, request: ScamAnalysisRequest) -> RuleEngineResult: ...


class RuleEngineUnavailable:
    """Integration seam for Karan's rule engine; never fabricates an assessment."""

    def analyze(self, request: ScamAnalysisRequest) -> RuleEngineResult:
        raise RuntimeError("Scam rule engine is not configured")
