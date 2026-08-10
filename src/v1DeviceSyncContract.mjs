import { createHash } from "node:crypto";

/**
 * DEV NOTE: S-V1-P-06 device sync contract-style ingestion.
 * Purpose: creates simulated device-connection records and validates ingested metric payloads.
 * Boundary: creates factual connection/metric records only; no live provider SDK call, no secret or token storage, no provider-computed score stored.
 * Determinism: all record IDs and hashes derive from explicit input; no wall-clock, environment, or network state.
 * Failure: invalid input, unsupported provider/metric, or any provider-computed score field fails closed with a stable reason code.
 */
export const S_V1_P_06_DEVICE_SYNC_CONTRACT_INGESTION_VERSION = "S-V1-P-06";

export const DEVICE_SYNC_PROVIDERS = Object.freeze([
  "apple_health",
  "garmin",
  "whoop",
  "manual_import"
]);

export const DEVICE_SYNC_METRIC_TYPES = Object.freeze([
  "resting_heart_rate_bpm",
  "steps_count",
  "sleep_duration_minutes",
  "body_weight_kg"
]);

export const DEVICE_SYNC_BODY_METRIC_ROUTED_TYPES = Object.freeze([
  "body_weight_kg"
]);

export const DEVICE_SYNC_FORBIDDEN_PROVIDER_SCORE_FIELDS = Object.freeze([
  "readiness_score",
  "recovery_score",
  "strain_score",
  "body_battery",
  "recovery_percentage",
  "training_readiness",
  "sleep_score",
  "stress_score",
  "fitness_age"
]);

export const DEVICE_SYNC_REASON_CODES = Object.freeze({
  ALLOWED: "device_sync_allowed",
  INPUT_REQUIRED: "device_sync_input_required",
  PROVIDER_NOT_SUPPORTED: "device_sync_provider_not_supported",
  ACCOUNT_ID_REQUIRED: "device_sync_account_id_required",
  METRIC_TYPE_NOT_SUPPORTED: "device_sync_metric_type_not_supported",
  VALUE_INVALID: "device_sync_value_invalid",
  PROVIDER_SCORE_FIELD_REJECTED: "device_sync_provider_score_field_rejected",
  CONNECTION_REQUIRED: "device_sync_connection_required",
  ENGINE_MUTATION_REJECTED: "device_sync_engine_mutation_rejected"
});

export const DEVICE_SYNC_FORBIDDEN_EFFECTS = Object.freeze([
  "engine_legality",
  "compile_output",
  "substitution_selection",
  "replay_record",
  "proof_record",
  "factual_history_record"
]);

const CONNECTION_INPUT_KEYS = Object.freeze([
  "provider",
  "athlete_id",
  "provider_account_id",
  "requested_at",
  "deterministic_probe"
]);

const DISCONNECTION_INPUT_KEYS = Object.freeze([
  "provider",
  "athlete_id",
  "connection_id",
  "requested_at",
  "deterministic_probe"
]);

const INGESTION_INPUT_KEYS = Object.freeze([
  "provider",
  "connection_id",
  "athlete_id",
  "event_id",
  "metric_type",
  "value",
  "unit",
  "reported_at",
  "received_at",
  "idempotency_key",
  "deterministic_probe"
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
    status: "device_sync_blocked",
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

function assertNoForbiddenProviderScoreField(value) {
  if (!isPlainObject(value)) return null;

  for (const forbiddenField of DEVICE_SYNC_FORBIDDEN_PROVIDER_SCORE_FIELDS) {
    if (forbiddenField in value) {
      return fail(DEVICE_SYNC_REASON_CODES.PROVIDER_SCORE_FIELD_REJECTED, {
        field: forbiddenField
      });
    }
  }

  return null;
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

function buildConnectionId(provider, athleteId) {
  return "device_connection_" + sha256Hex(canonicalJson({ provider, athleteId })).slice(0, 24);
}

/**
 * FUNCTION NOTE:
 * Purpose: creates a simulated device-connection record with an opaque, hashed provider account reference.
 * Boundary: no live provider call; the raw provider_account_id is never stored, only its hash.
 * Determinism: connection_id derives from (provider, athlete_id) only, so reconnecting the same pair is idempotent.
 * Failure: unsupported provider, missing athlete_id/provider_account_id fail closed.
 */
export function createDeviceConnection(input) {
  if (!isPlainObject(input)) {
    return fail(DEVICE_SYNC_REASON_CODES.INPUT_REQUIRED);
  }

  const keyFailure = assertExactKeys(input, CONNECTION_INPUT_KEYS, DEVICE_SYNC_REASON_CODES.INPUT_REQUIRED, "input");
  if (keyFailure) return keyFailure;

  if (!DEVICE_SYNC_PROVIDERS.includes(input.provider)) {
    return fail(DEVICE_SYNC_REASON_CODES.PROVIDER_NOT_SUPPORTED, {
      provider: input.provider ?? null
    });
  }

  for (const field of ["athlete_id", "requested_at"]) {
    const failure = assertNonEmptyString(input[field], DEVICE_SYNC_REASON_CODES.INPUT_REQUIRED, field);
    if (failure) return failure;
  }

  const accountIdFailure = assertNonEmptyString(
    input.provider_account_id,
    DEVICE_SYNC_REASON_CODES.ACCOUNT_ID_REQUIRED,
    "provider_account_id"
  );
  if (accountIdFailure) return accountIdFailure;

  const connectionId = buildConnectionId(input.provider, input.athlete_id);
  const providerAccountRef = "opaque_" + sha256Hex(canonicalJson({
    provider: input.provider,
    connectionId,
    providerAccountId: input.provider_account_id
  })).slice(0, 32);

  const connectionRecord = withRecordHash({
    record_type: "device_connection_record",
    contract_version: S_V1_P_06_DEVICE_SYNC_CONTRACT_INGESTION_VERSION,
    connection_id: connectionId,
    provider: input.provider,
    provider_account_ref: providerAccountRef,
    connection_status: "active",
    connected_at_iso8601: input.requested_at,
    updated_at_iso8601: input.requested_at,
    live_provider_call: "not_performed_in_contract_slice",
    ...deterministicSurfaceState()
  });

  const material = deepFreeze({
    contract_version: S_V1_P_06_DEVICE_SYNC_CONTRACT_INGESTION_VERSION,
    status: "device_connection_created",
    reason_code: DEVICE_SYNC_REASON_CODES.ALLOWED,
    provider: input.provider,
    connection_id: connectionId,
    ...deterministicSurfaceState()
  });

  return deepFreeze({
    ok: true,
    ...material,
    device_connection_record: connectionRecord,
    record_hash: sha256Hex(canonicalJson(material))
  });
}

/**
 * FUNCTION NOTE:
 * Purpose: creates a disconnection fact appended for an existing connection_id.
 * Boundary: no live provider call; disconnect never deletes prior facts, it appends a new status fact.
 * Determinism: output depends only on supplied input.
 * Failure: unsupported provider or missing connection_id/athlete_id fail closed.
 */
export function disconnectDeviceConnection(input) {
  if (!isPlainObject(input)) {
    return fail(DEVICE_SYNC_REASON_CODES.INPUT_REQUIRED);
  }

  const keyFailure = assertExactKeys(input, DISCONNECTION_INPUT_KEYS, DEVICE_SYNC_REASON_CODES.INPUT_REQUIRED, "input");
  if (keyFailure) return keyFailure;

  if (!DEVICE_SYNC_PROVIDERS.includes(input.provider)) {
    return fail(DEVICE_SYNC_REASON_CODES.PROVIDER_NOT_SUPPORTED, {
      provider: input.provider ?? null
    });
  }

  for (const field of ["athlete_id", "connection_id", "requested_at"]) {
    const failure = assertNonEmptyString(input[field], DEVICE_SYNC_REASON_CODES.CONNECTION_REQUIRED, field);
    if (failure) return failure;
  }

  const connectionRecord = withRecordHash({
    record_type: "device_connection_record",
    contract_version: S_V1_P_06_DEVICE_SYNC_CONTRACT_INGESTION_VERSION,
    connection_id: input.connection_id,
    provider: input.provider,
    connection_status: "disconnected",
    updated_at_iso8601: input.requested_at,
    live_provider_call: "not_performed_in_contract_slice",
    ...deterministicSurfaceState()
  });

  const material = deepFreeze({
    contract_version: S_V1_P_06_DEVICE_SYNC_CONTRACT_INGESTION_VERSION,
    status: "device_connection_disconnected",
    reason_code: DEVICE_SYNC_REASON_CODES.ALLOWED,
    provider: input.provider,
    connection_id: input.connection_id,
    ...deterministicSurfaceState()
  });

  return deepFreeze({
    ok: true,
    ...material,
    device_connection_record: connectionRecord,
    record_hash: sha256Hex(canonicalJson(material))
  });
}

/**
 * FUNCTION NOTE:
 * Purpose: validates one ingested device-metric webhook-shaped payload and decides its routing target.
 * Boundary: exact-key allowlist only - any provider-computed score field (readiness, recovery, strain, etc.)
 * is rejected outright as an unknown/forbidden key, never silently dropped or stored-then-hidden.
 * Determinism: routing_target is a pure function of metric_type.
 * Failure: unsupported provider/metric_type, non-finite value, or any forbidden score field fails closed.
 */
export function handleDeviceSyncIngestionWebhook(payload) {
  if (!isPlainObject(payload)) {
    return fail(DEVICE_SYNC_REASON_CODES.INPUT_REQUIRED);
  }

  const forbiddenFieldFailure = assertNoForbiddenProviderScoreField(payload);
  if (forbiddenFieldFailure) return forbiddenFieldFailure;

  const keyFailure = assertExactKeys(payload, INGESTION_INPUT_KEYS, DEVICE_SYNC_REASON_CODES.INPUT_REQUIRED, "payload");
  if (keyFailure) return keyFailure;

  if (!DEVICE_SYNC_PROVIDERS.includes(payload.provider)) {
    return fail(DEVICE_SYNC_REASON_CODES.PROVIDER_NOT_SUPPORTED, {
      provider: payload.provider ?? null
    });
  }

  if (!DEVICE_SYNC_METRIC_TYPES.includes(payload.metric_type)) {
    return fail(DEVICE_SYNC_REASON_CODES.METRIC_TYPE_NOT_SUPPORTED, {
      metric_type: payload.metric_type ?? null
    });
  }

  for (const field of ["connection_id", "athlete_id", "event_id", "reported_at", "received_at", "idempotency_key"]) {
    const failure = assertNonEmptyString(payload[field], DEVICE_SYNC_REASON_CODES.INPUT_REQUIRED, field);
    if (failure) return failure;
  }

  const value = Number(payload.value);
  if (!Number.isFinite(value)) {
    return fail(DEVICE_SYNC_REASON_CODES.VALUE_INVALID, { field: "value" });
  }

  const routingTarget = DEVICE_SYNC_BODY_METRIC_ROUTED_TYPES.includes(payload.metric_type)
    ? "body_metric_entry"
    : "device_metric_entry";

  const material = deepFreeze({
    contract_version: S_V1_P_06_DEVICE_SYNC_CONTRACT_INGESTION_VERSION,
    status: "device_sync_ingestion_accepted",
    reason_code: DEVICE_SYNC_REASON_CODES.ALLOWED,
    provider: payload.provider,
    connection_id: payload.connection_id,
    athlete_id: payload.athlete_id,
    metric_type: payload.metric_type,
    routing_target: routingTarget,
    value,
    unit: payload.unit ?? null,
    reported_at: payload.reported_at,
    received_at: payload.received_at,
    live_provider_call: "not_performed_in_contract_slice",
    ...deterministicSurfaceState()
  });

  return deepFreeze({
    ok: true,
    ...material,
    record_hash: sha256Hex(canonicalJson(material))
  });
}

/**
 * FUNCTION NOTE:
 * Purpose: proves a device-sync contract result never mutates a deterministic engine surface.
 * Boundary: pure assertion over the six deterministic surface fields.
 * Determinism: same input always yields the same assertion result.
 * Failure: any surface value other than "not_mutated" fails closed.
 */
export function assertDeviceSyncNoEngineMutation(record) {
  if (!isPlainObject(record) || record.ok !== true) {
    return fail(DEVICE_SYNC_REASON_CODES.INPUT_REQUIRED, { field: "record" });
  }

  for (const key of DEVICE_SYNC_FORBIDDEN_EFFECTS) {
    if (record[key] !== "not_mutated") {
      return fail(DEVICE_SYNC_REASON_CODES.ENGINE_MUTATION_REJECTED, {
        field: key,
        value: record[key] ?? null
      });
    }
  }

  return deepFreeze({
    ok: true,
    status: "device_sync_no_engine_mutation_asserted",
    record_hash: record.record_hash
  });
}
