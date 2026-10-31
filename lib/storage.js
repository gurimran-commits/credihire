/**
 * Credihire Extension Storage Helper
 * Wraps chrome.storage with promise-based helpers and memory fallback.
 */

(function () {
  const STORAGE_KEYS = {
    BACKEND_URL: "credihire_backend_url",
    PENDING_SELECTION: "credihire_pending_selection",
    LAST_RESULT: "credihire_last_result",
    HISTORY: "credihire_history"
  };

  // Fallback in-memory storage for non-extension environments (e.g. tests)
  const memoryStore = {};

  const hasChromeStorage = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;

  const storageService = {
    KEYS: STORAGE_KEYS,

    async get(key) {
      if (hasChromeStorage) {
        return new Promise((resolve) => {
          chrome.storage.local.get([key], (result) => {
            resolve(result ? result[key] : undefined);
          });
        });
      }
      return memoryStore[key];
    },

    async set(key, value) {
      if (hasChromeStorage) {
        return new Promise((resolve) => {
          chrome.storage.local.set({ [key]: value }, () => {
            resolve();
          });
        });
      }
      memoryStore[key] = value;
    },

    async remove(key) {
      if (hasChromeStorage) {
        return new Promise((resolve) => {
          chrome.storage.local.remove([key], () => {
            resolve();
          });
        });
      }
      delete memoryStore[key];
    },

    // Specific domain helpers
    async getBackendUrl() {
      const stored = await this.get(STORAGE_KEYS.BACKEND_URL);
      const defaultUrl = (typeof CONFIG !== "undefined" && CONFIG.DEFAULT_BACKEND_URL)
        ? CONFIG.DEFAULT_BACKEND_URL
        : "http://127.0.0.1:8000";
      return stored || defaultUrl;
    },

    async setBackendUrl(url) {
      return this.set(STORAGE_KEYS.BACKEND_URL, (url || "").trim());
    },

    async getPendingSelection() {
      return this.get(STORAGE_KEYS.PENDING_SELECTION);
    },

    async setPendingSelection(text, pageUrl) {
      return this.set(STORAGE_KEYS.PENDING_SELECTION, {
        text: (text || "").trim(),
        pageUrl: pageUrl || "",
        timestamp: Date.now()
      });
    },

    async clearPendingSelection() {
      return this.remove(STORAGE_KEYS.PENDING_SELECTION);
    },

    async getLastResult() {
      return this.get(STORAGE_KEYS.LAST_RESULT);
    },

    async setLastResult(resultData) {
      return this.set(STORAGE_KEYS.LAST_RESULT, {
        ...resultData,
        timestamp: Date.now()
      });
    },

    async clearLastResult() {
      return this.remove(STORAGE_KEYS.LAST_RESULT);
    },

    async getHistory() {
      const history = await this.get(STORAGE_KEYS.HISTORY);
      return Array.isArray(history) ? history : [];
    },

    async addToHistory(entry) {
      const current = await this.getHistory();
      const limit = (typeof CONFIG !== "undefined" && CONFIG.LIMITS && CONFIG.LIMITS.HISTORY_MAX) || 15;

      const newEntry = {
        id: entry.analysis_id || `hist_${Date.now()}`,
        type: entry.type || "scam", // 'scam' or 'url'
        target: entry.target || (entry.type === "url" ? entry.target_url : "Job Offer Analysis"),
        risk_level: entry.risk_level || "low",
        risk_score: entry.risk_score ?? 0,
        summary: entry.summary || "",
        timestamp: Date.now()
      };

      // Filter out duplicate IDs if any and prepend
      const filtered = current.filter(item => item.id !== newEntry.id);
      const updated = [newEntry, ...filtered].slice(0, limit);
      await this.set(STORAGE_KEYS.HISTORY, updated);
      return updated;
    },

    async clearHistory() {
      return this.set(STORAGE_KEYS.HISTORY, []);
    }
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = storageService;
  } else if (typeof globalThis !== "undefined") {
    globalThis.StorageService = storageService;
  }
})();
