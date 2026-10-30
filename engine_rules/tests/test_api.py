"""Comprehensive API Integration Tests for Scam Intelligence FastAPI Endpoints."""

from __future__ import annotations

import os
import sys
import unittest
from fastapi.testclient import TestClient

# Ensure workspace root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.main import app


class TestScamIntelligenceApi(unittest.TestCase):
    """End-to-end integration tests for FastAPI intelligence routes."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    def test_root_and_health_endpoints(self) -> None:
        """Verify service health and root metadata routes."""
        res_root = self.client.get("/")
        self.assertEqual(res_root.status_code, 200)
        self.assertIn("CrediHire", res_root.json()["name"])

        res_health = self.client.get("/health")
        self.assertEqual(res_health.status_code, 200)
        self.assertEqual(res_health.json()["status"], "healthy")

        res_api_health = self.client.get("/api/intelligence/health")
        self.assertEqual(res_api_health.status_code, 200)
        self.assertEqual(res_api_health.json()["status"], "healthy")

    def test_analyze_valid_suspicious_english_task_deposit(self) -> None:
        """Verify suspicious English message triggers task_deposit with HIGH risk."""
        payload = {"text": "Pay ₹2,000 to unlock your task earnings."}
        res = self.client.post("/api/intelligence/analyze", json=payload)

        self.assertEqual(res.status_code, 200)
        data = res.json()

        self.assertEqual(data["scam_stage"], "task_deposit")
        self.assertEqual(data["risk_score"], 70)
        self.assertEqual(data["risk_level"], "HIGH")
        self.assertIn("task_deposit", data["indicators"])
        self.assertTrue(any("Pay ₹2,000 to unlock your task earnings" in ev for ev in data["evidence"]))
        self.assertTrue(len(data["explanations"]) > 0)

    def test_analyze_valid_suspicious_hindi_task_deposit(self) -> None:
        """Verify Devanagari Hindi message correctly flags task_deposit."""
        payload = {"text": "काम शुरू करने के लिए ₹500 जमा करें"}
        res = self.client.post("/api/intelligence/analyze", json=payload)

        self.assertEqual(res.status_code, 200)
        data = res.json()

        self.assertEqual(data["scam_stage"], "task_deposit")
        self.assertEqual(data["risk_level"], "HIGH")
        self.assertIn("task_deposit", data["indicators"])

    def test_analyze_valid_suspicious_hinglish_withdrawal_fee(self) -> None:
        """Verify Hinglish withdrawal exit trap message flags withdrawal_block."""
        payload = {"text": "Paise nikalne ke liye pehle clearance fee pay karo."}
        res = self.client.post("/api/intelligence/analyze", json=payload)

        self.assertEqual(res.status_code, 200)
        data = res.json()

        self.assertEqual(data["scam_stage"], "withdrawal_block")
        self.assertEqual(data["risk_level"], "HIGH")
        self.assertIn("withdrawal_fee", data["indicators"])

    def test_analyze_legitimate_job_ad_zero_risk(self) -> None:
        """Verify clean corporate job ad yields score 0, LOW risk, and unknown stage."""
        payload = {
            "text": "We are hiring a Senior Python Engineer. Salary: ₹18-24 LPA with health insurance. Send CV to hr@example.com."
        }
        res = self.client.post("/api/intelligence/analyze", json=payload)

        self.assertEqual(res.status_code, 200)
        data = res.json()

        self.assertEqual(data["scam_stage"], "unknown")
        self.assertEqual(data["risk_score"], 0)
        self.assertEqual(data["risk_level"], "LOW")
        self.assertEqual(data["indicators"], [])
        self.assertEqual(data["evidence"], [])
        self.assertEqual(data["explanations"], [])

    def test_analyze_negated_security_warning_zero_risk(self) -> None:
        """Verify legitimate security warning is not falsely flagged."""
        payload = {"text": "Warning: We never ask candidates for any registration fee or OTP."}
        res = self.client.post("/api/intelligence/analyze", json=payload)

        self.assertEqual(res.status_code, 200)
        data = res.json()

        self.assertEqual(data["scam_stage"], "unknown")
        self.assertEqual(data["risk_score"], 0)
        self.assertEqual(data["risk_level"], "LOW")

    def test_analyze_empty_string_returns_400(self) -> None:
        """Verify empty input string is rejected with 400 Bad Request."""
        payload = {"text": ""}
        res = self.client.post("/api/intelligence/analyze", json=payload)
        self.assertEqual(res.status_code, 400)
        self.assertIn("cannot be empty", res.json()["detail"])

    def test_analyze_whitespace_only_returns_400(self) -> None:
        """Verify whitespace-only input is rejected with 400 Bad Request."""
        payload = {"text": "   \n\t  "}
        res = self.client.post("/api/intelligence/analyze", json=payload)
        self.assertEqual(res.status_code, 400)
        self.assertIn("cannot be empty", res.json()["detail"])

    def test_analyze_missing_text_field_returns_422(self) -> None:
        """Verify missing payload fields trigger Pydantic 422 Unprocessable Entity."""
        res = self.client.post("/api/intelligence/analyze", json={})
        self.assertEqual(res.status_code, 422)

    def test_analyze_invalid_type_returns_422(self) -> None:
        """Verify non-string payload values trigger 422."""
        res = self.client.post("/api/intelligence/analyze", json={"text": None})
        self.assertEqual(res.status_code, 422)

    def test_cors_headers_present(self) -> None:
        """Verify CORS headers are properly returned for cross-origin integration."""
        headers = {
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
        }
        res = self.client.options("/api/intelligence/analyze", headers=headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers.get("access-control-allow-origin"), "http://localhost:3000")
        self.assertEqual(res.headers.get("access-control-allow-credentials"), "true")

    def test_cors_unrelated_origin_rejected(self) -> None:
        """Verify unrelated external origins do not receive CORS allow headers."""
        headers = {
            "Origin": "http://unauthorized-attacker.example.com",
            "Access-Control-Request-Method": "POST",
        }
        # Preflight options for untrusted origin
        res_options = self.client.options("/api/intelligence/analyze", headers=headers)
        self.assertNotEqual(res_options.headers.get("access-control-allow-origin"), "http://unauthorized-attacker.example.com")

        # Direct post from untrusted origin
        res_post = self.client.post(
            "/api/intelligence/analyze",
            json={"text": "Pay ₹500 to unlock your account."},
            headers={"Origin": "http://unauthorized-attacker.example.com"},
        )
        self.assertEqual(res_post.status_code, 200)
        self.assertNotIn("access-control-allow-origin", res_post.headers)

    def test_cors_credentials_behavior(self) -> None:
        """Verify CORS credentials are supported for configured origins and not with wildcard."""
        res = self.client.post(
            "/api/intelligence/analyze",
            json={"text": "Pay ₹500 to unlock your account."},
            headers={"Origin": "http://localhost:5173"},
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers.get("access-control-allow-origin"), "http://localhost:5173")
        self.assertEqual(res.headers.get("access-control-allow-credentials"), "true")

    def test_internal_exception_returns_clean_500_without_stack_trace(self) -> None:
        """Confirm that unhandled internal exceptions return a clean 500 without leaking stack traces."""
        from unittest.mock import patch

        sensitive_error_message = "CRITICAL_INTERNAL_DATABASE_AUTH_FAILURE_XYZ_987"
        with patch("backend.api.router.classify_scam", side_effect=RuntimeError(sensitive_error_message)):
            res = self.client.post(
                "/api/intelligence/analyze",
                json={"text": "Pay ₹500 to unlock your account."},
            )
            self.assertEqual(res.status_code, 500)
            data = res.json()
            self.assertIn("detail", data)
            self.assertEqual(data["detail"], "An error occurred while processing the intelligence analysis request.")

            # Ensure internal exception details and traces are completely shielded
            self.assertNotIn(sensitive_error_message, res.text)
            self.assertNotIn("Traceback", res.text)
            self.assertNotIn("classify_scam", res.text)

    def test_compound_multi_indicator_critical_risk(self) -> None:
        """Verify compound multi-vector scam is rated CRITICAL."""
        payload = {
            "text": (
                "Earn ₹5,000 daily by liking YouTube videos! "
                "Pay ₹2,000 to unlock your task earnings. "
                "Also share the OTP sent to your phone. "
                "Act within 10 minutes or lose your account."
            )
        }
        res = self.client.post("/api/intelligence/analyze", json=payload)

        self.assertEqual(res.status_code, 200)
        data = res.json()

        self.assertEqual(data["scam_stage"], "task_deposit")
        self.assertEqual(data["risk_score"], 100)
        self.assertEqual(data["risk_level"], "CRITICAL")
        self.assertGreaterEqual(len(data["indicators"]), 3)


if __name__ == "__main__":
    unittest.main()
