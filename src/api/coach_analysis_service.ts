// DEV NOTE: Coach Analysis - loads one athlete's training facts (sessions,
// the events logged in them, readiness and weekly check-ins, their planned
// training days) and runs coach_analysis_metrics.ts over them; and a roster
// view ranking every connected athlete by how much needs a coach's look.
// Read-only and computed on request, like progress_insights_service.ts.
// Coach-only: the athlete never sees this.
import fs from "node:fs";
import path from "node:path";

import { pool } from "../db/pool.js";
import {
  analyseAthlete, attentionScore, findings, weekStart, addDays,
  type AnalysisEvent, type AnalysisPlannedExercise, type AnalysisSession, type CheckinFact, type ReadinessFact
} from "./coach_analysis_metrics.js";
import { listConnectedCoachAthletes, requireCoachAthleteAccess } from "./beta19_coach_workspace_service.js";
import { listWeeklyCheckinsForCoach } from "./weekly_checkin_service.js";
import { getAthleteCustomExerciseNames, getAthleteTrainingPlan, sessionExerciseDisplayNames } from "./athlete_onboarding_service.js";
import { isE1rmExercise } from "./training_e1rm.js";
import { blockMarkers, listOtherTraining, loadExternalLoad, loadSessionReports, planMarkers } from "./athlete_training_log_service.js";
import { loadInjuries } from "./injury_log_service.js";
import { programmeHistory } from "./programme_history.js";
import { loadProfileHistory, loadTestResults } from "./athlete_tests_service.js";

type Json = Record<string, unknown>;

const LB_PER_KG = 2.2046226218;
const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null);
const toKg = (value: number | null, unit: unknown) => (value === null ? null : text(unit) === "lb" ? Math.round((value / LB_PER_KG) * 10) / 10 : value);

export const ANALYSIS_WEEK_CHOICES = Object.freeze([4, 8, 12, 26]);

// Movement pattern per exercise, from the exercise registry (read once).
let patterns: Map<string, string> | null = null;
function patternOf(exerciseId: string): string | undefined {
  if (!patterns) {
    const doc = JSON.parse(fs.readFileSync(path.join(process.cwd(), "registries", "exercise", "exercise.registry.json"), "utf8"));
    patterns = new Map(Object.values(isRecord(doc?.entries) ? doc.entries : {}).filter(isRecord).map((entry) => [text(entry.exercise_id), text(entry.movement_pattern_id)] as [string, string]));
  }
  return patterns.get(exerciseId) || undefined;
}

function plannedExercises(plannedSession: unknown): AnalysisPlannedExercise[] {
  const planned = isRecord(plannedSession) ? plannedSession : {};
  const exercises = Array.isArray(planned.exercises) ? planned.exercises.filter(isRecord) : [];
  return exercises.map((exercise) => {
    const repRange = isRecord(exercise.rep_range) ? exercise.rep_range : null;
    const setRange = isRecord(exercise.set_range) ? exercise.set_range : null;
    const intensity = isRecord(exercise.intensity) ? exercise.intensity : {};
    const intensityType = text(intensity.type);
    const resolved = isRecord(exercise.resolved_load) ? exercise.resolved_load : null;
    // The weight: a % of max made a weight (and its range's top, and the max
    // it came from), or a fixed weight (and its range's top).
    const fromPercent = resolved && num(resolved.value) !== null;
    const load = fromPercent
      ? toKg(num(resolved!.value), resolved!.unit)
      : intensityType === "load" ? toKg(num(intensity.value), intensity.unit) : null;
    const loadMax = fromPercent
      ? toKg(num(resolved!.maximum_value), resolved!.unit)
      : intensityType === "load" ? toKg(num(intensity.maximum), intensity.unit) : null;
    const oneRepMax = fromPercent ? toKg(num(resolved!.one_rep_max), resolved!.unit) : null;
    const effortTarget = ["rpe", "borg", "cr10"].includes(intensityType) ? num(intensity.value) : null;
    const effortTargetMax = effortTarget !== null ? num(intensity.maximum) : null;
    // Reps, or time / distance (done by completing it).
    const durationRange = isRecord(exercise.duration_range) ? exercise.duration_range : null;
    const distanceRange = isRecord(exercise.distance_range) ? exercise.distance_range : null;
    const duration = durationRange ? num(durationRange.minimum) : num(exercise.duration_seconds);
    const distanceRaw = distanceRange ? num(distanceRange.minimum) : num(exercise.distance_value);
    const distance = distanceRaw !== null ? (text(exercise.distance_unit) === "feet" ? Math.round(distanceRaw * 0.3048 * 10) / 10 : distanceRaw) : null;
    const dose: "reps" | "time" | "distance" = duration !== null ? "time" : distance !== null ? "distance" : "reps";
    return {
      exercise_id: text(exercise.exercise_id),
      segment: ["warm_up", "cool_down"].includes(text(exercise.segment)) ? text(exercise.segment) : "working",
      ...(text(exercise.role) ? { role: text(exercise.role) } : {}),
      sets: num(exercise.sets) ?? 0,
      ...(setRange && num(setRange.maximum) !== null ? { sets_max: num(setRange.maximum)! } : {}),
      reps_target: dose === "reps" ? (repRange ? num(repRange.minimum) : num(exercise.reps)) : null,
      load_kg: load && load > 0 ? load : null,
      load_kg_max: loadMax && load && loadMax > load ? loadMax : null,
      one_rep_max_kg: oneRepMax && oneRepMax > 0 ? oneRepMax : null,
      ...(intensityType ? { intensity_type: intensityType } : {}),
      target_effort: effortTarget,
      target_effort_max: effortTargetMax !== null && effortTarget !== null && effortTargetMax > effortTarget ? effortTargetMax : null,
      dose,
      duration_s: dose === "time" ? duration : null,
      distance_m: dose === "distance" ? distance : null
    };
  });
}

function analysisEvent(raw: unknown, at: string): AnalysisEvent | null {
  if (!isRecord(raw)) return null;
  const type = text(raw.type);
  if (!type) return null;
  return {
    type,
    at,
    ...(text(raw.exercise_id) ? { exercise_id: text(raw.exercise_id) } : {}),
    ...(num(raw.reps) !== null ? { reps: num(raw.reps)! } : {}),
    ...(num(raw.load_value) !== null ? { load_kg: toKg(num(raw.load_value), raw.load_unit) } : {}),
    ...(num(raw.set_index) !== null ? { set_index: num(raw.set_index)! } : {}),
    ...(num(raw.rpe_value) !== null ? { rpe: num(raw.rpe_value)! } : {}),
    ...(num(raw.borg_value) !== null ? { borg: num(raw.borg_value)! } : {}),
    ...(num(raw.cr10_value) !== null ? { cr10: num(raw.cr10_value)! } : {}),
    ...(type === "PAIN_REPORT" ? { pain_area: text(raw.pain_area) || null } : {}),
    ...(text(raw.reason_code) ? { reason_code: text(raw.reason_code) } : {})
  };
}

async function loadSessions(athleteUserId: string, since: string): Promise<AnalysisSession[]> {
  const sessions = await pool.query(
    `SELECT session_id, status, created_at, planned_session FROM sessions
     WHERE beta_subject_user_id = $1 AND created_at >= $2::date ORDER BY created_at ASC`,
    [athleteUserId, since]
  );
  if (!sessions.rows.length) return [];
  const events = await pool.query(
    `SELECT session_id, event, created_at FROM runtime_events WHERE session_id = ANY($1::text[]) ORDER BY session_id, seq`,
    [sessions.rows.map((row) => String(row.session_id))]
  );
  const bySession = new Map<string, AnalysisEvent[]>();
  for (const row of events.rows) {
    const event = analysisEvent(row.event, new Date(row.created_at).toISOString());
    if (!event) continue;
    const list = bySession.get(String(row.session_id)) ?? [];
    list.push(event);
    bySession.set(String(row.session_id), list);
  }
  return sessions.rows.map((row) => ({
    session_id: String(row.session_id),
    status: text(row.status),
    created_at: new Date(row.created_at).toISOString(),
    ...(isRecord(row.planned_session) && text(row.planned_session.title) ? { title: text(row.planned_session.title) } : {}),
    planned: plannedExercises(row.planned_session),
    events: bySession.get(String(row.session_id)) ?? []
  }));
}

async function loadReadiness(athleteUserId: string, since: string): Promise<ReadinessFact[]> {
  const result = await pool.query(
    `SELECT DISTINCT ON (event_payload->>'date') event_payload FROM product_account_events
     WHERE user_id = $1 AND event_type = 'athlete_readiness_check_in' AND event_payload->>'date' >= $2
     ORDER BY event_payload->>'date', occurred_at DESC, event_id DESC`,
    [athleteUserId, since]
  );
  return result.rows
    .map((row) => (isRecord(row.event_payload) ? row.event_payload : {}))
    .filter((payload) => text(payload.date) && num(payload.sleep) !== null && num(payload.soreness) !== null && num(payload.stress) !== null)
    .map((payload) => ({ date: text(payload.date), sleep: num(payload.sleep)!, soreness: num(payload.soreness)!, stress: num(payload.stress)!, fatigue: num(payload.fatigue), mood: num(payload.mood), resting_hr: num(payload.resting_hr), hrv_ms: num(payload.hrv_ms) }));
}

function checkinFacts(checkins: readonly Json[]): CheckinFact[] {
  return checkins.map((entry) => ({
    week_start: text(entry.week_start_date),
    energy: num(entry.energy_level),
    motivation: num(entry.motivation_level),
    sleep: num(entry.sleep_quality)
  })).filter((entry) => entry.week_start);
}

async function displayName(userId: string): Promise<string> {
  const result = await pool.query("SELECT display_name FROM product_accounts WHERE user_id = $1", [userId]).catch(() => null);
  return text(result?.rows?.[0]?.display_name);
}

export async function analyseAthleteForCoach(coachUserId: string, athleteUserId: string, weeksInput: unknown, today = new Date().toISOString().slice(0, 10)): Promise<Json> {
  const weeks = ANALYSIS_WEEK_CHOICES.includes(Number(weeksInput)) ? Number(weeksInput) : 12;
  return analyseWindowForCoach(coachUserId, athleteUserId, weeks, today);
}

// Any window of whole weeks up to `today` (a progress report's period);
// `closed` when the period has ended, so its last week counts in full.
export type AnalysisWindowOptions = Readonly<{ closed?: boolean; from?: string; to?: string }>;

export async function analyseWindowForCoach(coachUserId: string, athleteUserId: string, weeks: number, today: string, options: AnalysisWindowOptions = {}): Promise<Json> {
  await requireCoachAthleteAccess(coachUserId, athleteUserId);
  return analyseAthleteWindow(athleteUserId, coachUserId, weeks, today, options);
}

// The analysis itself, with NO access check: callers check first - a coach
// for their own athlete (above), a team coach or an org owner for the
// team's athletes (team_analysis_service.ts, org_progress_rollup_service.ts).
// checkinCoachUserId is the athlete's own coach, whose weekly check-ins
// with them are read.
export async function analyseAthleteWindow(athleteUserId: string, checkinCoachUserId: string, weeks: number, today: string, options: AnalysisWindowOptions = {}): Promise<Json> {
  const coachUserId = checkinCoachUserId;
  // 4 extra weeks so the first shown week has a chronic load to compare with,
  // and 28 days of readiness before it for each athlete's own normal.
  const since = addDays(weekStart(today), -7 * (weeks + 4));
  const [sessions, readiness, checkins, plan, custom, sessionReports, otherTraining, programmes] = await Promise.all([
    loadSessions(athleteUserId, since),
    loadReadiness(athleteUserId, since),
    listWeeklyCheckinsForCoach(coachUserId, athleteUserId).catch(() => []),
    getAthleteTrainingPlan(athleteUserId).catch(() => null),
    getAthleteCustomExerciseNames(athleteUserId).catch(() => ({})),
    loadSessionReports(athleteUserId, since).catch(() => ({})),
    listOtherTraining(athleteUserId, since).catch(() => []),
    programmeHistory(athleteUserId).catch(() => [])
  ]);
  const [tests, profile, externalLoad, injuries] = await Promise.all([
    loadTestResults(athleteUserId).catch(() => []),
    loadProfileHistory(coachUserId, athleteUserId).catch(() => ({ maxes: [], bodyweight_kg: null })),
    loadExternalLoad(athleteUserId, since).catch(() => []),
    loadInjuries(athleteUserId).catch(() => [])
  ]);
  const ids = [...new Set(sessions.flatMap((session) => [...session.planned.map((p) => p.exercise_id), ...session.events.map((e) => e.exercise_id ?? "")]).filter(Boolean).map((id) => id.replace(/__r[0-9]+$/u, "")))];
  const names = sessionExerciseDisplayNames(ids, custom);
  const analysis = analyseAthlete({
    today,
    weeks,
    closed: options.closed ?? false,
    ...(options.from ? { from: options.from } : {}),
    ...(options.to ? { to: options.to } : {}),
    pattern_of: patternOf,
    sessions,
    readiness,
    checkins: checkinFacts(checkins as Json[]),
    session_reports: sessionReports,
    other_training: otherTraining,
    markers: [...planMarkers(plan as Json | null), ...blockMarkers(programmes)],
    tests,
    external_load: externalLoad,
    injuries,
    tested_maxes: profile.maxes,
    bodyweight_kg: profile.bodyweight_kg,
    planned_days_per_week: num(plan?.training_days_per_week),
    exercise_name: (id) => names[id] ?? id.replaceAll("_", " "),
    is_strength_lift: (id) => isE1rmExercise(id, patternOf)
  });
  const list = findings(analysis);
  return {
    ok: true,
    athlete: { user_id: athleteUserId, display_name: await displayName(athleteUserId) },
    weeks,
    today,
    findings: list,
    attention: attentionScore(list),
    analysis
  };
}

// One athlete's row for a roster: their findings and headline numbers, and
// the weekly series a team view averages.
export function rosterRowFor(athleteUserId: string, name: string, result: Json): Json {
  const analysis = result.analysis as Record<string, Json>;
  const complete = (rows: Json[]) => rows.filter((row) => row.partial_week !== true);
  const latest = (rows: Json[], key: string) => {
    for (let index = rows.length - 1; index >= 0; index -= 1) if (rows[index][key] !== null && rows[index][key] !== undefined) return rows[index][key];
    return null;
  };
  const adherenceRows = complete(analysis.adherence.rows as Json[]);
  const lifts = analysis.strength.lifts as Json[];
  const painAreas = (analysis.pain.areas as Json[]).filter((area) => Number(area.weeks) >= 2);
  const sessions = (analysis.load as Json).sessions as Json[];
  return {
    athlete_user_id: athleteUserId,
    display_name: name,
    attention: result.attention,
    findings: result.findings,
    weeks: analysis.weeks,
    adherence: { latest_pct: latest(adherenceRows, "adherence_pct"), series: adherenceRows.map((row) => row.adherence_pct), by_week: (analysis.adherence.rows as Json[]).map((row) => row.adherence_pct) },
    load: { acute_chronic: latest(complete(analysis.load.rows as Json[]), "acute_chronic"), series: (analysis.load.rows as Json[]).map((row) => row.load), ratio_by_week: (analysis.load.rows as Json[]).map((row) => (row.partial_week ? null : row.acute_chronic)) },
    readiness: { z: latest(analysis.readiness.rows as Json[], "z"), z_by_week: (analysis.readiness.rows as Json[]).map((row) => row.z) },
    strength: lifts.filter((lift) => lift.main !== false).slice(0, 3).map((lift) => ({ name: lift.name, status: lift.status, change_pct: lift.change_pct, latest: lift.latest, relative_to_bodyweight: lift.relative_to_bodyweight ?? null })),
    tests_latest: Object.fromEntries((((analysis.testing ?? {}) as Json).tests as Json[] | undefined ?? []).map((test) => [String(test.test_id), test.latest])),
    execution: { reps_hit_pct: latest(complete(analysis.execution.rows as Json[]), "reps_hit_pct") },
    pain: { recurring_areas: painAreas.map((area) => area.area) },
    // Injuries (the athlete's own coach and a head coach only - withoutPainDetail drops it).
    injuries: (() => {
      const injuries = (analysis.injuries ?? {}) as Json;
      const current = injuries.current as Json | null | undefined;
      return {
        current: current ? { name: current.name, status: current.status, expected_return: current.expected_return } : null,
        in_window: Number(injuries.in_window ?? 0), days_lost_window: Number(injuries.days_lost_window ?? 0),
        // Training hours in the window: the exposure injury rates are per.
        exposure_hours: Math.round(sessions.filter((session) => session.status !== "skipped").reduce((sum, session) => sum + (Number(session.minutes) || 0), 0) / 6) / 10
      };
    })(),
    last_session: sessions.length ? sessions[sessions.length - 1].date : null
  };
}

// Every connected athlete, most in need of a look first: their findings and
// the headline numbers for the roster table.
export async function analyseRosterForCoach(coachUserId: string, today = new Date().toISOString().slice(0, 10)): Promise<Json> {
  const roster = await listConnectedCoachAthletes(coachUserId);
  const rows = await Promise.all(roster.map(async (athlete) => {
    const athleteUserId = text(athlete.athlete_user_id);
    const name = text(athlete.display_name) || athleteUserId;
    try {
      // Their email too - the coach matches GPS exports to athletes by it.
      return { ...rosterRowFor(athleteUserId, name, await analyseAthleteForCoach(coachUserId, athleteUserId, 8, today)), email: text(athlete.email) || null };
    }
    catch {
      return { athlete_user_id: athleteUserId, display_name: name, attention: null, findings: [], unavailable: true };
    }
  }));
  rows.sort((a, b) => Number(b.attention ?? -1) - Number(a.attention ?? -1) || String(a.display_name).localeCompare(String(b.display_name)));
  return { ok: true, today, weeks: 8, athletes: rows };
}
