# Credihire Browser Extension (Manifest V3)

Production-grade browser extension for **Credihire**, an AI-powered job scam and recruitment fraud detection platform.

Compatible with **Microsoft Edge** and **Google Chrome** using **Manifest V3**.

---

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [Directory Structure](#directory-structure)
- [Backend API Integration](#backend-api-integration)
- [Key Features](#key-features)
- [Security & Privacy Guarantees](#security--privacy-guarantees)
- [How to Load Unpacked Extension in Microsoft Edge](#how-to-load-unpacked-extension-in-microsoft-edge)
- [How to Load Unpacked Extension in Google Chrome](#how-to-load-unpacked-extension-in-google-chrome)
- [Running Automated Tests](#running-automated-tests)
- [Known Limitations](#known-limitations)

---

## Architecture Overview

The extension strictly adheres to Manifest V3 guidelines:
- **`manifest.json`**: Manifest V3 declaration, minimal permissions (`activeTab`, `contextMenus`, `storage`, `scripting`), and host permissions for backend endpoints.
- **`popup/`**: Cybersecurity-themed responsive UI (440px x 580px) displaying risk gauges, scam stage, detected indicators, grounded quotes, and safety recommendations.
- **`background/service-worker.js`**: Background event worker handling context menu actions (`selection` and `link`), background API analysis, and extension badge updates.
- **`content/content-script.js`**: Lightweight content script that runs **only upon explicit user action**. It extracts clean job text from the page without transmitting telemetry unprompted.
- **`lib/api-client.js`**: Centralized HTTP client interfacing with Credihire FastAPI backend (`/api/v1/health`, `/api/v1/ready`, `/api/v1/scam/analyze`, `/api/v1/url/analyze`).
- **`lib/storage.js`**: Safe promise wrapper over `chrome.storage.local` managing configuration, cached results, and audit history.
- **`options/`**: Dedicated options page allowing users to configure custom backend URLs, test connections, and inspect component status.

---

## Directory Structure

```text
browser-extension/
├── manifest.json                  # Manifest V3 configuration
├── README.md                      # Extension documentation and usage guide
├── assets/
│   ├── credihire-shield.svg       # Vector Credihire shield logo
│   ├── icon16.png                 # 16x16 extension icon
│   ├── icon32.png                 # 32x32 extension icon
│   ├── icon48.png                 # 48x48 extension icon
│   └── icon128.png                # 128x128 extension icon
├── background/
│   └── service-worker.js          # Background service worker (context menus & badge)
├── content/
│   └── content-script.js          # Explicit user-invoked text extractor
├── lib/
│   ├── api-client.js              # Single-source-of-truth API client
│   ├── config.js                  # Configuration, limits, and URL normalization
│   └── storage.js                 # Local storage and history manager
├── options/
│   ├── options.html               # Options page view
│   ├── options.css                # Options page styling
│   └── options.js                 # Options page controller
├── popup/
│   ├── popup.html                 # Main popup UI
│   ├── popup.css                  # Modern dark cybersecurity styling
│   └── popup.js                   # Main popup controller
└── tests/
    └── run-tests.js               # Comprehensive automated test suite
```

---

## Backend API Integration

The extension connects to the existing Credihire FastAPI backend. The default local development URL is:
```text
http://127.0.0.1:8000
```
API calls automatically target the `/api/v1` prefix.

### Endpoints Used

| Endpoint | Method | Request Schema | Response Schema |
|---|---|---|---|
| `/api/v1/health` | `GET` | None | `{"status": "ok"}` |
| `/api/v1/ready` | `GET` | None | `{"status": "ready\|degraded", "components": {"rule_engine": "...", "llm": "..."}}` |
| `/api/v1/scam/analyze` | `POST` | `ScamAnalysisRequest` | `ScamAnalysisResponse` |
| `/api/v1/url/analyze` | `POST` | `UrlAnalysisRequest` | `UrlAnalysisResponse` |

### 1. Job Scam Analysis (`POST /api/v1/scam/analyze`)

**Request Payload:**
```json
{
  "job_text": "Pay ₹2,000 to unlock your task earnings.",
  "job_url": "https://example.com/job/123",
  "company_name": "Acme Tasks",
  "contact_details": "recruiter@example.com"
}
```
- `job_text`: Required (1–12,000 characters).
- `job_url`: Optional HTTP/HTTPS URL.
- `company_name`: Optional employer name (up to 200 chars).
- `contact_details`: Optional recruiter contact (up to 1,000 chars).

**Response Payload:**
- `analysis_id` (UUID)
- `risk_level` (`"low"`, `"medium"`, `"high"`, `"critical"`)
- `risk_score` (0–100)
- `indicators`: Array of `{ code, severity, message, sources }`
- `evidence`: Array of `{ source, detail, indicator_code }`
- `scam_stage`: Detected scam phase (e.g., `payment_request`, `registration_fee`)
- `recommendations`: Safe guidance checklist
- `summary`: Executive risk assessment
- `disclaimer`: Legal / automated guidance disclaimer
- `ai_enrichment`: Optional Groq AI contextual analysis

### 2. URL Credibility Analysis (`POST /api/v1/url/analyze`)

**Request Payload:**
```json
{
  "url": "https://careers.google.com"
}
```

**Response Payload:**
- `analysis_id` (UUID)
- `target_url`, `final_url`
- `risk_level` (`"safe"`, `"low"`, `"medium"`, `"high"`, `"critical"`)
- `risk_score` (0–100)
- `is_redirected`: Boolean
- `redirect_chain`: SSRF-safe hop list (`hop_number`, `url`, `status_code`)
- `ssl_info`: `{ is_valid, issuer, subject, expires_at, error }`
- `indicators`: Category-based indicators (`brand_impersonation`, `network`, `transport`, etc.)
- `recommendations`, `summary`, `reputation_status`, `disclaimer`

---

## Key Features

1. **Dark Navy & Bright Cyan Cybersecurity UI**:
   - Signature Credihire cybersecurity design: Dark navy backgrounds (`#0a0e17`, `#131b2e`), bright cyan gradient CTA buttons (`linear-gradient(135deg, #0ea5e9, #00f2fe)`), subtle cyan glow accents, and vector shield logo with glowing cyber lock emblem.
   - Dynamic 0–100 risk score meter with color-coded severity badges (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `SAFE`).
   - Scam stage banner, detected indicator cards, and message-grounded quotes.
   - One-click "Copy Report" button.
2. **Interactive Evidence Highlighting**:
   - Automatically maps backend evidence phrases to their exact occurrences in the submitted job text.
   - Renders matching phrases with highlighted marks (`<mark class="evidence-mark sev-...">`) matching severity.
   - 100% XSS-safe: Uses native DOM text nodes and `textContent` rather than injecting unescaped HTML.
   - Provides readable explanations for each indicator and displays recommendations below evidence.
3. **Selected Text Analysis**:
   - "Capture Selected Text" grabs highlighted text from the current webpage instantly.
   - Context menu: Right-click any highlighted text on any webpage and select **"Analyze with Credihire"**.
3. **Webpage Content Scan**:
   - "Scan Current Webpage" button extracts structured readable job content from the current tab after explicit user click.
4. **URL Credibility Verification**:
   - Evaluates website safety, SSL certificate validity, SSRF-safe redirect hops, and brand impersonation without downloading executable page scripts.
5. **Configurable Backend**:
   - Change backend URL in the popup Settings tab or Options page.
   - Live "Test Connection" button hits `/health` and `/ready` to report component statuses.
6. **Graceful Error Handling**:
   - Clear error states for offline/unreachable backend (with retry button), HTTP 413, HTTP 422, HTTP 429, and HTTP 503.
7. **Local Scan History**:
   - Stores the last 15 scans locally with one-click reload.

---

## Security & Privacy Guarantees

- **No Secret Exposure**: Zero Groq API keys, tokens, or backend credentials are saved or accessible in the extension.
- **Zero Automatic Telemetry**: No webpage content or URLs are scanned or sent until the user explicitly triggers an action.
- **Least-Privilege Permissions**: Requests only `activeTab`, `contextMenus`, `storage`, and `scripting`.
- **SSRF-Safe**: Webpage analysis is client-driven, while URL credibility checks rely on the backend's SSRF-safe TLS socket verification.

---

## How to Load Unpacked Extension in Microsoft Edge

1. Open **Microsoft Edge**.
2. In the address bar, navigate to:
   ```text
   edge://extensions/
   ```
3. In the bottom-left sidebar (or top toggle), enable **Developer mode** toggle.
4. Click the **Load unpacked** button at the top of the page.
5. In the file picker dialog, browse to and select:
   ```text
   C:\Users\saini\Documents\Codex\2026-10-30\new-chat\browser-extension
   ```
6. Click **Select Folder**.
7. The **Credihire - AI Job Scam Shield** icon will appear in your extensions list.
8. Pin the extension to the Edge toolbar by clicking the Extensions puzzle icon and selecting the eye/pin icon next to Credihire.

---

## How to Load Unpacked Extension in Google Chrome

1. Open **Google Chrome**.
2. Navigate to:
   ```text
   chrome://extensions/
   ```
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click the **Load unpacked** button in the top-left corner.
5. Select the folder:
   ```text
   C:\Users\saini\Documents\Codex\2026-10-30\new-chat\browser-extension
   ```
6. Click **Select Folder**.
7. Pin the extension to your Chrome toolbar.

---

## Running Automated Tests

A comprehensive test suite verifies Manifest V3 specifications, URL normalization, pre-validation rules, mock backend integration, error mappings, and UI bindings:

```bash
node tests/run-tests.js
```

All 29 tests validate functionality and contracts against live simulated HTTP endpoints.

---

## Known Limitations

- **Browser System Pages**: Chromium security prohibits extensions from injecting scripts into internal browser pages (`edge://*`, `chrome://*`, `about:*`). The extension gracefully detects these pages and advises the user.
- **Backend Dependency**: Full scam evaluation requires the Credihire FastAPI backend to be running. If the backend is stopped or rule engines are degraded, the extension gracefully reports service unavailability without inventing fabricated risk scores.
