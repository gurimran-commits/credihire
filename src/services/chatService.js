const runtimeApiBase = typeof import.meta !== 'undefined' && import.meta.env
  ? import.meta.env.VITE_API_BASE_URL
  : undefined;

const MAX_MESSAGE_LENGTH = 4000;

export class ChatApiError extends Error {
  constructor(message, status = null) {
    super(message);
    this.name = 'ChatApiError';
    this.status = status;
  }
}

export function createSessionId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    return (character === 'x' ? value : (value & 0x3) | 0x8).toString(16);
  });
}

function getApiBaseUrl(apiBaseUrl = runtimeApiBase) {
  if (!apiBaseUrl || !apiBaseUrl.trim()) {
    throw new ChatApiError('Chat service is not configured. Set VITE_API_BASE_URL and try again.');
  }
  return apiBaseUrl.replace(/\/$/, '');
}

function errorMessage(status, payload) {
  if (status === 422) return payload?.detail || 'Please correct your message and try again.';
  if (status === 429) return 'Chat is temporarily rate-limited. Please wait and retry.';
  if (status === 503) return 'Chat service is temporarily unavailable. Please try again later.';
  return 'Chat could not respond. Please try again.';
}

function validateResponse(payload) {
  if (!payload || typeof payload.reply !== 'string' || !payload.reply.trim()
    || typeof payload.session_id !== 'string' || typeof payload.message_id !== 'string') {
    throw new ChatApiError('Chat returned an invalid response. Please try again.');
  }
  return payload;
}

export async function sendChatMessage({ message, sessionId, analysisId, analyzeMessage = false }, apiBaseUrl) {
  const trimmedMessage = typeof message === 'string' ? message.trim() : '';
  if (!trimmedMessage) throw new ChatApiError('Please enter a message.');
  if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
    throw new ChatApiError(`Messages must be ${MAX_MESSAGE_LENGTH.toLocaleString()} characters or fewer.`);
  }

  let response;
  try {
    response = await fetch(`${getApiBaseUrl(apiBaseUrl)}/chat/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        message: trimmedMessage,
        session_id: sessionId || null,
        analysis_id: analysisId || null,
        analyze_message: Boolean(analyzeMessage)
      })
    });
  } catch {
    throw new ChatApiError('Unable to connect to the chat service. Check your connection and try again.');
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Keep proxy and provider errors out of the user interface.
  }
  if (!response.ok) throw new ChatApiError(errorMessage(response.status, payload), response.status);
  return validateResponse(payload);
}
