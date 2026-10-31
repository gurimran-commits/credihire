/**
 * Credihire Content Script
 * Runs only on explicit user interaction. Does NOT collect or transmit any data on load.
 * Complies strictly with zero-telemetry and explicit-user-action security constraints.
 */

(function () {
  // Prevent duplicate listener registration if injected multiple times
  if (window.__credihire_content_script_initialized) {
    return;
  }
  window.__credihire_content_script_initialized = true;

  /**
   * Helper to extract clean visible text while removing non-content noise
   */
  function extractCleanPageText() {
    // Priority job containers
    const candidates = [
      document.querySelector("article"),
      document.querySelector('[role="main"]'),
      document.querySelector("#job-details"),
      document.querySelector(".job-details"),
      document.querySelector("#job-description"),
      document.querySelector(".job-description"),
      document.querySelector(".posting-content"),
      document.querySelector(".jobs-description-content"),
      document.querySelector("main")
    ];

    let targetEl = candidates.find(el => el && el.innerText && el.innerText.trim().length > 100);

    // Fallback to body clone
    if (!targetEl) {
      targetEl = document.body;
    }

    if (!targetEl) {
      return "";
    }

    // Clone element to safely remove unwanted children without touching the live page
    const clone = targetEl.cloneNode(true);
    const ignoreTags = ["script", "style", "noscript", "svg", "nav", "header", "footer", "iframe", "button"];
    ignoreTags.forEach(tag => {
      const nodes = clone.querySelectorAll(tag);
      nodes.forEach(node => node.remove());
    });

    const rawText = clone.innerText || clone.textContent || "";

    // Normalize consecutive whitespace and blank lines
    const cleaned = rawText
      .replace(/\r\n/g, "\n")
      .replace(/\t/g, " ")
      .replace(/ +/g, " ")
      .replace(/\n\s*\n\s*\n+/g, "\n\n")
      .trim();

    // Respect backend maximum limit of 12,000 characters
    const maxChars = 12000;
    if (cleaned.length > maxChars) {
      return cleaned.slice(0, maxChars);
    }
    return cleaned;
  }

  /**
   * Message router listening for explicit popup/background requests
   */
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
      const { action } = request || {};

      if (action === "PING") {
        sendResponse({ success: true, status: "ready" });
        return true;
      }

      if (action === "GET_SELECTION") {
        const selected = window.getSelection() ? window.getSelection().toString().trim() : "";
        sendResponse({
          success: true,
          selectionText: selected,
          url: window.location.href,
          title: document.title
        });
        return true;
      }

      if (action === "EXTRACT_PAGE_CONTENT") {
        const text = extractCleanPageText();
        sendResponse({
          success: true,
          pageText: text,
          url: window.location.href,
          title: document.title,
          charCount: text.length
        });
        return true;
      }

      // Unhandled action
      sendResponse({ success: false, error: `Unknown action: ${action}` });
      return true;
    } catch (err) {
      sendResponse({ success: false, error: err.message || "Content script error" });
      return true;
    }
  });
})();
