// DEV NOTE: Performance tests and tested maxes, for the coach's Analysis.
// - Test results (jumps, sprints, agility, conditioning, grip...) a coach
//   records for their athlete, kept as the athlete's own account events
//   (GDPR erasure covers product_account_events); removed with a removal
//   event, never deleted, so the history stays honest.
// - The maxes the coach recorded in the athlete's strength profile, every
//   version over time (each one tested or set on its date), and their
//   latest bodyweight - for tested-vs-estimated maxes and strength relative
//   to bodyweight.
import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import { PERFORMANCE_TESTS, type TestResult, type TestedMax } from "./coach_analysis_metrics.js";
import { requireCoachAthleteAccess } from "./beta19_coach_workspace_service.js";

type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null);
const LB_PER_KG = 2.2046226218;
const toKg = (value: number, unit: unknown) => (text(unit) === "lb" ? Math.round((value / LB_PER_KG) * 10) / 10 : value);

const TEST_EVENT = "performance_test_result";
const TEST_REMOVED_EVENT = "performance_test_removed";

export class AthleteTestInputError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "AthleteTestInputError";
    this.status = status;
  }
}

export async function recordTestResult(coachUserId: string, athleteUserId: string, input: unknown, today = new Date().toISOString().slice(0, 10)): Promise<Json> {
  await requireCoachAthleteAccess(coachUserId, athleteUserId);
  const body = isRecord(input) ? input : {};
  const testId = text(body.test_id);
  const definition = PERFORMANCE_TESTS[testId];
  if (!definition) throw new AthleteTestInputError("athlete_test_unknown");
  const value = num(body.value);
  if (value === null || value <= 0 || value > 100_000) throw new AthleteTestInputError("athlete_test_value_invalid");
  const date = text(body.date) || today;
  const twoYearsAgo = new Date(Date.parse(`${today}T00:00:00Z`) - 731 * 86_400_000).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || date > today || date < twoYearsAgo) throw new AthleteTestInputError("athlete_test_date_invalid");
  const clientRequestId = text(body.client_request_id);
  if (!/^[A-Za-z0-9_-]{8,80}$/u.test(clientRequestId)) throw new AthleteTestInputError("athlete_test_client_request_id_invalid");
  const id = `pt_${crypto.createHash("sha256").update(`${coachUserId}|${athleteUserId}|${clientRequestId}`).digest("hex").slice(0, 32)}`;
  const factor = 10 ** definition.decimals;
  const result = { id, test_id: testId, value: Math.round(value * factor) / factor, date, recorded_by: coachUserId };
  const inserted = await pool.query(
    "INSERT INTO product_account_events (event_id, user_id, event_type, event_payload) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (event_id) DO NOTHING",
    [id, athleteUserId, TEST_EVENT, JSON.stringify(result)]
  );
  return { ok: true, result, added: inserted.rowCount === 1 };
}

export async function removeTestResult(coachUserId: string, athleteUserId: string, input: unknown): Promise<Json> {
  await requireCoachAthleteAccess(coachUserId, athleteUserId);
  const id = text(isRecord(input) ? input.id : "");
  const exists = await pool.query("SELECT 1 FROM product_account_events WHERE user_id = $1 AND event_type = $2 AND event_id = $3", [athleteUserId, TEST_EVENT, id]);
  if (!id || !exists.rows.length) throw new AthleteTestInputError("athlete_test_not_found", 404);
  await pool.query(
    "INSERT INTO product_account_events (event_id, user_id, event_type, event_payload) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (event_id) DO NOTHING",
    [`${id}_removed`, athleteUserId, TEST_REMOVED_EVENT, JSON.stringify({ id, removed_by: coachUserId })]
  );
  return { ok: true, removed: id };
}

// Every result still standing, oldest first. No access check: callers check.
export async function loadTestResults(athleteUserId: string): Promise<TestResult[]> {
  const result = await pool.query(
    `SELECT event_type, event_payload FROM product_account_events WHERE user_id = $1 AND event_type IN ($2, $3) ORDER BY occurred_at ASC, event_id ASC`,
    [athleteUserId, TEST_EVENT, TEST_REMOVED_EVENT]
  );
  const removed = new Set(result.rows.filter((row) => row.event_type === TEST_REMOVED_EVENT).map((row) => text(isRecord(row.event_payload) ? row.event_payload.id : "")));
  return result.rows
    .filter((row) => row.event_type === TEST_EVENT && isRecord(row.event_payload))
    .map((row) => row.event_payload as Json)
    .filter((payload) => !removed.has(text(payload.id)) && num(payload.value) !== null)
    .map((payload) => ({ id: text(payload.id), test_id: text(payload.test_id), date: text(payload.date), value: num(payload.value)! }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function listTestResultsForCoach(coachUserId: string, athleteUserId: string): Promise<Json> {
  await requireCoachAthleteAccess(coachUserId, athleteUserId);
  return { ok: true, tests: PERFORMANCE_TESTS, results: await loadTestResults(athleteUserId) };
}

// The coach's strength profile for the athlete over time: each version's
// maxes (by their effective date) and the latest bodyweight.
export async function loadProfileHistory(coachUserId: string, athleteUserId: string): Promise<{ maxes: TestedMax[]; bodyweight_kg: number | null }> {
  const result = await pool.query(
    `SELECT record_payload FROM beta_product_records
     WHERE record_type = 'beta19_athlete_strength_profile' AND actor_user_id = $1 AND subject_user_id = $2
     ORDER BY created_at ASC, record_id ASC`,
    [coachUserId, athleteUserId]
  );
  const seen = new Set<string>();
  const maxes: TestedMax[] = [];
  let bodyweight: number | null = null;
  for (const row of result.rows) {
    const payload = isRecord(row.record_payload) ? row.record_payload : {};
    const weight = num(payload.bodyweight);
    if (weight !== null && weight > 0) bodyweight = toKg(weight, payload.bodyweight_unit);
    for (const benchmark of Array.isArray(payload.benchmarks) ? payload.benchmarks.filter(isRecord) : []) {
      const value = num(benchmark.value);
      const exerciseId = text(benchmark.exercise_id);
      const date = text(benchmark.effective_date) || text(payload.updated_at_iso8601).slice(0, 10);
      if (value === null || value <= 0 || !exerciseId || !date) continue;
      const key = `${exerciseId}|${date}|${value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      maxes.push({ exercise_id: exerciseId, date, value_kg: toKg(value, benchmark.unit) });
    }
  }
  return { maxes: maxes.sort((a, b) => a.date.localeCompare(b.date)), bodyweight_kg: bodyweight };
}
