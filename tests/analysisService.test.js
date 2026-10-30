import assert from 'node:assert/strict';
import test from 'node:test';

import { AnalysisApiError, checkJobOffer, normalizeApiResponse } from '../src/services/analysisService.js';
import { MAX_UPLOAD_BYTES } from '../src/utils/validation.js';

const apiBase = 'http://127.0.0.1:8000/api/v1';
const analysis = {
  analysis_id: '123e4567-e89b-12d3-a456-426614174000',
  risk_score: 85,
  risk_level: 'high',
  indicators: [{ code: 'advance_fee', severity: 'high', message: 'Payment requested.' }],
  evidence: [{ source: 'job_text', detail: 'Pay a fee.', indicator_code: 'advance_fee' }],
  scam_stage: 'payment_request',
  recommendations: ['Do not pay.'],
  summary: 'High-risk offer.',
  disclaimer: 'Automated guidance only.'
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

test('sends the exact text-analysis path and payload', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return jsonResponse(analysis);
  };

  const result = await checkJobOffer('Please review this recruiter offer.', null, apiBase);
  assert.equal(request.url, `${apiBase}/scam/analyze`);
  assert.deepEqual(JSON.parse(request.options.body), {
    job_text: 'Please review this recruiter offer.',
    job_url: null,
    company_name: null,
    contact_details: null
  });
  assert.equal(result.riskScore, 85);
});

test('normalizes only backend-supplied analysis fields', () => {
  const result = normalizeApiResponse(analysis, 'Submitted offer');
  assert.equal(result.analysis_id, analysis.analysis_id);
  assert.equal(result.risk_score, 85);
  assert.deepEqual(result.indicators, analysis.indicators);
  assert.deepEqual(result.evidence, analysis.evidence);
  assert.deepEqual(result.recommendations, analysis.recommendations);
  assert.equal(result.warningSigns[0].evidence, 'Pay a fee.');
});

test('uploads an actual file with multipart FormData and no manual content type', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return jsonResponse({ media_type: 'pdf', extracted_text: 'Pay a fee.', analysis });
  };
  const file = new File(['PDF data'], 'offer.pdf', { type: 'application/pdf' });

  const result = await checkJobOffer('', file, apiBase);
  assert.equal(request.url, `${apiBase}/scam/analyze/upload`);
  assert.ok(request.options.body instanceof FormData);
  assert.equal(request.options.body.get('file').name, file.name);
  assert.equal(request.options.headers, undefined);
  assert.equal(result.submittedText, 'Pay a fee.');
});

test('returns a service-unavailable error without a mock result', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => jsonResponse({ detail: 'Scam analysis is unavailable' }, 503);

  await assert.rejects(
    () => checkJobOffer('Please review this recruiter offer.', null, apiBase),
    (error) => error instanceof AnalysisApiError && error.status === 503 && error.message.includes('temporarily unavailable')
  );
});

test('maps validation, size, and rate-limit responses to safe retry messages', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  for (const [status, payload, expected] of [
    [422, { detail: 'Invalid request' }, 'Invalid request'],
    [413, { detail: 'Request body too large' }, 'request is too large'],
    [429, { detail: 'Rate limit exceeded' }, 'Too many requests']
  ]) {
    globalThis.fetch = async () => jsonResponse(payload, status);
    await assert.rejects(() => checkJobOffer('Please review this recruiter offer.', null, apiBase), new RegExp(expected));
  }
});

test('returns a connection error for network failures', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => { throw new TypeError('network down'); };

  await assert.rejects(
    () => checkJobOffer('Please review this recruiter offer.', null, apiBase),
    (error) => error instanceof AnalysisApiError && error.message.includes('Unable to connect')
  );
});

test('rejects invalid and oversized files before sending a request', async () => {
  const invalid = new File(['text'], 'offer.txt', { type: 'text/plain' });
  const oversized = new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], 'offer.pdf', { type: 'application/pdf' });

  await assert.rejects(() => checkJobOffer('', invalid, apiBase), /Only PDF, PNG, JPG, and JPEG/);
  await assert.rejects(() => checkJobOffer('', oversized, apiBase), /10 MiB/);
});
