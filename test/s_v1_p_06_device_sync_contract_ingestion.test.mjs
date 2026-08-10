import assert from "node:assert/strict";
import test from "node:test";

import {
  DEVICE_SYNC_FORBIDDEN_PROVIDER_SCORE_FIELDS,
  DEVICE_SYNC_METRIC_TYPES,
  DEVICE_SYNC_PROVIDERS,
  DEVICE_SYNC_REASON_CODES,
  assertDeviceSyncNoEngineMutation,
  createDeviceConnection,
  disconnectDeviceConnection,
  handleDeviceSyncIngestionWebhook
} from "../src/v1DeviceSyncContract.mjs";

function baseConnectionInput(overrides = {}) {
  return {
    provider: "garmin",
    athlete_id: "athlete_1",
    provider_account_id: "garmin_raw_account_12345",
    requested_at: "2026-01-01T00:00:00.000Z",
    deterministic_probe: null,
    ...overrides
  };
}

function baseIngestionInput(connectionId, overrides = {}) {
  return {
    provider: "garmin",
    connection_id: connectionId,
    athlete_id: "athlete_1",
    event_id: "evt_1",
    metric_type: "resting_heart_rate_bpm",
    value: 55,
    unit: "bpm",
    reported_at: "2026-01-01T06:00:00.000Z",
    received_at: "2026-01-01T06:05:00.000Z",
    idempotency_key: "idem_1",
    deterministic_probe: null,
    ...overrides
  };
}

test("device connection is a frozen record with an opaque provider account reference", () => {
  const result = createDeviceConnection(baseConnectionInput());

  assert.equal(result.ok, true);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.device_connection_record), true);
  assert.equal(result.device_connection_record.connection_status, "active");
  assert.equal(result.device_connection_record.live_provider_call, "not_performed_in_contract_slice");

  const providerAccountRef = result.device_connection_record.provider_account_ref;
  assert.equal(typeof providerAccountRef, "string");
  assert.ok(providerAccountRef.startsWith("opaque_"));
  assert.ok(!JSON.stringify(result).includes("garmin_raw_account_12345"), "raw provider_account_id must never appear in the output");
});

test("reconnecting the same provider/athlete pair is idempotent on connection_id", () => {
  const first = createDeviceConnection(baseConnectionInput());
  const second = createDeviceConnection(baseConnectionInput({ provider_account_id: "a_different_raw_id" }));

  assert.equal(first.device_connection_record.connection_id, second.device_connection_record.connection_id);
});

test("connect fails closed for an unsupported provider", () => {
  const result = createDeviceConnection(baseConnectionInput({ provider: "some_other_wearable" }));
  assert.equal(result.ok, false);
  assert.equal(result.reason_code, DEVICE_SYNC_REASON_CODES.PROVIDER_NOT_SUPPORTED);
});

test("ingestion webhook rejects a payload carrying a provider-computed score field outright", () => {
  const connection = createDeviceConnection(baseConnectionInput());
  const connectionId = connection.device_connection_record.connection_id;

  for (const forbiddenField of DEVICE_SYNC_FORBIDDEN_PROVIDER_SCORE_FIELDS) {
    const payload = baseIngestionInput(connectionId, { [forbiddenField]: 87 });
    const result = handleDeviceSyncIngestionWebhook(payload);
    assert.equal(result.ok, false, `expected ${forbiddenField} to be rejected`);
    assert.equal(result.reason_code, DEVICE_SYNC_REASON_CODES.PROVIDER_SCORE_FIELD_REJECTED);
    assert.equal(result.details.field, forbiddenField);
  }
});

test("ingestion webhook rejects any other unknown field the same way (exact-key allowlist, not a deny-list)", () => {
  const connection = createDeviceConnection(baseConnectionInput());
  const connectionId = connection.device_connection_record.connection_id;

  const result = handleDeviceSyncIngestionWebhook(baseIngestionInput(connectionId, { some_unknown_field: true }));
  assert.equal(result.ok, false);
  assert.equal(result.reason_code, DEVICE_SYNC_REASON_CODES.INPUT_REQUIRED);
});

test("ingestion webhook routes body_weight_kg to body_metric_entry and other metric types to device_metric_entry", () => {
  const connection = createDeviceConnection(baseConnectionInput());
  const connectionId = connection.device_connection_record.connection_id;

  for (const metricType of DEVICE_SYNC_METRIC_TYPES) {
    const result = handleDeviceSyncIngestionWebhook(baseIngestionInput(connectionId, { metric_type: metricType, value: 10 }));
    assert.equal(result.ok, true, `expected ${metricType} to be accepted`);
    assert.equal(
      result.routing_target,
      metricType === "body_weight_kg" ? "body_metric_entry" : "device_metric_entry"
    );
  }
});

test("ingestion webhook fails closed for an unsupported metric_type or non-finite value", () => {
  const connection = createDeviceConnection(baseConnectionInput());
  const connectionId = connection.device_connection_record.connection_id;

  const unsupportedMetric = handleDeviceSyncIngestionWebhook(
    baseIngestionInput(connectionId, { metric_type: "vo2_max" })
  );
  assert.equal(unsupportedMetric.ok, false);
  assert.equal(unsupportedMetric.reason_code, DEVICE_SYNC_REASON_CODES.METRIC_TYPE_NOT_SUPPORTED);

  const invalidValue = handleDeviceSyncIngestionWebhook(
    baseIngestionInput(connectionId, { value: "not_a_number" })
  );
  assert.equal(invalidValue.ok, false);
  assert.equal(invalidValue.reason_code, DEVICE_SYNC_REASON_CODES.VALUE_INVALID);
});

test("disconnect never deletes or edits a prior fact - it produces a new, separately hashed connection_status fact", () => {
  const connection = createDeviceConnection(baseConnectionInput());
  const connectionId = connection.device_connection_record.connection_id;

  const disconnection = disconnectDeviceConnection({
    provider: "garmin",
    athlete_id: "athlete_1",
    connection_id: connectionId,
    requested_at: "2026-01-02T00:00:00.000Z",
    deterministic_probe: null
  });

  assert.equal(disconnection.ok, true);
  assert.equal(disconnection.device_connection_record.connection_status, "disconnected");
  assert.notEqual(disconnection.device_connection_record.record_hash, connection.device_connection_record.record_hash);
  assert.equal(disconnection.device_connection_record.connection_id, connectionId);
});

test("device sync result never mutates a deterministic engine surface", () => {
  const connection = createDeviceConnection(baseConnectionInput());
  const connectionId = connection.device_connection_record.connection_id;
  const ingestion = handleDeviceSyncIngestionWebhook(baseIngestionInput(connectionId));

  for (const result of [connection, ingestion]) {
    const assertion = assertDeviceSyncNoEngineMutation(result);
    assert.equal(assertion.ok, true);
  }
});

test("assertDeviceSyncNoEngineMutation fails closed if any deterministic surface is mutated", () => {
  const connection = createDeviceConnection(baseConnectionInput());
  const tampered = { ...connection, engine_legality: "mutated" };

  const assertion = assertDeviceSyncNoEngineMutation(tampered);
  assert.equal(assertion.ok, false);
  assert.equal(assertion.reason_code, DEVICE_SYNC_REASON_CODES.ENGINE_MUTATION_REJECTED);
});

test("DEVICE_SYNC_PROVIDERS is exactly the four simulated providers named by the plan", () => {
  assert.deepEqual([...DEVICE_SYNC_PROVIDERS].sort(), ["apple_health", "garmin", "manual_import", "whoop"]);
});
