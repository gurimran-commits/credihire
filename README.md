# Scam Detection API

Run from this directory:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
python -m pytest -q
```

Copy `.env.example` to `.env`; do not commit it. Chat requires all `LLM_*` values. Scam analysis requires Karan's engine factory in `RULE_ENGINE_FACTORY` (for example, `team_rules.engine:create_engine`). The factory must return an object implementing `analyze(request) -> RuleEngineResult`; absent or invalid configuration returns `503`, never a fabricated assessment.

The MVP is intentionally unauthenticated and its endpoints are public. Deploy it only behind an authenticated gateway if access control is required. Configure explicit `CORS_ORIGINS`, a suitable `RATE_LIMIT_PER_MINUTE`, and an upstream request-body limit in addition to `MAX_REQUEST_BYTES`.

## Rule-engine interface

Karan's configured factory must return an object with `analyze(request: ScamAnalysisRequest) -> RuleEngineResult`. `RuleEngineResult` must provide `risk_level` (`low`, `medium`, or `high`), `risk_score` (0–100), `indicators`, and a non-empty `summary`. It may also provide structured `evidence`, a `scam_stage` string, and up to ten safe `recommendations`. Invalid output or engine failures return a safe `503`; the backend never creates risk findings itself.

## LLM integration

Aditya must configure `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL`. The provider must implement OpenAI-compatible `POST /chat/completions` accepting `model` and `messages`, returning `choices[0].message.content`, plus authenticated `GET /models` for readiness. The backend uses a 15-second chat timeout, validates non-empty replies up to 8,000 characters, and returns only safe `503` responses for configuration, provider, or timeout failures. Chat context is in-memory, session-scoped, and limited to six messages; it is not durable across restarts.

## Render deployment

`render.yaml` defines a Python web service with `uvicorn app.main:app --host 0.0.0.0 --port $PORT` and uses `GET /api/v1/health` as its lightweight deployment health check. `.python-version` pins the tested Python 3.12.10 runtime. If this backend is in a monorepo, select `backend/` as the Render root directory or choose `backend/render.yaml` as the Blueprint path. Render health checks must not use `/api/v1/ready`, because readiness deliberately verifies external integrations.

Set `CORS_ORIGINS` in the Render Dashboard to Keshav's exact HTTPS frontend origin or comma-separated origins, for example `https://app.example.com`. Do not use `*`. Add `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, and `RULE_ENGINE_FACTORY` only in Render's Environment settings; `render.yaml` intentionally declares them with `sync: false` and contains no secrets.

## Frontend integration

Keshav should set the frontend build variable `VITE_API_BASE_URL` to `https://<render-service>.onrender.com/api/v1` (or the verified custom API domain). The frontend must not receive LLM credentials. Call `POST ${VITE_API_BASE_URL}/scam/analyze` with `job_text` and `POST ${VITE_API_BASE_URL}/chat/messages` with `message`; `analyze_message: true` optionally attaches deterministic analysis to the chat response. Handle `422` validation responses (`detail`, `errors`), `429` rate limiting, and `503` unavailable integrations without exposing raw errors to users.

## Production requirements

This MVP has no authentication. Put it behind an authentication/authorization gateway before exposing non-public functionality. The rate limiter and chat session history are process-local; use a shared rate-limit store and durable, access-controlled session storage before running multiple instances. Keep an upstream request-body limit, configure trusted proxy/client-IP handling, and monitor provider failures. The app logs lifecycle and validation event metadata only; it does not log request bodies, credentials, or provider error details.
