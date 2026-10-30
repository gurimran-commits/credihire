"""Scam Stage Classification Engine.

This module deterministically classifies the scam stage of an analyzed message
or job offer, synthesizes detected indicator evidence, and computes an explainable
confidence score compliant with the team API contract.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from .indicators import (
    INDICATOR_METADATA,
    IndicatorCategory,
    IndicatorResult,
    RiskLevel,
    ScamAnalysisResult,
    ScamStage,
)
from .rules import evaluate_rules

# Indicator severity weights for legacy confidence scoring
SEVERITY_WEIGHTS: Dict[str, float] = {
    "critical": 0.85,
    "high": 0.75,
    "medium": 0.50,
    "low": 0.30,
}


def calculate_risk_score(indicators: List[IndicatorResult]) -> Tuple[int, str]:
    """Calculate deterministic integer risk score (0-100) and qualitative risk level.

    Scoring is based on transparent indicator severity weights and compound
    marginal risk accumulation. Duplicate indicators of the same category are
    strictly deduplicated to prevent score inflation.

    Notice: This is a deterministic heuristic severity index, NOT a statistical
    probability of scam occurrence.

    Scoring Weights:
    - withdrawal_fee: 75 (critical exit trap)
    - task_deposit: 70 (critical pay-to-work demand)
    - sensitive_credentials: 65 (critical credential theft / remote access)
    - upfront_registration_fee: 55 (high pre-employment advance fee)
    - advance_fee: 50 (high collateral/courier demand)
    - unrealistic_earnings: 35 (medium low-effort high-reward lure)
    - urgency_pressure: 25 (low pressure / artificial deadline tactic)

    Returns:
        (risk_score, risk_level) where risk_score is an int in [0, 100] and
        risk_level is one of LOW, MEDIUM, HIGH, CRITICAL.
    """
    if not indicators:
        return 0, RiskLevel.LOW.value

    # Deduplicate indicators by unique category identifier
    unique_categories = {ind.indicator for ind in indicators}

    # Extract base weights for each unique category
    weights: List[int] = []
    for cat in unique_categories:
        meta = INDICATOR_METADATA.get(cat, {})
        base_w = meta.get("base_weight", 30)
        weights.append(int(base_w))

    if not weights:
        return 0, RiskLevel.LOW.value

    # Sort descending: primary (most severe) indicator contributes full base weight
    weights.sort(reverse=True)
    primary = weights[0]

    # Secondary indicators add diminishing compound risk (60% marginal contribution)
    secondary = sum(int(w * 0.6) for w in weights[1:])

    # Total integer score strictly bounded in [0, 100]
    risk_score = min(100, max(0, primary + secondary))

    # Threshold mapping to qualitative risk levels
    if risk_score < 30:
        risk_level = RiskLevel.LOW.value
    elif risk_score < 60:
        risk_level = RiskLevel.MEDIUM.value
    elif risk_score <= 85:
        risk_level = RiskLevel.HIGH.value
    else:
        risk_level = RiskLevel.CRITICAL.value

    return risk_score, risk_level


def determine_scam_stage(indicators: List[IndicatorResult]) -> str:
    """Classify the scam stage based on detected indicators.

    Stage priority follows the progression of task and job-offer scams:
    1. withdrawal_block: Active exit trap withholding accumulated funds.
    2. task_deposit: Demands money/recharge to unlock or continue tasks.
    3. registration_fee: Demands pre-employment onboarding/interview fees.
    4. advance_fee: Demands equipment collateral, courier, or visa advance fees.
    5. job_offer: Initial pitch stage (unrealistic earnings, urgency, OTP fishing).
    6. unknown: No indicators detected or benign content.
    """
    if not indicators:
        return ScamStage.UNKNOWN.value

    indicator_keys = {ind.indicator for ind in indicators}

    # 1. Withdrawal block check (highest priority: victim trapped at payout)
    if IndicatorCategory.WITHDRAWAL_FEE.value in indicator_keys:
        return ScamStage.WITHDRAWAL_BLOCK.value

    # 2. Task deposit / recharge check
    if IndicatorCategory.TASK_DEPOSIT.value in indicator_keys:
        return ScamStage.TASK_DEPOSIT.value

    # 3. Registration fee check
    if IndicatorCategory.UPFRONT_REGISTRATION_FEE.value in indicator_keys:
        return ScamStage.REGISTRATION_FEE.value

    # 4. Advance fee check
    if IndicatorCategory.ADVANCE_FEE.value in indicator_keys:
        return ScamStage.ADVANCE_FEE.value

    # 5. Job offer stage (unrealistic earnings, pressure, or credential harvesting)
    if (
        IndicatorCategory.UNREALISTIC_EARNINGS.value in indicator_keys
        or IndicatorCategory.URGENCY_PRESSURE.value in indicator_keys
        or IndicatorCategory.SENSITIVE_CREDENTIALS.value in indicator_keys
    ):
        return ScamStage.JOB_OFFER.value

    return ScamStage.UNKNOWN.value


def _calculate_confidence(indicators: List[IndicatorResult]) -> float:
    """Calculate deterministic confidence score using independent probability combination.

    Formula: 1 - product(1 - weight_i) clamped between 0.0 and 0.99.
    Never returns 1.0 to preserve probabilistic realism.
    """
    if not indicators:
        return 0.0

    rem = 1.0
    for ind in indicators:
        weight = SEVERITY_WEIGHTS.get(ind.severity, 0.40)
        rem *= (1.0 - weight)

    score = 1.0 - rem
    # Clamp to max 0.98 to avoid claiming absolute verification
    return min(0.98, max(0.10, score))


def _generate_summary(stage: str, indicators: List[IndicatorResult]) -> str:
    """Generate a clear, explainable diagnostic summary for end users and analysts."""
    if not indicators or stage == ScamStage.UNKNOWN.value:
        return (
            "No deterministic scam indicators detected in the submitted text. "
            "Note: This does not independently verify the authenticity of the employer."
        )

    indicator_names = [ind.indicator.replace("_", " ").title() for ind in indicators]
    summary_parts = [
        f"Classified under '{stage}' stage due to {len(indicators)} detected indicator(s): "
        f"{', '.join(indicator_names)}."
    ]

    for ind in indicators:
        if ind.evidence:
            first_evidence = ind.evidence[0]
            summary_parts.append(f"Evidence: \"{first_evidence}\" ({ind.explanation})")

    return " ".join(summary_parts)


class ScamClassifier:
    """Deterministic classifier for job and task scam submissions."""

    def __init__(self) -> None:
        pass

    def analyze(self, text: str) -> ScamAnalysisResult:
        """Analyze text, evaluate deterministic rules, and classify scam stage.

        Args:
            text: Raw job offer description, task instructions, or chat message.

        Returns:
            A populated ScamAnalysisResult instance.
        """
        if not text or not text.strip():
            return ScamAnalysisResult(
                scam_stage=ScamStage.UNKNOWN.value,
                is_suspicious=False,
                risk_score=0,
                risk_level=RiskLevel.LOW.value,
                confidence_score=0.0,
                indicators=[],
                summary="Empty or blank input provided.",
            )

        # Step 1: Run all context-aware deterministic rules
        detected_indicators = evaluate_rules(text)

        # Step 2: Determine scam stage
        stage = determine_scam_stage(detected_indicators)

        # Step 3: Compute deterministic risk score (0-100) and risk level
        risk_score, risk_level = calculate_risk_score(detected_indicators)

        # Step 4: Compute legacy deterministic confidence score
        confidence = _calculate_confidence(detected_indicators)

        # Step 5: Build explainable diagnostic summary
        summary = _generate_summary(stage, detected_indicators)

        return ScamAnalysisResult(
            scam_stage=stage,
            is_suspicious=bool(detected_indicators),
            risk_score=risk_score,
            risk_level=risk_level,
            confidence_score=confidence,
            indicators=detected_indicators,
            summary=summary,
        )


# Singleton classifier instance for convenient import
_classifier = ScamClassifier()


def classify_scam(text: str) -> ScamAnalysisResult:
    """Top-level convenience function to classify scam stage and extract evidence.

    Args:
        text: Input message or job offer text.

    Returns:
        ScamAnalysisResult compatible with backend integration.
    """
    return _classifier.analyze(text)


def analyze_scam_submission(text: str) -> Dict[str, Any]:
    """Compatibility wrapper returning dictionary matching the team API contract.

    Example output:
    {
        "scam_stage": "task_deposit",
        "indicators": [
            {
                "indicator": "task_deposit",
                "explanation": "Payment or account recharge is demanded..."
            }
        ]
    }
    """
    result = classify_scam(text)
    return result.to_contract_dict()
