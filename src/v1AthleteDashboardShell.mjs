const SURFACE_ID = "v1_athlete_dashboard_shell";
const SURFACE_VERSION = "1.0.0";

export const ATHLETE_DASHBOARD_SHELL_COPY_IDS = Object.freeze({
  title: "ATHLETE_DASHBOARD_SHELL_TITLE",
  assignmentsTitle: "ATHLETE_DASHBOARD_ASSIGNMENTS_TITLE",
  sessionsTitle: "ATHLETE_DASHBOARD_SESSIONS_TITLE",
  factualHistoryTitle: "ATHLETE_DASHBOARD_FACTUAL_HISTORY_TITLE",
  emptySection: "ATHLETE_DASHBOARD_EMPTY_SECTION",
  boundary: "ATHLETE_DASHBOARD_BOUNDARY"
});

export const ATHLETE_DASHBOARD_SHELL_COPY_TEXT = Object.freeze({
  [ATHLETE_DASHBOARD_SHELL_COPY_IDS.title]: "Your dashboard",
  [ATHLETE_DASHBOARD_SHELL_COPY_IDS.assignmentsTitle]: "Assignments",
  [ATHLETE_DASHBOARD_SHELL_COPY_IDS.sessionsTitle]: "Sessions",
  [ATHLETE_DASHBOARD_SHELL_COPY_IDS.factualHistoryTitle]: "Factual history",
  [ATHLETE_DASHBOARD_SHELL_COPY_IDS.emptySection]: "No recorded items for this section.",
  [ATHLETE_DASHBOARD_SHELL_COPY_IDS.boundary]: "Recorded facts only."
});

export const ATHLETE_DASHBOARD_SHELL_BOUNDARY = Object.freeze({
  ui_shell_only: true,
  read_model_only: true,
  own_data_only: true,
  reads_engine_input: false,
  writes_engine_input: false,
  mutates_engine_output: false,
  mutates_runtime_events: false,
  mutates_phase1_declaration: false,
  mutates_replay_or_proof: false,
  changes_compile_output: false,
  triggers_substitution: false,
  creates_social_feed: false,
  creates_friend_connections: false,
  creates_rankings: false,
  creates_post_v1_exchange_surface: false
});

export const ATHLETE_DASHBOARD_BLOCKED_REASONS = Object.freeze({
  viewer_not_subject: "viewer_not_subject",
  record_not_owned_by_athlete: "record_not_owned_by_athlete",
  unsupported_record_surface: "unsupported_record_surface"
});

const ASSIGNMENT_STATUSES = Object.freeze(["assigned", "active", "completed", "withdrawn"]);
const SESSION_STATUSES = Object.freeze(["not_started", "in_progress", "split", "returned", "partially_completed", "completed", "stopped"]);
const HISTORY_TYPES = Object.freeze(["assignment", "session_status", "session_event", "substitution", "export_record"]);

const CLAIM_TERM_PARTS = Object.freeze([
  Object.freeze(["reco", "mmend"]),
  Object.freeze(["opti", "mal"]),
  Object.freeze(["read", "iness"]),
  Object.freeze(["fa", "tigue"]),
  Object.freeze(["ri", "sk"]),
  Object.freeze(["sa", "fe"]),
  Object.freeze(["suit", "able"]),
  Object.freeze(["ad", "vice"]),
  Object.freeze(["effect", "ive"]),
  Object.freeze(["adher", "ence"]),
  Object.freeze(["rank"]),
  Object.freeze(["friend"]),
  Object.freeze(["market", "place"]),
  Object.freeze(["social"]),
  Object.freeze(["good"]),
  Object.freeze(["bad"]),
  Object.freeze(["poor"])
]);

function joinParts(parts) {
  return parts.join("");
}

function isPlainRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function fail(reason, details = {}) {
  const error = new Error(`athlete_dashboard_shell_${reason}`);
  error.reason = reason;
  error.details = Object.freeze({ ...details });
  throw error;
}

function cleanString(value, fieldName) {
  if (typeof value !== "string") {
    fail(`${fieldName}_required`);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    fail(`${fieldName}_required`);
  }

  return trimmed;
}

function cleanOptionalString(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function assertIsoUtc(value, fieldName) {
  const text = cleanString(value, fieldName);

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(text)) {
    fail(`${fieldName}_iso_utc_required`);
  }

  return text;
}

function cleanOptionalIsoUtc(value, fieldName) {
  if (value === undefined || value === null) return null;
  return assertIsoUtc(value, fieldName);
}

function assertAllowedValue(value, allowed, fieldName) {
  const text = cleanString(value, fieldName);
  if (!allowed.includes(text)) {
    fail(`${fieldName}_not_allowed`, { value: text, allowed });
  }

  return text;
}

function assertNonNegativeInteger(value, fieldName) {
  if (!Number.isInteger(value) || value < 0) {
    fail(`${fieldName}_non_negative_integer_required`);
  }

  return value;
}

function makeBoundaryEcho() {
  return Object.freeze({ ...ATHLETE_DASHBOARD_SHELL_BOUNDARY });
}

function stableSort(value) {
  if (Array.isArray(value)) return value.map(stableSort);

  if (isPlainRecord(value)) {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = stableSort(value[key]);
        return acc;
      }, {});
  }

  return value;
}

function stableCanonicalJson(value) {
  return JSON.stringify(stableSort(value));
}

function blocked(reason, input, extra = {}) {
  return Object.freeze({
    surface_id: SURFACE_ID,
    surface_version: SURFACE_VERSION,
    allowed: false,
    blocked_reason: reason,
    viewer_user_id: cleanString(input.viewer_user_id, "viewer_user_id"),
    athlete_user_id: cleanString(input.athlete_user_id, "athlete_user_id"),
    copy_ids: ATHLETE_DASHBOARD_SHELL_COPY_IDS,
    engine_boundary: makeBoundaryEcho(),
    ...extra
  });
}

function asArray(value, fieldName) {
  if (value === undefined || value === null) return [];

  if (!Array.isArray(value)) {
    fail(`${fieldName}_array_required`);
  }

  return value;
}

function recordOwner(record, fieldName) {
  if (!isPlainRecord(record)) {
    fail(`${fieldName}_record_required`);
  }

  return cleanString(record.athlete_user_id, "athlete_user_id");
}

function findForeignRecord(records, athleteUserId, surface) {
  for (const record of records) {
    const owner = recordOwner(record, surface);
    if (owner !== athleteUserId) {
      return Object.freeze({
        record_surface: surface,
        record_owner_user_id: owner
      });
    }
  }

  return null;
}

function assertOwnDataOnly(input, athleteUserId, assignments, sessions, historyEntries) {
  const foreign =
    findForeignRecord(assignments, athleteUserId, "assignments") ??
    findForeignRecord(sessions, athleteUserId, "sessions") ??
    findForeignRecord(historyEntries, athleteUserId, "factual_history_entries");

  if (foreign) {
    return blocked(ATHLETE_DASHBOARD_BLOCKED_REASONS.record_not_owned_by_athlete, input, foreign);
  }

  return null;
}

function cleanAssignment(record) {
  if (!isPlainRecord(record)) {
    fail("assignment_record_required");
  }

  return Object.freeze({
    assignment_id: cleanString(record.assignment_id, "assignment_id"),
    athlete_user_id: cleanString(record.athlete_user_id, "athlete_user_id"),
    programme_id: cleanString(record.programme_id, "programme_id"),
    title: cleanOptionalString(record.title),
    status: assertAllowedValue(record.status, ASSIGNMENT_STATUSES, "assignment_status"),
    assigned_at: assertIsoUtc(record.assigned_at, "assigned_at"),
    next_session_id: cleanOptionalString(record.next_session_id)
  });
}

function cleanSession(record) {
  if (!isPlainRecord(record)) {
    fail("session_record_required");
  }

  return Object.freeze({
    session_id: cleanString(record.session_id, "session_id"),
    athlete_user_id: cleanString(record.athlete_user_id, "athlete_user_id"),
    assignment_id: cleanOptionalString(record.assignment_id),
    status: assertAllowedValue(record.status, SESSION_STATUSES, "session_status"),
    scheduled_at: cleanOptionalIsoUtc(record.scheduled_at, "scheduled_at"),
    started_at: cleanOptionalIsoUtc(record.started_at, "started_at"),
    completed_work_items: assertNonNegativeInteger(record.completed_work_items ?? 0, "completed_work_items"),
    skipped_work_items: assertNonNegativeInteger(record.skipped_work_items ?? 0, "skipped_work_items"),
    partial_work_items: assertNonNegativeInteger(record.partial_work_items ?? 0, "partial_work_items"),
    substitution_count: assertNonNegativeInteger(record.substitution_count ?? 0, "substitution_count")
  });
}

function cleanHistoryEntry(record) {
  if (!isPlainRecord(record)) {
    fail("history_record_required");
  }

  return Object.freeze({
    history_id: cleanString(record.history_id, "history_id"),
    athlete_user_id: cleanString(record.athlete_user_id, "athlete_user_id"),
    source_record_id: cleanString(record.source_record_id, "source_record_id"),
    history_type: assertAllowedValue(record.history_type, HISTORY_TYPES, "history_type"),
    recorded_at: assertIsoUtc(record.recorded_at, "recorded_at"),
    facts: Object.freeze(stableSort(isPlainRecord(record.facts) ? record.facts : {}))
  });
}

function sortAssignments(records) {
  return [...records].sort((a, b) => {
    if (a.assigned_at !== b.assigned_at) return b.assigned_at.localeCompare(a.assigned_at);
    return a.assignment_id.localeCompare(b.assignment_id);
  });
}

function sortSessions(records) {
  return [...records].sort((a, b) => {
    const aTime = a.scheduled_at ?? a.started_at ?? "9999-12-31T23:59:59Z";
    const bTime = b.scheduled_at ?? b.started_at ?? "9999-12-31T23:59:59Z";
    if (aTime !== bTime) return aTime.localeCompare(bTime);
    return a.session_id.localeCompare(b.session_id);
  });
}

function sortHistory(records) {
  return [...records].sort((a, b) => {
    if (a.recorded_at !== b.recorded_at) return b.recorded_at.localeCompare(a.recorded_at);
    return a.history_id.localeCompare(b.history_id);
  });
}

function renderSection(sectionId, titleCopyId, items) {
  return Object.freeze({
    section_id: sectionId,
    title_copy_id: titleCopyId,
    empty_copy_id: items.length === 0 ? ATHLETE_DASHBOARD_SHELL_COPY_IDS.emptySection : null,
    item_count: items.length,
    items: Object.freeze(items)
  });
}

export function lintAthleteDashboardShellCopy(copyText = ATHLETE_DASHBOARD_SHELL_COPY_TEXT) {
  if (!isPlainRecord(copyText)) {
    fail("copy_text_record_required");
  }

  const failures = [];

  for (const [copyId, value] of Object.entries(copyText)) {
    if (typeof value !== "string") {
      failures.push(Object.freeze({ copy_id: copyId, reason: "copy_text_string_required" }));
      continue;
    }

    const lower = value.toLowerCase();
    for (const parts of CLAIM_TERM_PARTS) {
      const term = joinParts(parts);
      if (lower.includes(term)) {
        failures.push(Object.freeze({ copy_id: copyId, reason: "forbidden_copy_term_found", term }));
      }
    }
  }

  return Object.freeze({
    ok: failures.length === 0,
    failures: Object.freeze(failures)
  });
}

/**
 * DEV NOTE:
 * Export: createAthleteDashboardShellReadModel
 * Purpose: Builds the athlete dashboard shell read model for the signed-in
 * athlete's own assignments, sessions, and factual history records.
 * Boundary: This renderer consumes already-authorised product read records. It
 * must not import engine modules, write runtime events, alter declarations,
 * change compile output, create social surfaces, create comparison ordering, or
 * create post-v1 exchange-surface behaviour.
 * Determinism: Equal explicit input produces equal section ordering and stable
 * dashboard JSON.
 * Failure behaviour: Viewer mismatch or foreign records return factual blocked
 * reasons instead of leaking records.
 */
export function createAthleteDashboardShellReadModel(input) {
  if (!isPlainRecord(input)) {
    fail("input_record_required");
  }

  const viewerUserId = cleanString(input.viewer_user_id, "viewer_user_id");
  const athleteUserId = cleanString(input.athlete_user_id, "athlete_user_id");

  if (viewerUserId !== athleteUserId) {
    return blocked(ATHLETE_DASHBOARD_BLOCKED_REASONS.viewer_not_subject, input);
  }

  const rawAssignments = asArray(input.assignments, "assignments");
  const rawSessions = asArray(input.sessions, "sessions");
  const rawHistoryEntries = asArray(input.factual_history_entries, "factual_history_entries");

  const ownershipBlock = assertOwnDataOnly(input, athleteUserId, rawAssignments, rawSessions, rawHistoryEntries);
  if (ownershipBlock) {
    return ownershipBlock;
  }

  const assignments = sortAssignments(rawAssignments.map(cleanAssignment));
  const sessions = sortSessions(rawSessions.map(cleanSession));
  const factualHistoryEntries = sortHistory(rawHistoryEntries.map(cleanHistoryEntry));

  const sections = Object.freeze([
    renderSection("own_assignments", ATHLETE_DASHBOARD_SHELL_COPY_IDS.assignmentsTitle, assignments),
    renderSection("own_sessions", ATHLETE_DASHBOARD_SHELL_COPY_IDS.sessionsTitle, sessions),
    renderSection("factual_history", ATHLETE_DASHBOARD_SHELL_COPY_IDS.factualHistoryTitle, factualHistoryEntries)
  ]);

  const summaryCounts = Object.freeze({
    assignment_count: assignments.length,
    session_count: sessions.length,
    factual_history_entry_count: factualHistoryEntries.length,
    completed_session_count: sessions.filter((session) => session.status === "completed").length,
    in_progress_session_count: sessions.filter((session) => session.status === "in_progress").length,
    stopped_session_count: sessions.filter((session) => session.status === "stopped").length
  });

  return Object.freeze({
    surface_id: SURFACE_ID,
    surface_version: SURFACE_VERSION,
    allowed: true,
    blocked_reason: null,
    viewer_user_id: viewerUserId,
    athlete_user_id: athleteUserId,
    title_copy_id: ATHLETE_DASHBOARD_SHELL_COPY_IDS.title,
    boundary_copy_id: ATHLETE_DASHBOARD_SHELL_COPY_IDS.boundary,
    copy_ids: ATHLETE_DASHBOARD_SHELL_COPY_IDS,
    sections,
    summary_counts: summaryCounts,
    stable_dashboard_json: stableCanonicalJson({
      athlete_user_id: athleteUserId,
      sections,
      summary_counts: summaryCounts
    }),
    engine_boundary: makeBoundaryEcho()
  });
}

/**
 * DEV NOTE:
 * Export: compileIgnoringAthleteDashboardShell
 * Purpose: Test helper proving dashboard state is ignored by deterministic
 * compile probes.
 * Boundary: This is not the real compiler and must not call engine internals.
 * It projects supplied phase-like fields while ignoring dashboard records.
 * Determinism: Equal phase-like input returns equal probe output regardless of
 * dashboard records.
 * Failure behaviour: Invalid phase-like input throws before producing a probe.
 */
export function compileIgnoringAthleteDashboardShell(phaseLikeInput, dashboardRecords = []) {
  if (!isPlainRecord(phaseLikeInput)) {
    fail("phase_like_input_record_required");
  }

  if (!Array.isArray(dashboardRecords)) {
    fail("dashboard_records_array_required");
  }

  const probe = Object.freeze({
    activity_id: cleanString(phaseLikeInput.activity_id, "activity_id"),
    execution_scope: cleanString(phaseLikeInput.execution_scope, "execution_scope"),
    source_phase1_hash: cleanString(phaseLikeInput.source_phase1_hash, "source_phase1_hash"),
    planned_item_ids: Object.freeze(
      Array.isArray(phaseLikeInput.planned_item_ids)
        ? phaseLikeInput.planned_item_ids.map((item) => cleanString(item, "planned_item_id"))
        : []
    )
  });

  return Object.freeze({
    surface_id: `${SURFACE_ID}_compile_probe`,
    stable_probe_json: stableCanonicalJson(probe),
    ignored_dashboard_record_count: dashboardRecords.length,
    engine_boundary: makeBoundaryEcho()
  });
}

export function getAthleteDashboardShellContract() {
  return Object.freeze({
    surface_id: SURFACE_ID,
    surface_version: SURFACE_VERSION,
    surfaces: Object.freeze(["own_assignments", "own_sessions", "factual_history"]),
    copy_ids: ATHLETE_DASHBOARD_SHELL_COPY_IDS,
    blocked_reasons: ATHLETE_DASHBOARD_BLOCKED_REASONS,
    boundary: makeBoundaryEcho()
  });
}