const POLICY_ID = "v1_controlled_launch_retention_access_window_policy";
const POLICY_VERSION = "1.0.0";

export const RETENTION_ACCESS_WINDOW_POLICY_BOUNDARY = Object.freeze({
  product_policy_only: true,
  reads_engine_input: false,
  writes_engine_input: false,
  mutates_engine_output: false,
  mutates_runtime_events: false,
  mutates_phase1_declaration: false,
  mutates_replay_or_proof: false,
  changes_compile_output: false,
  triggers_substitution: false,
  creates_enterprise_retention: false,
  creates_organisation_export: false,
  creates_broad_legal_overhaul: false
});

export const RETENTION_ACCESS_WINDOW_SURFACES = Object.freeze([
  "product_access",
  "coach_assigned_view",
  "source_bound_export"
]);

export const RETENTION_ACCESS_WINDOW_BLOCKED_REASONS = Object.freeze({
  accessRecordNotActive: "access_record_not_active",
  accessWindowClosed: "access_window_closed",
  relationshipNotAccepted: "relationship_not_accepted",
  relationshipScopeInvalid: "relationship_scope_invalid",
  coachNotAssigned: "coach_not_assigned",
  sourceBoundExportRequired: "source_bound_export_required",
  ownDataExportOnly: "own_data_export_only",
  broadExportScopeRefused: "broad_export_scope_refused",
  unsupportedSurface: "unsupported_surface",
  forbiddenBroadScopeField: "forbidden_broad_scope_field"
});

const PRODUCT_ACCESS_STATES = Object.freeze(["active", "inactive", "ended"]);
const RELATIONSHIP_STATES = Object.freeze(["accepted", "pending", "revoked", "expired"]);
const RELATIONSHIP_SCOPES = Object.freeze(["individual"]);
const EXPORT_SCOPES = Object.freeze(["own_user_data"]);

const BROAD_SCOPE_KEYS = Object.freeze([
  "enterprise_retention_days",
  "enterprise_policy_id",
  "organisation_id",
  "organization_id",
  "organisation_export",
  "organization_export",
  "organisation_export_scope",
  "organization_export_scope",
  "team_id",
  "team_export",
  "unit_id",
  "unit_export",
  "federation_id",
  "federation_export",
  "data_warehouse_export",
  "research_package_export",
  "bulk_export",
  "broad_legal_overhaul"
]);

function isPlainRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function fail(reason, details = {}) {
  const error = new Error(`retention_access_window_policy_${reason}`);
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

function assertAllowedValue(value, allowed, fieldName) {
  const text = cleanString(value, fieldName);
  if (!allowed.includes(text)) {
    fail(`${fieldName}_not_allowed`, { value: text, allowed });
  }

  return text;
}

function makeBoundaryEcho() {
  return Object.freeze({ ...RETENTION_ACCESS_WINDOW_POLICY_BOUNDARY });
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

function collectForbiddenBroadScopeFields(value, pathParts = []) {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectForbiddenBroadScopeFields(item, [...pathParts, String(index)]));
  }

  if (!isPlainRecord(value)) {
    return [];
  }

  const failures = [];

  for (const [key, nestedValue] of Object.entries(value)) {
    const fullPath = [...pathParts, key].join(".");
    if (BROAD_SCOPE_KEYS.includes(key)) {
      failures.push(Object.freeze({ path: fullPath, key }));
    }

    failures.push(...collectForbiddenBroadScopeFields(nestedValue, [...pathParts, key]));
  }

  return failures;
}

function assertNoForbiddenBroadScopeFields(input) {
  const failures = collectForbiddenBroadScopeFields(input);
  if (failures.length > 0) {
    fail(RETENTION_ACCESS_WINDOW_BLOCKED_REASONS.forbiddenBroadScopeField, { failures });
  }
}

function inInclusiveExclusiveWindow(requestedAt, startsAt, endsAt) {
  const requested = Date.parse(requestedAt);
  const starts = Date.parse(startsAt);
  const ends = Date.parse(endsAt);

  if (ends <= starts) {
    fail("access_window_invalid");
  }

  return requested >= starts && requested < ends;
}

function cleanAccessRecord(input) {
  if (!isPlainRecord(input.access_record)) {
    fail("access_record_required");
  }

  return Object.freeze({
    access_record_id: cleanString(input.access_record.access_record_id, "access_record_id"),
    state: assertAllowedValue(input.access_record.state, PRODUCT_ACCESS_STATES, "access_state"),
    access_starts_at: assertIsoUtc(input.access_record.access_starts_at, "access_starts_at"),
    access_ends_at: assertIsoUtc(input.access_record.access_ends_at, "access_ends_at"),
    source: cleanOptionalString(input.access_record.source) ?? "controlled_launch"
  });
}

function cleanRelationshipRecord(input) {
  if (input.relationship_record === undefined || input.relationship_record === null) {
    return null;
  }

  if (!isPlainRecord(input.relationship_record)) {
    fail("relationship_record_required");
  }

  return Object.freeze({
    relationship_id: cleanString(input.relationship_record.relationship_id, "relationship_id"),
    state: assertAllowedValue(input.relationship_record.state, RELATIONSHIP_STATES, "relationship_state"),
    relationship_scope: assertAllowedValue(input.relationship_record.relationship_scope, RELATIONSHIP_SCOPES, "relationship_scope"),
    coach_user_id: cleanString(input.relationship_record.coach_user_id, "coach_user_id"),
    athlete_user_id: cleanString(input.relationship_record.athlete_user_id, "athlete_user_id")
  });
}

function cleanRequest(input) {
  if (!isPlainRecord(input.request)) {
    fail("request_required");
  }

  return Object.freeze({
    surface: assertAllowedValue(input.request.surface, RETENTION_ACCESS_WINDOW_SURFACES, "request_surface"),
    requested_at: assertIsoUtc(input.request.requested_at, "requested_at"),
    source_bound: input.request.source_bound === true,
    export_scope: cleanOptionalString(input.request.export_scope)
  });
}

function blocked(reason, input, extra = {}) {
  return Object.freeze({
    policy_id: POLICY_ID,
    policy_version: POLICY_VERSION,
    allowed: false,
    blocked_reason: reason,
    requester_user_id: cleanString(input.requester_user_id, "requester_user_id"),
    subject_user_id: cleanString(input.subject_user_id, "subject_user_id"),
    request_surface: cleanRequest(input).surface,
    engine_boundary: makeBoundaryEcho(),
    ...extra
  });
}

function allowed(input, extra = {}) {
  const request = cleanRequest(input);
  return Object.freeze({
    policy_id: POLICY_ID,
    policy_version: POLICY_VERSION,
    allowed: true,
    blocked_reason: null,
    requester_user_id: cleanString(input.requester_user_id, "requester_user_id"),
    subject_user_id: cleanString(input.subject_user_id, "subject_user_id"),
    request_surface: request.surface,
    requested_at: request.requested_at,
    engine_boundary: makeBoundaryEcho(),
    ...extra
  });
}

function evaluateProductAccess(input, accessRecord, request) {
  if (accessRecord.state !== "active") {
    return blocked(RETENTION_ACCESS_WINDOW_BLOCKED_REASONS.accessRecordNotActive, input, {
      access_record_id: accessRecord.access_record_id,
      access_state: accessRecord.state
    });
  }

  if (!inInclusiveExclusiveWindow(request.requested_at, accessRecord.access_starts_at, accessRecord.access_ends_at)) {
    return blocked(RETENTION_ACCESS_WINDOW_BLOCKED_REASONS.accessWindowClosed, input, {
      access_record_id: accessRecord.access_record_id,
      access_state: accessRecord.state,
      access_starts_at: accessRecord.access_starts_at,
      access_ends_at: accessRecord.access_ends_at
    });
  }

  return allowed(input, {
    access_record_id: accessRecord.access_record_id,
    access_window_kind: "active_product_access",
    access_starts_at: accessRecord.access_starts_at,
    access_ends_at: accessRecord.access_ends_at
  });
}

function evaluateCoachAssignedView(input, accessRecord, request, relationshipRecord) {
  const baseAccess = evaluateProductAccess(input, accessRecord, request);
  if (!baseAccess.allowed) {
    return baseAccess;
  }

  if (!relationshipRecord) {
    return blocked(RETENTION_ACCESS_WINDOW_BLOCKED_REASONS.relationshipNotAccepted, input);
  }

  if (relationshipRecord.state !== "accepted") {
    return blocked(RETENTION_ACCESS_WINDOW_BLOCKED_REASONS.relationshipNotAccepted, input, {
      relationship_id: relationshipRecord.relationship_id,
      relationship_state: relationshipRecord.state
    });
  }

  if (relationshipRecord.relationship_scope !== "individual") {
    return blocked(RETENTION_ACCESS_WINDOW_BLOCKED_REASONS.relationshipScopeInvalid, input, {
      relationship_id: relationshipRecord.relationship_id,
      relationship_scope: relationshipRecord.relationship_scope
    });
  }

  const requesterUserId = cleanString(input.requester_user_id, "requester_user_id");
  const subjectUserId = cleanString(input.subject_user_id, "subject_user_id");

  if (relationshipRecord.coach_user_id !== requesterUserId || relationshipRecord.athlete_user_id !== subjectUserId) {
    return blocked(RETENTION_ACCESS_WINDOW_BLOCKED_REASONS.coachNotAssigned, input, {
      relationship_id: relationshipRecord.relationship_id
    });
  }

  return allowed(input, {
    access_record_id: accessRecord.access_record_id,
    access_window_kind: "assigned_coach_product_view",
    relationship_id: relationshipRecord.relationship_id,
    relationship_state: relationshipRecord.state
  });
}

function evaluateSourceBoundExport(input, request) {
  const requesterUserId = cleanString(input.requester_user_id, "requester_user_id");
  const subjectUserId = cleanString(input.subject_user_id, "subject_user_id");

  if (request.source_bound !== true) {
    return blocked(RETENTION_ACCESS_WINDOW_BLOCKED_REASONS.sourceBoundExportRequired, input);
  }

  if (requesterUserId !== subjectUserId) {
    return blocked(RETENTION_ACCESS_WINDOW_BLOCKED_REASONS.ownDataExportOnly, input);
  }

  if (!EXPORT_SCOPES.includes(request.export_scope)) {
    return blocked(RETENTION_ACCESS_WINDOW_BLOCKED_REASONS.broadExportScopeRefused, input, {
      export_scope: request.export_scope
    });
  }

  return allowed(input, {
    access_window_kind: "source_bound_own_data_export",
    export_scope: request.export_scope,
    source_bound: true
  });
}

/**
 * DEV NOTE:
 * Export: evaluateRetentionAccessWindowPolicy
 * Purpose: Evaluates controlled-launch product access windows and source-bound
 * own-data export requests from explicit product-layer records.
 * Boundary: This policy reads product access, relationship, and export request
 * metadata only. It must not import engine modules, mutate engine input or
 * output, append runtime events, alter replay/proof records, trigger
 * substitution, or create organisation/export/enterprise retention authority.
 * Determinism: Equal explicit input produces equal verdict payloads.
 * Failure behaviour: Invalid structure throws a typed product-policy error;
 * denied access returns a factual blocked_reason.
 */
export function evaluateRetentionAccessWindowPolicy(input) {
  if (!isPlainRecord(input)) {
    fail("input_record_required");
  }

  assertNoForbiddenBroadScopeFields(input);

  cleanString(input.requester_user_id, "requester_user_id");
  cleanString(input.subject_user_id, "subject_user_id");

  const request = cleanRequest(input);

  if (request.surface === "source_bound_export") {
    return evaluateSourceBoundExport(input, request);
  }

  const accessRecord = cleanAccessRecord(input);

  if (request.surface === "product_access") {
    return evaluateProductAccess(input, accessRecord, request);
  }

  if (request.surface === "coach_assigned_view") {
    const relationshipRecord = cleanRelationshipRecord(input);
    return evaluateCoachAssignedView(input, accessRecord, request, relationshipRecord);
  }

  return blocked(RETENTION_ACCESS_WINDOW_BLOCKED_REASONS.unsupportedSurface, input);
}

/**
 * DEV NOTE:
 * Export: createRetentionAccessWindowPolicyRecord
 * Purpose: Creates a stable product-policy record suitable for audit and UI
 * display after an explicit access-window evaluation.
 * Boundary: The record is not engine input, not engine output, not replay truth,
 * not proof truth, and not legal-document authority.
 * Determinism: Equal verdict input produces a byte-stable policy record.
 * Failure behaviour: Non-verdict input throws before returning a record.
 */
export function createRetentionAccessWindowPolicyRecord(verdict) {
  if (!isPlainRecord(verdict)) {
    fail("verdict_record_required");
  }

  return Object.freeze({
    policy_id: POLICY_ID,
    policy_version: POLICY_VERSION,
    policy_record_id: cleanString(verdict.policy_record_id ?? `${POLICY_ID}:${cleanString(verdict.requester_user_id, "requester_user_id")}:${cleanString(verdict.request_surface, "request_surface")}`, "policy_record_id"),
    requester_user_id: cleanString(verdict.requester_user_id, "requester_user_id"),
    subject_user_id: cleanString(verdict.subject_user_id, "subject_user_id"),
    request_surface: assertAllowedValue(verdict.request_surface, RETENTION_ACCESS_WINDOW_SURFACES, "request_surface"),
    allowed: verdict.allowed === true,
    blocked_reason: verdict.blocked_reason === null ? null : cleanOptionalString(verdict.blocked_reason),
    access_window_kind: cleanOptionalString(verdict.access_window_kind),
    stable_policy_json: stableCanonicalJson({
      requester_user_id: cleanString(verdict.requester_user_id, "requester_user_id"),
      subject_user_id: cleanString(verdict.subject_user_id, "subject_user_id"),
      request_surface: assertAllowedValue(verdict.request_surface, RETENTION_ACCESS_WINDOW_SURFACES, "request_surface"),
      allowed: verdict.allowed === true,
      blocked_reason: verdict.blocked_reason === null ? null : cleanOptionalString(verdict.blocked_reason),
      access_window_kind: cleanOptionalString(verdict.access_window_kind)
    }),
    engine_boundary: makeBoundaryEcho()
  });
}

/**
 * DEV NOTE:
 * Export: compileIgnoringRetentionAccessWindowPolicy
 * Purpose: Test helper proving retention/access policy records are ignored by
 * deterministic compile probes.
 * Boundary: This is not the real compiler and must not call engine internals.
 * It projects supplied phase-like fields while ignoring product policy records.
 * Determinism: Equal phase-like input returns equal probe output regardless of
 * policy records.
 * Failure behaviour: Invalid phase-like input throws before producing a probe.
 */
export function compileIgnoringRetentionAccessWindowPolicy(phaseLikeInput, policyRecords = []) {
  if (!isPlainRecord(phaseLikeInput)) {
    fail("phase_like_input_record_required");
  }

  if (!Array.isArray(policyRecords)) {
    fail("policy_records_array_required");
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
    surface_id: `${POLICY_ID}_compile_probe`,
    stable_probe_json: stableCanonicalJson(probe),
    ignored_policy_record_count: policyRecords.length,
    engine_boundary: makeBoundaryEcho()
  });
}

export function getRetentionAccessWindowPolicyContract() {
  return Object.freeze({
    policy_id: POLICY_ID,
    policy_version: POLICY_VERSION,
    surfaces: RETENTION_ACCESS_WINDOW_SURFACES,
    blocked_reasons: RETENTION_ACCESS_WINDOW_BLOCKED_REASONS,
    export_scopes: EXPORT_SCOPES,
    boundary: makeBoundaryEcho()
  });
}