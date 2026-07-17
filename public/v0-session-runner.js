// DEV NOTE: BETA-16 extends the existing browser session runner.
// User-facing prose is resolved only from the BETA-16 Copy Registry.
// This file transports product records and factual API events only.

const COPY_IDS = Object.freeze({
  pageTitle: "BETA16_COPY_PAGE_TITLE",
  ready: "BETA16_COPY_STATUS_READY",
  error: "BETA16_COPY_STATUS_ERROR",
  authRecorded: "BETA16_COPY_AUTH_RECORDED",
  acknowledgementRecorded:
    "BETA16_COPY_ACKNOWLEDGEMENT_RECORDED",
  declarationRecorded:
    "BETA16_COPY_DECLARATION_RECORDED",
  compileRecorded:
    "BETA16_COPY_COMPILE_RECORDED",
  notStarted: "BETA16_COPY_NOT_STARTED",
  inProgress: "BETA16_COPY_IN_PROGRESS",
  returnPending:
    "BETA16_COPY_RETURN_PENDING",
  completed: "BETA16_COPY_COMPLETED",
  partial: "BETA16_COPY_PARTIAL",
  currentExercise:
    "BETA16_COPY_CURRENT_EXERCISE",
  returnDecision:
    "BETA16_COPY_RETURN_DECISION",
  noCurrentItem:
    "BETA16_COPY_NO_CURRENT_ITEM",
  sets: "BETA16_COPY_SETS_LABEL",
  reps: "BETA16_COPY_REPS_LABEL",
  rest: "BETA16_COPY_REST_LABEL",
  intensity: "BETA16_COPY_INTENSITY_LABEL",
  emptyCurrent:
    "BETA16_COPY_EMPTY_CURRENT",
  emptyUpcoming:
    "BETA16_COPY_EMPTY_UP_NEXT",
  emptyCompleted:
    "BETA16_COPY_EMPTY_COMPLETED",
  emptyDropped:
    "BETA16_COPY_EMPTY_DROPPED",
  requestRecorded:
    "BETA16_COPY_REQUEST_RECORDED",
  fixtureLoaded:
    "BETA16_COPY_FIXTURE_LOADED",
  sessionStarted:
    "BETA16_COPY_SESSION_STARTED",
  eventRecorded:
    "BETA16_COPY_EVENT_RECORDED",
  stateRefreshed:
    "BETA16_COPY_STATE_REFRESHED"
});

const elements = {
  appStatus:
    document.getElementById("appStatus"),
  authUserId:
    document.getElementById("authUserId"),
  authEmail:
    document.getElementById("authEmail"),
  authDisplayName:
    document.getElementById("authDisplayName"),
  betaAcknowledged:
    document.getElementById("betaAcknowledged"),
  jurisdictionAcknowledged:
    document.getElementById(
      "jurisdictionAcknowledged"
    ),
  activityId:
    document.getElementById("activityId"),
  phase1Input:
    document.getElementById("phase1Input"),
  sessionId:
    document.getElementById("sessionId"),
  statLifecycle:
    document.getElementById("statLifecycle"),
  statCompleted:
    document.getElementById("statCompleted"),
  statRemaining:
    document.getElementById("statRemaining"),
  statDropped:
    document.getElementById("statDropped"),
  statClassification:
    document.getElementById(
      "statClassification"
    ),
  currentItem:
    document.getElementById("currentItem"),
  queueCurrent:
    document.getElementById("queueCurrent"),
  queueUpcoming:
    document.getElementById("queueUpcoming"),
  historyCompleted:
    document.getElementById(
      "historyCompleted"
    ),
  historyDropped:
    document.getElementById(
      "historyDropped"
    ),
  stateOut:
    document.getElementById("stateOut"),
  logOut:
    document.getElementById("logOut"),
  btnAuth:
    document.getElementById("btnAuth"),
  btnAcknowledge:
    document.getElementById("btnAcknowledge"),
  btnDeclare:
    document.getElementById("btnDeclare"),
  btnCompile:
    document.getElementById("btnCompile"),
  btnStart:
    document.getElementById("btnStart"),
  btnRefresh:
    document.getElementById("btnRefresh"),
  btnSplitSession:
    document.getElementById(
      "btnSplitSession"
    ),
  btnCompleteStep:
    document.getElementById(
      "btnCompleteStep"
    ),
  btnContinue:
    document.getElementById("btnContinue"),
  btnSkip:
    document.getElementById("btnSkip")
};

const appState = {
  copy: new Map(),
  phase1Base: null,
  phase1Input: null,
  authRecord: null,
  acknowledgementRecord: null,
  declarationRecord: null,
  sessionState: null
};

function copy(copyId) {
  const value = appState.copy.get(copyId);

  if (typeof value !== "string") {
    throw new Error(
      `COPY_ID_MISSING:${copyId}`
    );
  }

  return value;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setStatus(copyId, technical = "") {
  elements.appStatus.textContent =
    technical
      ? `${copy(copyId)} ${technical}`
      : copy(copyId);
}

function log(copyId, data = null) {
  const technical =
    data === null
      ? ""
      : `\n${JSON.stringify(data, null, 2)}`;

  elements.logOut.textContent =
    `${copy(copyId)}${technical}\n\n` +
    elements.logOut.textContent;
}

async function readJson(response) {
  const text =
    await response.text().catch(() => "");

  let json = null;

  try {
    json = text
      ? JSON.parse(text)
      : null;
  }
  catch {
    json = {
      raw: text
    };
  }

  return {
    ok: response.ok,
    status: response.status,
    json
  };
}

async function httpJson(
  method,
  path,
  body
) {
  const response = await fetch(path, {
    method,
    headers: {
      "content-type": "application/json"
    },
    body:
      typeof body === "undefined"
        ? undefined
        : JSON.stringify(body)
  });

  const result = await readJson(response);

  log(COPY_IDS.requestRecorded, {
    method,
    path,
    status: result.status
  });

  if (!result.ok) {
    const error =
      new Error(
        String(
          result.json?.reason ??
          result.json?.failure_token ??
          result.status
        )
      );

    error.result = result;
    throw error;
  }

  return result.json;
}

function applyCopyRegistry() {
  for (
    const node of document.querySelectorAll(
      "[data-copy-id]"
    )
  ) {
    node.textContent =
      copy(node.dataset.copyId);
  }

  for (
    const node of document.querySelectorAll(
      "[data-copy-placeholder-id]"
    )
  ) {
    node.setAttribute(
      "placeholder",
      copy(
        node.dataset.copyPlaceholderId
      )
    );
  }

  document.title =
    copy(COPY_IDS.pageTitle);

  document.body.dataset.copyReady = "true";
}

async function loadCopyRegistry() {
  const response = await fetch(
    "/ui/beta_16_app_path_phase1_6_copy.json"
  );

  const result = await readJson(response);

  if (
    !result.ok ||
    !Array.isArray(result.json)
  ) {
    throw new Error(
      "BETA16_REGISTRY_LOAD_FAILED"
    );
  }

  for (const entry of result.json) {
    appState.copy.set(
      entry.copy_id,
      entry.text
    );
  }

  applyCopyRegistry();
}

async function loadPhase1Fixture() {
  const response = await fetch(
    "/ui/fixtures/vanilla_minimal.json"
  );

  const result = await readJson(response);

  if (!result.ok || !result.json) {
    throw new Error(
      "BETA16_PHASE1_FIXTURE_LOAD_FAILED"
    );
  }

  appState.phase1Base =
    structuredClone(result.json);

  buildPhase1Input();
  log(COPY_IDS.fixtureLoaded);
}

function buildPhase1Input() {
  if (!appState.phase1Base) {
    return null;
  }

  appState.phase1Input = {
    ...structuredClone(
      appState.phase1Base
    ),
    actor_type: "athlete",
    execution_scope: "individual",
    activity_id:
      elements.activityId.value,
    consent_granted: true
  };

  elements.phase1Input.value =
    JSON.stringify(
      appState.phase1Input,
      null,
      2
    );

  return appState.phase1Input;
}

function nowIso() {
  return new Date().toISOString();
}

function userId() {
  return elements.authUserId.value.trim();
}

function updateFlowButtons() {
  elements.btnAcknowledge.disabled =
    appState.authRecord === null;

  elements.btnDeclare.disabled =
    appState.acknowledgementRecord === null;

  elements.btnCompile.disabled =
    appState.declarationRecord === null;

  const hasSession =
    elements.sessionId.value.trim().length > 0;

  elements.btnStart.disabled =
    !hasSession ||
    appState.sessionState?.started === true;

  elements.btnRefresh.disabled =
    !hasSession;
}

function exerciseDisplayName(exercise) {
  const raw = String(
    exercise?.display_name ??
    exercise?.exercise_name ??
    exercise?.exercise_id ??
    exercise?.item_id ??
    ""
  ).trim();

  return raw || "-";
}

function exerciseMeta(exercise) {
  const sets =
    Number.isInteger(exercise?.sets)
      ? exercise.sets
      : "-";

  const reps =
    Number.isInteger(exercise?.reps)
      ? exercise.reps
      : "-";

  const rest =
    Number.isInteger(
      exercise?.rest_seconds
    )
      ? exercise.rest_seconds
      : "-";

  const intensity =
    exercise?.intensity &&
    typeof exercise.intensity === "object"
      ? JSON.stringify(
          exercise.intensity
        )
      : "-";

  return [
    `${copy(COPY_IDS.sets)}: ${sets}`,
    `${copy(COPY_IDS.reps)}: ${reps}`,
    `${copy(COPY_IDS.rest)}: ${rest}`,
    `${copy(COPY_IDS.intensity)}: ${intensity}`
  ].join(" | ");
}

function queueItem(exercise) {
  return `
    <article class="queue-item">
      <strong>${escapeHtml(
        exerciseDisplayName(exercise)
      )}</strong>
      <div class="muted">
        ${escapeHtml(
          exerciseMeta(exercise)
        )}
      </div>
    </article>
  `;
}

function renderList(
  target,
  values,
  emptyCopyId
) {
  target.innerHTML =
    values.length > 0
      ? values.map(queueItem).join("")
      : `<div class="muted">${escapeHtml(
          copy(emptyCopyId)
        )}</div>`;
}

function readCounts(state) {
  return {
    completed:
      Array.isArray(
        state?.completed_exercises
      )
        ? state.completed_exercises
        : [],
    remaining:
      Array.isArray(
        state?.remaining_exercises
      )
        ? state.remaining_exercises
        : [],
    dropped:
      Array.isArray(
        state?.dropped_exercises
      )
        ? state.dropped_exercises
        : []
  };
}

function classificationCopyId(
  state,
  counts
) {
  const returnPending =
    state?.current_step?.type ===
    "RETURN_DECISION";

  if (returnPending) {
    return COPY_IDS.returnPending;
  }

  const total =
    counts.completed.length +
    counts.remaining.length +
    counts.dropped.length;

  if (
    total > 0 &&
    counts.remaining.length === 0 &&
    counts.dropped.length > 0
  ) {
    return COPY_IDS.partial;
  }

  if (
    total > 0 &&
    counts.remaining.length === 0
  ) {
    return COPY_IDS.completed;
  }

  if (state?.started === true) {
    return COPY_IDS.inProgress;
  }

  return COPY_IDS.notStarted;
}

function renderCurrentStep(state) {
  const step = state?.current_step;

  elements.btnCompleteStep.disabled = true;
  elements.btnContinue.disabled = true;
  elements.btnSkip.disabled = true;
  elements.btnSplitSession.disabled = true;

  if (
    !step ||
    typeof step !== "object"
  ) {
    elements.currentItem.innerHTML =
      `<div class="muted">${escapeHtml(
        copy(COPY_IDS.noCurrentItem)
      )}</div>`;

    return;
  }

  if (step.type === "EXERCISE") {
    const exercise =
      step.exercise ?? {};

    elements.currentItem.innerHTML = `
      <h3>${escapeHtml(
        copy(COPY_IDS.currentExercise)
      )}</h3>
      ${queueItem(exercise)}
    `;

    if (state.started === true) {
      elements.btnCompleteStep.disabled =
        false;

      elements.btnSplitSession.disabled =
        false;
    }

    return;
  }

  if (
    step.type === "RETURN_DECISION"
  ) {
    elements.currentItem.innerHTML = `
      <h3>${escapeHtml(
        copy(COPY_IDS.returnDecision)
      )}</h3>
    `;

    const options =
      Array.isArray(step.options)
        ? step.options
        : [];

    elements.btnContinue.disabled =
      !options.includes(
        "RETURN_CONTINUE"
      );

    elements.btnSkip.disabled =
      !options.includes(
        "RETURN_SKIP"
      );

    return;
  }

  elements.currentItem.innerHTML =
    `<div class="mono">${escapeHtml(
      String(step.type ?? "-")
    )}</div>`;
}

function renderState(state) {
  appState.sessionState = state;
  elements.stateOut.textContent =
    JSON.stringify(state, null, 2);

  const counts = readCounts(state);

  elements.statCompleted.textContent =
    String(counts.completed.length);

  elements.statRemaining.textContent =
    String(counts.remaining.length);

  elements.statDropped.textContent =
    String(counts.dropped.length);

  const classificationId =
    classificationCopyId(
      state,
      counts
    );

  elements.statLifecycle.textContent =
    copy(classificationId);

  elements.statClassification.textContent =
    copy(classificationId);

  renderCurrentStep(state);

  renderList(
    elements.queueCurrent,
    counts.remaining.slice(0, 1),
    COPY_IDS.emptyCurrent
  );

  renderList(
    elements.queueUpcoming,
    counts.remaining.slice(1, 4),
    COPY_IDS.emptyUpcoming
  );

  renderList(
    elements.historyCompleted,
    counts.completed,
    COPY_IDS.emptyCompleted
  );

  renderList(
    elements.historyDropped,
    counts.dropped,
    COPY_IDS.emptyDropped
  );

  updateFlowButtons();
}

async function recordAuth() {
  const timestamp = nowIso();

  const response = await httpJson(
    "POST",
    "/sessions/beta-auth",
    {
      user_id: userId(),
      email:
        elements.authEmail.value.trim(),
      display_name:
        elements.authDisplayName.value.trim(),
      account_role: "athlete",
      account_state: "active",
      accepted_terms_version:
        "terms_v1",
      created_at_iso8601: timestamp
    }
  );

  appState.authRecord =
    response.auth_record;

  setStatus(COPY_IDS.authRecorded);
  updateFlowButtons();
}

async function recordAcknowledgement() {
  const currentUserId = userId();

  const response = await httpJson(
    "POST",
    "/sessions/beta-acknowledgement",
    {
      acknowledgement_id:
        `beta16_ack_${currentUserId}`,
      user_id: currentUserId,
      beta_id:
        "september_beta_2026",
      accepted:
        elements.betaAcknowledged.checked,
      jurisdiction_acknowledged:
        elements
          .jurisdictionAcknowledged
          .checked,
      accepted_at_iso8601: nowIso(),
      copy_acknowledgement_id:
        "BETA16_COPY_ACKNOWLEDGEMENT_LABEL"
    }
  );

  appState.acknowledgementRecord =
    response.acknowledgement_record;

  setStatus(
    COPY_IDS.acknowledgementRecorded
  );

  updateFlowButtons();
}

async function recordDeclaration() {
  const phase1Input =
    buildPhase1Input();

  const response = await httpJson(
    "POST",
    "/sessions/beta-declaration",
    {
      declaration_id:
        `beta16_declaration_${userId()}`,
      user_id: userId(),
      phase1_input: phase1Input,
      jurisdiction_acknowledged:
        elements
          .jurisdictionAcknowledged
          .checked,
      declared_at_iso8601: nowIso(),
      accepted_terms_version:
        "terms_v1",
      copy_acknowledgement_id:
        "BETA16_COPY_DECLARATION_ACKNOWLEDGEMENT"
    }
  );

  appState.declarationRecord =
    response.declaration_record;

  setStatus(
    COPY_IDS.declarationRecorded
  );

  updateFlowButtons();
}

async function compileSession() {
  const phase1Input =
    buildPhase1Input();

  const response = await httpJson(
    "POST",
    "/blocks/compile?create_session=true&beta_path=true",
    {
      phase1_input: phase1Input,
      beta_path_context: {
        auth_record:
          appState.authRecord,
        acknowledgement_record:
          appState
            .acknowledgementRecord,
        declaration_record:
          appState.declarationRecord
      }
    }
  );

  elements.sessionId.value =
    response.session_id ?? "";

  setStatus(COPY_IDS.compileRecorded);

  await refreshState();
}

async function startSession() {
  const sessionId =
    elements.sessionId.value.trim();

  await httpJson(
    "POST",
    `/sessions/${encodeURIComponent(
      sessionId
    )}/start`,
    {}
  );

  log(COPY_IDS.sessionStarted);
  await refreshState();
}

async function postEvent(event) {
  const sessionId =
    elements.sessionId.value.trim();

  await httpJson(
    "POST",
    `/sessions/${encodeURIComponent(
      sessionId
    )}/events`,
    {
      event
    }
  );

  log(COPY_IDS.eventRecorded, {
    event_type: event.type
  });

  await refreshState();
}

async function refreshState() {
  const sessionId =
    elements.sessionId.value.trim();

  const response = await httpJson(
    "GET",
    `/sessions/${encodeURIComponent(
      sessionId
    )}/state`
  );

  renderState(response);
  log(COPY_IDS.stateRefreshed);
}

async function runAction(action) {
  try {
    await action();
  }
  catch (error) {
    const technical =
      String(
        error?.result?.json?.reason ??
        error?.result?.json
          ?.failure_token ??
        error?.message ??
        "unknown"
      );

    setStatus(
      COPY_IDS.error,
      technical
    );
  }
}

elements.activityId.addEventListener(
  "change",
  () => {
    appState.declarationRecord = null;
    buildPhase1Input();
    updateFlowButtons();
  }
);

elements.betaAcknowledged.addEventListener(
  "change",
  updateFlowButtons
);

elements.jurisdictionAcknowledged
  .addEventListener(
    "change",
    updateFlowButtons
  );

elements.btnAuth.addEventListener(
  "click",
  () => runAction(recordAuth)
);

elements.btnAcknowledge.addEventListener(
  "click",
  () =>
    runAction(recordAcknowledgement)
);

elements.btnDeclare.addEventListener(
  "click",
  () =>
    runAction(recordDeclaration)
);

elements.btnCompile.addEventListener(
  "click",
  () =>
    runAction(compileSession)
);

elements.btnStart.addEventListener(
  "click",
  () =>
    runAction(startSession)
);

elements.btnRefresh.addEventListener(
  "click",
  () =>
    runAction(refreshState)
);

elements.btnSplitSession.addEventListener(
  "click",
  () =>
    runAction(
      () =>
        postEvent({
          type: "SPLIT_SESSION"
        })
    )
);

elements.btnCompleteStep.addEventListener(
  "click",
  () =>
    runAction(
      () =>
        postEvent({
          type: "COMPLETE_STEP"
        })
    )
);

elements.btnContinue.addEventListener(
  "click",
  () =>
    runAction(
      () =>
        postEvent({
          type: "RETURN_CONTINUE"
        })
    )
);

elements.btnSkip.addEventListener(
  "click",
  () =>
    runAction(
      () =>
        postEvent({
          type: "RETURN_SKIP"
        })
    )
);

async function initialise() {
  await loadCopyRegistry();

  elements.authUserId.value =
    "beta_user_001";

  elements.authEmail.value =
    "beta.user@example.com";

  elements.authDisplayName.value =
    "Beta User";

  elements.logOut.textContent = "";

  await loadPhase1Fixture();

  renderState({
    started: false,
    completed_exercises: [],
    remaining_exercises: [],
    dropped_exercises: [],
    current_step: null
  });

  setStatus(COPY_IDS.ready);
}

initialise().catch((error) => {
  document.body.dataset.copyReady = "true";

  elements.appStatus.textContent =
    String(
      error?.message ??
      "BETA16_INITIALISATION_FAILED"
    );
});
