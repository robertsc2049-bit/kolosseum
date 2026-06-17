import { createHash } from "node:crypto";

/**
 * DEV NOTE: S-V1-P-01 commercial access boundary contract.
 * Purpose: records controlled-launch commercial access state as product state only.
 * Boundary: no engine imports, no compile/replay/proof/factual-history mutation, no checkout provider integration.
 * Determinism: output depends on explicit request and a provided deterministic probe only.
 * Failure: invalid or widening requests fail closed with stable reason codes.
 */
export const S_V1_P_01_PAYMENT_BOUNDARY_CONTRACT_VERSION = "S-V1-P-01";

export const PAYMENT_BOUNDARY_ALLOWED_CONTROLS = Object.freeze([
  "access_state",
  "plan_visibility",
  "seat_limit",
  "billing_surface_visibility"
]);

export const PAYMENT_BOUNDARY_FORBIDDEN_EFFECTS = Object.freeze([
  "engine_legality",
  "compile_output",
  "substitution_selection",
  "replay_record",
  "proof_record",
  "factual_history_record",
  "mid_session_engine_access_rewrite",
  "enterprise_billing",
  "multi_entity_billing"
]);

export const PAYMENT_BOUNDARY_REASON_CODES = Object.freeze({
  ALLOWED: "payment_boundary_allowed",
  INPUT_REQUIRED: "payment_boundary_input_required",
  COMMERCIAL_ACCESS_REQUIRED: "payment_boundary_commercial_access_required",
  REQUESTED_CONTROL_REQUIRED: "payment_boundary_requested_control_required",
  CONTROL_NOT_PERMITTED: "payment_boundary_control_not_permitted",
  EFFECT_NOT_PERMITTED: "payment_boundary_effect_not_permitted",
  MID_SESSION_AUTOMATION_NOT_PERMITTED: "payment_boundary_mid_session_automation_not_permitted",
  PROBE_REQUIRED: "payment_boundary_probe_required"
});

const INPUT_KEYS = Object.freeze([
  "commercial_access",
  "requested_control",
  "session_state",
  "requested_at",
  "deterministic_probe"
]);

const COMMERCIAL_ACCESS_KEYS = Object.freeze([
  "state",
  "plan_id",
  "seat_limit",
  "billing_surface_visible",
  "actor_id",
  "subject_id",
  "automated_upsell",
  "change_timing",
  "requested_effects"
]);

const PROBE_KEYS = Object.freeze([
  "canonical_input_hash",
  "compile_output_hash",
  "substitution_output_hash",
  "replay_record_hash",
  "proof_record_hash",
  "factual_history_hash"
]);

const COMMERCIAL_ACCESS_STATES = Object.freeze([
  "access_active",
  "access_required",
  "access_suspended",
  "access_cancelled",
  "billing_review_required"
]);

const SESSION_STATES = Object.freeze([
  "not_started",
  "in_progress",
  "split",
  "returned",
  "partially_completed",
  "completed",
  "stopped"
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepFreeze(value) {
  if (!isPlainObject(value) && !Array.isArray(value)) {
    return value;
  }

  Object.freeze(value);

  for (const nested of Object.values(value)) {
    if ((isPlainObject(nested) || Array.isArray(nested)) && !Object.isFrozen(nested)) {
      deepFreeze(nested);
    }
  }

  return value;
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return "[" + value.map((entry) => canonicalJson(entry)).join(",") + "]";
  }

  return "{" + Object.keys(value).sort().map((key) => {
    return JSON.stringify(key) + ":" + canonicalJson(value[key]);
  }).join(",") + "}";
}

function sha256Hex(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function fail(reasonCode, details = {}) {
  return deepFreeze({
    ok: false,
    status: "payment_boundary_blocked",
    reason_code: reasonCode,
    details: deepFreeze({ ...details })
  });
}

function assertExactKeys(value, allowedKeys, reasonCode, field) {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      return fail(reasonCode, {
        field,
        unknown_key: key
      });
    }
  }

  return null;
}

function assertString(value, reasonCode, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(reasonCode, { field });
  }

  return null;
}

function normaliseRequestedEffects(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((entry) => typeof entry === "string"))].sort();
}

function normaliseProbe(input) {
  if (!isPlainObject(input)) {
    return null;
  }

  const exactKeyFailure = assertExactKeys(input, PROBE_KEYS, PAYMENT_BOUNDARY_REASON_CODES.PROBE_REQUIRED, "deterministic_probe");
  if (exactKeyFailure) {
    return null;
  }

  const material = {};
  for (const key of PROBE_KEYS) {
    if (typeof input[key] !== "string" || input[key].trim().length === 0) {
      return null;
    }
    material[key] = input[key];
  }

  return deepFreeze(material);
}

export function buildPaymentNoCouplingProbe(input) {
  const material = normaliseProbe(input);
  if (!material) {
    return fail(PAYMENT_BOUNDARY_REASON_CODES.PROBE_REQUIRED, {
      field: "deterministic_probe"
    });
  }

  return deepFreeze({
    ok: true,
    deterministic_probe: material,
    deterministic_probe_hash: sha256Hex(canonicalJson(material))
  });
}

export function createV1PaymentBoundary(input) {
  if (!isPlainObject(input)) {
    return fail(PAYMENT_BOUNDARY_REASON_CODES.INPUT_REQUIRED);
  }

  const inputKeyFailure = assertExactKeys(input, INPUT_KEYS, PAYMENT_BOUNDARY_REASON_CODES.INPUT_REQUIRED, "input");
  if (inputKeyFailure) return inputKeyFailure;

  if (!isPlainObject(input.commercial_access)) {
    return fail(PAYMENT_BOUNDARY_REASON_CODES.COMMERCIAL_ACCESS_REQUIRED, {
      field: "commercial_access"
    });
  }

  const accessKeyFailure = assertExactKeys(
    input.commercial_access,
    COMMERCIAL_ACCESS_KEYS,
    PAYMENT_BOUNDARY_REASON_CODES.COMMERCIAL_ACCESS_REQUIRED,
    "commercial_access"
  );
  if (accessKeyFailure) return accessKeyFailure;

  const requestedControlFailure = assertString(
    input.requested_control,
    PAYMENT_BOUNDARY_REASON_CODES.REQUESTED_CONTROL_REQUIRED,
    "requested_control"
  );
  if (requestedControlFailure) return requestedControlFailure;

  if (!PAYMENT_BOUNDARY_ALLOWED_CONTROLS.includes(input.requested_control)) {
    return fail(PAYMENT_BOUNDARY_REASON_CODES.CONTROL_NOT_PERMITTED, {
      requested_control: input.requested_control,
      allowed_controls: PAYMENT_BOUNDARY_ALLOWED_CONTROLS
    });
  }

  if (!COMMERCIAL_ACCESS_STATES.includes(input.commercial_access.state)) {
    return fail(PAYMENT_BOUNDARY_REASON_CODES.COMMERCIAL_ACCESS_REQUIRED, {
      field: "commercial_access.state",
      state: input.commercial_access.state ?? null
    });
  }

  if (!SESSION_STATES.includes(input.session_state)) {
    return fail(PAYMENT_BOUNDARY_REASON_CODES.INPUT_REQUIRED, {
      field: "session_state",
      session_state: input.session_state ?? null
    });
  }

  const requestedEffects = normaliseRequestedEffects(input.commercial_access.requested_effects);
  const forbiddenEffect = requestedEffects.find((effect) => PAYMENT_BOUNDARY_FORBIDDEN_EFFECTS.includes(effect));
  if (forbiddenEffect) {
    return fail(PAYMENT_BOUNDARY_REASON_CODES.EFFECT_NOT_PERMITTED, {
      requested_effect: forbiddenEffect
    });
  }

  if (
    input.session_state === "in_progress" &&
    input.commercial_access.automated_upsell === true &&
    input.commercial_access.change_timing === "mid_session"
  ) {
    return fail(PAYMENT_BOUNDARY_REASON_CODES.MID_SESSION_AUTOMATION_NOT_PERMITTED, {
      session_state: input.session_state,
      change_timing: input.commercial_access.change_timing
    });
  }

  const probe = buildPaymentNoCouplingProbe(input.deterministic_probe);
  if (!probe.ok) {
    return probe;
  }

  const boundary = deepFreeze({
    access_state_control: input.requested_control === "access_state" ? "permitted_product_surface" : "not_requested",
    plan_visibility_control: input.requested_control === "plan_visibility" ? "permitted_product_surface" : "not_requested",
    seat_limit_control: input.requested_control === "seat_limit" ? "permitted_product_surface" : "not_requested",
    billing_surface_control: input.requested_control === "billing_surface_visibility" ? "permitted_product_surface" : "not_requested",
    engine_legality: "not_mutated",
    compile_output: "not_mutated",
    substitution_selection: "not_mutated",
    replay_record: "not_mutated",
    proof_record: "not_mutated",
    factual_history_record: "not_mutated",
    automated_mid_session_upsell: "not_permitted"
  });

  const material = deepFreeze({
    contract_version: S_V1_P_01_PAYMENT_BOUNDARY_CONTRACT_VERSION,
    requested_control: input.requested_control,
    commercial_access_state: input.commercial_access.state,
    session_state: input.session_state,
    requested_at: input.requested_at,
    deterministic_probe_hash: probe.deterministic_probe_hash,
    boundary
  });

  return deepFreeze({
    ok: true,
    status: "payment_boundary_recorded",
    reason_code: PAYMENT_BOUNDARY_REASON_CODES.ALLOWED,
    ...material,
    record_hash: sha256Hex(canonicalJson(material))
  });
}

export function assertV1PaymentBoundary(record) {
  if (!isPlainObject(record)) {
    return fail(PAYMENT_BOUNDARY_REASON_CODES.INPUT_REQUIRED, {
      field: "record"
    });
  }

  if (record.ok !== true) {
    return fail(PAYMENT_BOUNDARY_REASON_CODES.INPUT_REQUIRED, {
      field: "record.ok"
    });
  }

  for (const key of [
    "engine_legality",
    "compile_output",
    "substitution_selection",
    "replay_record",
    "proof_record",
    "factual_history_record"
  ]) {
    if (record.boundary?.[key] !== "not_mutated") {
      return fail(PAYMENT_BOUNDARY_REASON_CODES.EFFECT_NOT_PERMITTED, {
        boundary_key: key,
        value: record.boundary?.[key] ?? null
      });
    }
  }

  return deepFreeze({
    ok: true,
    status: "payment_boundary_asserted",
    record_hash: record.record_hash
  });
}