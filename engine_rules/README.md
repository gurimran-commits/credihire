# Fake Job & Task-Scam Detection System — Scam Intelligence Module

**Role:** Senior Python Developer and Cybersecurity Engineer (CrediHire Team)  
**Component:** Deterministic Rule Engine, Multilingual Intelligence, Risk Scoring Engine & FastAPI Service  

---

## 1. Architecture Overview

CrediHire's Scam Intelligence Engine is an explainable, deterministic cybersecurity rule engine designed to identify fake job offers and task-based scams, extract exact supporting evidence snippets, evaluate compound risk scores, and classify submissions into standardized scam stages.

The system natively supports English, Devanagari Hindi, and Romanized Hindi (Hinglish), alongside flexible Indian currency formats.

```
c:/backend rules/
├── backend/
│   ├── api/
│   │   ├── __init__.py           # API package initialization
│   │   ├── router.py             # FastAPI router (/api/intelligence/analyze, /health)
│   │   └── schemas.py            # Pydantic v2 schemas for request/response validation
│   ├── intelligence/
│   │   ├── __init__.py           # Package exports
│   │   ├── indicators.py         # Scam indicators, stage enums, risk levels, and schemas
│   │   ├── rules.py              # Multilingual regex rules, clause boundaries & evidence extraction
│   │   └── classifier.py         # Stage hierarchy, compound risk score & classification
│   └── main.py                   # FastAPI application factory with configurable CORS middleware
├── tests/
│   ├── __init__.py
│   ├── test_api.py               # 15 FastAPI integration, CORS & error shielding tests (TestClient)
│   └── test_rules.py             # 165 comprehensive unit, negation, multilingual, scoring & audit tests
├── demo.py                       # CLI demo covering English, Hindi, Hinglish & scoring
├── requirements.txt              # Production and testing dependencies (FastAPI, uvicorn, pydantic)
└── README.md                     # Technical documentation & usage instructions
```

---

## 2. Indicator Categories (7 Core Categories)

The engine monitors seven distinct indicator categories, each backed by tailored Devanagari Hindi, Romanized Hinglish, and English regex patterns:

1. **Upfront Registration Fees (`upfront_registration_fee` | Base Weight: 55 | Severity: High)**  
   Demands payment for registration, onboarding, interview booking/slots, documentation, or starter kits.
   - *English:* `Pay ₹500 for a job interview slot`, `Pay ₹2,000 registration fee`
   - *Hinglish:* `Registration fee pay karo`, `joining fees jama karo`
   - *Hindi:* `रजिस्ट्रेशन शुल्क जमा करें`, `नौकरी के लिए फीस भरें`

2. **Task Deposits & Unlocking Payments (`task_deposit` | Base Weight: 70 | Severity: Critical)**  
   Requires deposits or recharges to unlock tasks, access VIP tasks, unlock accounts, or release task earnings.
   - *English:* `Pay ₹500 to unlock your account`, `Pay ₹2,000 to unlock your task earnings`
   - *Hinglish:* `Task unlock karne ke liye deposit bhejo`, `VIP tasks ke liye recharge karo`
   - *Hindi:* `काम शुरू करने के लिए ₹500 जमा करें`, `टास्क अनलॉक करने हेतु डिपॉजिट करें`

3. **Withdrawal Blocks & Release Fees (`withdrawal_fee` | Base Weight: 75 | Severity: Critical)**  
   Withholds accumulated wallet balances or earnings behind release fees, taxes, or clearance fees.
   - *English:* `To withdraw your balance, a clearance fee is required`, `Pay ₹1,000 to withdraw your balance`
   - *Hinglish:* `Paise nikalne ke liye pehle clearance fee pay karo`
   - *Hindi:* `पैसे निकालने के लिए पहले फीस भरें`, `विड्रॉल के लिए टैक्स जमा करें`

4. **Unrealistic Earnings Claims (`unrealistic_earnings` | Base Weight: 35 | Severity: Medium)**  
   Promises disproportionate daily payouts (e.g., ₹3,000–₹10,000/day) for trivial tasks like liking YouTube videos or typing captchas.
   - *English:* `Earn ₹3,000 - ₹8,000 daily from home by liking YouTube videos`, `10k daily income`
   - *Hinglish:* `Ghar baithe video like karke daily 5000 kamayein`
   - *Hindi:* `घर बैठे यूट्यूब वीडियो लाइक करके रोज ₹5,000 कमाएं`

5. **Urgency and High-Pressure Tactics (`urgency_pressure` | Base Weight: 25 | Severity: Low)**  
   Employs countdown timers (e.g., "transfer within 10 minutes or offer expires") or artificial slot scarcity paired with immediate payment.
   - *English:* `Only 2 slots left, pay now to confirm`, `Transfer within 10 minutes or offer expires`
   - *Hinglish:* `Sirf 2 seats bachi hain turant pay karo`, `offer expires in 15 minutes`
   - *Hindi:* `केवल 2 सीटें बाकी हैं तुरंत फीस जमा करें`, `10 मिनट के भीतर भुगतान करें`

6. **Sensitive Credentials / OTP Solicitation (`sensitive_credentials` | Base Weight: 65 | Severity: Critical)**  
   Demands OTPs, UPI PINs, CVVs, passwords, or remote desktop software (AnyDesk/TeamViewer).
   - *English:* `Share the OTP sent to your phone to activate corporate payroll`
   - *Hinglish:* `Apna OTP aur UPI PIN share karo`, `bank password bhejo`
   - *Hindi:* `अपना ओटीपी और यूपीआई पिन दर्ज करें`, `बैंक पासवर्ड साझा करें`

7. **Advance Fees (`advance_fee` | Base Weight: 50 | Severity: High)**  
   Demands advance equipment collateral, laptop security deposits, courier charges, or visa processing deposits.
   - *English:* `Pay courier charges in advance`, `Send ₹500 as a refundable security deposit before joining`
   - *Hinglish:* `Laptop security deposit ₹2,000 advance dena hoga`, `courier charges bhejo`
   - *Hindi:* `लैपटॉप और किट के लिए एडवांस सिक्योरिटी डिपॉजिट जमा करें`

---

## 3. Allowed Scam Stages

The module strictly outputs one of the six contract-agreed stage values:

- `job_offer`: Initial suspicious solicitation stage (unrealistic earnings, pressure, or credential harvesting before direct fee demands).
- `registration_fee`: Upfront fee demanded before work begins.
- `task_deposit`: Deposit or recharge required to perform tasks or unlock task earnings/accounts.
- `withdrawal_block`: Funds frozen at the withdrawal/cash-out phase.
- `advance_fee`: Equipment deposit, courier advance, or visa fees.
- `unknown`: Benign content, legitimate job advertisement, or no indicators detected.

---

## 4. Multilingual & Currency Intelligence

### Supported Indian Currency Formats
The engine features a unified currency extraction regex supporting standard Indian currency conventions:
- Symbol: `₹500`, `₹ 1,000`
- Prefixes: `Rs 500`, `Rs. 500`, `INR 500`
- Suffixes: `500/-`, `1000 rupees`, `500 rupaye`, `500 रुपये`
- Multipliers: `5k`, `10k`, `10K`

### Sentence & Clause-Aware Negation Handling
Negation detection does **not** rely on naive text-wide matching. It uses sentence boundaries (`.`, `!`, `?`, `\n`, `।`, `॥`) and contrastive clause boundaries:
- **Disclaimers vs Demands:** `"We do not ask for OTP, please share your OTP to activate payroll"` detects `sensitive_credentials` because the independent demand follows the comma boundary.
- **Contrastive Conjunctions:** Words like `but`, `however`, `lekin`, `magar`, `parantu`, `kripya`, `लेकिन`, `मगर`, `परंतु`, `कृपया` split negative clauses from positive extortion attempts.
- **List & Negative Continuations:** Phrases like `"We do not charge registration fees, onboarding fees, or training fees"` are properly recognized as negative lists and suppressed.
- **Awareness & Warning Discussions:** Educational statements like `"Task deposits are a common scam tactic. Never pay one."` and `"Task deposit scams target job seekers."` do not trigger scam indicators.
- **Evidence Extraction Precision:** In mixed messages like `"Your wallet is blocked. Do not pay any fee. Pay ₹500 to release your balance."`, the engine extracts only the true affirmative extortion demand (`Pay ₹500 to release your balance`) without capturing unrelated warnings or disclaimers.

---

## 5. Phase 4: Risk Scoring and Severity Classification

### Heuristic Severity vs Statistical Probability
> [!NOTE]
> The `risk_score` is an **explainable heuristic severity index** (0–100 integer) calculated from rule weights and compound indicators. It is **not** a frequentist or Bayesian statistical probability of fraud. For legacy contracts, `confidence_score` (0.0–1.0 float) is preserved.

### Category Base Weights & Severities (Aligned with `indicators.py`)
| Indicator Category | Base Weight | Severity |
| :--- | :---: | :---: |
| `withdrawal_fee` | **75** | Critical |
| `task_deposit` | **70** | Critical |
| `sensitive_credentials` | **65** | Critical |
| `upfront_registration_fee` | **55** | High |
| `advance_fee` | **50** | High |
| `unrealistic_earnings` | **35** | Medium |
| `urgency_pressure` | **25** | Low |

### Compound Risk Formula
To avoid artificial score inflation from multiple rules triggering in the same category, indicators are first deduplicated by category. The compound score is computed as:

$$\text{Risk Score} = \min\left(100, \max_{i \in \text{detected}}(w_i) + \sum_{j \neq \text{primary}} \lfloor w_j \times 0.6 \rfloor\right)$$

- When no indicators are detected, $\text{Risk Score} = 0$.
- Secondary indicators add diminishing compound risk ($60\%$ weight).

### Severity Thresholds (`RiskLevel`)
- **`LOW`**: $0 \le \text{Risk Score} < 30$ (Benign content or isolated low-severity signals)
- **`MEDIUM`**: $30 \le \text{Risk Score} < 60$ (Unrealistic earnings or advance fee warning)
- **`HIGH`**: $60 \le \text{Risk Score} \le 85$ (Upfront fee extortion, task deposits, or credential harvesting)
- **`CRITICAL`**: $86 \le \text{Risk Score} \le 100$ (Compound multi-stage threats, e.g., withdrawal fee + urgency)

---

## 6. Phase 5: Production-Ready FastAPI Service

### Service Architecture
- `backend/main.py`: ASGI application entrypoint with configurable CORS middleware.
- `backend/api/router.py`: REST router mounted under `/api/intelligence`.
- `backend/api/schemas.py`: Pydantic models for strict type validation.

### CORS Security & Configuration
Wildcard origins (`*`) are disallowed with credentials enabled. Allowed frontend origins are configurable via the `ALLOWED_ORIGINS` environment variable:
- **Local Development:** Default allowed origins include `http://localhost:3000`, `http://localhost:5173`, `http://localhost:8080`, `http://127.0.0.1:3000`, `http://127.0.0.1:5173`.
- **Production Configuration:** Specify allowed origins via comma-separated list:
  ```powershell
  $env:ALLOWED_ORIGINS = "https://app.credihire.com,https://credihire.com"
  ```
- **Credentials & Rejection:** Preflight and requests from untrusted external origins are rejected without `Access-Control-Allow-Origin` headers.

### API Endpoints

#### 1. Analyze Job / Task Submission
- **Method:** `POST`
- **Path:** `/api/intelligence/analyze`
- **Request Body:**
  ```json
  {
    "text": "Task unlock karne ke liye 500/- deposit bhejo. Transfer within 10 minutes or offer expires."
  }
  ```
- **Response Body (`200 OK`):**
  ```json
  {
    "scam_stage": "task_deposit",
    "risk_score": 85,
    "risk_level": "HIGH",
    "indicators": [
      "task_deposit",
      "urgency_pressure"
    ],
    "evidence": [
      "Task unlock karne ke liye 500/- deposit bhejo",
      "Transfer within 10 minutes or offer expires"
    ],
    "explanations": [
      "Payment or account recharge is demanded to assign, unlock, or continue tasks, or to release accrued task earnings. Legitimate work does not require pay-to-work deposits.",
      "Employs coercive artificial urgency, countdown timers, or slot scarcity to rush financial transfers without allowing due diligence."
    ]
  }
  ```

#### 2. Health Checks
- **Method:** `GET`
- **Path:** `/health` and `/api/intelligence/health`
- **Response (`200 OK`):**
  ```json
  {
    "status": "healthy",
    "service": "scam_intelligence_engine",
    "version": "1.0.0"
  }
  ```

#### 3. Error Handling & Shielding
- **`400 Bad Request`**: Empty string or whitespace-only submission (`{"detail": "Input text cannot be empty or contain only whitespace."}`).
- **`422 Unprocessable Entity`**: Missing `text` field or invalid data types.
- **`500 Internal Server Error`**: Unexpected exceptions are caught, logged securely, and returned with a clean generic message (`{"detail": "An error occurred while processing the intelligence analysis request."}`), strictly preventing leakage of stack traces or internal exception details.

---

## 7. How to Run the Server

### Starting the FastAPI Backend
Using Uvicorn:
```powershell
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

Once running, interactive OpenAPI documentation is available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### Testing with `curl`
```powershell
curl -X POST "http://localhost:8000/api/intelligence/analyze" `
  -H "Content-Type: application/json" `
  -d "{\"text\": \"Pay ₹500 registration fee to get hired.\"}"
```

### Testing with Python `requests`
```python
import requests

response = requests.post(
    "http://localhost:8000/api/intelligence/analyze",
    json={"text": "काम शुरू करने के लिए ₹500 जमा करें"}
)
print(response.json())
```

---

## 8. Test Suite & Verification

The test suite contains **180 comprehensive test cases** (165 unit tests + 15 FastAPI integration tests) covering positive, negative, edge-case, multilingual, and security audit scenarios.

### Running All Tests
```powershell
python -m unittest discover -s tests -v
```

### Running Test Modules Individually
```powershell
# Intelligence and classification tests (165 tests)
python -m unittest tests/test_rules.py -v

# FastAPI REST endpoint integration tests (15 tests)
python -m unittest tests/test_api.py -v
```

### Running the CLI Demonstration
```powershell
python demo.py
```

---

## 9. Backward Compatibility & Contracts

All previous interfaces and legacy contracts remain 100% backward-compatible:
1. `analyze_scam_submission(text)`: Returns the team contract dict `{"scam_stage": ..., "risk_score": ..., "risk_level": ..., "indicators": [...]}`.
2. `classify_scam(text)`: Returns `ScamAnalysisResult` with full metadata (`is_suspicious`, `confidence_score`, `risk_score`, `risk_level`, `indicators`).
3. `ScamAnalysisResult.to_dict()`: Standard diagnostic representation.
4. `ScamAnalysisResult.to_contract_dict()`: Legacy team-agreed format with new score enrichments.
5. `ScamAnalysisResult.to_api_dict()`: REST response format matching the `POST /api/intelligence/analyze` schema.
