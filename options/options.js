/**
 * Options Page Controller
 */

document.addEventListener("DOMContentLoaded", async () => {
  const backendUrlInput = document.getElementById("backend-url-input");
  const btnSaveUrl = document.getElementById("btn-save-url");
  const btnResetDefault = document.getElementById("btn-reset-default");
  const btnTestBackend = document.getElementById("btn-test-backend");
  const testStatusBox = document.getElementById("test-status-box");

  // Load current saved URL
  const currentUrl = await StorageService.getBackendUrl();
  backendUrlInput.value = currentUrl;

  // Save URL
  btnSaveUrl.addEventListener("click", async () => {
    const raw = backendUrlInput.value.trim();
    if (!CONFIG.isValidUrl(raw)) {
      showStatus("Please enter a valid HTTP or HTTPS URL (e.g. http://127.0.0.1:8000).", "error");
      return;
    }

    await StorageService.setBackendUrl(raw);
    showStatus("Backend URL saved successfully!", "success");
  });

  // Reset to default
  btnResetDefault.addEventListener("click", async () => {
    backendUrlInput.value = CONFIG.DEFAULT_BACKEND_URL;
    await StorageService.setBackendUrl(CONFIG.DEFAULT_BACKEND_URL);
    showStatus("Reset to default backend: http://127.0.0.1:8000", "success");
  });

  // Test backend connection
  btnTestBackend.addEventListener("click", async () => {
    const targetUrl = backendUrlInput.value.trim();
    if (!CONFIG.isValidUrl(targetUrl)) {
      showStatus("Please enter a valid HTTP or HTTPS URL first.", "error");
      return;
    }

    btnTestBackend.disabled = true;
    const spinner = btnTestBackend.querySelector(".spinner");
    if (spinner) spinner.classList.remove("hidden");

    const testClient = new CredihireApiClient(targetUrl);

    try {
      const health = await testClient.checkHealth();
      if (!health.success) {
        showStatus(`Connection Failed: ${health.message}. (${health.detail || "Cannot reach server"})`, "error");
        return;
      }

      const ready = await testClient.checkReadiness();
      let html = `<strong>Connected Successfully to ${targetUrl}</strong><br>`;
      html += `API Health: <code>${health.data ? health.data.status : "ok"}</code><br>`;

      if (ready.success && ready.data) {
        html += `Integration Status: <strong>${(ready.data.status || "ready").toUpperCase()}</strong><br>`;
        if (ready.data.components) {
          html += `Rule Engine: <code>${ready.data.components.rule_engine || "unknown"}</code> | LLM: <code>${ready.data.components.llm || "unconfigured"}</code>`;
        }
      }

      showStatus(html, "success", true);
    } finally {
      btnTestBackend.disabled = false;
      if (spinner) spinner.classList.add("hidden");
    }
  });

  function showStatus(message, type, isHtml = false) {
    testStatusBox.className = `status-box ${type}`;
    if (isHtml) {
      testStatusBox.innerHTML = message;
    } else {
      testStatusBox.textContent = message;
    }
    testStatusBox.classList.remove("hidden");
  }
});
