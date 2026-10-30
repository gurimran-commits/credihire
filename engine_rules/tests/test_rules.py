"""Comprehensive Test Suite for the Scam Intelligence Engine.

Covers positive, negative, and ambiguous test cases for all six indicator
categories, verify zero false positives on legitimate job advertisements,
validate scam-stage classification hierarchy, and ensure compatibility
with the team API contract.

Can be run via:
    pytest tests/test_rules.py
or
    python -m unittest tests/test_rules.py
"""

from __future__ import annotations

import os
import sys
import unittest
from typing import Set

# Ensure repository root is on sys.path for direct script execution
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.intelligence.classifier import (
    analyze_scam_submission,
    classify_scam,
)
from backend.intelligence.indicators import (
    IndicatorCategory,
    RiskLevel,
    ScamStage,
)
from backend.intelligence.rules import (
    detect_advance_fee,
    detect_registration_fee,
    detect_sensitive_credentials,
    detect_task_deposit,
    detect_unrealistic_earnings,
    detect_urgency_pressure,
    detect_withdrawal_block,
    evaluate_rules,
)

VALID_STAGES: Set[str] = {
    ScamStage.JOB_OFFER.value,
    ScamStage.REGISTRATION_FEE.value,
    ScamStage.TASK_DEPOSIT.value,
    ScamStage.WITHDRAWAL_BLOCK.value,
    ScamStage.ADVANCE_FEE.value,
    ScamStage.UNKNOWN.value,
}


class TestRegistrationFeeIndicator(unittest.TestCase):
    """Test Category 1: Upfront Registration / Onboarding Fees."""

    def test_positive_registration_fee_explicit_amount(self) -> None:
        text = "To confirm your selection, pay ₹2,000 registration fee via UPI."
        res = detect_registration_fee(text)
        self.assertIsNotNone(res)
        self.assertEqual(res.indicator, IndicatorCategory.UPFRONT_REGISTRATION_FEE.value)
        self.assertTrue(any("2,000 registration fee" in ev for ev in res.evidence))

    def test_positive_onboarding_charge(self) -> None:
        text = "Selected candidates must transfer Rs 500 onboarding charge before training."
        res = detect_registration_fee(text)
        self.assertIsNotNone(res)
        self.assertEqual(res.indicator, IndicatorCategory.UPFRONT_REGISTRATION_FEE.value)

    def test_positive_starter_kit_purchase(self) -> None:
        text = "Please send payment for the starter kit to begin your remote data entry job."
        res = detect_registration_fee(text)
        self.assertIsNotNone(res)
        self.assertEqual(res.indicator, IndicatorCategory.UPFRONT_REGISTRATION_FEE.value)

    def test_negative_legitimate_no_fee_disclaimer(self) -> None:
        text = "We do not charge any registration fee or application fee at any stage."
        res = detect_registration_fee(text)
        self.assertIsNone(res, "Negated registration fee must not trigger an indicator")

    def test_negative_free_application(self) -> None:
        text = "Application is free of cost. Submit your resume to careers@techcorp.com."
        res = detect_registration_fee(text)
        self.assertIsNone(res)

    def test_negative_corporate_registration_number(self) -> None:
        text = "Acme Corp registration number #449201. Hiring Lead Java Engineer."
        res = detect_registration_fee(text)
        self.assertIsNone(res)


class TestTaskDepositIndicator(unittest.TestCase):
    """Test Category 2: Task Deposits and Task-Unlocking Payments."""

    def test_positive_prompt_example(self) -> None:
        text = "Pay ₹2,000 to unlock your task earnings."
        res = detect_task_deposit(text)
        self.assertIsNotNone(res)
        self.assertEqual(res.indicator, IndicatorCategory.TASK_DEPOSIT.value)
        self.assertTrue(len(res.evidence) > 0)

    def test_positive_employee_account_refundable_security_amount(self) -> None:
        text = "To activate your employee account, complete your first task and deposit ₹499 as a refundable security amount."
        result = classify_scam(text)
        self.assertIn(IndicatorCategory.TASK_DEPOSIT.value, [item.indicator for item in result.indicators])
        self.assertEqual(result.risk_score, 70)
        self.assertEqual(result.risk_level, RiskLevel.HIGH.value)

    def test_positive_vip_task_recharge(self) -> None:
        text = "Recharge ₹1,000 for next VIP task to boost your daily commission rate."
        res = detect_task_deposit(text)
        self.assertIsNotNone(res)
        self.assertEqual(res.indicator, IndicatorCategory.TASK_DEPOSIT.value)

    def test_positive_crypto_task_deposit(self) -> None:
        text = "Deposit 50 USDT to start merchant evaluation task on our app."
        res = detect_task_deposit(text)
        self.assertIsNotNone(res)
        self.assertEqual(res.indicator, IndicatorCategory.TASK_DEPOSIT.value)

    def test_positive_prepay_to_continue_tasks(self) -> None:
        text = "Prepay 500 to receive daily tasks directly on Telegram."
        res = detect_task_deposit(text)
        self.assertIsNotNone(res)
        self.assertEqual(res.indicator, IndicatorCategory.TASK_DEPOSIT.value)

    def test_positive_work_wallet_funding_for_higher_paying_orders(self) -> None:
        text = (
            "Your account has been approved for our premium online earning program. "
            "You can start completing product rating assignments immediately. "
            "To activate higher-paying orders, first add Rs. 3,500 to your work wallet. "
            "The amount will remain in your account and you can recover it with commission."
        )
        result = classify_scam(text)
        self.assertIn(IndicatorCategory.TASK_DEPOSIT.value, [item.indicator for item in result.indicators])
        self.assertEqual(result.scam_stage, ScamStage.TASK_DEPOSIT.value)
        self.assertEqual(result.risk_score, 70)
        self.assertEqual(result.risk_level, RiskLevel.HIGH.value)

    def test_positive_wallet_and_activation_variations(self) -> None:
        for text in (
            "Fund your account to unlock premium assignments.",
            "Load money into your wallet to access the next order.",
            "Add ₹2,000 to activate higher-paying tasks.",
            "Top up INR 2,000 to your task balance to access premium assignments.",
        ):
            with self.subTest(text=text):
                self.assertIsNotNone(detect_task_deposit(text))

    def test_negative_wallet_warnings_and_no_recharge_requirement(self) -> None:
        for text in (
            "Never add money to unlock tasks.",
            "No wallet recharge is required.",
        ):
            with self.subTest(text=text):
                self.assertIsNone(detect_task_deposit(text))

    def test_negative_software_engineering_task(self) -> None:
        text = "You will be assigned feature development tasks and code reviews using Jira."
        res = detect_task_deposit(text)
        self.assertIsNone(res, "Engineering development tasks must not trigger task deposit")

    def test_negative_salary_direct_deposit(self) -> None:
        text = "Salary will be processed via direct deposit into your bank account on the 1st."
        res = detect_task_deposit(text)
        self.assertIsNone(res, "Salary direct deposit must not be flagged as a task deposit")

    def test_negative_take_home_assessment(self) -> None:
        text = "Please complete the take-home coding assessment task within 48 hours."
        res = detect_task_deposit(text)
        self.assertIsNone(res)


class TestWithdrawalBlockIndicator(unittest.TestCase):
    """Test Category 3: Withdrawal Fees and Blocked Withdrawals."""

    def test_positive_tax_fee_to_release_balance(self) -> None:
        text = "Your balance of ₹45,000 is frozen. Pay 18% tax fee to unlock funds."
        res = detect_withdrawal_block(text)
        self.assertIsNotNone(res)
        self.assertEqual(res.indicator, IndicatorCategory.WITHDRAWAL_FEE.value)

    def test_positive_clearance_fee_for_withdrawal(self) -> None:
        text = "A clearance fee of ₹2,500 is required to process withdrawal of your payout."
        res = detect_withdrawal_block(text)
        self.assertIsNotNone(res)
        self.assertEqual(res.indicator, IndicatorCategory.WITHDRAWAL_FEE.value)

    def test_positive_wallet_locked_transfer_fee(self) -> None:
        text = "Account wallet is locked due to code error, pay 1000 clearance fee to withdraw."
        res = detect_withdrawal_block(text)
        self.assertIsNotNone(res)
        self.assertEqual(res.indicator, IndicatorCategory.WITHDRAWAL_FEE.value)

    def test_negative_legitimate_bank_withdrawal(self) -> None:
        text = "Employees may access retirement savings or withdraw funds per corporate policy."
        res = detect_withdrawal_block(text)
        self.assertIsNone(res)

    def test_negative_free_withdrawals(self) -> None:
        text = "No withdrawal fee will ever be charged on your salary account."
        res = detect_withdrawal_block(text)
        self.assertIsNone(res)


class TestUnrealisticEarningsIndicator(unittest.TestCase):
    """Test Category 4: Unrealistic Earnings Claims for Trivial Tasks."""

    def test_positive_youtube_like_daily_income(self) -> None:
        text = "Earn ₹3,000 - ₹8,000 daily from home just by liking YouTube videos!"
        res = detect_unrealistic_earnings(text)
        self.assertIsNotNone(res)
        self.assertEqual(res.indicator, IndicatorCategory.UNREALISTIC_EARNINGS.value)

    def test_positive_hotel_review_hourly(self) -> None:
        text = "Get daily income of 5000 INR per day by rating hotels online."
        res = detect_unrealistic_earnings(text)
        self.assertIsNotNone(res)
        self.assertEqual(res.indicator, IndicatorCategory.UNREALISTIC_EARNINGS.value)

    def test_positive_short_minutes_high_monthly_pay(self) -> None:
        text = "Work 15 minutes a day and earn ₹50,000 per month with no prior experience."
        res = detect_unrealistic_earnings(text)
        self.assertIsNotNone(res)
        self.assertEqual(res.indicator, IndicatorCategory.UNREALISTIC_EARNINGS.value)

    def test_positive_guaranteed_instant_payout(self) -> None:
        text = "Guaranteed daily payout of ₹3000 to your UPI account every evening."
        res = detect_unrealistic_earnings(text)
        self.assertIsNotNone(res)
        self.assertEqual(res.indicator, IndicatorCategory.UNREALISTIC_EARNINGS.value)

    def test_negative_legitimate_annual_salary(self) -> None:
        text = "Compensation: $110,000 - $140,000 per year plus equity and health insurance."
        res = detect_unrealistic_earnings(text)
        self.assertIsNone(res, "Standard annual salary should not trigger unrealistic earnings")

    def test_negative_legitimate_hourly_dev_rate(self) -> None:
        text = "Senior Python Contractor: $45 per hour, 40 hours per week, 6-month contract."
        res = detect_unrealistic_earnings(text)
        self.assertIsNone(res, "Professional developer hourly contract must not be flagged")

    def test_negative_indian_corporate_ctc(self) -> None:
        text = "Offering 12-16 LPA for Cloud Architect with 6+ years experience in AWS."
        res = detect_unrealistic_earnings(text)
        self.assertIsNone(res)


class TestUrgencyPressureIndicator(unittest.TestCase):
    """Test Category 5: Urgency and Coercive Pressure Tactics."""

    def test_positive_countdown_transfer(self) -> None:
        text = "Transfer within 10 minutes or offer expires immediately!"
        res = detect_urgency_pressure(text)
        self.assertIsNotNone(res)
        self.assertEqual(res.indicator, IndicatorCategory.URGENCY_PRESSURE.value)

    def test_positive_slot_scarcity_with_payment(self) -> None:
        text = "Only 2 slots left, pay now to confirm your job offer!"
        res = detect_urgency_pressure(text)
        self.assertIsNotNone(res)
        self.assertEqual(res.indicator, IndicatorCategory.URGENCY_PRESSURE.value)

    def test_positive_short_lived_offer_window(self) -> None:
        text = "Joining link is valid for the next 15 minutes only, pay now."
        res = detect_urgency_pressure(text)
        self.assertIsNotNone(res)
        self.assertEqual(res.indicator, IndicatorCategory.URGENCY_PRESSURE.value)

    def test_negative_standard_recruitment_urgency(self) -> None:
        text = "Urgent requirement for Senior Python Developer in Bangalore. Immediate joiners."
        res = detect_urgency_pressure(text)
        self.assertIsNone(res, "Recruitment phrase 'urgent requirement' must not be flagged as scam urgency")

    def test_negative_normal_application_deadline(self) -> None:
        text = "Applications close on October 31st at 5:00 PM."
        res = detect_urgency_pressure(text)
        self.assertIsNone(res)


class TestSensitiveCredentialsIndicator(unittest.TestCase):
    """Test Category 6: Requests for Sensitive Credentials / OTPs."""

    def test_positive_otp_request(self) -> None:
        text = "Please share the OTP sent to your phone to activate your payroll account."
        res = detect_sensitive_credentials(text)
        self.assertIsNotNone(res)
        self.assertEqual(res.indicator, IndicatorCategory.SENSITIVE_CREDENTIALS.value)

    def test_positive_upi_pin_demand(self) -> None:
        text = "Enter your UPI PIN to receive ₹5,000 joining bonus directly in your bank."
        res = detect_sensitive_credentials(text)
        self.assertIsNotNone(res)
        self.assertEqual(res.indicator, IndicatorCategory.SENSITIVE_CREDENTIALS.value)

    def test_positive_cvv_or_banking_password(self) -> None:
        text = "Share your CVV and net banking password to confirm corporate direct deposit."
        res = detect_sensitive_credentials(text)
        self.assertIsNotNone(res)
        self.assertEqual(res.indicator, IndicatorCategory.SENSITIVE_CREDENTIALS.value)

    def test_positive_remote_desktop_software(self) -> None:
        text = "Install AnyDesk to complete salary account verification with our finance team."
        res = detect_sensitive_credentials(text)
        self.assertIsNotNone(res)
        self.assertEqual(res.indicator, IndicatorCategory.SENSITIVE_CREDENTIALS.value)

    def test_negative_legitimate_bank_details_request(self) -> None:
        text = "Please submit your bank account number and IFSC code for salary disbursement."
        res = detect_sensitive_credentials(text)
        self.assertIsNone(res, "Standard payroll IFSC/account collection must not trigger credential warning")

    def test_negative_security_warning_never_ask_otp(self) -> None:
        text = "Warning: Company HR will never ask for your OTP, UPI PIN, or net banking password."
        res = detect_sensitive_credentials(text)
        self.assertIsNone(res, "Security warning forbidding OTP sharing must not be flagged")


class TestAdvanceFeeIndicator(unittest.TestCase):
    """Test Advance Fee Helper Category."""

    def test_positive_laptop_security_deposit(self) -> None:
        text = "Pay ₹3,000 refundable security deposit for laptop before we dispatch equipment."
        res = detect_advance_fee(text)
        self.assertIsNotNone(res)
        self.assertEqual(res.indicator, IndicatorCategory.ADVANCE_FEE.value)

    def test_positive_courier_charge(self) -> None:
        text = "Courier fee of Rs 500 must be paid in advance to receive your welcome kit."
        res = detect_advance_fee(text)
        self.assertIsNotNone(res)
        self.assertEqual(res.indicator, IndicatorCategory.ADVANCE_FEE.value)

    def test_negative_free_equipment_policy(self) -> None:
        text = "All company hardware, including MacBook and accessories, is shipped free of charge."
        res = detect_advance_fee(text)
        self.assertIsNone(res)


class TestScamStageClassifier(unittest.TestCase):
    """Test Classification into the 6 Agreed Contract Scam Stages."""

    def test_stage_task_deposit_prompt_example(self) -> None:
        res = classify_scam("Pay ₹2,000 to unlock your task earnings.")
        self.assertEqual(res.scam_stage, ScamStage.TASK_DEPOSIT.value)
        self.assertTrue(res.is_suspicious)
        self.assertIn(res.scam_stage, VALID_STAGES)

    def test_stage_withdrawal_block(self) -> None:
        res = classify_scam("Account frozen. Pay 18% tax fee to withdraw your earnings.")
        self.assertEqual(res.scam_stage, ScamStage.WITHDRAWAL_BLOCK.value)
        self.assertTrue(res.is_suspicious)

    def test_stage_registration_fee(self) -> None:
        res = classify_scam("Deposit ₹1,500 registration fee to begin onboarding.")
        self.assertEqual(res.scam_stage, ScamStage.REGISTRATION_FEE.value)
        self.assertTrue(res.is_suspicious)

    def test_stage_advance_fee(self) -> None:
        res = classify_scam("Pay ₹3,000 refundable security deposit for laptop equipment.")
        self.assertEqual(res.scam_stage, ScamStage.ADVANCE_FEE.value)
        self.assertTrue(res.is_suspicious)

    def test_stage_job_offer_unrealistic_earnings_alone(self) -> None:
        res = classify_scam("Earn ₹5,000 daily from home by liking YouTube videos!")
        self.assertEqual(res.scam_stage, ScamStage.JOB_OFFER.value)
        self.assertTrue(res.is_suspicious)

    def test_stage_unknown_legitimate_job_ad(self) -> None:
        text = (
            "We are hiring a Senior Python Engineer. "
            "Requirements: 4+ years of Django/FastAPI experience. "
            "Salary: ₹18-24 LPA with health insurance. "
            "Send your CV to careers@example.com."
        )
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.UNKNOWN.value)
        self.assertFalse(res.is_suspicious)
        self.assertEqual(len(res.indicators), 0)
        self.assertIn("No deterministic scam indicators detected", res.summary)

    def test_stage_priority_hierarchy_withdrawal_over_deposit(self) -> None:
        # If both task earnings and withdrawal tax fee are mentioned, withdrawal_block takes priority
        text = (
            "Pay ₹2,000 to unlock your task earnings. "
            "Also withdrawal is blocked, pay 18% tax fee to release balance."
        )
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.WITHDRAWAL_BLOCK.value)

    def test_stage_priority_deposit_over_job_offer(self) -> None:
        # Unrealistic earnings combined with task recharge resolves to task_deposit
        text = (
            "Earn ₹5,000 daily by liking YouTube videos! "
            "Recharge ₹1,000 for next VIP task to continue."
        )
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.TASK_DEPOSIT.value)


class TestApiContractCompatibility(unittest.TestCase):
    """Test API Contract Compatibility and Schema Conformance."""

    def test_contract_dict_structure(self) -> None:
        output = analyze_scam_submission("Pay ₹2,000 to unlock your task earnings.")

        self.assertIn("scam_stage", output)
        self.assertIn("indicators", output)
        self.assertIn(output["scam_stage"], VALID_STAGES)
        self.assertIsInstance(output["indicators"], list)

        for ind in output["indicators"]:
            self.assertIn("indicator", ind)
            self.assertIn("explanation", ind)
            self.assertIsInstance(ind["indicator"], str)
            self.assertIsInstance(ind["explanation"], str)

    def test_full_analysis_result_serialization(self) -> None:
        res = classify_scam("Pay ₹2,000 to unlock your task earnings.")
        data = res.to_dict()

        self.assertIn("scam_stage", data)
        self.assertIn("is_suspicious", data)
        self.assertIn("confidence_score", data)
        self.assertIn("indicators", data)
        self.assertIn("summary", data)
        self.assertGreater(data["confidence_score"], 0.0)
        self.assertLessEqual(data["confidence_score"], 1.0)

        # Check evidence preservation
        first_ind = data["indicators"][0]
        self.assertIn("evidence", first_ind)
        self.assertTrue(len(first_ind["evidence"]) > 0)


class TestEdgeCasesAndAmbiguousScenarios(unittest.TestCase):
    """Test Edge Cases, Empty Inputs, and Ambiguous Text."""

    def test_empty_string(self) -> None:
        res = classify_scam("")
        self.assertEqual(res.scam_stage, ScamStage.UNKNOWN.value)
        self.assertFalse(res.is_suspicious)
        self.assertEqual(res.confidence_score, 0.0)

    def test_whitespace_and_newlines(self) -> None:
        res = classify_scam("   \n\n\t   ")
        self.assertEqual(res.scam_stage, ScamStage.UNKNOWN.value)
        self.assertFalse(res.is_suspicious)

    def test_multiline_mixed_case(self) -> None:
        text = (
            "Congratulations on qualifying!\n\n"
            "pAy ₹2,000 To UnLoCk YoUr TaSk EaRnInGs immediately.\n\n"
            "Contact telegram @admin."
        )
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.TASK_DEPOSIT.value)
        self.assertTrue(res.is_suspicious)

    def test_short_benign_text(self) -> None:
        res = classify_scam("Hello, is this job still open?")
        self.assertEqual(res.scam_stage, ScamStage.UNKNOWN.value)
        self.assertFalse(res.is_suspicious)

    def test_currency_symbol_variants(self) -> None:
        # Dollars
        res_usd = classify_scam("Pay $50 to unlock task earnings.")
        self.assertEqual(res_usd.scam_stage, ScamStage.TASK_DEPOSIT.value)

        # INR
        res_inr = classify_scam("Pay INR 1500 registration fee before interview.")
        self.assertEqual(res_inr.scam_stage, ScamStage.REGISTRATION_FEE.value)

        # Rs.
        res_rs = classify_scam("Pay Rs. 1000 registration fee to enroll.")
        self.assertEqual(res_rs.scam_stage, ScamStage.REGISTRATION_FEE.value)


class TestAdversarialAndRealWorldEdgeCases(unittest.TestCase):
    """Adversarial and real-world edge cases discovered during deep security auditing."""

    def test_suffix_negation_task_deposit_strictly_prohibited(self) -> None:
        text = "Task deposit is strictly prohibited and illegal under company guidelines."
        res = classify_scam(text)
        self.assertFalse(res.is_suspicious, "Suffix negation must not trigger false positive")
        self.assertEqual(res.scam_stage, ScamStage.UNKNOWN.value)

    def test_suffix_negation_task_deposit_never_required(self) -> None:
        text = "Task deposit is never required by our company for any project."
        res = classify_scam(text)
        self.assertFalse(res.is_suspicious)
        self.assertEqual(res.scam_stage, ScamStage.UNKNOWN.value)

    def test_indian_rupee_slash_dash_format_registration(self) -> None:
        text = "Pay ₹2,000/- registration fee to confirm seat."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.REGISTRATION_FEE.value)
        self.assertTrue(res.is_suspicious)

    def test_indian_rupee_slash_dash_format_task_deposit(self) -> None:
        text = "Pay Rs 2000/- to unlock task earnings."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.TASK_DEPOSIT.value)
        self.assertTrue(res.is_suspicious)

    def test_compact_k_multiplier_amount(self) -> None:
        text = "Pay 2k to unlock your task earnings."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.TASK_DEPOSIT.value)
        self.assertTrue(res.is_suspicious)

    def test_earnings_range_with_to_separator_and_trailing_from_home(self) -> None:
        text = "Hello dear, part time job opportunity. Earn 3000 to 8000 daily by liking YouTube videos from home. Contact telegram @agent"
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.JOB_OFFER.value)
        self.assertTrue(res.is_suspicious)

    def test_withdrawal_on_hold_with_clearance_fee(self) -> None:
        text = "Your withdrawal of ₹25,000 is on hold. Pay clearance fee of ₹2,500 to release funds."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.WITHDRAWAL_BLOCK.value)
        self.assertTrue(res.is_suspicious)


class TestSentenceAwareNegationAndAccuracy(unittest.TestCase):
    """Phase 2 Regression & Sentence-Aware Negation Tests.

    Validates that:
    1. Sentence boundaries strictly scope negation.
    2. A warning in sentence 1 does not suppress scam indicators in sentence 2.
    3. Currency abbreviations (e.g. 'Rs. 500') do not prematurely split evidence.
    4. Mixed positive and negative statements isolate the true malicious demand.
    5. Reassuring claims ('not a scam') do not deceive the detector.
    """

    def test_mandatory_regression_1_beware_scammers_then_pay_fee(self) -> None:
        text = "Beware of scammers. Pay ₹500 registration fee to get hired."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.REGISTRATION_FEE.value)
        self.assertTrue(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.UPFRONT_REGISTRATION_FEE.value, indicator_names)
        self.assertTrue(any("Pay ₹500 registration fee to get hired" in ev for ind in res.indicators for ev in ind.evidence))

    def test_mandatory_regression_2_no_reg_fee_then_task_deposit(self) -> None:
        text = "No registration fee is charged. Pay ₹500 to unlock your task earnings."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.TASK_DEPOSIT.value)
        self.assertTrue(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.TASK_DEPOSIT.value, indicator_names)
        self.assertNotIn(IndicatorCategory.UPFRONT_REGISTRATION_FEE.value, indicator_names)
        self.assertTrue(any("Pay ₹500 to unlock your task earnings" in ev for ind in res.indicators for ev in ind.evidence))

    def test_mandatory_regression_3_we_do_not_ask_otp_then_share_otp(self) -> None:
        text = "We do not ask for OTP. Please share the OTP to activate payroll."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.JOB_OFFER.value)
        self.assertTrue(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.SENSITIVE_CREDENTIALS.value, indicator_names)
        self.assertTrue(any("share the OTP" in ev for ind in res.indicators for ev in ind.evidence))

    def test_same_sentence_negation_registration_fee(self) -> None:
        text = "We do not ask for any registration fee to apply for this job."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.UNKNOWN.value)
        self.assertFalse(res.is_suspicious)

    def test_same_sentence_negation_task_deposit(self) -> None:
        text = "Task deposit is never required for any candidate."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.UNKNOWN.value)
        self.assertFalse(res.is_suspicious)

    def test_same_sentence_negation_advance_fee(self) -> None:
        text = "We will never ask you to pay any advance fee or courier fee."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.UNKNOWN.value)
        self.assertFalse(res.is_suspicious)

    def test_different_sentence_warning_then_task_deposit(self) -> None:
        text = "Never pay money for interviews! Pay ₹1,000 for VIP task unlocking."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.TASK_DEPOSIT.value)
        self.assertTrue(res.is_suspicious)

    def test_different_sentence_warning_then_advance_fee(self) -> None:
        text = "Beware of fake offers online. Pay ₹3,000 refundable security deposit for laptop."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.ADVANCE_FEE.value)
        self.assertTrue(res.is_suspicious)

    def test_multiple_payment_requests_reg_fee_and_task_deposit(self) -> None:
        text = "Pay ₹500 registration fee to enroll. Also recharge ₹2,000 to unlock your first task."
        res = classify_scam(text)
        # Stage hierarchy prioritizes task_deposit over registration_fee
        self.assertEqual(res.scam_stage, ScamStage.TASK_DEPOSIT.value)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.UPFRONT_REGISTRATION_FEE.value, indicator_names)
        self.assertIn(IndicatorCategory.TASK_DEPOSIT.value, indicator_names)

    def test_multiple_payment_requests_reg_fee_and_withdrawal_block(self) -> None:
        text = "Deposit ₹500 joining fee. Later pay clearance fee of ₹1,500 to withdraw your funds."
        res = classify_scam(text)
        # Stage hierarchy prioritizes withdrawal_block over registration_fee
        self.assertEqual(res.scam_stage, ScamStage.WITHDRAWAL_BLOCK.value)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.UPFRONT_REGISTRATION_FEE.value, indicator_names)
        self.assertIn(IndicatorCategory.WITHDRAWAL_FEE.value, indicator_names)

    def test_punctuation_exclamation_warning_then_fee(self) -> None:
        text = "Warning: fake recruiters exist! Pay ₹500 registration fee now."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.REGISTRATION_FEE.value)
        self.assertTrue(res.is_suspicious)

    def test_punctuation_semicolon_contrasting_clauses(self) -> None:
        text = "We do not ask for fees; however, pay ₹500 to unlock your task earnings."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.TASK_DEPOSIT.value)
        self.assertTrue(res.is_suspicious)

    def test_punctuation_question_mark_heading(self) -> None:
        text = "Looking for a part-time job? Pay ₹500 registration fee to get hired."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.REGISTRATION_FEE.value)
        self.assertTrue(res.is_suspicious)

    def test_punctuation_newline_multiline(self) -> None:
        text = "Important Notice\n\nPay ₹500 registration fee to confirm your interview."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.REGISTRATION_FEE.value)
        self.assertTrue(res.is_suspicious)

    def test_punctuation_hindi_purna_viram(self) -> None:
        text = "सावधान रहें। Pay ₹500 registration fee to get hired."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.REGISTRATION_FEE.value)
        self.assertTrue(res.is_suspicious)

    def test_evidence_extraction_currency_abbrev_rs_dot(self) -> None:
        text = "Beware of scammers. Pay Rs. 500 registration fee to get hired."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.REGISTRATION_FEE.value)
        self.assertTrue(len(res.indicators) > 0)
        evidence = res.indicators[0].evidence
        self.assertTrue(any("Pay Rs. 500 registration fee to get hired" in ev for ev in evidence))

    def test_evidence_extraction_inr_dot(self) -> None:
        text = "Notice from HR. Pay INR. 1000 registration fee before starting."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.REGISTRATION_FEE.value)
        evidence = res.indicators[0].evidence
        self.assertTrue(any("Pay INR. 1000 registration fee" in ev for ev in evidence))

    def test_mixed_positive_and_negative_statements(self) -> None:
        text = "We do not charge any application fee, but you must pay ₹1,000 to unlock task earnings."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.TASK_DEPOSIT.value)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.TASK_DEPOSIT.value, indicator_names)
        self.assertNotIn(IndicatorCategory.UPFRONT_REGISTRATION_FEE.value, indicator_names)

    def test_mixed_negative_statement_with_fee_demand(self) -> None:
        text = "Pay ₹500 registration fee to get hired. We never ask for OTP or banking passwords."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.REGISTRATION_FEE.value)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.UPFRONT_REGISTRATION_FEE.value, indicator_names)
        self.assertNotIn(IndicatorCategory.SENSITIVE_CREDENTIALS.value, indicator_names)

    def test_long_message_with_disclaimer_and_payment_trap(self) -> None:
        text = (
            "Welcome to Global Logistics. We are an international supply chain leader "
            "with over 5,000 employees worldwide.\n\n"
            "Disclaimer: We do not discriminate on the basis of race, gender, or age.\n\n"
            "To confirm your employment and receive your welcome kit, pay ₹1,500 registration fee via UPI.\n\n"
            "Please reply within 24 hours to secure your spot."
        )
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.REGISTRATION_FEE.value)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.UPFRONT_REGISTRATION_FEE.value, indicator_names)
        evidence = res.indicators[0].evidence
        self.assertTrue(any("pay ₹1,500 registration fee" in ev for ev in evidence))

    def test_reassuring_phrase_not_a_scam(self) -> None:
        text = "This is 100% genuine and not a scam! Pay ₹500 registration fee to enroll."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.REGISTRATION_FEE.value)
        self.assertTrue(res.is_suspicious)

    def test_user_question_is_this_a_scam(self) -> None:
        text = "Is this a scam? Pay ₹2,000 to unlock your task earnings."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.TASK_DEPOSIT.value)
        self.assertTrue(res.is_suspicious)

    def test_comma_clause_disclaimer_then_share_otp(self) -> None:
        text = "We do not ask for OTP, please share your OTP to activate payroll."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.JOB_OFFER.value)
        self.assertTrue(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.SENSITIVE_CREDENTIALS.value, indicator_names)

    def test_comma_clause_disclaimer_then_task_deposit(self) -> None:
        text = "We never charge interview fees, pay ₹500 to unlock task earnings."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.TASK_DEPOSIT.value)
        self.assertTrue(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.TASK_DEPOSIT.value, indicator_names)

    def test_contrasting_clause_no_reg_fee_then_joining_fee_mandatory(self) -> None:
        text = "No registration fee is charged, but a ₹500 joining fee is mandatory."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.REGISTRATION_FEE.value)
        self.assertTrue(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.UPFRONT_REGISTRATION_FEE.value, indicator_names)

    def test_two_sentences_not_require_deposits_then_vip_task_deposit(self) -> None:
        text = "We do not require deposits for normal tasks. Pay ₹1,000 for VIP tasks."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.TASK_DEPOSIT.value)
        self.assertTrue(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.TASK_DEPOSIT.value, indicator_names)

    def test_never_share_otp_is_cleanly_negated(self) -> None:
        text = "Never share your OTP with anyone."
        res = classify_scam(text)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertNotIn(IndicatorCategory.SENSITIVE_CREDENTIALS.value, indicator_names)
        self.assertFalse(res.is_suspicious)

    def test_no_otp_warning_but_provide_banking_password(self) -> None:
        text = "We do not ask for OTP, but please provide your banking password."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.JOB_OFFER.value)
        self.assertTrue(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.SENSITIVE_CREDENTIALS.value, indicator_names)

    def test_never_charge_candidates_transfer_fee_to_activate_account(self) -> None:
        text = "We never charge candidates, kindly transfer ₹500 to activate your account."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.REGISTRATION_FEE.value)
        self.assertTrue(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.UPFRONT_REGISTRATION_FEE.value, indicator_names)

    def test_do_not_require_passwords_never_share_password(self) -> None:
        text = "We do not require passwords. Never share your password with anyone."
        res = classify_scam(text)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertNotIn(IndicatorCategory.SENSITIVE_CREDENTIALS.value, indicator_names)
        self.assertFalse(res.is_suspicious)

    def test_no_deposits_required_but_pay_to_unlock_tasks(self) -> None:
        text = "No deposits are required, but pay ₹500 to unlock your tasks."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.TASK_DEPOSIT.value)
        self.assertTrue(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.TASK_DEPOSIT.value, indicator_names)

    def test_do_not_charge_registration_fees_no_fee_to_apply(self) -> None:
        text = "We do not charge registration fees. There is no fee to apply."
        res = classify_scam(text)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertNotIn(IndicatorCategory.UPFRONT_REGISTRATION_FEE.value, indicator_names)
        self.assertFalse(res.is_suspicious)

    def test_do_not_require_deposits_task_deposit_not_required(self) -> None:
        text = "We do not require deposits, task deposit is not required."
        res = classify_scam(text)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertNotIn(IndicatorCategory.TASK_DEPOSIT.value, indicator_names)
        self.assertFalse(res.is_suspicious)

    def test_never_ask_candidates_to_pay_payment_not_required(self) -> None:
        text = "We never ask candidates to pay, payment is not required for any task."
        res = classify_scam(text)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertNotIn(IndicatorCategory.TASK_DEPOSIT.value, indicator_names)
        self.assertNotIn(IndicatorCategory.UPFRONT_REGISTRATION_FEE.value, indicator_names)
        self.assertFalse(res.is_suspicious)

    def test_do_not_charge_registration_onboarding_training_fees_list(self) -> None:
        text = "We do not charge registration fees, onboarding fees, or training fees."
        res = classify_scam(text)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertNotIn(IndicatorCategory.UPFRONT_REGISTRATION_FEE.value, indicator_names)
        self.assertFalse(res.is_suspicious)

    def test_do_not_require_deposit_but_vip_tasks_require_deposit(self) -> None:
        text = "We do not require a deposit, but VIP tasks require a ₹500 deposit."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.TASK_DEPOSIT.value)
        self.assertTrue(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.TASK_DEPOSIT.value, indicator_names)

    def test_negative_list_with_task_deposit_noun_phrase(self) -> None:
        text = "We do not require registration fees, task deposit, or courier charges."
        res = classify_scam(text)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertNotIn(IndicatorCategory.TASK_DEPOSIT.value, indicator_names)
        self.assertNotIn(IndicatorCategory.UPFRONT_REGISTRATION_FEE.value, indicator_names)
        self.assertFalse(res.is_suspicious)


class TestDevanagariHindiIntelligence(unittest.TestCase):
    """Devanagari Hindi scam detection tests covering all 7 categories."""

    def test_positive_devanagari_registration_fee(self) -> None:
        text = "काम शुरू करने के लिए ₹500 रजिस्ट्रेशन फीस भरें।"
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.REGISTRATION_FEE.value)
        self.assertTrue(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.UPFRONT_REGISTRATION_FEE.value, indicator_names)

    def test_negative_devanagari_registration_fee(self) -> None:
        text = "हमारी कंपनी में कोई भी रजिस्ट्रेशन फीस नहीं लगती।"
        res = classify_scam(text)
        self.assertFalse(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertNotIn(IndicatorCategory.UPFRONT_REGISTRATION_FEE.value, indicator_names)

    def test_ambiguous_devanagari_registration_benign(self) -> None:
        text = "कंपनी का कॉर्पोरेट रजिस्ट्रेशन नंबर CIN123456 है।"
        res = classify_scam(text)
        self.assertFalse(res.is_suspicious)
        self.assertEqual(res.scam_stage, ScamStage.UNKNOWN.value)

    def test_positive_devanagari_task_deposit(self) -> None:
        text = "काम शुरू करने के लिए ₹500 जमा करें"
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.TASK_DEPOSIT.value)
        self.assertTrue(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.TASK_DEPOSIT.value, indicator_names)

    def test_negative_devanagari_task_deposit(self) -> None:
        text = "टास्क के लिए कोई भी डिपॉजिट या रिचार्ज की आवश्यकता नहीं है।"
        res = classify_scam(text)
        self.assertFalse(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertNotIn(IndicatorCategory.TASK_DEPOSIT.value, indicator_names)

    def test_ambiguous_devanagari_task_deposit_benign(self) -> None:
        text = "सैलरी सीधे आपके बैंक खाते में डायरेक्ट डिपॉजिट होगी।"
        res = classify_scam(text)
        self.assertFalse(res.is_suspicious)
        self.assertEqual(res.scam_stage, ScamStage.UNKNOWN.value)

    def test_positive_devanagari_withdrawal_fee(self) -> None:
        text = "पैसे निकालने के लिए पहले फीस भरें"
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.WITHDRAWAL_BLOCK.value)
        self.assertTrue(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.WITHDRAWAL_FEE.value, indicator_names)

    def test_negative_devanagari_withdrawal_fee(self) -> None:
        text = "बिना किसी शुल्क या विड्रॉल फीस के अपने पैसे निकालें।"
        res = classify_scam(text)
        self.assertFalse(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertNotIn(IndicatorCategory.WITHDRAWAL_FEE.value, indicator_names)

    def test_ambiguous_devanagari_withdrawal_benign(self) -> None:
        text = "बैंक एटीएम से पैसे निकालने की सुविधा मुफ्त है।"
        res = classify_scam(text)
        self.assertFalse(res.is_suspicious)
        self.assertEqual(res.scam_stage, ScamStage.UNKNOWN.value)

    def test_positive_devanagari_unrealistic_earnings(self) -> None:
        text = "घर बैठे यूट्यूब वीडियो लाइक करके रोजाना ₹2,000 से ₹5,000 कमाएं।"
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.JOB_OFFER.value)
        self.assertTrue(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.UNREALISTIC_EARNINGS.value, indicator_names)

    def test_negative_devanagari_unrealistic_earnings(self) -> None:
        text = "हम बिना किसी मेहनत के ज्यादा कमाई का कोई झूठा वादा नहीं करते।"
        res = classify_scam(text)
        self.assertFalse(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertNotIn(IndicatorCategory.UNREALISTIC_EARNINGS.value, indicator_names)

    def test_ambiguous_devanagari_unrealistic_earnings_benign(self) -> None:
        text = "सीनियर सॉफ्टवेयर इंजीनियर का वार्षिक वेतन ₹15 लाख से ₹25 लाख है।"
        res = classify_scam(text)
        self.assertFalse(res.is_suspicious)
        self.assertEqual(res.scam_stage, ScamStage.UNKNOWN.value)

    def test_positive_devanagari_urgency_pressure(self) -> None:
        text = "केवल 2 सीटें बाकी हैं, अभी ₹500 फीस जमा करके सीट पक्की करें।"
        res = classify_scam(text)
        self.assertTrue(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.URGENCY_PRESSURE.value, indicator_names)

    def test_negative_devanagari_urgency_pressure(self) -> None:
        text = "आवेदन करने के लिए कोई जल्दबाजी नहीं है, अंतिम तारीख 30 नवंबर है।"
        res = classify_scam(text)
        self.assertFalse(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertNotIn(IndicatorCategory.URGENCY_PRESSURE.value, indicator_names)

    def test_ambiguous_devanagari_urgency_benign(self) -> None:
        text = "साक्षात्कार का समय कल सुबह 10 बजे निर्धारित है।"
        res = classify_scam(text)
        self.assertFalse(res.is_suspicious)
        self.assertEqual(res.scam_stage, ScamStage.UNKNOWN.value)

    def test_positive_devanagari_sensitive_credentials(self) -> None:
        text = "वेतन सक्रिय करने के लिए अपना ओटीपी और यूपीआई पिन दर्ज करें।"
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.JOB_OFFER.value)
        self.assertTrue(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.SENSITIVE_CREDENTIALS.value, indicator_names)

    def test_negative_devanagari_sensitive_credentials(self) -> None:
        text = "अपना ओटीपी या बैंक पासवर्ड किसी के साथ साझा मत करें।"
        res = classify_scam(text)
        self.assertFalse(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertNotIn(IndicatorCategory.SENSITIVE_CREDENTIALS.value, indicator_names)

    def test_ambiguous_devanagari_credentials_benign(self) -> None:
        text = "सैलरी क्रेडिट के लिए अपना बैंक खाता संख्या और IFSC कोड जमा करें।"
        res = classify_scam(text)
        self.assertFalse(res.is_suspicious)
        self.assertEqual(res.scam_stage, ScamStage.UNKNOWN.value)

    def test_positive_devanagari_advance_fee(self) -> None:
        text = "लैपटॉप और किट प्राप्त करने के लिए ₹3,000 सुरक्षा जमा का भुगतान करें।"
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.ADVANCE_FEE.value)
        self.assertTrue(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.ADVANCE_FEE.value, indicator_names)

    def test_negative_devanagari_advance_fee(self) -> None:
        text = "कंपनी बिना किसी कूरियर चार्ज या लैपटॉप डिपॉजिट के सभी उपकरण मुफ्त देती है।"
        res = classify_scam(text)
        self.assertFalse(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertNotIn(IndicatorCategory.ADVANCE_FEE.value, indicator_names)

    def test_ambiguous_devanagari_advance_fee_benign(self) -> None:
        text = "कूरियर ट्रैकिंग नंबर द्वारा अपने पैकेज की स्थिति जांचें।"
        res = classify_scam(text)
        self.assertFalse(res.is_suspicious)
        self.assertEqual(res.scam_stage, ScamStage.UNKNOWN.value)


class TestHinglishIntelligence(unittest.TestCase):
    """Romanized Hindi / Hinglish scam detection tests covering all 7 categories."""

    def test_positive_hinglish_registration_fee(self) -> None:
        text = "Registration ke liye Rs 500 fees pay karo."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.REGISTRATION_FEE.value)
        self.assertTrue(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.UPFRONT_REGISTRATION_FEE.value, indicator_names)

    def test_negative_hinglish_registration_fee(self) -> None:
        text = "Registration ke liye koi paise nahi lagenge"
        res = classify_scam(text)
        self.assertFalse(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertNotIn(IndicatorCategory.UPFRONT_REGISTRATION_FEE.value, indicator_names)

    def test_positive_hinglish_task_deposit(self) -> None:
        text = "Task unlock karne ke liye deposit bhejo"
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.TASK_DEPOSIT.value)
        self.assertTrue(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.TASK_DEPOSIT.value, indicator_names)

    def test_negative_hinglish_task_deposit(self) -> None:
        text = "Task unlock karne ke liye koi deposit nahi lagega."
        res = classify_scam(text)
        self.assertFalse(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertNotIn(IndicatorCategory.TASK_DEPOSIT.value, indicator_names)

    def test_positive_hinglish_withdrawal_fee(self) -> None:
        text = "Paise nikalne ke liye pehle clearance fee pay karo."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.WITHDRAWAL_BLOCK.value)
        self.assertTrue(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.WITHDRAWAL_FEE.value, indicator_names)

    def test_negative_hinglish_withdrawal_fee(self) -> None:
        text = "Earnings nikalne ke liye koi withdrawal fee nahi lagegi."
        res = classify_scam(text)
        self.assertFalse(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertNotIn(IndicatorCategory.WITHDRAWAL_FEE.value, indicator_names)

    def test_positive_hinglish_unrealistic_earnings(self) -> None:
        text = "Daily 3000 se 8000 kamao by liking videos from home."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.JOB_OFFER.value)
        self.assertTrue(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.UNREALISTIC_EARNINGS.value, indicator_names)

    def test_negative_hinglish_unrealistic_earnings(self) -> None:
        text = "Aise kisi fake offer par vishwas na kare jo bina kaam ke lakho rupaye dene ka dawa kare."
        res = classify_scam(text)
        self.assertFalse(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertNotIn(IndicatorCategory.UNREALISTIC_EARNINGS.value, indicator_names)

    def test_positive_hinglish_urgency_pressure(self) -> None:
        text = "Sirf 2 slots left, 10 minutes me transfer karo warna offer cancel."
        res = classify_scam(text)
        self.assertTrue(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.URGENCY_PRESSURE.value, indicator_names)

    def test_negative_hinglish_urgency_pressure(self) -> None:
        text = "Offer accept karne ki koi jaldi nahi hai, aaram se soch kar bataye."
        res = classify_scam(text)
        self.assertFalse(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertNotIn(IndicatorCategory.URGENCY_PRESSURE.value, indicator_names)

    def test_positive_hinglish_sensitive_credentials(self) -> None:
        text = "Payroll activate karne ke liye apna OTP aur password share karo."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.JOB_OFFER.value)
        self.assertTrue(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.SENSITIVE_CREDENTIALS.value, indicator_names)

    def test_negative_hinglish_sensitive_credentials(self) -> None:
        text = "Apna OTP kisi ke saath share mat karo"
        res = classify_scam(text)
        self.assertFalse(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertNotIn(IndicatorCategory.SENSITIVE_CREDENTIALS.value, indicator_names)

    def test_positive_hinglish_advance_fee(self) -> None:
        text = "Office laptop ke liye ₹3,000 security deposit dena hoga."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.ADVANCE_FEE.value)
        self.assertTrue(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.ADVANCE_FEE.value, indicator_names)

    def test_negative_hinglish_advance_fee(self) -> None:
        text = "Equipment ke liye koi security deposit ya courier fee nahi lagegi."
        res = classify_scam(text)
        self.assertFalse(res.is_suspicious)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertNotIn(IndicatorCategory.ADVANCE_FEE.value, indicator_names)


class TestIndianCurrencyFormats(unittest.TestCase):
    """Test support for Indian currency formats across categories: ₹, Rs, Rs., INR, /- and k multiplier."""

    def test_currency_format_rupee_symbol(self) -> None:
        text = "Pay ₹500 registration fee to enroll"
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.REGISTRATION_FEE.value)

    def test_currency_format_rs_space(self) -> None:
        text = "Pay Rs 500 registration fee to enroll"
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.REGISTRATION_FEE.value)

    def test_currency_format_rs_dot(self) -> None:
        text = "Pay Rs. 500 registration fee to enroll"
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.REGISTRATION_FEE.value)

    def test_currency_format_inr(self) -> None:
        text = "Pay INR 500 registration fee to enroll"
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.REGISTRATION_FEE.value)

    def test_currency_format_slash_dash_suffix(self) -> None:
        text = "Registration ke liye 500/- deposit karo."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.REGISTRATION_FEE.value)

    def test_currency_format_5k_task_deposit(self) -> None:
        text = "Task unlock karne ke liye 5k deposit bhejo"
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.TASK_DEPOSIT.value)

    def test_currency_format_10k_vip_task(self) -> None:
        text = "VIP task unlock karne ke liye 10k recharge karo"
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.TASK_DEPOSIT.value)

    def test_currency_format_10k_daily_income(self) -> None:
        text = "10k daily income from home by liking youtube videos"
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.JOB_OFFER.value)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.UNREALISTIC_EARNINGS.value, indicator_names)


class TestMultilingualNegationAndClauses(unittest.TestCase):
    """Test sentence-aware and clause-aware negation in mixed and multilingual contexts."""

    def test_mixed_english_warning_hindi_task_deposit(self) -> None:
        text = "Beware of scammers! काम शुरू करने के लिए ₹500 जमा करें।"
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.TASK_DEPOSIT.value)
        self.assertTrue(res.is_suspicious)

    def test_mixed_english_no_reg_fee_hinglish_task_deposit(self) -> None:
        text = "We do not charge registration fees. Task unlock karne ke liye deposit bhejo."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.TASK_DEPOSIT.value)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.TASK_DEPOSIT.value, indicator_names)
        self.assertNotIn(IndicatorCategory.UPFRONT_REGISTRATION_FEE.value, indicator_names)

    def test_hinglish_contrast_clause_lekin_vip_deposit(self) -> None:
        text = "No joining fee is required, lekin VIP tasks ke liye ₹1,000 deposit mandatory hai."
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.TASK_DEPOSIT.value)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.TASK_DEPOSIT.value, indicator_names)

    def test_hindi_contrast_clause_lekin_kripya_otp(self) -> None:
        text = "हम कभी पासवर्ड नहीं मांगते, लेकिन कृपया अपना ओटीपी साझा करें।"
        res = classify_scam(text)
        self.assertEqual(res.scam_stage, ScamStage.JOB_OFFER.value)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.SENSITIVE_CREDENTIALS.value, indicator_names)


class TestRiskScoringAndClassification(unittest.TestCase):
    """Phase 4: Comprehensive Risk Scoring and Classification Tests."""

    def test_benign_job_ad_zero_risk_score_and_low_level(self) -> None:
        text = "We are hiring a Senior Python Engineer. Salary: ₹18-24 LPA with health insurance."
        res = classify_scam(text)
        self.assertEqual(res.risk_score, 0)
        self.assertEqual(res.risk_level, RiskLevel.LOW.value)
        self.assertEqual(res.scam_stage, ScamStage.UNKNOWN.value)
        self.assertFalse(res.is_suspicious)

    def test_empty_input_zero_risk_score(self) -> None:
        res = classify_scam("")
        self.assertEqual(res.risk_score, 0)
        self.assertEqual(res.risk_level, RiskLevel.LOW.value)
        self.assertIsInstance(res.risk_score, int)

    def test_urgency_pressure_alone_low_level(self) -> None:
        text = "Only 2 slots left, pay now to confirm."
        res = classify_scam(text)
        self.assertEqual(res.risk_score, 25)
        self.assertEqual(res.risk_level, RiskLevel.LOW.value)

    def test_unrealistic_earnings_alone_medium_level(self) -> None:
        text = "Earn ₹5,000 daily from home by liking YouTube videos."
        res = classify_scam(text)
        self.assertEqual(res.risk_score, 35)
        self.assertEqual(res.risk_level, RiskLevel.MEDIUM.value)

    def test_registration_fee_alone_medium_level(self) -> None:
        text = "Pay ₹500 registration fee to enroll for the job."
        res = classify_scam(text)
        self.assertEqual(res.risk_score, 55)
        self.assertEqual(res.risk_level, RiskLevel.MEDIUM.value)

    def test_task_deposit_alone_high_level(self) -> None:
        text = "Pay ₹2,000 to unlock your task earnings."
        res = classify_scam(text)
        self.assertEqual(res.risk_score, 70)
        self.assertEqual(res.risk_level, RiskLevel.HIGH.value)

    def test_task_deposit_plus_urgency_compounding_high_level(self) -> None:
        text = "Pay ₹2,000 to unlock your task earnings! Only 2 slots left, pay now to confirm."
        res = classify_scam(text)
        # Primary (70) + Secondary (25 * 0.6 = 15) = 85
        self.assertEqual(res.risk_score, 85)
        self.assertEqual(res.risk_level, RiskLevel.HIGH.value)

    def test_withdrawal_block_plus_urgency_critical_level(self) -> None:
        text = "Your wallet balance of ₹45,000 is frozen. Pay clearance fee of ₹2,500 within 10 minutes or offer expires."
        res = classify_scam(text)
        # Primary (75) + Secondary (25 * 0.6 = 15) = 90
        self.assertEqual(res.risk_score, 90)
        self.assertEqual(res.risk_level, RiskLevel.CRITICAL.value)

    def test_multi_vector_clamped_at_100(self) -> None:
        text = (
            "Earn ₹5,000 daily by liking YouTube videos! "
            "Pay ₹2,000 to unlock your task earnings. "
            "Also share the OTP sent to your phone. "
            "Act within 10 minutes or lose your account."
        )
        res = classify_scam(text)
        self.assertEqual(res.risk_score, 100)
        self.assertEqual(res.risk_level, RiskLevel.CRITICAL.value)
        self.assertLessEqual(res.risk_score, 100)

    def test_anti_inflation_on_duplicate_indicators(self) -> None:
        # Repeating the same indicator multiple times must not inflate score
        text = (
            "Pay ₹500 registration fee to enroll. "
            "Pay INR 500 registration fee before starting. "
            "Pay ₹500 joining fee is mandatory."
        )
        res = classify_scam(text)
        # Unique category is solely UPFRONT_REGISTRATION_FEE (base 55)
        self.assertEqual(res.risk_score, 55)
        self.assertEqual(res.risk_level, RiskLevel.MEDIUM.value)

    def test_explainable_evidence_structure(self) -> None:
        text = "Pay ₹2,000 to unlock your task earnings."
        res = classify_scam(text)
        api_dict = res.to_api_dict()
        self.assertIn("scam_stage", api_dict)
        self.assertIn("risk_score", api_dict)
        self.assertIn("risk_level", api_dict)
        self.assertIn("indicators", api_dict)
        self.assertIn("evidence", api_dict)
        self.assertIn("explanations", api_dict)
        self.assertTrue(len(api_dict["evidence"]) > 0)
        self.assertTrue(len(api_dict["explanations"]) > 0)
        self.assertEqual(api_dict["risk_score"], 70)
        self.assertEqual(api_dict["risk_level"], "HIGH")


class TestAuditRegressionFixes(unittest.TestCase):
    """Regression tests for independent code audit findings.

    Covers:
    - 3 false positives (must not trigger indicators)
    - 5 false negatives (correctly mapped to existing categories)
    - Evidence extraction precision (not using negation warnings as evidence)
    """

    # 1. False Positives
    def test_fp_wallet_blocked_do_not_pay_fee(self) -> None:
        """'Your wallet is blocked. Do not pay any fee.' must not trigger scam indicators."""
        text = "Your wallet is blocked. Do not pay any fee."
        res = classify_scam(text)
        self.assertFalse(res.is_suspicious)
        self.assertEqual(res.scam_stage, ScamStage.UNKNOWN.value)
        self.assertEqual(res.indicators, [])
        self.assertEqual(res.risk_score, 0)
        self.assertEqual(res.risk_level, RiskLevel.LOW.value)

    def test_fp_task_deposits_common_scam_tactic_never_pay(self) -> None:
        """'Task deposits are a common scam tactic. Never pay one.' must not trigger scam indicators."""
        text = "Task deposits are a common scam tactic. Never pay one."
        res = classify_scam(text)
        self.assertFalse(res.is_suspicious)
        self.assertEqual(res.scam_stage, ScamStage.UNKNOWN.value)
        self.assertEqual(res.indicators, [])
        self.assertEqual(res.risk_score, 0)
        self.assertEqual(res.risk_level, RiskLevel.LOW.value)

    def test_fp_task_deposit_scams_target_job_seekers(self) -> None:
        """'Task deposit scams target job seekers.' must not trigger scam indicators."""
        text = "Task deposit scams target job seekers."
        res = classify_scam(text)
        self.assertFalse(res.is_suspicious)
        self.assertEqual(res.scam_stage, ScamStage.UNKNOWN.value)
        self.assertEqual(res.indicators, [])
        self.assertEqual(res.risk_score, 0)
        self.assertEqual(res.risk_level, RiskLevel.LOW.value)

    # 2. False Negatives
    def test_fn_to_withdraw_balance_clearance_fee_required(self) -> None:
        """'To withdraw your balance, a clearance fee is required.' maps to withdrawal_fee."""
        text = "To withdraw your balance, a clearance fee is required."
        res = classify_scam(text)
        self.assertTrue(res.is_suspicious)
        self.assertEqual(res.scam_stage, ScamStage.WITHDRAWAL_BLOCK.value)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.WITHDRAWAL_FEE.value, indicator_names)
        self.assertTrue(any("clearance fee is required" in ev.lower() for ev in res.indicators[0].evidence))

    def test_fn_pay_to_unlock_account(self) -> None:
        """'Pay ₹500 to unlock your account.' maps to task_deposit."""
        text = "Pay ₹500 to unlock your account."
        res = classify_scam(text)
        self.assertTrue(res.is_suspicious)
        self.assertEqual(res.scam_stage, ScamStage.TASK_DEPOSIT.value)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.TASK_DEPOSIT.value, indicator_names)

    def test_fn_pay_for_job_interview_slot(self) -> None:
        """'Pay ₹500 for a job interview slot.' maps to upfront_registration_fee."""
        text = "Pay ₹500 for a job interview slot."
        res = classify_scam(text)
        self.assertTrue(res.is_suspicious)
        self.assertEqual(res.scam_stage, ScamStage.REGISTRATION_FEE.value)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.UPFRONT_REGISTRATION_FEE.value, indicator_names)

    def test_fn_send_refundable_security_deposit_before_joining(self) -> None:
        """'Send ₹500 as a refundable security deposit before joining.' maps to advance_fee."""
        text = "Send ₹500 as a refundable security deposit before joining."
        res = classify_scam(text)
        self.assertTrue(res.is_suspicious)
        self.assertEqual(res.scam_stage, ScamStage.ADVANCE_FEE.value)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.ADVANCE_FEE.value, indicator_names)

    def test_fn_pay_courier_charges_in_advance(self) -> None:
        """'Pay courier charges in advance.' maps to advance_fee."""
        text = "Pay courier charges in advance."
        res = classify_scam(text)
        self.assertTrue(res.is_suspicious)
        self.assertEqual(res.scam_stage, ScamStage.ADVANCE_FEE.value)
        indicator_names = [ind.indicator for ind in res.indicators]
        self.assertIn(IndicatorCategory.ADVANCE_FEE.value, indicator_names)

    # 3. Evidence Extraction Precision
    def test_evidence_extraction_isolates_actual_demand_from_warnings(self) -> None:
        """'Your wallet is blocked. Do not pay any fee. Pay ₹500 to release your balance.'

        Evidence must identify the actual payment demand ('Pay ₹500 to release your balance')
        and must not incorrectly use 'Do not pay any fee' as supporting evidence.
        """
        text = "Your wallet is blocked. Do not pay any fee. Pay ₹500 to release your balance."
        res = classify_scam(text)
        self.assertTrue(res.is_suspicious)
        self.assertEqual(res.scam_stage, ScamStage.WITHDRAWAL_BLOCK.value)

        api_dict = res.to_api_dict()
        evidence_list = api_dict["evidence"]

        # Must contain the actual payment demand
        self.assertTrue(any("Pay ₹500 to release your balance" in ev for ev in evidence_list))

        # Must NOT include the negative warning sentence
        for ev in evidence_list:
            self.assertNotIn("Do not pay any fee", ev)
            self.assertNotIn("Your wallet is blocked", ev)


class TestRequiredDetectionRegressions(unittest.TestCase):
    """End-to-end regressions for representative common job-scam wording."""

    def test_one_time_registration_and_profile_verification_fee(self) -> None:
        cases = (
            "Before joining, candidates are required to pay Rs. 1,000 as a one-time registration and profile verification fee.",
            "Pay INR 2,500 as a one-time onboarding and profile verification fee.",
            "Submit ₹1,000 as a one-time joining fee.",
        )
        for text in cases:
            with self.subTest(text=text):
                self.assertIn(
                    IndicatorCategory.UPFRONT_REGISTRATION_FEE.value,
                    [item.indicator for item in evaluate_rules(text)],
                )
                result = classify_scam(text)
                self.assertEqual(result.scam_stage, ScamStage.REGISTRATION_FEE.value)
                self.assertEqual(result.risk_score, 55)
                self.assertEqual(result.risk_level, RiskLevel.MEDIUM.value)

    def test_free_or_not_required_profile_verification_does_not_trigger_fee(self) -> None:
        for text in (
            "No registration fee is required before joining.",
            "Profile verification is free for all applicants.",
            "Free profile verification and no onboarding fee are required.",
        ):
            with self.subTest(text=text):
                self.assertNotIn(
                    IndicatorCategory.UPFRONT_REGISTRATION_FEE.value,
                    [item.indicator for item in evaluate_rules(text)],
                )

    def test_each_required_indicator_is_detected_by_rules_and_classifier(self) -> None:
        cases = (
            ("Before joining, pay Rs. 2,000 to get this work-from-home job.", IndicatorCategory.UPFRONT_REGISTRATION_FEE.value, ScamStage.REGISTRATION_FEE.value, 55),
            ("Recharge ₹1,000 for the next VIP task.", IndicatorCategory.TASK_DEPOSIT.value, ScamStage.TASK_DEPOSIT.value, 70),
            ("Pay Rs. 7,500 to release your blocked wallet earnings.", IndicatorCategory.WITHDRAWAL_FEE.value, ScamStage.WITHDRAWAL_BLOCK.value, 75),
            ("Earn ₹10,000 daily by liking videos online.", IndicatorCategory.UNREALISTIC_EARNINGS.value, ScamStage.JOB_OFFER.value, 35),
            ("Transfer within 10 minutes or your offer will expire.", IndicatorCategory.URGENCY_PRESSURE.value, ScamStage.JOB_OFFER.value, 25),
            ("Please share your OTP and UPI PIN.", IndicatorCategory.SENSITIVE_CREDENTIALS.value, ScamStage.JOB_OFFER.value, 65),
            ("Send a security deposit for the laptop before joining.", IndicatorCategory.ADVANCE_FEE.value, ScamStage.ADVANCE_FEE.value, 50),
        )
        for text, indicator, stage, score in cases:
            with self.subTest(indicator=indicator):
                self.assertIn(indicator, [item.indicator for item in evaluate_rules(text)])
                result = classify_scam(text)
                self.assertEqual(result.scam_stage, stage)
                self.assertEqual(result.risk_score, score)

    def test_negated_or_benign_examples_do_not_trigger_their_indicator(self) -> None:
        cases = (
            ("No registration fee is required before starting work.", IndicatorCategory.UPFRONT_REGISTRATION_FEE.value),
            ("VIP tasks do not require a recharge or deposit.", IndicatorCategory.TASK_DEPOSIT.value),
            ("A clearance fee is not required to withdraw your balance.", IndicatorCategory.WITHDRAWAL_FEE.value),
            ("Earn a market-rate salary for software engineering work.", IndicatorCategory.UNREALISTIC_EARNINGS.value),
            ("You may review the offer tomorrow; no payment is required.", IndicatorCategory.URGENCY_PRESSURE.value),
            ("Never share your OTP, UPI PIN, CVV, or banking password.", IndicatorCategory.SENSITIVE_CREDENTIALS.value),
            ("No security deposit or courier fee is required for the laptop.", IndicatorCategory.ADVANCE_FEE.value),
        )
        for text, indicator in cases:
            with self.subTest(indicator=indicator):
                self.assertNotIn(indicator, [item.indicator for item in evaluate_rules(text)])
                self.assertNotIn(indicator, [item.indicator for item in classify_scam(text).indicators])

    def test_new_urgency_wording_compounds_without_changing_weights(self) -> None:
        result = classify_scam(
            "Before joining, pay Rs. 2,000 to get this work-from-home job. "
            "Transfer within 10 minutes or your offer will expire."
        )
        self.assertEqual(
            {item.indicator for item in result.indicators},
            {IndicatorCategory.UPFRONT_REGISTRATION_FEE.value, IndicatorCategory.URGENCY_PRESSURE.value},
        )
        self.assertEqual(result.risk_score, 70)  # 55 + floor(25 * 0.6)


if __name__ == "__main__":
    unittest.main()
