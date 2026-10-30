from unittest.mock import Mock

import pytest

from app.intelligence.engine import RuleEngineUnavailable
from app.schemas.scam import RuleEngineResult, ScamAnalysisRequest
from app.services.scam_analysis import RuleEngineFailure, ScamAnalysisService


def test_engine_result_is_validated_and_exposed():
    engine = Mock()
    engine.analyze.return_value = RuleEngineResult(
        risk_level="high", risk_score=90, indicators=[], evidence=[{"source": "job_text", "detail": "Advance payment requested"}], scam_stage="payment_request", recommendations=["Do not pay."], summary="High-risk offer."
    )
    result = ScamAnalysisService(engine).analyze(ScamAnalysisRequest(job_text="Pay first"))
    assert result.risk_score == 90
    assert result.evidence[0].detail == "Advance payment requested"
    assert result.recommendations == ["Do not pay."]
    engine.analyze.assert_called_once()


def test_invalid_engine_result_is_unavailable():
    engine = Mock()
    engine.analyze.return_value = {"risk_level": "high", "risk_score": 101}
    with pytest.raises(RuleEngineFailure):
        ScamAnalysisService(engine).analyze(ScamAnalysisRequest(job_text="Offer"))


def test_unavailable_engine_is_not_fabricated():
    with pytest.raises(RuleEngineFailure):
        ScamAnalysisService(RuleEngineUnavailable()).analyze(ScamAnalysisRequest(job_text="Offer"))
