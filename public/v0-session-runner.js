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

  statStarted: document.getElementById("statStarted"),
  statCompleted: document.getElementById("statCompleted"),
  statRemaining: document.getElementById("statRemaining"),
  statDropped: document.getElementById("statDropped"),

  stepBadge: document.getElementById("stepBadge"),
  stepTitle: document.getElementById("stepTitle"),
  stepSubtitle: document.getElementById("stepSubtitle"),
  stepBody: document.getElementById("stepBody"),

  btnLoadFixture: document.getElementById("btnLoadFixture"),
  btnCompile: document.getElementById("btnCompile"),
  btnStart: document.getElementById("btnStart"),
  btnRefresh: document.getElementById("btnRefresh"),
  btnSplitSession: document.getElementById("btnSplitSession"),
  btnCompleteStep: document.getElementById("btnCompleteStep"),
  btnContinue: document.getElementById("btnContinue"),
  btnSkip: document.getElementById("btnSkip"),
};

function log(msg, data) {
  const line = data ? `${msg}\n${JSON.stringify(data, null, 2)}\n` : `${msg}\n`;
  el.logOut.textContent = `${line}\n${el.logOut.textContent}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatIntensity(intensity) {
  if (!intensity || typeof intensity !== "object") return "-";
  const type = String(intensity.type || "");
  const value = intensity.value;

  if (type === "percent_1rm" && typeof value === "number") return `${value}% 1RM`;
  if (type && typeof value !== "undefined") return `${type}: ${value}`;
  if (type) return type;
  return "-";
}

function renderExerciseBody(step) {
  const ex = step?.exercise || {};
  const exerciseId = ex.exercise_id || "(unknown exercise)";
  const sets = Number.isInteger(ex.sets) ? String(ex.sets) : "-";
  const reps = Number.isInteger(ex.reps) ? String(ex.reps) : "-";
  const rest = Number.isInteger(ex.rest_seconds) ? `${ex.rest_seconds}s` : "-";
  const intensity = formatIntensity(ex.intensity);
  const blockId = ex.block_id || "-";
  const itemId = ex.item_id || "-";

  el.stepBody.innerHTML = `
    <div class="muted mono">exercise_id=${escapeHtml(exerciseId)}</div>
    <div class="step-metrics">
      <div class="metric">
        <div class="metric-label">Sets × Reps</div>
        <div class="metric-value">${escapeHtml(`${sets} × ${reps}`)}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Rest</div>
        <div class="metric-value">${escapeHtml(rest)}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Intensity</div>
        <div class="metric-value">${escapeHtml(intensity)}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Block / Item</div>
        <div class="metric-value">${escapeHtml(`${blockId} / ${itemId}`)}</div>
      </div>
    </div>
  `;
}

function renderReturnDecisionBody(step) {
  const options = Array.isArray(step?.options) ? step.options : [];
  const items = options.length
    ? options.map((opt) => `<li class="mono">${escapeHtml(opt)}</li>`).join("")
    : `<li class="muted">No options supplied.</li>`;

  el.stepBody.innerHTML = `
    <div class="muted">The session is waiting for an explicit return decision.</div>
    <ul class="options-list">
      ${items}
    </ul>
  `;
}

function renderIdleBody(message) {
  el.stepBody.innerHTML = `<div class="muted">${escapeHtml(message)}</div>`;
}

function disableStepActions() {
  el.btnCompleteStep.disabled = true;
  el.btnContinue.disabled = true;
  el.btnSkip.disabled = true;
}

function setStepUiIdle(title, subtitle, bodyMessage) {
  el.stepBadge.textContent = "No current step";
  el.stepBadge.className = "pill idle";
  el.stepTitle.textContent = title;
  el.stepSubtitle.textContent = subtitle;
  renderIdleBody(bodyMessage || "No step details yet.");
  disableStepActions();
}

function setStepUiExercise(step, started) {
  const exerciseId = step?.exercise?.exercise_id || "(unknown exercise)";

  el.stepBadge.textContent = "Exercise";
  el.stepBadge.className = "pill ok";
  el.stepTitle.textContent = exerciseId;
  el.stepSubtitle.textContent = started
    ? "Current action: complete this step, or split session to enter return decision."
    : "Session not started. Press Start to begin.";
  renderExerciseBody(step);

  el.btnCompleteStep.disabled = !started;
  el.btnContinue.disabled = true;
  el.btnSkip.disabled = true;
}

function setStepUiReturnDecision(step, started) {
  const options = Array.isArray(step?.options) ? step.options : [];
  const hasContinue = options.includes("RETURN_CONTINUE");
  const hasSkip = options.includes("RETURN_SKIP");

  el.stepBadge.textContent = "Return decision";
  el.stepBadge.className = "pill warn";
  el.stepTitle.textContent = "Return decision required";
  el.stepSubtitle.textContent = started
    ? "Choose how to resume after split."
    : "Session not started. Press Start to begin.";
  renderReturnDecisionBody(step);

  el.btnCompleteStep.disabled = true;
  el.btnContinue.disabled = !started || !hasContinue;
  el.btnSkip.disabled = !started || !hasSkip;
}

function updateGlobalButtons(started, stepType) {
  el.btnStart.disabled = !el.sessionId.value.trim() || started === true;
  el.btnRefresh.disabled = !el.sessionId.value.trim();
  el.btnSplitSession.disabled = !el.sessionId.value.trim() || started !== true || stepType !== "EXERCISE";
}

function renderState(state) {
  el.stateOut.textContent = JSON.stringify(state, null, 2);
  el.currentStep.textContent = JSON.stringify(state?.current_step ?? null, null, 2);

  const started = !!state?.started;
  const completedCount = Array.isArray(state?.completed_exercises) ? state.completed_exercises.length : 0;
  const remainingCount = Array.isArray(state?.remaining_exercises) ? state.remaining_exercises.length : 0;
  const droppedCount = Array.isArray(state?.dropped_exercises) ? state.dropped_exercises.length : 0;

  el.statStarted.textContent = String(started);
  el.statCompleted.textContent = String(completedCount);
  el.statRemaining.textContent = String(remainingCount);
  el.statDropped.textContent = String(droppedCount);

  const step = state?.current_step;
  const stepType = step && typeof step === "object" ? String(step.type || "") : "";

  updateGlobalButtons(started, stepType);

  if (!step || typeof step !== "object") {
    setStepUiIdle(
      started ? "No current step available" : "Session not started",
      started ? "Refresh state or inspect payload." : "Start the session to get the first step.",
      started ? "No step details available." : "No step details yet."
    );
    return;
  }

  if (step.type === "EXERCISE") {
    setStepUiExercise(step, started);
    return;
  }

  if (step.type === "RETURN_DECISION") {
    setStepUiReturnDecision(step, started);
    return;
  }

  setStepUiIdle(
    `Unsupported step type: ${String(step.type)}`,
    "State payload contains a step type the UI does not yet handle.",
    "Unsupported step payload."
  );
}

async function loadDefaultFixture() {
  const res = await fetch("/ui/fixtures/vanilla_minimal.json");
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

el.btnSplitSession.addEventListener("click", async () => {
  try { await postEvent({ type: "SPLIT_SESSION" }); } catch (e) { log(`ERROR: ${e.message}`); }
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

updateGlobalButtons(false, "");
setStepUiIdle("No session state loaded", "Load or create a session to begin.", "No step details yet.");