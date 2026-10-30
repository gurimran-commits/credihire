"""Scam Indicator Definitions and Schema Specifications.

This module defines the scam indicators, stage enumerations, and structured
data classes used across the deterministic rule engine and classification pipeline.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class ScamStage(str, Enum):
    """Agreed scam stage classifications per the team API contract.

    Stages represent chronological progression in task-based and job-offer scams:
    - JOB_OFFER: Initial unsolicited or suspicious job pitch.
    - REGISTRATION_FEE: Pre-employment fee required before starting.
    - TASK_DEPOSIT: Upfront money or recharge required to perform or unlock tasks.
    - WITHDRAWAL_BLOCK: Accumulated earnings frozen until a release/tax fee is paid.
    - ADVANCE_FEE: Generic advance fee demanded (e.g. equipment, courier, visa).
    - UNKNOWN: No scam pattern detected or benign input.
    """

    JOB_OFFER = "job_offer"
    REGISTRATION_FEE = "registration_fee"
    TASK_DEPOSIT = "task_deposit"
    WITHDRAWAL_BLOCK = "withdrawal_block"
    ADVANCE_FEE = "advance_fee"
    UNKNOWN = "unknown"


class RiskLevel(str, Enum):
    """Deterministic risk severity levels."""

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class IndicatorCategory(str, Enum):
    """The six core required indicator categories plus advance fee helper."""

    UPFRONT_REGISTRATION_FEE = "upfront_registration_fee"
    TASK_DEPOSIT = "task_deposit"
    WITHDRAWAL_FEE = "withdrawal_fee"
    UNREALISTIC_EARNINGS = "unrealistic_earnings"
    URGENCY_PRESSURE = "urgency_pressure"
    SENSITIVE_CREDENTIALS = "sensitive_credentials"
    ADVANCE_FEE = "advance_fee"


# Canonical descriptions and deterministic base weights for each indicator category
INDICATOR_METADATA: Dict[str, Dict[str, Any]] = {
    IndicatorCategory.UPFRONT_REGISTRATION_FEE.value: {
        "name": "Upfront Registration / Onboarding Fee",
        "default_explanation": (
            "Payment is demanded for registration, application processing, "
            "starter kits, interview slots, or background verification before beginning work. "
            "Legitimate employers do not charge candidates to apply or begin employment."
        ),
        "severity": "high",
        "base_weight": 55,
    },
    IndicatorCategory.TASK_DEPOSIT.value: {
        "name": "Task Deposit / Recharge Requirement",
        "default_explanation": (
            "Candidate is required to deposit money, recharge an account, or prepay funds "
            "to unlock tasks or release task earnings. Legitimate jobs never require workers "
            "to pay to work."
        ),
        "severity": "critical",
        "base_weight": 70,
    },
    IndicatorCategory.WITHDRAWAL_FEE.value: {
        "name": "Withdrawal Block / Release Fee",
        "default_explanation": (
            "Accumulated earnings or wallet funds are blocked, demanding an upfront "
            "tax payment, clearance fee, or VIP upgrade before release. This is a hallmark "
            "of task scam exit traps."
        ),
        "severity": "critical",
        "base_weight": 75,
    },
    IndicatorCategory.UNREALISTIC_EARNINGS.value: {
        "name": "Unrealistic Earnings / Low-Effort High-Reward Claims",
        "default_explanation": (
            "Offers disproportionately high daily or hourly compensation for trivial, "
            "unskilled tasks (e.g., liking videos, typing captchas, rating hotels) "
            "with zero experience required."
        ),
        "severity": "medium",
        "base_weight": 35,
    },
    IndicatorCategory.URGENCY_PRESSURE.value: {
        "name": "Urgency and High-Pressure Tactics",
        "default_explanation": (
            "Creates artificial scarcity or immediate time-bomb deadlines (e.g., only few "
            "slots remaining, transfer money within minutes) to bypass critical reasoning."
        ),
        "severity": "low",
        "base_weight": 25,
    },
    IndicatorCategory.SENSITIVE_CREDENTIALS.value: {
        "name": "Sensitive Credential / OTP Solicitation",
        "default_explanation": (
            "Demands sensitive credentials such as OTPs, UPI PINs, banking passwords, "
            "CVV numbers, or remote-access screen sharing under the guise of payroll setup."
        ),
        "severity": "critical",
        "base_weight": 65,
    },
    IndicatorCategory.ADVANCE_FEE.value: {
        "name": "Advance Fee / Collateral Demand",
        "default_explanation": (
            "Demands advance payments for courier charges, laptop security deposits, "
            "or documentation guarantees prior to employment."
        ),
        "severity": "high",
        "base_weight": 50,
    },
}


@dataclass
class IndicatorResult:
    """Represents a single detected indicator with supporting evidence.

    Attributes:
        indicator: Machine-readable indicator identifier.
        explanation: Human-readable rationale for why this text is suspicious.
        evidence: Specific quotes or text fragments triggering the rule.
        severity: Severity level (e.g., critical, high, medium, low).
        rule_id: Internal rule identifier for traceability.
    """

    indicator: str
    explanation: str
    evidence: List[str] = field(default_factory=list)
    severity: str = "medium"
    rule_id: Optional[str] = None

    def to_dict(self, include_metadata: bool = True) -> Dict[str, Any]:
        """Convert indicator result to a dictionary compatible with the API contract."""
        data: Dict[str, Any] = {
            "indicator": self.indicator,
            "explanation": self.explanation,
        }
        if include_metadata:
            data["evidence"] = self.evidence
            data["severity"] = self.severity
            if self.rule_id:
                data["rule_id"] = self.rule_id
        return data


@dataclass
class ScamAnalysisResult:
    """Complete output produced by Karan's Scam Intelligence Engine.

    Attributes:
        scam_stage: Classified scam stage (one of the 6 allowed contract values).
        is_suspicious: Boolean flag indicating if any scam indicator was verified.
        risk_score: Deterministic integer risk severity index from 0 to 100.
        risk_level: Qualitative risk category (LOW, MEDIUM, HIGH, CRITICAL).
        confidence_score: Deterministic confidence score between 0.0 and 1.0 (legacy).
        indicators: List of detected indicator instances with evidence.
        summary: Clear diagnostic summary for the analyst or end user.
    """

    scam_stage: str = ScamStage.UNKNOWN.value
    is_suspicious: bool = False
    risk_score: int = 0
    risk_level: str = RiskLevel.LOW.value
    confidence_score: float = 0.0
    indicators: List[IndicatorResult] = field(default_factory=list)
    summary: str = "No suspicious scam indicators detected."

    def to_contract_dict(self) -> Dict[str, Any]:
        """Return the minimal team-agreed schema format.

        Format:
        {
            "scam_stage": "task_deposit",
            "risk_score": 85,
            "risk_level": "HIGH",
            "indicators": [
                {
                    "indicator": "task_deposit",
                    "explanation": "Payment is requested before earnings are released."
                }
            ]
        }
        """
        return {
            "scam_stage": self.scam_stage,
            "risk_score": self.risk_score,
            "risk_level": self.risk_level,
            "indicators": [
                {
                    "indicator": ind.indicator,
                    "explanation": ind.explanation,
                }
                for ind in self.indicators
            ],
        }

    def to_api_dict(self) -> Dict[str, Any]:
        """Return the API contract dictionary for POST /api/intelligence/analyze."""
        evidence_list: List[str] = []
        for ind in self.indicators:
            for ev in ind.evidence:
                if ev not in evidence_list:
                    evidence_list.append(ev)

        return {
            "scam_stage": self.scam_stage,
            "risk_score": self.risk_score,
            "risk_level": self.risk_level,
            "indicators": [ind.indicator for ind in self.indicators],
            "evidence": evidence_list,
            "explanations": [ind.explanation for ind in self.indicators],
        }

    def to_dict(self) -> Dict[str, Any]:
        """Return the comprehensive analysis dictionary including evidence."""
        return {
            "scam_stage": self.scam_stage,
            "is_suspicious": self.is_suspicious,
            "risk_score": self.risk_score,
            "risk_level": self.risk_level,
            "confidence_score": round(self.confidence_score, 2),
            "summary": self.summary,
            "indicators": [ind.to_dict(include_metadata=True) for ind in self.indicators],
        }
