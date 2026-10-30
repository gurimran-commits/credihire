from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
import httpx

from app.main import create_app
from app.schemas.url import UrlAnalysisRequest, UrlAnalysisResponse
from app.services.url_credibility import (
    UrlCredibilityService,
    is_ip_restricted,
    resolve_and_check_ips,
    SSRFValidationError,
)


@pytest.fixture
def client():
    return TestClient(create_app())


@pytest.fixture
def service():
    return UrlCredibilityService()


# ---------------------------------------------------------------------------
# SSRF Protection Tests
# ---------------------------------------------------------------------------

def test_is_ip_restricted():
    # Loopback
    assert is_ip_restricted("127.0.0.1")
    assert is_ip_restricted("127.255.255.255")
    assert is_ip_restricted("::1")

    # Private ranges (RFC 1918)
    assert is_ip_restricted("10.0.0.1")
    assert is_ip_restricted("10.255.255.255")
    assert is_ip_restricted("172.16.0.1")
    assert is_ip_restricted("172.31.255.255")
    assert is_ip_restricted("192.168.0.1")
    assert is_ip_restricted("192.168.1.100")

    # Link-local / Cloud metadata
    assert is_ip_restricted("169.254.169.254")
    assert is_ip_restricted("169.254.1.1")
    assert is_ip_restricted("fe80::1")

    # Carrier-grade NAT
    assert is_ip_restricted("100.64.0.1")
    assert is_ip_restricted("100.127.255.254")

    # Unspecified / multicast
    assert is_ip_restricted("0.0.0.0")
    assert is_ip_restricted("224.0.0.1")

    # IPv4-mapped IPv6
    assert is_ip_restricted("::ffff:127.0.0.1")
    assert is_ip_restricted("::ffff:169.254.169.254")
    assert is_ip_restricted("::ffff:192.168.1.1")

    # Public IP should not be restricted
    assert not is_ip_restricted("8.8.8.8")
    assert not is_ip_restricted("1.1.1.1")
    assert not is_ip_restricted("93.184.216.34")


def test_resolve_and_check_ips_detects_restricted_ips():
    with pytest.raises(SSRFValidationError):
        resolve_and_check_ips("127.0.0.1")

    with pytest.raises(SSRFValidationError):
        resolve_and_check_ips("169.254.169.254")

    with pytest.raises(SSRFValidationError):
        resolve_and_check_ips("192.168.1.1")

    with pytest.raises(SSRFValidationError):
        resolve_and_check_ips("localhost")


# ---------------------------------------------------------------------------
# URL Syntax Validation Tests
# ---------------------------------------------------------------------------

def test_validate_syntax_normalizes_and_accepts_clean_urls(service):
    scheme, host, port = service.validate_syntax("https://careers.google.com")
    assert scheme == "https"
    assert host == "careers.google.com"
    assert port == 443

    # Auto-prepend https
    scheme, host, port = service.validate_syntax("example.com/jobs")
    assert scheme == "https"
    assert host == "example.com"
    assert port == 443


def test_validate_syntax_rejects_disallowed_schemes(service):
    with pytest.raises(ValueError, match="Only http:// and https://"):
        service.validate_syntax("ftp://files.example.com/offer.pdf")

    with pytest.raises(ValueError, match="Only http:// and https://"):
        service.validate_syntax("file:///etc/passwd")

    with pytest.raises(ValueError, match="Only http:// and https://"):
        service.validate_syntax("javascript:alert(1)")


def test_validate_syntax_rejects_disallowed_ports(service):
    with pytest.raises(ValueError, match="Port 8080 is not allowed"):
        service.validate_syntax("https://example.com:8080/portal")

    with pytest.raises(ValueError, match="Port 22 is not allowed"):
        service.validate_syntax("http://example.com:22/")


def test_validate_syntax_rejects_credentials(service):
    with pytest.raises(ValueError, match="embedded credentials"):
        service.validate_syntax("https://user:password@example.com/apply")


# ---------------------------------------------------------------------------
# Deterministic Heuristic Tests
# ---------------------------------------------------------------------------

def test_raw_ip_hostname_indicator(service):
    indicators = service.analyze_heuristics("http", "198.51.100.1")
    codes = [ind.code for ind in indicators]
    assert "ip_hostname" in codes
    assert "insecure_transport_http" in codes


def test_url_shortener_indicator(service):
    indicators = service.analyze_heuristics("https", "bit.ly")
    assert any(ind.code == "url_shortener" for ind in indicators)

    indicators_tiny = service.analyze_heuristics("https", "tinyurl.com")
    assert any(ind.code == "url_shortener" for ind in indicators_tiny)


def test_punycode_domain_indicator(service):
    indicators = service.analyze_heuristics("https", "xn--pple-43d.com")
    assert any(ind.code == "punycode_domain" for ind in indicators)


def test_suspicious_tld_indicator(service):
    indicators = service.analyze_heuristics("https", "jobs-portal.xyz")
    assert any(ind.code == "suspicious_tld" for ind in indicators)


def test_brand_impersonation_detection(service):
    # Spoofed recruitment domain
    indicators = service.analyze_heuristics("https", "amazon-jobs-recruitment.xyz")
    codes = [ind.code for ind in indicators]
    assert "brand_impersonation" in codes
    assert "suspicious_tld" in codes

    # Another brand spoof
    indicators_google = service.analyze_heuristics("https", "google-careers-portal.com")
    assert any(ind.code == "brand_impersonation" for ind in indicators_google)

    # Official domain should NOT trigger brand_impersonation
    indicators_official = service.analyze_heuristics("https", "careers.google.com")
    assert not any(ind.code == "brand_impersonation" for ind in indicators_official)

    indicators_amazon_official = service.analyze_heuristics("https", "amazon.jobs")
    assert not any(ind.code == "brand_impersonation" for ind in indicators_amazon_official)


# ---------------------------------------------------------------------------
# Redirect Tracing Tests with Mock Transport
# ---------------------------------------------------------------------------

def safe_test_ip_resolver(hostname: str) -> list[str]:
    # Custom test resolver: blocks 169.254.169.254 / 127.0.0.1 / private IPs, passes others
    if hostname in ("127.0.0.1", "169.254.169.254", "localhost"):
        raise SSRFValidationError(f"Restricted host: {hostname}")
    return ["93.184.216.34"]


@pytest.mark.asyncio
async def test_trace_redirects_safely_follows_legitimate_redirects():
    def handler(request: httpx.Request) -> httpx.Response:
        if str(request.url) == "https://legit.example.com/apply":
            return httpx.Response(301, headers={"Location": "https://legit.example.com/careers/apply"})
        if str(request.url) == "https://legit.example.com/careers/apply":
            return httpx.Response(200)
        return httpx.Response(404)

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    service = UrlCredibilityService(http_client=mock_client, ip_resolver=safe_test_ip_resolver)

    final_url, chain, indicators = await service.trace_redirects_safely("https://legit.example.com/apply")
    assert final_url == "https://legit.example.com/careers/apply"
    assert len(chain) == 2
    assert chain[0].status_code == 301
    assert chain[1].status_code == 200
    assert not any(ind.code == "cross_domain_redirect" for ind in indicators)


@pytest.mark.asyncio
async def test_trace_redirects_detects_cross_domain_redirect():
    def handler(request: httpx.Request) -> httpx.Response:
        if "site-a.com" in str(request.url):
            return httpx.Response(302, headers={"Location": "https://site-b.org/login"})
        return httpx.Response(200)

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    service = UrlCredibilityService(http_client=mock_client, ip_resolver=safe_test_ip_resolver)

    final_url, chain, indicators = await service.trace_redirects_safely("https://site-a.com/portal")
    assert final_url == "https://site-b.org/login"
    assert any(ind.code == "cross_domain_redirect" for ind in indicators)


@pytest.mark.asyncio
async def test_trace_redirects_blocks_redirect_to_private_ip():
    def handler(request: httpx.Request) -> httpx.Response:
        # Malicious redirect pointing to internal metadata service
        return httpx.Response(302, headers={"Location": "http://169.254.169.254/latest/meta-data"})

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    service = UrlCredibilityService(http_client=mock_client, ip_resolver=safe_test_ip_resolver)

    final_url, chain, indicators = await service.trace_redirects_safely("https://malicious.example.com/test")
    # Hop 2 should be blocked before requesting
    assert any(ind.code == "ssrf_blocked_redirect" for ind in indicators)


# ---------------------------------------------------------------------------
# API Endpoint Integration Tests
# ---------------------------------------------------------------------------

def test_api_url_analyze_valid_safe_url(client):
    response = client.post("/api/v1/url/analyze", json={"url": "https://careers.google.com"})
    assert response.status_code == 200
    data = response.json()
    assert data["target_url"].startswith("https://careers.google.com")
    assert data["risk_level"] in ("safe", "low")
    assert data["reputation_status"] == "not_checked"
    assert "disclaimer" in data
    assert isinstance(data["recommendations"], list)


def test_api_url_analyze_suspicious_brand_lookalike(client):
    response = client.post("/api/v1/url/analyze", json={"url": "http://amazon-recruitment-portal.xyz/apply"})
    assert response.status_code == 200
    data = response.json()
    assert data["risk_score"] >= 50
    assert data["risk_level"] in ("medium", "high", "critical")
    codes = [ind["code"] for ind in data["indicators"]]
    assert "brand_impersonation" in codes
    assert "suspicious_tld" in codes
    assert "insecure_transport_http" in codes


def test_api_url_analyze_rejects_invalid_url(client):
    response = client.post("/api/v1/url/analyze", json={"url": "ftp://example.com/jobs"})
    assert response.status_code == 422
    assert "Only http:// and https://" in response.json()["detail"]


def test_api_url_analyze_rejects_empty_payload(client):
    response = client.post("/api/v1/url/analyze", json={"url": ""})
    assert response.status_code == 422


def test_api_url_analyze_blocks_private_ip(client):
    response = client.post("/api/v1/url/analyze", json={"url": "http://127.0.0.1:80/admin"})
    assert response.status_code == 200
    data = response.json()
    assert data["risk_level"] in ("high", "critical")
    assert any(ind["code"] == "ssrf_restricted_host" for ind in data["indicators"])
