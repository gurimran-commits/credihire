/**
 * Credihire Extension - Popup Controller
 * Minimalist Clean Theme with Interactive Evidence Highlighting
 */

document.addEventListener("DOMContentLoaded", async () => {
  // Services
  const apiClient = new CredihireApiClient();
  let currentActiveTab = null;
  let lastAnalysisResult = null;
  let lastAnalysisType = "job"; // "job" or "url"
  let lastAnalysisInputText = "";

  // DOM Elements - Navigation & Header
  const navTabs = document.querySelectorAll(".nav-tab");
  const tabPanes = document.querySelectorAll(".tab-pane");
  const backendStatusIndicator = document.getElementById("backend-status-indicator");
  const backendStatusLabel = document.getElementById("backend-status-label");
  const btnQuickSettings = document.getElementById("btn-quick-settings");
  const globalAlert = document.getElementById("global-alert");
  const globalAlertMessage = document.getElementById("global-alert-message");
  const globalAlertAction = document.getElementById("global-alert-action");
  const footerConnectionText = document.getElementById("footer-connection-text");

  // DOM Elements - Job Tab
  const btnGrabSelection = document.getElementById("btn-grab-selection");
  const btnExtractPage = document.getElementById("btn-extract-page");
  const inputJobText = document.getElementById("input-job-text");
  const jobCharCount = document.getElementById("job-char-count");
  const toggleOptionalFields = document.getElementById("toggle-optional-fields");
  const optionalFieldsBody = document.getElementById("optional-fields-body");
  const inputJobUrl = document.getElementById("input-job-url");
  const inputCompanyName = document.getElementById("input-company-name");
  const inputContactDetails = document.getElementById("input-contact-details");
  const btnAnalyzeJob = document.getElementById("btn-analyze-job");

  // DOM Elements - URL Tab
  const btnUseTabUrl = document.getElementById("btn-use-tab-url");
  const inputTargetUrl = document.getElementById("input-target-url");
  const btnAnalyzeUrl = document.getElementById("btn-analyze-url");

  // DOM Elements - History Tab
  const historyList = document.getElementById("history-list");
  const historyEmpty = document.getElementById("history-empty");
  const btnClearHistory = document.getElementById("btn-clear-history");

  // DOM Elements - Settings Tab
  const inputBackendUrl = document.getElementById("input-backend-url");
  const btnTestConnection = document.getElementById("btn-test-connection");
  const btnSaveSettings = document.getElementById("btn-save-settings");
  const connectionTestResult = document.getElementById("connection-test-result");

  // DOM Elements - Overlays & Views
  const loadingState = document.getElementById("loading-state");
  const loadingStatusText = document.getElementById("loading-status-text");
  const resultView = document.getElementById("result-view");
  const btnBackToInput = document.getElementById("btn-back-to-input");
  const btnCopyReport = document.getElementById("btn-copy-report");
  const errorView = document.getElementById("error-view");
  const errorTitle = document.getElementById("error-title");
  const errorMessage = document.getElementById("error-message");
  const errorDetailBox = document.getElementById("error-detail-box");
  const btnErrorRetry = document.getElementById("btn-error-retry");
  const btnErrorSettings = document.getElementById("btn-error-settings");

  // DOM Elements - Result Fields
  const riskGaugeCircle = document.getElementById("risk-gauge-circle");
  const riskScoreNumber = document.getElementById("risk-score-number");
  const riskLevelBadge = document.getElementById("risk-level-badge");
  const scamStageBadge = document.getElementById("scam-stage-badge");
  const resultTypeLabel = document.getElementById("result-type-label");
  const resultSummaryText = document.getElementById("result-summary-text");
  const analyzedTextSection = document.getElementById("analyzed-text-section");
  const highlightedTextContainer = document.getElementById("highlighted-text-container");
  const highlightedTextEmpty = document.getElementById("highlighted-text-empty");
  const urlMetricsCard = document.getElementById("url-metrics-card");
  const urlMetricTarget = document.getElementById("url-metric-target");
  const urlMetricFinal = document.getElementById("url-metric-final");
  const urlMetricSsl = document.getElementById("url-metric-ssl");
  const urlMetricRedirect = document.getElementById("url-metric-redirect");
  const redirectChainBox = document.getElementById("redirect-chain-box");
  const redirectHopsList = document.getElementById("redirect-hops-list");
  const indicatorsSection = document.getElementById("indicators-section");
  const indicatorsCountBadge = document.getElementById("indicators-count-badge");
  const indicatorsList = document.getElementById("indicators-list");
  const evidenceSection = document.getElementById("evidence-section");
  const evidenceCountBadge = document.getElementById("evidence-count-badge");
  const evidenceList = document.getElementById("evidence-list");
  const evidenceEmptyNote = document.getElementById("evidence-empty-note");
  const aiEnrichmentSection = document.getElementById("ai-enrichment-section");
  const aiSummaryText = document.getElementById("ai-summary-text");
  const aiEvidenceList = document.getElementById("ai-evidence-list");
  const recommendationsList = document.getElementById("recommendations-list");
  const resultDisclaimerText = document.getElementById("result-disclaimer-text");

  // =========================================================================
  // Initialization
  // =========================================================================

  await initBackendConfig();
  await queryCurrentTab();
  await checkBackendStatus();
  await checkPendingSelectionOrLastResult();
  setupEventListeners();

  // =========================================================================
  // Tab Switching
  // =========================================================================

  function switchTab(tabId) {
    navTabs.forEach(tab => {
      tab.classList.toggle("active", tab.dataset.tab === tabId);
    });
    tabPanes.forEach(pane => {
      pane.classList.toggle("active", pane.id === tabId);
    });

    hideOverlays();

    if (tabId === "tab-history") {
      renderHistory();
    }
  }

  function hideOverlays() {
    loadingState.classList.add("hidden");
    resultView.classList.add("hidden");
    errorView.classList.add("hidden");
  }

  // =========================================================================
  // Backend Configuration & Status
  // =========================================================================

  async function initBackendConfig() {
    const savedUrl = await StorageService.getBackendUrl();
    inputBackendUrl.value = savedUrl;
    footerConnectionText.textContent = savedUrl.replace(/^https?:\/\//, "");
  }

  async function checkBackendStatus() {
    backendStatusIndicator.className = "status-indicator checking";
    backendStatusLabel.textContent = "Checking...";

    const health = await apiClient.checkHealth();
    if (!health.success) {
      backendStatusIndicator.className = "status-indicator offline";
      backendStatusLabel.textContent = "Offline";
      backendStatusIndicator.title = `Backend unreachable: ${health.message}`;
      showGlobalAlert("Credihire backend is offline. Ensure FastAPI is running on port 8000.", "Settings", () => switchTab("tab-settings"));
      return;
    }

    const ready = await apiClient.checkReadiness();
    if (ready.success && ready.data) {
      const isDegraded = ready.data.status === "degraded";
      if (isDegraded) {
        backendStatusIndicator.className = "status-indicator degraded";
        backendStatusLabel.textContent = "Degraded";
        backendStatusIndicator.title = "Backend is reachable but some components (Groq/Rule Engine) are degraded.";
        hideGlobalAlert();
      } else {
        backendStatusIndicator.className = "status-indicator online";
        backendStatusLabel.textContent = "Online";
        backendStatusIndicator.title = "Credihire Backend is connected and fully operational.";
        hideGlobalAlert();
      }
    } else {
      backendStatusIndicator.className = "status-indicator online";
      backendStatusLabel.textContent = "Online";
      hideGlobalAlert();
    }
  }

  function showGlobalAlert(message, actionText, actionFn) {
    globalAlertMessage.textContent = message;
    globalAlertAction.textContent = actionText;
    globalAlertAction.onclick = actionFn;
    globalAlert.classList.remove("hidden");
  }

  function hideGlobalAlert() {
    globalAlert.classList.add("hidden");
  }

  // =========================================================================
  // Active Tab & Selection Helpers
  // =========================================================================

  async function queryCurrentTab() {
    try {
      if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs.length > 0) {
          currentActiveTab = tabs[0];
          if (currentActiveTab.url && currentActiveTab.url.startsWith("http")) {
            inputTargetUrl.value = currentActiveTab.url;
            inputJobUrl.value = currentActiveTab.url;
          }
        }
      }
    } catch (e) {
      console.warn("Could not query active tab:", e);
    }
  }

  async function sendMessageToActiveTab(message) {
    if (!currentActiveTab || !currentActiveTab.id) {
      await queryCurrentTab();
    }
    if (!currentActiveTab || !currentActiveTab.id) {
      throw new Error("No active browser tab found.");
    }

    const tabId = currentActiveTab.id;

    if (currentActiveTab.url && (currentActiveTab.url.startsWith("chrome://") || currentActiveTab.url.startsWith("edge://") || currentActiveTab.url.startsWith("about:"))) {
      throw new Error("Browser internal pages cannot be inspected for security reasons. Please try on a standard website.");
    }

    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (_) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ["content/content-script.js"]
        });
        return await chrome.tabs.sendMessage(tabId, message);
      } catch (injectErr) {
        throw new Error(`Cannot inspect page: ${injectErr.message}`);
      }
    }
  }

  async function checkPendingSelectionOrLastResult() {
    const pending = await StorageService.getPendingSelection();
    if (pending && pending.text) {
      inputJobText.value = pending.text;
      updateCharCount();
      if (pending.pageUrl) {
        inputJobUrl.value = pending.pageUrl;
      }
      await StorageService.clearPendingSelection();
    }

    const lastResult = await StorageService.getLastResult();
    if (lastResult && (Date.now() - lastResult.timestamp < 180000)) {
      if (lastResult.response) {
        const originalInput = lastResult.input && lastResult.input.job_text ? lastResult.input.job_text : "";
        renderResult(lastResult.response, lastResult.type || "job", originalInput);
      }
    }
  }

  // =========================================================================
  // Input Handling
  // =========================================================================

  function updateCharCount() {
    const len = inputJobText.value.length;
    const max = CONFIG.LIMITS.JOB_TEXT_MAX || 12000;
    jobCharCount.textContent = `${len.toLocaleString()} / ${max.toLocaleString()}`;
    if (len > max) {
      jobCharCount.style.color = "var(--risk-critical)";
    } else {
      jobCharCount.style.color = "var(--text-muted)";
    }
  }

  // =========================================================================
  // Analysis Actions
  // =========================================================================

  async function handleAnalyzeJob() {
    const text = inputJobText.value.trim();
    if (!text) {
      showError("Input Required", "Please paste or capture job offer text before running analysis.");
      return;
    }

    if (text.length > (CONFIG.LIMITS.JOB_TEXT_MAX || 12000)) {
      showError("Text Limit Exceeded", `Submitted text is ${text.length.toLocaleString()} characters. The maximum allowed is ${(CONFIG.LIMITS.JOB_TEXT_MAX || 12000).toLocaleString()}. Please shorten the text.`);
      return;
    }

    lastAnalysisType = "job";
    lastAnalysisInputText = text;
    showLoading("Evaluating job offer text against scam detection rules...");

    const payload = {
      job_text: text,
      job_url: inputJobUrl.value.trim() || undefined,
      company_name: inputCompanyName.value.trim() || undefined,
      contact_details: inputContactDetails.value.trim() || undefined
    };

    const result = await apiClient.analyzeJob(payload);
    hideLoading();

    if (result.success && result.data) {
      renderResult(result.data, "job", text);

      await StorageService.setLastResult({
        type: "job",
        input: payload,
        response: result.data
      });
      await StorageService.addToHistory({
        analysis_id: result.data.analysis_id,
        type: "scam",
        target: payload.job_url || payload.company_name || "Job Offer Analysis",
        risk_level: result.data.risk_level,
        risk_score: result.data.risk_score,
        summary: result.data.summary
      });

      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.sendMessage({
          action: "UPDATE_BADGE",
          payload: { risk_level: result.data.risk_level, risk_score: result.data.risk_score }
        }).catch(() => {});
      }
    } else {
      showError(result.errorType || "Analysis Failed", result.message, result.detail);
    }
  }

  async function handleAnalyzeUrl() {
    const url = inputTargetUrl.value.trim();
    if (!url) {
      showError("URL Required", "Please enter a valid website URL to evaluate.");
      return;
    }

    if (!CONFIG.isValidUrl(url)) {
      showError("Invalid URL Format", "The URL must start with http:// or https:// (e.g. https://careers.example.com).");
      return;
    }

    lastAnalysisType = "url";
    lastAnalysisInputText = "";
    showLoading("Evaluating website TLS/SSL, SSRF-safe redirects and brand credibility...");

    const result = await apiClient.analyzeUrl({ url });
    hideLoading();

    if (result.success && result.data) {
      renderResult(result.data, "url");

      await StorageService.setLastResult({
        type: "url",
        input: { url },
        response: result.data
      });
      await StorageService.addToHistory({
        analysis_id: result.data.analysis_id,
        type: "url",
        target: url,
        risk_level: result.data.risk_level,
        risk_score: result.data.risk_score,
        summary: result.data.summary
      });

      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.sendMessage({
          action: "UPDATE_BADGE",
          payload: { risk_level: result.data.risk_level, risk_score: result.data.risk_score }
        }).catch(() => {});
      }
    } else {
      showError(result.errorType || "URL Check Failed", result.message, result.detail);
    }
  }

  // =========================================================================
  // Safe Evidence Highlighting in Text
  // =========================================================================

  function renderEvidenceHighlighting(originalText, evidenceList, indicatorsList) {
    highlightedTextContainer.innerHTML = "";

    if (!originalText || !originalText.trim()) {
      analyzedTextSection.classList.add("hidden");
      return;
    }

    analyzedTextSection.classList.remove("hidden");

    // Build indicator lookup map for severity & explanation
    const indicatorMap = new Map();
    if (Array.isArray(indicatorsList)) {
      indicatorsList.forEach(ind => {
        if (ind && ind.code) {
          indicatorMap.set(ind.code.toLowerCase(), {
            severity: (ind.severity || "medium").toLowerCase(),
            message: ind.message || ""
          });
        }
      });
    }

    // Extract search candidate phrases from backend evidence
    const candidates = [];
    if (Array.isArray(evidenceList)) {
      evidenceList.forEach(ev => {
        const phrase = (ev.detail || "").trim();
        if (phrase.length >= 2) {
          const code = (ev.indicator_code || "").toLowerCase();
          const info = indicatorMap.get(code) || { severity: "medium", message: "" };
          candidates.push({
            phrase,
            code: ev.indicator_code || "SIGNAL",
            severity: info.severity,
            message: info.message || "Scam indicator evidence"
          });
        }
      });
    }

    // If no evidence phrases returned by the backend
    if (candidates.length === 0) {
      highlightedTextContainer.classList.add("hidden");
      highlightedTextEmpty.textContent = "No specific suspicious evidence phrases were flagged in the analyzed text.";
      highlightedTextEmpty.classList.remove("hidden");
      return;
    }

    // Find occurrences in originalText
    const lowerText = originalText.toLowerCase();
    const matches = [];

    candidates.forEach(cand => {
      const lowerPhrase = cand.phrase.toLowerCase();
      let pos = 0;
      while (pos < lowerText.length) {
        const found = lowerText.indexOf(lowerPhrase, pos);
        if (found === -1) break;
        matches.push({
          start: found,
          end: found + lowerPhrase.length,
          cand
        });
        pos = found + lowerPhrase.length;
      }
    });

    // If exact full-phrase match wasn't found (e.g. minor whitespace variation), fallback to multi-word chunks
    if (matches.length === 0) {
      candidates.forEach(cand => {
        const words = cand.phrase.split(/\s+/).filter(w => w.length > 2);
        if (words.length >= 3) {
          const chunk = words.slice(0, Math.min(5, words.length)).join(" ").toLowerCase();
          const found = lowerText.indexOf(chunk);
          if (found !== -1) {
            matches.push({
              start: found,
              end: found + chunk.length,
              cand
            });
          }
        }
      });
    }

    if (matches.length === 0) {
      highlightedTextContainer.classList.add("hidden");
      highlightedTextEmpty.textContent = "Evidence phrases were evaluated by the backend, but no exact text locations matched the submitted body.";
      highlightedTextEmpty.classList.remove("hidden");
      return;
    }

    // Sort intervals by start ascending, then length descending
    matches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

    // Merge overlapping intervals
    const nonOverlapping = [];
    matches.forEach(item => {
      if (nonOverlapping.length === 0) {
        nonOverlapping.push(item);
      } else {
        const last = nonOverlapping[nonOverlapping.length - 1];
        if (item.start < last.end) {
          // Overlap: extend or clip
          if (item.end > last.end) {
            nonOverlapping.push({
              start: last.end,
              end: item.end,
              cand: item.cand
            });
          }
        } else {
          nonOverlapping.push(item);
        }
      }
    });

    highlightedTextEmpty.classList.add("hidden");
    highlightedTextContainer.classList.remove("hidden");

    // Construct DOM nodes safely using TextNodes and Mark elements
    let cursor = 0;
    nonOverlapping.forEach(span => {
      if (span.start > cursor) {
        const prefix = originalText.substring(cursor, span.start);
        highlightedTextContainer.appendChild(document.createTextNode(prefix));
      }

      const mark = document.createElement("mark");
      const sev = (span.cand.severity || "medium").toLowerCase();
      mark.className = `evidence-mark sev-${sev}`;
      mark.textContent = originalText.substring(span.start, span.end);
      mark.title = `[${sev.toUpperCase()}] ${span.cand.code}: ${span.cand.message}`;

      highlightedTextContainer.appendChild(mark);
      cursor = span.end;
    });

    if (cursor < originalText.length) {
      const suffix = originalText.substring(cursor);
      highlightedTextContainer.appendChild(document.createTextNode(suffix));
    }
  }

  // =========================================================================
  // Result Rendering
  // =========================================================================

  function renderResult(data, type = "job", submittedText = "") {
    lastAnalysisResult = data;
    lastAnalysisType = type;
    lastAnalysisInputText = submittedText || (type === "job" ? inputJobText.value.trim() : "");

    hideOverlays();
    resultView.classList.remove("hidden");

    // 1. Risk Score & Level
    const score = data.risk_score ?? 0;
    const level = (data.risk_level || "low").toLowerCase();

    riskScoreNumber.textContent = score;
    riskLevelBadge.textContent = level.toUpperCase();
    riskLevelBadge.className = `risk-badge level-${level}`;

    // Gauge circle border & glow
    let borderColor = "#10b981"; // safe / low
    if (level === "critical") borderColor = "#ef4444";
    else if (level === "high") borderColor = "#f97316";
    else if (level === "medium") borderColor = "#f59e0b";

    riskGaugeCircle.style.borderColor = borderColor;
    riskGaugeCircle.style.boxShadow = `0 0 16px ${borderColor}55`;

    // 2. Scam Stage
    if (data.scam_stage) {
      scamStageBadge.textContent = `STAGE: ${data.scam_stage.toUpperCase()}`;
      scamStageBadge.classList.remove("hidden");
    } else {
      scamStageBadge.classList.add("hidden");
    }

    resultTypeLabel.textContent = type === "url"
      ? "Deterministic URL Credibility Check"
      : "Deterministic Job Scam Rule Assessment";

    // 3. Executive Summary
    resultSummaryText.textContent = data.summary || "Analysis completed.";

    // 4. Evidence Highlighting (Job Analysis)
    if (type === "job") {
      renderEvidenceHighlighting(lastAnalysisInputText, data.evidence || [], data.indicators || []);
      urlMetricsCard.classList.add("hidden");
    } else {
      analyzedTextSection.classList.add("hidden");
      urlMetricsCard.classList.remove("hidden");
      renderUrlMetrics(data);
    }

    // 5. Detected Scam Indicators List
    renderIndicatorsList(data.indicators || []);

    // 6. Grounded Evidence Quotes List
    renderEvidenceList(data.evidence || [], data.indicators || []);

    // 7. AI Enrichment (Groq)
    if (data.ai_enrichment) {
      aiEnrichmentSection.classList.remove("hidden");
      aiSummaryText.textContent = data.ai_enrichment.summary || "";
      aiEvidenceList.innerHTML = "";

      if (data.ai_enrichment.evidence && data.ai_enrichment.evidence.length > 0) {
        data.ai_enrichment.evidence.forEach(aiev => {
          const div = document.createElement("div");
          div.className = "evidence-item";

          const labelSpan = document.createElement("span");
          labelSpan.style.color = "var(--accent-primary)";
          labelSpan.style.fontWeight = "600";
          labelSpan.textContent = `${aiev.indicator}: `;

          div.appendChild(labelSpan);
          div.appendChild(document.createTextNode(aiev.explanation || ""));
          aiEvidenceList.appendChild(div);
        });
      }
    } else {
      aiEnrichmentSection.classList.add("hidden");
    }

    // 8. Actionable Recommendations (Positioned clearly below evidence)
    const recs = data.recommendations || [];
    recommendationsList.innerHTML = "";
    if (recs.length === 0) {
      const li = document.createElement("li");
      li.textContent = "Maintain standard job verification hygiene.";
      recommendationsList.appendChild(li);
    } else {
      recs.forEach(rec => {
        const li = document.createElement("li");
        li.textContent = rec;
        recommendationsList.appendChild(li);
      });
    }

    // 9. Disclaimer
    if (data.disclaimer) {
      resultDisclaimerText.textContent = data.disclaimer;
    }
  }

  function renderIndicatorsList(indicators) {
    indicatorsCountBadge.textContent = indicators.length;
    indicatorsList.innerHTML = "";

    if (indicators.length === 0) {
      const emptyDiv = document.createElement("div");
      emptyDiv.className = "evidence-empty-note";
      emptyDiv.textContent = "No scam indicators detected by the rule engine.";
      indicatorsList.appendChild(emptyDiv);
      return;
    }

    indicators.forEach(ind => {
      const item = document.createElement("div");
      const severity = (ind.severity || "medium").toLowerCase();
      item.className = `indicator-item sev-${severity}`;

      const header = document.createElement("div");
      header.className = "indicator-header";

      const code = document.createElement("span");
      code.className = "indicator-code";
      code.textContent = ind.code || "SCAM_SIGNAL";

      const sevTag = document.createElement("span");
      sevTag.className = `indicator-severity-tag level-${severity}`;
      sevTag.textContent = severity.toUpperCase();

      header.appendChild(code);
      header.appendChild(sevTag);

      const msg = document.createElement("div");
      msg.className = "indicator-message";
      msg.textContent = ind.message || "";

      item.appendChild(header);
      item.appendChild(msg);

      if (ind.sources && Array.isArray(ind.sources) && ind.sources.length > 0) {
        const sourcesBox = document.createElement("div");
        sourcesBox.className = "indicator-sources";
        ind.sources.forEach(src => {
          const tag = document.createElement("span");
          tag.className = "source-tag";
          tag.textContent = src === "rule_engine" ? "Rule Engine" : "Groq AI";
          sourcesBox.appendChild(tag);
        });
        item.appendChild(sourcesBox);
      }

      indicatorsList.appendChild(item);
    });
  }

  function renderEvidenceList(evidence, indicators) {
    evidenceCountBadge.textContent = evidence.length;
    evidenceList.innerHTML = "";

    const indicatorMap = new Map();
    if (Array.isArray(indicators)) {
      indicators.forEach(ind => {
        if (ind && ind.code) {
          indicatorMap.set(ind.code.toLowerCase(), ind);
        }
      });
    }

    if (evidence.length === 0) {
      evidenceSection.classList.remove("hidden");
      evidenceEmptyNote.classList.remove("hidden");
      return;
    }

    evidenceSection.classList.remove("hidden");
    evidenceEmptyNote.classList.add("hidden");

    evidence.forEach(ev => {
      const item = document.createElement("div");
      const indCode = (ev.indicator_code || "").toLowerCase();
      const matchedInd = indicatorMap.get(indCode);
      const severity = matchedInd ? (matchedInd.severity || "medium").toLowerCase() : "medium";

      item.className = `evidence-item sev-${severity}`;

      const quote = document.createElement("div");
      quote.className = "evidence-quote";
      quote.textContent = `"${ev.detail || ""}"`;
      item.appendChild(quote);

      const meta = document.createElement("div");
      meta.className = "evidence-meta";

      const sourceSpan = document.createElement("span");
      sourceSpan.textContent = `Source: ${ev.source || "job_text"}`;
      meta.appendChild(sourceSpan);

      if (ev.indicator_code) {
        const triggerSpan = document.createElement("span");
        triggerSpan.textContent = `Trigger: ${ev.indicator_code}`;
        meta.appendChild(triggerSpan);
      }
      item.appendChild(meta);

      // Provide readable explanation from backend indicator
      if (matchedInd && matchedInd.message) {
        const explDiv = document.createElement("div");
        explDiv.className = "evidence-explanation";
        explDiv.textContent = `Why suspicious: ${matchedInd.message}`;
        item.appendChild(explDiv);
      }

      evidenceList.appendChild(item);
    });
  }

  function renderUrlMetrics(data) {
    urlMetricTarget.textContent = data.target_url || "--";
    urlMetricFinal.textContent = data.final_url || "--";

    if (data.ssl_info) {
      if (data.ssl_info.is_valid) {
        urlMetricSsl.textContent = `Valid (${data.ssl_info.issuer || "Trusted CA"})`;
        urlMetricSsl.style.color = "var(--risk-safe)";
      } else {
        urlMetricSsl.textContent = `Invalid (${data.ssl_info.error || "Untrusted"})`;
        urlMetricSsl.style.color = "var(--risk-critical)";
      }
    } else {
      urlMetricSsl.textContent = "Not inspected";
      urlMetricSsl.style.color = "var(--text-muted)";
    }

    if (data.is_redirected && data.redirect_chain && data.redirect_chain.length > 0) {
      urlMetricRedirect.textContent = `Redirected (${data.redirect_chain.length} hop${data.redirect_chain.length > 1 ? "s" : ""})`;
      urlMetricRedirect.style.color = "var(--risk-high)";
      redirectChainBox.classList.remove("hidden");
      redirectHopsList.innerHTML = "";
      data.redirect_chain.forEach(hop => {
        const div = document.createElement("div");
        div.className = "hop-item";
        div.textContent = `[Hop ${hop.hop_number}] ${hop.status_code || 301} -> ${hop.url}`;
        redirectHopsList.appendChild(div);
      });
    } else {
      urlMetricRedirect.textContent = "Direct destination (No redirects)";
      urlMetricRedirect.style.color = "var(--risk-safe)";
      redirectChainBox.classList.add("hidden");
    }
  }

  // =========================================================================
  // Loading & Error States
  // =========================================================================

  function showLoading(statusMsg) {
    loadingStatusText.textContent = statusMsg || "Analyzing submission...";
    loadingState.classList.remove("hidden");
    resultView.classList.add("hidden");
    errorView.classList.add("hidden");
  }

  function hideLoading() {
    loadingState.classList.add("hidden");
  }

  function showError(title, message, detail = null) {
    hideLoading();
    resultView.classList.add("hidden");
    errorView.classList.remove("hidden");

    errorTitle.textContent = title || "Analysis Error";
    errorMessage.textContent = message || "An unexpected error occurred.";

    if (detail) {
      errorDetailBox.textContent = typeof detail === "object" ? JSON.stringify(detail, null, 2) : String(detail);
      errorDetailBox.classList.remove("hidden");
    } else {
      errorDetailBox.classList.add("hidden");
    }
  }

  // =========================================================================
  // History View
  // =========================================================================

  async function renderHistory() {
    const history = await StorageService.getHistory();
    historyList.innerHTML = "";

    if (!history || history.length === 0) {
      historyEmpty.classList.remove("hidden");
      historyList.classList.add("hidden");
      return;
    }

    historyEmpty.classList.add("hidden");
    historyList.classList.remove("hidden");

    history.forEach(item => {
      const div = document.createElement("div");
      div.className = "history-item";

      const level = (item.risk_level || "low").toLowerCase();
      const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

      div.innerHTML = `
        <div class="history-item-top">
          <span class="history-item-target">${escapeHtml(item.target || "Scan")}</span>
          <span class="risk-badge level-${level}" style="font-size: 9px; padding: 2px 6px;">${level.toUpperCase()} (${item.risk_score}/100)</span>
        </div>
        <div class="history-item-summary">${escapeHtml(item.summary || "")}</div>
        <div class="history-item-time">${dateStr} &bull; ${item.type === "url" ? "URL Verification" : "Job Text Analysis"}</div>
      `;

      div.addEventListener("click", async () => {
        const lastResult = await StorageService.getLastResult();
        if (lastResult && lastResult.response && lastResult.response.analysis_id === item.id) {
          const originalInput = lastResult.input && lastResult.input.job_text ? lastResult.input.job_text : "";
          renderResult(lastResult.response, lastResult.type, originalInput);
        } else {
          if (item.type === "url") {
            inputTargetUrl.value = item.target;
            switchTab("tab-url");
          } else {
            switchTab("tab-job");
          }
        }
      });

      historyList.appendChild(div);
    });
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // =========================================================================
  // Settings Actions
  // =========================================================================

  async function handleTestConnection() {
    const customUrl = inputBackendUrl.value.trim();
    if (!CONFIG.isValidUrl(customUrl)) {
      connectionTestResult.className = "connection-result error";
      connectionTestResult.textContent = "Please enter a valid HTTP or HTTPS URL (e.g. http://127.0.0.1:8000).";
      connectionTestResult.classList.remove("hidden");
      return;
    }

    const testClient = new CredihireApiClient(customUrl);
    btnTestConnection.disabled = true;
    const spinner = btnTestConnection.querySelector(".btn-spinner");
    if (spinner) spinner.classList.remove("hidden");

    try {
      const health = await testClient.checkHealth();
      if (!health.success) {
        connectionTestResult.className = "connection-result error";
        connectionTestResult.textContent = `Connection Failed: ${health.message}. Make sure uvicorn is running on the specified host.`;
        connectionTestResult.classList.remove("hidden");
        return;
      }

      const ready = await testClient.checkReadiness();
      connectionTestResult.className = "connection-result success";
      if (ready.success && ready.data) {
        const components = ready.data.components || {};
        connectionTestResult.innerHTML = `
          <strong>Connection Successful!</strong><br>
          Backend Status: ${ready.data.status.toUpperCase()}<br>
          Rule Engine: ${components.rule_engine || "unknown"}<br>
          LLM Service: ${components.llm || "unconfigured"}
        `;
      } else {
        connectionTestResult.innerHTML = `<strong>Connected to API successfully!</strong> (${health.data ? health.data.status : "ok"})`;
      }
      connectionTestResult.classList.remove("hidden");
    } finally {
      btnTestConnection.disabled = false;
      if (spinner) spinner.classList.add("hidden");
    }
  }

  async function handleSaveSettings() {
    const customUrl = inputBackendUrl.value.trim();
    if (!CONFIG.isValidUrl(customUrl)) {
      showError("Invalid URL", "Please enter a valid HTTP or HTTPS URL for the backend.");
      return;
    }

    await StorageService.setBackendUrl(customUrl);
    footerConnectionText.textContent = customUrl.replace(/^https?:\/\//, "");

    connectionTestResult.className = "connection-result success";
    connectionTestResult.textContent = "Configuration saved successfully!";
    connectionTestResult.classList.remove("hidden");

    await checkBackendStatus();
  }

  // =========================================================================
  // Event Listeners Setup
  // =========================================================================

  function setupEventListeners() {
    navTabs.forEach(tab => {
      tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    });

    btnQuickSettings.addEventListener("click", () => switchTab("tab-settings"));
    backendStatusIndicator.addEventListener("click", () => switchTab("tab-settings"));

    inputJobText.addEventListener("input", updateCharCount);

    toggleOptionalFields.addEventListener("click", () => {
      optionalFieldsBody.classList.toggle("hidden");
      const chevron = toggleOptionalFields.querySelector(".chevron");
      if (chevron) {
        chevron.textContent = optionalFieldsBody.classList.contains("hidden") ? "▾" : "▴";
      }
    });

    btnGrabSelection.addEventListener("click", async () => {
      try {
        const response = await sendMessageToActiveTab({ action: "GET_SELECTION" });
        if (response && response.success && response.selectionText) {
          inputJobText.value = response.selectionText;
          updateCharCount();
          if (response.url) inputJobUrl.value = response.url;
          inputJobText.focus();
        } else {
          showGlobalAlert("No text currently selected on webpage. Highlight job text first.", "OK", hideGlobalAlert);
        }
      } catch (err) {
        showGlobalAlert(err.message || "Could not capture selected text.", "Dismiss", hideGlobalAlert);
      }
    });

    btnExtractPage.addEventListener("click", async () => {
      try {
        showLoading("Scanning page content for job details...");
        const response = await sendMessageToActiveTab({ action: "EXTRACT_PAGE_CONTENT" });
        hideLoading();

        if (response && response.success && response.pageText) {
          inputJobText.value = response.pageText;
          updateCharCount();
          if (response.url) inputJobUrl.value = response.url;
          inputJobText.focus();
        } else {
          showGlobalAlert("Could not extract readable job text from this webpage.", "OK", hideGlobalAlert);
        }
      } catch (err) {
        hideLoading();
        showGlobalAlert(err.message || "Failed to scan page.", "Dismiss", hideGlobalAlert);
      }
    });

    btnAnalyzeJob.addEventListener("click", handleAnalyzeJob);

    btnUseTabUrl.addEventListener("click", async () => {
      await queryCurrentTab();
      if (currentActiveTab && currentActiveTab.url) {
        inputTargetUrl.value = currentActiveTab.url;
      }
    });

    btnAnalyzeUrl.addEventListener("click", handleAnalyzeUrl);

    btnBackToInput.addEventListener("click", () => {
      resultView.classList.add("hidden");
    });

    btnCopyReport.addEventListener("click", () => {
      if (!lastAnalysisResult) return;
      const r = lastAnalysisResult;
      const report = [
        "CREDIHIRE JOB SCAM ANALYSIS REPORT",
        "==================================",
        `Risk Level: ${(r.risk_level || "").toUpperCase()} (Score: ${r.risk_score ?? 0}/100)`,
        r.scam_stage ? `Scam Stage: ${r.scam_stage}` : null,
        "",
        `Summary: ${r.summary || ""}`,
        "",
        "Detected Indicators:",
        ...(r.indicators || []).map(i => ` - [${(i.severity || "").toUpperCase()}] ${i.code}: ${i.message}`),
        "",
        "Evidence Quotes:",
        ...(r.evidence || []).map(e => ` - "${e.detail}" (${e.indicator_code || "signal"})`),
        "",
        "Recommendations:",
        ...(r.recommendations || []).map(rc => ` - ${rc}`),
        "",
        `Disclaimer: ${r.disclaimer || ""}`
      ].filter(line => line !== null).join("\n");

      navigator.clipboard.writeText(report).then(() => {
        const btnSpan = btnCopyReport.querySelector("span");
        if (btnSpan) {
          const orig = btnSpan.textContent;
          btnSpan.textContent = "Copied!";
          setTimeout(() => { btnSpan.textContent = orig; }, 1800);
        }
      });
    });

    btnErrorRetry.addEventListener("click", () => {
      if (lastAnalysisType === "url") {
        handleAnalyzeUrl();
      } else {
        handleAnalyzeJob();
      }
    });

    btnErrorSettings.addEventListener("click", () => switchTab("tab-settings"));

    btnClearHistory.addEventListener("click", async () => {
      await StorageService.clearHistory();
      renderHistory();
    });

    btnTestConnection.addEventListener("click", handleTestConnection);
    btnSaveSettings.addEventListener("click", handleSaveSettings);
  }
});
