/**
 * Credihire Background Service Worker
 * Handles context-menu registration, background analysis, notifications, and badge updates.
 */

try {
  importScripts("../lib/config.js", "../lib/storage.js", "../lib/api-client.js");
} catch (e) {
  console.error("Credihire: Failed to load background dependencies", e);
}

const CONTEXT_MENU_SELECTION_ID = "credihire_analyze_selection";
const CONTEXT_MENU_LINK_ID = "credihire_analyze_link";

/**
 * Initialize Context Menus on installation/update
 */
chrome.runtime.onInstalled.addListener(() => {
  // Remove existing to avoid duplicate ID errors
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_SELECTION_ID,
      title: "Analyze with Credihire",
      contexts: ["selection"]
    });

    chrome.contextMenus.create({
      id: CONTEXT_MENU_LINK_ID,
      title: "Check link credibility with Credihire",
      contexts: ["link"]
    });
  });

  // Set default extension badge
  updateBadge(null);
});

/**
 * Helper to update extension badge based on risk level
 */
function updateBadge(riskLevel, score = null) {
  try {
    if (!riskLevel) {
      chrome.action.setBadgeText({ text: "" });
      return;
    }

    const level = String(riskLevel).toLowerCase();
    let text = score !== null ? String(score) : "!";
    let color = "#64748b"; // default slate

    if (level === "critical" || level === "high") {
      color = "#ef4444"; // red
      text = score !== null ? `${score}` : "HIGH";
    } else if (level === "medium") {
      color = "#f59e0b"; // amber
      text = score !== null ? `${score}` : "MED";
    } else if (level === "low" || level === "safe") {
      color = "#10b981"; // green
      text = score !== null ? `${score}` : "SAFE";
    }

    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color });
  } catch (err) {
    console.warn("Could not update badge:", err);
  }
}

/**
 * Handle Context Menu Clicks
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const apiClient = new CredihireApiClient();

  if (info.menuItemId === CONTEXT_MENU_SELECTION_ID && info.selectionText) {
    const selectedText = info.selectionText.trim();
    const pageUrl = tab ? tab.url : "";

    // Save pending selection so popup can display it
    await StorageService.setPendingSelection(selectedText, pageUrl);

    // Provide visual feedback via badge
    chrome.action.setBadgeText({ text: "..." });
    chrome.action.setBadgeBackgroundColor({ color: "#00f2fe" });

    // Execute analysis in background
    const response = await apiClient.analyzeJob({
      job_text: selectedText,
      job_url: pageUrl && pageUrl.startsWith("http") ? pageUrl : undefined
    });

    if (response.success && response.data) {
      const data = response.data;
      updateBadge(data.risk_level, data.risk_score);

      // Save as latest result
      await StorageService.setLastResult({
        type: "job",
        input: { job_text: selectedText, job_url: pageUrl },
        response: data
      });

      // Add to history
      await StorageService.addToHistory({
        analysis_id: data.analysis_id,
        type: "scam",
        target: pageUrl || "Selected Text",
        risk_level: data.risk_level,
        risk_score: data.risk_score,
        summary: data.summary
      });

      // Attempt to open popup or notification
      tryOpenPopupOrNotify({
        title: `Credihire: ${data.risk_level.toUpperCase()} Risk (${data.risk_score}/100)`,
        message: data.summary || "Click extension icon to view full analysis details."
      });
    } else {
      updateBadge(null);
      await StorageService.setLastResult({
        type: "job",
        input: { job_text: selectedText, job_url: pageUrl },
        error: response
      });

      tryOpenPopupOrNotify({
        title: "Credihire Analysis Notice",
        message: response.message || "Could not complete background analysis. Open popup to retry."
      });
    }
  }

  if (info.menuItemId === CONTEXT_MENU_LINK_ID && info.linkUrl) {
    const targetUrl = info.linkUrl.trim();

    chrome.action.setBadgeText({ text: "..." });
    chrome.action.setBadgeBackgroundColor({ color: "#00f2fe" });

    const response = await apiClient.analyzeUrl({ url: targetUrl });

    if (response.success && response.data) {
      const data = response.data;
      updateBadge(data.risk_level, data.risk_score);

      await StorageService.setLastResult({
        type: "url",
        input: { url: targetUrl },
        response: data
      });

      await StorageService.addToHistory({
        analysis_id: data.analysis_id,
        type: "url",
        target: targetUrl,
        risk_level: data.risk_level,
        risk_score: data.risk_score,
        summary: data.summary
      });

      tryOpenPopupOrNotify({
        title: `Credihire URL Check: ${data.risk_level.toUpperCase()} (${data.risk_score}/100)`,
        message: data.summary || "Click extension icon to inspect SSL, redirects and indicators."
      });
    } else {
      updateBadge(null);
      await StorageService.setLastResult({
        type: "url",
        input: { url: targetUrl },
        error: response
      });

      tryOpenPopupOrNotify({
        title: "Credihire URL Notice",
        message: response.message || "Could not complete URL analysis. Open popup to retry."
      });
    }
  }
});

/**
 * Try opening popup if browser supports it, otherwise log/notify
 */
function tryOpenPopupOrNotify(notificationData) {
  if (chrome.action && typeof chrome.action.openPopup === "function") {
    chrome.action.openPopup().catch(() => {
      // User might not have browser window active or permission not available
    });
  }
}

/**
 * Handle Messages from Popup or Content Scripts
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { action, payload } = request || {};

  if (action === "UPDATE_BADGE") {
    updateBadge(payload ? payload.risk_level : null, payload ? payload.risk_score : null);
    sendResponse({ success: true });
    return true;
  }

  if (action === "CLEAR_BADGE") {
    updateBadge(null);
    sendResponse({ success: true });
    return true;
  }

  if (action === "GET_ACTIVE_TAB") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0) {
        sendResponse({ success: true, tab: tabs[0] });
      } else {
        sendResponse({ success: false, error: "No active tab found" });
      }
    });
    return true;
  }

  return false;
});
