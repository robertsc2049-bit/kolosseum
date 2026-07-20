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
  coachTemplates: [],
  templateExercises: [],
  templateDraft: null,
  athleteProfiles: {},
  athleteProfileDraft: null,
  selectedCoachAthleteId: "",
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
  todayEventCard: document.getElementById("todayEventCard"),
  todayEventType: document.getElementById("todayEventType"),
  todayEventCountdown: document.getElementById("todayEventCountdown"),
  todayEventName: document.getElementById("todayEventName"),
  todayEventDate: document.getElementById("todayEventDate"),

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
  athleteProfilePanel: document.getElementById("athleteProfilePanel"),
  athleteProfileHeading: document.getElementById("athleteProfileHeading"),
  athleteProfileActivity: document.getElementById("athleteProfileActivity"),
  athleteProfileForm: document.getElementById("athleteProfileForm"),
  athletePreferredUnit: document.getElementById("athletePreferredUnit"),
  athleteRoundingIncrement: document.getElementById("athleteRoundingIncrement"),
  athleteBodyweight: document.getElementById("athleteBodyweight"),
  athleteBodyweightUnit: document.getElementById("athleteBodyweightUnit"),
  athleteBenchmarkList: document.getElementById("athleteBenchmarkList"),
  addAthleteBenchmarkButton: document.getElementById("addAthleteBenchmarkButton"),
  closeAthleteProfileButton: document.getElementById("closeAthleteProfileButton"),
  athleteProfileStatus: document.getElementById("athleteProfileStatus"),
  templateLibraryView: document.getElementById("templateLibraryView"),
  templateBuilderView: document.getElementById("templateBuilderView"),
  newTemplateButton: document.getElementById("newTemplateButton"),
  refreshTemplatesButton: document.getElementById("refreshTemplatesButton"),
  templateLibraryList: document.getElementById("templateLibraryList"),
  templateDraftCount: document.getElementById("templateDraftCount"),
  templateActiveCount: document.getElementById("templateActiveCount"),
  templateArchivedCount: document.getElementById("templateArchivedCount"),
  backToTemplatesButton: document.getElementById("backToTemplatesButton"),
  saveTemplateButton: document.getElementById("saveTemplateButton"),
  activateTemplateButton: document.getElementById("activateTemplateButton"),
  templateBuilderTitle: document.getElementById("templateBuilderTitle"),
  templateName: document.getElementById("templateName"),
  templateActivity: document.getElementById("templateActivity"),
  templateDescription: document.getElementById("templateDescription"),
  templateEventEnabled: document.getElementById("templateEventEnabled"),
  templateEventFields: document.getElementById("templateEventFields"),
  templateEventName: document.getElementById("templateEventName"),
  templateEventType: document.getElementById("templateEventType"),
  templateProgrammeStartDate: document.getElementById("templateProgrammeStartDate"),
  templateEventDate: document.getElementById("templateEventDate"),
  templateEventLocation: document.getElementById("templateEventLocation"),
  templateEventTimezone: document.getElementById("templateEventTimezone"),
  templateEventNotes: document.getElementById("templateEventNotes"),
  templateEventCountdown: document.getElementById("templateEventCountdown"),
  templateEventRequiredWeeks: document.getElementById("templateEventRequiredWeeks"),
  templateEventAllocatedWeeks: document.getElementById("templateEventAllocatedWeeks"),
  templateEventWeekBalance: document.getElementById("templateEventWeekBalance"),
  templateEventAllocationState: document.getElementById("templateEventAllocationState"),
  compileEventCalendarButton: document.getElementById("compileEventCalendarButton"),
  fitFinalBlockButton: document.getElementById("fitFinalBlockButton"),
  templateVersion: document.getElementById("templateVersion"),
  templateBlockCount: document.getElementById("templateBlockCount"),
  templateWeekCount: document.getElementById("templateWeekCount"),
  templateSessionCount: document.getElementById("templateSessionCount"),
  templateBlocks: document.getElementById("templateBlocks"),
  addTemplateBlockButton: document.getElementById("addTemplateBlockButton"),
  assignmentForm: document.getElementById("assignmentForm"),
  assignmentAthlete: document.getElementById("assignmentAthlete"),
  assignmentTemplate: document.getElementById("assignmentTemplate"),
  assignmentEventSummary: document.getElementById("assignmentEventSummary"),
  assignmentRequirements: document.getElementById("assignmentRequirements"),
  assignmentSubmitButton: document.getElementById("assignmentSubmitButton"),
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

function normalisePersistedTemplateDraft(draft) {
  if (!draft || typeof draft !== "object") return null;

  const rawBlocks = Array.isArray(draft.blocks)
    ? draft.blocks
    : Array.isArray(draft.weeks)
      ? [{
          block_id: "",
          order_index: 1,
          name: "Block 1",
          description: "",
          block_type: "general",
          week_count: draft.weeks.length,
          weeks: draft.weeks
        }]
      : [];

  const normaliseWorkItem = (workItem, workItemIndex) => {
    const fallbackReps = Number(workItem?.planned_reps ?? 5);
    const loadMode = ["fixed_weight", "bodyweight"].includes(workItem?.load_mode)
      ? workItem.load_mode
      : "percent_1rm";

    return {
      work_item_id: String(workItem?.work_item_id ?? ""),
      order_index: workItemIndex + 1,
      exercise_id: String(workItem?.exercise_id ?? ""),
      planned_sets: Number(workItem?.planned_sets ?? 3),
      rep_mode: workItem?.rep_mode === "range" ? "range" : "fixed",
      planned_reps: fallbackReps,
      rep_min: Number(workItem?.rep_min ?? fallbackReps),
      rep_max: Number(workItem?.rep_max ?? fallbackReps),
      load_mode: loadMode,
      percent_1rm: Number(workItem?.percent_1rm ?? 75),
      weight_value: Number(workItem?.weight_value ?? 20),
      weight_unit: workItem?.weight_unit === "lb" ? "lb" : "kg",
      rest_seconds: Number(workItem?.rest_seconds ?? 120),
      role: workItem?.role === "primary" ? "primary" : "accessory"
    };
  };

  const blocks = rawBlocks.map((block, blockIndex) => ({
    block_id: String(block?.block_id ?? ""),
    order_index: blockIndex + 1,
    name: String(block?.name ?? `Block ${blockIndex + 1}`),
    description: String(block?.description ?? ""),
    block_type: ["general", "volume", "strength", "peak", "deload", "custom"].includes(block?.block_type)
      ? block.block_type
      : "general",
    week_count: Number(block?.week_count ?? (Array.isArray(block?.weeks) ? block.weeks.length : 1)),
    calendar_start_date: String(block?.calendar_start_date ?? ""),
    calendar_end_date: String(block?.calendar_end_date ?? ""),
    weeks: Array.isArray(block?.weeks)
      ? block.weeks.map((week, weekIndex) => ({
          week_id: String(week?.week_id ?? ""),
          order_index: weekIndex + 1,
          calendar_start_date: String(week?.calendar_start_date ?? ""),
          calendar_end_date: String(week?.calendar_end_date ?? ""),
          days_until_event_at_week_start: Number.isInteger(week?.days_until_event_at_week_start)
            ? Number(week.days_until_event_at_week_start)
            : null,
          partial_week: week?.partial_week === true,
          sessions: Array.isArray(week?.sessions)
            ? week.sessions.map((session, sessionIndex) => ({
                session_id: String(session?.session_id ?? ""),
                order_index: sessionIndex + 1,
                title: String(session?.title ?? `Session ${sessionIndex + 1}`),
                work_items: Array.isArray(session?.work_items)
                  ? session.work_items.map(normaliseWorkItem)
                  : []
              }))
            : []
        }))
      : []
  }));

  const eventPlan = draft.event_plan && typeof draft.event_plan === "object"
    ? {
        event_plan_id: String(draft.event_plan.event_plan_id ?? ""),
        event_name: String(draft.event_plan.event_name ?? ""),
        event_type: String(draft.event_plan.event_type ?? ""),
        event_date: String(draft.event_plan.event_date ?? ""),
        programme_start_date: String(draft.event_plan.programme_start_date ?? ""),
        location: String(draft.event_plan.location ?? ""),
        timezone: String(draft.event_plan.timezone ?? "Europe/London"),
        notes: String(draft.event_plan.notes ?? "")
      }
    : null;

  return {
    ...draft,
    event_plan: eventPlan,
    event_compile_summary: draft.event_compile_summary && typeof draft.event_compile_summary === "object"
      ? draft.event_compile_summary
      : null,
    blocks
  };
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
      coachTemplates: Array.isArray(parsed.coachTemplates) ? parsed.coachTemplates : [],
      templateExercises: Array.isArray(parsed.templateExercises) ? parsed.templateExercises : [],
      templateDraft: normalisePersistedTemplateDraft(parsed.templateDraft),
      athleteProfiles: parsed.athleteProfiles && typeof parsed.athleteProfiles === "object"
        ? parsed.athleteProfiles
        : {},
      athleteProfileDraft: parsed.athleteProfileDraft && typeof parsed.athleteProfileDraft === "object"
        ? parsed.athleteProfileDraft
        : null,
      selectedCoachAthleteId: String(parsed.selectedCoachAthleteId ?? ""),
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

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function dateOnlyEpochDay(value) {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(text)) return null;
  const parsed = Date.parse(`${text}T00:00:00.000Z`);
  return Number.isFinite(parsed) ? Math.floor(parsed / 86400000) : null;
}

function addDateOnlyDays(value, days) {
  const epochDay = dateOnlyEpochDay(value);
  if (epochDay === null) return "";
  return new Date((epochDay + Number(days)) * 86400000).toISOString().slice(0, 10);
}

function dateOnlyDifference(fromDate, toDate) {
  const from = dateOnlyEpochDay(fromDate);
  const to = dateOnlyEpochDay(toDate);
  return from === null || to === null ? null : to - from;
}

function countdownLabel(eventDate, fromDate = todayDateOnly()) {
  const days = dateOnlyDifference(fromDate, eventDate);
  if (days === null) return "Set dates";
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
  if (days === 0) return "Today";
  const weeks = Math.floor(days / 7);
  const remainder = days % 7;
  return weeks > 0
    ? `${weeks}w ${remainder}d`
    : `${days} day${days === 1 ? "" : "s"}`;
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

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/u.test(String(value));
  const parsed = new Date(isDateOnly ? `${value}T12:00:00.000Z` : value);
  if (Number.isNaN(parsed.getTime())) return "Date not recorded";

  return new Intl.DateTimeFormat("en-GB", isDateOnly
    ? {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC"
      }
    : {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }
  ).format(parsed);
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
    coach_note_text_required: "Enter a note before recording it.",
    coach_access_denied: "This coach account is not active.",
    template_name_invalid: "Enter a programme name.",
    blocks_required: "Add at least one training block.",
    block_count_invalid: "A programme must contain between one and twelve training blocks.",
    block_name_too_long: "Training block names must be 120 characters or fewer.",
    block_type_invalid: "Choose a supported training block type.",
    week_count_per_block_invalid: "Each training block must contain between one and 52 weeks.",
    total_week_count_invalid: "A programme cannot contain more than 104 weeks.",
    weeks_required: "Add at least one week.",
    session_count_per_week_invalid: "Each week must contain between one and seven sessions.",
    session_requires_exactly_four_work_items: "Each session must contain exactly four exercises.",
    exercise_not_in_active_registry: "Choose exercises from the active exercise registry.",
    duplicate_exercise_in_session: "Each exercise in a session must be unique.",
    planned_sets_invalid: "Sets must be between 1 and 20.",
    planned_reps_invalid: "Fixed reps must be between 1 and 100.",
    rep_mode_invalid: "Choose fixed reps or a rep range.",
    rep_range_min_invalid: "The minimum reps must be between 1 and 100.",
    rep_range_max_invalid: "The maximum reps must be between 1 and 100.",
    rep_range_order_invalid: "The maximum reps cannot be lower than the minimum reps.",
    load_mode_invalid: "Choose percentage, weight, or bodyweight loading.",
    percent_1rm_invalid: "Percentage must be between 1 and 100.",
    weight_value_invalid: "Weight must be between 0.25 and 1,000.",
    weight_value_invalid_precision_invalid: "Weight may use up to three decimal places.",
    weight_unit_invalid: "Choose kilograms or pounds.",
    rest_seconds_invalid: "Rest must be between 0 and 900 seconds.",
    active_or_archived_template_is_immutable: "Active and archived templates cannot be edited. Duplicate the template to create a new version.",
    only_draft_can_activate: "Only a draft template can be activated.",
    template_not_found: "The template could not be found.",
    stored_template_not_active: "Select an active template owned by this coach.",
    stored_template_activity_mismatch: "The template activity does not match the athlete activity.",
    assigned_template_sessions_exhausted: "Every session in this assigned programme has already been created.",
    athlete_one_rep_max_missing: "The athlete profile is missing a current 1RM reference required by this session.",
    relationship_access_denied: "This coach-athlete relationship is not active.",
    profile_identity_required: "Select a connected athlete.",
    benchmark_value_invalid: "Strength reference values must be between 0.25 and 1,500.",
    benchmark_exercise_invalid: "Choose an exercise from the active registry.",
    benchmark_effective_date_invalid: "Enter a valid effective date.",
    load_rounding_increment_invalid: "Load rounding must be between 0.25 and 25.",
    bodyweight_invalid: "Bodyweight must be between 10 and 500.",
    event_plan_invalid: "Complete the event details before compiling the calendar.",
    event_plan_unknown_field: "The event contains an unsupported field.",
    event_plan_id_invalid: "The event plan identifier is invalid.",
    event_name_invalid: "Enter an event name of 120 characters or fewer.",
    event_type_invalid_for_activity: "Choose an event type supported by this programme activity.",
    event_date_invalid: "Enter a valid event date.",
    programme_start_date_invalid: "Enter a valid programme start date.",
    event_must_follow_programme_start: "The event date must be after the programme start date.",
    event_week_count_invalid: "The event must be between one and 104 training weeks from the programme start.",
    event_location_too_long: "The event location must be 200 characters or fewer.",
    event_timezone_invalid: "Enter a valid timezone such as Europe/London.",
    event_notes_too_long: "Event notes must be 1,000 characters or fewer.",
    block_week_count_invalid: "Each block must contain between one and 52 weeks.",
    block_week_count_mismatch: "The block week input must match the weeks currently contained in that block.",
    event_week_allocation_unbalanced: "The programme blocks must allocate exactly the number of weeks available before the event.",
    event_date_in_past: "The event date cannot be in the past when a programme is activated."
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

  if (Number.isInteger(exercise?.sets)) {
    details.push(`${exercise.sets} sets`);
  }

  const repRange = exercise?.rep_range && typeof exercise.rep_range === "object"
    ? exercise.rep_range
    : null;

  if (
    Number.isInteger(repRange?.minimum) &&
    Number.isInteger(repRange?.maximum)
  ) {
    details.push(`${repRange.minimum}–${repRange.maximum} reps`);
  }
  else if (Number.isInteger(exercise?.reps)) {
    details.push(`${exercise.reps} reps`);
  }

  const intensity = exercise?.intensity && typeof exercise.intensity === "object"
    ? exercise.intensity
    : null;

  if (intensity?.type === "percent_1rm" && Number.isFinite(Number(intensity.value))) {
    const resolved = exercise?.resolved_load && typeof exercise.resolved_load === "object"
      ? exercise.resolved_load
      : null;

    if (resolved && Number.isFinite(Number(resolved.value))) {
      const unit = resolved.unit === "lb" ? "lb" : "kg";
      details.push(`${Number(intensity.value)}% 1RM · ${Number(resolved.value)} ${unit}`);
    }
    else {
      details.push(`${Number(intensity.value)}% 1RM`);
    }
  }
  else if (intensity?.type === "load" && Number.isFinite(Number(intensity.value))) {
    const unit = intensity.unit === "lb" ? "lb" : "kg";
    details.push(`${Number(intensity.value)} ${unit}`);
  }
  else if (intensity?.type === "bodyweight") {
    details.push("Bodyweight");
  }

  if (Number.isInteger(exercise?.rest_seconds)) {
    details.push(`${exercise.rest_seconds}s rest`);
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
    templates: "Programmes",
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

  if (view === "templates" && state.role === "coach") {
    renderTemplateLibrary();
    refreshTemplates({ quiet: true }).catch(handleError);
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
    : new Set(["coach-overview", "athletes", "templates", "assign", "review", "account"]);

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
        template_id: response.beta_path?.template_id ?? null,
        template_session_title: response.beta_path?.template_session_title ?? null,
        event_plan: response.beta_path?.event_plan ?? null,
        event_compile_summary: response.beta_path?.event_compile_summary ?? null,
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
  const activeLocalSession = state.localSessions.find(
    (session) => session.session_id === state.activeSessionId
  );
  const eventPlan = activeLocalSession?.event_plan && typeof activeLocalSession.event_plan === "object"
    ? activeLocalSession.event_plan
    : null;

  elements.todaySessionEmpty.hidden = hasSession;
  elements.todaySessionContent.hidden = !hasSession;
  elements.createSessionButton.textContent = hasSession ? "Create another session" : "Create session";
  elements.todayHistoryCount.textContent = String(state.history.length);

  if (hasSession) {
    const counts = countsFromSession(sessionState);
    const classification = sessionClassification(sessionState);
    setBadge(elements.todayStatusBadge, classification);
    elements.todayActivity.textContent = titleCase(state.profile?.activityId ?? "training");
    elements.todaySessionTitle.textContent = activeLocalSession?.template_session_title
      ? String(activeLocalSession.template_session_title)
      : `${titleCase(state.profile?.activityId ?? "training")} session`;
    elements.todayCompleted.textContent = String(counts.completed.length);
    elements.todayRemaining.textContent = String(counts.remaining.length);
    elements.todayDropped.textContent = String(counts.dropped.length);
  }
  else {
    setBadge(elements.todayStatusBadge, { label: "No session", className: "neutral" });
  }

  elements.todayEventCard.hidden = !eventPlan;
  if (eventPlan) {
    elements.todayEventType.textContent = titleCase(eventPlan.event_type ?? "event");
    elements.todayEventCountdown.textContent = countdownLabel(eventPlan.event_date);
    elements.todayEventName.textContent = String(eventPlan.event_name ?? "Event");
    elements.todayEventDate.textContent = `${formatDate(eventPlan.event_date)}${eventPlan.location ? ` · ${eventPlan.location}` : ""}`;
  }

  const latest = [...state.history].reverse().slice(0, 4);
  elements.todayRecentList.innerHTML = latest.length
    ? latest.map((session) => recordCard(session)).join("")
    : '<div class="empty-state"><p>No recent sessions are recorded.</p></div>';
  bindSessionCards(elements.todayRecentList);
}

async function refreshCoachAthletes(options = {}) {
  if (state.role !== "coach") return [];

  if (!options.quiet) showBusy("Loading connected athletes…");

  try {
    const response = await api(
      "GET",
      `/coach-workspace/athletes?coach_user_id=${encodeURIComponent(state.profile.coachUserId)}`
    );

    const existingById = new Map(
      state.coachAthletes.map((athlete) => [athlete.userId, athlete])
    );

    state.coachAthletes = (Array.isArray(response.athletes) ? response.athletes : [])
      .map((athlete) => {
        const userId = String(athlete.athlete_user_id ?? "");
        const existing = existingById.get(userId);

        return {
          userId,
          displayName: String(athlete.display_name ?? existing?.displayName ?? userId),
          email: String(athlete.email ?? existing?.email ?? ""),
          activityId: String(athlete.activity_id ?? existing?.activityId ?? "powerlifting"),
          relationship: athlete.relationship ?? existing?.relationship ?? null
        };
      })
      .filter((athlete) => athlete.userId);

    saveState();
    return state.coachAthletes;
  }
  finally {
    if (!options.quiet) hideBusy();
  }
}

async function refreshCoachAssignments(options = {}) {
  if (state.role !== "coach") return [];

  if (!options.quiet) showBusy("Loading programme assignments…");

  try {
    const response = await api(
      "GET",
      `/coach-workspace/assignments?coach_user_id=${encodeURIComponent(state.profile.coachUserId)}`
    );

    state.coachAssignments = (Array.isArray(response.assignments) ? response.assignments : [])
      .map((assignment) => ({
        assignmentId: String(assignment.assignment_id ?? ""),
        athleteUserId: String(assignment.assigned_athlete_id ?? ""),
        templateId: String(assignment.template_id ?? ""),
        templateVersion: Number(assignment.template_version ?? 0),
        activityId: String(assignment.activity_id ?? ""),
        recordedAt: String(assignment.requested_at_iso8601 ?? ""),
        record: assignment
      }))
      .filter((assignment) => assignment.assignmentId);

    saveState();
    return state.coachAssignments;
  }
  finally {
    if (!options.quiet) hideBusy();
  }
}

async function refreshCoachAthleteProfiles() {
  const outcomes = await Promise.allSettled(
    state.coachAthletes.map((athlete) =>
      loadAthleteProfile(athlete.userId, { quiet: true })
    )
  );

  for (const outcome of outcomes) {
    if (outcome.status === "rejected") {
      console.error(outcome.reason);
    }
  }
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

    await refreshCoachAthletes({ quiet: true });
    saveState();
    elements.connectAthleteForm.reset();
    renderCoachWorkspace();
    showNotice(`${displayName} connected.`);
  }
  finally {
    hideBusy();
  }
}

function activeCoachTemplates(activityId = null) {
  return state.coachTemplates.filter((template) => {
    if (template.template_status !== "active") return false;
    return activityId === null || template.activity_id === activityId;
  });
}

function profileRecordToDraft(profile, athlete) {
  return {
    coach_user_id: state.profile?.coachUserId ?? "",
    athlete_user_id: athlete.userId,
    preferred_weight_unit: profile?.preferred_weight_unit === "lb" ? "lb" : "kg",
    load_rounding_increment: Number(
      profile?.load_rounding_increment ??
      (profile?.preferred_weight_unit === "lb" ? 5 : 2.5)
    ),
    bodyweight: profile?.bodyweight === null || typeof profile?.bodyweight === "undefined"
      ? ""
      : Number(profile.bodyweight),
    bodyweight_unit: profile?.bodyweight_unit === "lb" ? "lb" : "kg",
    benchmarks: Array.isArray(profile?.benchmarks)
      ? profile.benchmarks.map((benchmark) => ({
          benchmark_id: String(benchmark.benchmark_id ?? ""),
          exercise_id: String(benchmark.exercise_id ?? ""),
          value: Number(benchmark.value ?? 0),
          unit: benchmark.unit === "lb" ? "lb" : "kg",
          basis: ["tested_1rm", "estimated_1rm", "training_max"].includes(benchmark.basis)
            ? benchmark.basis
            : "tested_1rm",
          effective_date: String(benchmark.effective_date ?? new Date().toISOString().slice(0, 10)),
          source_note: String(benchmark.source_note ?? "")
        }))
      : []
  };
}

function profileForAthlete(athleteUserId) {
  const profile = state.athleteProfiles?.[athleteUserId];
  return profile && typeof profile === "object" ? profile : null;
}

function currentProfileBenchmarks(profile) {
  const current = new Map();
  const benchmarks = Array.isArray(profile?.benchmarks) ? profile.benchmarks : [];

  for (const benchmark of benchmarks) {
    const exerciseId = String(benchmark?.exercise_id ?? "");
    if (!exerciseId) continue;

    const existing = current.get(exerciseId);
    const candidateKey = `${String(benchmark?.effective_date ?? "")}::${String(benchmark?.benchmark_id ?? "")}`;
    const existingKey = existing
      ? `${String(existing.effective_date ?? "")}::${String(existing.benchmark_id ?? "")}`
      : "";

    if (!existing || candidateKey > existingKey) {
      current.set(exerciseId, benchmark);
    }
  }

  return current;
}

function benchmarkExerciseOptions(selectedExerciseId = "") {
  return state.templateExercises
    .map((exercise) => `
      <option value="${escapeHtml(exercise.exercise_id)}" ${exercise.exercise_id === selectedExerciseId ? "selected" : ""}>
        ${escapeHtml(exercise.display_name)}
      </option>
    `)
    .join("");
}

function newAthleteBenchmark() {
  const exercise = state.templateExercises[0] ?? null;
  const preferredUnit = state.athleteProfileDraft?.preferred_weight_unit === "lb" ? "lb" : "kg";

  return {
    benchmark_id: "",
    exercise_id: exercise?.exercise_id ?? "",
    value: preferredUnit === "lb" ? 225 : 100,
    unit: preferredUnit,
    basis: "tested_1rm",
    effective_date: new Date().toISOString().slice(0, 10),
    source_note: ""
  };
}

function renderAthleteProfileEditor() {
  const athlete = state.coachAthletes.find(
    (entry) => entry.userId === state.selectedCoachAthleteId
  );
  const draft = state.athleteProfileDraft;

  if (!athlete || !draft) {
    elements.athleteProfilePanel.hidden = true;
    return;
  }

  elements.athleteProfilePanel.hidden = false;
  elements.athleteProfileHeading.textContent = athlete.displayName;
  elements.athleteProfileActivity.textContent = `${titleCase(athlete.activityId)} · ${athlete.userId}`;
  elements.athletePreferredUnit.value = draft.preferred_weight_unit;
  elements.athleteRoundingIncrement.value = String(draft.load_rounding_increment);
  elements.athleteBodyweight.value = draft.bodyweight === "" ? "" : String(draft.bodyweight);
  elements.athleteBodyweightUnit.value = draft.bodyweight_unit;

  elements.athleteBenchmarkList.innerHTML = draft.benchmarks.length
    ? draft.benchmarks.map((benchmark, index) => `
        <article class="benchmark-row" data-benchmark-index="${index}">
          <label class="field benchmark-exercise-field">
            <span>Exercise</span>
            <select data-profile-field="exercise_id">${benchmarkExerciseOptions(benchmark.exercise_id)}</select>
          </label>
          <label class="field benchmark-value-field">
            <span>Reference load</span>
            <input data-profile-field="value" type="number" min="0.25" max="1500" step="0.25" value="${Number(benchmark.value)}" />
          </label>
          <label class="field benchmark-unit-field">
            <span>Unit</span>
            <select data-profile-field="unit">
              <option value="kg" ${benchmark.unit === "lb" ? "" : "selected"}>kg</option>
              <option value="lb" ${benchmark.unit === "lb" ? "selected" : ""}>lb</option>
            </select>
          </label>
          <label class="field benchmark-basis-field">
            <span>Record type</span>
            <select data-profile-field="basis">
              <option value="tested_1rm" ${benchmark.basis === "tested_1rm" ? "selected" : ""}>Tested 1RM</option>
              <option value="estimated_1rm" ${benchmark.basis === "estimated_1rm" ? "selected" : ""}>Estimated 1RM</option>
              <option value="training_max" ${benchmark.basis === "training_max" ? "selected" : ""}>Training max</option>
            </select>
          </label>
          <label class="field benchmark-date-field">
            <span>Effective date</span>
            <input data-profile-field="effective_date" type="date" value="${escapeHtml(benchmark.effective_date)}" />
          </label>
          <label class="field benchmark-note-field">
            <span>Source note</span>
            <input data-profile-field="source_note" maxlength="240" value="${escapeHtml(benchmark.source_note)}" placeholder="Optional factual source" />
          </label>
          <button class="button danger small-button remove-athlete-benchmark" type="button" data-benchmark-index="${index}">Remove</button>
        </article>
      `).join("")
    : `
      <div class="empty-state compact-empty">
        <h3>No strength references recorded</h3>
        <p>Add a tested 1RM, estimated 1RM, or training max for percentage-based exercises.</p>
      </div>
    `;

  const currentCount = currentProfileBenchmarks(draft).size;
  elements.athleteProfileStatus.textContent = `${draft.benchmarks.length} record${draft.benchmarks.length === 1 ? "" : "s"} · ${currentCount} current exercise reference${currentCount === 1 ? "" : "s"}`;
  elements.athleteProfilePanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function syncAthleteProfileHeader() {
  if (!state.athleteProfileDraft) return;

  state.athleteProfileDraft.preferred_weight_unit = elements.athletePreferredUnit.value;
  state.athleteProfileDraft.load_rounding_increment = Number(elements.athleteRoundingIncrement.value);
  state.athleteProfileDraft.bodyweight = elements.athleteBodyweight.value === ""
    ? ""
    : Number(elements.athleteBodyweight.value);
  state.athleteProfileDraft.bodyweight_unit = elements.athleteBodyweightUnit.value;
  saveState();
}

function updateAthleteBenchmarkControl(control) {
  const row = control.closest("[data-benchmark-index]");
  const index = Number(row?.dataset.benchmarkIndex);
  const field = control.dataset.profileField;
  const benchmark = state.athleteProfileDraft?.benchmarks?.[index];
  if (!benchmark || !field) return;

  benchmark[field] = control.type === "number" ? Number(control.value) : control.value;
  saveState();
}

async function loadAthleteProfile(athleteUserId, options = {}) {
  const athlete = state.coachAthletes.find((entry) => entry.userId === athleteUserId);
  if (!athlete) throw new Error("Select a connected athlete.");

  if (!options.quiet) showBusy("Loading athlete profile…");

  try {
    const response = await api(
      "GET",
      `/coach-workspace/athlete-strength-profile?coach_user_id=${encodeURIComponent(state.profile.coachUserId)}&athlete_user_id=${encodeURIComponent(athleteUserId)}`
    );

    if (response.profile) {
      state.athleteProfiles[athleteUserId] = response.profile;
    }
    else {
      delete state.athleteProfiles[athleteUserId];
    }

    saveState();
    return response.profile ?? null;
  }
  finally {
    if (!options.quiet) hideBusy();
  }
}

async function openAthleteProfile(athleteUserId) {
  await loadTemplateExercises();
  const athlete = state.coachAthletes.find((entry) => entry.userId === athleteUserId);
  if (!athlete) throw new Error("Select a connected athlete.");

  const profile = await loadAthleteProfile(athleteUserId);
  state.selectedCoachAthleteId = athleteUserId;
  state.athleteProfileDraft = profileRecordToDraft(profile, athlete);
  saveState();
  renderAthleteProfileEditor();
}

function closeAthleteProfile() {
  state.selectedCoachAthleteId = "";
  state.athleteProfileDraft = null;
  saveState();
  elements.athleteProfilePanel.hidden = true;
}

function addAthleteBenchmark() {
  if (!state.athleteProfileDraft) return;
  state.athleteProfileDraft.benchmarks.push(newAthleteBenchmark());
  saveState();
  renderAthleteProfileEditor();
}

function removeAthleteBenchmark(index) {
  if (!state.athleteProfileDraft) return;
  state.athleteProfileDraft.benchmarks.splice(index, 1);
  saveState();
  renderAthleteProfileEditor();
}

async function saveOpenAthleteProfile(event) {
  event.preventDefault();
  const athlete = state.coachAthletes.find(
    (entry) => entry.userId === state.selectedCoachAthleteId
  );
  if (!athlete || !state.athleteProfileDraft) {
    throw new Error("Open an athlete profile first.");
  }

  syncAthleteProfileHeader();
  showBusy("Saving athlete profile…");

  try {
    const draft = state.athleteProfileDraft;
    const response = await api("POST", "/coach-workspace/athlete-strength-profile", {
      coach_user_id: state.profile.coachUserId,
      athlete_user_id: athlete.userId,
      preferred_weight_unit: draft.preferred_weight_unit,
      load_rounding_increment: Number(draft.load_rounding_increment),
      bodyweight: draft.bodyweight === "" ? null : Number(draft.bodyweight),
      bodyweight_unit: draft.bodyweight_unit,
      benchmarks: draft.benchmarks.map((benchmark) => ({
        benchmark_id: benchmark.benchmark_id,
        exercise_id: benchmark.exercise_id,
        value: Number(benchmark.value),
        unit: benchmark.unit,
        basis: benchmark.basis,
        effective_date: benchmark.effective_date,
        source_note: benchmark.source_note.trim()
      })),
      updated_at_iso8601: nowIso()
    });

    state.athleteProfiles[athlete.userId] = response.profile;
    state.athleteProfileDraft = profileRecordToDraft(response.profile, athlete);
    saveState();
    renderAthleteProfileEditor();
    renderCoachWorkspace();
    renderAssignmentRequirements();
    showNotice(`${athlete.displayName}'s training profile was saved.`);
  }
  finally {
    hideBusy();
  }
}

function requiredOneRmExerciseIds(template) {
  const ids = new Set();
  const blocks = Array.isArray(template?.template_structure?.blocks)
    ? template.template_structure.blocks
    : [];

  for (const block of blocks) {
    for (const week of Array.isArray(block?.weeks) ? block.weeks : []) {
      for (const day of Array.isArray(week?.days) ? week.days : []) {
        for (const session of Array.isArray(day?.sessions) ? day.sessions : []) {
          for (const item of Array.isArray(session?.work_items) ? session.work_items : []) {
            if (item?.loading_reference?.type === "percent_1rm") {
              ids.add(String(item.exercise_id ?? ""));
            }
          }
        }
      }
    }
  }

  ids.delete("");
  return [...ids];
}

function exerciseDisplayName(exerciseId) {
  return state.templateExercises.find((exercise) => exercise.exercise_id === exerciseId)?.display_name
    ?? titleCase(exerciseId);
}

function renderAssignmentEventSummary(template) {
  const eventPlan = template?.event_plan && typeof template.event_plan === "object"
    ? template.event_plan
    : null;

  elements.assignmentEventSummary.hidden = !eventPlan;
  if (!eventPlan) {
    elements.assignmentEventSummary.innerHTML = "";
    return;
  }

  elements.assignmentEventSummary.innerHTML = `
    <div>
      <span class="eyebrow">Assigned event</span>
      <strong>${escapeHtml(eventPlan.event_name)}</strong>
      <span>${escapeHtml(titleCase(eventPlan.event_type))} · ${escapeHtml(formatDate(eventPlan.event_date))}</span>
    </div>
    <strong>${escapeHtml(countdownLabel(eventPlan.event_date))}</strong>
  `;
}

function renderAssignmentRequirements() {
  const athlete = state.coachAthletes.find(
    (entry) => entry.userId === elements.assignmentAthlete.value
  );
  const template = state.coachTemplates.find(
    (entry) => entry.template_id === elements.assignmentTemplate.value
  );

  renderAssignmentEventSummary(template);

  if (!athlete || !template) {
    elements.assignmentRequirements.className = "assignment-requirements neutral";
    elements.assignmentRequirements.textContent = "Select an athlete and programme to check percentage-load references.";
    elements.assignmentSubmitButton.disabled = true;
    return false;
  }

  const required = requiredOneRmExerciseIds(template);
  if (required.length === 0) {
    elements.assignmentRequirements.className = "assignment-requirements complete";
    elements.assignmentRequirements.textContent = "Assignment requirements complete. This programme has no percentage-based exercises.";
    elements.assignmentSubmitButton.disabled = false;
    return true;
  }

  const profile = profileForAthlete(athlete.userId);
  if (!profile) {
    elements.assignmentRequirements.className = "assignment-requirements warning";
    elements.assignmentRequirements.innerHTML = `Athlete profile required. Add 1RM references for: <strong>${required.map(exerciseDisplayName).map(escapeHtml).join(", ")}</strong>.`;
    elements.assignmentSubmitButton.disabled = true;
    return false;
  }

  const current = currentProfileBenchmarks(profile);
  const missing = required.filter((exerciseId) => !current.has(exerciseId));

  if (missing.length > 0) {
    elements.assignmentRequirements.className = "assignment-requirements warning";
    elements.assignmentRequirements.innerHTML = `Missing current strength references: <strong>${missing.map(exerciseDisplayName).map(escapeHtml).join(", ")}</strong>.`;
    elements.assignmentSubmitButton.disabled = true;
    return false;
  }

  elements.assignmentRequirements.className = "assignment-requirements complete";
  elements.assignmentRequirements.textContent = `Assignment requirements complete. ${required.length} percentage-based exercise reference${required.length === 1 ? "" : "s"} available.`;
  elements.assignmentSubmitButton.disabled = false;
  return true;
}

async function refreshAssignmentAthleteProfile() {
  const athleteUserId = elements.assignmentAthlete.value;
  if (!athleteUserId) {
    renderAssignmentRequirements();
    return;
  }

  try {
    await loadAthleteProfile(athleteUserId, { quiet: true });
  }
  catch (error) {
    console.error(error);
  }

  renderAssignmentRequirements();
}

function renderAssignmentTemplateOptions() {
  const athlete = state.coachAthletes.find(
    (entry) => entry.userId === elements.assignmentAthlete.value
  );

  const templates = activeCoachTemplates(athlete?.activityId ?? null);
  const previousValue = elements.assignmentTemplate.value;

  elements.assignmentTemplate.innerHTML = templates.length
    ? templates
        .map((template) => `
          <option value="${escapeHtml(template.template_id)}">
            ${escapeHtml(template.template_name)} · v${Number(template.template_version)} · ${Number(template.block_count ?? 1)} block${Number(template.block_count ?? 1) === 1 ? "" : "s"}
          </option>
        `)
        .join("")
    : '<option value="">No active programmes for this activity</option>';

  if (templates.some((template) => template.template_id === previousValue)) {
    elements.assignmentTemplate.value = previousValue;
  }

  elements.assignmentTemplate.disabled = templates.length === 0;
  renderAssignmentRequirements();
}

function renderCoachSelectors() {
  const options = state.coachAthletes.length
    ? state.coachAthletes
        .map((athlete) => `<option value="${escapeHtml(athlete.userId)}">${escapeHtml(athlete.displayName)}</option>`)
        .join("")
    : '<option value="">No connected athletes</option>';

  const assignmentValue = elements.assignmentAthlete.value;
  const reviewValue = elements.reviewAthlete.value;

  elements.assignmentAthlete.innerHTML = options;
  elements.reviewAthlete.innerHTML = options;

  if (
    assignmentValue &&
    state.coachAthletes.some((athlete) => athlete.userId === assignmentValue)
  ) {
    elements.assignmentAthlete.value = assignmentValue;
  }

  if (
    reviewValue &&
    state.coachAthletes.some((athlete) => athlete.userId === reviewValue)
  ) {
    elements.reviewAthlete.value = reviewValue;
  }

  elements.assignmentAthlete.disabled = state.coachAthletes.length === 0;
  elements.reviewAthlete.disabled = state.coachAthletes.length === 0;
  elements.loadReviewButton.disabled = state.coachAthletes.length === 0;

  renderAssignmentTemplateOptions();
}

function coachAthleteCard(athlete) {
  const assignments = state.coachAssignments.filter(
    (assignment) => assignment.athleteUserId === athlete.userId
  ).length;
  const profile = profileForAthlete(athlete.userId);
  const referenceCount = currentProfileBenchmarks(profile).size;

  return `
    <article class="record-card athlete-record-card">
      <div>
        <h3>${escapeHtml(athlete.displayName)}</h3>
        <p>${escapeHtml(titleCase(athlete.activityId))}</p>
      </div>
      <div class="record-meta athlete-record-meta">
        <span class="badge complete">Connected</span>
        <span class="badge ${profile ? "active" : "neutral"}">${profile ? `${referenceCount} strength reference${referenceCount === 1 ? "" : "s"}` : "Profile not recorded"}</span>
        <span class="badge neutral">${assignments} assignment${assignments === 1 ? "" : "s"}</span>
        <button class="button secondary small-button open-athlete-profile" type="button" data-athlete-id="${escapeHtml(athlete.userId)}">Open profile</button>
      </div>
    </article>
  `;
}

function bindCoachAthleteActions() {
  for (const container of [elements.coachOverviewAthletes, elements.athleteRoster]) {
    for (const button of container.querySelectorAll(".open-athlete-profile")) {
      button.addEventListener("click", () => {
        setView("athletes");
        openAthleteProfile(button.dataset.athleteId).catch(handleError);
      });
    }
  }
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
  bindCoachAthleteActions();
  renderCoachSelectors();

  if (state.selectedCoachAthleteId && state.athleteProfileDraft) {
    renderAthleteProfileEditor();
  }
}

async function recordAssignment(event) {
  event.preventDefault();

  const athleteUserId = elements.assignmentAthlete.value;
  const athlete = state.coachAthletes.find((entry) => entry.userId === athleteUserId);
  const template = state.coachTemplates.find(
    (entry) => entry.template_id === elements.assignmentTemplate.value
  );

  if (!athlete) {
    throw new Error("Select a connected athlete.");
  }

  if (!template || template.template_status !== "active") {
    throw new Error("Select an active template.");
  }

  if (template.activity_id !== athlete.activityId) {
    throw new Error("The programme activity does not match the athlete activity.");
  }

  if (!renderAssignmentRequirements()) {
    throw new Error("Complete the athlete strength references required by this programme before assigning it.");
  }

  showBusy("Recording assignment…");

  try {
    const response = await api("POST", "/sessions/beta-coach-assignment", {
      request_id: createId("assignment_request"),
      requested_at_iso8601: nowIso(),
      coach_user_id: state.profile.coachUserId,
      athlete_user_id: athleteUserId,
      template_id: template.template_id,
      activity_id: athlete.activityId
    });

    await refreshCoachAssignments({ quiet: true });
    saveState();
    elements.assignmentResult.textContent =
      `${template.template_name} v${Number(template.template_version)} assigned to ${athlete.displayName}. Percentage-based loads will resolve from the athlete profile when each session is created.`;
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


function templateExerciseOptions(selectedExerciseId = "") {
  return state.templateExercises
    .map((exercise) => `
      <option
        value="${escapeHtml(exercise.exercise_id)}"
        ${exercise.exercise_id === selectedExerciseId ? "selected" : ""}
      >
        ${escapeHtml(exercise.display_name)}
      </option>
    `)
    .join("");
}

function newTemplateWorkItem(index) {
  const exercise = state.templateExercises[index] ?? state.templateExercises[0] ?? null;

  return {
    work_item_id: "",
    order_index: index + 1,
    exercise_id: exercise?.exercise_id ?? "",
    planned_sets: 3,
    rep_mode: "fixed",
    planned_reps: index === 0 ? 5 : 8,
    rep_min: index === 0 ? 4 : 8,
    rep_max: index === 0 ? 6 : 12,
    load_mode: "percent_1rm",
    percent_1rm: index === 0 ? 75 : 65,
    weight_value: index === 0 ? 100 : 20,
    weight_unit: "kg",
    rest_seconds: index === 0 ? 180 : 120,
    role: index === 0 ? "primary" : "accessory"
  };
}

function newTemplateSession(orderIndex) {
  return {
    session_id: "",
    order_index: orderIndex,
    title: `Session ${orderIndex}`,
    work_items: Array.from({ length: 4 }, (_, index) => newTemplateWorkItem(index))
  };
}

function newTemplateWeek(orderIndex) {
  return {
    week_id: "",
    order_index: orderIndex,
    calendar_start_date: "",
    calendar_end_date: "",
    days_until_event_at_week_start: null,
    partial_week: false,
    sessions: [newTemplateSession(1)]
  };
}

function newTemplateBlock(orderIndex) {
  return {
    block_id: "",
    order_index: orderIndex,
    name: `Block ${orderIndex}`,
    description: "",
    block_type: "general",
    week_count: 1,
    weeks: [newTemplateWeek(1)]
  };
}

function newTemplateDraft() {
  return {
    template_id: "",
    template_family_id: "",
    template_version: 1,
    template_status: "draft",
    template_name: "",
    description: "",
    activity_id: "powerlifting",
    event_plan: null,
    event_compile_summary: null,
    blocks: [newTemplateBlock(1)]
  };
}

function storedWorkItemToDraft(workItem, workItemIndex) {
  const repPrescription = workItem?.rep_prescription &&
    typeof workItem.rep_prescription === "object"
    ? workItem.rep_prescription
    : {};

  const loadingReference = workItem?.loading_reference &&
    typeof workItem.loading_reference === "object"
    ? workItem.loading_reference
    : {};

  const repMode = repPrescription.type === "range" ? "range" : "fixed";
  const loadMode = loadingReference.type === "load"
    ? "fixed_weight"
    : loadingReference.type === "bodyweight"
      ? "bodyweight"
      : "percent_1rm";
  const fallbackReps = Number(workItem?.planned_reps ?? 5);

  return {
    work_item_id: String(workItem?.work_item_id ?? ""),
    order_index: Number(workItem?.order_index ?? workItemIndex + 1),
    exercise_id: String(workItem?.exercise_id ?? ""),
    planned_sets: Number(workItem?.planned_sets ?? 3),
    rep_mode: repMode,
    planned_reps: Number(repPrescription.value ?? fallbackReps),
    rep_min: Number(repPrescription.minimum ?? fallbackReps),
    rep_max: Number(repPrescription.maximum ?? fallbackReps),
    load_mode: loadMode,
    percent_1rm: loadingReference.type === "percent_1rm"
      ? Number(loadingReference.value ?? 75)
      : 75,
    weight_value: loadingReference.type === "load"
      ? Number(loadingReference.value ?? 20)
      : 20,
    weight_unit: loadingReference.unit === "lb" ? "lb" : "kg",
    rest_seconds: Number(workItem?.rest_seconds ?? 120),
    role: workItem?.role === "primary" ? "primary" : "accessory"
  };
}

function templateRecordToDraft(template) {
  const structure = template?.template_structure && typeof template.template_structure === "object"
    ? template.template_structure
    : {};
  const rawBlocks = Array.isArray(structure.blocks) ? structure.blocks : [];

  const blocks = rawBlocks
    .slice()
    .sort((left, right) => Number(left.order_index) - Number(right.order_index))
    .map((block, blockIndex) => {
      const rawWeeks = Array.isArray(block?.weeks) ? block.weeks : [];

      return {
        block_id: String(block?.block_id ?? ""),
        order_index: Number(block?.order_index ?? blockIndex + 1),
        name: String(block?.name ?? `Block ${blockIndex + 1}`),
        description: String(block?.description ?? ""),
        block_type: ["general", "volume", "strength", "peak", "deload", "custom"].includes(block?.block_type)
          ? block.block_type
          : "general",
        week_count: Number(block?.week_count ?? rawWeeks.length ?? 1),
        calendar_start_date: String(block?.calendar_start_date ?? ""),
        calendar_end_date: String(block?.calendar_end_date ?? ""),
        weeks: rawWeeks
          .slice()
          .sort((left, right) => Number(left.order_index) - Number(right.order_index))
          .map((week, weekIndex) => {
            const days = Array.isArray(week?.days) ? week.days : [];
            const sessions = days
              .slice()
              .sort((left, right) => Number(left.order_index) - Number(right.order_index))
              .flatMap((day) => {
                const daySessions = Array.isArray(day?.sessions) ? day.sessions : [];
                return daySessions
                  .slice()
                  .sort((left, right) => Number(left.order_index) - Number(right.order_index))
                  .map((session, sessionIndex) => ({
                    session_id: String(session?.session_id ?? ""),
                    order_index: Number(day?.order_index ?? session?.order_index ?? sessionIndex + 1),
                    title: String(session?.title ?? `Session ${sessionIndex + 1}`),
                    work_items: (Array.isArray(session?.work_items) ? session.work_items : [])
                      .slice()
                      .sort((left, right) => Number(left.order_index) - Number(right.order_index))
                      .map(storedWorkItemToDraft)
                  }));
              });

            return {
              week_id: String(week?.week_id ?? ""),
              order_index: Number(week?.order_index ?? weekIndex + 1),
              calendar_start_date: String(week?.calendar_start_date ?? ""),
              calendar_end_date: String(week?.calendar_end_date ?? ""),
              days_until_event_at_week_start: Number.isInteger(week?.days_until_event_at_week_start)
                ? Number(week.days_until_event_at_week_start)
                : null,
              partial_week: week?.partial_week === true,
              sessions: sessions.length ? sessions : [newTemplateSession(1)]
            };
          })
      };
    });

  return {
    template_id: String(template?.template_id ?? ""),
    template_family_id: String(template?.template_family_id ?? ""),
    template_version: Number(template?.template_version ?? 1),
    template_status: String(template?.template_status ?? "draft"),
    template_name: String(template?.template_name ?? ""),
    description: String(template?.description ?? ""),
    activity_id: String(template?.activity_id ?? "powerlifting"),
    event_plan: template?.event_plan && typeof template.event_plan === "object"
      ? {
          event_plan_id: String(template.event_plan.event_plan_id ?? ""),
          event_name: String(template.event_plan.event_name ?? ""),
          event_type: String(template.event_plan.event_type ?? ""),
          event_date: String(template.event_plan.event_date ?? ""),
          programme_start_date: String(template.event_plan.programme_start_date ?? ""),
          location: String(template.event_plan.location ?? ""),
          timezone: String(template.event_plan.timezone ?? "Europe/London"),
          notes: String(template.event_plan.notes ?? "")
        }
      : null,
    event_compile_summary: template?.event_compile_summary && typeof template.event_compile_summary === "object"
      ? template.event_compile_summary
      : null,
    blocks: blocks.length ? blocks : [newTemplateBlock(1)]
  };
}

async function loadTemplateExercises() {
  if (state.templateExercises.length > 0) return state.templateExercises;

  const response = await api("GET", "/templates/exercises");
  state.templateExercises = Array.isArray(response.exercises) ? response.exercises : [];
  saveState();

  if (state.templateExercises.length < 4) {
    throw new Error("The active exercise registry must contain at least four exercises.");
  }

  return state.templateExercises;
}

async function refreshTemplates(options = {}) {
  if (state.role !== "coach") return [];

  const coachUserId = state.profile?.coachUserId ?? "";
  const response = await api(
    "GET",
    `/templates?coach_user_id=${encodeURIComponent(coachUserId)}`
  );

  state.coachTemplates = Array.isArray(response.templates) ? response.templates : [];
  saveState();
  renderTemplateLibrary();
  renderCoachSelectors();

  if (!options.quiet) showNotice("Programme library refreshed.");
  return state.coachTemplates;
}

function templateStatusBadge(status) {
  if (status === "active") return '<span class="badge complete">Active</span>';
  if (status === "archived") return '<span class="badge neutral">Archived</span>';
  return '<span class="badge active">Draft</span>';
}

function templateCard(template) {
  const status = String(template.template_status ?? "draft");
  const sessionCount = Number(template.session_count ?? 0);
  const blockCount = Number(template.block_count ?? template.template_structure?.blocks?.length ?? 1);
  const weekCount = Number(template.week_count ?? 0);
  const version = Number(template.template_version ?? 1);
  const eventPlan = template?.event_plan && typeof template.event_plan === "object"
    ? template.event_plan
    : null;
  const eventLine = eventPlan
    ? `<div class="template-event-line"><span class="badge neutral">${escapeHtml(titleCase(eventPlan.event_type))}</span><strong>${escapeHtml(eventPlan.event_name)}</strong><span>${escapeHtml(formatDate(eventPlan.event_date))}</span><span>${escapeHtml(countdownLabel(eventPlan.event_date))}</span></div>`
    : "";

  const editAction = status === "draft"
    ? `<button class="button secondary small-button template-edit" type="button" data-template-id="${escapeHtml(template.template_id)}">Edit</button>`
    : "";
  const activateAction = status === "draft"
    ? `<button class="button primary small-button template-activate" type="button" data-template-id="${escapeHtml(template.template_id)}">Activate</button>`
    : "";
  const duplicateAction = status !== "draft"
    ? `<button class="button secondary small-button template-duplicate" type="button" data-template-id="${escapeHtml(template.template_id)}">Duplicate version</button>`
    : "";
  const archiveAction = status !== "archived"
    ? `<button class="button secondary small-button template-archive" type="button" data-template-id="${escapeHtml(template.template_id)}">Archive</button>`
    : "";

  return `
    <article class="template-card">
      <div>
        <h3>${escapeHtml(template.template_name)}</h3>
        <p>${escapeHtml(titleCase(template.activity_id))} · Version ${version}</p>
        <div class="template-card-facts">
          <span>${blockCount} block${blockCount === 1 ? "" : "s"}</span>
          <span>${weekCount} week${weekCount === 1 ? "" : "s"}</span>
          <span>${sessionCount} session${sessionCount === 1 ? "" : "s"}</span>
        </div>
        ${eventLine}
        <div class="template-status-line">
          ${templateStatusBadge(status)}
          <span class="badge neutral">${escapeHtml(formatDate(template.updated_at_iso8601))}</span>
        </div>
      </div>
      <div class="template-card-actions">
        ${editAction}
        ${activateAction}
        ${duplicateAction}
        ${archiveAction}
      </div>
    </article>
  `;
}

function bindTemplateLibraryActions() {
  for (const button of elements.templateLibraryList.querySelectorAll(".template-edit")) {
    button.addEventListener("click", () => {
      const template = state.coachTemplates.find(
        (entry) => entry.template_id === button.dataset.templateId
      );
      if (template) openTemplateBuilder(templateRecordToDraft(template));
    });
  }

  for (const button of elements.templateLibraryList.querySelectorAll(".template-activate")) {
    button.addEventListener("click", () => {
      activateTemplateById(button.dataset.templateId).catch(handleError);
    });
  }

  for (const button of elements.templateLibraryList.querySelectorAll(".template-duplicate")) {
    button.addEventListener("click", () => {
      duplicateTemplate(button.dataset.templateId).catch(handleError);
    });
  }

  for (const button of elements.templateLibraryList.querySelectorAll(".template-archive")) {
    button.addEventListener("click", () => {
      archiveTemplate(button.dataset.templateId).catch(handleError);
    });
  }
}

function renderTemplateLibrary() {
  const drafts = state.coachTemplates.filter((template) => template.template_status === "draft");
  const active = state.coachTemplates.filter((template) => template.template_status === "active");
  const archived = state.coachTemplates.filter((template) => template.template_status === "archived");

  elements.templateDraftCount.textContent = String(drafts.length);
  elements.templateActiveCount.textContent = String(active.length);
  elements.templateArchivedCount.textContent = String(archived.length);

  elements.templateLibraryList.innerHTML = state.coachTemplates.length
    ? state.coachTemplates.map(templateCard).join("")
    : `
      <div class="empty-state">
        <h3>No programmes created</h3>
        <p>Create a programme with at least one training block before assigning training.</p>
      </div>
    `;

  bindTemplateLibraryActions();
}

const EVENT_TYPES_BY_ACTIVITY = Object.freeze({
  powerlifting: [
    ["powerlifting_meet", "Powerlifting meet"],
    ["strength_event", "Strength event"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  general_strength: [
    ["strength_event", "Strength event"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  rugby_union: [
    ["rugby_match", "Rugby match"],
    ["rugby_tournament", "Rugby tournament"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ]
});

function eventTypesForActivity(activityId) {
  return EVENT_TYPES_BY_ACTIVITY[activityId] ?? EVENT_TYPES_BY_ACTIVITY.general_strength;
}

function defaultEventType(activityId) {
  return eventTypesForActivity(activityId)[0][0];
}

function ensureDraftEventPlan() {
  const draft = state.templateDraft;
  if (!draft) return null;

  if (!draft.event_plan) {
    const startDate = todayDateOnly();
    draft.event_plan = {
      event_plan_id: "",
      event_name: "",
      event_type: defaultEventType(draft.activity_id),
      event_date: addDateOnlyDays(startDate, 84),
      programme_start_date: startDate,
      location: "",
      timezone: "Europe/London",
      notes: ""
    };
  }

  const allowedTypes = eventTypesForActivity(draft.activity_id).map(([value]) => value);
  if (!allowedTypes.includes(draft.event_plan.event_type)) {
    draft.event_plan.event_type = defaultEventType(draft.activity_id);
  }

  return draft.event_plan;
}

function eventTypeOptions(activityId, selected) {
  return eventTypesForActivity(activityId)
    .map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`)
    .join("");
}

function localEventCompileSummary(draft) {
  const eventPlan = draft?.event_plan;
  if (!eventPlan) return null;

  if (!eventPlan.event_name.trim()) {
    return {
      valid: false,
      reason: "Enter an event name."
    };
  }

  if (!eventTypesForActivity(draft.activity_id).some(([value]) => value === eventPlan.event_type)) {
    return {
      valid: false,
      reason: "Choose an event type supported by this activity."
    };
  }

  if (!eventPlan.timezone.trim() || !/^[A-Za-z0-9_+\-/]+$/u.test(eventPlan.timezone.trim())) {
    return {
      valid: false,
      reason: "Enter a valid timezone such as Europe/London."
    };
  }

  const trainingDays = dateOnlyDifference(
    eventPlan.programme_start_date,
    eventPlan.event_date
  );

  if (trainingDays === null || trainingDays < 1) {
    return {
      valid: false,
      reason: "Event date must be after the programme start date."
    };
  }

  const requiredWeeks = Math.ceil(trainingDays / 7);
  if (requiredWeeks < 1 || requiredWeeks > 104) {
    return {
      valid: false,
      reason: "The event calendar must contain between 1 and 104 training weeks."
    };
  }

  const allocatedWeeks = draft.blocks.reduce(
    (total, block) => total + Number(block.weeks?.length ?? block.week_count ?? 0),
    0
  );
  const weekDelta = requiredWeeks - allocatedWeeks;
  let offset = 0;
  const weekSchedules = [];
  const blockSchedules = draft.blocks.map((block) => {
    const weekCount = Number(block.weeks?.length ?? block.week_count ?? 0);
    const startDate = addDateOnlyDays(eventPlan.programme_start_date, offset * 7);
    const theoreticalEnd = addDateOnlyDays(startDate, weekCount * 7 - 1);
    const finalTrainingDate = addDateOnlyDays(eventPlan.event_date, -1);
    const endDate = theoreticalEnd && finalTrainingDate && theoreticalEnd > finalTrainingDate
      ? finalTrainingDate
      : theoreticalEnd;
    const startWeekIndex = offset + 1;

    for (let weekOffset = 0; weekOffset < weekCount; weekOffset += 1) {
      const weekStart = addDateOnlyDays(eventPlan.programme_start_date, (offset + weekOffset) * 7);
      const theoreticalWeekEnd = addDateOnlyDays(weekStart, 6);
      const weekEnd = theoreticalWeekEnd && finalTrainingDate && theoreticalWeekEnd > finalTrainingDate
        ? finalTrainingDate
        : theoreticalWeekEnd;
      const daysAtStart = dateOnlyDifference(weekStart, eventPlan.event_date);

      weekSchedules.push({
        start_date: weekStart,
        end_date: weekEnd,
        days_until_event_at_week_start: daysAtStart,
        partial_week: dateOnlyDifference(weekStart, weekEnd) !== 6
      });
    }

    offset += weekCount;

    return {
      start_date: startDate,
      end_date: endDate,
      start_week_index: startWeekIndex,
      end_week_index: offset
    };
  });

  return {
    valid: true,
    training_day_count: trainingDays,
    required_week_count: requiredWeeks,
    allocated_week_count: allocatedWeeks,
    week_delta: weekDelta,
    allocation_state: weekDelta === 0
      ? "balanced"
      : weekDelta > 0
        ? "under_allocated"
        : "over_allocated",
    partial_final_week_days: trainingDays - ((requiredWeeks - 1) * 7),
    blockSchedules,
    weekSchedules
  };
}

function syncTemplateEventFields() {
  const draft = state.templateDraft;
  if (!draft || !draft.event_plan) return;

  draft.event_plan.event_name = elements.templateEventName.value;
  draft.event_plan.event_type = elements.templateEventType.value;
  draft.event_plan.programme_start_date = elements.templateProgrammeStartDate.value;
  draft.event_plan.event_date = elements.templateEventDate.value;
  draft.event_plan.location = elements.templateEventLocation.value;
  draft.event_plan.timezone = elements.templateEventTimezone.value;
  draft.event_plan.notes = elements.templateEventNotes.value;
  draft.event_compile_summary = null;
  saveState();
}

function renderEventCompiler() {
  const draft = state.templateDraft;
  if (!draft) return;

  const enabled = Boolean(draft.event_plan);
  elements.templateEventEnabled.checked = enabled;
  elements.templateEventFields.hidden = !enabled;

  if (!enabled) {
    elements.activateTemplateButton.disabled = false;
    return;
  }

  const eventPlan = ensureDraftEventPlan();
  elements.templateEventName.value = eventPlan.event_name;
  elements.templateEventType.innerHTML = eventTypeOptions(draft.activity_id, eventPlan.event_type);
  elements.templateProgrammeStartDate.value = eventPlan.programme_start_date;
  elements.templateEventDate.value = eventPlan.event_date;
  elements.templateEventLocation.value = eventPlan.location;
  elements.templateEventTimezone.value = eventPlan.timezone;
  elements.templateEventNotes.value = eventPlan.notes;
  elements.templateEventCountdown.textContent = countdownLabel(eventPlan.event_date);

  const summary = localEventCompileSummary(draft);
  const allocated = templateCounts(draft).weeks;
  elements.templateEventAllocatedWeeks.textContent = String(allocated);

  if (!summary?.valid) {
    elements.templateEventRequiredWeeks.textContent = "—";
    elements.templateEventWeekBalance.textContent = "—";
    elements.templateEventAllocationState.className = "assignment-requirements warning";
    elements.templateEventAllocationState.textContent = summary?.reason ?? "Set a start date and event date to compile the calendar.";
    elements.fitFinalBlockButton.disabled = true;
    elements.activateTemplateButton.disabled = true;
    return;
  }

  let globalWeekIndex = 0;
  draft.blocks.forEach((block, index) => {
    block.calendar_start_date = summary.blockSchedules[index]?.start_date ?? "";
    block.calendar_end_date = summary.blockSchedules[index]?.end_date ?? "";

    block.weeks.forEach((week) => {
      const calendar = summary.weekSchedules[globalWeekIndex] ?? null;
      globalWeekIndex += 1;
      week.calendar_start_date = calendar?.start_date ?? "";
      week.calendar_end_date = calendar?.end_date ?? "";
      week.days_until_event_at_week_start = calendar?.days_until_event_at_week_start ?? null;
      week.partial_week = calendar?.partial_week === true;
    });
  });

  elements.templateEventRequiredWeeks.textContent = String(summary.required_week_count);
  elements.templateEventWeekBalance.textContent = summary.week_delta === 0
    ? "Balanced"
    : summary.week_delta > 0
      ? `${summary.week_delta} remaining`
      : `${Math.abs(summary.week_delta)} over`;

  const balanced = summary.week_delta === 0;
  elements.templateEventAllocationState.className = balanced
    ? "assignment-requirements complete"
    : "assignment-requirements warning";
  elements.templateEventAllocationState.textContent = balanced
    ? `${summary.required_week_count} training weeks are fully allocated. The final training week contains ${summary.partial_final_week_days} day${summary.partial_final_week_days === 1 ? "" : "s"} before the event.`
    : summary.week_delta > 0
      ? `Allocate ${summary.week_delta} more week${summary.week_delta === 1 ? "" : "s"} before activation.`
      : `Remove ${Math.abs(summary.week_delta)} week${Math.abs(summary.week_delta) === 1 ? "" : "s"} before activation.`;

  const precedingWeeks = draft.blocks.slice(0, -1).reduce((total, block) => total + block.weeks.length, 0);
  const finalTarget = summary.required_week_count - precedingWeeks;
  elements.fitFinalBlockButton.disabled = finalTarget < 1 || finalTarget > 52;
  elements.activateTemplateButton.disabled = !balanced || eventPlan.event_date < todayDateOnly();
}

function eventPreviewPayload() {
  const draft = state.templateDraft;
  if (!draft?.event_plan) throw new Error("Enable the event compiler first.");

  syncTemplateHeader();
  syncTemplateEventFields();
  reindexTemplateDraft();

  return {
    activity_id: draft.activity_id,
    ...draft.event_plan,
    blocks: draft.blocks.map((block) => ({
      block_id: block.block_id,
      order_index: Number(block.order_index),
      name: block.name,
      block_type: block.block_type,
      week_count: block.weeks.length
    }))
  };
}

async function previewEventCalendar() {
  showBusy("Compiling event calendar…");
  try {
    const response = await api(
      "POST",
      "/coach-workspace/event-compile-preview",
      eventPreviewPayload()
    );
    state.templateDraft.event_compile_summary = response.compile;
    if (response.compile?.event_plan_id) {
      state.templateDraft.event_plan.event_plan_id = response.compile.event_plan_id;
    }
    saveState();
    rerenderTemplateBuilder();
    showNotice("Event calendar compiled.");
  }
  finally {
    hideBusy();
  }
}

function resizeBlockWeeks(blockIndex, requestedCount) {
  const block = state.templateDraft?.blocks[blockIndex];
  if (!block) return;

  const totalWithoutBlock = templateCounts(state.templateDraft).weeks - block.weeks.length;
  const maximum = Math.min(52, 104 - totalWithoutBlock);
  const target = Math.max(1, Math.min(maximum, Math.trunc(Number(requestedCount) || 1)));

  while (block.weeks.length < target) {
    const source = block.weeks[block.weeks.length - 1] ?? newTemplateWeek(1);
    block.weeks.push(cloneTemplateNode(source));
  }

  if (block.weeks.length > target) {
    block.weeks.splice(target);
  }

  block.week_count = block.weeks.length;
  state.templateDraft.event_compile_summary = null;
}

function fitFinalBlockToEvent() {
  const draft = state.templateDraft;
  const summary = localEventCompileSummary(draft);
  if (!draft?.event_plan || !summary?.valid) {
    throw new Error("Set valid programme and event dates first.");
  }

  const finalIndex = draft.blocks.length - 1;
  const precedingWeeks = draft.blocks.slice(0, finalIndex)
    .reduce((total, block) => total + block.weeks.length, 0);
  const target = summary.required_week_count - precedingWeeks;

  if (target < 1 || target > 52) {
    throw new Error("The final block cannot absorb the remaining weeks. Adjust earlier blocks or add another block.");
  }

  resizeBlockWeeks(finalIndex, target);
  rerenderTemplateBuilder();
  showNotice(`Final block fitted to ${target} week${target === 1 ? "" : "s"}.`);
}

function templateCounts(draft) {
  const blocks = Array.isArray(draft?.blocks) ? draft.blocks : [];
  const weeks = blocks.reduce((total, block) => total + block.weeks.length, 0);
  const sessions = blocks.reduce(
    (total, block) => total + block.weeks.reduce(
      (weekTotal, week) => weekTotal + week.sessions.length,
      0
    ),
    0
  );
  return { blocks: blocks.length, weeks, sessions };
}

function updateTemplateFacts() {
  const draft = state.templateDraft;
  const counts = templateCounts(draft);
  elements.templateVersion.textContent = String(draft?.template_version ?? 1);
  elements.templateBlockCount.textContent = String(counts.blocks);
  elements.templateWeekCount.textContent = String(counts.weeks);
  elements.templateSessionCount.textContent = String(counts.sessions);
  elements.addTemplateBlockButton.disabled =
    counts.blocks >= 12 ||
    counts.weeks >= 104;
  renderEventCompiler();
}

function templateWorkItemAttributes(
  blockIndex,
  weekIndex,
  sessionIndex,
  workItemIndex,
  field
) {
  return `
    data-template-kind="work-item"
    data-block-index="${blockIndex}"
    data-week-index="${weekIndex}"
    data-session-index="${sessionIndex}"
    data-work-item-index="${workItemIndex}"
    data-field="${field}"
  `;
}

function renderTemplateRepControls(
  workItem,
  blockIndex,
  weekIndex,
  sessionIndex,
  workItemIndex
) {
  const rangeMode = workItem.rep_mode === "range";

  return `
    <fieldset class="template-prescription-card">
      <legend>Repetitions</legend>
      <div class="template-prescription-fields">
        <label class="template-method-field">
          <span>Method</span>
          <select ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "rep_mode")}>
            <option value="fixed" ${rangeMode ? "" : "selected"}>Fixed reps</option>
            <option value="range" ${rangeMode ? "selected" : ""}>Rep range</option>
          </select>
        </label>
        ${rangeMode
          ? `
            <label><span>Minimum</span><input type="number" min="1" max="100" step="1" value="${Number(workItem.rep_min)}" ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "rep_min")} /></label>
            <label><span>Maximum</span><input type="number" min="1" max="100" step="1" value="${Number(workItem.rep_max)}" ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "rep_max")} /></label>
          `
          : `
            <label><span>Reps</span><input type="number" min="1" max="100" step="1" value="${Number(workItem.planned_reps)}" ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "planned_reps")} /></label>
          `}
      </div>
    </fieldset>
  `;
}

function renderTemplateLoadControls(
  workItem,
  blockIndex,
  weekIndex,
  sessionIndex,
  workItemIndex
) {
  const loadMode = ["fixed_weight", "bodyweight"].includes(workItem.load_mode)
    ? workItem.load_mode
    : "percent_1rm";

  return `
    <fieldset class="template-prescription-card">
      <legend>Loading</legend>
      <div class="template-prescription-fields">
        <label class="template-method-field">
          <span>Method</span>
          <select ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "load_mode")}>
            <option value="percent_1rm" ${loadMode === "percent_1rm" ? "selected" : ""}>% of athlete 1RM</option>
            <option value="fixed_weight" ${loadMode === "fixed_weight" ? "selected" : ""}>Fixed weight</option>
            <option value="bodyweight" ${loadMode === "bodyweight" ? "selected" : ""}>Bodyweight</option>
          </select>
        </label>
        ${loadMode === "percent_1rm"
          ? `
            <label><span>% 1RM</span><input type="number" min="1" max="100" step="0.5" value="${Number(workItem.percent_1rm)}" ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "percent_1rm")} /></label>
          `
          : loadMode === "fixed_weight"
            ? `
              <label><span>Weight</span><input type="number" min="0.25" max="1000" step="0.25" value="${Number(workItem.weight_value)}" ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "weight_value")} /></label>
              <label><span>Unit</span><select ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "weight_unit")}><option value="kg" ${workItem.weight_unit === "lb" ? "" : "selected"}>kg</option><option value="lb" ${workItem.weight_unit === "lb" ? "selected" : ""}>lb</option></select></label>
            `
            : '<div class="template-bodyweight-note">No external load is prescribed.</div>'}
      </div>
    </fieldset>
  `;
}

function renderTemplateWorkItem(workItem, blockIndex, weekIndex, sessionIndex, workItemIndex) {
  return `
    <div class="template-work-item">
      <div class="template-work-item-header">
        <span class="exercise-order">${workItemIndex + 1}</span>
        <label class="template-exercise-field">
          <span>Exercise</span>
          <select ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "exercise_id")}>
            ${templateExerciseOptions(workItem.exercise_id)}
          </select>
        </label>
        <label class="template-role-field">
          <span>Role</span>
          <select ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "role")}>
            <option value="primary" ${workItem.role === "primary" ? "selected" : ""}>Primary</option>
            <option value="accessory" ${workItem.role === "accessory" ? "selected" : ""}>Accessory</option>
          </select>
        </label>
      </div>
      <div class="template-prescription-grid">
        <label class="template-sets-field">
          <span>Sets</span>
          <input type="number" min="1" max="20" step="1" value="${Number(workItem.planned_sets)}" ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "planned_sets")} />
        </label>
        ${renderTemplateRepControls(workItem, blockIndex, weekIndex, sessionIndex, workItemIndex)}
        ${renderTemplateLoadControls(workItem, blockIndex, weekIndex, sessionIndex, workItemIndex)}
        <label class="template-rest-field">
          <span>Rest seconds</span>
          <input type="number" min="0" max="900" step="5" value="${Number(workItem.rest_seconds)}" ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "rest_seconds")} />
        </label>
      </div>
    </div>
  `;
}

function renderTemplateSession(session, blockIndex, weekIndex, sessionIndex, sessionCount) {
  return `
    <section class="template-session">
      <div class="template-session-header">
        <label class="field template-session-title-field">
          <span>Session title</span>
          <input
            value="${escapeHtml(session.title)}"
            data-template-kind="session"
            data-block-index="${blockIndex}"
            data-week-index="${weekIndex}"
            data-session-index="${sessionIndex}"
            data-field="title"
            maxlength="100"
          />
        </label>
        <div class="builder-action-row">
          <button class="button secondary small-button move-template-session" type="button" data-direction="-1" data-block-index="${blockIndex}" data-week-index="${weekIndex}" data-session-index="${sessionIndex}" ${sessionIndex === 0 ? "disabled" : ""}>↑</button>
          <button class="button secondary small-button move-template-session" type="button" data-direction="1" data-block-index="${blockIndex}" data-week-index="${weekIndex}" data-session-index="${sessionIndex}" ${sessionIndex === sessionCount - 1 ? "disabled" : ""}>↓</button>
          <button class="button secondary small-button duplicate-template-session" type="button" data-block-index="${blockIndex}" data-week-index="${weekIndex}" data-session-index="${sessionIndex}">Duplicate</button>
          ${sessionCount > 1 ? `<button class="button danger small-button remove-template-session" type="button" data-block-index="${blockIndex}" data-week-index="${weekIndex}" data-session-index="${sessionIndex}">Remove</button>` : ""}
        </div>
      </div>
      <div class="template-work-items">
        ${session.work_items.map((workItem, workItemIndex) => renderTemplateWorkItem(workItem, blockIndex, weekIndex, sessionIndex, workItemIndex)).join("")}
      </div>
    </section>
  `;
}

function renderTemplateWeek(week, blockIndex, weekIndex, weekCount) {
  return `
    <article class="template-week">
      <div class="template-week-header">
        <div>
          <p class="eyebrow">Week ${weekIndex + 1}</p>
          <h4>Training week</h4>
          ${week.calendar_start_date
            ? `<p class="template-week-calendar">${escapeHtml(formatDate(week.calendar_start_date))} – ${escapeHtml(formatDate(week.calendar_end_date))}${Number.isInteger(week.days_until_event_at_week_start) ? ` · ${week.days_until_event_at_week_start} days to event` : ""}${week.partial_week ? " · Partial week" : ""}</p>`
            : ""}
        </div>
        <div class="builder-action-row">
          <button class="button secondary small-button move-template-week" type="button" data-direction="-1" data-block-index="${blockIndex}" data-week-index="${weekIndex}" ${weekIndex === 0 ? "disabled" : ""}>↑</button>
          <button class="button secondary small-button move-template-week" type="button" data-direction="1" data-block-index="${blockIndex}" data-week-index="${weekIndex}" ${weekIndex === weekCount - 1 ? "disabled" : ""}>↓</button>
          <button class="button secondary small-button duplicate-template-week" type="button" data-block-index="${blockIndex}" data-week-index="${weekIndex}">Duplicate</button>
          ${weekCount > 1 ? `<button class="button danger small-button remove-template-week" type="button" data-block-index="${blockIndex}" data-week-index="${weekIndex}">Remove</button>` : ""}
        </div>
      </div>
      <div class="template-sessions">
        ${week.sessions.map((session, sessionIndex) => renderTemplateSession(session, blockIndex, weekIndex, sessionIndex, week.sessions.length)).join("")}
      </div>
      <button class="button secondary add-template-session" type="button" data-block-index="${blockIndex}" data-week-index="${weekIndex}" ${week.sessions.length >= 7 ? "disabled" : ""}>Add session</button>
    </article>
  `;
}

function renderTemplateBlocks() {
  const draft = state.templateDraft;
  if (!draft) {
    elements.templateBlocks.innerHTML = "";
    return;
  }

  const totalWeeks =
    templateCounts(draft).weeks;

  elements.templateBlocks.innerHTML = draft.blocks.map((block, blockIndex) => `
    <article class="template-block">
      <div class="template-block-header">
        <div>
          <p class="eyebrow">Training block ${blockIndex + 1}</p>
          <h3>${escapeHtml(block.name || `Block ${blockIndex + 1}`)}</h3>
        </div>
        <div class="builder-action-row">
          <button class="button secondary small-button move-template-block" type="button" data-direction="-1" data-block-index="${blockIndex}" ${blockIndex === 0 ? "disabled" : ""}>↑</button>
          <button class="button secondary small-button move-template-block" type="button" data-direction="1" data-block-index="${blockIndex}" ${blockIndex === draft.blocks.length - 1 ? "disabled" : ""}>↓</button>
          <button class="text-button small-inline-action add-template-week" type="button" data-block-index="${blockIndex}" ${block.weeks.length >= 52 || totalWeeks >= 104 ? "disabled" : ""}>+ Add week</button>
          <button class="button secondary small-button duplicate-template-block" type="button" data-block-index="${blockIndex}" ${draft.blocks.length >= 12 || totalWeeks + block.weeks.length > 104 ? "disabled" : ""}>Duplicate block</button>
          ${draft.blocks.length > 1 ? `<button class="button danger small-button remove-template-block" type="button" data-block-index="${blockIndex}">Remove block</button>` : ""}
        </div>
      </div>

      <div class="template-block-settings">
        <label class="field">
          <span>Block name</span>
          <input value="${escapeHtml(block.name)}" maxlength="120" data-template-kind="block" data-block-index="${blockIndex}" data-field="name" />
        </label>
        <label class="field">
          <span>Block type</span>
          <select data-template-kind="block" data-block-index="${blockIndex}" data-field="block_type">
            <option value="general" ${block.block_type === "general" ? "selected" : ""}>General</option>
            <option value="volume" ${block.block_type === "volume" ? "selected" : ""}>Volume</option>
            <option value="strength" ${block.block_type === "strength" ? "selected" : ""}>Strength</option>
            <option value="peak" ${block.block_type === "peak" ? "selected" : ""}>Peak</option>
            <option value="deload" ${block.block_type === "deload" ? "selected" : ""}>Deload</option>
            <option value="custom" ${block.block_type === "custom" ? "selected" : ""}>Custom</option>
          </select>
        </label>
        <label class="field template-block-week-count-field">
          <span>Weeks in block</span>
          <input type="number" min="1" max="52" step="1" value="${block.weeks.length}" data-template-kind="block" data-block-index="${blockIndex}" data-field="week_count" />
        </label>
        <label class="field template-block-description-field">
          <span>Block description</span>
          <input value="${escapeHtml(block.description)}" maxlength="500" data-template-kind="block" data-block-index="${blockIndex}" data-field="description" placeholder="Optional factual purpose or phase label" />
        </label>
      </div>

      ${draft.event_plan && block.calendar_start_date
        ? `<div class="block-calendar-strip"><span>${escapeHtml(formatDate(block.calendar_start_date))}</span><span>→</span><span>${escapeHtml(formatDate(block.calendar_end_date))}</span><strong>${block.weeks.length} week${block.weeks.length === 1 ? "" : "s"}</strong></div>`
        : ""}
      <div class="template-weeks">
        ${block.weeks.map((week, weekIndex) => renderTemplateWeek(week, blockIndex, weekIndex, block.weeks.length)).join("")}
      </div>
    </article>
  `).join("");
}

function reindexTemplateDraft() {
  if (!state.templateDraft) return;

  state.templateDraft.blocks.forEach((block, blockIndex) => {
    block.order_index = blockIndex + 1;
    block.week_count = block.weeks.length;
    block.weeks.forEach((week, weekIndex) => {
      week.order_index = weekIndex + 1;
      week.sessions.forEach((session, sessionIndex) => {
        session.order_index = sessionIndex + 1;
        session.work_items.forEach((workItem, workItemIndex) => {
          workItem.order_index = workItemIndex + 1;
        });
      });
    });
  });
}

function rerenderTemplateBuilder() {
  reindexTemplateDraft();
  saveState();
  renderTemplateBlocks();
  updateTemplateFacts();
}

function openTemplateBuilder(draft) {
  state.templateDraft = normalisePersistedTemplateDraft(draft);
  elements.templateLibraryView.hidden = true;
  elements.templateBuilderView.hidden = false;
  elements.templateBuilderTitle.textContent = state.templateDraft.template_id
    ? `Edit ${state.templateDraft.template_name}`
    : "New programme";
  elements.templateName.value = state.templateDraft.template_name;
  elements.templateActivity.value = state.templateDraft.activity_id;
  elements.templateDescription.value = state.templateDraft.description;
  elements.activateTemplateButton.hidden = state.templateDraft.template_status !== "draft";
  rerenderTemplateBuilder();
}

function closeTemplateBuilder() {
  state.templateDraft = null;
  saveState();
  elements.templateBuilderView.hidden = true;
  elements.templateLibraryView.hidden = false;
  renderTemplateLibrary();
}

function syncTemplateHeader() {
  if (!state.templateDraft) return;
  state.templateDraft.template_name = elements.templateName.value;
  state.templateDraft.activity_id = elements.templateActivity.value;
  state.templateDraft.description = elements.templateDescription.value;
  if (state.templateDraft.event_plan) {
    ensureDraftEventPlan();
  }
  saveState();
}

function updateTemplateFieldFromControl(control) {
  const draft = state.templateDraft;
  if (!draft) return;

  const kind = control.dataset.templateKind;
  const blockIndex = Number(control.dataset.blockIndex);
  const weekIndex = Number(control.dataset.weekIndex);
  const sessionIndex = Number(control.dataset.sessionIndex);
  const workItemIndex = Number(control.dataset.workItemIndex);
  const field = control.dataset.field;
  let target;

  if (kind === "block") {
    target = draft.blocks[blockIndex];
  }
  else if (kind === "session") {
    target = draft.blocks[blockIndex]?.weeks[weekIndex]?.sessions[sessionIndex];
  }
  else if (kind === "work-item") {
    target = draft.blocks[blockIndex]?.weeks[weekIndex]?.sessions[sessionIndex]?.work_items[workItemIndex];
  }

  if (!target || !field) return;

  if (kind === "block" && field === "week_count") {
    resizeBlockWeeks(blockIndex, Number(control.value));
    rerenderTemplateBuilder();
    return;
  }

  target[field] = control.type === "number" ? Number(control.value) : control.value;
  if (kind === "block") {
    state.templateDraft.event_compile_summary = null;
  }

  if (kind === "work-item" && ["rep_mode", "load_mode"].includes(field)) {
    rerenderTemplateBuilder();
    return;
  }

  saveState();
}

function cloneTemplateNode(value) {
  const cloned = JSON.parse(JSON.stringify(value));
  const clearIds = (node) => {
    if (!node || typeof node !== "object") return;
    for (const key of ["block_id", "week_id", "session_id", "work_item_id"]) {
      if (key in node) node[key] = "";
    }
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) child.forEach(clearIds);
      else if (child && typeof child === "object") clearIds(child);
    }
  };
  clearIds(cloned);
  return cloned;
}

function addTemplateBlock() {
  if (
    !state.templateDraft ||
    state.templateDraft.blocks.length >= 12 ||
    templateCounts(state.templateDraft).weeks >= 104
  ) return;
  state.templateDraft.blocks.push(newTemplateBlock(state.templateDraft.blocks.length + 1));
  rerenderTemplateBuilder();
}

function removeTemplateBlock(blockIndex) {
  if (!state.templateDraft || state.templateDraft.blocks.length <= 1) return;
  state.templateDraft.blocks.splice(blockIndex, 1);
  rerenderTemplateBuilder();
}

function duplicateTemplateBlock(blockIndex) {
  if (!state.templateDraft || state.templateDraft.blocks.length >= 12) return;
  const source = state.templateDraft.blocks[blockIndex];
  if (
    !source ||
    templateCounts(state.templateDraft).weeks + source.weeks.length > 104
  ) return;
  const copy = cloneTemplateNode(source);
  copy.name = `${source.name} copy`;
  state.templateDraft.blocks.splice(blockIndex + 1, 0, copy);
  rerenderTemplateBuilder();
}

function moveArrayItem(list, index, direction) {
  const target = index + direction;
  if (target < 0 || target >= list.length) return;
  [list[index], list[target]] = [list[target], list[index]];
}

function moveTemplateBlock(blockIndex, direction) {
  if (!state.templateDraft) return;
  moveArrayItem(state.templateDraft.blocks, blockIndex, direction);
  rerenderTemplateBuilder();
}

function addTemplateWeek(blockIndex) {
  const block = state.templateDraft?.blocks[blockIndex];
  if (
    !block ||
    block.weeks.length >= 52 ||
    templateCounts(state.templateDraft).weeks >= 104
  ) return;
  resizeBlockWeeks(blockIndex, block.weeks.length + 1);
  rerenderTemplateBuilder();
}

function removeTemplateWeek(blockIndex, weekIndex) {
  const block = state.templateDraft?.blocks[blockIndex];
  if (!block || block.weeks.length <= 1) return;
  block.weeks.splice(weekIndex, 1);
  state.templateDraft.event_compile_summary = null;
  rerenderTemplateBuilder();
}

function duplicateTemplateWeek(blockIndex, weekIndex) {
  const block = state.templateDraft?.blocks[blockIndex];
  if (
    !block ||
    block.weeks.length >= 52 ||
    templateCounts(state.templateDraft).weeks >= 104
  ) return;
  const source = block.weeks[weekIndex];
  if (!source) return;
  block.weeks.splice(weekIndex + 1, 0, cloneTemplateNode(source));
  state.templateDraft.event_compile_summary = null;
  rerenderTemplateBuilder();
}

function moveTemplateWeek(blockIndex, weekIndex, direction) {
  const block = state.templateDraft?.blocks[blockIndex];
  if (!block) return;
  moveArrayItem(block.weeks, weekIndex, direction);
  rerenderTemplateBuilder();
}

function addTemplateSession(blockIndex, weekIndex) {
  const week = state.templateDraft?.blocks[blockIndex]?.weeks[weekIndex];
  if (!week || week.sessions.length >= 7) return;
  week.sessions.push(newTemplateSession(week.sessions.length + 1));
  rerenderTemplateBuilder();
}

function removeTemplateSession(blockIndex, weekIndex, sessionIndex) {
  const week = state.templateDraft?.blocks[blockIndex]?.weeks[weekIndex];
  if (!week || week.sessions.length <= 1) return;
  week.sessions.splice(sessionIndex, 1);
  rerenderTemplateBuilder();
}

function duplicateTemplateSession(blockIndex, weekIndex, sessionIndex) {
  const week = state.templateDraft?.blocks[blockIndex]?.weeks[weekIndex];
  if (!week || week.sessions.length >= 7) return;
  const source = week.sessions[sessionIndex];
  if (!source) return;
  const copy = cloneTemplateNode(source);
  copy.title = `${source.title} copy`;
  week.sessions.splice(sessionIndex + 1, 0, copy);
  rerenderTemplateBuilder();
}

function moveTemplateSession(blockIndex, weekIndex, sessionIndex, direction) {
  const week = state.templateDraft?.blocks[blockIndex]?.weeks[weekIndex];
  if (!week) return;
  moveArrayItem(week.sessions, sessionIndex, direction);
  rerenderTemplateBuilder();
}

function templatePayloadFromDraft() {
  const draft = state.templateDraft;
  if (!draft) throw new Error("No programme is open.");

  syncTemplateHeader();
  if (draft.event_plan) {
    syncTemplateEventFields();
  }
  reindexTemplateDraft();

  if (!draft.template_name.trim()) {
    throw new Error("Enter a programme name.");
  }

  return {
    coach_user_id: state.profile.coachUserId,
    template_id: draft.template_id,
    template_family_id: draft.template_family_id,
    template_version: Number(draft.template_version),
    template_name: draft.template_name.trim(),
    description: draft.description.trim(),
    activity_id: draft.activity_id,
    event_plan: draft.event_plan
      ? {
          event_plan_id: draft.event_plan.event_plan_id,
          event_name: draft.event_plan.event_name.trim(),
          event_type: draft.event_plan.event_type,
          event_date: draft.event_plan.event_date,
          programme_start_date: draft.event_plan.programme_start_date,
          location: draft.event_plan.location.trim(),
          timezone: draft.event_plan.timezone.trim(),
          notes: draft.event_plan.notes.trim()
        }
      : null,
    blocks: draft.blocks.map((block) => ({
      block_id: block.block_id,
      order_index: Number(block.order_index),
      name: block.name.trim(),
      description: block.description.trim(),
      block_type: block.block_type,
      week_count: block.weeks.length,
      weeks: block.weeks.map((week) => ({
        week_id: week.week_id,
        order_index: Number(week.order_index),
        sessions: week.sessions.map((session) => ({
          session_id: session.session_id,
          order_index: Number(session.order_index),
          title: session.title.trim(),
          work_items: session.work_items.map((workItem) => ({
            work_item_id: workItem.work_item_id,
            order_index: Number(workItem.order_index),
            exercise_id: workItem.exercise_id,
            planned_sets: Number(workItem.planned_sets),
            rep_mode: workItem.rep_mode,
            planned_reps: Number(workItem.planned_reps),
            rep_min: Number(workItem.rep_min),
            rep_max: Number(workItem.rep_max),
            load_mode: workItem.load_mode,
            percent_1rm: Number(workItem.percent_1rm),
            weight_value: Number(workItem.weight_value),
            weight_unit: workItem.weight_unit,
            rest_seconds: Number(workItem.rest_seconds),
            role: workItem.role
          }))
        }))
      }))
    })),
    updated_at_iso8601: nowIso()
  };
}

async function saveTemplateDraft(options = {}) {
  const payload = templatePayloadFromDraft();
  if (!options.quiet) showBusy("Saving programme draft…");

  try {
    const response = await api("POST", "/templates", payload);
    state.templateDraft = templateRecordToDraft(response.template);
    await refreshTemplates({ quiet: true });
    openTemplateBuilder(state.templateDraft);
    if (!options.quiet) showNotice("Programme draft saved.");
    return response.template;
  }
  finally {
    if (!options.quiet) hideBusy();
  }
}

async function activateTemplateById(templateId) {
  showBusy("Activating programme…");
  try {
    await api(
      "POST",
      `/templates/${encodeURIComponent(templateId)}/activate`,
      { coach_user_id: state.profile.coachUserId }
    );
    await refreshTemplates({ quiet: true });
    closeTemplateBuilder();
    showNotice("Programme activated and available for assignment.");
  }
  finally {
    hideBusy();
  }
}

async function activateOpenTemplate() {
  if (!state.templateDraft) return;
  let templateId = state.templateDraft.template_id;
  const saved = await saveTemplateDraft({ quiet: true });
  templateId = String(saved.template_id ?? templateId);
  await activateTemplateById(templateId);
}

async function duplicateTemplate(templateId) {
  showBusy("Creating new programme version…");
  try {
    const response = await api(
      "POST",
      `/templates/${encodeURIComponent(templateId)}/duplicate`,
      { coach_user_id: state.profile.coachUserId }
    );
    await refreshTemplates({ quiet: true });
    openTemplateBuilder(templateRecordToDraft(response.template));
    showNotice("New draft programme version created.");
  }
  finally {
    hideBusy();
  }
}

async function archiveTemplate(templateId) {
  showBusy("Archiving programme…");
  try {
    await api(
      "POST",
      `/templates/${encodeURIComponent(templateId)}/archive`,
      { coach_user_id: state.profile.coachUserId }
    );
    await refreshTemplates({ quiet: true });
    showNotice("Programme archived. Existing assignments retain this version.");
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
    try {
      await Promise.all([
        loadTemplateExercises(),
        refreshTemplates({ quiet: true }),
        refreshCoachAthletes({ quiet: true }),
        refreshCoachAssignments({ quiet: true })
      ]);

      await refreshCoachAthleteProfiles();
    }
    catch (error) {
      showNotice(error.message, "error");
    }

    renderCoachWorkspace();
    renderTemplateLibrary();
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

elements.newTemplateButton.addEventListener("click", () => {
  loadTemplateExercises()
    .then(() => openTemplateBuilder(newTemplateDraft()))
    .catch(handleError);
});

elements.refreshTemplatesButton.addEventListener("click", () => {
  refreshTemplates().catch(handleError);
});

elements.backToTemplatesButton.addEventListener("click", closeTemplateBuilder);

elements.saveTemplateButton.addEventListener("click", () => {
  saveTemplateDraft().catch(handleError);
});

elements.activateTemplateButton.addEventListener("click", () => {
  activateOpenTemplate().catch(handleError);
});

elements.addTemplateBlockButton.addEventListener("click", addTemplateBlock);

for (const control of [
  elements.templateName,
  elements.templateActivity,
  elements.templateDescription
]) {
  control.addEventListener("input", syncTemplateHeader);
  control.addEventListener("change", syncTemplateHeader);
}

elements.templateActivity.addEventListener("change", () => {
  if (state.templateDraft?.event_plan) {
    ensureDraftEventPlan();
    state.templateDraft.event_compile_summary = null;
    rerenderTemplateBuilder();
  }
});

elements.templateEventEnabled.addEventListener("change", () => {
  if (!state.templateDraft) return;

  if (elements.templateEventEnabled.checked) {
    ensureDraftEventPlan();
  }
  else {
    state.templateDraft.event_plan = null;
    state.templateDraft.event_compile_summary = null;
    for (const block of state.templateDraft.blocks) {
      block.calendar_start_date = "";
      block.calendar_end_date = "";
    }
  }

  rerenderTemplateBuilder();
});

for (const control of [
  elements.templateEventName,
  elements.templateEventType,
  elements.templateProgrammeStartDate,
  elements.templateEventDate,
  elements.templateEventLocation,
  elements.templateEventTimezone,
  elements.templateEventNotes
]) {
  const updateEventCompiler = () => {
    syncTemplateEventFields();
    renderTemplateBlocks();
    updateTemplateFacts();
  };

  control.addEventListener("input", updateEventCompiler);
  control.addEventListener("change", updateEventCompiler);
}

elements.compileEventCalendarButton.addEventListener("click", () => {
  previewEventCalendar().catch(handleError);
});

elements.fitFinalBlockButton.addEventListener("click", () => {
  try {
    fitFinalBlockToEvent();
  }
  catch (error) {
    handleError(error);
  }
});

elements.templateBlocks.addEventListener("input", (event) => {
  const control = event.target.closest("[data-template-kind]");
  if (control) updateTemplateFieldFromControl(control);
});

elements.templateBlocks.addEventListener("change", (event) => {
  const control = event.target.closest("[data-template-kind]");
  if (control) updateTemplateFieldFromControl(control);
});

elements.templateBlocks.addEventListener("click", (event) => {
  const action = event.target.closest("button");
  if (!action) return;

  const blockIndex = Number(action.dataset.blockIndex);
  const weekIndex = Number(action.dataset.weekIndex);
  const sessionIndex = Number(action.dataset.sessionIndex);
  const direction = Number(action.dataset.direction);

  if (action.classList.contains("add-template-session")) {
    addTemplateSession(blockIndex, weekIndex);
  }
  else if (action.classList.contains("remove-template-session")) {
    removeTemplateSession(blockIndex, weekIndex, sessionIndex);
  }
  else if (action.classList.contains("duplicate-template-session")) {
    duplicateTemplateSession(blockIndex, weekIndex, sessionIndex);
  }
  else if (action.classList.contains("move-template-session")) {
    moveTemplateSession(blockIndex, weekIndex, sessionIndex, direction);
  }
  else if (action.classList.contains("add-template-week")) {
    addTemplateWeek(blockIndex);
  }
  else if (action.classList.contains("remove-template-week")) {
    removeTemplateWeek(blockIndex, weekIndex);
  }
  else if (action.classList.contains("duplicate-template-week")) {
    duplicateTemplateWeek(blockIndex, weekIndex);
  }
  else if (action.classList.contains("move-template-week")) {
    moveTemplateWeek(blockIndex, weekIndex, direction);
  }
  else if (action.classList.contains("remove-template-block")) {
    removeTemplateBlock(blockIndex);
  }
  else if (action.classList.contains("duplicate-template-block")) {
    duplicateTemplateBlock(blockIndex);
  }
  else if (action.classList.contains("move-template-block")) {
    moveTemplateBlock(blockIndex, direction);
  }
});

elements.closeAthleteProfileButton.addEventListener("click", closeAthleteProfile);
elements.addAthleteBenchmarkButton.addEventListener("click", addAthleteBenchmark);
elements.athleteProfileForm.addEventListener("submit", (event) => {
  saveOpenAthleteProfile(event).catch(handleError);
});

for (const control of [
  elements.athletePreferredUnit,
  elements.athleteRoundingIncrement,
  elements.athleteBodyweight,
  elements.athleteBodyweightUnit
]) {
  control.addEventListener("input", syncAthleteProfileHeader);
  control.addEventListener("change", syncAthleteProfileHeader);
}

elements.athleteBenchmarkList.addEventListener("input", (event) => {
  const control = event.target.closest("[data-profile-field]");
  if (control) updateAthleteBenchmarkControl(control);
});

elements.athleteBenchmarkList.addEventListener("change", (event) => {
  const control = event.target.closest("[data-profile-field]");
  if (control) updateAthleteBenchmarkControl(control);
});

elements.athleteBenchmarkList.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-athlete-benchmark");
  if (button) removeAthleteBenchmark(Number(button.dataset.benchmarkIndex));
});

elements.assignmentAthlete.addEventListener("change", () => {
  renderAssignmentTemplateOptions();
  refreshAssignmentAthleteProfile().catch(handleError);
});
elements.assignmentTemplate.addEventListener("change", renderAssignmentRequirements);
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
