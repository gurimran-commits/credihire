import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AnalysisApiError,
  checkUrlCredibility,
  normalizeUrlApiResponse
} from '../src/services/analysisService.js';
import { validateUrlInput } from '../src/utils/validation.js';

const apiBase = 'http://127.0.0.1:8000/api/v1';

const sampleUrlResponse = {
  analysis_id: '123e4567-e89b-12d3-a456-426614174000',
  target_url: 'https://careers.google.com',
  final_url: 'https://careers.google.com',
  risk_level: 'safe',
  risk_score: 5,
  is_redirected: false,
  redirect_chain: [],
  ssl_info: {
    is_valid: true,
    issuer: 'Google Trust Services',
    subject: '*.google.com',
    expires_at: 'Jan 1 2027'
  },
  indicators: [],
  recommendations: ['Verify corporate hiring portals directly.'],
  summary: 'No suspicious indicators found.',
  reputation_status: 'not_checked',
  disclaimer: 'Automated guidance only.'
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

test('validateUrlInput accepts clean URLs', () => {
  const result = validateUrlInput('https://careers.google.com');
  assert.equal(result.isValid, true);
  assert.equal(result.sanitizedUrl, 'https://careers.google.com');

  const noScheme = validateUrlInput('google.com');
  assert.equal(noScheme.isValid, true);
});

test('validateUrlInput rejects empty or disallowed schemes', () => {
  const empty = validateUrlInput('');
  assert.equal(empty.isValid, false);
  assert.match(empty.error, /Please paste a recruitment website URL/);

  const ftp = validateUrlInput('ftp://example.com/portal');
  assert.equal(ftp.isValid, false);
  assert.match(ftp.error, /Only http:\/\/ and https:\/\/ URLs/);

  const js = validateUrlInput('javascript:alert(1)');
  assert.equal(js.isValid, false);

  const spaces = validateUrlInput('https://example.com /path');
  assert.equal(spaces.isValid, false);
});

test('sends the exact /url/analyze path and payload', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return jsonResponse(sampleUrlResponse);
  };

  const result = await checkUrlCredibility('https://careers.google.com', apiBase);
  assert.equal(request.url, `${apiBase}/url/analyze`);
  assert.deepEqual(JSON.parse(request.options.body), { url: 'https://careers.google.com' });
  assert.equal(result.isUrlAnalysis, true);
  assert.equal(result.riskScore, 5);
  assert.equal(result.riskLevel, 'safe');
  assert.equal(result.reputationStatus, 'not_checked');
});

test('normalizes URL credibility response fields correctly', () => {
  const normalized = normalizeUrlApiResponse(sampleUrlResponse);
  assert.equal(normalized.targetUrl, 'https://careers.google.com');
  assert.equal(normalized.finalUrl, 'https://careers.google.com');
  assert.equal(normalized.sslInfo.is_valid, true);
  assert.equal(normalized.sslInfo.issuer, 'Google Trust Services');
  assert.equal(normalized.reputationStatus, 'not_checked');
  assert.equal(normalized.recommendations[0], 'Verify corporate hiring portals directly.');
  assert.equal(normalized.recommendationSteps[0].step, 1);
});

test('handles API errors safely without throwing raw responses', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async () => jsonResponse({ detail: 'Only http:// and https:// URLs are supported.' }, 422);
  await assert.rejects(
    () => checkUrlCredibility('https://example.com', apiBase),
    (err) => err instanceof AnalysisApiError && err.status === 422
  );

  globalThis.fetch = async () => { throw new TypeError('Network failure'); };
  await assert.rejects(
    () => checkUrlCredibility('https://example.com', apiBase),
    (err) => err instanceof AnalysisApiError && /Unable to connect/i.test(err.message)
  );
});
