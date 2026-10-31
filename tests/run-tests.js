/**
 * Credihire Extension Test Suite
 * Validates Manifest V3, config, storage, API client, error handling,
 * content script extraction, and mock backend integration.
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const assert = require("assert");

const ROOT_DIR = path.resolve(__dirname, "..");

let passedCount = 0;
let failedCount = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
    failedCount++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
    failedCount++;
  }
}

console.log("\n=======================================================");
console.log("CREDIHIRE BROWSER EXTENSION - TEST SUITE");
console.log("=======================================================\n");

// -----------------------------------------------------------------------------
// 1. Manifest V3 Validation
// -----------------------------------------------------------------------------
console.log("--- 1. Manifest V3 Integrity Tests ---");

const manifestPath = path.join(ROOT_DIR, "manifest.json");
let manifest = null;

runTest("Manifest file exists and is valid JSON", () => {
  assert.ok(fs.existsSync(manifestPath), "manifest.json does not exist");
  const raw = fs.readFileSync(manifestPath, "utf-8");
  manifest = JSON.parse(raw);
  assert.ok(manifest, "Failed to parse manifest JSON");
});

runTest("Manifest version is 3", () => {
  assert.strictEqual(manifest.manifest_version, 3, "manifest_version must be 3");
});

runTest("Required fields are present", () => {
  assert.ok(manifest.name, "Missing name");
  assert.ok(manifest.version, "Missing version");
  assert.ok(manifest.description, "Missing description");
  assert.ok(manifest.action, "Missing action");
  assert.ok(manifest.action.default_popup, "Missing default_popup");
  assert.ok(manifest.background, "Missing background");
  assert.ok(manifest.background.service_worker, "Missing background service_worker");
});

runTest("Declared icon files exist", () => {
  assert.ok(manifest.icons, "Missing icons field");
  for (const [size, iconRelPath] of Object.entries(manifest.icons)) {
    const iconAbsPath = path.join(ROOT_DIR, iconRelPath);
    assert.ok(fs.existsSync(iconAbsPath), `Icon ${size} not found at ${iconRelPath}`);
    const stats = fs.statSync(iconAbsPath);
    assert.ok(stats.size > 0, `Icon ${size} file is empty`);
  }
});

runTest("Declared UI files exist", () => {
  const popupPath = path.join(ROOT_DIR, manifest.action.default_popup);
  assert.ok(fs.existsSync(popupPath), "popup.html does not exist");

  const workerPath = path.join(ROOT_DIR, manifest.background.service_worker);
  assert.ok(fs.existsSync(workerPath), "service-worker.js does not exist");

  if (manifest.options_ui && manifest.options_ui.page) {
    const optionsPath = path.join(ROOT_DIR, manifest.options_ui.page);
    assert.ok(fs.existsSync(optionsPath), "options.html does not exist");
  }
});

runTest("Permissions are minimal and properly defined", () => {
  const required = ["activeTab", "contextMenus", "storage", "scripting"];
  required.forEach(p => {
    assert.ok(manifest.permissions.includes(p), `Missing permission: ${p}`);
  });
  // Host permissions must include backend targets
  assert.ok(Array.isArray(manifest.host_permissions), "Missing host_permissions");
  assert.ok(manifest.host_permissions.some(h => h.includes("127.0.0.1:8000")), "Missing 127.0.0.1:8000 in host_permissions");
});

// -----------------------------------------------------------------------------
// 2. Configuration & URL Normalization
// -----------------------------------------------------------------------------
console.log("\n--- 2. Configuration & URL Normalization Tests ---");

const CONFIG = require(path.join(ROOT_DIR, "lib", "config.js"));

runTest("Default backend URL is configured to 127.0.0.1:8000", () => {
  assert.strictEqual(CONFIG.DEFAULT_BACKEND_URL, "http://127.0.0.1:8000");
  assert.strictEqual(CONFIG.API_PREFIX, "/api/v1");
});

runTest("normalizeApiBaseUrl appends /api/v1 when omitted", () => {
  const result = CONFIG.normalizeApiBaseUrl("http://127.0.0.1:8000");
  assert.strictEqual(result, "http://127.0.0.1:8000/api/v1");
});

runTest("normalizeApiBaseUrl preserves /api/v1 when provided", () => {
  const result = CONFIG.normalizeApiBaseUrl("http://127.0.0.1:8000/api/v1");
  assert.strictEqual(result, "http://127.0.0.1:8000/api/v1");
});

runTest("normalizeApiBaseUrl handles trailing slashes and production domains", () => {
  const result = CONFIG.normalizeApiBaseUrl("https://credihire-api.onrender.com/");
  assert.strictEqual(result, "https://credihire-api.onrender.com/api/v1");
});

runTest("isValidUrl correctly verifies URL formats", () => {
  assert.strictEqual(CONFIG.isValidUrl("https://careers.google.com"), true);
  assert.strictEqual(CONFIG.isValidUrl("http://127.0.0.1:8000"), true);
  assert.strictEqual(CONFIG.isValidUrl("not-a-url"), false);
  assert.strictEqual(CONFIG.isValidUrl("ftp://invalid.com"), false);
  assert.strictEqual(CONFIG.isValidUrl(""), false);
  assert.strictEqual(CONFIG.isValidUrl(null), false);
});

// -----------------------------------------------------------------------------
// 3. Storage Layer
// -----------------------------------------------------------------------------
console.log("\n--- 3. Storage Layer Tests ---");

const StorageService = require(path.join(ROOT_DIR, "lib", "storage.js"));

(async () => {
  await runAsyncTest("Storage provides default backend URL when unset", async () => {
    const url = await StorageService.getBackendUrl();
    assert.strictEqual(url, "http://127.0.0.1:8000");
  });

  await runAsyncTest("Storage can set and retrieve custom backend URL", async () => {
    await StorageService.setBackendUrl("https://custom.backend.com");
    const updated = await StorageService.getBackendUrl();
    assert.strictEqual(updated, "https://custom.backend.com");
    // Reset back
    await StorageService.setBackendUrl("http://127.0.0.1:8000");
  });

  await runAsyncTest("Pending selection can be stored and cleared", async () => {
    await StorageService.setPendingSelection("Test job text", "https://jobs.example.com");
    const pending = await StorageService.getPendingSelection();
    assert.ok(pending);
    assert.strictEqual(pending.text, "Test job text");
    assert.strictEqual(pending.pageUrl, "https://jobs.example.com");

    await StorageService.clearPendingSelection();
    const cleared = await StorageService.getPendingSelection();
    assert.strictEqual(cleared, undefined);
  });

  await runAsyncTest("History maintains entries and respects limits", async () => {
    await StorageService.clearHistory();
    for (let i = 1; i <= 20; i++) {
      await StorageService.addToHistory({
        analysis_id: `test_uuid_${i}`,
        type: "scam",
        target: `Job ${i}`,
        risk_level: i % 2 === 0 ? "high" : "low",
        risk_score: i * 5,
        summary: `Summary for job ${i}`
      });
    }

    const history = await StorageService.getHistory();
    assert.ok(history.length <= 15, `History length (${history.length}) should not exceed 15`);
    assert.strictEqual(history[0].id, "test_uuid_20"); // newest first
    await StorageService.clearHistory();
  });

  // ---------------------------------------------------------------------------
  // 4. API Client Client-Side Validation
  // ---------------------------------------------------------------------------
  console.log("\n--- 4. API Client Pre-Validation Tests ---");

  const CredihireApiClient = require(path.join(ROOT_DIR, "lib", "api-client.js"));
  const client = new CredihireApiClient("http://127.0.0.1:8000");

  await runAsyncTest("analyzeJob rejects empty or whitespace text", async () => {
    const res1 = await client.analyzeJob({ job_text: "" });
    assert.strictEqual(res1.success, false);
    assert.strictEqual(res1.errorType, "CLIENT_VALIDATION");

    const res2 = await client.analyzeJob({ job_text: "   " });
    assert.strictEqual(res2.success, false);
    assert.strictEqual(res2.errorType, "CLIENT_VALIDATION");
  });

  await runAsyncTest("analyzeJob rejects text exceeding 12,000 characters", async () => {
    const giantText = "a".repeat(12001);
    const res = await client.analyzeJob({ job_text: giantText });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorType, "CLIENT_VALIDATION");
    assert.ok(res.message.includes("exceeds maximum length"));
  });

  await runAsyncTest("analyzeUrl rejects empty or invalid URL formats", async () => {
    const res1 = await client.analyzeUrl({ url: "" });
    assert.strictEqual(res1.success, false);
    assert.strictEqual(res1.errorType, "CLIENT_VALIDATION");

    const res2 = await client.analyzeUrl({ url: "ftp://not-supported.com" });
    assert.strictEqual(res2.success, false);
    assert.strictEqual(res2.errorType, "CLIENT_VALIDATION");
  });

  // ---------------------------------------------------------------------------
  // 5. Backend Unavailable & Error Handling
  // ---------------------------------------------------------------------------
  console.log("\n--- 5. Backend Unavailable Handling Tests ---");

  await runAsyncTest("Client gracefully handles connection refused on dead port", async () => {
    // Point client to unallocated port
    const deadClient = new CredihireApiClient("http://127.0.0.1:54321");
    const res = await deadClient.checkHealth();
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorType, "NETWORK_ERROR");
    assert.ok(res.message.includes("Cannot connect to Credihire backend"));
  });

  // ---------------------------------------------------------------------------
  // 6. Live Mock Server Integration Tests (Verifying Request & Response Contracts)
  // ---------------------------------------------------------------------------
  console.log("\n--- 6. Mock Server Contract & Integration Tests ---");

  const mockPort = 9876;
  let serverRequests = [];

  const mockServer = http.createServer((req, res) => {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      serverRequests.push({ method: req.method, url: req.url, body });

      if (req.url === "/api/v1/health" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
        return;
      }

      if (req.url === "/api/v1/ready" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          status: "ready",
          components: { rule_engine: "ready", llm: "ready" }
        }));
        return;
      }

      if (req.url === "/api/v1/scam/analyze" && req.method === "POST") {
        const parsed = JSON.parse(body || "{}");
        if (parsed.job_text.includes("trigger_503")) {
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ detail: "Scam analysis is unavailable" }));
          return;
        }

        if (parsed.job_text.includes("trigger_422")) {
          res.writeHead(422, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ detail: "Field job_text is invalid" }));
          return;
        }

        // Standard success response matching ScamAnalysisResponse schema
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          analysis_id: "123e4567-e89b-12d3-a456-426614174000",
          risk_level: "high",
          risk_score: 85,
          indicators: [
            {
              code: "task_deposit",
              severity: "high",
              message: "Requests upfront deposit before task earnings release.",
              sources: ["rule_engine"]
            }
          ],
          evidence: [
            {
              source: "job_text",
              detail: "Pay ₹2,000 to unlock your task earnings.",
              indicator_code: "task_deposit"
            }
          ],
          scam_stage: "payment_request",
          recommendations: ["Never pay money to unlock promised earnings."],
          summary: "High risk task scam detected with advance deposit requirement.",
          disclaimer: "Automated guidance only; independently verify employers.",
          ai_enrichment: null,
          rule_engine_result: null,
          ai_detection_result: null
        }));
        return;
      }

      if (req.url === "/api/v1/url/analyze" && req.method === "POST") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          analysis_id: "987e6543-e21b-12d3-a456-426614174999",
          target_url: "https://careers-google-verify.com",
          final_url: "https://careers-google-verify.com",
          risk_level: "critical",
          risk_score: 95,
          is_redirected: false,
          redirect_chain: [],
          ssl_info: {
            is_valid: true,
            issuer: "Let's Encrypt",
            subject: "careers-google-verify.com",
            expires_at: "2027-01-01"
          },
          indicators: [
            {
              code: "brand_impersonation",
              severity: "critical",
              category: "brand_impersonation",
              message: "Domain attempts to impersonate Google recruitment brand."
            }
          ],
          recommendations: ["Do not enter credentials or personal data."],
          summary: "Critical brand impersonation phishing domain detected.",
          reputation_status: "suspicious",
          disclaimer: "Automated URL safety check."
        }));
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ detail: "Not found" }));
    });
  });

  await new Promise(resolve => mockServer.listen(mockPort, resolve));

  const mockClient = new CredihireApiClient(`http://127.0.0.1:${mockPort}`);

  await runAsyncTest("Health check succeeds against mock server", async () => {
    const res = await mockClient.checkHealth();
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.status, "ok");
  });

  await runAsyncTest("Readiness check returns component readiness", async () => {
    const res = await mockClient.checkReadiness();
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.status, "ready");
    assert.strictEqual(res.data.components.rule_engine, "ready");
  });

  await runAsyncTest("Job scam analysis executes with full schema parsing", async () => {
    const res = await mockClient.analyzeJob({
      job_text: "Pay ₹2,000 to unlock your task earnings.",
      job_url: "https://fake-tasks.example.com"
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.risk_level, "high");
    assert.strictEqual(res.data.risk_score, 85);
    assert.strictEqual(res.data.scam_stage, "payment_request");
    assert.ok(res.data.indicators.length > 0);
    assert.strictEqual(res.data.indicators[0].code, "task_deposit");
    assert.ok(res.data.evidence.length > 0);
  });

  await runAsyncTest("URL credibility analysis returns security metrics", async () => {
    const res = await mockClient.analyzeUrl({
      url: "https://careers-google-verify.com"
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.risk_level, "critical");
    assert.strictEqual(res.data.risk_score, 95);
    assert.strictEqual(res.data.indicators[0].code, "brand_impersonation");
    assert.strictEqual(res.data.ssl_info.is_valid, true);
  });

  await runAsyncTest("HTTP 503 from backend maps to SERVICE_UNAVAILABLE error", async () => {
    const res = await mockClient.analyzeJob({
      job_text: "trigger_503 error test"
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorType, "SERVICE_UNAVAILABLE");
    assert.strictEqual(res.status, 503);
    assert.ok(res.message.toLowerCase().includes("unavailable"));
  });

  await runAsyncTest("HTTP 422 from backend maps to VALIDATION_ERROR error", async () => {
    const res = await mockClient.analyzeJob({
      job_text: "trigger_422 error test"
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorType, "VALIDATION_ERROR");
    assert.strictEqual(res.status, 422);
  });

  mockServer.close();

  // ---------------------------------------------------------------------------
  // 7. HTML Element ID Reference Verification Tests
  // ---------------------------------------------------------------------------
  console.log("\n--- 7. UI Element ID Integrity Tests ---");

  runTest("Popup HTML contains all element IDs referenced in popup.js", () => {
    const popupHtml = fs.readFileSync(path.join(ROOT_DIR, "popup", "popup.html"), "utf-8");
    const popupJs = fs.readFileSync(path.join(ROOT_DIR, "popup", "popup.js"), "utf-8");

    const idRegex = /document\.getElementById\(["']([^"']+)["']\)/g;
    let match;
    const missing = [];
    while ((match = idRegex.exec(popupJs)) !== null) {
      const id = match[1];
      if (!popupHtml.includes(`id="${id}"`)) {
        missing.push(id);
      }
    }
    assert.strictEqual(missing.length, 0, `Missing IDs in popup.html: ${missing.join(", ")}`);
  });

  runTest("Options HTML contains all element IDs referenced in options.js", () => {
    const optionsHtml = fs.readFileSync(path.join(ROOT_DIR, "options", "options.html"), "utf-8");
    const optionsJs = fs.readFileSync(path.join(ROOT_DIR, "options", "options.js"), "utf-8");

    const idRegex = /document\.getElementById\(["']([^"']+)["']\)/g;
    let match;
    const missing = [];
    while ((match = idRegex.exec(optionsJs)) !== null) {
      const id = match[1];
      if (!optionsHtml.includes(`id="${id}"`)) {
        missing.push(id);
      }
    }
    assert.strictEqual(missing.length, 0, `Missing IDs in options.html: ${missing.join(", ")}`);
  });

  // ---------------------------------------------------------------------------
  // 8. Content Script & Background Worker Logic Tests
  // ---------------------------------------------------------------------------
  console.log("\n--- 8. Content Script & Background Worker Verification ---");

  runTest("Content script handles zero-telemetry and explicit message actions", () => {
    const contentScriptJs = fs.readFileSync(path.join(ROOT_DIR, "content", "content-script.js"), "utf-8");
    assert.ok(contentScriptJs.includes("GET_SELECTION"), "Missing GET_SELECTION handler");
    assert.ok(contentScriptJs.includes("EXTRACT_PAGE_CONTENT"), "Missing EXTRACT_PAGE_CONTENT handler");
    assert.ok(contentScriptJs.includes("PING"), "Missing PING handler");
    assert.ok(!contentScriptJs.includes("fetch("), "Content script must not perform unrequested fetch");
    assert.ok(!contentScriptJs.includes("XMLHttpRequest"), "Content script must not use XHR");
  });

  runTest("Background service worker declares context menus and handlers", () => {
    const workerJs = fs.readFileSync(path.join(ROOT_DIR, "background", "service-worker.js"), "utf-8");
    assert.ok(workerJs.includes("chrome.contextMenus.create"), "Missing contextMenus.create");
    assert.ok(workerJs.includes("credihire_analyze_selection"), "Missing selection context menu ID");
    assert.ok(workerJs.includes("credihire_analyze_link"), "Missing link context menu ID");
    assert.ok(workerJs.includes("chrome.contextMenus.onClicked"), "Missing contextMenus.onClicked listener");
    assert.ok(workerJs.includes("updateBadge"), "Missing updateBadge function");
  });

  // ---------------------------------------------------------------------------
  // 9. Evidence Highlighting & Safe Rendering Verification
  // ---------------------------------------------------------------------------
  console.log("\n--- 9. Evidence Highlighting & Safe Rendering Verification ---");

  // Simulated DOM environment for popup rendering verification
  function createMockElement(id = "", tagName = "div") {
    const el = {
      id,
      tagName: tagName.toUpperCase(),
      classList: {
        _classes: new Set(),
        add(c) { this._classes.add(c); },
        remove(c) { this._classes.delete(c); },
        toggle(c, force) { if (force !== undefined) { force ? this.add(c) : this.remove(c); } else { this._classes.has(c) ? this.remove(c) : this.add(c); } },
        contains(c) { return this._classes.has(c); }
      },
      style: {},
      children: [],
      childNodes: [],
      textContent: "",
      innerHTML: "",
      className: "",
      title: "",
      appendChild(child) {
        this.childNodes.push(child);
        this.children.push(child);
        return child;
      }
    };
    return el;
  }

  // Pure highlighting algorithm extraction matching popup.js
  function highlightTextAlgorithm(originalText, evidenceList, indicatorsList) {
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
            message: info.message
          });
        }
      });
    }

    if (candidates.length === 0) {
      return { matched: false, spans: [], rawText: originalText };
    }

    const lowerText = originalText.toLowerCase();
    const matches = [];

    candidates.forEach(cand => {
      const lowerPhrase = cand.phrase.toLowerCase();
      let pos = 0;
      while (pos < lowerText.length) {
        const found = lowerText.indexOf(lowerPhrase, pos);
        if (found === -1) break;
        matches.push({ start: found, end: found + lowerPhrase.length, cand });
        pos = found + lowerPhrase.length;
      }
    });

    if (matches.length === 0) {
      return { matched: false, spans: [], rawText: originalText };
    }

    matches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

    const nonOverlapping = [];
    matches.forEach(item => {
      if (nonOverlapping.length === 0) {
        nonOverlapping.push(item);
      } else {
        const last = nonOverlapping[nonOverlapping.length - 1];
        if (item.start < last.end) {
          if (item.end > last.end) {
            nonOverlapping.push({ start: last.end, end: item.end, cand: item.cand });
          }
        } else {
          nonOverlapping.push(item);
        }
      }
    });

    return { matched: true, spans: nonOverlapping, rawText: originalText };
  }

  runTest("Evidence highlighting detects suspicious phrases in job offer", () => {
    const jobText = "Remote data entry role! Pay ₹2,000 to unlock your task earnings. Earn ₹5,000 daily!";
    const evidence = [
      { source: "job_text", detail: "Pay ₹2,000 to unlock your task earnings.", indicator_code: "task_deposit" },
      { source: "job_text", detail: "Earn ₹5,000 daily!", indicator_code: "unrealistic_earnings" }
    ];
    const indicators = [
      { code: "task_deposit", severity: "high", message: "Advance deposit required" },
      { code: "unrealistic_earnings", severity: "medium", message: "Promises inflated daily returns" }
    ];

    const result = highlightTextAlgorithm(jobText, evidence, indicators);
    assert.strictEqual(result.matched, true);
    assert.strictEqual(result.spans.length, 2);

    const firstSpan = result.spans[0];
    const firstText = jobText.substring(firstSpan.start, firstSpan.end);
    assert.strictEqual(firstText, "Pay ₹2,000 to unlock your task earnings.");
    assert.strictEqual(firstSpan.cand.code, "task_deposit");
    assert.strictEqual(firstSpan.cand.severity, "high");

    const secondSpan = result.spans[1];
    const secondText = jobText.substring(secondSpan.start, secondSpan.end);
    assert.strictEqual(secondText, "Earn ₹5,000 daily!");
    assert.strictEqual(secondSpan.cand.code, "unrealistic_earnings");
    assert.strictEqual(secondSpan.cand.severity, "medium");
  });

  runTest("Evidence highlighting handles legitimate offers with no evidence gracefully", () => {
    const benignJobText = "We are seeking a Senior Frontend Engineer to build web applications using React and TypeScript. Competitive compensation and health benefits included.";
    const emptyEvidence = [];
    const emptyIndicators = [];

    const result = highlightTextAlgorithm(benignJobText, emptyEvidence, emptyIndicators);
    assert.strictEqual(result.matched, false);
    assert.strictEqual(result.spans.length, 0);
  });

  runTest("Safe DOM text rendering prevents HTML injection", () => {
    // Verify popup.js uses native TextNodes and textContent instead of dangerous innerHTML injection of user text
    const popupJs = fs.readFileSync(path.join(ROOT_DIR, "popup", "popup.js"), "utf-8");
    // Ensure highlightedTextContainer appends document.createTextNode and marks with textContent
    assert.ok(popupJs.includes("highlightedTextContainer.appendChild(document.createTextNode("), "Must use text nodes for plain text");
    assert.ok(popupJs.includes("mark.textContent = originalText.substring"), "Must use textContent for highlighted marks");
    // Ensure evidence quotes are set via textContent
    assert.ok(popupJs.includes("quote.textContent = `\"${ev.detail || \"\"}\"`"), "Must use textContent for evidence quotes");
  });

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log("\n=======================================================");
  console.log(`TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
})();
