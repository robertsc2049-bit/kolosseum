import { createHash } from "node:crypto";

import {
  buildPaymentNoCouplingProbe
} from "./v1PaymentBoundaryContract.mjs";

/**
 * DEV NOTE: S-V1-P-04 controlled-launch billing management surface.
 * Purpose: builds factual billing overview and provider-portal request records for controlled launch.
 * Boundary: product billing presentation and portal request only; no provider SDK call, no commercial account scope, no relationship mutation.
 * Determinism: all records and hashes derive from explicit input only.
 * Failure: invalid or scope-widening input fails closed with factual reason codes.
 */
export const S_V1_P_04_BILLING_MANAGEMENT_SURFACE_VERSION = "S-V1-P-04";

export const BILLING_MANAGEMENT_PROVIDERS = Object.freeze([
  "stripe_customer_portal",
  "equivalent_customer_portal"
]);

export const BILLING_MANAGEMENT_SURFACES = Object.freeze([
  "controlled_launch_billing_overview",
  "controlled_launch_customer_portal"
]);

export const BILLING_MANAGEMENT_ACTIONS = Object.freeze([
  "view_billing_overview",
  "open_customer_portal",
  "view_payment_status",
  "view_seat_limit"
]);

export const BILLING_MANAGEMENT_ALLOWED_SCOPES = Object.freeze([
  "controlled_launch_billing_management",
  "controlled_launch_customer_portal"
]);

export const BILLING_MANAGEMENT_FORBIDDEN_SCOPES = Object.freeze([
  "enterprise_billing",
  "enterprise_procurement",
  "commercial_account_surfaces",
  "multi_entity_billing",
  "organisation_billing",
  "organization_billing",
  "team_billing",
  "unit_billing",
  "gym_billing",
  "marketplace_billing",
  "revenue_share",
  "royalties"
]);

export const BILLING_MANAGEMENT_REASON_CODES = Object.freeze({
  ALLOWED: "billing_management_allowed",
  INPUT_REQUIRED: "billing_management_input_required",
  BILLING_ACCESS_RECORD_REQUIRED: "billing_management_billing_access_record_required",
  PROVIDER_NOT_SUPPORTED: "billing_management_provider_not_supported",
  SURFACE_NOT_PERMITTED: "billing_management_surface_not_permitted",
  ACTION_NOT_PERMITTED: "billing_management_action_not_permitted",
  SCOPE_NOT_PERMITTED: "billing_management_scope_not_permitted",
  ACTOR_MISMATCH: "billing_management_actor_mismatch",
  RETURN_URL_REQUIRED: "billing_management_return_url_required",
  PROVIDER_SESSION_REQUIRED: "billing_management_provider_session_required",
  PROBE_REJECTED: "billing_management_probe_rejected",
  RELATIONSHIP_TRUTH_FIELD_REJECTED: "billing_management_relationship_truth_field_rejected",
  ENGINE_MUTATION_REJECTED: "billing_management_engine_mutation_rejected"
});

export const BILLING_MANAGEMENT_FORBIDDEN_EFFECTS = Object.freeze([
  "engine_legality",
  "compile_output",
  "substitution_selection",
  "replay_record",
  "proof_record",
  "factual_history_record"
]);

const INPUT_KEYS = Object.freeze([
  "provider",
  "billing_access_record",
  "requested_surface",
  "requested_action",
  "requested_management_scope",
  "requesting_actor_id",
  "return_url",
  "idempotency_key",
  "requested_at",
  "deterministic_probe"
]);

const BILLING_ACCESS_RECORD_KEYS = Object.freeze([
  "record_type",
  "provider",
  "provider_session_intent_id",
  "provider_session_id",
  "billing_access_state",
  "billing_status",
  "plan_id",
  "seat_limit",
  "actor_id",
  "subject_id",
  "provider_price_id",
  "checkout_mode",
  "idempotency_key",
  "created_at",
  "updated_at",
  "payment_boundary_record_hash",
  "engine_legality",
  "compile_output",
  "substitution_selection",
  "replay_record",
  "proof_record",
  "factual_history_record",
  "record_hash"
]);

const RELATIONSHIP_TRUTH_KEYS = Object.freeze([
  "coach_athlete_relationship",
  "coach_athlete_relationship_state",
  "coach_athlete_relationship_truth",
  "relationship_state",
  "relationship_truth",
  "relationship_id",
  "accepted_relationship"
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepFreeze(value) {
  if (!isPlainObject(value) && !Array.isArray(value)) return value;

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

function deterministicSurfaceState() {
  return deepFreeze({
    engine_legality: "not_mutated",
    compile_output: "not_mutated",
    substitution_selection: "not_mutated",
    replay_record: "not_mutated",
    proof_record: "not_mutated",
    factual_history_record: "not_mutated",
    coach_athlete_relationship_truth: "not_read_not_written_not_inferred",
    relationship_truth_mutation: "not_performed"
  });
}

function fail(reasonCode, details = {}) {
  const material = deepFreeze({
    status: "billing_management_rejected",
    reason_code: reasonCode,
    billing_management_state: "rejected",
    product_access_failure: true,
    provider_call_performed: false,
    engine_decision: false,
    engine_visible: false,
    details: deepFreeze({ ...details }),
    ...deterministicSurfaceState()
  });

  return deepFreeze({
    ok: false,
    ...material,
    record_hash: sha256Hex(canonicalJson(material))
  });
}

function assertExactKeys(value, allowedKeys, reasonCode, field) {
  if (!isPlainObject(value)) {
    return fail(reasonCode, { field });
  }

  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (RELATIONSHIP_TRUTH_KEYS.includes(key)) {
      return fail(BILLING_MANAGEMENT_REASON_CODES.RELATIONSHIP_TRUTH_FIELD_REJECTED, {
        field: key
      });
    }

    if (!allowed.has(key)) {
      return fail(reasonCode, {
        field,
        unknown_key: key
      });
    }
  }

  return null;
}

function assertNonEmptyString(value, reasonCode, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(reasonCode, { field });
  }

  return null;
}

function assertPositiveInteger(value, reasonCode, field) {
  if (!Number.isInteger(value) || value <= 0) {
    return fail(reasonCode, { field });
  }

  return null;
}

function assertUrl(value, reasonCode, field) {
  const stringFailure = assertNonEmptyString(value, reasonCode, field);
  if (stringFailure) return stringFailure;

  if (!/^https:\/\/[^\s]+$/u.test(value)) {
    return fail(reasonCode, { field });
  }

  return null;
}

function assertBillingAccessRecord(record) {
  const keyFailure = assertExactKeys(record, BILLING_ACCESS_RECORD_KEYS, BILLING_MANAGEMENT_REASON_CODES.BILLING_ACCESS_RECORD_REQUIRED, "billing_access_record");
  if (keyFailure) return keyFailure;

  for (const field of [
    "record_type",
    "provider",
    "provider_session_intent_id",
    "billing_access_state",
    "billing_status",
    "plan_id",
    "actor_id",
    "subject_id",
    "provider_price_id",
    "checkout_mode",
    "idempotency_key",
    "created_at",
    "updated_at",
    "payment_boundary_record_hash",
    "record_hash"
  ]) {
    const failure = assertNonEmptyString(record[field], BILLING_MANAGEMENT_REASON_CODES.BILLING_ACCESS_RECORD_REQUIRED, `billing_access_record.${field}`);
    if (failure) return failure;
  }

  const seatLimitFailure = assertPositiveInteger(record.seat_limit, BILLING_MANAGEMENT_REASON_CODES.BILLING_ACCESS_RECORD_REQUIRED, "billing_access_record.seat_limit");
  if (seatLimitFailure) return seatLimitFailure;

  if (record.record_type !== "controlled_launch_billing_access_record") {
    return fail(BILLING_MANAGEMENT_REASON_CODES.BILLING_ACCESS_RECORD_REQUIRED, {
      field: "billing_access_record.record_type",
      record_type: record.record_type
    });
  }

  for (const key of BILLING_MANAGEMENT_FORBIDDEN_EFFECTS) {
    if (record[key] !== "not_mutated") {
      return fail(BILLING_MANAGEMENT_REASON_CODES.ENGINE_MUTATION_REJECTED, {
        field: `billing_access_record.${key}`,
        value: record[key] ?? null
      });
    }
  }

  return null;
}

function buildPortalSessionRequest(input) {
  return deepFreeze({
    provider: input.provider,
    provider_portal: "customer_portal",
    provider_customer_reference: input.billing_access_record.actor_id,
    provider_session_id: input.billing_access_record.provider_session_id,
    return_url: input.return_url,
    idempotency_key: input.idempotency_key,
    metadata: deepFreeze({
      slice: S_V1_P_04_BILLING_MANAGEMENT_SURFACE_VERSION,
      actor_id: input.billing_access_record.actor_id,
      subject_id: input.billing_access_record.subject_id,
      plan_id: input.billing_access_record.plan_id,
      billing_access_record_hash: input.billing_access_record.record_hash
    }),
    live_provider_call: "not_performed_in_contract_slice"
  });
}

function buildBillingOverview(input) {
  return deepFreeze({
    surface: "controlled_launch_billing_overview",
    billing_access_state: input.billing_access_record.billing_access_state,
    billing_status: input.billing_access_record.billing_status,
    plan_id: input.billing_access_record.plan_id,
    seat_limit: input.billing_access_record.seat_limit,
    provider: input.billing_access_record.provider,
    provider_session_present: typeof input.billing_access_record.provider_session_id === "string" && input.billing_access_record.provider_session_id.length > 0,
    relationship_truth_source: "not_read",
    copy_scope: "factual_billing_state_only"
  });
}

export function createBillingManagementSurface(input) {
  if (!isPlainObject(input)) {
    return fail(BILLING_MANAGEMENT_REASON_CODES.INPUT_REQUIRED);
  }

  const keyFailure = assertExactKeys(input, INPUT_KEYS, BILLING_MANAGEMENT_REASON_CODES.INPUT_REQUIRED, "input");
  if (keyFailure) return keyFailure;

  const billingFailure = assertBillingAccessRecord(input.billing_access_record);
  if (billingFailure) return billingFailure;

  for (const field of [
    "provider",
    "requested_surface",
    "requested_action",
    "requested_management_scope",
    "requesting_actor_id",
    "idempotency_key",
    "requested_at"
  ]) {
    const failure = assertNonEmptyString(input[field], BILLING_MANAGEMENT_REASON_CODES.INPUT_REQUIRED, field);
    if (failure) return failure;
  }

  if (!BILLING_MANAGEMENT_PROVIDERS.includes(input.provider)) {
    return fail(BILLING_MANAGEMENT_REASON_CODES.PROVIDER_NOT_SUPPORTED, {
      provider: input.provider
    });
  }

  if (!BILLING_MANAGEMENT_SURFACES.includes(input.requested_surface)) {
    return fail(BILLING_MANAGEMENT_REASON_CODES.SURFACE_NOT_PERMITTED, {
      requested_surface: input.requested_surface
    });
  }

  if (!BILLING_MANAGEMENT_ACTIONS.includes(input.requested_action)) {
    return fail(BILLING_MANAGEMENT_REASON_CODES.ACTION_NOT_PERMITTED, {
      requested_action: input.requested_action
    });
  }

  if (
    !BILLING_MANAGEMENT_ALLOWED_SCOPES.includes(input.requested_management_scope) ||
    BILLING_MANAGEMENT_FORBIDDEN_SCOPES.includes(input.requested_management_scope)
  ) {
    return fail(BILLING_MANAGEMENT_REASON_CODES.SCOPE_NOT_PERMITTED, {
      requested_management_scope: input.requested_management_scope
    });
  }

  if (input.requesting_actor_id !== input.billing_access_record.actor_id) {
    return fail(BILLING_MANAGEMENT_REASON_CODES.ACTOR_MISMATCH, {
      requesting_actor_id: input.requesting_actor_id,
      billing_actor_id: input.billing_access_record.actor_id
    });
  }

  if (input.requested_action === "open_customer_portal") {
    const returnUrlFailure = assertUrl(input.return_url, BILLING_MANAGEMENT_REASON_CODES.RETURN_URL_REQUIRED, "return_url");
    if (returnUrlFailure) return returnUrlFailure;

    if (typeof input.billing_access_record.provider_session_id !== "string" || input.billing_access_record.provider_session_id.trim().length === 0) {
      return fail(BILLING_MANAGEMENT_REASON_CODES.PROVIDER_SESSION_REQUIRED, {
        field: "billing_access_record.provider_session_id"
      });
    }
  }

  const probe = buildPaymentNoCouplingProbe(input.deterministic_probe);
  if (!probe.ok) {
    return fail(BILLING_MANAGEMENT_REASON_CODES.PROBE_REJECTED, {
      reason_code: probe.reason_code
    });
  }

  const isPortalRequest = input.requested_action === "open_customer_portal";
  const billingOverview = buildBillingOverview(input);
  const portalSessionRequest = isPortalRequest ? buildPortalSessionRequest(input) : null;

  const material = deepFreeze({
    contract_version: S_V1_P_04_BILLING_MANAGEMENT_SURFACE_VERSION,
    status: isPortalRequest ? "billing_management_portal_session_requested" : "billing_management_surface_view_created",
    reason_code: BILLING_MANAGEMENT_REASON_CODES.ALLOWED,
    billing_management_state: isPortalRequest ? "portal_session_requested" : "view_created",
    requested_surface: input.requested_surface,
    requested_action: input.requested_action,
    requested_management_scope: input.requested_management_scope,
    billing_access_record_hash: input.billing_access_record.record_hash,
    deterministic_probe_hash: probe.deterministic_probe_hash,
    provider_call_performed: false,
    engine_decision: false,
    engine_visible: false,
    ...deterministicSurfaceState()
  });

  return deepFreeze({
    ok: true,
    ...material,
    billing_overview: billingOverview,
    provider_portal_session_request: portalSessionRequest,
    record_hash: sha256Hex(canonicalJson(material))
  });
}

export function assertBillingManagementDoesNotMutateEngineOrRelationship(record) {
  if (!isPlainObject(record)) {
    return fail(BILLING_MANAGEMENT_REASON_CODES.INPUT_REQUIRED, {
      field: "record"
    });
  }

  for (const key of BILLING_MANAGEMENT_FORBIDDEN_EFFECTS) {
    if (record[key] !== "not_mutated") {
      return fail(BILLING_MANAGEMENT_REASON_CODES.ENGINE_MUTATION_REJECTED, {
        field: key,
        value: record[key] ?? null
      });
    }
  }

  if (record.engine_decision !== false || record.engine_visible !== false) {
    return fail(BILLING_MANAGEMENT_REASON_CODES.ENGINE_MUTATION_REJECTED, {
      engine_decision: record.engine_decision ?? null,
      engine_visible: record.engine_visible ?? null
    });
  }

  if (
    record.coach_athlete_relationship_truth !== "not_read_not_written_not_inferred" ||
    record.relationship_truth_mutation !== "not_performed"
  ) {
    return fail(BILLING_MANAGEMENT_REASON_CODES.RELATIONSHIP_TRUTH_FIELD_REJECTED, {
      coach_athlete_relationship_truth: record.coach_athlete_relationship_truth ?? null,
      relationship_truth_mutation: record.relationship_truth_mutation ?? null
    });
  }

  return deepFreeze({
    ok: true,
    status: "billing_management_engine_and_relationship_isolation_asserted",
    record_hash: record.record_hash
  });
}