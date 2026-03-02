// public/session.js
(function () {
  const $ = (id) => document.getElementById(id);

  const elSessionId = $("sessionId");
  const elBtnLoad = $("btnLoad");
  const elBtnStart = $("btnStart");

  const elBanner = $("returnBanner");
  const elBtnContinue = $("btnContinue");
  const elBtnSkip = $("btnSkip");

  const elStarted = $("vStarted");
  const elGate = $("vGate");
  const elOptions = $("vOptions");
  const elTraceJson = $("traceJson");
  const elStateJson = $("stateJson");
  const elLog = $("log");

  const elApiBaseText = $("apiBaseText");

  const apiBase = window.location.origin;
  elApiBaseText.textContent = apiBase;

  const qs = new URLSearchParams(window.location.search);
  const initialSessionId = qs.get("session_id");
  if (initialSessionId) elSessionId.value = initialSessionId;

  let pollTimer = null;

  function log(line) {
    const ts = new Date().toISOString();
    elLog.textContent = `[${ts}] ${line}\n` + elLog.textContent;
  }

  function safeJson(x) {
    try { return JSON.stringify(x, null, 2); } catch { return String(x); }
  }

  function ensureSessionId() {
    const s = (elSessionId.value || "").trim();
    if (!s) throw new Error("Missing session_id");
    return s;
  }

  async function httpJson(method, path, body) {
    const url = apiBase + path;
    const opts = { method, headers: { "content-type": "application/json" } };
    if (body !== undefined) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }

    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} ${method} ${path}`);
      err.status = res.status;
      err.body = json;
      throw err;
    }
    return json;
  }

  function setBanner(required, options) {
    if (required === true) elBanner.classList.remove("hidden");
    else elBanner.classList.add("hidden");

    const opts = Array.isArray(options) ? options : [];
    const hasContinue = opts.includes("RETURN_CONTINUE");
    const hasSkip = opts.includes("RETURN_SKIP");

    elBtnContinue.disabled = !hasContinue;
    elBtnSkip.disabled = !hasSkip;

    elBtnContinue.textContent = hasContinue ? "Continue" : "Continue (n/a)";
    elBtnSkip.textContent = hasSkip ? "Skip" : "Skip (n/a)";
  }

  function renderState(payload) {
    elStateJson.textContent = safeJson(payload);

    const trace = payload && payload.trace ? payload.trace : {};
    elTraceJson.textContent = safeJson(trace);

    elStarted.textContent = String(!!payload.started);
    elGate.textContent = String(!!trace.return_decision_required);
    elOptions.textContent = safeJson(trace.return_decision_options || []);

    setBanner(trace.return_decision_required === true, trace.return_decision_options || []);
  }

  async function loadStateOnce() {
    const sessionId = ensureSessionId();
    const payload = await httpJson("GET", `/sessions/${encodeURIComponent(sessionId)}/state`);
    renderState(payload);
    return payload;
  }

  async function startSession() {
    const sessionId = ensureSessionId();
    const out = await httpJson("POST", `/sessions/${encodeURIComponent(sessionId)}/start`);
    log(`start ok: ${safeJson(out)}`);
    await loadStateOnce();
  }

  async function sendReturnDecision(choice) {
    const sessionId = ensureSessionId();
    const ev = { type: choice };
    const out = await httpJson("POST", `/sessions/${encodeURIComponent(sessionId)}/events`, { event: ev });
    log(`event ok: ${safeJson(out)}`);
    await loadStateOnce();
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      try {
        await loadStateOnce();
      } catch (e) {
        log(`poll error: ${e && e.message ? e.message : String(e)}`);
      }
    }, 750);
  }

  elBtnLoad.addEventListener("click", async () => {
    try {
      const p = await loadStateOnce();
      log("state loaded");
      startPolling();

      // keep URL in sync
      const s = ensureSessionId();
      const next = new URL(window.location.href);
      next.searchParams.set("session_id", s);
      window.history.replaceState({}, "", next.toString());

      return p;
    } catch (e) {
      log(`load failed: ${e && e.message ? e.message : String(e)}`);
      if (e && e.body) log(`error body: ${safeJson(e.body)}`);
    }
  });

  elBtnStart.addEventListener("click", async () => {
    try {
      await startSession();
      startPolling();
    } catch (e) {
      log(`start failed: ${e && e.message ? e.message : String(e)}`);
      if (e && e.body) log(`error body: ${safeJson(e.body)}`);
    }
  });

  elBtnContinue.addEventListener("click", async () => {
    try {
      await sendReturnDecision("RETURN_CONTINUE");
    } catch (e) {
      log(`continue failed: ${e && e.message ? e.message : String(e)}`);
      if (e && e.body) log(`error body: ${safeJson(e.body)}`);
    }
  });

  elBtnSkip.addEventListener("click", async () => {
    try {
      await sendReturnDecision("RETURN_SKIP");
    } catch (e) {
      log(`skip failed: ${e && e.message ? e.message : String(e)}`);
      if (e && e.body) log(`error body: ${safeJson(e.body)}`);
    }
  });

  // auto-load if session_id was provided
  if (initialSessionId) {
    elBtnLoad.click();
  }
})();