"""Deterministic URL Credibility and Safety Analysis Service with SSRF Protection."""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from datetime import datetime, timezone
import ipaddress
import logging
import re
import socket
import ssl
from urllib.parse import urlparse, urljoin
from uuid import uuid4

import httpx

from app.schemas.url import (
    RedirectHop,
    SslCertificateInfo,
    UrlAnalysisRequest,
    UrlAnalysisResponse,
    UrlIndicator,
)

logger = logging.getLogger("credihire.url_credibility")

# Standard web ports allowed for external analysis
ALLOWED_PORTS = {80, 443}
MAX_REDIRECTS = 5
SOCKET_TIMEOUT = 3.0

KNOWN_SHORTENERS = {
    "bit.ly", "tinyurl.com", "t.co", "cutt.ly", "is.gd", "rb.gy", "ow.ly",
    "rebrand.ly", "buff.ly", "shorturl.at", "tiny.cc", "goo.gl", "lnkd.in",
    "tr.ee", "page.link", "linktr.ee"
}

SUSPICIOUS_TLDS = {
    "xyz", "top", "work", "click", "buzz", "fit", "rest", "tk", "ml", "ga",
    "cf", "gq", "gdn", "monster", "quest", "surf", "casa", "beauty", "hair",
    "cfd", "sbs", "mom", "live", "link"
}

POPULAR_BRANDS = {
    "google": ["google.com", "google.co.in", "careers.google.com"],
    "amazon": ["amazon.jobs", "amazon.com", "amazon.in"],
    "microsoft": ["microsoft.com", "careers.microsoft.com"],
    "apple": ["apple.com", "jobs.apple.com"],
    "netflix": ["netflix.com", "jobs.netflix.com"],
    "meta": ["meta.com", "metacareers.com"],
    "linkedin": ["linkedin.com"],
    "indeed": ["indeed.com", "indeed.co.in"],
    "glassdoor": ["glassdoor.com", "glassdoor.co.in"],
    "workday": ["workday.com", "myworkdayjobs.com"],
    "greenhouse": ["greenhouse.io", "boards.greenhouse.io"],
    "lever": ["lever.co", "jobs.lever.co"],
    "upwork": ["upwork.com"],
    "fiverr": ["fiverr.com"],
    "tcs": ["tcs.com", "careers.tcs.com"],
    "infosys": ["infosys.com", "careers.infosys.com"],
    "wipro": ["wipro.com", "careers.wipro.com"],
    "accenture": ["accenture.com"],
    "telegram": ["t.me", "telegram.org"],
    "whatsapp": ["whatsapp.com", "wa.me"],
}

RECRUITMENT_KEYWORDS = {
    "job", "jobs", "career", "careers", "recruitment", "recruiting", "hire",
    "hiring", "apply", "hr", "payroll", "interview", "portal", "vacancies"
}


class SSRFValidationError(ValueError):
    """Raised when an address resolves to a private or restricted network."""
    pass


def is_ip_restricted(ip_str: str) -> bool:
    """Validate whether an IP address belongs to private, loopback, link-local, or restricted space."""
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return True

    # Check for IPv4-mapped IPv6 (::ffff:x.x.x.x)
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        ip = ip.ipv4_mapped

    if (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    ):
        return True

    # Carrier-grade NAT (100.64.0.0/10)
    if isinstance(ip, ipaddress.IPv4Address) and ip in ipaddress.ip_network("100.64.0.0/10"):
        return True

    # AWS/GCP/Azure link-local metadata address
    if str(ip) == "169.254.169.254":
        return True

    return False


def resolve_and_check_ips(hostname: str) -> list[str]:
    """Resolve hostname and ensure NONE of its resolved IPs are private/restricted."""
    # Check if hostname itself is a raw IP
    try:
        ip = ipaddress.ip_address(hostname)
        if is_ip_restricted(str(ip)):
            raise SSRFValidationError(f"Target IP {hostname} is in a restricted network range.")
        return [str(ip)]
    except ValueError:
        pass

    try:
        addr_info = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise ValueError(f"Unable to resolve domain {hostname}") from exc

    resolved_ips = []
    for family, _, _, _, sockaddr in addr_info:
        ip_addr = sockaddr[0]
        if is_ip_restricted(ip_addr):
            raise SSRFValidationError(f"Domain {hostname} resolves to restricted IP {ip_addr}")
        resolved_ips.append(ip_addr)

    if not resolved_ips:
        raise ValueError(f"No IP addresses found for {hostname}")

    return resolved_ips


class UrlCredibilityService:
    """Evaluates URLs for deceptive patterns, transport safety, and redirect safety."""

    def __init__(
        self,
        http_client: httpx.AsyncClient | None = None,
        ip_resolver: Callable[[str], list[str]] | None = None,
    ) -> None:
        self.http_client = http_client
        self.ip_resolver = ip_resolver or resolve_and_check_ips

    def validate_syntax(self, raw_url: str) -> tuple[str, str, int]:
        """Normalize URL, validate scheme/ports and return (scheme, hostname, port)."""
        trimmed = raw_url.strip()

        # Check for explicit non-http/https schemes (e.g., javascript:, file:, ftp:)
        colon_idx = trimmed.find(":")
        slash_idx = trimmed.find("/")
        if colon_idx != -1 and (slash_idx == -1 or colon_idx < slash_idx):
            potential_scheme = trimmed[:colon_idx].lower()
            if potential_scheme not in ("http", "https"):
                raise ValueError("Only http:// and https:// URLs are supported.")

        if "://" not in trimmed:
            trimmed = "https://" + trimmed

        parsed = urlparse(trimmed)
        scheme = parsed.scheme.lower()
        if scheme not in ("http", "https"):
            raise ValueError("Only http:// and https:// URLs are supported.")

        if not parsed.hostname:
            raise ValueError("URL must contain a valid domain or hostname.")

        hostname = parsed.hostname.lower()
        try:
            port = parsed.port or (443 if scheme == "https" else 80)
        except ValueError as exc:
            raise ValueError(f"Invalid port in URL: {exc}") from exc

        if port not in ALLOWED_PORTS:
            raise ValueError(f"Port {port} is not allowed. Only standard web ports (80, 443) are accepted.")

        if parsed.username or parsed.password:
            raise ValueError("URLs containing embedded credentials are not permitted.")

        return scheme, hostname, port

    def analyze_heuristics(self, scheme: str, hostname: str, parsed_path: str = "") -> list[UrlIndicator]:
        """Inspect deterministic structural cues, homoglyphs, brand lookalikes, and shorteners."""
        indicators: list[UrlIndicator] = []

        # 1. IP-based host check
        is_raw_ip = False
        try:
            ipaddress.ip_address(hostname)
            is_raw_ip = True
            indicators.append(
                UrlIndicator(
                    code="ip_hostname",
                    severity="high",
                    category="network",
                    message="The URL uses a raw IP address instead of a recognized domain name.",
                )
            )
        except ValueError:
            pass

        # 2. Scheme / HTTPS check
        if scheme == "http":
            indicators.append(
                UrlIndicator(
                    code="insecure_transport_http",
                    severity="medium",
                    category="transport",
                    message="The URL uses unencrypted HTTP. Login credentials and personal details can be intercepted.",
                )
            )

        # 3. Shortener check
        if hostname in KNOWN_SHORTENERS:
            indicators.append(
                UrlIndicator(
                    code="url_shortener",
                    severity="medium",
                    category="syntax",
                    message="The URL is shortened, concealing the real destination recruitment portal.",
                )
            )

        # 4. Punycode / IDN check
        if hostname.startswith("xn--") or ".xn--" in hostname:
            indicators.append(
                UrlIndicator(
                    code="punycode_domain",
                    severity="high",
                    category="syntax",
                    message="The domain uses Punycode/IDN encoding, commonly used to disguise lookalike characters.",
                )
            )

        # 5. Non-ASCII characters in host
        try:
            hostname.encode("ascii")
        except UnicodeEncodeError:
            indicators.append(
                UrlIndicator(
                    code="non_ascii_hostname",
                    severity="high",
                    category="syntax",
                    message="The domain contains non-ASCII characters that can be used for homoglyph spoofing.",
                )
            )

        # 6. Domain label & TLD analysis (if not an IP)
        if not is_raw_ip:
            labels = hostname.split(".")
            tld = labels[-1]

            if tld in SUSPICIOUS_TLDS:
                indicators.append(
                    UrlIndicator(
                        code="suspicious_tld",
                        severity="medium",
                        category="network",
                        message=f"The domain uses the .{tld} extension, which has high historical abuse in phishing and fake recruitment schemes.",
                    )
                )

            # Deep subdomains (e.g., careers.google.com.sub.attacker.xyz)
            if len(labels) >= 4:
                indicators.append(
                    UrlIndicator(
                        code="excessive_subdomains",
                        severity="medium",
                        category="syntax",
                        message=f"The URL has {len(labels)} domain levels, which can hide the real root domain on mobile displays.",
                    )
                )

            # 7. Brand lookalike and recruitment typosquatting analysis
            # Look at labels excluding the TLD
            domain_body = ".".join(labels[:-1])
            for brand, official_domains in POPULAR_BRANDS.items():
                if hostname in official_domains or any(hostname.endswith("." + d) for d in official_domains):
                    continue  # Official verified domain

                # Check if brand appears in hostname
                if brand in domain_body:
                    # e.g., amazon-jobs.com, google-careers-portal.xyz, workday-login.site
                    has_recruitment_word = any(kw in domain_body for kw in RECRUITMENT_KEYWORDS)
                    has_separator = f"-{brand}" in domain_body or f"{brand}-" in domain_body or f".{brand}" in domain_body or f"{brand}." in domain_body

                    if has_recruitment_word or has_separator:
                        indicators.append(
                            UrlIndicator(
                                code="brand_impersonation",
                                severity="critical",
                                category="brand_impersonation",
                                message=f"The domain combines brand '{brand.title()}' with recruitment patterns but does not belong to official domains.",
                            )
                        )
                        break

            # 8. Suspicious subdomains mimicking login/careers
            if len(labels) >= 3:
                subdomain = labels[0]
                if subdomain in RECRUITMENT_KEYWORDS and not any(hostname.endswith(d) for brand_list in POPULAR_BRANDS.values() for d in brand_list):
                    indicators.append(
                        UrlIndicator(
                            code="suspicious_subdomain",
                            severity="medium",
                            category="syntax",
                            message=f"Subdomain '{subdomain}' mimics a career or recruitment portal on a third-party root domain.",
                        )
                    )

        return indicators

    def inspect_ssl_certificate(self, hostname: str, port: int = 443) -> SslCertificateInfo:
        """Perform a safe TLS handshake without fetching web page content."""
        try:
            # First ensure hostname does not resolve to restricted IP
            self.ip_resolver(hostname)
        except SSRFValidationError as exc:
            return SslCertificateInfo(is_valid=False, error=f"SSRF protection: {exc}")
        except Exception as exc:
            return SslCertificateInfo(is_valid=False, error=f"Resolution error: {exc}")

        context = ssl.create_default_context()
        try:
            with socket.create_connection((hostname, port), timeout=SOCKET_TIMEOUT) as sock:
                with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                    cert = ssock.getpeercert()
                    if not cert:
                        return SslCertificateInfo(is_valid=False, error="No peer certificate presented.")

                    # Extract Subject and Issuer
                    subject_parts = [dict(x)[0][1] for x in cert.get("subject", ()) if x]
                    issuer_parts = [dict(x)[0][1] for x in cert.get("issuer", ()) if x]

                    subject_str = ", ".join(str(s) for s in subject_parts[:2]) if subject_parts else hostname
                    issuer_str = ", ".join(str(i) for i in issuer_parts[:2]) if issuer_parts else None

                    # Check expiration
                    expires_str = cert.get("notAfter")
                    return SslCertificateInfo(
                        is_valid=True,
                        subject=subject_str,
                        issuer=issuer_str,
                        expires_at=expires_str,
                    )
        except ssl.SSLCertVerificationError as exc:
            return SslCertificateInfo(is_valid=False, error=f"Certificate verification failed: {exc.verify_message}")
        except (socket.timeout, TimeoutError):
            return SslCertificateInfo(is_valid=False, error="TLS connection timed out.")
        except Exception as exc:
            return SslCertificateInfo(is_valid=False, error=f"SSL handshake error: {str(exc)[:100]}")

    async def trace_redirects_safely(self, initial_url: str) -> tuple[str, list[RedirectHop], list[UrlIndicator]]:
        """Follow redirects hop-by-hop with strict SSRF validation before every hop."""
        chain: list[RedirectHop] = []
        indicators: list[UrlIndicator] = []
        current_url = initial_url
        visited_urls = {current_url}

        client = self.http_client or httpx.AsyncClient(
            follow_redirects=False,
            timeout=httpx.Timeout(connect=SOCKET_TIMEOUT, read=SOCKET_TIMEOUT, write=SOCKET_TIMEOUT, pool=SOCKET_TIMEOUT),
            headers={"User-Agent": "CrediHire-SafetyBot/1.0 (+https://credihire.local)"},
        )
        should_close_client = self.http_client is None

        try:
            for hop_idx in range(1, MAX_REDIRECTS + 1):
                try:
                    scheme, host, port = self.validate_syntax(current_url)
                    self.ip_resolver(host)
                except SSRFValidationError as exc:
                    indicators.append(
                        UrlIndicator(
                            code="ssrf_blocked_redirect",
                            severity="critical",
                            category="redirect",
                            message=f"Redirect hop {hop_idx} was blocked: Destination points to a restricted network.",
                        )
                    )
                    break
                except Exception as exc:
                    # DNS resolution or syntax failure on hop
                    break

                try:
                    # Request only HEAD or streaming GET to avoid loading payload body
                    response = await client.head(current_url)
                    # Some servers return 405 for HEAD, fallback to GET without reading body
                    if response.status_code == 405:
                        response = await client.get(current_url)
                except (httpx.TimeoutException, socket.timeout):
                    indicators.append(
                        UrlIndicator(
                            code="redirect_timeout",
                            severity="low",
                            category="redirect",
                            message=f"Network request to {host} timed out.",
                        )
                    )
                    break
                except Exception as exc:
                    logger.debug("Redirect trace stopped on %s: %s", current_url, exc)
                    break

                chain.append(
                    RedirectHop(
                        hop_number=hop_idx,
                        url=current_url,
                        status_code=response.status_code,
                    )
                )

                if response.is_redirect and "location" in response.headers:
                    next_url = urljoin(current_url, response.headers["location"])
                    if next_url in visited_urls:
                        indicators.append(
                            UrlIndicator(
                                code="redirect_loop",
                                severity="medium",
                                category="redirect",
                                message="A redirect loop was detected.",
                            )
                        )
                        break
                    visited_urls.add(next_url)
                    current_url = next_url
                else:
                    break

        finally:
            if should_close_client:
                await client.aclose()

        # Check for cross-domain redirects
        if len(chain) > 1:
            initial_host = urlparse(initial_url).hostname or ""
            final_host = urlparse(current_url).hostname or ""
            if initial_host.lower() != final_host.lower():
                indicators.append(
                    UrlIndicator(
                        code="cross_domain_redirect",
                        severity="medium",
                        category="redirect",
                        message=f"URL redirects across domains from {initial_host} to {final_host}.",
                    )
                )

        return current_url, chain, indicators

    def calculate_risk(self, indicators: list[UrlIndicator]) -> tuple[int, str]:
        """Compute numerical risk score (0-100) and risk level from detected indicators."""
        weights = {
            "low": 10,
            "medium": 25,
            "high": 45,
            "critical": 75,
        }
        score = sum(weights.get(ind.severity, 15) for ind in indicators)
        score = min(score, 100)

        if score >= 80:
            level = "critical"
        elif score >= 55:
            level = "high"
        elif score >= 30:
            level = "medium"
        elif score >= 15:
            level = "low"
        else:
            level = "safe"

        return score, level

    def generate_recommendations(self, indicators: list[UrlIndicator], level: str) -> list[str]:
        """Return actionable safety advice tailored to the indicators found."""
        recommendations = []
        codes = {ind.code for ind in indicators}

        if "brand_impersonation" in codes:
            recommendations.append("Do not enter login credentials or submit resumes on this site; navigate directly to the official corporate portal.")
        if "insecure_transport_http" in codes:
            recommendations.append("Never submit passwords, personal identification, or payment details over unencrypted HTTP.")
        if "ip_hostname" in codes:
            recommendations.append("Legitimate hiring organizations use verified domain names rather than raw IP addresses.")
        if "url_shortener" in codes or "cross_domain_redirect" in codes:
            recommendations.append("Verify the final destination domain carefully before proceeding.")
        if "punycode_domain" in codes:
            recommendations.append("Examine the address bar carefully; this URL may use lookalike characters to mimic a reputable service.")

        if level in ("high", "critical") and not recommendations:
            recommendations.append("High risk indicators detected. Cease communication and do not share sensitive information.")

        if level == "safe":
            recommendations.append("No immediate structural anomalies detected. Always verify independent company contact information before sharing sensitive data.")

        return recommendations[:5]

    async def analyze(self, request: UrlAnalysisRequest) -> UrlAnalysisResponse:
        """Run full credibility check: syntax, SSRF guard, heuristics, redirect analysis, and TLS inspection."""
        scheme, hostname, port = self.validate_syntax(request.url)
        normalized_target = f"{scheme}://{hostname}" + (f":{port}" if (scheme == "https" and port != 443) or (scheme == "http" and port != 80) else "") + (urlparse(request.url).path or "")

        # 1. Deterministic heuristic indicators
        indicators = self.analyze_heuristics(scheme, hostname)

        # 2. SSRF Check on initial target
        try:
            self.ip_resolver(hostname)
            is_ssrf_safe = True
        except SSRFValidationError as exc:
            is_ssrf_safe = False
            indicators.append(
                UrlIndicator(
                    code="ssrf_restricted_host",
                    severity="critical",
                    category="network",
                    message=f"The domain resolves to a restricted or private network: {exc}",
                )
            )
        except Exception:
            is_ssrf_safe = False

        # 3. Safe redirect analysis (only if initial target is not restricted)
        redirect_chain: list[RedirectHop] = []
        final_url = normalized_target
        if is_ssrf_safe:
            try:
                final_url, redirect_chain, redirect_indicators = await self.trace_redirects_safely(normalized_target)
                indicators.extend(redirect_indicators)
                # If redirected to another domain, analyze heuristics of final domain as well
                final_parsed = urlparse(final_url)
                if final_parsed.hostname and final_parsed.hostname.lower() != hostname:
                    final_scheme = final_parsed.scheme.lower() or "https"
                    final_heuristics = self.analyze_heuristics(final_scheme, final_parsed.hostname.lower())
                    for fh in final_heuristics:
                        if not any(item.code == fh.code for item in indicators):
                            indicators.append(fh)
            except Exception as exc:
                logger.debug("Redirect analysis skipped or failed: %s", exc)

        # 4. TLS Certificate inspection (if HTTPS and safe)
        ssl_info = None
        if scheme == "https" and is_ssrf_safe:
            try:
                ssl_info = await asyncio.to_thread(self.inspect_ssl_certificate, hostname, port)
                if ssl_info and not ssl_info.is_valid and ssl_info.error and "verification failed" in ssl_info.error.lower():
                    indicators.append(
                        UrlIndicator(
                            code="ssl_certificate_invalid",
                            severity="high",
                            category="transport",
                            message=f"SSL certificate issue: {ssl_info.error}",
                        )
                    )
            except Exception as exc:
                ssl_info = SslCertificateInfo(is_valid=False, error=str(exc))

        # 5. Score calculation and summary
        risk_score, risk_level = self.calculate_risk(indicators)
        recommendations = self.generate_recommendations(indicators, risk_level)

        if risk_level == "safe":
            summary = "No suspicious URL indicators detected. Domain structure and transport appear standard."
        elif risk_level == "low":
            summary = "Minor non-critical indicators detected. Proceed with standard caution."
        elif risk_level == "medium":
            summary = f"Moderate risk indicators identified ({len(indicators)} detected). Review destination carefully before entering details."
        else:
            summary = f"High-risk suspicious patterns detected ({', '.join(ind.code for ind in indicators[:3])}). Potential phishing or recruitment impersonation."

        return UrlAnalysisResponse(
            analysis_id=uuid4(),
            target_url=normalized_target,
            final_url=final_url,
            risk_level=risk_level,
            risk_score=risk_score,
            is_redirected=len(redirect_chain) > 1,
            redirect_chain=redirect_chain,
            ssl_info=ssl_info,
            indicators=indicators,
            recommendations=recommendations,
            summary=summary,
            reputation_status="not_checked",
            disclaimer="Automated URL safety check. Independently verify recruiter credentials and hiring processes.",
        )
