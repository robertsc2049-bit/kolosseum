// DEV NOTE: FULL-UI-31 / S-V1-P-06 - device sync contract-style ingestion.
// Pure validation and record shaping lives in src/v1DeviceSyncContract.mjs;
// this service bridges that pure contract to real beta_product_records
// persistence, mirroring body_metrics_service.ts's independent-fact
// pattern. A device connection is an append-only fact stream keyed by
// connection_id (latest row wins, mirroring habit_definition's archival
// pattern) - connect/disconnect never UPDATEs or DELETEs a row. Metrics
// with a body_metric_entry equivalent (weight) route there with source
// "device_synced"; metrics with no equivalent (heart rate, steps, sleep)
// persist as their own device_metric_entry fact. Ownership/relationship
// checks are duplicated locally here, mirroring every other service in
// this file family.

import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import {
  loadBeta17StoredCoachContext,
  persistBetaProductRecord
} from "./beta_product_record_store.js";
import {
  createDeviceConnection,
  disconnectDeviceConnection,
  handleDeviceSyncIngestionWebhook
} from "../v1DeviceSyncContract.mjs";
import { logBodyMetricEntryAsDeviceSync } from "./body_metrics_service.js";

type JsonRecord = Record<string, unknown>;

export class DeviceSyncError extends Error {
  readonly status: number;

  constructor(reason: string, status = 400) {
    super(reason.startsWith("device_sync_") ? reason : `device_sync_${reason}`);
    this.name = "DeviceSyncError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (isRecord(value)) {
    const output: JsonRecord = {};
    for (const key of Object.keys(value).sort()) {
      output[key] = canonicalise(value[key]);
    }
    return output;
  }
  return value;
}

function sha256(value: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalise(value)), "utf8")
    .digest("hex");
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      if (child !== null && typeof child === "object" && !Object.isFrozen(child)) {
        deepFreeze(child);
      }
    }
  }
  return value;
}

const FACTUAL_BOUNDARY_FLAGS = Object.freeze({
  factual_user_supplied_state: true as const,
  immutable_reference_history: true as const,
  inference_applied: false as const,
  readiness_semantics: false as const,
  safety_semantics: false as const,
  suitability_semantics: false as const,
  recommendation_semantics: false as const,
  engine_visible: false as const,
  compile_reference_visible: false as const
});

async function requireCoachAthleteAccess(coachUserId: string, athleteUserId: string): Promise<void> {
  const context = await loadBeta17StoredCoachContext(coachUserId, athleteUserId);
  if (!context) {
    throw new DeviceSyncError("relationship_access_denied", 403);
  }

  const profile = isRecord(context.coach_profile) ? context.coach_profile : {};
  const relationship = isRecord(context.relationship) ? context.relationship : {};

  if (
    profile.account_role !== "coach" ||
    profile.account_state !== "active" ||
    relationship.relationship_state !== "accepted" ||
    relationship.coach_user_id !== coachUserId ||
    relationship.athlete_user_id !== athleteUserId
  ) {
    throw new DeviceSyncError("relationship_access_denied", 403);
  }
}

async function loadLatestDeviceConnectionSnapshots(athleteUserId: string): Promise<Readonly<JsonRecord>[]> {
  const result = await pool.query(
    `
    SELECT DISTINCT ON (record_id) record_payload
    FROM beta_product_records
    WHERE
      subject_user_id = $1
      AND record_type = 'device_connection_record'
    ORDER BY
      record_id,
      effective_at DESC,
      created_at DESC,
      record_sha256 DESC
    `,
    [athleteUserId]
  );

  const connections: Readonly<JsonRecord>[] = [];
  for (const row of result.rows ?? []) {
    if (isRecord(row.record_payload)) {
      connections.push(Object.freeze(row.record_payload));
    }
  }
  return connections;
}

async function loadLatestDeviceConnectionSnapshot(
  athleteUserId: string,
  connectionId: string
): Promise<Readonly<JsonRecord> | null> {
  const result = await pool.query(
    `
    SELECT record_payload
    FROM beta_product_records
    WHERE
      subject_user_id = $1
      AND record_type = 'device_connection_record'
      AND record_payload->>'connection_id' = $2
    ORDER BY
      effective_at DESC,
      created_at DESC,
      record_sha256 DESC
    LIMIT 1
    `,
    [athleteUserId, connectionId]
  );
  const payload = result.rows?.[0]?.record_payload;
  return isRecord(payload) ? Object.freeze(payload) : null;
}

export async function connectDevice(
  athleteUserId: string,
  input: { provider?: unknown; provider_account_id?: unknown }
): Promise<Readonly<JsonRecord>> {
  const athlete = cleanString(athleteUserId);
  if (!athlete) {
    throw new DeviceSyncError("athlete_identity_required");
  }

  const requestedAt = new Date().toISOString();
  const result = createDeviceConnection({
    provider: input.provider,
    athlete_id: athlete,
    provider_account_id: input.provider_account_id,
    requested_at: requestedAt,
    deterministic_probe: null
  });

  if (!result.ok) {
    throw new DeviceSyncError(result.reason_code, 400);
  }

  const contractRecord = result.device_connection_record;
  const recordWithoutHash = {
    ...contractRecord,
    athlete_user_id: athlete,
    ...FACTUAL_BOUNDARY_FLAGS
  };
  delete (recordWithoutHash as JsonRecord).record_hash;

  const record = deepFreeze({
    ...recordWithoutHash,
    record_sha256: sha256(recordWithoutHash)
  });

  return persistBetaProductRecord(record);
}

export async function disconnectDevice(
  athleteUserId: string,
  connectionIdInput: string
): Promise<Readonly<JsonRecord>> {
  const athlete = cleanString(athleteUserId);
  const connectionId = cleanString(connectionIdInput);
  if (!athlete || !connectionId) {
    throw new DeviceSyncError("connection_identity_required");
  }

  const current = await loadLatestDeviceConnectionSnapshot(athlete, connectionId);
  if (!current) {
    throw new DeviceSyncError("connection_not_found", 404);
  }
  if (current.connection_status === "disconnected") {
    return current;
  }

  const requestedAt = new Date().toISOString();
  const result = disconnectDeviceConnection({
    provider: current.provider,
    athlete_id: athlete,
    connection_id: connectionId,
    requested_at: requestedAt,
    deterministic_probe: null
  });

  if (!result.ok) {
    throw new DeviceSyncError(result.reason_code, 400);
  }

  const contractRecord = result.device_connection_record;
  const recordWithoutHash = {
    ...current,
    ...contractRecord,
    athlete_user_id: athlete,
    ...FACTUAL_BOUNDARY_FLAGS
  };
  delete (recordWithoutHash as JsonRecord).record_hash;
  delete (recordWithoutHash as JsonRecord).record_sha256;

  const record = deepFreeze({
    ...recordWithoutHash,
    record_sha256: sha256(recordWithoutHash)
  });

  return persistBetaProductRecord(record);
}

export async function listDeviceConnectionsForAthlete(athleteUserId: string): Promise<Readonly<JsonRecord>[]> {
  const athlete = cleanString(athleteUserId);
  if (!athlete) {
    throw new DeviceSyncError("athlete_identity_required");
  }
  return loadLatestDeviceConnectionSnapshots(athlete);
}

type IngestInput = Record<string, unknown>;

export async function ingestDeviceMetric(
  athleteUserId: string,
  input: IngestInput
): Promise<Readonly<JsonRecord>> {
  const athlete = cleanString(athleteUserId);
  if (!athlete) {
    throw new DeviceSyncError("athlete_identity_required");
  }

  const connectionId = cleanString(input.connection_id);
  if (!connectionId) {
    throw new DeviceSyncError("connection_required");
  }

  const connection = await loadLatestDeviceConnectionSnapshot(athlete, connectionId);
  if (!connection) {
    throw new DeviceSyncError("connection_not_found", 404);
  }
  if (connection.connection_status !== "active") {
    throw new DeviceSyncError("connection_not_active", 409);
  }

  // DEV NOTE: the client's raw input is spread first, THEN the
  // server-controlled fields are forced - this is deliberate. Any
  // unexpected key the client sent (a provider-computed score field
  // included) must reach the contract's exact-key allowlist check so it
  // is rejected outright, never silently stripped before validation.
  const receivedAt = new Date().toISOString();
  const result = handleDeviceSyncIngestionWebhook({
    ...input,
    provider: connection.provider,
    connection_id: connectionId,
    athlete_id: athlete,
    event_id: crypto.randomUUID(),
    received_at: receivedAt,
    idempotency_key: crypto.randomUUID(),
    deterministic_probe: null
  });

  if (!result.ok) {
    throw new DeviceSyncError(result.reason_code, 400);
  }

  if (result.routing_target === "body_metric_entry") {
    return logBodyMetricEntryAsDeviceSync(athlete, {
      metric_type: result.metric_type,
      value: result.value,
      effective_date: String(result.reported_at).slice(0, 10)
    });
  }

  const metricEntryId = `device_metric_entry_${sha256({
    connectionId,
    metricType: result.metric_type,
    reportedAt: result.reported_at
  }).slice(0, 24)}`;

  const recordWithoutHash = {
    record_type: "device_metric_entry" as const,
    contract_version: result.contract_version,
    metric_entry_id: metricEntryId,
    athlete_user_id: athlete,
    connection_id: connectionId,
    provider: result.provider,
    metric_type: result.metric_type,
    value: result.value,
    unit: result.unit,
    source: "device_synced" as const,
    reported_at_iso8601: result.reported_at,
    ingested_at_iso8601: result.received_at,
    ...FACTUAL_BOUNDARY_FLAGS
  };

  const record = deepFreeze({
    ...recordWithoutHash,
    record_sha256: sha256(recordWithoutHash)
  });

  return persistBetaProductRecord(record);
}

async function queryDeviceMetricHistory(athleteUserId: string): Promise<Readonly<JsonRecord>[]> {
  const result = await pool.query(
    `
    SELECT record_payload
    FROM beta_product_records
    WHERE
      subject_user_id = $1
      AND record_type = 'device_metric_entry'
    ORDER BY
      effective_at DESC,
      created_at DESC,
      record_id DESC,
      record_sha256 DESC
    `,
    [athleteUserId]
  );

  const entries: Readonly<JsonRecord>[] = [];
  for (const row of result.rows ?? []) {
    if (isRecord(row.record_payload)) {
      entries.push(Object.freeze(row.record_payload));
    }
  }
  return entries;
}

export async function listDeviceMetricHistoryForAthlete(athleteUserId: string): Promise<Readonly<JsonRecord>[]> {
  const athlete = cleanString(athleteUserId);
  if (!athlete) {
    throw new DeviceSyncError("athlete_identity_required");
  }
  return queryDeviceMetricHistory(athlete);
}

export async function listDeviceConnectionsForCoach(
  coachUserId: string,
  athleteUserId: string
): Promise<Readonly<JsonRecord>[]> {
  const coach = cleanString(coachUserId);
  const athlete = cleanString(athleteUserId);
  if (!coach || !athlete) {
    throw new DeviceSyncError("identity_required");
  }
  await requireCoachAthleteAccess(coach, athlete);
  return loadLatestDeviceConnectionSnapshots(athlete);
}

export async function listDeviceMetricHistoryForCoach(
  coachUserId: string,
  athleteUserId: string
): Promise<Readonly<JsonRecord>[]> {
  const coach = cleanString(coachUserId);
  const athlete = cleanString(athleteUserId);
  if (!coach || !athlete) {
    throw new DeviceSyncError("identity_required");
  }
  await requireCoachAthleteAccess(coach, athlete);
  return queryDeviceMetricHistory(athlete);
}
