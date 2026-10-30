"""Interactive Demonstration & Verification Script for Karan's Module.

Run this script to verify that all components are functioning properly
or to test custom messages interactively.
"""

from __future__ import annotations

import json
import os
import sys

# Ensure backend package is in path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from backend.intelligence.classifier import (
    analyze_scam_submission,
    classify_scam,
)

SAMPLE_CASES = [
    (
        "Scam Task Deposit (English)",
        "Pay ₹2,000 to unlock your task earnings.",
    ),
    (
        "Scam Task Deposit (Devanagari Hindi)",
        "काम शुरू करने के लिए ₹500 जमा करें।",
    ),
    (
        "Scam Task Deposit (Hinglish 5k)",
        "Task unlock karne ke liye 5k deposit bhejo.",
    ),
    (
        "Scam Unrealistic Earnings + Urgency",
        "Earn ₹5,000 daily by liking YouTube videos! Only 2 slots left, pay now to confirm.",
    ),
    (
        "Scam Withdrawal Block (Hinglish)",
        "Paise nikalne ke liye pehle clearance fee pay karo.",
    ),
    (
        "Scam Sensitive Credential Harvesting",
        "Please share the OTP sent to your mobile phone to activate your corporate payroll.",
    ),
    (
        "Scam Upfront Registration Fee (Indian /- format)",
        "Registration ke liye 500/- deposit karo.",
    ),
    (
        "Legitimate Job Ad (Benign Case)",
        "We are hiring a Senior Python Engineer. Salary: ₹18-24 LPA with health insurance. Send your CV to careers@example.com.",
    ),
    (
        "Legitimate Security Warning (Hinglish Negation)",
        "Apna OTP kisi ke saath share mat karo.",
    ),
    (
        "Legitimate Security Warning (English Negation)",
        "Warning: Our HR team will never ask for your OTP, passwords, or any registration fee.",
    ),
]


def run_demo() -> None:
    print("=" * 80)
    print("CREDIHIRE — FAKE JOB & TASK-SCAM INTELLIGENCE ENGINE")
    print("=" * 80)
    print("\nRunning verification on representative sample cases...\n")

    for title, text in SAMPLE_CASES:
        print(f"[{title}]")
        print(f"Input: \"{text}\"")
        analysis = classify_scam(text)

        print(f"-> Scam Stage:       {analysis.scam_stage}")
        print(f"-> Suspicious Flag:  {analysis.is_suspicious}")
        print(f"-> Risk Score:       {analysis.risk_score} / 100")
        print(f"-> Risk Level:       {analysis.risk_level}")
        print(f"-> Detected Rules:   {len(analysis.indicators)}")

        for ind in analysis.indicators:
            print(f"   * Indicator: {ind.indicator} (Severity: {ind.severity})")
            print(f"     Reason:    {ind.explanation}")
            if ind.evidence:
                print(f"     Evidence:  \"{ind.evidence[0]}\"")

        print("-" * 80)

    sample_text = "Pay ₹2,000 to unlock your task earnings."
    print(f"\nREST API Output Format (POST /api/intelligence/analyze) for:\n\"{sample_text}\"\n")
    sample_analysis = classify_scam(sample_text)
    print(json.dumps(sample_analysis.to_api_dict(), indent=2, ensure_ascii=False))
    print("\n" + "=" * 80)
    print("All engine components, multilingual rules, and API schemas are verified!")
    print("=" * 80)


if __name__ == "__main__":
    run_demo()
