import { createHash } from "node:crypto";

import {
  createV1PaymentBoundary,
  buildPaymentNoCouplingProbe,
  assertV1PaymentBoundary
} from "./v1PaymentBoundaryContract.mjs";

/**
 * DEV NOTE: S-V1-P-02 controlled-launch checkout contract.
 * Purpose: creates Stripe-ready or equivalent checkout entry records for controlled launch.
 * Boundary: creates billing/access records only; no live Stripe SDK, no enterprise billing, no multi-entity billing, no revenue share, no royalties.
 * Determinism: all record IDs and hashes derive from explicit input; no wall-clock, environment, or network state.
 * Failure: invalid or scope-widening requests fail closed with stable reason codes.
 */
export const S_V1_P_02_STRIPE_CHECKOUT_CONTROLLED_LAUNCH_VERSION = "S-V1-P-02";

export const CONTROLLED_LAUNCH_CHECKOUT_PROVIDERS = Object.freeze([
  "stripe_checkout",
  "equivalent_checkout"
]);

export const CONTROLLED_LAUNCH_CHECKOUT_MODES = Object.freeze([
  "subscription",
  "payment"
]);

export const CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES = Object.freeze({
  ALLOWED: "controlled_launch_checkout_allowed",
  INPUT_REQUIRED: "controlled_launch_checkout_input_required",
  PROVIDER_NOT_SUPPORTED: "controlled_launch_checkout_provider_not_supported",
  MODE_NOT_SUPPORTED: "controlled_launch_checkout_mode_not_supported",
  URL_REQUIRED: "controlled_launch_checkout_url_required",
  PRICE_REQUIRED: "controlled_launch_checkout_price_required",
  SCOPE_NOT_PERMITTED: "controlled_launch_checkout_scope_not_permitted",
  PAYMENT_BOUNDARY_REJECTED: "controlled_launch_checkout_payment_boundary_rejected",
  WEBHOOK_EVENT_NOT_SUPPORTED: "controlled_launch_checkout_webhook_event_not_supported",
  ACCESS_RECORD_REQUIRED: "controlled_launch_checkout_access_record_required",
  ENGINE_MUTATION_REJECTED: "controlled_launch_checkout_engine_mutation_rejected"
});

export const CONTROLLED_LAUNCH_FORBIDDEN_SCOPES = Object.freeze([
  "enterprise_procurement",
  "enterprise_billing",
  "multi_entity_billing",
  "organisation_billing",
  "marketplace_billing",
  "revenue_share",
  "royalties"
]);

export const CONTROLLED_LAUNCH_FORBIDDEN_EFFECTS = Object.freeze([
  "engine_legality",
  "compile_output",
  "substitution_selection",
  "replay_record",
  "proof_record",
  "factual_history_record"
]);

const CHECKOUT_INPUT_KEYS = Object.freeze([
  "provider",
  "checkout_mode",
  "provider_price_id",
  "plan_id",
  "seat_limit",
  "actor_id",
  "subject_id",
  "success_url",
  "cancel_url",
  "idempotency_key",
  "requested_at",
  "requested_commercial_scopes",
  "deterministic_probe"
]);

const WEBHOOK_INPUT_KEYS = Object.freeze([
  "provider",
  "event_id",
  "event_type",
  "provider_session_id",
  "idempotency_key",
  "received_at",
  "billing_access_record",
  "deterministic_probe"
]);

const ACCESS_RECORD_KEYS = Object.freeze([
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

const SUPPORTED_WEBHOOK_EVENTS = Object.freeze([
  "checkout.session.completed",
  "checkout.session.expired",
  "payment_intent.payment_failed"
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

function fail(reasonCode, details = {}) {
  return deepFreeze({
    ok: false,
    status: "controlled_launch_checkout_blocked",
    reason_code: reasonCode,
    details: deepFreeze({ ...details })
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

function normaliseScopes(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry) => typeof entry === "string"))].sort();
}

function buildIntentId(input) {
  return "cl_checkout_intent_" + sha256Hex(canonicalJson({
    provider: input.provider,
    checkout_mode: input.checkout_mode,
    provider_price_id: input.provider_price_id,
    plan_id: input.plan_id,
    actor_id: input.actor_id,
    subject_id: input.subject_id,
    idempotency_key: input.idempotency_key
  })).slice(0, 24);
}

function withoutRecordHash(record) {
  const copy = { ...record };
  delete copy.record_hash;
  return copy;
}

function withRecordHash(record) {
  return deepFreeze({
    ...record,
    record_hash: sha256Hex(canonicalJson(record))
  });
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

function createAccessRecord(input, paymentBoundary, state, status, providerSessionId = null) {
  const base = {
    record_type: "controlled_launch_billing_access_record",
    provider: input.provider,
    provider_session_intent_id: buildIntentId(input),
    provider_session_id: providerSessionId,
    billing_access_state: state,
    billing_status: status,
    plan_id: input.plan_id,
    seat_limit: input.seat_limit,
    actor_id: input.actor_id,
    subject_id: input.subject_id,
    provider_price_id: input.provider_price_id,
    checkout_mode: input.checkout_mode,
    idempotency_key: input.idempotency_key,
    created_at: input.requested_at,
    updated_at: input.requested_at,
    payment_boundary_record_hash: paymentBoundary.record_hash,
    ...deterministicSurfaceState()
  };

  return withRecordHash(base);
}

function createPaymentBoundaryForCheckout(input, commercialState) {
  return createV1PaymentBoundary({
    commercial_access: {
      state: commercialState,
      plan_id: input.plan_id,
      seat_limit: input.seat_limit,
      billing_surface_visible: true,
      actor_id: input.actor_id,
      subject_id: input.subject_id,
      automated_upsell: false,
      change_timing: "pre_session",
      requested_effects: []
    },
    requested_control: "access_state",
    session_state: "not_started",
    requested_at: input.requested_at ?? input.received_at,
    deterministic_probe: input.deterministic_probe
  });
}

export function createControlledLaunchCheckoutSession(input) {
  if (!isPlainObject(input)) {
    return fail(CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.INPUT_REQUIRED);
  }

  const keyFailure = assertExactKeys(input, CHECKOUT_INPUT_KEYS, CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.INPUT_REQUIRED, "input");
  if (keyFailure) return keyFailure;

  if (!CONTROLLED_LAUNCH_CHECKOUT_PROVIDERS.includes(input.provider)) {
    return fail(CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.PROVIDER_NOT_SUPPORTED, {
      provider: input.provider ?? null
    });
  }

  if (!CONTROLLED_LAUNCH_CHECKOUT_MODES.includes(input.checkout_mode)) {
    return fail(CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.MODE_NOT_SUPPORTED, {
      checkout_mode: input.checkout_mode ?? null
    });
  }

  for (const [field, reason] of [
    ["provider_price_id", CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.PRICE_REQUIRED],
    ["plan_id", CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.INPUT_REQUIRED],
    ["actor_id", CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.INPUT_REQUIRED],
    ["subject_id", CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.INPUT_REQUIRED],
    ["idempotency_key", CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.INPUT_REQUIRED],
    ["requested_at", CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.INPUT_REQUIRED]
  ]) {
    const failure = assertNonEmptyString(input[field], reason, field);
    if (failure) return failure;
  }

  const seatFailure = assertPositiveInteger(input.seat_limit, CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.INPUT_REQUIRED, "seat_limit");
  if (seatFailure) return seatFailure;

  const successUrlFailure = assertUrl(input.success_url, CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.URL_REQUIRED, "success_url");
  if (successUrlFailure) return successUrlFailure;

  const cancelUrlFailure = assertUrl(input.cancel_url, CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.URL_REQUIRED, "cancel_url");
  if (cancelUrlFailure) return cancelUrlFailure;

  const requestedScopes = normaliseScopes(input.requested_commercial_scopes);
  const forbiddenScope = requestedScopes.find((scope) => CONTROLLED_LAUNCH_FORBIDDEN_SCOPES.includes(scope));
  if (forbiddenScope) {
    return fail(CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.SCOPE_NOT_PERMITTED, {
      requested_scope: forbiddenScope
    });
  }

  const probe = buildPaymentNoCouplingProbe(input.deterministic_probe);
  if (!probe.ok) {
    return fail(CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.PAYMENT_BOUNDARY_REJECTED, {
      reason_code: probe.reason_code
    });
  }

  const paymentBoundary = createPaymentBoundaryForCheckout(input, "access_required");
  if (!paymentBoundary.ok) {
    return fail(CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.PAYMENT_BOUNDARY_REJECTED, {
      reason_code: paymentBoundary.reason_code
    });
  }

  const boundaryAssertion = assertV1PaymentBoundary(paymentBoundary);
  if (!boundaryAssertion.ok) {
    return fail(CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.PAYMENT_BOUNDARY_REJECTED, {
      reason_code: boundaryAssertion.reason_code
    });
  }

  const accessRecord = createAccessRecord(input, paymentBoundary, "checkout_created", "provider_checkout_created");

  const providerSessionRequest = deepFreeze({
    provider: input.provider,
    checkout_mode: input.checkout_mode,
    provider_price_id: input.provider_price_id,
    quantity: input.seat_limit,
    success_url: input.success_url,
    cancel_url: input.cancel_url,
    idempotency_key: input.idempotency_key,
    metadata: deepFreeze({
      slice: S_V1_P_02_STRIPE_CHECKOUT_CONTROLLED_LAUNCH_VERSION,
      plan_id: input.plan_id,
      actor_id: input.actor_id,
      subject_id: input.subject_id,
      billing_access_record_hash: accessRecord.record_hash
    }),
    live_provider_call: "not_performed_in_contract_slice"
  });

  const material = deepFreeze({
    contract_version: S_V1_P_02_STRIPE_CHECKOUT_CONTROLLED_LAUNCH_VERSION,
    status: "controlled_launch_checkout_created",
    reason_code: CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.ALLOWED,
    provider: input.provider,
    checkout_mode: input.checkout_mode,
    billing_access_record_hash: accessRecord.record_hash,
    deterministic_probe_hash: probe.deterministic_probe_hash,
    payment_boundary_record_hash: paymentBoundary.record_hash,
    ...deterministicSurfaceState()
  });

  return deepFreeze({
    ok: true,
    ...material,
    provider_session_request: providerSessionRequest,
    billing_access_record: accessRecord,
    payment_boundary_record: paymentBoundary,
    record_hash: sha256Hex(canonicalJson(material))
  });
}

export function handleControlledLaunchCheckoutWebhook(input) {
  if (!isPlainObject(input)) {
    return fail(CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.INPUT_REQUIRED);
  }

  const keyFailure = assertExactKeys(input, WEBHOOK_INPUT_KEYS, CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.INPUT_REQUIRED, "input");
  if (keyFailure) return keyFailure;

  if (!CONTROLLED_LAUNCH_CHECKOUT_PROVIDERS.includes(input.provider)) {
    return fail(CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.PROVIDER_NOT_SUPPORTED, {
      provider: input.provider ?? null
    });
  }

  if (!SUPPORTED_WEBHOOK_EVENTS.includes(input.event_type)) {
    return fail(CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.WEBHOOK_EVENT_NOT_SUPPORTED, {
      event_type: input.event_type ?? null
    });
  }

  const accessKeyFailure = assertExactKeys(
    input.billing_access_record,
    ACCESS_RECORD_KEYS,
    CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.ACCESS_RECORD_REQUIRED,
    "billing_access_record"
  );
  if (accessKeyFailure) return accessKeyFailure;

  for (const field of ["event_id", "provider_session_id", "idempotency_key", "received_at"]) {
    const failure = assertNonEmptyString(input[field], CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.INPUT_REQUIRED, field);
    if (failure) return failure;
  }

  const probe = buildPaymentNoCouplingProbe(input.deterministic_probe);
  if (!probe.ok) {
    return fail(CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.PAYMENT_BOUNDARY_REJECTED, {
      reason_code: probe.reason_code
    });
  }

  const accessState = input.event_type === "checkout.session.completed"
    ? "access_active"
    : "access_required";

  const billingAccessState = input.event_type === "checkout.session.completed"
    ? "access_active"
    : "access_required";

  const billingStatus = input.event_type === "checkout.session.completed"
    ? "payment_confirmed"
    : input.event_type === "checkout.session.expired"
      ? "checkout_expired"
      : "payment_failed";

  const paymentBoundaryInput = {
    provider: input.provider,
    plan_id: input.billing_access_record.plan_id,
    seat_limit: input.billing_access_record.seat_limit,
    actor_id: input.billing_access_record.actor_id,
    subject_id: input.billing_access_record.subject_id,
    requested_at: input.received_at,
    deterministic_probe: input.deterministic_probe
  };

  const paymentBoundary = createPaymentBoundaryForCheckout(paymentBoundaryInput, accessState);
  if (!paymentBoundary.ok) {
    return fail(CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.PAYMENT_BOUNDARY_REJECTED, {
      reason_code: paymentBoundary.reason_code
    });
  }

  const updatedRecord = withRecordHash({
    ...withoutRecordHash(input.billing_access_record),
    provider_session_id: input.provider_session_id,
    billing_access_state: billingAccessState,
    billing_status: billingStatus,
    updated_at: input.received_at,
    payment_boundary_record_hash: paymentBoundary.record_hash,
    ...deterministicSurfaceState()
  });

  const material = deepFreeze({
    contract_version: S_V1_P_02_STRIPE_CHECKOUT_CONTROLLED_LAUNCH_VERSION,
    status: "controlled_launch_webhook_recorded",
    reason_code: CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.ALLOWED,
    provider: input.provider,
    event_id: input.event_id,
    event_type: input.event_type,
    billing_access_record_hash: updatedRecord.record_hash,
    deterministic_probe_hash: probe.deterministic_probe_hash,
    payment_boundary_record_hash: paymentBoundary.record_hash,
    ...deterministicSurfaceState()
  });

  return deepFreeze({
    ok: true,
    ...material,
    billing_access_record: updatedRecord,
    payment_boundary_record: paymentBoundary,
    record_hash: sha256Hex(canonicalJson(material))
  });
}

export function assertControlledLaunchCheckoutNoEngineMutation(record) {
  if (!isPlainObject(record) || record.ok !== true) {
    return fail(CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.INPUT_REQUIRED, {
      field: "record"
    });
  }

  for (const key of CONTROLLED_LAUNCH_FORBIDDEN_EFFECTS) {
    if (record[key] !== "not_mutated") {
      return fail(CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.ENGINE_MUTATION_REJECTED, {
        field: key,
        value: record[key] ?? null
      });
    }

    if (record.billing_access_record?.[key] !== "not_mutated") {
      return fail(CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.ENGINE_MUTATION_REJECTED, {
        field: `billing_access_record.${key}`,
        value: record.billing_access_record?.[key] ?? null
      });
    }
  }

  return deepFreeze({
    ok: true,
    status: "controlled_launch_checkout_no_engine_mutation_asserted",
    record_hash: record.record_hash
  });
}