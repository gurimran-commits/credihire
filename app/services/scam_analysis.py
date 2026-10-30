import asyncio
import logging
import re
from uuid import uuid4

from pydantic import ValidationError

from app.intelligence.engine import RuleEngine
from app.schemas.scam import Evidence, Indicator, RuleEngineResult, ScamAnalysisRequest, ScamAnalysisResponse
from app.services.ai_enrichment import AIEnrichmentService, AIEnrichmentUnavailable
from engine_rules.backend.intelligence.classifier import calculate_risk_score, determine_scam_stage
from engine_rules.backend.intelligence.indicators import INDICATOR_METADATA, IndicatorResult


class RuleEngineFailure(RuntimeError):
    pass


logger = logging.getLogger("credihire.scam_analysis")
AI_CONFIDENCE_THRESHOLD = 0.7
SECONDARY_SIGNAL_PATTERNS = (
    re.compile(r"\b(?:pay|add|top\s*up|fund|load|deposit|recharge|transfer|send)\s+(?:(?:(?:a\s+)?refundable\s+)?(?:(?:a\s+)?(?:security|activation)\s+(?:amount|deposit)\s+(?:of\s+)?)?)?(?:(?:rs\.?|inr|₹)\s*)?(?:\d[\d,]*|money|funds)\b[^.!?\n]{0,80}\b(?:task|order|assignment|wallet|commission|work\s+account|premium|security\s+amount|security\s+deposit)\b", re.I),
    re.compile(r"\b(?:share|send|provide|enter)\s+(?:your\s+)?(?:otp|upi\s*pin|cvv|banking\s+password|net\s*banking\s+password)\b", re.I),
    re.compile(r"\b(?:wallet|balance|earnings?|withdrawal|payout)\b[^.!?\n]{0,100}\b(?:blocked|frozen|on\s+hold|release|unfreeze)\b[^.!?\n]{0,100}\b(?:pay|fee|charge|tax|clearance)\b", re.I),
    re.compile(r"\b(?:pay|send|transfer|deposit)\b[^.!?\n]{0,60}\b(?:courier|laptop|equipment|security\s+deposit|refundable\s+(?:security\s+)?(?:amount|deposit))\b", re.I),
    re.compile(r"\b(?:job|work|task|assignment|order|account)\b[^.!?\n]{0,100}\b(?:pay|add|deposit|recharge|transfer|send)\s+(?:(?:(?:a\s+)?refundable\s+)?(?:(?:a\s+)?(?:security|activation)\s+(?:amount|deposit)\s+(?:of\s+)?)?)?(?:(?:rs\.?|inr|₹)\s*)?(?:\d[\d,]*|money|funds)\b", re.I),
)


class ScamAnalysisService:
    def __init__(self, engine: RuleEngine, enrichment_service: AIEnrichmentService | None = None) -> None:
        self.engine, self.enrichment_service = engine, enrichment_service

    def _rule_result(self, request: ScamAnalysisRequest) -> RuleEngineResult:
        try:
            raw_result = self.engine.analyze(request)
        except Exception as exc:
            raise RuleEngineFailure("Scam analysis is unavailable") from exc
        try:
            if isinstance(raw_result, ScamAnalysisResponse):
                raw_result = raw_result.model_dump(exclude={"analysis_id", "disclaimer", "ai_enrichment", "rule_engine_result", "ai_detection_result"})
            result = RuleEngineResult.model_validate(raw_result)
            return result.model_copy(update={"indicators": [item.model_copy(update={"sources": ["rule_engine"]}) for item in result.indicators]})
        except ValidationError as exc:
            raise RuleEngineFailure("Scam analysis returned an invalid result") from exc

    @staticmethod
    def _response(result: RuleEngineResult, **updates: object) -> ScamAnalysisResponse:
        return ScamAnalysisResponse(analysis_id=uuid4(), disclaimer="Automated guidance only; independently verify employers and requests for money or personal data.", **result.model_dump(), **updates)

    def analyze(self, request: ScamAnalysisRequest) -> ScamAnalysisResponse:
        return self._response(self._rule_result(request))

    @staticmethod
    def _fallback_response(rule_result: RuleEngineResult) -> ScamAnalysisResponse:
        """Return deterministic analysis plus explicit null AI diagnostics when AI is unavailable."""
        return ScamAnalysisService._response(
            rule_result,
            rule_engine_result=rule_result,
            ai_enrichment=None,
            ai_detection_result=None,
        )

    @staticmethod
    def _fuse(rule_result: RuleEngineResult, enrichment) -> RuleEngineResult:
        indicators = {item.code: item.model_copy(update={"sources": ["rule_engine"]}) for item in rule_result.indicators}
        evidence = list(rule_result.evidence)
        added_category = False
        for detection in enrichment.detected_indicators:
            if detection.confidence < AI_CONFIDENCE_THRESHOLD:
                continue
            existing = indicators.get(detection.category)
            if existing:
                indicators[detection.category] = existing.model_copy(update={"sources": ["rule_engine", "groq"]})
            else:
                metadata = INDICATOR_METADATA[detection.category]
                indicators[detection.category] = Indicator(code=detection.category, severity=metadata["severity"], message=detection.explanation, sources=["groq"])
                added_category = True
            candidate = Evidence(source="groq", detail=detection.quote, indicator_code=detection.category)
            if not any(item.detail == candidate.detail and item.indicator_code == candidate.indicator_code for item in evidence):
                evidence.append(candidate)
        fused_indicators = list(indicators.values())
        score_input = [IndicatorResult(indicator=item.code, explanation=item.message) for item in fused_indicators]
        if added_category:
            score, level = calculate_risk_score(score_input)
            stage = determine_scam_stage(score_input)
            level = level.lower()
        else:
            score, level, stage = rule_result.risk_score, rule_result.risk_level, rule_result.scam_stage
        recommendations = list(rule_result.recommendations)
        for recommendation in enrichment.recommendations:
            if recommendation not in recommendations and len(recommendations) < 10:
                recommendations.append(recommendation)
        summary = rule_result.summary
        if added_category:
            summary = f"Validated scam indicators detected: {', '.join(item.code for item in fused_indicators)}."
        return RuleEngineResult(risk_score=score, risk_level=level, indicators=fused_indicators, evidence=evidence, scam_stage=stage, recommendations=recommendations, summary=summary)

    @staticmethod
    def _has_eligible_ai_detection(enrichment) -> bool:
        return bool(enrichment and any(item.confidence >= AI_CONFIDENCE_THRESHOLD for item in enrichment.detected_indicators))

    @staticmethod
    def _has_secondary_signal(text: str) -> bool:
        return any(pattern.search(text) for pattern in SECONDARY_SIGNAL_PATTERNS)

    @staticmethod
    def _log_final(result: RuleEngineResult) -> None:
        logger.info("scam_analysis_final indicators=%s risk_score=%s", [item.code for item in result.indicators], result.risk_score)

    async def analyze_with_enrichment(self, request: ScamAnalysisRequest) -> ScamAnalysisResponse:
        if self.enrichment_service is None:
            rule_outcome = self._rule_result(request)
            logger.info("rule_detection_complete indicators=%s", [item.code for item in rule_outcome.indicators])
            self._log_final(rule_outcome)
            return self._fallback_response(rule_outcome)
        rule_task = asyncio.to_thread(self._rule_result, request)
        ai_task = self.enrichment_service.enrich(request.job_text)
        rule_outcome, ai_outcome = await asyncio.gather(rule_task, ai_task, return_exceptions=True)
        if isinstance(rule_outcome, Exception):
            raise rule_outcome
        logger.info("rule_detection_complete indicators=%s", [item.code for item in rule_outcome.indicators])
        ai_error = ai_outcome if isinstance(ai_outcome, Exception) else None
        if isinstance(ai_outcome, AIEnrichmentUnavailable):
            logger.info("ai_detection_omitted pass=initial category=%s", ai_outcome.category)
            ai_outcome = None
        elif isinstance(ai_outcome, Exception):
            logger.warning("ai_detection_omitted category=unexpected_failure")
            ai_outcome = None
        else:
            logger.info("ai_detection_complete pass=initial indicators=%s", [item.category for item in ai_outcome.detected_indicators])

        if (not rule_outcome.indicators and not self._has_eligible_ai_detection(ai_outcome)
                and self._has_secondary_signal(request.job_text)
                and not (isinstance(ai_error, AIEnrichmentUnavailable) and ai_error.category == "provider_unavailable")):
            logger.info("secondary_ai_detection_triggered reason=zero_indicators_strong_signal")
            try:
                ai_outcome = await self.enrichment_service.enrich(request.job_text, secondary=True)
                logger.info("ai_detection_complete pass=secondary indicators=%s", [item.category for item in ai_outcome.detected_indicators])
            except AIEnrichmentUnavailable as exc:
                logger.info("ai_detection_omitted pass=secondary category=%s", exc.category)
            except Exception:
                logger.warning("ai_detection_omitted pass=secondary category=unexpected_failure")

        if ai_outcome is None:
            self._log_final(rule_outcome)
            return self._fallback_response(rule_outcome)
        fused = self._fuse(rule_outcome, ai_outcome)
        self._log_final(fused)
        return self._response(fused, ai_enrichment=ai_outcome, ai_detection_result=ai_outcome, rule_engine_result=rule_outcome)
