async function readJson(res) {
  const text = await res.text().catch(() => "");
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { ok: res.ok, status: res.status, text, json };
}

async function httpJson(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: typeof body === "undefined" ? undefined : JSON.stringify(body),
  });
  return await readJson(res);
}

const el = {
  phase1Input: document.getElementById("phase1Input"),
  sessionId: document.getElementById("sessionId"),
  currentStep: document.getElementById("currentStep"),
  stateOut: document.getElementById("stateOut"),
  logOut: document.getElementById("logOut"),
  btnLoadFixture: document.getElementById("btnLoadFixture"),
  btnCompile: document.getElementById("btnCompile"),
  btnStart: document.getElementById("btnStart"),
  btnRefresh: document.getElementById("btnRefresh"),
  btnCompleteStep: document.getElementById("btnCompleteStep"),
  btnContinue: document.getElementById("btnContinue"),
  btnSkip: document.getElementById("btnSkip"),
};

function log(msg, data) {
  const line = data ? `${msg}\n${JSON.stringify(data, null, 2)}\n` : `${msg}\n`;
  el.logOut.textContent = `${line}\n${el.logOut.textContent}`;
}

function renderState(state) {
  el.stateOut.textContent = JSON.stringify(state, null, 2);
  el.currentStep.textContent = JSON.stringify(state?.current_step ?? null, null, 2);
}

async function loadDefaultFixture() {
  const res = await fetch("/test/fixtures/golden/inputs/vanilla_minimal.json");
  const out = await readJson(res);
  if (!out.ok || !out.json) {
    throw new Error(`Failed to load fixture (${out.status}) ${out.text}`);
  }
  el.phase1Input.value = JSON.stringify(out.json, null, 2);
  log("Loaded default fixture.");
}

async function compileCreateSession() {
  const phase1_input = JSON.parse(el.phase1Input.value);
  const out = await httpJson("POST", "/blocks/compile?create_session=true", { phase1_input });
  log("POST /blocks/compile?create_session=true", out.json ?? out.text);
  if (!(out.status === 200 || out.status === 201)) {
    throw new Error(out.text || `compile failed (${out.status})`);
  }
  const sessionId = out.json?.session_id;
  if (!sessionId) throw new Error("Missing session_id in compile response");
  el.sessionId.value = sessionId;
  await refreshState();
}

async function startSession() {
  const sessionId = el.sessionId.value.trim();
  if (!sessionId) throw new Error("Missing session_id");
  const out = await httpJson("POST", `/sessions/${encodeURIComponent(sessionId)}/start`, {});
  log("POST /start", out.json ?? out.text);
  if (out.status !== 200) throw new Error(out.text || `start failed (${out.status})`);
  await refreshState();
}

async function postEvent(event) {
  const sessionId = el.sessionId.value.trim();
  if (!sessionId) throw new Error("Missing session_id");
  const out = await httpJson("POST", `/sessions/${encodeURIComponent(sessionId)}/events`, { event });
  log(`POST /events ${event.type}`, out.json ?? out.text);
  if (!(out.status === 200 || out.status === 201)) throw new Error(out.text || `event failed (${out.status})`);
  await refreshState();
}

async function refreshState() {
  const sessionId = el.sessionId.value.trim();
  if (!sessionId) throw new Error("Missing session_id");
  const out = await httpJson("GET", `/sessions/${encodeURIComponent(sessionId)}/state`);
  log("GET /state", out.json ?? out.text);
  if (out.status !== 200) throw new Error(out.text || `state failed (${out.status})`);
  renderState(out.json);
}

el.btnLoadFixture.addEventListener("click", async () => {
  try { await loadDefaultFixture(); } catch (e) { log(`ERROR: ${e.message}`); }
});

el.btnCompile.addEventListener("click", async () => {
  try { await compileCreateSession(); } catch (e) { log(`ERROR: ${e.message}`); }
});

el.btnStart.addEventListener("click", async () => {
  try { await startSession(); } catch (e) { log(`ERROR: ${e.message}`); }
});

el.btnRefresh.addEventListener("click", async () => {
  try { await refreshState(); } catch (e) { log(`ERROR: ${e.message}`); }
});

el.btnCompleteStep.addEventListener("click", async () => {
  try { await postEvent({ type: "COMPLETE_STEP" }); } catch (e) { log(`ERROR: ${e.message}`); }
});

el.btnContinue.addEventListener("click", async () => {
  try { await postEvent({ type: "RETURN_CONTINUE" }); } catch (e) { log(`ERROR: ${e.message}`); }
});

el.btnSkip.addEventListener("click", async () => {
  try { await postEvent({ type: "RETURN_SKIP" }); } catch (e) { log(`ERROR: ${e.message}`); }
});

el.phase1Input.value = JSON.stringify({
  note: "Click 'Load default fixture' or paste a valid phase1_input payload."
}, null, 2);