// DEV NOTE: FULL-UI-37 - athlete goal-setting. A goal is self-declared and
// self-resolved by the athlete only - there is no coach-facing write path
// anywhere in this file, mirroring habit_tracking_service.ts's own rule
// that a habit is the athlete's own report, never something a coach
// records on their behalf. A goal optionally links to an existing
// body-metric type; when it does, its baseline is captured once at
// creation time and its current value/progress are always recomputed
// fresh on read from listBodyMetricHistoryForAthlete/Coach - never
// persisted. Ownership/relationship checks are duplicated locally here
// rather than shared, mirroring every other service in this file family.

import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import {
  loadBeta17StoredCoachContext,
  persistBetaProductRecord
} from "./beta_product_record_store.js";
import {
  listBodyMetricHistoryForAthlete,
  listBodyMetricHistoryForCoach
} from "./body_metrics_service.js";
import {
  deriveGoalBaseline,
  enrichAthleteGoalForRead,
  normaliseAthleteGoalCreation,
  normaliseAthleteGoalResolution
} from "../../shared/goals/athleteGoalsLifecycle.mjs";

type JsonRecord = Record<string, unknown>;

export class AthleteGoalsError extends Error {
  readonly status: number;

  constructor(reason: string, status = 400) {
    super(`athlete_goals_${reason}`);
    this.name = "AthleteGoalsError";
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
    throw new AthleteGoalsError("relationship_access_denied", 403);
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
    throw new AthleteGoalsError("relationship_access_denied", 403);
  }
}

type AthleteGoalCreateInput = {
  goal_label?: unknown;
  metric_type?: unknown;
  target_value?: unknown;
  target_date?: unknown;
};

export async function createAthleteGoal(
  athleteUserId: string,
  input: AthleteGoalCreateInput
): Promise<Readonly<JsonRecord>> {
  const athlete = cleanString(athleteUserId);
  if (!athlete) {
    throw new AthleteGoalsError("athlete_identity_required");
  }

  let normalised;
  try {
    normalised = normaliseAthleteGoalCreation(input);
  }
  catch (error) {
    throw new AthleteGoalsError((error as { code?: string }).code ?? "creation_invalid");
  }

  let latestEntryAtCreation: Readonly<JsonRecord> | null = null;
  if (normalised.metric_type) {
    const entries = await listBodyMetricHistoryForAthlete(athlete);
    latestEntryAtCreation =
      entries.find((entry) => cleanString(entry.metric_type) === normalised.metric_type) ?? null;
  }

  const baseline = deriveGoalBaseline({
    targetValue: normalised.target_value,
    metricType: normalised.metric_type,
    latestEntryAtCreation
  });

  const goalId = `athlete_goal_${sha256({
    athlete,
    normalised,
    at: crypto.randomUUID()
  }).slice(0, 24)}`;

  const recordWithoutHash = {
    record_type: "athlete_goal" as const,
    contract_version: "full_ui_37.1.0.0",
    goal_id: goalId,
    athlete_user_id: athlete,
    created_by_user_id: athlete,
    goal_label: normalised.goal_label,
    metric_type: normalised.metric_type,
    target_value: normalised.target_value,
    target_unit: normalised.target_unit,
    baseline_value: baseline.baseline_value,
    baseline_effective_date: baseline.baseline_effective_date,
    target_direction: baseline.target_direction,
    target_date: normalised.target_date,
    created_at_iso8601: new Date().toISOString(),
    status: "active" as const,
    resolved_at_iso8601: null as string | null,
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

async function loadLatestAthleteGoalSnapshots(athleteUserId: string): Promise<Readonly<JsonRecord>[]> {
  const result = await pool.query(
    `
    SELECT DISTINCT ON (record_id) record_payload
    FROM beta_product_records
    WHERE
      subject_user_id = $1
      AND record_type = 'athlete_goal'
    ORDER BY
      record_id,
      effective_at DESC,
      created_at DESC,
      record_sha256 DESC
    `,
    [athleteUserId]
  );

  const goals: Readonly<JsonRecord>[] = [];
  for (const row of result.rows ?? []) {
    if (isRecord(row.record_payload)) {
      goals.push(Object.freeze(row.record_payload));
    }
  }
  return goals;
}

async function loadLatestAthleteGoalSnapshot(
  athleteUserId: string,
  goalId: string
): Promise<Readonly<JsonRecord> | null> {
  const result = await pool.query(
    `
    SELECT record_payload
    FROM beta_product_records
    WHERE
      subject_user_id = $1
      AND record_type = 'athlete_goal'
      AND record_payload->>'goal_id' = $2
    ORDER BY
      effective_at DESC,
      created_at DESC,
      record_sha256 DESC
    LIMIT 1
    `,
    [athleteUserId, goalId]
  );
  const payload = result.rows?.[0]?.record_payload;
  return isRecord(payload) ? Object.freeze(payload) : null;
}

export async function resolveAthleteGoal(
  athleteUserId: string,
  goalIdInput: string,
  input: { resolution?: unknown }
): Promise<Readonly<JsonRecord>> {
  const athlete = cleanString(athleteUserId);
  const goalId = cleanString(goalIdInput);
  if (!athlete || !goalId) {
    throw new AthleteGoalsError("goal_identity_required");
  }

  let normalised;
  try {
    normalised = normaliseAthleteGoalResolution(input);
  }
  catch (error) {
    throw new AthleteGoalsError((error as { code?: string }).code ?? "resolution_invalid");
  }

  const current = await loadLatestAthleteGoalSnapshot(athlete, goalId);
  if (!current) {
    throw new AthleteGoalsError("goal_not_found", 404);
  }

  if (current.status !== "active") {
    return current;
  }

  const recordWithoutHash = {
    ...current,
    status: normalised.resolution,
    resolved_at_iso8601: new Date().toISOString()
  };
  delete (recordWithoutHash as JsonRecord).record_sha256;

  const record = deepFreeze({
    ...recordWithoutHash,
    record_sha256: sha256(recordWithoutHash)
  });

  return persistBetaProductRecord(record);
}

function enrichGoals(
  goals: readonly Readonly<JsonRecord>[],
  metricEntries: readonly Readonly<JsonRecord>[]
): Readonly<JsonRecord>[] {
  const latestEntryByMetricType = new Map<string, Readonly<JsonRecord>>();
  for (const entry of metricEntries) {
    const metricType = cleanString(entry.metric_type);
    if (!latestEntryByMetricType.has(metricType)) {
      latestEntryByMetricType.set(metricType, entry);
    }
  }

  return goals.map((goal) => {
    const metricType = cleanString(goal.metric_type);
    const currentEntry = metricType ? latestEntryByMetricType.get(metricType) ?? null : null;
    const enrichment = enrichAthleteGoalForRead(goal, currentEntry);
    return Object.freeze({ ...goal, ...enrichment });
  });
}

export async function listAthleteGoalsForAthlete(athleteUserId: string): Promise<Readonly<JsonRecord>[]> {
  const athlete = cleanString(athleteUserId);
  if (!athlete) {
    throw new AthleteGoalsError("athlete_identity_required");
  }
  const [goals, metricEntries] = await Promise.all([
    loadLatestAthleteGoalSnapshots(athlete),
    listBodyMetricHistoryForAthlete(athlete)
  ]);
  return enrichGoals(goals, metricEntries);
}

export async function listAthleteGoalsForCoach(
  coachUserId: string,
  athleteUserId: string
): Promise<Readonly<JsonRecord>[]> {
  const coach = cleanString(coachUserId);
  const athlete = cleanString(athleteUserId);
  if (!coach || !athlete) {
    throw new AthleteGoalsError("identity_required");
  }
  await requireCoachAthleteAccess(coach, athlete);
  const [goals, metricEntries] = await Promise.all([
    loadLatestAthleteGoalSnapshots(athlete),
    listBodyMetricHistoryForCoach(coach, athlete)
  ]);
  return enrichGoals(goals, metricEntries);
}
