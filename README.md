# Scam Detection API

Run from this directory:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
python -m pytest -q
```

Copy `.env.example` to `.env`; do not commit it. Chat requires all `LLM_*` values. Scam analysis requires Karan's engine factory in `RULE_ENGINE_FACTORY` (for example, `team_rules.engine:create_engine`). The factory must return an object implementing `analyze(request) -> ScamAnalysisResponse`; absent or invalid configuration returns `503`, never a fabricated assessment.
