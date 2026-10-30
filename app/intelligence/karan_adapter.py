from app.schemas.scam import ScamAnalysisRequest

from engine_rules.backend.intelligence.classifier import classify_scam


def _enum_value(value):
    return value.value if hasattr(value, "value") else value


class KaranRuleEngine:
    """Adapter between Karan's deterministic engine and Credihire's API."""

    def analyze(self, request: ScamAnalysisRequest) -> dict:
        result = classify_scam(request.job_text)

        indicators = []
        evidence = []

        for item in result.indicators:
            indicator_name = str(_enum_value(item.indicator))
            severity = str(_enum_value(item.severity)).lower()
            explanation = str(item.explanation)

            indicators.append({
                "code": indicator_name,
                "severity": severity,
                "message": explanation,
            })

            for snippet in item.evidence:
                evidence.append({
                    "source": "job_text",
                    "detail": str(snippet),
                    "indicator_code": indicator_name,
                })

        return {
            "risk_level": str(_enum_value(result.risk_level)).lower(),
            "risk_score": result.risk_score,
            "indicators": indicators,
            "evidence": evidence,
            "scam_stage": str(_enum_value(result.scam_stage)),
            "recommendations": [
                "Do not pay fees or deposits before independently verifying the employer.",
                "Do not share passwords, OTPs, or sensitive financial credentials.",
            ],
            "summary": result.summary,
        }


def create_engine() -> KaranRuleEngine:
    return KaranRuleEngine()
