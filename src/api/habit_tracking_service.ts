// DEV NOTE: FULL-UI-29 - athlete habit/streak tracking. A habit is
// self-defined and self-logged by the athlete only - there is no
// coach-facing write path anywhere in this file, since habit adherence is
// the athlete's own report, not something a coach records on their
// behalf. habit_definition and habit_completion are split the same way
// beta19_coach_event/beta19_event_athlete_link already split "the event"
// from "who's linked to it" - a low-frequency definition record from a
// high-frequency completion log. Streak counts are always computed on
// read from the raw completion-date set (computeHabitStreak) - never
// persisted, since a persisted derived number would drift from the facts
// it was computed from and couldn't be re-audited.

import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import {
  loadBeta17StoredCoachContext,
  persistBetaProductRecord
} from "./beta_product_record_store.js";
import {
  computeHabitStreak,
  normaliseHabitDefinition,
  normaliseHabitCompletionDate
} from "../../shared/body-metrics/bodyMetricsAndHabitsLifecycle.mjs";

type JsonRecord = Record<string, unknown>;

export class HabitTrackingError extends Error {
  readonly status: number;

  constructor(reason: string, status = 400) {
    super(`habit_tracking_${reason}`);
    this.name = "HabitTrackingError";
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
    throw new HabitTrackingError("relationship_access_denied", 403);
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
    throw new HabitTrackingError("relationship_access_denied", 403);
  }
}

export async function createHabitDefinition(
  athleteUserId: string,
  input: { habit_label?: unknown; cadence?: unknown }
): Promise<Readonly<JsonRecord>> {
  const athlete = cleanString(athleteUserId);
  if (!athlete) {
    throw new HabitTrackingError("athlete_identity_required");
  }

  let normalised;
  try {
    normalised = normaliseHabitDefinition(input);
  }
  catch (error) {
    throw new HabitTrackingError((error as { code?: string }).code ?? "definition_invalid");
  }

  const habitId = `habit_definition_${sha256({
    athlete,
    normalised,
    at: crypto.randomUUID()
  }).slice(0, 24)}`;

  const recordWithoutHash = {
    record_type: "habit_definition" as const,
    contract_version: "full_ui_29.1.0.0",
    habit_id: habitId,
    athlete_user_id: athlete,
    created_by_user_id: athlete,
    habit_label: normalised.habit_label,
    cadence: normalised.cadence,
    created_at_iso8601: new Date().toISOString(),
    archived_at_iso8601: null as string | null,
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

async function loadLatestHabitDefinitionSnapshots(athleteUserId: string): Promise<Readonly<JsonRecord>[]> {
  const result = await pool.query(
    `
    SELECT DISTINCT ON (record_id) record_payload
    FROM beta_product_records
    WHERE
      subject_user_id = $1
      AND record_type = 'habit_definition'
    ORDER BY
      record_id,
      effective_at DESC,
      created_at DESC,
      record_sha256 DESC
    `,
    [athleteUserId]
  );

  const habits: Readonly<JsonRecord>[] = [];
  for (const row of result.rows ?? []) {
    if (isRecord(row.record_payload)) {
      habits.push(Object.freeze(row.record_payload));
    }
  }
  return habits;
}

async function loadLatestHabitDefinitionSnapshot(
  athleteUserId: string,
  habitId: string
): Promise<Readonly<JsonRecord> | null> {
  const result = await pool.query(
    `
    SELECT record_payload
    FROM beta_product_records
    WHERE
      subject_user_id = $1
      AND record_type = 'habit_definition'
      AND record_payload->>'habit_id' = $2
    ORDER BY
      effective_at DESC,
      created_at DESC,
      record_sha256 DESC
    LIMIT 1
    `,
    [athleteUserId, habitId]
  );
  const payload = result.rows?.[0]?.record_payload;
  return isRecord(payload) ? Object.freeze(payload) : null;
}

export async function archiveHabitDefinition(
  athleteUserId: string,
  habitIdInput: string
): Promise<Readonly<JsonRecord>> {
  const athlete = cleanString(athleteUserId);
  const habitId = cleanString(habitIdInput);
  if (!athlete || !habitId) {
    throw new HabitTrackingError("habit_identity_required");
  }

  const current = await loadLatestHabitDefinitionSnapshot(athlete, habitId);
  if (!current) {
    throw new HabitTrackingError("habit_not_found", 404);
  }

  if (current.archived_at_iso8601) {
    return current;
  }

  const recordWithoutHash = {
    ...current,
    archived_at_iso8601: new Date().toISOString()
  };
  delete (recordWithoutHash as JsonRecord).record_sha256;

  const record = deepFreeze({
    ...recordWithoutHash,
    record_sha256: sha256(recordWithoutHash)
  });

  return persistBetaProductRecord(record);
}

async function queryHabitCompletions(athleteUserId: string, habitId: string): Promise<Readonly<JsonRecord>[]> {
  const result = await pool.query(
    `
    SELECT record_payload
    FROM beta_product_records
    WHERE
      subject_user_id = $1
      AND record_type = 'habit_completion'
      AND record_payload->>'habit_id' = $2
    ORDER BY
      effective_at ASC,
      created_at ASC,
      record_sha256 ASC
    `,
    [athleteUserId, habitId]
  );

  const completions: Readonly<JsonRecord>[] = [];
  for (const row of result.rows ?? []) {
    if (isRecord(row.record_payload)) {
      completions.push(Object.freeze(row.record_payload));
    }
  }
  return completions;
}

export async function logHabitCompletion(
  athleteUserId: string,
  habitIdInput: string,
  input: { completion_date?: unknown }
): Promise<Readonly<JsonRecord>> {
  const athlete = cleanString(athleteUserId);
  const habitId = cleanString(habitIdInput);
  if (!athlete || !habitId) {
    throw new HabitTrackingError("habit_identity_required");
  }

  const habit = await loadLatestHabitDefinitionSnapshot(athlete, habitId);
  if (!habit || habit.athlete_user_id !== athlete) {
    throw new HabitTrackingError("habit_not_found", 404);
  }
  if (habit.archived_at_iso8601) {
    throw new HabitTrackingError("habit_archived", 409);
  }

  let completionDate: string;
  try {
    completionDate = normaliseHabitCompletionDate(input);
  }
  catch (error) {
    throw new HabitTrackingError((error as { code?: string }).code ?? "completion_invalid");
  }

  // Idempotent on (habit_id, completion_date): the completion_id is
  // deterministic from those two fields alone, so a duplicate same-day
  // submission resolves to the exact same record_id - checked here at the
  // application level (not via hash-equality ON CONFLICT, since
  // logged_at_iso8601 legitimately differs per attempt and would otherwise
  // change the row's hash on every retry).
  const completionId = `habit_completion_${sha256({ habitId, completionDate }).slice(0, 24)}`;

  const existingResult = await pool.query(
    `
    SELECT record_payload
    FROM beta_product_records
    WHERE
      record_type = 'habit_completion'
      AND record_id = $1
      AND subject_user_id = $2
    LIMIT 1
    `,
    [completionId, athlete]
  );
  const existingPayload = existingResult.rows?.[0]?.record_payload;
  if (isRecord(existingPayload)) {
    return Object.freeze(existingPayload);
  }

  const recordWithoutHash = {
    record_type: "habit_completion" as const,
    contract_version: "full_ui_29.1.0.0",
    completion_id: completionId,
    habit_id: habitId,
    athlete_user_id: athlete,
    logged_by_user_id: athlete,
    completion_date: completionDate,
    logged_at_iso8601: new Date().toISOString(),
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

async function habitsWithStreaks(athleteUserId: string): Promise<Readonly<JsonRecord>[]> {
  const habits = await loadLatestHabitDefinitionSnapshots(athleteUserId);
  const today = new Date().toISOString().slice(0, 10);

  const habitsWithStreakData = await Promise.all(
    habits.map(async (habit) => {
      const habitId = cleanString(habit.habit_id);
      const completions = await queryHabitCompletions(athleteUserId, habitId);
      const completionDates = completions.map((completion) => cleanString(completion.completion_date));
      const streak = computeHabitStreak(completionDates, today, cleanString(habit.cadence));

      return Object.freeze({
        ...habit,
        current_streak_length: streak.current_streak_length,
        longest_streak_length: streak.longest_streak_length,
        total_completions: streak.total_completions
      });
    })
  );

  return habitsWithStreakData;
}

export async function listHabitsWithStreaksForAthlete(athleteUserId: string): Promise<Readonly<JsonRecord>[]> {
  const athlete = cleanString(athleteUserId);
  if (!athlete) {
    throw new HabitTrackingError("athlete_identity_required");
  }
  return habitsWithStreaks(athlete);
}

export async function listHabitsForCoach(
  coachUserId: string,
  athleteUserId: string
): Promise<Readonly<JsonRecord>[]> {
  const coach = cleanString(coachUserId);
  const athlete = cleanString(athleteUserId);
  if (!coach || !athlete) {
    throw new HabitTrackingError("identity_required");
  }
  await requireCoachAthleteAccess(coach, athlete);
  return habitsWithStreaks(athlete);
}
