/**
 * Credihire Extension API Client
 * Clean, single-source-of-truth HTTP client interfacing with Credihire FastAPI backend.
 * Conforms strictly to backend routes and schemas defined in FRONTEND_INTEGRATION.md.
 */

(function () {
  const getStorage = () => {
    if (typeof StorageService !== "undefined") return StorageService;
    if (typeof require !== "undefined") {
      try { return require("./storage.js"); } catch (_) {}
    }
    return null;
  };

  const getConfig = () => {
    if (typeof CONFIG !== "undefined") return CONFIG;
    if (typeof require !== "undefined") {
      try { return require("./config.js"); } catch (_) {}
    }
    return {
      DEFAULT_BACKEND_URL: "http://127.0.0.1:8000",
      API_PREFIX: "/api/v1",
      TIMEOUT_MS: 20000,
      ENDPOINTS: {
        HEALTH: "/health",
        READY: "/ready",
        SCAM_ANALYZE: "/scam/analyze",
        URL_ANALYZE: "/url/analyze"
      },
      LIMITS: {
        JOB_TEXT_MIN: 1,
        JOB_TEXT_MAX: 12000,
        URL_MIN: 1,
        URL_MAX: 2048
      },
      normalizeApiBaseUrl(url) {
        let trimmed = (url || "http://127.0.0.1:8000").trim().replace(/\/+$/, "");
        if (trimmed.endsWith("/api/v1")) return trimmed;
        return `${trimmed}/api/v1`;
      }
    };
  };

  class CredihireApiClient {
    constructor(customBaseUrl = null) {
      this.customBaseUrl = customBaseUrl;
    }

    async getBaseApiUrl() {
      if (this.customBaseUrl) {
        const config = getConfig();
        return config.normalizeApiBaseUrl(this.customBaseUrl);
      }
      const storage = getStorage();
      const config = getConfig();
      if (storage) {
        const configuredUrl = await storage.getBackendUrl();
        return config.normalizeApiBaseUrl(configuredUrl);
      }
      return config.normalizeApiBaseUrl(config.DEFAULT_BACKEND_URL);
    }

    /**
     * Internal request wrapper with timeout, json parsing, and error classification.
     */
    async _request(endpoint, options = {}) {
      const config = getConfig();
      const baseUrl = await this.getBaseApiUrl();
      const url = `${baseUrl}${endpoint}`;

      const timeoutMs = options.timeoutMs || config.TIMEOUT_MS || 20000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const headers = {
        "Accept": "application/json",
        ...(options.headers || {})
      };

      if (options.body && typeof options.body === "object") {
        headers["Content-Type"] = "application/json";
      }

      try {
        const response = await fetch(url, {
          method: options.method || "GET",
          headers,
          body: options.body ? (typeof options.body === "string" ? options.body : JSON.stringify(options.body)) : undefined,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        let payload = null;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          try {
            payload = await response.json();
          } catch (jsonErr) {
            payload = null;
          }
        } else {
          payload = await response.text();
        }

        if (!response.ok) {
          return this._handleHttpError(response.status, payload, url);
        }

        return {
          success: true,
          status: response.status,
          data: payload
        };
      } catch (err) {
        clearTimeout(timeoutId);
        return this._handleNetworkError(err, url);
      }
    }

    _handleHttpError(status, payload, url) {
      let errorType = "HTTP_ERROR";
      let userMessage = "An unexpected server error occurred.";
      let detail = payload;

      if (status === 404) {
        errorType = "NOT_FOUND";
        userMessage = `Endpoint not found at ${url}. Verify backend URL configuration.`;
      } else if (status === 413) {
        errorType = "PAYLOAD_TOO_LARGE";
        userMessage = "Submission content is too large. Please shorten the text.";
      } else if (status === 422) {
        errorType = "VALIDATION_ERROR";
        if (payload && payload.detail) {
          if (Array.isArray(payload.detail)) {
            const first = payload.detail[0];
            userMessage = first && first.msg ? `Validation error: ${first.msg}` : "Invalid input parameters.";
          } else {
            userMessage = typeof payload.detail === "string" ? payload.detail : "Invalid request parameters.";
          }
        } else {
          userMessage = "Input validation failed. Please review your input.";
        }
      } else if (status === 429) {
        errorType = "RATE_LIMITED";
        userMessage = "API rate limit exceeded. Please wait a few moments before trying again.";
      } else if (status === 503) {
        errorType = "SERVICE_UNAVAILABLE";
        const detailMsg = payload && payload.detail ? payload.detail : "Analysis service is temporarily unavailable";
        userMessage = `${detailMsg}. Ensure backend rule engine and models are configured.`;
      } else if (status >= 500) {
        errorType = "SERVER_ERROR";
        userMessage = `Backend internal error (HTTP ${status}). Check backend console logs.`;
      }

      return {
        success: false,
        status,
        errorType,
        message: userMessage,
        detail,
        url
      };
    }

    _handleNetworkError(err, url) {
      if (err.name === "AbortError") {
        return {
          success: false,
          status: 0,
          errorType: "TIMEOUT",
          message: "Request timed out. The Credihire backend took too long to respond.",
          detail: err.message,
          url
        };
      }

      return {
        success: false,
        status: 0,
        errorType: "NETWORK_ERROR",
        message: "Cannot connect to Credihire backend. Verify that the FastAPI server is running.",
        detail: err.message || "Failed to fetch",
        url
      };
    }

    // Health check
    async checkHealth() {
      const config = getConfig();
      return this._request(config.ENDPOINTS.HEALTH, { method: "GET", timeoutMs: 5000 });
    }

    // Readiness check
    async checkReadiness() {
      const config = getConfig();
      return this._request(config.ENDPOINTS.READY, { method: "GET", timeoutMs: 5000 });
    }

    /**
     * Analyze job or task offer
     * @param {Object} params
     * @param {string} params.job_text - Required (1 to 12,000 chars)
     * @param {string} [params.job_url] - Optional public URL
     * @param {string} [params.company_name] - Optional employer name
     * @param {string} [params.contact_details] - Optional recruiter contact
     */
    async analyzeJob(params) {
      const config = getConfig();
      const { job_text, job_url, company_name, contact_details } = params || {};

      // Client-side pre-validation
      if (!job_text || typeof job_text !== "string" || job_text.trim().length === 0) {
        return {
          success: false,
          errorType: "CLIENT_VALIDATION",
          message: "Please enter or select job text to analyze."
        };
      }

      const trimmedText = job_text.trim();
      if (trimmedText.length > config.LIMITS.JOB_TEXT_MAX) {
        return {
          success: false,
          errorType: "CLIENT_VALIDATION",
          message: `Job text exceeds maximum length of ${config.LIMITS.JOB_TEXT_MAX.toLocaleString()} characters (current: ${trimmedText.length.toLocaleString()}).`
        };
      }

      const payload = {
        job_text: trimmedText
      };

      if (job_url && typeof job_url === "string" && job_url.trim()) {
        const trimmedUrl = job_url.trim();
        if (config.isValidUrl(trimmedUrl)) {
          payload.job_url = trimmedUrl;
        }
      }

      if (company_name && typeof company_name === "string" && company_name.trim()) {
        payload.company_name = company_name.trim().substring(0, config.LIMITS.COMPANY_NAME_MAX);
      }

      if (contact_details && typeof contact_details === "string" && contact_details.trim()) {
        payload.contact_details = contact_details.trim().substring(0, config.LIMITS.CONTACT_DETAILS_MAX);
      }

      return this._request(config.ENDPOINTS.SCAM_ANALYZE, {
        method: "POST",
        body: payload
      });
    }

    /**
     * Analyze recruitment website URL credibility
     * @param {Object} params
     * @param {string} params.url - Required (1 to 2,048 chars)
     */
    async analyzeUrl(params) {
      const config = getConfig();
      const { url } = params || {};

      if (!url || typeof url !== "string" || url.trim().length === 0) {
        return {
          success: false,
          errorType: "CLIENT_VALIDATION",
          message: "Please provide a valid website URL to analyze."
        };
      }

      const trimmedUrl = url.trim();
      if (!config.isValidUrl(trimmedUrl)) {
        return {
          success: false,
          errorType: "CLIENT_VALIDATION",
          message: "Please enter a valid HTTP or HTTPS URL (e.g., https://careers.example.com)."
        };
      }

      if (trimmedUrl.length > config.LIMITS.URL_MAX) {
        return {
          success: false,
          errorType: "CLIENT_VALIDATION",
          message: `URL exceeds maximum limit of ${config.LIMITS.URL_MAX} characters.`
        };
      }

      return this._request(config.ENDPOINTS.URL_ANALYZE, {
        method: "POST",
        body: { url: trimmedUrl }
      });
    }
  }

  // Export
  if (typeof module !== "undefined" && module.exports) {
    module.exports = CredihireApiClient;
  } else if (typeof globalThis !== "undefined") {
    globalThis.CredihireApiClient = CredihireApiClient;
  }
})();
