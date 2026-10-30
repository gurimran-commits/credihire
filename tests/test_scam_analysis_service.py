import json
from unittest.mock import Mock

import pytest

from app.intelligence.engine import RuleEngineUnavailable
from app.intelligence.karan_adapter import KaranRuleEngine
from app.schemas.scam import RuleEngineResult, ScamAnalysisRequest
from app.services.ai_enrichment import AIEnrichmentService, AIEnrichmentUnavailable
from app.services.scam_analysis import RuleEngineFailure, ScamAnalysisService


class UnavailableEnrichment:
    async def enrich(self, _message, secondary=False):
        raise AIEnrichmentUnavailable("provider_unavailable")


class StaticLLM:
    def __init__(self, payload: str):
        self.payload = payload

    async def reply(self, messages, response_format=None):
        return self.payload


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


# ===========================================================================
# Targeted Scam Detection Regression Tests
# ===========================================================================

TARGET_TASK_DEPOSIT_MESSAGE = (
    "Congratulations! You have been selected for a part-time Amazon work-from-home job.\n\n"
    "Your task is to like products and submit screenshots. Earn ₹5,000 daily with just 30 minutes of work.\n\n"
    "To activate your account and unlock premium tasks, deposit a refundable ₹499 security amount through UPI.\n\n"
    "Hurry! Only 10 positions are available. Send your payment screenshot to the recruiter to start earning immediately."
)


def test_regression_1_exact_499_task_deposit_message():
    """Verify the exact Amazon work-from-home ₹499 task deposit message is identified accurately."""
    service = ScamAnalysisService(KaranRuleEngine())
    res = service.analyze(ScamAnalysisRequest(job_text=TARGET_TASK_DEPOSIT_MESSAGE))

    assert res.risk_score >= 70
    assert res.risk_level in ["high", "critical"]
    assert res.scam_stage == "task_deposit"

    indicator_codes = [ind.code for ind in res.indicators]
    assert "task_deposit" in indicator_codes
    assert "unrealistic_earnings" in indicator_codes
    assert "urgency_pressure" in indicator_codes


def test_regression_2_registration_fee_scam():
    """Verify upfront registration / interview fees are detected with registration_fee stage."""
    msg = (
        "Dear Candidate, Congratulations on clearing your preliminary round for Data Entry Operator. "
        "To proceed with your onboarding and ID generation, pay a registration fee of ₹1,200."
    )
    service = ScamAnalysisService(KaranRuleEngine())
    res = service.analyze(ScamAnalysisRequest(job_text=msg))

    assert res.risk_score >= 50
    assert res.scam_stage == "registration_fee"
    assert "upfront_registration_fee" in [ind.code for ind in res.indicators]


def test_regression_3_withdrawal_fee_scam():
    """Verify clearance fees and blocked withdrawal demands are detected with withdrawal_block stage."""
    msg = (
        "Your work wallet balance is ₹45,000. Your withdrawal request is currently on hold. "
        "Pay a 10% tax clearance fee of ₹4,500 to release your funds to your bank account immediately."
    )
    service = ScamAnalysisService(KaranRuleEngine())
    res = service.analyze(ScamAnalysisRequest(job_text=msg))

    assert res.risk_score >= 70
    assert res.scam_stage == "withdrawal_block"
    assert "withdrawal_fee" in [ind.code for ind in res.indicators]


def test_regression_4_unrealistic_earnings_scam():
    """Verify unrealistic high-return promises for low-effort tasks are detected."""
    msg = (
        "Earn ₹8,000 to ₹15,000 daily from home just by watching YouTube trailers and subscribing. "
        "No skills or experience required. Work from your mobile anytime!"
    )
    service = ScamAnalysisService(KaranRuleEngine())
    res = service.analyze(ScamAnalysisRequest(job_text=msg))

    assert res.risk_score >= 35
    assert "unrealistic_earnings" in [ind.code for ind in res.indicators]


def test_regression_5_legitimate_job_offer_remains_safe():
    """Verify legitimate corporate job offers without fee demands are not flagged as scams."""
    msg = (
        "Hi Alex,\n"
        "Thank you for interviewing with Acme Software. We are pleased to offer you the role of Senior Python Developer "
        "with an annual CTC of ₹18,00,000.\n"
        "Please review the attached offer letter and reply with your signed acceptance by next Monday. "
        "We never ask candidates for any registration or equipment fees."
    )
    service = ScamAnalysisService(KaranRuleEngine())
    res = service.analyze(ScamAnalysisRequest(job_text=msg))

    assert res.risk_score == 0
    assert res.risk_level == "low"
    assert res.indicators == []
    assert res.scam_stage == "unknown"


@pytest.mark.asyncio
async def test_regression_6_groq_unavailable_falls_back_to_deterministic_rules():
    """Verify that when Groq is unavailable, analysis gracefully falls back to deterministic rules with full score."""
    service = ScamAnalysisService(KaranRuleEngine(), enrichment_service=UnavailableEnrichment())
    res = await service.analyze_with_enrichment(ScamAnalysisRequest(job_text=TARGET_TASK_DEPOSIT_MESSAGE))

    assert res.risk_score == 100
    assert res.risk_level == "critical"
    assert res.scam_stage == "task_deposit"
    assert res.ai_enrichment is None
    assert res.rule_engine_result is not None
    assert res.rule_engine_result.risk_score == 100
    assert "task_deposit" in [ind.code for ind in res.indicators]


@pytest.mark.asyncio
async def test_regression_7_ai_response_with_fabricated_evidence_is_rejected():
    """Verify that AI indicators containing fabricated quotes not in the message are discarded by grounding."""
    fabricated_ai_json = json.dumps({
        "risk_level": "high",
        "scam_stage": "task_deposit",
        "summary": "Suspected scam offer.",
        "verification_status": "not_checked",
        "suspected_scam": True,
        "recommendations": ["Do not pay"],
        "detected_indicators": [
            {
                "category": "task_deposit",
                "confidence": 0.95,
                "quote": "Pay 100 Bitcoins immediately to our private darknet wallet",
                "explanation": "Fabricated demand not in text",
            }
        ],
    })
    enrichment_service = AIEnrichmentService(StaticLLM(fabricated_ai_json))
    legit_text = (
        "Welcome to the team! Your orientation starts on Monday at 9:00 AM at our Bangalore office. "
        "Bring your photo ID for visitor badging."
    )
    with pytest.raises(AIEnrichmentUnavailable) as exc_info:
        await enrichment_service.enrich(legit_text)
    assert exc_info.value.category == "evidence_quote_validation"

    # Also verify that end-to-end fusion does not introduce fabricated indicators
    service = ScamAnalysisService(KaranRuleEngine(), enrichment_service=enrichment_service)
    res = await service.analyze_with_enrichment(ScamAnalysisRequest(job_text=legit_text))
    assert res.risk_score == 0
    assert res.indicators == []
    assert res.ai_enrichment is None


@pytest.mark.asyncio
async def test_regression_8_rule_engine_unavailable_fails_explicitly():
    """Verify that when the rule engine fails/is unavailable, RuleEngineFailure is raised rather than a false safe score."""
    service = ScamAnalysisService(RuleEngineUnavailable())
    with pytest.raises(RuleEngineFailure):
        service.analyze(ScamAnalysisRequest(job_text=TARGET_TASK_DEPOSIT_MESSAGE))

    with pytest.raises(RuleEngineFailure):
        await service.analyze_with_enrichment(ScamAnalysisRequest(job_text=TARGET_TASK_DEPOSIT_MESSAGE))


# ===========================================================================
# Negative Regression Tests for Recent Pattern Changes
# ===========================================================================

def test_negative_1_legitimate_refundable_security_deposit():
    """Verify legitimate non-job refundable deposits (e.g. hotel checkout) are not classified as task_deposit."""
    text = "Your hotel booking is confirmed. A refundable ₹499 security deposit will be returned after checkout."
    service = ScamAnalysisService(KaranRuleEngine())
    res = service.analyze(ScamAnalysisRequest(job_text=text))

    assert res.scam_stage != "task_deposit"
    assert "task_deposit" not in [ind.code for ind in res.indicators]
    assert res.risk_score == 0
    assert res.risk_level == "low"
    assert res.indicators == []


def test_negative_2_ordinary_recruitment_scarcity():
    """Verify ordinary recruitment scarcity wording alone does not produce a HIGH or CRITICAL risk score."""
    text = "We are hiring for our software development team. Only 10 positions are available. Apply through our official careers portal."
    service = ScamAnalysisService(KaranRuleEngine())
    res = service.analyze(ScamAnalysisRequest(job_text=text))

    assert res.risk_score < 60
    assert res.risk_level not in ["high", "critical"]
    assert res.risk_level == "low"


def test_negative_3_ordinary_screenshot_instruction():
    """Verify ordinary screenshot request urgency alone does not produce a HIGH or CRITICAL risk score."""
    text = "Please upload a screenshot of your completed coding assessment immediately so our recruitment team can review it."
    service = ScamAnalysisService(KaranRuleEngine())
    res = service.analyze(ScamAnalysisRequest(job_text=text))

    assert res.risk_score < 60
    assert res.risk_level not in ["high", "critical"]
    assert res.risk_level == "low"


def test_negative_4_legitimate_equipment_deposit():
    """Verify legitimate equipment deposit under documented company policy is not classified as task_deposit."""
    text = (
        "Selected employees may be required to pay a refundable equipment deposit "
        "under the company's documented equipment policy. The amount is returned when company equipment is returned."
    )
    service = ScamAnalysisService(KaranRuleEngine())
    res = service.analyze(ScamAnalysisRequest(job_text=text))

    assert res.scam_stage != "task_deposit"
    assert "task_deposit" not in [ind.code for ind in res.indicators]
    assert res.risk_score < 60
    assert res.risk_level not in ["high", "critical"]
