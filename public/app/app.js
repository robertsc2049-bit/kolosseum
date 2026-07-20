const STORAGE_KEY = "kolosseum.product.app.v1";

const DEFAULT_STATE = Object.freeze({
  version: 1,
  role: null,
  profile: null,
  coachProfile: null,
  authRecord: null,
  acknowledgementRecord: null,
  declarationRecord: null,
  phase1Input: null,
  activeSessionId: null,
  activeSessionState: null,
  history: [],
  localSessions: [],
  view: "today",
  coachAthletes: [],
  coachAssignments: [],
  coachArtefactCount: 0,
  coachCode: ""
});

const state = loadState();

const elements = {
  bootScreen: document.getElementById("bootScreen"),
  entryView: document.getElementById("entryView"),
  entryForm: document.getElementById("entryForm"),
  entryName: document.getElementById("entryName"),
  entryEmail: document.getElementById("entryEmail"),
  entryActivityField: document.getElementById("entryActivityField"),
  entryActivity: document.getElementById("entryActivity"),
  entryBetaConsent: document.getElementById("entryBetaConsent"),
  entryDeclarationConsent: document.getElementById("entryDeclarationConsent"),
  entrySubmit: document.getElementById("entrySubmit"),
  entryError: document.getElementById("entryError"),
  appShell: document.getElementById("appShell"),
  sidebar: document.getElementById("sidebar"),
  workspaceLabel: document.getElementById("workspaceLabel"),
  sidebarAvatar: document.getElementById("sidebarAvatar"),
  sidebarName: document.getElementById("sidebarName"),
  sidebarRole: document.getElementById("sidebarRole"),
  menuButton: document.getElementById("menuButton"),
  topbarEyebrow: document.getElementById("topbarEyebrow"),
  topbarTitle: document.getElementById("topbarTitle"),
  topbarAccount: document.getElementById("topbarAccount"),
  connectionStatus: document.getElementById("connectionStatus"),
  notice: document.getElementById("notice"),
  busyOverlay: document.getElementById("busyOverlay"),
  busyText: document.getElementById("busyText"),

  todayGreeting: document.getElementById("todayGreeting"),
  createSessionButton: document.getElementById("createSessionButton"),
  todaySessionEmpty: document.getElementById("todaySessionEmpty"),
  todaySessionContent: document.getElementById("todaySessionContent"),
  todayStatusBadge: document.getElementById("todayStatusBadge"),
  todayActivity: document.getElementById("todayActivity"),
  todaySessionTitle: document.getElementById("todaySessionTitle"),
  todayCompleted: document.getElementById("todayCompleted"),
  todayRemaining: document.getElementById("todayRemaining"),
  todayDropped: document.getElementById("todayDropped"),
  continueSessionButton: document.getElementById("continueSessionButton"),
  todayHistoryCount: document.getElementById("todayHistoryCount"),
  todayRecentList: document.getElementById("todayRecentList"),

  sessionActivity: document.getElementById("sessionActivity"),
  sessionTitle: document.getElementById("sessionTitle"),
  sessionSubtitle: document.getElementById("sessionSubtitle"),
  sessionStatusBadge: document.getElementById("sessionStatusBadge"),
  sessionEmpty: document.getElementById("sessionEmpty"),
  sessionWorkspace: document.getElementById("sessionWorkspace"),
  sessionProgressText: document.getElementById("sessionProgressText"),
  currentExercise: document.getElementById("currentExercise"),
  returnDecision: document.getElementById("returnDecision"),
  sessionActions: document.getElementById("sessionActions"),
  startSessionButton: document.getElementById("startSessionButton"),
  completeExerciseButton: document.getElementById("completeExerciseButton"),
  splitSessionButton: document.getElementById("splitSessionButton"),
  returnContinueButton: document.getElementById("returnContinueButton"),
  returnSkipButton: document.getElementById("returnSkipButton"),
  sessionProgressBar: document.getElementById("sessionProgressBar"),
  sessionCompletedCount: document.getElementById("sessionCompletedCount"),
  sessionRemainingCount: document.getElementById("sessionRemainingCount"),
  sessionDroppedCount: document.getElementById("sessionDroppedCount"),
  exerciseQueue: document.getElementById("exerciseQueue"),

  refreshHistoryButton: document.getElementById("refreshHistoryButton"),
  historyList: document.getElementById("historyList"),

  coachGreeting: document.getElementById("coachGreeting"),
  coachAthleteCount: document.getElementById("coachAthleteCount"),
  coachAssignmentCount: document.getElementById("coachAssignmentCount"),
  coachArtefactCount: document.getElementById("coachArtefactCount"),
  coachOverviewAthletes: document.getElementById("coachOverviewAthletes"),
  connectAthleteForm: document.getElementById("connectAthleteForm"),
  connectAthleteName: document.getElementById("connectAthleteName"),
  connectAthleteId: document.getElementById("connectAthleteId"),
  connectAthleteActivity: document.getElementById("connectAthleteActivity"),
  connectAthleteConsent: document.getElementById("connectAthleteConsent"),
  athleteRoster: document.getElementById("athleteRoster"),
  assignmentForm: document.getElementById("assignmentForm"),
  assignmentAthlete: document.getElementById("assignmentAthlete"),
  assignmentTemplate: document.getElementById("assignmentTemplate"),
  assignmentResult: document.getElementById("assignmentResult"),
  reviewAthlete: document.getElementById("reviewAthlete"),
  loadReviewButton: document.getElementById("loadReviewButton"),
  reviewList: document.getElementById("reviewList"),
  coachNoteForm: document.getElementById("coachNoteForm"),
  coachNoteHeading: document.getElementById("coachNoteHeading"),
  coachNoteSessionId: document.getElementById("coachNoteSessionId"),
  coachNoteArtefactId: document.getElementById("coachNoteArtefactId"),
  coachNoteText: document.getElementById("coachNoteText"),
  coachNoteVisibility: document.getElementById("coachNoteVisibility"),

  accountAvatar: document.getElementById("accountAvatar"),
  accountName: document.getElementById("accountName"),
  accountEmail: document.getElementById("accountEmail"),
  accountRoleBadge: document.getElementById("accountRoleBadge"),
  accountCode: document.getElementById("accountCode"),
  copyAccountCodeButton: document.getElementById("copyAccountCodeButton"),
  signOutButton: document.getElementById("signOutButton")
};

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!parsed || parsed.version !== 1) {
      return cloneDefaultState();
    }

    return {
      ...cloneDefaultState(),
      ...parsed,
      coachAthletes: Array.isArray(parsed.coachAthletes) ? parsed.coachAthletes : [],
      coachAssignments: Array.isArray(parsed.coachAssignments) ? parsed.coachAssignments : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
      localSessions: Array.isArray(parsed.localSessions) ? parsed.localSessions : []
    };
  }
  catch {
    return cloneDefaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createId(prefix) {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${id.replaceAll("-", "")}`;
}

function nowIso() {
  return new Date().toISOString();
}

function initials(name) {
  const words = String(name ?? "").trim().split(/\s+/u).filter(Boolean);
  return (words.slice(0, 2).map((word) => word[0]).join("") || "K").toUpperCase();
}

function titleCase(value) {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  if (!value) return "Date not recorded";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date not recorded";

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(parsed);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function showBusy(message) {
  elements.busyText.textContent = message;
  elements.busyOverlay.hidden = false;
}

function hideBusy() {
  elements.busyOverlay.hidden = true;
}

let noticeTimer = null;

function showNotice(message, type = "success") {
  clearTimeout(noticeTimer);
  elements.notice.textContent = message;
  elements.notice.classList.toggle("error", type === "error");
  elements.notice.hidden = false;
  noticeTimer = setTimeout(() => {
    elements.notice.hidden = true;
  }, 4200);
}

async function readJson(response) {
  const text = await response.text().catch(() => "");
  try {
    return text ? JSON.parse(text) : null;
  }
  catch {
    return { raw: text };
  }
}

function friendlyError(payload, status) {
  const reason = String(
    payload?.reason ??
    payload?.failure_token ??
    payload?.error ??
    `request_${status}`
  );

  const messages = {
    auth_email_invalid: "Enter a valid email address.",
    auth_display_name_required: "Enter your display name.",
    acknowledgement_not_accepted: "Both beta acknowledgements are required.",
    jurisdiction_not_acknowledged: "Both beta acknowledgements are required.",
    stored_relationship_access_denied: "This athlete connection is not active.",
    stored_relationship_or_assignment_access_denied: "Connect the athlete and record an assignment first.",
    stored_compile_context_missing: "The athlete must complete account setup before this assignment can run.",
    stored_assignment_missing: "No current assignment was found for this coach.",
    athlete_history_access_denied: "Training history is not available for this account.",
    relationship_identity_required: "Enter a valid athlete account code.",
    coach_note_text_required: "Enter a note before recording it."
  };

  return messages[reason] ?? titleCase(reason);
}

async function api(method, path, body) {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const payload = await readJson(response);

  if (!response.ok) {
    const error = new Error(friendlyError(payload, response.status));
    error.payload = payload;
    error.status = response.status;
    throw error;
  }

  return payload;
}

function buildPhase1Input(activityId) {
  return {
    consent_granted: true,
    engine_version: "EB2-1.0.0",
    enum_bundle_version: "EB2-1.0.0",
    phase1_schema_version: "1.0.0",
    actor_type: "athlete",
    execution_scope: "individual",
    activity_id: activityId,
    nd_mode: false,
    instruction_density: "standard",
    exposure_prompt_density: "standard",
    bias_mode: "none"
  };
}

function currentAccountId() {
  return state.role === "coach"
    ? state.profile?.coachUserId ?? ""
    : state.profile?.userId ?? "";
}

function countsFromSession(sessionState) {
  return {
    completed: Array.isArray(sessionState?.completed_exercises) ? sessionState.completed_exercises : [],
    remaining: Array.isArray(sessionState?.remaining_exercises) ? sessionState.remaining_exercises : [],
    dropped: Array.isArray(sessionState?.dropped_exercises) ? sessionState.dropped_exercises : []
  };
}

function upsertLocalSession(sessionId, patch = {}) {
  const existingIndex = state.localSessions.findIndex((session) => session.session_id === sessionId);
  const existing = existingIndex >= 0 ? state.localSessions[existingIndex] : {
    session_id: sessionId,
    block_id: "",
    status: "planned",
    assignment_id: null,
    runtime_event_count: 0,
    created_at: nowIso(),
    updated_at: nowIso()
  };

  const next = {
    ...existing,
    ...patch,
    session_id: sessionId,
    updated_at: patch.updated_at ?? nowIso()
  };

  if (existingIndex >= 0) state.localSessions.splice(existingIndex, 1, next);
  else state.localSessions.push(next);

  saveState();
  return next;
}

function mergeHistory(serverSessions) {
  const merged = new Map();

  for (const session of state.localSessions) {
    merged.set(session.session_id, session);
  }

  for (const session of serverSessions) {
    merged.set(session.session_id, {
      ...(merged.get(session.session_id) ?? {}),
      ...session
    });
  }

  return [...merged.values()].sort((left, right) => {
    const leftTime = Date.parse(left.created_at ?? left.updated_at ?? "") || 0;
    const rightTime = Date.parse(right.created_at ?? right.updated_at ?? "") || 0;
    return leftTime - rightTime || String(left.session_id).localeCompare(String(right.session_id));
  });
}

function sessionClassification(sessionState) {
  const counts = countsFromSession(sessionState);
  const total = counts.completed.length + counts.remaining.length + counts.dropped.length;

  if (sessionState?.current_step?.type === "RETURN_DECISION") {
    return { label: "Return decision", className: "active", key: "return" };
  }

  if (total > 0 && counts.remaining.length === 0 && counts.dropped.length > 0) {
    return { label: "Partially completed", className: "partial", key: "partial" };
  }

  if (total > 0 && counts.remaining.length === 0) {
    return { label: "Completed", className: "complete", key: "complete" };
  }

  if (sessionState?.started === true) {
    return { label: "In progress", className: "active", key: "active" };
  }

  return { label: "Planned", className: "neutral", key: "planned" };
}

function setBadge(element, classification) {
  element.textContent = classification.label;
  element.className = `badge ${classification.className}`;
}

function exerciseName(exercise) {
  return String(
    exercise?.display_name ??
    exercise?.exercise_name ??
    exercise?.exercise_id ??
    exercise?.item_id ??
    "Exercise"
  );
}

function exerciseDetails(exercise) {
  const details = [];

  if (Number.isInteger(exercise?.sets)) details.push(`${exercise.sets} sets`);
  if (Number.isInteger(exercise?.reps)) details.push(`${exercise.reps} reps`);
  if (Number.isInteger(exercise?.rest_seconds)) details.push(`${exercise.rest_seconds}s rest`);

  if (exercise?.intensity && typeof exercise.intensity === "object") {
    const value = exercise.intensity.percentage ??
      exercise.intensity.percent ??
      exercise.intensity.value ??
      null;
    if (value !== null) details.push(`${value}%`);
  }

  return details;
}

function roleLabel() {
  return state.role === "coach" ? "Coach" : "Athlete";
}

function viewTitle(view) {
  const titles = {
    today: "Today",
    session: "Session",
    history: "History",
    "coach-overview": "Overview",
    athletes: "Athletes",
    assign: "Assign",
    review: "Review",
    account: "Account"
  };

  return titles[view] ?? "Kolosseum";
}

function setView(view) {
  state.view = view;
  saveState();

  for (const section of document.querySelectorAll(".view")) {
    section.hidden = section.id !== `view-${view}`;
  }

  for (const button of document.querySelectorAll(".nav-item")) {
    button.classList.toggle("active", button.dataset.view === view);
  }

  elements.topbarTitle.textContent = viewTitle(view);
  elements.sidebar.classList.remove("open");

  if (view === "history" && state.role === "athlete") {
    refreshHistory().catch(handleError);
  }

  if (view === "session" && state.role === "athlete" && state.activeSessionId) {
    loadSessionState().catch(handleError);
  }

  if (view === "review" && state.role === "coach") {
    renderCoachSelectors();
  }

  if (view === "account") {
    renderAccount();
  }
}

function renderRoleNavigation() {
  const athlete = state.role === "athlete";

  for (const item of document.querySelectorAll(".athlete-nav")) item.hidden = !athlete;
  for (const item of document.querySelectorAll(".coach-nav")) item.hidden = athlete;

  elements.workspaceLabel.textContent = athlete ? "Athlete workspace" : "Coach workspace";
  elements.topbarEyebrow.textContent = athlete ? "Athlete workspace" : "Coach workspace";
  elements.sidebarRole.textContent = roleLabel();

  const fallbackView = athlete ? "today" : "coach-overview";
  const permittedViews = athlete
    ? new Set(["today", "session", "history", "account"])
    : new Set(["coach-overview", "athletes", "assign", "review", "account"]);

  if (!permittedViews.has(state.view)) state.view = fallbackView;
}

function renderIdentity() {
  const name = state.profile?.displayName ?? "Kolosseum user";
  const avatar = initials(name);

  elements.sidebarName.textContent = name;
  elements.sidebarAvatar.textContent = avatar;
  elements.topbarAccount.textContent = avatar;
  elements.accountAvatar.textContent = avatar;
  elements.todayGreeting.textContent = `Welcome, ${name.split(/\s+/u)[0]}`;
  elements.coachGreeting.textContent = `Welcome, ${name.split(/\s+/u)[0]}`;
}

async function registerAthlete(displayName, email, activityId) {
  const userId = createId("athlete");
  const timestamp = nowIso();
  const phase1Input = buildPhase1Input(activityId);

  const auth = await api("POST", "/sessions/beta-auth", {
    user_id: userId,
    email,
    display_name: displayName,
    account_role: "athlete",
    account_state: "active",
    accepted_terms_version: "terms_v1",
    created_at_iso8601: timestamp
  });

  const acknowledgement = await api("POST", "/sessions/beta-acknowledgement", {
    acknowledgement_id: createId("ack"),
    user_id: userId,
    beta_id: "september_beta_2026",
    accepted: true,
    jurisdiction_acknowledged: true,
    accepted_at_iso8601: nowIso(),
    copy_acknowledgement_id: "BETA16_COPY_ACKNOWLEDGEMENT_LABEL"
  });

  const declaration = await api("POST", "/sessions/beta-declaration", {
    declaration_id: createId("declaration"),
    user_id: userId,
    phase1_input: phase1Input,
    jurisdiction_acknowledged: true,
    declared_at_iso8601: nowIso(),
    accepted_terms_version: "terms_v1",
    copy_acknowledgement_id: "BETA16_COPY_DECLARATION_ACKNOWLEDGEMENT"
  });

  Object.assign(state, {
    role: "athlete",
    profile: { userId, displayName, email, activityId },
    authRecord: auth.auth_record,
    acknowledgementRecord: acknowledgement.acknowledgement_record,
    declarationRecord: declaration.declaration_record,
    phase1Input,
    view: "today"
  });
}

async function registerCoach(displayName, email) {
  const coachUserId = createId("coach");

  const response = await api("POST", "/sessions/beta-coach-profile", {
    coach_user_id: coachUserId,
    email,
    display_name: displayName,
    account_role: "coach",
    account_state: "active",
    accepted_terms_version: "terms_v1",
    created_at_iso8601: nowIso()
  });

  Object.assign(state, {
    role: "coach",
    profile: { coachUserId, displayName, email },
    coachProfile: response.coach_profile,
    view: "coach-overview"
  });
}

async function handleEntrySubmit(event) {
  event.preventDefault();
  elements.entryError.hidden = true;

  const role = new FormData(elements.entryForm).get("role");
  const displayName = elements.entryName.value.trim();
  const email = elements.entryEmail.value.trim().toLowerCase();

  if (!displayName || !email) return;
  if (!elements.entryBetaConsent.checked || !elements.entryDeclarationConsent.checked) {
    elements.entryError.textContent = "Both controlled beta acknowledgements are required.";
    elements.entryError.hidden = false;
    return;
  }

  showBusy("Creating workspace…");

  try {
    if (role === "coach") {
      await registerCoach(displayName, email);
    }
    else {
      await registerAthlete(displayName, email, elements.entryActivity.value);
    }

    saveState();
    await enterApplication();
    showNotice("Workspace created.");
  }
  catch (error) {
    elements.entryError.textContent = error.message;
    elements.entryError.hidden = false;
  }
  finally {
    hideBusy();
  }
}

async function createSession() {
  showBusy("Creating session…");

  try {
    const body = state.coachCode
      ? {
          phase1_input: state.phase1Input,
          beta_user_id: state.profile.userId,
          beta_coach_user_id: state.coachCode
        }
      : {
          phase1_input: state.phase1Input,
          beta_path_context: {
            auth_record: state.authRecord,
            acknowledgement_record: state.acknowledgementRecord,
            declaration_record: state.declarationRecord
          }
        };

    const response = await api(
      "POST",
      "/blocks/compile?create_session=true&beta_path=true",
      body
    );

    state.activeSessionId = response.session_id ?? null;
    state.activeSessionState = null;

    if (state.activeSessionId) {
      upsertLocalSession(state.activeSessionId, {
        block_id: response.block_id ?? "",
        status: "planned",
        assignment_id: response.beta_path?.assignment_id ?? null,
        runtime_event_count: 0
      });
    }

    saveState();

    if (!state.activeSessionId) {
      throw new Error("The server did not return a session.");
    }

    await loadSessionState();
    setView("session");
    showNotice("Session created.");
  }
  finally {
    hideBusy();
  }
}

async function startSession() {
  if (!state.activeSessionId) return;

  showBusy("Starting session…");
  try {
    await api("POST", `/sessions/${encodeURIComponent(state.activeSessionId)}/start`, {});
    const local = state.localSessions.find((session) => session.session_id === state.activeSessionId);
    upsertLocalSession(state.activeSessionId, {
      status: "in_progress",
      runtime_event_count: Number(local?.runtime_event_count ?? 0) + 1
    });
    await loadSessionState();
    showNotice("Session started.");
  }
  finally {
    hideBusy();
  }
}

async function postSessionEvent(event) {
  if (!state.activeSessionId) return;

  showBusy("Recording session…");
  try {
    await api("POST", `/sessions/${encodeURIComponent(state.activeSessionId)}/events`, { event });
    const local = state.localSessions.find((session) => session.session_id === state.activeSessionId);
    upsertLocalSession(state.activeSessionId, {
      runtime_event_count: Number(local?.runtime_event_count ?? 0) + 1
    });
    await loadSessionState();
    await refreshHistory({ quiet: true });
  }
  finally {
    hideBusy();
  }
}

async function loadSessionState() {
  if (!state.activeSessionId) {
    state.activeSessionState = null;
    renderAthleteSession();
    return null;
  }

  const sessionState = await api(
    "GET",
    `/sessions/${encodeURIComponent(state.activeSessionId)}/state`
  );

  state.activeSessionState = sessionState;

  const classification = sessionClassification(sessionState);
  upsertLocalSession(state.activeSessionId, {
    status: classification.key
  });

  saveState();
  renderAthleteSession();
  renderToday();
  return sessionState;
}

function renderExerciseFocus(step, classification) {
  elements.returnDecision.hidden = true;
  elements.sessionActions.hidden = false;
  elements.startSessionButton.hidden = true;
  elements.completeExerciseButton.hidden = true;
  elements.splitSessionButton.hidden = true;

  if (!step) {
    elements.currentExercise.innerHTML = `
      <div class="exercise-focus">
        <p class="eyebrow">${escapeHtml(classification.label)}</p>
        <h3>Session record complete</h3>
        <p class="muted">No further exercise is currently recorded.</p>
      </div>
    `;
    return;
  }

  if (step.type === "RETURN_DECISION") {
    elements.currentExercise.innerHTML = "";
    elements.returnDecision.hidden = false;
    elements.sessionActions.hidden = true;
    return;
  }

  const exercise = step.exercise ?? {};
  const details = exerciseDetails(exercise);

  elements.currentExercise.innerHTML = `
    <div class="exercise-focus">
      <p class="eyebrow">Current exercise</p>
      <h3>${escapeHtml(exerciseName(exercise))}</h3>
      <div class="exercise-detail-row">
        ${details.map((detail) => `<span class="exercise-detail">${escapeHtml(detail)}</span>`).join("")}
      </div>
    </div>
  `;

  if (state.activeSessionState?.started === true) {
    elements.completeExerciseButton.hidden = false;
    elements.splitSessionButton.hidden = false;
  }
  else {
    elements.startSessionButton.hidden = false;
  }
}

function renderExerciseQueue(sessionState) {
  const counts = countsFromSession(sessionState);
  const currentId = sessionState?.current_step?.exercise?.exercise_id ??
    sessionState?.current_step?.exercise?.item_id ??
    null;

  const rows = [
    ...counts.completed.map((exercise) => ({ exercise, status: "complete" })),
    ...counts.remaining.map((exercise, index) => ({
      exercise,
      status: (exercise.exercise_id ?? exercise.item_id) === currentId || index === 0 ? "current" : "remaining"
    })),
    ...counts.dropped.map((exercise) => ({ exercise, status: "dropped" }))
  ];

  elements.exerciseQueue.innerHTML = rows.length
    ? rows.map(({ exercise, status }, index) => {
        const statusLabel = status === "complete"
          ? "Completed"
          : status === "dropped"
            ? "Dropped"
            : status === "current"
              ? "Current"
              : "Upcoming";

        return `
          <div class="exercise-row ${status}">
            <span class="exercise-order">${index + 1}</span>
            <div>
              <strong>${escapeHtml(exerciseName(exercise))}</strong>
              <small>${escapeHtml(exerciseDetails(exercise).join(" · ") || "Recorded exercise")}</small>
            </div>
            <span class="badge ${status === "complete" ? "complete" : status === "dropped" ? "partial" : status === "current" ? "active" : "neutral"}">${statusLabel}</span>
          </div>
        `;
      }).join("")
    : '<div class="empty-state"><p>No exercise records are available.</p></div>';
}

function renderAthleteSession() {
  const sessionState = state.activeSessionState;

  if (!state.activeSessionId || !sessionState) {
    elements.sessionEmpty.hidden = false;
    elements.sessionWorkspace.hidden = true;
    elements.sessionTitle.textContent = "No session selected";
    elements.sessionSubtitle.textContent = "Create or open a session to begin.";
    setBadge(elements.sessionStatusBadge, { label: "No session", className: "neutral" });
    return;
  }

  elements.sessionEmpty.hidden = true;
  elements.sessionWorkspace.hidden = false;

  const counts = countsFromSession(sessionState);
  const total = counts.completed.length + counts.remaining.length + counts.dropped.length;
  const classification = sessionClassification(sessionState);
  const activity = state.profile?.activityId ?? state.phase1Input?.activity_id ?? "training";

  elements.sessionActivity.textContent = titleCase(activity);
  elements.sessionTitle.textContent = `${titleCase(activity)} session`;
  elements.sessionSubtitle.textContent = total
    ? `${total} exercises recorded in this session.`
    : "Session record loaded.";
  setBadge(elements.sessionStatusBadge, classification);

  elements.sessionCompletedCount.textContent = String(counts.completed.length);
  elements.sessionRemainingCount.textContent = String(counts.remaining.length);
  elements.sessionDroppedCount.textContent = String(counts.dropped.length);
  elements.sessionProgressText.textContent = `${counts.completed.length} of ${total} complete`;

  const progress = total === 0 ? 0 : Math.round((counts.completed.length / total) * 100);
  elements.sessionProgressBar.style.width = `${progress}%`;

  renderExerciseFocus(sessionState.current_step, classification);
  renderExerciseQueue(sessionState);
}

async function refreshHistory(options = {}) {
  if (state.role !== "athlete") return [];

  const history = await api("POST", "/sessions/beta-athlete-history", {
    athlete_user_id: state.profile.userId
  });

  const serverSessions = Array.isArray(history.sessions) ? history.sessions : [];
  state.history = mergeHistory(serverSessions);
  saveState();
  renderHistory();
  renderToday();

  if (!options.quiet) showNotice("Training history refreshed.");
  return state.history;
}

function recordCard(session, interactive = true) {
  const date = formatDate(session.updated_at ?? session.created_at);
  const status = titleCase(session.status ?? "recorded");

  return `
    <article class="record-card ${interactive ? "interactive" : ""}" ${interactive ? `data-session-id="${escapeHtml(session.session_id)}"` : ""}>
      <div>
        <h3>Training session</h3>
        <p>${escapeHtml(date)}</p>
      </div>
      <div class="record-meta">
        <span class="badge neutral">${escapeHtml(status)}</span>
        <span class="badge neutral">${Number(session.runtime_event_count ?? 0)} events</span>
      </div>
    </article>
  `;
}

function renderHistory() {
  elements.historyList.innerHTML = state.history.length
    ? [...state.history].reverse().map((session) => recordCard(session)).join("")
    : `
      <div class="panel empty-state">
        <div class="empty-icon">H</div>
        <h3>No sessions recorded</h3>
        <p>Your persisted session history will appear here.</p>
      </div>
    `;

  bindSessionCards(elements.historyList);
}

function bindSessionCards(container) {
  for (const card of container.querySelectorAll("[data-session-id]")) {
    card.addEventListener("click", () => {
      state.activeSessionId = card.dataset.sessionId;
      state.activeSessionState = null;
      saveState();
      setView("session");
    });
  }
}

function renderToday() {
  const sessionState = state.activeSessionState;
  const hasSession = Boolean(state.activeSessionId && sessionState);

  elements.todaySessionEmpty.hidden = hasSession;
  elements.todaySessionContent.hidden = !hasSession;
  elements.createSessionButton.textContent = hasSession ? "Create another session" : "Create session";
  elements.todayHistoryCount.textContent = String(state.history.length);

  if (hasSession) {
    const counts = countsFromSession(sessionState);
    const classification = sessionClassification(sessionState);
    setBadge(elements.todayStatusBadge, classification);
    elements.todayActivity.textContent = titleCase(state.profile?.activityId ?? "training");
    elements.todaySessionTitle.textContent = `${titleCase(state.profile?.activityId ?? "training")} session`;
    elements.todayCompleted.textContent = String(counts.completed.length);
    elements.todayRemaining.textContent = String(counts.remaining.length);
    elements.todayDropped.textContent = String(counts.dropped.length);
  }
  else {
    setBadge(elements.todayStatusBadge, { label: "No session", className: "neutral" });
  }

  const latest = [...state.history].reverse().slice(0, 4);
  elements.todayRecentList.innerHTML = latest.length
    ? latest.map((session) => recordCard(session)).join("")
    : '<div class="empty-state"><p>No recent sessions are recorded.</p></div>';
  bindSessionCards(elements.todayRecentList);
}

async function connectAthlete(event) {
  event.preventDefault();

  const athleteUserId = elements.connectAthleteId.value.trim();
  const displayName = elements.connectAthleteName.value.trim();
  const activityId = elements.connectAthleteActivity.value;

  showBusy("Connecting athlete…");

  try {
    const timestamp = nowIso();
    const response = await api("POST", "/sessions/beta-coach-relationship", {
      relationship_id: createId("relationship"),
      coach_user_id: state.profile.coachUserId,
      athlete_user_id: athleteUserId,
      relationship_state: "accepted",
      relationship_scope: "individual_coach_athlete",
      accepted_at_iso8601: timestamp,
      created_at_iso8601: timestamp,
      updated_at_iso8601: timestamp,
      revoked_at_iso8601: null,
      expires_at_iso8601: null
    });

    const existingIndex = state.coachAthletes.findIndex((athlete) => athlete.userId === athleteUserId);
    const athlete = {
      userId: athleteUserId,
      displayName,
      activityId,
      relationship: response.relationship
    };

    if (existingIndex >= 0) state.coachAthletes.splice(existingIndex, 1, athlete);
    else state.coachAthletes.push(athlete);

    saveState();
    elements.connectAthleteForm.reset();
    renderCoachWorkspace();
    showNotice(`${displayName} connected.`);
  }
  finally {
    hideBusy();
  }
}

function renderCoachSelectors() {
  const options = state.coachAthletes.length
    ? state.coachAthletes
        .map((athlete) => `<option value="${escapeHtml(athlete.userId)}">${escapeHtml(athlete.displayName)}</option>`)
        .join("")
    : '<option value="">No connected athletes</option>';

  elements.assignmentAthlete.innerHTML = options;
  elements.reviewAthlete.innerHTML = options;
  elements.assignmentAthlete.disabled = state.coachAthletes.length === 0;
  elements.reviewAthlete.disabled = state.coachAthletes.length === 0;
  elements.loadReviewButton.disabled = state.coachAthletes.length === 0;
}

function coachAthleteCard(athlete) {
  const assignments = state.coachAssignments.filter((assignment) => assignment.athleteUserId === athlete.userId).length;

  return `
    <article class="record-card">
      <div>
        <h3>${escapeHtml(athlete.displayName)}</h3>
        <p>${escapeHtml(titleCase(athlete.activityId))}</p>
      </div>
      <div class="record-meta">
        <span class="badge complete">Connected</span>
        <span class="badge neutral">${assignments} assignment${assignments === 1 ? "" : "s"}</span>
      </div>
    </article>
  `;
}

function renderCoachWorkspace() {
  const cards = state.coachAthletes.length
    ? state.coachAthletes.map(coachAthleteCard).join("")
    : '<div class="empty-state"><p>No athletes are connected yet.</p></div>';

  elements.coachAthleteCount.textContent = String(state.coachAthletes.length);
  elements.coachAssignmentCount.textContent = String(state.coachAssignments.length);
  elements.coachArtefactCount.textContent = String(state.coachArtefactCount);
  elements.coachOverviewAthletes.innerHTML = cards;
  elements.athleteRoster.innerHTML = cards;
  renderCoachSelectors();
}

async function recordAssignment(event) {
  event.preventDefault();

  const athleteUserId = elements.assignmentAthlete.value;
  const athlete = state.coachAthletes.find((entry) => entry.userId === athleteUserId);
  if (!athlete) return;

  showBusy("Recording assignment…");

  try {
    const response = await api("POST", "/sessions/beta-coach-assignment", {
      request_id: createId("assignment_request"),
      requested_at_iso8601: nowIso(),
      coach_user_id: state.profile.coachUserId,
      athlete_user_id: athleteUserId,
      template_id: elements.assignmentTemplate.value,
      activity_id: athlete.activityId
    });

    state.coachAssignments.push({
      assignmentId: response.assignment?.assignment_id ?? createId("assignment"),
      athleteUserId,
      templateId: elements.assignmentTemplate.value,
      activityId: athlete.activityId,
      recordedAt: nowIso()
    });

    saveState();
    elements.assignmentResult.textContent =
      `Assignment recorded for ${athlete.displayName}. Give the athlete your account code so they can open the assigned session.`;
    elements.assignmentResult.hidden = false;
    renderCoachWorkspace();
    showNotice("Assignment recorded.");
  }
  finally {
    hideBusy();
  }
}

async function loadCoachReview() {
  const athleteUserId = elements.reviewAthlete.value;
  const athlete = state.coachAthletes.find((entry) => entry.userId === athleteUserId);
  if (!athlete) return;

  showBusy("Loading session records…");

  try {
    const response = await api("POST", "/sessions/beta-coach-artefacts", {
      coach_user_id: state.profile.coachUserId,
      athlete_user_id: athleteUserId
    });

    const artefacts = Array.isArray(response.artefact_view?.artefacts)
      ? response.artefact_view.artefacts
      : [];

    state.coachArtefactCount = artefacts.length;
    saveState();
    renderCoachWorkspace();
    renderCoachArtefacts(athlete, artefacts);
  }
  finally {
    hideBusy();
  }
}

function renderCoachArtefacts(athlete, artefacts) {
  elements.coachNoteForm.hidden = true;

  elements.reviewList.innerHTML = artefacts.length
    ? artefacts.map((artefact) => `
        <article class="record-card">
          <div>
            <h3>${escapeHtml(athlete.displayName)} · Training session</h3>
            <p>${escapeHtml(formatDate(artefact.recorded_at))} · ${Number(artefact.runtime_event_count ?? 0)} recorded events</p>
          </div>
          <div class="record-meta">
            <span class="badge neutral">${escapeHtml(titleCase(artefact.session_status ?? "recorded"))}</span>
            <button
              class="button secondary note-trigger"
              type="button"
              data-session-id="${escapeHtml(artefact.session_id)}"
              data-artefact-id="${escapeHtml(artefact.artefact_id)}"
              data-athlete-id="${escapeHtml(athlete.userId)}"
            >Add note</button>
          </div>
        </article>
      `).join("")
    : `
      <div class="panel empty-state">
        <div class="empty-icon">R</div>
        <h3>No assigned sessions recorded</h3>
        <p>The athlete must open a session using your coach account code after an assignment is recorded.</p>
      </div>
    `;

  for (const button of elements.reviewList.querySelectorAll(".note-trigger")) {
    button.addEventListener("click", () => {
      elements.coachNoteSessionId.value = button.dataset.sessionId;
      elements.coachNoteArtefactId.value = button.dataset.artefactId;
      elements.coachNoteForm.dataset.athleteId = button.dataset.athleteId;
      elements.coachNoteHeading.textContent = `Add note for ${athlete.displayName}`;
      elements.coachNoteText.value = "";
      elements.coachNoteForm.hidden = false;
      elements.coachNoteText.focus();
    });
  }
}

async function recordCoachNote(event) {
  event.preventDefault();

  const athleteUserId = elements.coachNoteForm.dataset.athleteId;
  const athlete = state.coachAthletes.find((entry) => entry.userId === athleteUserId);
  if (!athlete?.relationship) return;

  showBusy("Recording note…");

  try {
    await api("POST", "/sessions/beta-coach-notes", {
      coach_profile: state.coachProfile,
      relationship: athlete.relationship,
      athlete_user_id: athleteUserId,
      session_id: elements.coachNoteSessionId.value,
      artefact_id: elements.coachNoteArtefactId.value,
      note_text: elements.coachNoteText.value.trim(),
      visibility: elements.coachNoteVisibility.value
    });

    elements.coachNoteForm.hidden = true;
    showNotice("Non-binding coach note recorded.");
  }
  finally {
    hideBusy();
  }
}

function renderAccount() {
  const id = currentAccountId();

  elements.accountName.textContent = state.profile?.displayName ?? "Kolosseum user";
  elements.accountEmail.textContent = state.profile?.email ?? "";
  elements.accountRoleBadge.textContent = roleLabel();
  elements.accountCode.textContent = id || "—";

  let coachLinkPanel = document.getElementById("athleteCoachLinkPanel");

  if (state.role === "athlete") {
    if (!coachLinkPanel) {
      coachLinkPanel = document.createElement("article");
      coachLinkPanel.id = "athleteCoachLinkPanel";
      coachLinkPanel.className = "panel";
      coachLinkPanel.innerHTML = `
        <p class="eyebrow">Coach-managed training</p>
        <h3>Coach account code</h3>
        <p class="muted">After your coach connects this athlete account and records an assignment, enter the coach account code here.</p>
        <div class="inline-controls">
          <input id="coachCodeInput" autocomplete="off" placeholder="Coach account code" />
          <button id="saveCoachCodeButton" class="button secondary" type="button">Save code</button>
        </div>
      `;

      document.querySelector("#view-account .two-column").insertAdjacentElement("afterend", coachLinkPanel);
      coachLinkPanel.querySelector("#saveCoachCodeButton").addEventListener("click", () => {
        state.coachCode = coachLinkPanel.querySelector("#coachCodeInput").value.trim();
        saveState();
        showNotice(state.coachCode ? "Coach account code saved." : "Coach account code cleared.");
      });
    }

    coachLinkPanel.hidden = false;
    coachLinkPanel.querySelector("#coachCodeInput").value = state.coachCode ?? "";
  }
  else if (coachLinkPanel) {
    coachLinkPanel.hidden = true;
  }
}

async function checkConnection() {
  try {
    const health = await api("GET", "/health");
    elements.connectionStatus.textContent = health?.status === "ok" ? "Connected" : "Unavailable";
    elements.connectionStatus.classList.toggle("offline", health?.status !== "ok");
  }
  catch {
    elements.connectionStatus.textContent = "Offline";
    elements.connectionStatus.classList.add("offline");
  }
}

function clearLocalSession() {
  localStorage.removeItem(STORAGE_KEY);
  location.assign("/app/");
}

function handleError(error) {
  hideBusy();
  showNotice(error?.message ?? "The request could not be completed.", "error");
  console.error(error);
}

async function enterApplication() {
  elements.bootScreen.hidden = true;
  elements.entryView.hidden = true;
  elements.appShell.hidden = false;

  renderRoleNavigation();
  renderIdentity();
  renderAccount();

  if (state.role === "athlete") {
    renderAthleteSession();
    renderToday();
    renderHistory();

    try {
      await refreshHistory({ quiet: true });

      if (!state.activeSessionId && state.history.length > 0) {
        const latest = state.history[state.history.length - 1];
        state.activeSessionId = latest.session_id;
        saveState();
      }

      if (state.activeSessionId) {
        await loadSessionState();
      }
    }
    catch (error) {
      showNotice(error.message, "error");
    }
  }
  else {
    renderCoachWorkspace();
  }

  setView(state.view);
  checkConnection();
}

function showEntry() {
  elements.bootScreen.hidden = true;
  elements.appShell.hidden = true;
  elements.entryView.hidden = false;
}

for (const radio of document.querySelectorAll('input[name="role"]')) {
  radio.addEventListener("change", () => {
    elements.entryActivityField.hidden = radio.value === "coach" && radio.checked;
  });
}

for (const button of document.querySelectorAll("[data-view]")) {
  button.addEventListener("click", () => setView(button.dataset.view));
}

for (const button of document.querySelectorAll("[data-view-link]")) {
  button.addEventListener("click", () => setView(button.dataset.viewLink));
}

elements.entryForm.addEventListener("submit", (event) => {
  handleEntrySubmit(event).catch(handleError);
});

elements.menuButton.addEventListener("click", () => {
  elements.sidebar.classList.toggle("open");
});

elements.topbarAccount.addEventListener("click", () => setView("account"));
elements.createSessionButton.addEventListener("click", () => createSession().catch(handleError));
elements.continueSessionButton.addEventListener("click", () => setView("session"));
elements.startSessionButton.addEventListener("click", () => startSession().catch(handleError));
elements.completeExerciseButton.addEventListener("click", () => {
  postSessionEvent({ type: "COMPLETE_STEP" }).catch(handleError);
});
elements.splitSessionButton.addEventListener("click", () => {
  postSessionEvent({ type: "SPLIT_SESSION" }).catch(handleError);
});
elements.returnContinueButton.addEventListener("click", () => {
  postSessionEvent({ type: "RETURN_CONTINUE" }).catch(handleError);
});
elements.returnSkipButton.addEventListener("click", () => {
  postSessionEvent({ type: "RETURN_SKIP" }).catch(handleError);
});
elements.refreshHistoryButton.addEventListener("click", () => refreshHistory().catch(handleError));
elements.connectAthleteForm.addEventListener("submit", (event) => {
  connectAthlete(event).catch(handleError);
});
elements.assignmentForm.addEventListener("submit", (event) => {
  recordAssignment(event).catch(handleError);
});
elements.loadReviewButton.addEventListener("click", () => loadCoachReview().catch(handleError));
elements.coachNoteForm.addEventListener("submit", (event) => {
  recordCoachNote(event).catch(handleError);
});
elements.copyAccountCodeButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(currentAccountId());
    showNotice("Account code copied.");
  }
  catch {
    showNotice("Copy was blocked by the browser.", "error");
  }
});
elements.signOutButton.addEventListener("click", clearLocalSession);

if (state.role && state.profile) {
  enterApplication().catch(handleError);
}
else {
  showEntry();
}
