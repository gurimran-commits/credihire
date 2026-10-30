# React frontend integration

## Local configuration

Start the API from `backend/` with `uvicorn app.main:app --reload`. Set Keshav's Vite `.env.local` to:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

The backend default allows the Vite browser origin `http://localhost:5173`. Run the frontend at that origin. If it instead runs at `http://127.0.0.1:5173` or another port, set the backend `CORS_ORIGINS` to that exact origin and restart it. Do not use `*`.

Use `Content-Type: application/json`; no frontend API key or LLM credential is needed or permitted. The generated schema is available at `http://127.0.0.1:8000/openapi.json`.

## Endpoints

| Method | URL | Purpose | Success |
|---|---|---|---|
| `GET` | `${VITE_API_BASE_URL}/health` | Lightweight process health check. | `{"status":"ok"}` |
| `GET` | `${VITE_API_BASE_URL}/ready` | Integration readiness, without secrets. | `{"status":"ready|degraded","components":{"rule_engine":"ready|unavailable|unconfigured","llm":"ready|unavailable|unconfigured"}}` |
| `POST` | `${VITE_API_BASE_URL}/scam/analyze` | Deterministic job/task analysis. | `ScamAnalysisResponse` |
| `POST` | `${VITE_API_BASE_URL}/scam/analyze/upload` | PDF or screenshot extraction plus deterministic analysis. | `UploadAnalysisResponse` |
| `POST` | `${VITE_API_BASE_URL}/chat/messages` | Scam-awareness chat. | `ChatMessageResponse` |

### Analyze request

```json
{
  "job_text": "Paste the full job or task offer here",
  "job_url": "https://example.com/optional",
  "company_name": "Optional company",
  "contact_details": "Optional contact"
}
```

`job_text` is required (1–12,000 characters). The other fields are optional. A successful result has `analysis_id`, `risk_level`, `risk_score`, `indicators`, `evidence`, `scam_stage`, `recommendations`, `summary`, and `disclaimer`. These values are supplied only by Karan's configured rule engine; the UI must not infer or display a result if the API returns `503`.

### Chat request

```json
{
  "message": "Is this recruiter message suspicious?",
  "session_id": "optional UUID retained by the browser",
  "analysis_id": "optional UUID",
  "analyze_message": false
}
```

`message` is required (1–4,000 characters). Save the returned `session_id` and send it on later messages to retain the bounded conversation context. Set `analyze_message` to `true` only when the user explicitly asks to analyze the submitted message. The response contains `session_id`, `message_id`, `reply`, `disclaimer`, and optional `analysis`. `reply` is returned only by the configured LLM service; never substitute a frontend-generated reply.

### Upload request

Use `FormData`; do not set the `Content-Type` header manually because the browser adds the multipart boundary.

```ts
const form = new FormData();
form.append("file", selectedFile);
const response = await fetch(`${apiBase}/scam/analyze/upload`, {
  method: "POST",
  body: form,
});
```

Accept only `.pdf`, `.png`, `.jpg`, or `.jpeg` in the UI and enforce a 10 MiB client-side limit for early feedback. The backend repeats those checks and returns `415` for unsupported signatures/types, `400` for corrupted files, `422` for empty/encrypted/page-limit/text-limit files, `413` for files over the limit, and `503` when OCR or the rule engine is unavailable. The successful response has `media_type`, `extracted_text`, and `analysis`; render only the returned analysis and never infer a result locally.

## Loading and errors

While either `POST` is pending, disable duplicate submission and show a loading state. The backend limits chats to 15 seconds at the LLM boundary; a frontend abort timeout slightly above that is reasonable.

| Status | Response | Frontend behavior |
|---|---|---|
| `422` | `{"detail":"Invalid request","errors":[{"field":"message","message":"...","type":"..."}]}` | Map `field` to the form control and show `message`. Do not show raw submitted text. |
| `413` | `{"detail":"Request body too large"}` | Ask the user to shorten the submission. |
| `429` | `{"detail":"Rate limit exceeded"}` | Tell the user to wait and retry; do not auto-loop. |
| `503` analysis | `{"detail":"Scam analysis is unavailable"}` | Show that analysis is temporarily unavailable; do not invent a risk score. |
| `503` chat | `{"detail":"Chat service is unavailable"}` | Show that chat is temporarily unavailable; do not invent a chatbot answer. |

Example request helper:

```ts
const apiBase = import.meta.env.VITE_API_BASE_URL;

export async function postJson(path: string, body: unknown) {
  const response = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  return { response, payload };
}
```
