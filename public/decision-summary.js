(function () {
  const $ = (id) => document.getElementById(id);

  const elRunId = $("runId");
  const elBtnLoad = $("btnLoad");
  const elApiBaseText = $("apiBaseText");
  const elStatePill = $("statePill");

  const elStateLoading = $("stateLoading");
  const elStateBadRequest = $("stateBadRequest");
  const elStateNotFound = $("stateNotFound");
  const elStateInvalidSource = $("stateInvalidSource");
  const elSuccessCard = $("successCard");

  const elBadRequestText = $("badRequestText");
  const elNotFoundText = $("notFoundText");
  const elInvalidSourceText = $("invalidSourceText");

  const elRunIdValue = $("vRunId");
  const elCurrentness = $("vCurrentness");
  const elCreatedAt = $("vCreatedAt");
  const elCompletedAt = $("vCompletedAt");
  const elOutcome = $("vOutcome");
  const elAuditSource = $("vAuditSource");
  const elAuditResolvedFrom = $("vAuditResolvedFrom");
  const elDriversList = $("driversList");
  const elIssuesList = $("issuesList");
  const elRawPayload = $("rawPayload");
  const elLog = $("log");

  const apiBase = window.location.origin;
  elApiBaseText.textContent = apiBase;

  const qs = new URLSearchParams(window.location.search);
  const initialRunId = qs.get("run_id");
  if (initialRunId) elRunId.value = initialRunId;

  function log(line) {
    const ts = new Date().toISOString();
    elLog.textContent = `[${ts}] ${line}\n` + elLog.textContent;
  }

  function safeJson(value) {
    try {
      return JSON.stringify(value ?? {}, null, 2);
    } catch {
      return String(value ?? "");
    }
  }

  function asText(value, fallback = "-") {
    if (value === null || value === undefined) return fallback;
    const text = String(value).trim();
    return text === "" ? fallback : text;
  }

  function readRunId() {
    return String(elRunId.value ?? "").trim();
  }

  function syncUrl(runId) {
    const next = new URL(window.location.href);
    if (runId) next.searchParams.set("run_id", runId);
    else next.searchParams.delete("run_id");
    window.history.replaceState({}, "", next.toString());
  }

  function setStatePill(kind, text) {
    elStatePill.className = "pill state-pill " + kind;
    elStatePill.textContent = "State: " + text;
  }

  function hideAllStates() {
    elStateLoading.classList.add("hidden");
    elStateBadRequest.classList.add("hidden");
    elStateNotFound.classList.add("hidden");
    elStateInvalidSource.classList.add("hidden");
    elSuccessCard.classList.add("hidden");
  }

  function resetRenderedSummary() {
    elRunIdValue.textContent = "-";
    elCurrentness.textContent = "-";
    elCreatedAt.textContent = "-";
    elCompletedAt.textContent = "-";
    elOutcome.textContent = "{}";
    elAuditSource.textContent = "-";
    elAuditResolvedFrom.textContent = "-";
    elRawPayload.textContent = "{}";
    renderList(elDriversList, [], "No drivers reported.");
    renderList(elIssuesList, [], "No issues reported.");
  }

  function renderList(el, values, emptyText) {
    el.innerHTML = "";

    if (!Array.isArray(values) || values.length === 0) {
      el.classList.add("empty");
      const li = document.createElement("li");
      li.textContent = emptyText;
      el.appendChild(li);
      return;
    }

    el.classList.remove("empty");
    for (const value of values) {
      const li = document.createElement("li");
      if (typeof value === "string") li.textContent = value;
      else if (value && typeof value === "object" && typeof value.code === "string") {
        li.textContent = value.code;
      } else {
        li.textContent = safeJson(value);
      }
      el.appendChild(li);
    }
  }

  function renderSuccess(payload) {
    hideAllStates();
    elSuccessCard.classList.remove("hidden");
    setStatePill("success", "success");

    elRunIdValue.textContent = asText(payload?.identity?.run_id);
    elCurrentness.textContent = asText(payload?.currentness?.state);
    elCreatedAt.textContent = asText(payload?.timeline?.created_at);
    elCompletedAt.textContent = asText(payload?.timeline?.completed_at);
    elOutcome.textContent = safeJson(payload?.outcome ?? {});
    elAuditSource.textContent = asText(payload?.audit?.source);
    elAuditResolvedFrom.textContent = asText(payload?.audit?.resolved_from);
    elRawPayload.textContent = safeJson(payload ?? {});

    renderList(elDriversList, payload?.drivers, "No drivers reported.");
    renderList(elIssuesList, payload?.issues, "No issues reported.");
  }

  function renderBadRequest(message) {
    hideAllStates();
    setStatePill("bad", "bad_request");
    elBadRequestText.textContent = asText(message, "Enter a valid run_id to load a decision summary.");
    elStateBadRequest.classList.remove("hidden");
  }

  function renderNotFound(message) {
    hideAllStates();
    setStatePill("not-found", "not_found");
    elNotFoundText.textContent = asText(message, "No persisted engine run matched that run_id.");
    elStateNotFound.classList.remove("hidden");
  }

  function renderInvalidSource(message) {
    hideAllStates();
    setStatePill("invalid", "invalid_source");
    elInvalidSourceText.textContent = asText(message, "The persisted source could not be projected safely.");
    elStateInvalidSource.classList.remove("hidden");
  }

  async function httpJson(path) {
    const res = await fetch(apiBase + path, {
      method: "GET",
      headers: {
        "accept": "application/json"
      }
    });

    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }

    return {
      status: res.status,
      ok: res.ok,
      json
    };
  }

  async function loadSummary() {
    const runId = readRunId();
    syncUrl(runId);
    resetRenderedSummary();

    if (!runId) {
      renderBadRequest("A valid run_id is required.");
      log("load blocked: missing run_id");
      return;
    }

    hideAllStates();
    setStatePill("loading", "loading");
    elStateLoading.classList.remove("hidden");

    const result = await httpJson(`/sessions/decision-summary/${encodeURIComponent(runId)}`);
    const payload = result.json ?? {};
    const message = payload?.message ?? payload?.extras?.failure_token ?? `HTTP ${result.status}`;

    if (result.ok) {
      renderSuccess(payload);
      log(`decision summary loaded: ${runId}`);
      return;
    }

    if (result.status === 400) {
      renderBadRequest(message);
      log(`bad request: ${message}`);
      return;
    }

    if (result.status === 404) {
      renderNotFound(message);
      log(`not found: ${message}`);
      return;
    }

    renderInvalidSource(message);
    log(`invalid source/internal failure: ${message}`);
  }

  elBtnLoad.addEventListener("click", async () => {
    try {
      await loadSummary();
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      renderInvalidSource(message);
      log(`unexpected failure: ${message}`);
    }
  });

  elRunId.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    elBtnLoad.click();
  });

  setStatePill("idle", "idle");
  resetRenderedSummary();

  if (initialRunId) {
    elBtnLoad.click();
  }
})();
