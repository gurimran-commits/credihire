/**
 * Credihire Extension Configuration
 * Centralized settings and endpoint definitions.
 */

const CONFIG = {
  DEFAULT_BACKEND_URL: "http://127.0.0.1:8000",
  API_PREFIX: "/api/v1",
  TIMEOUT_MS: 20000,

  // Endpoint paths relative to API_PREFIX
  ENDPOINTS: {
    HEALTH: "/health",
    READY: "/ready",
    SCAM_ANALYZE: "/scam/analyze",
    URL_ANALYZE: "/url/analyze",
    CHAT_MESSAGES: "/chat/messages"
  },

  // Limits aligning with backend pydantic schemas
  LIMITS: {
    JOB_TEXT_MIN: 1,
    JOB_TEXT_MAX: 12000,
    URL_MIN: 1,
    URL_MAX: 2048,
    COMPANY_NAME_MAX: 200,
    CONTACT_DETAILS_MAX: 1000,
    HISTORY_MAX: 15
  },

  // Normalizes user-entered backend URL to ensure correct API prefix
  normalizeApiBaseUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== "string") {
      return `${CONFIG.DEFAULT_BACKEND_URL}${CONFIG.API_PREFIX}`;
    }

    let trimmed = rawUrl.trim().replace(/\/+$/, "");
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      trimmed = `http://${trimmed}`;
    }

    // If the user already appended /api/v1, preserve it
    if (trimmed.endsWith(CONFIG.API_PREFIX)) {
      return trimmed;
    }

    // If user provided origin like http://127.0.0.1:8000, append /api/v1
    return `${trimmed}${CONFIG.API_PREFIX}`;
  },

  // Validates backend URL format
  isValidUrl(urlString) {
    if (!urlString || typeof urlString !== "string") return false;
    try {
      const parsed = new URL(urlString.trim());
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch (_) {
      return false;
    }
  }
};

// Export for ES modules and standard browser script contexts
if (typeof module !== "undefined" && module.exports) {
  module.exports = CONFIG;
} else if (typeof globalThis !== "undefined") {
  globalThis.CONFIG = CONFIG;
}
