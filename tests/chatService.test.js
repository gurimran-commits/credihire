import assert from 'node:assert/strict';
import test from 'node:test';

import { ChatApiError, sendChatMessage } from '../src/services/chatService.js';

const apiBase = 'http://127.0.0.1:8000/api/v1';
const response = {
  session_id: '123e4567-e89b-12d3-a456-426614174000',
  message_id: '123e4567-e89b-12d3-a456-426614174001',
  reply: 'Do not pay a recruiter before verifying the offer.',
  disclaimer: 'Guidance only.',
  analysis: null
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

test('sends the documented chat path and payload', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return jsonResponse(response);
  };

  await sendChatMessage({ message: ' Is this job safe? ', sessionId: 'session-1', analysisId: 'analysis-1', analyzeMessage: true }, apiBase);
  assert.equal(request.url, `${apiBase}/chat/messages`);
  assert.deepEqual(JSON.parse(request.options.body), {
    message: 'Is this job safe?',
    session_id: 'session-1',
    analysis_id: 'analysis-1',
    analyze_message: true
  });
});

test('reuses the caller session ID on subsequent messages', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const payloads = [];
  globalThis.fetch = async (_url, options) => {
    payloads.push(JSON.parse(options.body));
    return jsonResponse(response);
  };

  await sendChatMessage({ message: 'First question', sessionId: response.session_id }, apiBase);
  await sendChatMessage({ message: 'Second question', sessionId: response.session_id }, apiBase);
  assert.equal(payloads[0].session_id, response.session_id);
  assert.equal(payloads[1].session_id, response.session_id);
});

test('returns a successful reply and deterministic analysis unchanged', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const analysis = { risk_score: 80, risk_level: 'high', scam_stage: 'payment_request', indicators: [], evidence: [], recommendations: [] };
  globalThis.fetch = async () => jsonResponse({ ...response, analysis });

  const result = await sendChatMessage({ message: 'Analyze this', analyzeMessage: true }, apiBase);
  assert.equal(result.reply, response.reply);
  assert.deepEqual(result.analysis, analysis);
});

test('returns safe errors for unavailable chat service and network failures', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => jsonResponse({ detail: 'provider details' }, 503);
  await assert.rejects(() => sendChatMessage({ message: 'Hello' }, apiBase), (error) => error instanceof ChatApiError && error.status === 503 && error.message.includes('temporarily unavailable'));

  globalThis.fetch = async () => { throw new TypeError('network down'); };
  await assert.rejects(() => sendChatMessage({ message: 'Hello' }, apiBase), /Unable to connect/);
});

test('rejects empty messages before making a request', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => { throw new Error('fetch must not be called'); };
  await assert.rejects(() => sendChatMessage({ message: '   ' }, apiBase), /Please enter a message/);
});
