// DEV NOTE: FULL-UI-29 - athlete body-metric tracking. Each entry is an
// independent immutable beta_product_records fact (record_type
// "body_metric_entry"), same independent-list shape as progress photos -
// not a chained "profile". Both the athlete (self) and their accepted
// coach may log entries; the service - never the client - sets `source`
// based on who is actually authenticated, mirroring the Metric Threshold
// Marker's source-field precedent. Ownership/relationship checks are
// duplicated locally here rather than shared, mirroring every other
// service in this file family.

import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import {
  loadBeta17StoredCoachContext,
  persistBetaProductRecord
} from "./beta_product_record_store.js";
import { normaliseBodyMetricEntry } from "../../shared/body-metrics/bodyMetricsAndHabitsLifecycle.mjs";

type JsonRecord = Record<string, unknown>;

export class BodyMetricsError extends Error {
  readonly status: number;

  constructor(reason: string, status = 400) {
    super(`body_metrics_${reason}`);
    this.name = "BodyMetricsError";
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

async function requireCoachAthleteAccess(coachUserId: string, athleteUserId: string): Promise<void> {
  const context = await loadBeta17StoredCoachContext(coachUserId, athleteUserId);
  if (!context) {
    throw new BodyMetricsError("relationship_access_denied", 403);
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
    throw new BodyMetricsError("relationship_access_denied", 403);
  }
}

type BodyMetricLogInput = {
  metric_type?: unknown;
  value?: unknown;
  effective_date?: unknown;
  note?: unknown;
};

async function persistBodyMetricEntry(
  athleteUserId: string,
  loggedByUserId: string,
  source: "athlete_entered" | "coach_entered" | "device_synced",
  input: BodyMetricLogInput
): Promise<Readonly<JsonRecord>> {
  let normalised;
  try {
    normalised = normaliseBodyMetricEntry({ ...input, source });
  }
  catch (error) {
    throw new BodyMetricsError((error as { code?: string }).code ?? "entry_invalid");
  }

  const metricEntryId = `body_metric_entry_${sha256({
    athleteUserId,
    normalised,
    at: crypto.randomUUID()
  }).slice(0, 24)}`;

  const recordWithoutHash = {
    record_type: "body_metric_entry" as const,
    contract_version: "full_ui_29.1.0.0",
    metric_entry_id: metricEntryId,
    athlete_user_id: athleteUserId,
    logged_by_user_id: loggedByUserId,
    metric_type: normalised.metric_type,
    value: normalised.value,
    unit: normalised.unit,
    effective_date: normalised.effective_date,
    source: normalised.source,
    note: normalised.note,
    logged_at_iso8601: new Date().toISOString(),
    ordering_time_authority: "postgres_server_clock" as const,
    factual_user_supplied_state: true as const,
    immutable_reference_history: true as const,
    inference_applied: false as const,
    readiness_semantics: false as const,
    safety_semantics: false as const,
    suitability_semantics: false as const,
    recommendation_semantics: false as const,
    engine_visible: false as const,
    compile_reference_visible: false as const
  };

  const record = deepFreeze({
    ...recordWithoutHash,
    record_sha256: sha256(recordWithoutHash)
  });

  return persistBetaProductRecord(record);
}

export async function logBodyMetricEntryAsAthlete(
  athleteUserId: string,
  input: BodyMetricLogInput
): Promise<Readonly<JsonRecord>> {
  const athlete = cleanString(athleteUserId);
  if (!athlete) {
    throw new BodyMetricsError("athlete_identity_required");
  }
  return persistBodyMetricEntry(athlete, athlete, "athlete_entered", input);
}

export async function logBodyMetricEntryAsDeviceSync(
  athleteUserId: string,
  input: BodyMetricLogInput
): Promise<Readonly<JsonRecord>> {
  const athlete = cleanString(athleteUserId);
  if (!athlete) {
    throw new BodyMetricsError("athlete_identity_required");
  }
  if (cleanString(input.metric_type) !== "body_weight_kg") {
    throw new BodyMetricsError("device_metric_type_not_routed_here", 400);
  }
  return persistBodyMetricEntry(athlete, athlete, "device_synced", input);
}

export async function logBodyMetricEntryAsCoach(
  coachUserId: string,
  athleteUserId: string,
  input: BodyMetricLogInput
): Promise<Readonly<JsonRecord>> {
  const coach = cleanString(coachUserId);
  const athlete = cleanString(athleteUserId);
  if (!coach || !athlete) {
    throw new BodyMetricsError("identity_required");
  }
  await requireCoachAthleteAccess(coach, athlete);
  return persistBodyMetricEntry(athlete, coach, "coach_entered", input);
}

async function queryBodyMetricHistory(athleteUserId: string): Promise<Readonly<JsonRecord>[]> {
  const result = await pool.query(
    `
    SELECT record_payload
    FROM beta_product_records
    WHERE
      subject_user_id = $1
      AND record_type = 'body_metric_entry'
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

export async function listBodyMetricHistoryForAthlete(athleteUserId: string): Promise<Readonly<JsonRecord>[]> {
  const athlete = cleanString(athleteUserId);
  if (!athlete) {
    throw new BodyMetricsError("athlete_identity_required");
  }
  return queryBodyMetricHistory(athlete);
}

export async function listBodyMetricHistoryForCoach(
  coachUserId: string,
  athleteUserId: string
): Promise<Readonly<JsonRecord>[]> {
  const coach = cleanString(coachUserId);
  const athlete = cleanString(athleteUserId);
  if (!coach || !athlete) {
    throw new BodyMetricsError("identity_required");
  }
  await requireCoachAthleteAccess(coach, athlete);
  return queryBodyMetricHistory(athlete);
}
