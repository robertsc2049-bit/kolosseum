// DEV NOTE: FULL-UI-64 - athlete weekly check-in. A check-in is
// self-declared and self-submitted by the athlete only - there is no
// coach-facing write path anywhere in this file, mirroring
// habit_tracking_service.ts's and athlete_goals_service.ts's own rule that
// self-reported wellness data is the athlete's own report, never something
// a coach records on their behalf. Exactly one check-in is accepted per
// athlete per week_start_date - see weeklyCheckinLifecycle.mjs for why a
// second submission for an already-submitted week is rejected rather than
// silently overwritten.

import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import {
  loadBeta17StoredCoachContext,
  persistBetaProductRecord
} from "./beta_product_record_store.js";
import { normaliseWeeklyCheckin } from "../../shared/weekly-checkins/weeklyCheckinLifecycle.mjs";

type JsonRecord = Record<string, unknown>;

export class WeeklyCheckinError extends Error {
  readonly status: number;

  constructor(reason: string, status = 400) {
    super(`weekly_checkin_${reason}`);
    this.name = "WeeklyCheckinError";
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
    throw new WeeklyCheckinError("relationship_access_denied", 403);
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
    throw new WeeklyCheckinError("relationship_access_denied", 403);
  }
}

type WeeklyCheckinInput = {
  week_start_date?: unknown;
  energy_level?: unknown;
  motivation_level?: unknown;
  sleep_quality?: unknown;
  note?: unknown;
};

export async function submitWeeklyCheckin(
  athleteUserId: string,
  input: WeeklyCheckinInput
): Promise<Readonly<JsonRecord>> {
  const athlete = cleanString(athleteUserId);
  if (!athlete) {
    throw new WeeklyCheckinError("athlete_identity_required");
  }

  let normalised;
  try {
    normalised = normaliseWeeklyCheckin(input);
  }
  catch (error) {
    throw new WeeklyCheckinError((error as { code?: string }).code ?? "submission_invalid");
  }

  const checkinId = `weekly_checkin_${sha256({
    athlete,
    weekStartDate: normalised.week_start_date
  }).slice(0, 24)}`;

  const existingResult = await pool.query(
    `
    SELECT 1
    FROM beta_product_records
    WHERE
      record_type = 'weekly_checkin_entry'
      AND record_id = $1
      AND subject_user_id = $2
    LIMIT 1
    `,
    [checkinId, athlete]
  );
  if ((existingResult.rowCount ?? 0) > 0) {
    throw new WeeklyCheckinError("already_submitted_for_week", 409);
  }

  const recordWithoutHash = {
    record_type: "weekly_checkin_entry" as const,
    contract_version: "full_ui_64.1.0.0",
    checkin_id: checkinId,
    athlete_user_id: athlete,
    logged_by_user_id: athlete,
    week_start_date: normalised.week_start_date,
    energy_level: normalised.energy_level,
    motivation_level: normalised.motivation_level,
    sleep_quality: normalised.sleep_quality,
    note: normalised.note,
    submitted_at_iso8601: new Date().toISOString(),
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

async function queryWeeklyCheckins(athleteUserId: string): Promise<Readonly<JsonRecord>[]> {
  const result = await pool.query(
    `
    SELECT record_payload
    FROM beta_product_records
    WHERE
      subject_user_id = $1
      AND record_type = 'weekly_checkin_entry'
    ORDER BY
      record_payload->>'week_start_date' DESC,
      created_at DESC
    `,
    [athleteUserId]
  );

  const checkins: Readonly<JsonRecord>[] = [];
  for (const row of result.rows ?? []) {
    if (isRecord(row.record_payload)) {
      checkins.push(Object.freeze(row.record_payload));
    }
  }
  return checkins;
}

export async function listWeeklyCheckinsForAthlete(athleteUserId: string): Promise<Readonly<JsonRecord>[]> {
  const athlete = cleanString(athleteUserId);
  if (!athlete) {
    throw new WeeklyCheckinError("athlete_identity_required");
  }
  return queryWeeklyCheckins(athlete);
}

export async function listWeeklyCheckinsForCoach(
  coachUserId: string,
  athleteUserId: string
): Promise<Readonly<JsonRecord>[]> {
  const coach = cleanString(coachUserId);
  const athlete = cleanString(athleteUserId);
  if (!coach || !athlete) {
    throw new WeeklyCheckinError("identity_required");
  }
  await requireCoachAthleteAccess(coach, athlete);
  return queryWeeklyCheckins(athlete);
}
