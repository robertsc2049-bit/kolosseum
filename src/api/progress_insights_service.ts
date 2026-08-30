// DEV NOTE: FULL-UI-36 Progress Insights - read-only, compute-on-request
// analytics summary. Nothing here is persisted; every metric is derived
// at request time from already-stored, already-tested facts (session
// history, strength benchmarks, habit completions, body-metric entries).
// Mirrors the one existing analytics-shaped precedent in this codebase
// (computeHabitStreak, computed fresh on every habit read rather than
// stored). Ownership/relationship checks are duplicated locally here
// rather than shared, matching every other service in this file family.

import { pool } from "../db/pool.js";
import { loadBeta17StoredCoachContext } from "./beta_product_record_store.js";
import {
  type EnrichedHistorySession,
  loadEnrichedAthleteSessions
} from "./athlete_history_service.js";
import {
  listBodyMetricHistoryForAthlete,
  listBodyMetricHistoryForCoach
} from "./body_metrics_service.js";
import {
  listHabitsForCoach,
  listHabitsWithStreaksForAthlete,
  queryHabitCompletions
} from "./habit_tracking_service.js";
import { projectStrengthReferenceLifecycle } from "../../shared/strength-reference/strengthReferenceLifecycle.mjs";
import { listConnectedCoachAthletes } from "./beta19_coach_workspace_service.js";

type JsonRecord = Record<string, unknown>;

const WINDOW_DAYS = 30;

// Progress graphs (FULL-UI-36 slice 2): how many trailing, non-overlapping
// WINDOW_DAYS-long windows each metric's `series` field covers - e.g. 6
// windows of 30 days each is a rolling 180-day view. Every metric computes
// its series from the SAME already-fetched history array its single-window
// value already used - no new query, matching this file's existing
// "nothing new persisted, nothing new queried" invariant.
const WINDOW_COUNT = 6;

export class ProgressInsightsError extends Error {
  readonly status: number;

  constructor(reason: string, status = 400) {
    super(`progress_insights_${reason}`);
    this.name = "ProgressInsightsError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

async function requireCoachAthleteAccess(coachUserId: string, athleteUserId: string): Promise<void> {
  const context = await loadBeta17StoredCoachContext(coachUserId, athleteUserId);
  if (!context) {
    throw new ProgressInsightsError("relationship_access_denied", 403);
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
    throw new ProgressInsightsError("relationship_access_denied", 403);
  }
}

function windowStartIsoDate(fromIsoDate: string, days: number): string {
  const parsed = new Date(`${fromIsoDate}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() - days);
  return parsed.toISOString().slice(0, 10);
}

function computeSessionAdherenceWindow(
  sessions: readonly EnrichedHistorySession[],
  windowEndIsoDate: string,
  windowDays: number
): Readonly<JsonRecord> {
  const windowStartDate = windowStartIsoDate(windowEndIsoDate, windowDays);

  const windowSessions = sessions.filter((session) => {
    const createdDate = cleanString(session.created_at).slice(0, 10);
    return createdDate >= windowStartDate && createdDate <= windowEndIsoDate;
  });

  const totalSessions = windowSessions.length;
  const completedSessions = windowSessions.filter((session) => session.execution_status === "completed").length;
  const partialSessions = windowSessions.filter((session) => session.execution_status === "partial").length;
  const inProgressSessions = windowSessions.filter((session) => session.execution_status === "in_progress").length;
  const readySessions = windowSessions.filter((session) => session.execution_status === "ready").length;

  return Object.freeze({
    window_start_date: windowStartDate,
    window_end_date: windowEndIsoDate,
    total_sessions: totalSessions,
    completed_sessions: completedSessions,
    partial_sessions: partialSessions,
    in_progress_sessions: inProgressSessions,
    ready_sessions: readySessions,
    adherence_percentage: totalSessions > 0 ? Math.round((100 * completedSessions) / totalSessions) : null,
    has_sufficient_data: totalSessions > 0
  });
}

function computeSessionAdherence(sessions: readonly EnrichedHistorySession[]): Readonly<JsonRecord> {
  const today = new Date().toISOString().slice(0, 10);
  const current = computeSessionAdherenceWindow(sessions, today, WINDOW_DAYS);

  const series: Readonly<JsonRecord>[] = [];
  for (let windowIndex = WINDOW_COUNT - 1; windowIndex >= 0; windowIndex--) {
    const windowEndDate = windowStartIsoDate(today, windowIndex * WINDOW_DAYS);
    series.push(computeSessionAdherenceWindow(sessions, windowEndDate, WINDOW_DAYS));
  }

  return Object.freeze({
    ...current,
    series: Object.freeze(series)
  });
}

async function loadLatestStrengthProfilePayload(athleteUserId: string): Promise<JsonRecord | null> {
  const result = await pool.query(
    `
    SELECT record_payload
    FROM beta_product_records
    WHERE
      subject_user_id = $1
      AND record_type = 'beta19_athlete_strength_profile'
    ORDER BY
      effective_at DESC,
      created_at DESC,
      record_sha256 DESC
    LIMIT 1
    `,
    [athleteUserId]
  );
  const payload = result.rows?.[0]?.record_payload;
  return isRecord(payload) ? payload : null;
}

function computeStrengthTrends(profilePayload: JsonRecord | null): Readonly<JsonRecord>[] {
  const displayUnit = cleanString(profilePayload?.preferred_weight_unit) || "kg";
  const lifecycle = projectStrengthReferenceLifecycle(profilePayload ?? [], displayUnit) as {
    current: readonly JsonRecord[];
    superseded: readonly JsonRecord[];
  };

  // lifecycle.superseded is grouped per-exercise (ascending effective_date
  // within each group) because the underlying projection processes one
  // exercise at a time - so pushing in iteration order per exercise_id
  // builds each exercise's own ascending history, and the last entry in
  // that group is its most recent superseded reference.
  const supersededByExercise = new Map<string, JsonRecord[]>();
  for (const record of lifecycle.superseded) {
    const exerciseId = cleanString(record.exercise_id);
    const list = supersededByExercise.get(exerciseId) ?? [];
    list.push(record);
    supersededByExercise.set(exerciseId, list);
  }

  return lifecycle.current.map((current) => {
    const exerciseId = cleanString(current.exercise_id);
    const supersededForExercise = supersededByExercise.get(exerciseId) ?? [];
    const prior = supersededForExercise.length > 0 ? supersededForExercise[supersededForExercise.length - 1] : null;

    const currentValue = Number(current.display_value);
    const priorValue = prior ? Number(prior.display_value) : null;

    const series = [
      ...supersededForExercise.map((entry) => Object.freeze({
        date: cleanString(entry.effective_date),
        value: Number(entry.display_value)
      })),
      Object.freeze({
        date: cleanString(current.effective_date),
        value: currentValue
      })
    ];

    return Object.freeze({
      exercise_id: exerciseId,
      current_value: currentValue,
      current_unit: cleanString(current.display_unit),
      current_effective_date: cleanString(current.effective_date),
      has_prior_value: prior !== null,
      prior_value: priorValue,
      prior_effective_date: prior ? cleanString(prior.effective_date) : null,
      delta: prior ? round2(currentValue - (priorValue as number)) : null,
      delta_percentage: prior && priorValue ? round2((100 * (currentValue - priorValue)) / priorValue) : null,
      series: Object.freeze(series)
    });
  });
}

function cadenceExpectedUnits(cadence: string, windowDays: number): number {
  return cadence === "weekly" ? Math.ceil(windowDays / 7) : windowDays;
}

function computeHabitWindowRate(
  completions: readonly JsonRecord[],
  cadence: string,
  windowEndIsoDate: string,
  windowDays: number
): Readonly<JsonRecord> {
  const windowStartDate = windowStartIsoDate(windowEndIsoDate, windowDays);

  const windowCompletionDates = new Set(
    completions
      .map((completion) => cleanString(completion.completion_date))
      .filter((date) => date >= windowStartDate && date <= windowEndIsoDate)
  );

  const windowCompletions = windowCompletionDates.size;
  const windowExpectedUnits = cadenceExpectedUnits(cadence, windowDays);
  const completionRatePercentage = Math.round(
    (100 * Math.min(windowCompletions, windowExpectedUnits)) / windowExpectedUnits
  );

  return Object.freeze({
    window_start_date: windowStartDate,
    window_end_date: windowEndIsoDate,
    window_completions: windowCompletions,
    window_expected_units: windowExpectedUnits,
    completion_rate_percentage: completionRatePercentage
  });
}

async function computeHabitConsistency(
  habitsWithStreaks: readonly JsonRecord[],
  athleteUserId: string
): Promise<Readonly<JsonRecord>[]> {
  const today = new Date().toISOString().slice(0, 10);

  return Promise.all(
    habitsWithStreaks.map(async (habit) => {
      const habitId = cleanString(habit.habit_id);
      const cadence = cleanString(habit.cadence);
      const completions = await queryHabitCompletions(athleteUserId, habitId);

      const current = computeHabitWindowRate(completions, cadence, today, WINDOW_DAYS);

      const series: Readonly<JsonRecord>[] = [];
      for (let windowIndex = WINDOW_COUNT - 1; windowIndex >= 0; windowIndex--) {
        const windowEndDate = windowStartIsoDate(today, windowIndex * WINDOW_DAYS);
        series.push(computeHabitWindowRate(completions, cadence, windowEndDate, WINDOW_DAYS));
      }

      return Object.freeze({
        habit_id: habitId,
        habit_label: cleanString(habit.habit_label),
        cadence,
        current_streak_length: habit.current_streak_length,
        longest_streak_length: habit.longest_streak_length,
        total_completions: habit.total_completions,
        window_completions: current.window_completions,
        window_expected_units: current.window_expected_units,
        completion_rate_percentage: current.completion_rate_percentage,
        series: Object.freeze(series)
      });
    })
  );
}

function computeBodyMetricTrends(entries: readonly JsonRecord[]): Readonly<JsonRecord>[] {
  const byMetricType = new Map<string, JsonRecord[]>();
  for (const entry of entries) {
    const metricType = cleanString(entry.metric_type);
    if (!metricType) continue;
    const list = byMetricType.get(metricType) ?? [];
    list.push(entry);
    byMetricType.set(metricType, list);
  }

  const trends: Readonly<JsonRecord>[] = [];
  for (const metricType of [...byMetricType.keys()].sort()) {
    const sorted = (byMetricType.get(metricType) ?? [])
      .slice()
      .sort((a, b) => cleanString(b.effective_date).localeCompare(cleanString(a.effective_date)));

    const latest = sorted[0];
    const latestDate = cleanString(latest.effective_date);
    const cutoff = windowStartIsoDate(latestDate, WINDOW_DAYS);

    // sorted is descending by effective_date, so the first entry at or
    // before the cutoff is the nearest-before match (closest in time
    // while still satisfying the "at least WINDOW_DAYS prior" bound).
    const prior = sorted.find((entry) => cleanString(entry.effective_date) <= cutoff) ?? null;

    const latestValue = Number(latest.value);
    const priorValue = prior ? Number(prior.value) : null;

    const series = sorted
      .slice()
      .reverse()
      .map((entry) => Object.freeze({
        date: cleanString(entry.effective_date),
        value: Number(entry.value)
      }));

    trends.push(Object.freeze({
      metric_type: metricType,
      unit: cleanString(latest.unit),
      latest_value: latestValue,
      latest_effective_date: latestDate,
      has_prior_value: prior !== null,
      prior_value: priorValue,
      prior_effective_date: prior ? cleanString(prior.effective_date) : null,
      delta: prior ? round2(latestValue - (priorValue as number)) : null,
      delta_percentage: prior && priorValue ? round2((100 * (latestValue - priorValue)) / priorValue) : null,
      series: Object.freeze(series)
    }));
  }

  return trends;
}

async function assembleProgressInsightsSummary(
  athleteUserId: string,
  habitsWithStreaks: readonly JsonRecord[],
  bodyMetricEntries: readonly JsonRecord[]
): Promise<Readonly<JsonRecord>> {
  const [sessions, profilePayload, habitConsistency] = await Promise.all([
    loadEnrichedAthleteSessions(athleteUserId),
    loadLatestStrengthProfilePayload(athleteUserId),
    computeHabitConsistency(habitsWithStreaks, athleteUserId)
  ]);

  return Object.freeze({
    athlete_user_id: athleteUserId,
    window_days: WINDOW_DAYS,
    generated_at_iso8601: new Date().toISOString(),
    session_adherence: computeSessionAdherence(sessions),
    strength_trends: computeStrengthTrends(profilePayload),
    habit_consistency: habitConsistency,
    body_metric_trends: computeBodyMetricTrends(bodyMetricEntries),
    factual_records_only: true,
    calls_engine: false,
    engine_visible: false
  });
}

export async function getProgressInsightsForAthlete(athleteUserId: string): Promise<Readonly<JsonRecord>> {
  const athlete = cleanString(athleteUserId);
  if (!athlete) {
    throw new ProgressInsightsError("athlete_identity_required", 401);
  }

  const [habitsWithStreaks, bodyMetricEntries] = await Promise.all([
    listHabitsWithStreaksForAthlete(athlete),
    listBodyMetricHistoryForAthlete(athlete)
  ]);

  return assembleProgressInsightsSummary(athlete, habitsWithStreaks, bodyMetricEntries);
}

export async function getProgressInsightsForCoach(
  coachUserId: string,
  athleteUserId: string
): Promise<Readonly<JsonRecord>> {
  const coach = cleanString(coachUserId);
  const athlete = cleanString(athleteUserId);
  if (!coach || !athlete) {
    throw new ProgressInsightsError("identity_required", 401);
  }

  await requireCoachAthleteAccess(coach, athlete);

  const [habitsWithStreaks, bodyMetricEntries] = await Promise.all([
    listHabitsForCoach(coach, athlete),
    listBodyMetricHistoryForCoach(coach, athlete)
  ]);

  return assembleProgressInsightsSummary(athlete, habitsWithStreaks, bodyMetricEntries);
}

// Progress graphs slice 3: a roster-wide overview for a coach's own
// athletes. Deliberately loops getProgressInsightsForCoach() per athlete
// (rather than a lower-level helper with no authorization of its own) so
// every single athlete's relationship is independently re-validated by
// requireCoachAthleteAccess() at read time, not just resolved once via
// listConnectedCoachAthletes() up front - real defense in depth against a
// relationship changing state between the roster fetch and this read, at
// the cost of one extra (cheap, indexed) coach-context lookup per athlete.
export async function getProgressInsightsForCoachRoster(
  coachUserIdInput: string
): Promise<readonly Readonly<JsonRecord>[]> {
  const coachUserId = cleanString(coachUserIdInput);
  if (!coachUserId) {
    throw new ProgressInsightsError("identity_required", 401);
  }

  const roster = await listConnectedCoachAthletes(coachUserId);

  return Promise.all(
    roster.map(async (athlete) => {
      const athleteUserId = cleanString(athlete.athlete_user_id);
      const displayName = cleanString(athlete.display_name) || athleteUserId;

      try {
        const insights = await getProgressInsightsForCoach(coachUserId, athleteUserId);
        return Object.freeze({ athlete_user_id: athleteUserId, display_name: displayName, insights });
      }
      catch {
        // One athlete's failure (a transient read error, or a
        // relationship that changed state between the roster fetch above
        // and this per-athlete read) must never take down the whole
        // roster view - mirrors the identical resilience pattern already
        // used by org_visibility_service.ts's fullRosterForOrg().
        return Object.freeze({ athlete_user_id: athleteUserId, display_name: displayName, insights: null });
      }
    })
  );
}
