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
