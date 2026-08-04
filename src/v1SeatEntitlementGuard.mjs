import { createHash } from "node:crypto";

import {
  buildPaymentNoCouplingProbe
} from "./v1PaymentBoundaryContract.mjs";

/**
 * DEV NOTE: S-V1-P-03 controlled-launch seat entitlement guard.
 * Purpose: evaluates seat entitlement for product access during controlled launch.
 * Boundary: emits product access allow or reject only; no engine imports, no compile output, no substitution, no replay, no proof, and no factual history mutation.
 * Determinism: all verdicts and hashes derive from explicit input only.
 * Failure: entitlement refusal returns a product access failure, not an engine decision.
 */
export const S_V1_P_03_SEAT_ENTITLEMENT_GUARD_VERSION = "S-V1-P-03";

export const SEAT_ENTITLEMENT_ALLOWED_SCOPES = Object.freeze([
  "controlled_launch_coach_seat",
  "controlled_launch_athlete_seat",
  "controlled_launch_org_coach_seat"
]);

export const SEAT_ENTITLEMENT_ALLOWED_PRODUCT_SURFACES = Object.freeze([
  "controlled_launch_coach_product_access",
  "controlled_launch_athlete_product_access",
  "controlled_launch_org_coach_product_access"
]);

export const SEAT_ENTITLEMENT_FORBIDDEN_SCOPES = Object.freeze([
  "enterprise_seats",
  "organisation_seats",
  "organization_seats",
  "team_seats",
  "unit_seats",
  "gym_seats",
  "multi_entity_seats",
  "marketplace_seats"
]);

export const SEAT_ENTITLEMENT_REASON_CODES = Object.freeze({
  ALLOWED: "seat_entitlement_allowed",
  INPUT_REQUIRED: "seat_entitlement_input_required",
  BILLING_ACCESS_RECORD_REQUIRED: "seat_entitlement_billing_access_record_required",
  BILLING_ACCESS_NOT_ACTIVE: "seat_entitlement_billing_access_not_active",
  PRODUCT_SURFACE_NOT_PERMITTED: "seat_entitlement_product_surface_not_permitted",
  SEAT_SCOPE_NOT_PERMITTED: "seat_entitlement_scope_not_permitted",
  ACTOR_MISMATCH: "seat_entitlement_actor_mismatch",
  SEAT_LIMIT_EXCEEDED: "seat_entitlement_limit_exceeded",
  PROBE_REJECTED: "seat_entitlement_probe_rejected",
  ENGINE_MUTATION_REJECTED: "seat_entitlement_engine_mutation_rejected"
});

export const SEAT_ENTITLEMENT_FORBIDDEN_EFFECTS = Object.freeze([
  "engine_legality",
  "compile_output",
  "substitution_selection",
  "replay_record",
  "proof_record",
  "factual_history_record"
]);

const INPUT_KEYS = Object.freeze([
  "billing_access_record",
  "requested_product_surface",
  "requesting_actor_id",
  "requested_subject_id",
  "current_occupied_seat_count",
  "requested_seat_count",
  "requested_seat_scope",
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
    factual_history_record: "not_mutated"
  });
}

function fail(reasonCode, details = {}) {
  const material = deepFreeze({
    status: "seat_entitlement_rejected",
    reason_code: reasonCode,
    product_access_state: "rejected",
    product_access_failure: true,
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

function assertNonNegativeInteger(value, reasonCode, field) {
  if (!Number.isInteger(value) || value < 0) {
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

function hashBillingAccessRecord(record) {
  return sha256Hex(canonicalJson(record));
}

function assertBillingAccessRecord(record) {
  const keyFailure = assertExactKeys(record, BILLING_ACCESS_RECORD_KEYS, SEAT_ENTITLEMENT_REASON_CODES.BILLING_ACCESS_RECORD_REQUIRED, "billing_access_record");
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
    const failure = assertNonEmptyString(record[field], SEAT_ENTITLEMENT_REASON_CODES.BILLING_ACCESS_RECORD_REQUIRED, `billing_access_record.${field}`);
    if (failure) return failure;
  }

  const seatLimitFailure = assertPositiveInteger(record.seat_limit, SEAT_ENTITLEMENT_REASON_CODES.BILLING_ACCESS_RECORD_REQUIRED, "billing_access_record.seat_limit");
  if (seatLimitFailure) return seatLimitFailure;

  if (record.record_type !== "controlled_launch_billing_access_record") {
    return fail(SEAT_ENTITLEMENT_REASON_CODES.BILLING_ACCESS_RECORD_REQUIRED, {
      field: "billing_access_record.record_type",
      record_type: record.record_type
    });
  }

  for (const key of SEAT_ENTITLEMENT_FORBIDDEN_EFFECTS) {
    if (record[key] !== "not_mutated") {
      return fail(SEAT_ENTITLEMENT_REASON_CODES.ENGINE_MUTATION_REJECTED, {
        field: `billing_access_record.${key}`,
        value: record[key] ?? null
      });
    }
  }

  return null;
}

export function evaluateSeatEntitlement(input) {
  if (!isPlainObject(input)) {
    return fail(SEAT_ENTITLEMENT_REASON_CODES.INPUT_REQUIRED);
  }

  const inputKeyFailure = assertExactKeys(input, INPUT_KEYS, SEAT_ENTITLEMENT_REASON_CODES.INPUT_REQUIRED, "input");
  if (inputKeyFailure) return inputKeyFailure;

  const billingFailure = assertBillingAccessRecord(input.billing_access_record);
  if (billingFailure) return billingFailure;

  for (const field of [
    "requested_product_surface",
    "requesting_actor_id",
    "requested_subject_id",
    "requested_seat_scope",
    "requested_at"
  ]) {
    const failure = assertNonEmptyString(input[field], SEAT_ENTITLEMENT_REASON_CODES.INPUT_REQUIRED, field);
    if (failure) return failure;
  }

  const occupiedFailure = assertNonNegativeInteger(input.current_occupied_seat_count, SEAT_ENTITLEMENT_REASON_CODES.INPUT_REQUIRED, "current_occupied_seat_count");
  if (occupiedFailure) return occupiedFailure;

  const requestedSeatFailure = assertPositiveInteger(input.requested_seat_count, SEAT_ENTITLEMENT_REASON_CODES.INPUT_REQUIRED, "requested_seat_count");
  if (requestedSeatFailure) return requestedSeatFailure;

  if (!SEAT_ENTITLEMENT_ALLOWED_PRODUCT_SURFACES.includes(input.requested_product_surface)) {
    return fail(SEAT_ENTITLEMENT_REASON_CODES.PRODUCT_SURFACE_NOT_PERMITTED, {
      requested_product_surface: input.requested_product_surface
    });
  }

  if (
    !SEAT_ENTITLEMENT_ALLOWED_SCOPES.includes(input.requested_seat_scope) ||
    SEAT_ENTITLEMENT_FORBIDDEN_SCOPES.includes(input.requested_seat_scope)
  ) {
    return fail(SEAT_ENTITLEMENT_REASON_CODES.SEAT_SCOPE_NOT_PERMITTED, {
      requested_seat_scope: input.requested_seat_scope
    });
  }

  if (input.requesting_actor_id !== input.billing_access_record.actor_id) {
    return fail(SEAT_ENTITLEMENT_REASON_CODES.ACTOR_MISMATCH, {
      requesting_actor_id: input.requesting_actor_id,
      billing_actor_id: input.billing_access_record.actor_id
    });
  }

  if (
    input.billing_access_record.billing_access_state !== "access_active" ||
    input.billing_access_record.billing_status !== "payment_confirmed"
  ) {
    return fail(SEAT_ENTITLEMENT_REASON_CODES.BILLING_ACCESS_NOT_ACTIVE, {
      billing_access_state: input.billing_access_record.billing_access_state,
      billing_status: input.billing_access_record.billing_status
    });
  }

  const requestedTotal = input.current_occupied_seat_count + input.requested_seat_count;
  if (requestedTotal > input.billing_access_record.seat_limit) {
    return fail(SEAT_ENTITLEMENT_REASON_CODES.SEAT_LIMIT_EXCEEDED, {
      current_occupied_seat_count: input.current_occupied_seat_count,
      requested_seat_count: input.requested_seat_count,
      seat_limit: input.billing_access_record.seat_limit
    });
  }

  const probe = buildPaymentNoCouplingProbe(input.deterministic_probe);
  if (!probe.ok) {
    return fail(SEAT_ENTITLEMENT_REASON_CODES.PROBE_REJECTED, {
      reason_code: probe.reason_code
    });
  }

  const material = deepFreeze({
    contract_version: S_V1_P_03_SEAT_ENTITLEMENT_GUARD_VERSION,
    status: "seat_entitlement_allowed",
    reason_code: SEAT_ENTITLEMENT_REASON_CODES.ALLOWED,
    product_access_state: "allowed",
    product_access_failure: false,
    engine_decision: false,
    engine_visible: false,
    requested_product_surface: input.requested_product_surface,
    requested_seat_scope: input.requested_seat_scope,
    requesting_actor_id: input.requesting_actor_id,
    requested_subject_id: input.requested_subject_id,
    seat_limit: input.billing_access_record.seat_limit,
    current_occupied_seat_count: input.current_occupied_seat_count,
    requested_seat_count: input.requested_seat_count,
    available_seat_count_after_request: input.billing_access_record.seat_limit - requestedTotal,
    billing_access_record_hash: input.billing_access_record.record_hash,
    billing_access_record_observed_hash: hashBillingAccessRecord(input.billing_access_record),
    deterministic_probe_hash: probe.deterministic_probe_hash,
    requested_at: input.requested_at,
    ...deterministicSurfaceState()
  });

  return deepFreeze({
    ok: true,
    ...material,
    record_hash: sha256Hex(canonicalJson(material))
  });
}

export function assertSeatEntitlementDoesNotMutateEngine(record) {
  if (!isPlainObject(record)) {
    return fail(SEAT_ENTITLEMENT_REASON_CODES.INPUT_REQUIRED, {
      field: "record"
    });
  }

  for (const key of SEAT_ENTITLEMENT_FORBIDDEN_EFFECTS) {
    if (record[key] !== "not_mutated") {
      return fail(SEAT_ENTITLEMENT_REASON_CODES.ENGINE_MUTATION_REJECTED, {
        field: key,
        value: record[key] ?? null
      });
    }
  }

  if (record.engine_decision !== false || record.engine_visible !== false) {
    return fail(SEAT_ENTITLEMENT_REASON_CODES.ENGINE_MUTATION_REJECTED, {
      engine_decision: record.engine_decision ?? null,
      engine_visible: record.engine_visible ?? null
    });
  }

  return deepFreeze({
    ok: true,
    status: "seat_entitlement_engine_isolation_asserted",
    record_hash: record.record_hash
  });
}