// DEV NOTE: Coach Analysis - pure metrics (no clock, no database). Turns an
// athlete's sessions, logged sets, effort ratings, readiness check-ins and
// weekly check-ins into weekly pattern trends, each with a plain-English
// headline for a coach and the numbers behind it for a sports scientist.
//
// Methods (and their caveats) - shown on the page under "Show the numbers":
// - Estimated max: Epley, load x (1 + reps / 30); when the athlete rated the
//   exercise's effort (RPE 6-10, sets of 1-10), the RTS (Tuchscherer) RPE
//   chart instead: load / chart % for those reps at that RPE.
// - Session load (Foster session-RPE): session effort (the mean of the
//   athlete's exercise ratings on a 0-10 scale; Borg 6-20 is rescaled) x
//   minutes (first to last event of the session), in arbitrary units (AU).
// - Acute:chronic ratio: this week's load / the mean of the 4 weeks before
//   it ("uncoupled"). 0.8-1.3 is the widely quoted range; it is a heuristic,
//   disputed as an injury predictor, and shown as context only.
// - Monotony: the week's mean daily load / its standard deviation (rest days
//   count as 0); strain: weekly load x monotony (Foster 1998). Monotony
//   above 2 is the usual "too samey" line.
// - Readiness against their own normal: each day's sleep + soreness + stress
//   (each 1-5) compared with the mean and spread of the previous 28 days
//   (a z-score); a week averaging z <= -1 is flagged.

type Json = Record<string, unknown>;

import { analyseInjuries, injuryActionFor, injuryFindings, type InjuryRecord } from "./injury_metrics.js";
import { ewmaRatios, forwardActionFor, forwardFindings, forwardRows, type PlannedWeek } from "./forward_load.js";
import { attemptPlan, prilepinCheck, velocitySummary, type HeavySet, type VelocitySet } from "./strength_top_end.js";

export type AnalysisEvent = Readonly<{
  type: string;
  at: string; // ISO timestamp
  exercise_id?: string;
  reps?: number;
  load_kg?: number | null;
  set_index?: number;
  rpe?: number;
  borg?: number;
  cr10?: number;
  // Bar speed from a VBT device (m/s), on a set log.
  velocity?: number;
  pain_area?: string | null;
  reason_code?: string;
}>;

export type AnalysisPlannedExercise = Readonly<{
  exercise_id: string;
  segment: string;
  role?: string;
  sets: number;
  sets_max?: number;
  reps_target: number | null;
  // The prescribed weight (a fixed weight, or a % of max made a weight); a
  // range's top; the max a % came from.
  load_kg: number | null;
  load_kg_max?: number | null;
  one_rep_max_kg?: number | null;
  // load | percent_1rm | rpe | borg | cr10 | bodyweight (none: the athlete sets it)
  intensity_type?: string;
  // An effort target in its own scale (RPE 1-10, Borg 6-20, CR10 0-10), and a range's top.
  target_effort?: number | null;
  target_effort_max?: number | null;
  // Reps (logged set by set), or time / distance (done by completing it).
  dose?: "reps" | "time" | "distance";
  duration_s?: number | null;
  distance_m?: number | null;
}>;

export type AnalysisSession = Readonly<{
  session_id: string;
  status: string;
  created_at: string;
  title?: string;
  planned: readonly AnalysisPlannedExercise[];
  events: readonly AnalysisEvent[];
}>;

// The athlete's own rating of a whole gym session when they finish it:
// effort 0-10 (CR10) and how many minutes it took. With it, the session's
// load is measured; without it, it's estimated from the app's timings.
export type SessionLoadReport = Readonly<{ srpe: number; minutes: number }>;
// Training outside the app's sessions: team practice, matches, conditioning,
// another sport - logged with its minutes and effort (0-10).
export type OtherTraining = Readonly<{ id: string; date: string; kind: string; minutes: number; srpe: number; note?: string }>;
// A date worth seeing on the charts: a competition, the season, a match, a
// deload or peak block.
export type CalendarMarker = Readonly<{ date: string; kind: string; label: string }>;
export const OTHER_TRAINING_KINDS: Readonly<Record<string, string>> = { practice: "Team practice", match: "Match", conditioning: "Conditioning", other_sport: "Other sport" };

// A test result the coach recorded (jumps, sprints, conditioning...), in
// the test's own unit; and a max they tested or set (kg) on a date.
export type TestResult = Readonly<{ id: string; test_id: string; date: string; value: number }>;
export type TestedMax = Readonly<{ exercise_id: string; date: string; value_kg: number }>;

// The daily check-in: sleep, soreness and stress (1-5) always; fatigue and
// mood (1-5), resting heart rate (bpm) and HRV (ms) when the athlete adds them.
export type ReadinessFact = Readonly<{ date: string; sleep: number; soreness: number; stress: number; fatigue?: number | null; mood?: number | null; resting_hr?: number | null; hrv_ms?: number | null }>;
// A session from a GPS or heart-rate system (imported from its export).
export type ExternalLoad = Readonly<{ id: string; date: string; duration_min?: number | null; total_distance_m?: number | null; hsr_m?: number | null; sprint_m?: number | null; player_load?: number | null; avg_hr?: number | null; max_hr?: number | null }>;
export type CheckinFact = Readonly<{ week_start: string; energy: number | null; motivation: number | null; sleep: number | null }>;

export type AnalysisInput = Readonly<{
  today: string; // YYYY-MM-DD
  weeks: number;
  // The period has ended (a report on it): no week is "this week".
  closed?: boolean;
  // A report from a set date (and/or to one): only sessions, check-ins and
  // pain on those days count. Load still reads the weeks before, for its
  // 4-week normal.
  from?: string;
  to?: string;
  // Movement pattern per exercise (squat, hinge, push...), for sets by pattern.
  pattern_of?: (exerciseId: string) => string | undefined;
  sessions: readonly AnalysisSession[];
  readiness: readonly ReadinessFact[];
  checkins: readonly CheckinFact[];
  session_reports?: Readonly<Record<string, SessionLoadReport>>;
  other_training?: readonly OtherTraining[];
  markers?: readonly CalendarMarker[];
  // Their latest bodyweight (kg), for strength relative to it.
  bodyweight_kg?: number | null;
  tests?: readonly TestResult[];
  external_load?: readonly ExternalLoad[];
  // The injury log (injury_log_service.ts): every injury still standing.
  injuries?: readonly InjuryRecord[];
  // The programme's weeks still to come (athlete_my_programme_service plannedWeeksAhead).
  planned_ahead?: readonly PlannedWeek[];
  // For meet attempts: their sport and competition date.
  activity_id?: string | null;
  competition_date?: string | null;
  tested_maxes?: readonly TestedMax[];
  planned_days_per_week: number | null;
  exercise_name: (exerciseId: string) => string;
  is_strength_lift: (exerciseId: string) => boolean;
}>;

// ---------- small helpers ----------
const DAY_MS = 86_400_000;
const round = (value: number, places = 1) => Math.round(value * 10 ** places) / 10 ** places;
const mean = (values: readonly number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN;
export function standardDeviation(values: readonly number[]): number {
  if (values.length < 2) return NaN;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - m) ** 2, 0) / (values.length - 1));
}
const day = (iso: string) => iso.slice(0, 10);
const baseExercise = (exerciseId: string) => exerciseId.replace(/__r[0-9]+$/u, "");
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

// Effort ratings in any of the three scales the athlete can use: RPE and
// CR10 (0-10) as they are, Borg (6-20) rescaled to 0-10 where scales mix.
export type EffortScale = "rpe" | "cr10" | "borg";
export const SCALE_LABEL: Readonly<Record<EffortScale, string>> = { rpe: "RPE", cr10: "CR10", borg: "Borg" };
export function ratingOf(event: AnalysisEvent): { scale: EffortScale; raw: number; value10: number } | null {
  if (event.type === "RPE_REPORT" && finite(event.rpe)) return { scale: "rpe", raw: event.rpe, value10: event.rpe };
  if (event.type === "CR10_REPORT" && finite(event.cr10)) return { scale: "cr10", raw: event.cr10, value10: event.cr10 };
  if (event.type === "BORG_REPORT" && finite(event.borg)) return { scale: "borg", raw: event.borg, value10: ((event.borg - 6) / 14) * 10 };
  return null;
}
// The tests a coach can record, each with its unit, which way is better,
// and its smallest worthwhile change (about the test's typical error in
// trained athletes): a change smaller than that is noise.
export type PerformanceTest = Readonly<{ name: string; unit: string; better: "higher" | "lower"; swc: number; decimals: number; category: string }>;
export const PERFORMANCE_TESTS: Readonly<Record<string, PerformanceTest>> = Object.freeze({
  cmj_cm: { name: "Countermovement jump", unit: "cm", better: "higher", swc: 1.5, decimals: 1, category: "power" },
  squat_jump_cm: { name: "Squat jump", unit: "cm", better: "higher", swc: 1.5, decimals: 1, category: "power" },
  broad_jump_cm: { name: "Standing broad jump", unit: "cm", better: "higher", swc: 5, decimals: 0, category: "power" },
  sprint_10m_s: { name: "10 m sprint", unit: "s", better: "lower", swc: 0.03, decimals: 2, category: "speed" },
  sprint_20m_s: { name: "20 m sprint", unit: "s", better: "lower", swc: 0.04, decimals: 2, category: "speed" },
  sprint_40m_s: { name: "40 m sprint", unit: "s", better: "lower", swc: 0.06, decimals: 2, category: "speed" },
  agility_505_s: { name: "505 agility", unit: "s", better: "lower", swc: 0.05, decimals: 2, category: "speed" },
  yoyo_ir1_m: { name: "Yo-Yo IR1", unit: "m", better: "higher", swc: 40, decimals: 0, category: "conditioning" },
  bronco_s: { name: "Bronco", unit: "s", better: "lower", swc: 5, decimals: 0, category: "conditioning" },
  row_2k_s: { name: "2 km row", unit: "s", better: "lower", swc: 3, decimals: 0, category: "conditioning" },
  grip_kg: { name: "Grip strength", unit: "kg", better: "higher", swc: 2, decimals: 1, category: "strength" },
  pull_ups_reps: { name: "Max pull-ups", unit: "reps", better: "higher", swc: 1, decimals: 0, category: "strength" }
});

// Sets by the % of max lifted (where the programme gives a % of max).
export const INTENSITY_ZONES = Object.freeze([
  { label: "under 60%", below: 60 }, { label: "60-70%", below: 70 }, { label: "70-80%", below: 80 },
  { label: "80-90%", below: 90 }, { label: "90% +", below: Infinity }
]);

// The Monday (UTC) of the week a date falls in.
export function weekStart(date: string): string {
  const d = new Date(`${day(date)}T00:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - offset * DAY_MS).toISOString().slice(0, 10);
}
export function addDays(date: string, days: number): string {
  return new Date(new Date(`${day(date)}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}
// The last `count` week starts, oldest first, ending with the current week.
export function weekStarts(today: string, count: number): string[] {
  const current = weekStart(today);
  return Array.from({ length: count }, (_, index) => addDays(current, -7 * (count - 1 - index)));
}

// ---------- estimated max ----------
// The RTS chart as one sequence: each step is half an RPE (or half a rep).
// index = (reps - 1) * 2 + (10 - RPE) * 2, so 1 @ 10 is 100%, 3 @ 8 is 86.3%
// and 10 @ 6 is 62.6%.
const RTS_SEQUENCE = [
  100, 97.8, 95.5, 93.9, 92.2, 90.7, 89.2, 87.8, 86.3, 85.0, 83.7, 82.4, 81.1, 79.9,
  78.6, 77.4, 76.2, 75.1, 73.9, 72.3, 70.7, 69.4, 68.0, 66.7, 65.3, 64.0, 62.6
];
export function rtsPercent(reps: number, rpe: number): number | null {
  if (!Number.isInteger(reps) || reps < 1 || reps > 10 || !(rpe >= 6 && rpe <= 10)) return null;
  const index = Math.round((reps - 1) * 2 + (10 - rpe) * 2);
  return RTS_SEQUENCE[index] ?? null;
}
export function estimatedMax(loadKg: number, reps: number, rpe: number | null): { value: number; method: "rts" | "epley" } | null {
  if (!(loadKg > 0) || !Number.isInteger(reps) || reps < 1 || reps > 10) return null;
  const percent = rpe !== null ? rtsPercent(reps, rpe) : null;
  if (percent) return { value: round(loadKg / (percent / 100), 1), method: "rts" };
  return { value: round(reps === 1 ? loadKg : loadKg * (1 + reps / 30), 1), method: "epley" };
}

// ---------- session load ----------
// Effort on a 0-10 scale: RPE and CR10 as they are; Borg 6-20 rescaled.
export function sessionEffort(events: readonly AnalysisEvent[]): number | null {
  const ratings: number[] = [];
  for (const event of events) {
    if (event.type === "RPE_REPORT" && finite(event.rpe)) ratings.push(event.rpe);
    else if (event.type === "CR10_REPORT" && finite(event.cr10)) ratings.push(event.cr10);
    else if (event.type === "BORG_REPORT" && finite(event.borg)) ratings.push(((event.borg - 6) / 14) * 10);
  }
  return ratings.length ? round(mean(ratings), 2) : null;
}
export function sessionMinutes(events: readonly AnalysisEvent[]): number | null {
  const times = events.map((event) => Date.parse(event.at)).filter(Number.isFinite).sort((a, b) => a - b);
  if (times.length < 2) return null;
  const start = events.find((event) => event.type === "START_SESSION");
  const from = start ? Date.parse(start.at) : times[0];
  const minutes = (times[times.length - 1] - from) / 60_000;
  return minutes >= 1 ? Math.min(round(minutes, 0), 240) : null;
}
export function sessionLoad(events: readonly AnalysisEvent[]): number | null {
  const effort = sessionEffort(events);
  const minutes = sessionMinutes(events);
  return effort !== null && minutes !== null ? round(effort * minutes, 0) : null;
}

// Acute:chronic (uncoupled): this week / the mean of the previous 4.
export function acuteChronic(weeklyLoads: readonly (number | null)[], index: number): number | null {
  const current = weeklyLoads[index];
  const previous = weeklyLoads.slice(Math.max(0, index - 4), index);
  if (current === null || current === undefined || previous.length < 4 || previous.some((value) => value === null)) return null;
  const chronic = mean(previous as number[]);
  return chronic > 0 ? round(current / chronic, 2) : null;
}
// Monotony: mean daily load / its SD across the 7 days (rest days are 0).
export function monotony(dailyLoads: readonly number[]): number | null {
  if (dailyLoads.length !== 7 || dailyLoads.every((value) => value === 0)) return null;
  const sd = standardDeviation(dailyLoads);
  return sd > 0 ? round(mean(dailyLoads) / sd, 2) : null;
}

// The mean of the numbers given, or null when there are none.
const averageOf = (values: ReadonlyArray<number | null | undefined>, places = 1) => {
  const numbers = values.filter(finite);
  return numbers.length ? round(mean(numbers), places) : null;
};

// ---------- the analysis ----------
type WeekRow = Json & { week_start: string };

const setLogs = (session: AnalysisSession) => session.events.filter((event) => event.type === "SET_LOG_REPORT" || event.type === "EXTRA_SET_REPORT");
const done = (session: AnalysisSession) => session.status === "completed" || session.status === "partial";

export function analyseAthlete(input: AnalysisInput): Json {
  const weeks = weekStarts(input.today, input.weeks);
  // A report on a period that has ended counts its last week in full.
  const currentWeek = input.closed ? null : weekStart(input.today);
  const first = weeks[0];
  const inWindow = (date: string) => day(date) >= first && day(date) <= input.today;
  // Load needs 4 weeks of history before the first shown week.
  const loadWeeks = weekStarts(input.today, input.weeks + 4);
  const sessionDay = (session: AnalysisSession) => day(session.events.find((event) => event.type === "START_SESSION")?.at ?? session.events[0]?.at ?? session.created_at);
  const inRange = (date: string) => (!input.from || date >= input.from) && (!input.to || date <= input.to);
  const allSessions = [...input.sessions].sort((a, b) => sessionDay(a).localeCompare(sessionDay(b)));
  const sessions = allSessions.filter((session) => inRange(sessionDay(session)));

  // --- load ---
  // Gym sessions: measured (the athlete's own effort x minutes when they
  // finished) or estimated (their exercise ratings x the app's timings).
  // Other training (practice, matches, conditioning) adds its own load.
  const dailyLoad = new Map<string, number>();
  const dailyGym = new Map<string, number>();
  const dailySport = new Map<string, number>();
  const addLoad = (map: Map<string, number>, date: string, load: number) => map.set(date, (map.get(date) ?? 0) + load);
  const reports = input.session_reports ?? {};
  const sessionRows: Json[] = [];
  for (const session of allSessions.filter(done)) {
    const report = reports[session.session_id];
    const measured = Boolean(report && finite(report.srpe) && finite(report.minutes) && report.minutes > 0);
    const load = measured ? round(report!.srpe * Math.min(report!.minutes, 300), 0) : sessionLoad(session.events);
    const date = sessionDay(session);
    if (load !== null) { addLoad(dailyLoad, date, load); addLoad(dailyGym, date, load); }
    if (!inRange(date)) continue;
    sessionRows.push({
      session_id: session.session_id, date, title: session.title ?? null, status: session.status, kind: "gym", measured,
      effort: measured ? report!.srpe : sessionEffort(session.events), minutes: measured ? Math.min(report!.minutes, 300) : sessionMinutes(session.events),
      load, sets: setLogs(session).length, pain: session.events.some((event) => event.type === "PAIN_REPORT"), skipped: session.events.filter((event) => event.type === "SKIP_EXERCISE").length
    });
  }
  const other = [...(input.other_training ?? [])].filter((entry) => finite(entry.minutes) && entry.minutes > 0 && finite(entry.srpe)).sort((a, b) => a.date.localeCompare(b.date));
  for (const entry of other) {
    const load = round(entry.srpe * Math.min(entry.minutes, 300), 0);
    addLoad(dailyLoad, entry.date, load);
    addLoad(dailySport, entry.date, load);
    if (!inRange(entry.date) || !inWindow(entry.date)) continue;
    sessionRows.push({ session_id: entry.id, date: entry.date, title: OTHER_TRAINING_KINDS[entry.kind] ?? "Other training", status: "completed", kind: entry.kind, measured: true, effort: entry.srpe, minutes: Math.min(entry.minutes, 300), load, sets: 0, pain: false, skipped: 0, ...(entry.note ? { note: entry.note } : {}) });
  }
  sessionRows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const trainedDates = [...allSessions.filter(done).map(sessionDay), ...other.map((entry) => entry.date)].sort();
  const firstTrainedWeek = trainedDates.length ? weekStart(trainedDates[0]) : null;
  const weeklyLoadAll = loadWeeks.map((start) => {
    // Before their first session there is no load history: "no data", not 0.
    if (firstTrainedWeek === null || start < firstTrainedWeek) return null;
    const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
    const rated = days.some((date) => dailyLoad.has(date));
    const trained = trainedDates.some((date) => weekStart(date) === start);
    return rated ? days.reduce((sum, date) => sum + (dailyLoad.get(date) ?? 0), 0) : trained ? null : 0;
  });
  const sumWeek = (map: Map<string, number>, start: string) => Array.from({ length: 7 }, (_, offset) => map.get(addDays(start, offset)) ?? 0).reduce((sum, value) => sum + value, 0);
  // EWMA acute:chronic at each week's end (or today), from the first training day.
  const ewma = ewmaRatios(dailyLoad, trainedDates[0] ?? null, weeks.map((start) => (addDays(start, 6) > input.today ? input.today : addDays(start, 6))));
  const loadRows = weeks.map((start, weekIndex) => {
    const index = loadWeeks.indexOf(start);
    const daily = Array.from({ length: 7 }, (_, offset) => dailyLoad.get(addDays(start, offset)) ?? 0);
    const weekly = weeklyLoadAll[index];
    const mono = weekly ? monotony(daily) : null;
    return {
      week_start: start, partial_week: start === currentWeek, load: weekly,
      gym_load: weekly === null ? null : sumWeek(dailyGym, start), sport_load: weekly === null ? null : sumWeek(dailySport, start),
      matches: other.filter((entry) => entry.kind === "match" && weekStart(entry.date) === start).length,
      acute_chronic: acuteChronic(weeklyLoadAll, index), ewma_ratio: ewma[weekIndex], monotony: mono, strain: weekly && mono ? round(weekly * mono, 0) : null
    };
  });
  const gymRows = sessionRows.filter((row) => row.kind === "gym");
  const loadQuality = {
    gym_sessions: gymRows.length,
    measured: gymRows.filter((row) => row.measured).length,
    measured_pct: gymRows.length ? round((gymRows.filter((row) => row.measured).length / gymRows.length) * 100, 0) : null,
    other_sessions: sessionRows.length - gymRows.length
  };

  // --- markers: competitions, the season, matches, deloads and peaks ---
  const markerRows = [
    ...(input.markers ?? []),
    ...other.filter((entry) => entry.kind === "match").map((entry) => ({ date: entry.date, kind: "match", label: entry.note ? `Match: ${entry.note}` : "Match" }))
  ]
    .filter((marker) => weekStart(marker.date) >= first && marker.date <= input.today && inRange(marker.date))
    .map((marker) => ({ ...marker, week_start: weekStart(marker.date) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // --- volume ---
  const volumeRows = weeks.map((start) => {
    const weekSessions = sessions.filter((session) => weekStart(sessionDay(session)) === start);
    const logs = weekSessions.flatMap(setLogs);
    const tonnage = logs.reduce((sum, log) => sum + (finite(log.load_kg) && finite(log.reps) ? log.load_kg * log.reps : 0), 0);
    const bodyweightReps = logs.reduce((sum, log) => sum + (!(finite(log.load_kg) && log.load_kg > 0) && finite(log.reps) ? log.reps : 0), 0);
    // Timed and distance work counts as prescribed once the athlete completes it.
    let minutes = 0;
    let distance = 0;
    for (const session of weekSessions.filter(done)) {
      const completed = new Set(session.events.filter((event) => event.type === "COMPLETE_EXERCISE").map((event) => event.exercise_id));
      const skipped = new Set(session.events.filter((event) => event.type === "SKIP_EXERCISE").map((event) => event.exercise_id));
      for (const planned of session.planned.filter((p) => p.segment === "working" && completed.has(p.exercise_id) && !skipped.has(p.exercise_id))) {
        if (planned.dose === "time" && finite(planned.duration_s)) minutes += (planned.sets * planned.duration_s) / 60;
        if (planned.dose === "distance" && finite(planned.distance_m)) distance += planned.sets * planned.distance_m;
      }
    }
    return { week_start: start, sets: logs.length, tonnage_kg: round(tonnage, 0), bodyweight_reps: bodyweightReps, timed_minutes: round(minutes, 1), distance_m: round(distance, 0) };
  });

  // --- strength (estimated max per lift, weekly best) ---
  const liftWeeks = new Map<string, Map<string, { value: number; method: string; reps: number; load: number }>>();
  for (const session of sessions.filter(done)) {
    const ratingFor = new Map<string, number>();
    for (const event of session.events) {
      if (event.type === "RPE_REPORT" && event.exercise_id && finite(event.rpe)) ratingFor.set(baseExercise(event.exercise_id), event.rpe);
    }
    for (const log of setLogs(session)) {
      if (!log.exercise_id || !finite(log.load_kg) || !finite(log.reps)) continue;
      const lift = baseExercise(log.exercise_id);
      if (!input.is_strength_lift(lift)) continue;
      // The athlete's rating describes the exercise's hardest set: use it
      // for the heaviest set only, Epley for the rest.
      const heaviest = Math.max(...setLogs(session).filter((other) => other.exercise_id && baseExercise(other.exercise_id) === lift).map((other) => Number(other.load_kg) || 0));
      const estimate = estimatedMax(log.load_kg, log.reps, log.load_kg === heaviest ? ratingFor.get(lift) ?? null : null);
      if (!estimate) continue;
      const week = weekStart(sessionDay(session));
      const byWeek = liftWeeks.get(lift) ?? new Map();
      const best = byWeek.get(week);
      if (!best || estimate.value > best.value) byWeek.set(week, { ...estimate, reps: log.reps, load: log.load_kg });
      liftWeeks.set(lift, byWeek);
    }
  }
  const roleCount = new Map<string, { primary: number; total: number }>();
  for (const session of sessions) {
    for (const planned of session.planned) {
      const entry = roleCount.get(baseExercise(planned.exercise_id)) ?? { primary: 0, total: 0 };
      entry.total += 1;
      if (planned.role === "primary") entry.primary += 1;
      roleCount.set(baseExercise(planned.exercise_id), entry);
    }
  }
  const anyRoles = [...roleCount.values()].some((entry) => entry.primary > 0);
  const primary = (lift: string) => { const roles = roleCount.get(lift); return Boolean(roles && roles.primary > 0 && roles.primary * 2 >= roles.total); };
  // Main (primary) lifts first, so one is never pushed out by accessories
  // trained more often; then the most-trained.
  const ranked = [...liftWeeks.entries()]
    .map(([lift, byWeek]) => ({ lift, inWindow: [...byWeek.keys()].filter((week) => week >= first) }))
    .filter((entry) => entry.inWindow.length >= 2)
    .sort((a, b) => Number(primary(b.lift)) - Number(primary(a.lift)) || b.inWindow.length - a.inWindow.length || a.lift.localeCompare(b.lift))
    .slice(0, 8);
  // Main lifts are the coach's primary lifts; findings are only raised for
  // them (an accessory kept at one weight "plateaus" by design).
  const isMain = (lift: string, rank: number) => {
    const roles = roleCount.get(lift);
    return anyRoles ? Boolean(roles && roles.primary * 2 >= roles.total && roles.primary > 0) : rank < 3;
  };
  const lifts = ranked
    .map(({ lift }, rank) => {
      const byWeek = liftWeeks.get(lift)!;
      const series = weeks.map((start) => ({ week_start: start, e1rm: byWeek.get(start)?.value ?? null, method: byWeek.get(start)?.method ?? null, from: byWeek.has(start) ? `${byWeek.get(start)!.load} kg x ${byWeek.get(start)!.reps}` : null }));
      const points = series.filter((point) => point.e1rm !== null) as Array<{ week_start: string; e1rm: number }>;
      const latest = points[points.length - 1];
      const earlier = points.filter((point) => point.week_start <= addDays(latest.week_start, -28));
      const baseline = earlier.length ? earlier[earlier.length - 1] : points[0];
      const change = baseline && baseline !== latest ? round(((latest.e1rm - baseline.e1rm) / baseline.e1rm) * 100, 1) : null;
      const peak = points.reduce((best, point) => (point.e1rm > best.e1rm ? point : best), points[0]);
      const weeksSincePeak = Math.round((Date.parse(latest.week_start) - Date.parse(peak.week_start)) / (7 * DAY_MS));
      // The last two weeks: this one and the one before.
      const recent = points.filter((point) => point.week_start >= addDays(weekStart(input.today), -7));
      const recentBest = recent.length ? Math.max(...recent.map((point) => point.e1rm)) : null;
      const offPeak = recentBest !== null ? round(((recentBest - peak.e1rm) / peak.e1rm) * 100, 1) : null;
      // A real change, not noise: the lift's own week-to-week variation
      // (typical error = SD of week-to-week % changes / sqrt 2), and the
      // smallest change worth calling a change - 1.5x that, at least 2%.
      const weekly = points.slice(1).map((point, index) => ((point.e1rm - points[index].e1rm) / points[index].e1rm) * 100);
      const noise = weekly.length >= 3 ? round(standardDeviation(weekly) / Math.SQRT2, 1) : null;
      const swc = Math.max(2, noise !== null ? round(noise * 1.5, 1) : 2);
      const fallLimit = Math.max(5, swc);
      const status = (offPeak !== null && offPeak <= -fallLimit) || (change !== null && change <= -fallLimit) ? "falling" : weeksSincePeak >= 6 && recent.length > 0 ? "plateau" : change !== null && change >= swc ? "rising" : "steady";
      const tested = [...(input.tested_maxes ?? [])].filter((entry) => entry.exercise_id === lift && finite(entry.value_kg)).sort((a, b) => a.date.localeCompare(b.date));
      const bodyweight = finite(input.bodyweight_kg) && input.bodyweight_kg > 0 ? input.bodyweight_kg : null;
      return {
        exercise_id: lift, name: input.exercise_name(lift), main: isMain(lift, rank), series, latest: latest.e1rm, change_pct: change, change_from_week: baseline?.week_start ?? null,
        peak: peak.e1rm, peak_week: peak.week_start, weeks_since_peak: weeksSincePeak, recent_off_peak_pct: offPeak, status,
        noise_pct: noise, swc_pct: swc, real_change: change !== null && Math.abs(change) >= swc,
        relative_to_bodyweight: bodyweight ? round(latest.e1rm / bodyweight, 2) : null,
        tested_max: tested.length ? { value_kg: tested[tested.length - 1].value_kg, date: tested[tested.length - 1].date } : null
      };
    });

  // --- execution vs the plan ---
  // Every loading type: reps against the reps prescribed; the weight against
  // a fixed weight, a weight range or a % of max (inside a range is on plan);
  // the athlete's rating against an RPE, Borg or CR10 target; timed and
  // distance work (done by completing it, not set by set) as done or not.
  type ExecutionTally = { sets_planned: number; sets_logged: number; reps_checked: number; reps_hit: number; load_ratio: number[]; effort_diff: number[]; intensity: number[] };
  const tally = (): ExecutionTally => ({ sets_planned: 0, sets_logged: 0, reps_checked: 0, reps_hit: 0, load_ratio: [], effort_diff: [], intensity: [] });
  const executionByWeek = new Map<string, ExecutionTally>();
  const missedByExercise = new Map<string, { missed_sets: number; sets: number }>();
  const effortTargets = new Map<string, { exercise_id: string; scale: EffortScale; target: number; target_max: number | null; ratings: number[]; dates: string[] }>();
  const intensityByExercise = new Map<string, number[]>();
  const zonesByExercise = new Map<string, number[]>();
  const heavySets: HeavySet[] = [];
  const velocitySets: VelocitySet[] = [];
  const zoneCounts = INTENSITY_ZONES.map(() => 0);
  for (const session of sessions.filter((s) => done(s) && inWindow(sessionDay(s)))) {
    const week = weekStart(sessionDay(session));
    const t = executionByWeek.get(week) ?? tally();
    const logs = session.events.filter((event) => event.type === "SET_LOG_REPORT");
    const completed = new Set(session.events.filter((event) => event.type === "COMPLETE_EXERCISE").map((event) => event.exercise_id));
    const skipped = new Set(session.events.filter((event) => event.type === "SKIP_EXERCISE").map((event) => event.exercise_id));
    for (const planned of session.planned.filter((p) => p.segment === "working")) {
      const ex = missedByExercise.get(baseExercise(planned.exercise_id)) ?? { missed_sets: 0, sets: 0 };
      ex.sets += planned.sets;
      t.sets_planned += planned.sets;
      if (planned.dose === "time" || planned.dose === "distance") {
        const did = completed.has(planned.exercise_id) && !skipped.has(planned.exercise_id);
        if (did) t.sets_logged += planned.sets;
        else ex.missed_sets += planned.sets;
        missedByExercise.set(baseExercise(planned.exercise_id), ex);
      }
      else {
        const mine = logs.filter((log) => log.exercise_id === planned.exercise_id);
        t.sets_logged += Math.min(mine.length, planned.sets_max ?? planned.sets);
        for (const log of mine) if (finite(log.velocity) && finite(log.load_kg) && log.load_kg > 0) velocitySets.push({ session_id: session.session_id, date: sessionDay(session), exercise_id: baseExercise(planned.exercise_id), load_kg: log.load_kg, velocity: log.velocity, set_index: log.set_index ?? 0 });
        if (planned.reps_target !== null) {
          for (const log of mine) {
            t.reps_checked += 1;
            if (finite(log.reps) && log.reps >= planned.reps_target) t.reps_hit += 1;
            else ex.missed_sets += 1;
          }
        }
        ex.missed_sets += Math.max(0, planned.sets - mine.length);
        missedByExercise.set(baseExercise(planned.exercise_id), ex);
        // The weight against a fixed weight, a weight range or a % of max.
        if (planned.load_kg && planned.load_kg > 0 && planned.intensity_type !== "bodyweight") {
          const top = planned.load_kg_max && planned.load_kg_max > planned.load_kg ? planned.load_kg_max : planned.load_kg;
          for (const log of mine) {
            if (!finite(log.load_kg) || log.load_kg <= 0) continue;
            t.load_ratio.push(log.load_kg < planned.load_kg ? log.load_kg / planned.load_kg : log.load_kg > top ? log.load_kg / top : 1);
          }
        }
        // Relative intensity: the weight lifted as a % of the max the programme used.
        if (planned.one_rep_max_kg && planned.one_rep_max_kg > 0) {
          for (const log of mine) {
            if (!finite(log.load_kg) || log.load_kg <= 0) continue;
            const pct = (log.load_kg / planned.one_rep_max_kg) * 100;
            t.intensity.push(pct);
            const list = intensityByExercise.get(baseExercise(planned.exercise_id)) ?? [];
            list.push(pct);
            intensityByExercise.set(baseExercise(planned.exercise_id), list);
            zoneCounts[INTENSITY_ZONES.findIndex((zone) => pct < zone.below)] += 1;
            const liftZones = zonesByExercise.get(baseExercise(planned.exercise_id)) ?? INTENSITY_ZONES.map(() => 0);
            liftZones[INTENSITY_ZONES.findIndex((zone) => pct < zone.below)] += 1;
            zonesByExercise.set(baseExercise(planned.exercise_id), liftZones);
            if (finite(log.reps)) heavySets.push({ session_id: session.session_id, date: sessionDay(session), exercise_id: baseExercise(planned.exercise_id), pct, reps: log.reps });
          }
        }
      }
      // The athlete's rating against an effort target, in the target's own scale.
      const scale = planned.intensity_type === "rpe" || planned.intensity_type === "borg" || planned.intensity_type === "cr10" ? planned.intensity_type : null;
      if (scale && finite(planned.target_effort)) {
        const rating = session.events.find((event) => event.exercise_id === planned.exercise_id && ratingOf(event)?.scale === scale);
        const raw = rating ? ratingOf(rating)!.raw : null;
        if (raw !== null) {
          const low = planned.target_effort;
          const high = finite(planned.target_effort_max) && planned.target_effort_max > low ? planned.target_effort_max : low;
          const diff = raw < low ? raw - low : raw > high ? raw - high : 0;
          t.effort_diff.push(scale === "borg" ? (diff * 10) / 14 : diff);
          const key = `${baseExercise(planned.exercise_id)}|${scale}|${low}|${high}`;
          const entry = effortTargets.get(key) ?? { exercise_id: baseExercise(planned.exercise_id), scale, target: low, target_max: high > low ? high : null, ratings: [], dates: [] };
          entry.ratings.push(raw);
          entry.dates.push(sessionDay(session));
          effortTargets.set(key, entry);
        }
      }
    }
    executionByWeek.set(week, t);
  }
  const executionRows = weeks.map((start) => {
    const t = executionByWeek.get(start);
    return {
      week_start: start,
      partial_week: start === currentWeek,
      sets_logged_pct: t && t.sets_planned ? round((t.sets_logged / t.sets_planned) * 100, 0) : null,
      reps_hit_pct: t && t.reps_checked ? round((t.reps_hit / t.reps_checked) * 100, 0) : null,
      load_vs_plan_pct: t && t.load_ratio.length ? round((mean(t.load_ratio) - 1) * 100, 1) : null,
      effort_vs_plan: t && t.effort_diff.length ? round(mean(t.effort_diff), 1) : null,
      intensity_pct: t && t.intensity.length ? round(mean(t.intensity), 0) : null
    };
  });
  const mostMissed = [...missedByExercise.entries()]
    .filter(([, value]) => value.missed_sets > 0)
    .map(([exerciseId, value]) => ({ exercise_id: exerciseId, name: input.exercise_name(exerciseId), missed_sets: value.missed_sets, planned_sets: value.sets, missed_pct: round((value.missed_sets / value.sets) * 100, 0) }))
    .sort((a, b) => b.missed_pct - a.missed_pct || b.missed_sets - a.missed_sets)
    .slice(0, 5);
  const effortTargetRows = [...effortTargets.values()].map((entry) => {
    const average = round(mean(entry.ratings), 1);
    const high = entry.target_max ?? entry.target;
    const diff = average < entry.target ? round(average - entry.target, 1) : average > high ? round(average - high, 1) : 0;
    return { exercise_id: entry.exercise_id, name: input.exercise_name(entry.exercise_id), scale: entry.scale, target: entry.target, target_max: entry.target_max, rated_average: average, ratings: entry.ratings.length, diff, diff_10: entry.scale === "borg" ? round((diff * 10) / 14, 1) : diff };
  }).sort((a, b) => Math.abs(b.diff_10) - Math.abs(a.diff_10) || b.ratings - a.ratings);
  const zoneTotal = zoneCounts.reduce((sum, count) => sum + count, 0);
  const intensity = {
    sets: zoneTotal,
    zones: INTENSITY_ZONES.map((zone, index) => ({ zone: zone.label, sets: zoneCounts[index], pct: zoneTotal ? round((zoneCounts[index] / zoneTotal) * 100, 0) : null })),
    by_exercise: [...intensityByExercise.entries()].map(([exerciseId, list]) => ({
      exercise_id: exerciseId, name: input.exercise_name(exerciseId), sets: list.length, average_pct: round(mean(list), 0), top_pct: round(Math.max(...list), 0),
      zones: INTENSITY_ZONES.map((zone, index) => ({ zone: zone.label, sets: zonesByExercise.get(exerciseId)?.[index] ?? 0 }))
    })).sort((a, b) => b.sets - a.sets),
    prilepin: prilepinCheck(heavySets, input.exercise_name).slice(0, 12)
  };
  const velocity = velocitySummary(velocitySets, input.exercise_name, addDays(first, Math.round((Date.parse(`${input.today}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / DAY_MS / 2)));

  // Effort creep: the same exercise at about the same top weight (within
  // 2.5%), rated in the first half of the window and again in the second, in
  // the same scale (RPE, Borg or CR10).
  const rated = new Map<string, Array<{ date: string; load: number; raw: number; value10: number }>>();
  for (const session of sessions.filter((s) => done(s) && inWindow(sessionDay(s)))) {
    for (const event of session.events) {
      const rating = event.exercise_id ? ratingOf(event) : null;
      if (!rating) continue;
      const lift = baseExercise(event.exercise_id!);
      const loads = setLogs(session).filter((log) => log.exercise_id && baseExercise(log.exercise_id) === lift && finite(log.load_kg) && log.load_kg > 0).map((log) => log.load_kg as number);
      if (!loads.length) continue;
      const key = `${lift}|${rating.scale}`;
      const list = rated.get(key) ?? [];
      list.push({ date: sessionDay(session), load: Math.max(...loads), raw: rating.raw, value10: rating.value10 });
      rated.set(key, list);
    }
  }
  const midpoint = addDays(first, Math.round((input.weeks * 7) / 2));
  const effortCreep = [...rated.entries()].flatMap(([key, list]) => {
    const [lift, scale] = key.split("|") as [string, EffortScale];
    const early = list.filter((entry) => entry.date < midpoint);
    const late = list.filter((entry) => entry.date >= midpoint);
    let best: Json | null = null;
    for (const e of early) {
      const matches = late.filter((l) => Math.abs(l.load - e.load) / e.load <= 0.025);
      if (!matches.length) continue;
      const lateRaw = round(mean(matches.map((m) => m.raw)), 1);
      const delta10 = round(mean(matches.map((m) => m.value10)) - e.value10, 1);
      if (!best || Math.abs(delta10) > Math.abs(Number(best.effort_change))) {
        best = { exercise_id: lift, name: input.exercise_name(lift), scale, scale_label: SCALE_LABEL[scale], load_kg: e.load, early: e.raw, late: lateRaw, effort_change: delta10, early_date: e.date, late_date: matches[matches.length - 1].date };
      }
    }
    return best ? [best] : [];
  }).sort((a, b) => Math.abs(Number(b.effort_change)) - Math.abs(Number(a.effort_change)));

  // --- adherence ---
  const expected = input.planned_days_per_week && input.planned_days_per_week > 0 ? input.planned_days_per_week : null;
  const staleCutoff = addDays(input.today, -2);
  // Adherence counts from the week they started: no "missed sessions" for
  // weeks before their first one (a new athlete, or a new coach).
  // (from their whole history, so a report from a set date still expects
  // sessions in its first days)
  const firstSession = allSessions.length ? sessionDay(allSessions[0]) : null;
  const startedWeek = firstSession ? weekStart(firstSession) : null;
  const adherenceRows = weeks.map((start) => {
    const mine = sessions.filter((session) => weekStart(sessionDay(session)) === start);
    const completed = mine.filter((session) => session.status === "completed").length;
    const partial = mine.filter((session) => session.status === "partial").length;
    const abandoned = mine.filter((session) => !done(session) && sessionDay(session) < staleCutoff).length;
    const isCurrent = start === currentWeek;
    const started = startedWeek !== null && start >= startedWeek;
    // A week only partly inside a set date range expects its share of sessions.
    const daysIn = Array.from({ length: 7 }, (_, offset) => addDays(start, offset)).filter(inRange).length;
    const target = started && expected ? (daysIn === 7 ? expected : Math.round((expected * daysIn) / 7)) : null;
    const pct = target && !isCurrent ? Math.min(100, round(((completed + partial * 0.5) / target) * 100, 0)) : null;
    return { week_start: start, completed, partial, abandoned, planned: target, adherence_pct: pct };
  });
  const weekdayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const byWeekday = weekdayNames.map((name, index) => ({ day: name, sessions: sessions.filter((session) => done(session) && inWindow(sessionDay(session)) && (new Date(`${sessionDay(session)}T00:00:00Z`).getUTCDay() + 6) % 7 === index).length }));
  const skipCounts = new Map<string, { count: number; reasons: Map<string, number> }>();
  for (const session of sessions.filter((s) => inWindow(sessionDay(s)))) {
    for (const skip of session.events.filter((event) => event.type === "SKIP_EXERCISE" && event.exercise_id)) {
      const lift = baseExercise(skip.exercise_id!);
      const entry = skipCounts.get(lift) ?? { count: 0, reasons: new Map() };
      entry.count += 1;
      const reason = skip.reason_code || "unspecified";
      entry.reasons.set(reason, (entry.reasons.get(reason) ?? 0) + 1);
      skipCounts.set(lift, entry);
    }
  }
  const mostSkipped = [...skipCounts.entries()]
    .map(([exerciseId, value]) => ({ exercise_id: exerciseId, name: input.exercise_name(exerciseId), skips: value.count, reasons: Object.fromEntries(value.reasons) }))
    .sort((a, b) => b.skips - a.skips).slice(0, 5);

  // --- readiness against their own normal ---
  const readiness = [...input.readiness].sort((a, b) => a.date.localeCompare(b.date));
  const readinessDays = readiness.map((check, index) => {
    const total = check.sleep + check.soreness + check.stress;
    const prior = readiness.slice(0, index).filter((other) => other.date >= addDays(check.date, -28)).map((other) => other.sleep + other.soreness + other.stress);
    const sd = standardDeviation(prior);
    const z = prior.length >= 5 && sd > 0 ? round((total - mean(prior)) / sd, 2) : null;
    // Resting HR and HRV against the athlete's own previous 28 days: HRV on a
    // log scale (it's skewed), resting HR in beats above their normal.
    const priorHrv = readiness.slice(0, index).filter((other) => other.date >= addDays(check.date, -28) && finite(other.hrv_ms) && other.hrv_ms > 0).map((other) => Math.log(other.hrv_ms as number));
    const hrvSd = standardDeviation(priorHrv);
    const hrvZ = finite(check.hrv_ms) && check.hrv_ms > 0 && priorHrv.length >= 5 && hrvSd > 0 ? round((Math.log(check.hrv_ms) - mean(priorHrv)) / hrvSd, 2) : null;
    const priorRhr = readiness.slice(0, index).filter((other) => other.date >= addDays(check.date, -28) && finite(other.resting_hr)).map((other) => other.resting_hr as number);
    const rhrDelta = finite(check.resting_hr) && priorRhr.length >= 5 ? round(check.resting_hr - mean(priorRhr), 1) : null;
    return { ...check, total, z, hrv_z: hrvZ, resting_hr_delta: rhrDelta };
  });
  const readinessRows = weeks.map((start) => {
    const mine = readinessDays.filter((entry) => weekStart(entry.date) === start && inRange(entry.date));
    const zs = mine.map((entry) => entry.z).filter(finite);
    return {
      week_start: start,
      check_ins: mine.length,
      sleep: mine.length ? round(mean(mine.map((m) => m.sleep)), 1) : null,
      soreness: mine.length ? round(mean(mine.map((m) => m.soreness)), 1) : null,
      stress: mine.length ? round(mean(mine.map((m) => m.stress)), 1) : null,
      total: mine.length ? round(mean(mine.map((m) => m.total)), 1) : null,
      z: zs.length ? round(mean(zs), 2) : null,
      fatigue: averageOf(mine.map((m) => m.fatigue)),
      mood: averageOf(mine.map((m) => m.mood)),
      resting_hr: averageOf(mine.map((m) => m.resting_hr)),
      hrv_ms: averageOf(mine.map((m) => m.hrv_ms), 0),
      hrv_z: averageOf(mine.map((m) => m.hrv_z), 2),
      resting_hr_delta: averageOf(mine.map((m) => m.resting_hr_delta))
    };
  });
  const checkinRows = weeks.map((start) => {
    const entry = input.checkins.find((checkin) => weekStart(checkin.week_start) === start);
    return { week_start: start, energy: entry?.energy ?? null, motivation: entry?.motivation ?? null, sleep: entry?.sleep ?? null };
  });

  // --- pain ---
  const painEvents = sessions.filter((s) => inWindow(sessionDay(s))).flatMap((session) => session.events.filter((event) => event.type === "PAIN_REPORT").map((event) => ({ week: weekStart(sessionDay(session)), area: event.pain_area || "unspecified", exercise_id: event.exercise_id ? baseExercise(event.exercise_id) : "" })));
  const painRows = weeks.map((start) => {
    const mine = painEvents.filter((event) => event.week === start);
    const areas: Record<string, number> = {};
    for (const event of mine) areas[event.area] = (areas[event.area] ?? 0) + 1;
    const load = loadRows.find((row) => row.week_start === start);
    return { week_start: start, reports: mine.length, areas, acute_chronic: load?.acute_chronic ?? null };
  });
  const painAreas = [...new Set(painEvents.map((event) => event.area))].map((area) => {
    const mine = painEvents.filter((event) => event.area === area);
    const exercises = [...new Set(mine.map((event) => event.exercise_id))].filter(Boolean);
    const firstWeek = [...mine.map((event) => event.week)].sort()[0];
    const firstLoad = loadRows.find((row) => row.week_start === firstWeek)?.acute_chronic ?? null;
    return { area, reports: mine.length, weeks: new Set(mine.map((event) => event.week)).size, exercises: exercises.map((id) => input.exercise_name(id)), first_week: firstWeek, first_week_acute_chronic: firstLoad };
  }).sort((a, b) => b.weeks - a.weeks || b.reports - a.reports);
  const painOnSpikes = painRows.filter((row) => row.reports > 0 && (row.acute_chronic ?? 0) > 1.3).length;

  // --- per exercise, effort ratings, movement patterns, bodyweight, time and distance ---
  const counted = sessions.filter((s) => done(s) && inWindow(sessionDay(s)));
  type ExerciseTally = { sessions: Set<string>; sets: number; reps: number; tonnage: number; top: { load: number; reps: number } | null; bodyweight_sets: number; best_unloaded_reps: number; ratings: Array<{ raw: number; value10: number; scale: EffortScale }>; minutes: number; distance_m: number; time_sets: number; distance_sets: number };
  const perExercise = new Map<string, ExerciseTally>();
  const tallyFor = (lift: string) => perExercise.get(lift) ?? { sessions: new Set<string>(), sets: 0, reps: 0, tonnage: 0, top: null, bodyweight_sets: 0, best_unloaded_reps: 0, ratings: [], minutes: 0, distance_m: 0, time_sets: 0, distance_sets: 0 };
  for (const session of counted) {
    for (const log of setLogs(session)) {
      if (!log.exercise_id) continue;
      const lift = baseExercise(log.exercise_id);
      const entry = tallyFor(lift);
      entry.sessions.add(session.session_id);
      entry.sets += 1;
      if (finite(log.reps)) entry.reps += log.reps;
      if (finite(log.load_kg) && log.load_kg > 0 && finite(log.reps)) {
        entry.tonnage += log.load_kg * log.reps;
        if (!entry.top || log.load_kg > entry.top.load || (log.load_kg === entry.top.load && log.reps > entry.top.reps)) entry.top = { load: log.load_kg, reps: log.reps };
      }
      else {
        // Bodyweight (no weight added): reps are the measure.
        entry.bodyweight_sets += 1;
        if (finite(log.reps) && log.reps > entry.best_unloaded_reps) entry.best_unloaded_reps = log.reps;
      }
      perExercise.set(lift, entry);
    }
    // Timed and distance work is done by completing it: the prescription is what was done.
    const completed = new Set(session.events.filter((event) => event.type === "COMPLETE_EXERCISE").map((event) => event.exercise_id));
    const skipped = new Set(session.events.filter((event) => event.type === "SKIP_EXERCISE").map((event) => event.exercise_id));
    for (const planned of session.planned.filter((p) => p.dose === "time" || p.dose === "distance")) {
      if (!completed.has(planned.exercise_id) || skipped.has(planned.exercise_id)) continue;
      const lift = baseExercise(planned.exercise_id);
      const entry = tallyFor(lift);
      entry.sessions.add(session.session_id);
      if (planned.dose === "time" && finite(planned.duration_s)) { entry.minutes += (planned.sets * planned.duration_s) / 60; entry.time_sets += planned.sets; }
      if (planned.dose === "distance" && finite(planned.distance_m)) { entry.distance_m += planned.sets * planned.distance_m; entry.distance_sets += planned.sets; }
      perExercise.set(lift, entry);
    }
    for (const event of session.events) {
      const rating = event.exercise_id ? ratingOf(event) : null;
      if (!rating) continue;
      const entry = perExercise.get(baseExercise(event.exercise_id!));
      if (entry) entry.ratings.push(rating);
    }
  }
  // An average in the athlete's own scale when they used one; 0-10 when mixed.
  const averageEffort = (ratings: ExerciseTally["ratings"]) => {
    if (!ratings.length) return { average_effort: null, effort_scale: null };
    const scales = new Set(ratings.map((rating) => rating.scale));
    if (scales.size === 1) return { average_effort: round(mean(ratings.map((rating) => rating.raw)), 1), effort_scale: [...scales][0] };
    return { average_effort: round(mean(ratings.map((rating) => rating.value10)), 1), effort_scale: "mixed_0_10" };
  };
  const exerciseRows = [...perExercise.entries()].map(([exerciseId, entry]) => ({
    exercise_id: exerciseId,
    name: input.exercise_name(exerciseId),
    pattern: input.pattern_of?.(exerciseId) ?? null,
    sessions: entry.sessions.size,
    sets: entry.sets + entry.time_sets + entry.distance_sets,
    reps: entry.reps,
    tonnage_kg: round(entry.tonnage, 0),
    top_set: entry.top ? { load_kg: entry.top.load, reps: entry.top.reps } : null,
    bodyweight_sets: entry.bodyweight_sets,
    best_bodyweight_reps: entry.bodyweight_sets ? entry.best_unloaded_reps : null,
    minutes: entry.minutes ? round(entry.minutes, 1) : null,
    distance_m: entry.distance_m ? round(entry.distance_m, 0) : null,
    ...averageEffort(entry.ratings),
    intensity_pct: (intensity.by_exercise.find((row) => row.exercise_id === exerciseId)?.average_pct) ?? null
  })).sort((a, b) => b.sets - a.sets || a.name.localeCompare(b.name));
  // How hard the athlete rated each exercise (their hardest set), on a 0-10
  // scale (RPE and CR10 as they are, Borg rescaled), by band.
  const bands = [{ band: "6 or less", test: (r: number) => r <= 6 }, { band: "7", test: (r: number) => r > 6 && r <= 7.5 }, { band: "8", test: (r: number) => r > 7.5 && r <= 8.5 }, { band: "9", test: (r: number) => r > 8.5 && r <= 9.5 }, { band: "10", test: (r: number) => r > 9.5 }];
  const allRatings = counted.flatMap((session) => session.events.map((event) => (event.exercise_id ? ratingOf(event) : null)).filter((rating): rating is NonNullable<typeof rating> => rating !== null));
  const allEffort = allRatings.map((rating) => rating.value10);
  const effortBands = bands.map(({ band, test }) => ({ band, ratings: allEffort.filter(test).length, pct: allEffort.length ? round((allEffort.filter(test).length / allEffort.length) * 100, 0) : null }));
  const ratedBy = { rpe: allRatings.filter((r) => r.scale === "rpe").length, cr10: allRatings.filter((r) => r.scale === "cr10").length, borg: allRatings.filter((r) => r.scale === "borg").length };
  const patternSets = new Map<string, number>();
  for (const row of exerciseRows) patternSets.set(row.pattern ?? "other", (patternSets.get(row.pattern ?? "other") ?? 0) + row.sets);
  const patternRows = [...patternSets.entries()].map(([pattern, sets]) => ({ pattern, sets })).sort((a, b) => b.sets - a.sets);

  // Bodyweight strength: the best unweighted set each week, for exercises
  // trained mostly without added weight (pull-ups, dips, push-ups...).
  const repWeeks = new Map<string, Map<string, number>>();
  for (const session of counted) {
    for (const log of setLogs(session)) {
      if (!log.exercise_id || (finite(log.load_kg) && log.load_kg > 0) || !finite(log.reps)) continue;
      const lift = baseExercise(log.exercise_id);
      const byWeek = repWeeks.get(lift) ?? new Map<string, number>();
      const week = weekStart(sessionDay(session));
      byWeek.set(week, Math.max(byWeek.get(week) ?? 0, log.reps));
      repWeeks.set(lift, byWeek);
    }
  }
  const bodyweightLifts = [...repWeeks.entries()]
    .filter(([lift, byWeek]) => byWeek.size >= 2 && (perExercise.get(lift)?.bodyweight_sets ?? 0) * 2 >= (perExercise.get(lift)?.sets ?? 0))
    .map(([lift, byWeek]) => {
      const series = weeks.map((start) => ({ week_start: start, best_reps: byWeek.get(start) ?? null }));
      const points = series.filter((point) => point.best_reps !== null) as Array<{ week_start: string; best_reps: number }>;
      return { exercise_id: lift, name: input.exercise_name(lift), series, first: points[0].best_reps, latest: points[points.length - 1].best_reps, best: Math.max(...points.map((point) => point.best_reps)), change: points[points.length - 1].best_reps - points[0].best_reps };
    })
    .sort((a, b) => b.best - a.best);

  // --- planned vs done, week by week ---
  // From the sessions the plan put in front of them that week: sessions,
  // working sets and (where the plan gave a weight) tonnage planned, against
  // what they did.
  const planRows = weeks.map((start) => {
    const mine = sessions.filter((session) => weekStart(sessionDay(session)) === start);
    let plannedSets = 0; let doneSets = 0; let plannedTonnage = 0; let doneTonnage = 0;
    for (const session of mine) {
      const finished = done(session);
      const logs = session.events.filter((event) => event.type === "SET_LOG_REPORT");
      const completedIds = new Set(session.events.filter((event) => event.type === "COMPLETE_EXERCISE").map((event) => event.exercise_id));
      const skippedIds = new Set(session.events.filter((event) => event.type === "SKIP_EXERCISE").map((event) => event.exercise_id));
      for (const planned of session.planned.filter((p) => p.segment === "working")) {
        plannedSets += planned.sets;
        const weighted = planned.load_kg && planned.load_kg > 0 && planned.reps_target !== null && planned.dose !== "time" && planned.dose !== "distance";
        if (weighted) plannedTonnage += planned.sets * (planned.reps_target as number) * (planned.load_kg as number);
        if (!finished) continue;
        if (planned.dose === "time" || planned.dose === "distance") {
          if (completedIds.has(planned.exercise_id) && !skippedIds.has(planned.exercise_id)) doneSets += planned.sets;
          continue;
        }
        const mineLogs = logs.filter((log) => log.exercise_id === planned.exercise_id);
        doneSets += Math.min(mineLogs.length, planned.sets_max ?? planned.sets);
        if (weighted) doneTonnage += mineLogs.reduce((sum, log) => sum + (finite(log.load_kg) && finite(log.reps) ? log.load_kg * log.reps : 0), 0);
      }
    }
    return {
      week_start: start, partial_week: start === currentWeek,
      planned_sessions: mine.length, done_sessions: mine.filter(done).length,
      planned_sets: plannedSets, done_sets: doneSets,
      planned_tonnage_kg: round(plannedTonnage, 0), done_tonnage_kg: round(doneTonnage, 0),
      tonnage_pct: plannedTonnage > 0 ? round((doneTonnage / plannedTonnage) * 100, 0) : null
    };
  });

  // --- tests the coach recorded ---
  const testResults = [...(input.tests ?? [])].filter((result) => finite(result.value) && result.date <= input.today).sort((a, b) => a.date.localeCompare(b.date));
  const testRows = [...new Set(testResults.map((result) => result.test_id))].map((testId) => {
    const definition = PERFORMANCE_TESTS[testId];
    const all = testResults.filter((result) => result.test_id === testId);
    const latest = all[all.length - 1];
    const previous = all.length > 1 ? all[all.length - 2] : null;
    const better = definition?.better ?? "higher";
    const best = all.reduce((top, result) => (better === "higher" ? (result.value > top.value ? result : top) : (result.value < top.value ? result : top)), all[0]);
    const change = previous ? round(latest.value - previous.value, definition?.decimals ?? 1) : null;
    const swc = definition?.swc ?? null;
    const improved = change !== null && (better === "higher" ? change > 0 : change < 0);
    return {
      test_id: testId, name: definition?.name ?? testId.replaceAll("_", " "), unit: definition?.unit ?? "", better, category: definition?.category ?? "other",
      results: all.map((result) => ({ id: result.id, date: result.date, value: result.value })),
      latest: { date: latest.date, value: latest.value },
      previous: previous ? { date: previous.date, value: previous.value } : null,
      best: { date: best.date, value: best.value },
      change, swc,
      verdict: change === null ? "first" : swc !== null && Math.abs(change) < swc ? "within_noise" : improved ? "improved" : "declined"
    };
  }).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  // --- running load from GPS / heart-rate imports ---
  // Distance, high-speed running and sprint distance each week, and HSR
  // against their own previous 4 weeks (the same uncoupled ratio as load).
  const external = [...(input.external_load ?? [])].filter((entry) => inRange(entry.date)).sort((a, b) => a.date.localeCompare(b.date));
  const externalWeekly = (start: string, key: keyof ExternalLoad) => {
    const mine = external.filter((entry) => weekStart(entry.date) === start && finite(entry[key]));
    return mine.length ? round(mine.reduce((sum, entry) => sum + Number(entry[key]), 0), 0) : null;
  };
  const hsrAll = loadWeeks.map((start) => (external.some((entry) => weekStart(entry.date) <= start) ? externalWeekly(start, "hsr_m") ?? 0 : null));
  const distanceAll = loadWeeks.map((start) => (external.some((entry) => weekStart(entry.date) <= start) ? externalWeekly(start, "total_distance_m") ?? 0 : null));
  const externalRows = weeks.map((start) => {
    const index = loadWeeks.indexOf(start);
    const mine = external.filter((entry) => weekStart(entry.date) === start);
    return {
      week_start: start, partial_week: start === currentWeek, sessions: mine.length,
      total_distance_m: externalWeekly(start, "total_distance_m"), hsr_m: externalWeekly(start, "hsr_m"), sprint_m: externalWeekly(start, "sprint_m"),
      player_load: externalWeekly(start, "player_load"),
      avg_hr: averageOf(mine.map((entry) => entry.avg_hr), 0), max_hr: mine.length ? Math.max(...mine.map((entry) => Number(entry.max_hr ?? 0))) || null : null,
      hsr_ratio: acuteChronic(hsrAll, index), distance_ratio: acuteChronic(distanceAll, index)
    };
  });

  // --- their usual, from the 4 weeks before the period ---
  const priorLoads = weeklyLoadAll.slice(0, 4).filter((value): value is number => value !== null && value > 0);
  const priorReadiness = readinessDays.filter((entry) => entry.date < first && entry.date >= addDays(first, -28)).map((entry) => entry.total);
  const priorSd = standardDeviation(priorReadiness);
  const baseline = {
    weekly_load: priorLoads.length >= 2 ? round(mean(priorLoads), 0) : null,
    readiness: priorReadiness.length >= 5
      ? { average: round(mean(priorReadiness), 1), low: round(mean(priorReadiness) - (Number.isFinite(priorSd) ? priorSd : 0), 0), high: round(mean(priorReadiness) + (Number.isFinite(priorSd) ? priorSd : 0), 0), check_ins: priorReadiness.length }
      : null
  };

  return {
    weeks,
    baseline,
    ...(input.from || input.to ? { range: { from: input.from ?? null, to: input.to ?? null } } : {}),
    ...(input.closed ? { closed: true } : {}),
    load: { rows: loadRows, sessions: sessionRows.filter((row) => inWindow(String(row.date))), quality: loadQuality },
    markers: markerRows,
    volume: { rows: volumeRows },
    strength: { lifts, bodyweight: bodyweightLifts },
    execution: { rows: executionRows, most_missed: mostMissed, effort_creep: effortCreep.slice(0, 5), effort_targets: effortTargetRows, intensity },
    adherence: { rows: adherenceRows, planned_days_per_week: expected, by_weekday: byWeekday, most_skipped: mostSkipped },
    readiness: { rows: readinessRows, days: readinessDays.filter((entry) => inWindow(entry.date) && inRange(entry.date)), checkins: checkinRows },
    pain: { rows: painRows, areas: painAreas, weeks_with_pain_on_load_spike: painOnSpikes },
    velocity: { lifts: velocity },
    attempts: attemptPlan(String(input.activity_id ?? ""), lifts.map((lift) => ({ exercise_id: String(lift.exercise_id), name: String(lift.name), latest: Number(lift.latest), tested_max: lift.tested_max })), input.competition_date ?? null, input.today),
    plan: { rows: planRows, ahead: (() => {
      // What they've actually done lately: the mean of their last 4 complete weeks.
      const recent = planRows.filter((row) => !row.partial_week).slice(-4);
      const avg = (pick: (row: (typeof planRows)[number]) => number) => (recent.length ? round(recent.reduce((sum, row) => sum + pick(row), 0) / recent.length, 0) : null);
      return { recent: { sets: avg((row) => row.done_sets), tonnage_kg: avg((row) => row.done_tonnage_kg) }, rows: forwardRows(input.planned_ahead ?? [], { sets: avg((row) => row.done_sets), tonnage_kg: avg((row) => row.done_tonnage_kg) }) };
    })() },
    external: { rows: externalRows, sessions: external.filter((entry) => inWindow(entry.date)) },
    injuries: { ...analyseInjuries(input.injuries ?? [], input.today, first, painAreas.map((area) => String(area.area))), as_of: input.today },
    testing: { tests: testRows },
    bodyweight_kg: finite(input.bodyweight_kg) ? input.bodyweight_kg : null,
    exercises: { rows: exerciseRows, effort_bands: effortBands, rated: allEffort.length, rated_by: ratedBy, patterns: patternRows }
  };
}

// ---------- findings: plain-English headlines and flags ----------
// text: what happened; action: a suggested next step (the coach decides).
export type Finding = Readonly<{ id: string; section: string; level: "alert" | "watch" | "good" | "info"; text: string; action?: string; exercise_id?: string }>;

// The suggested next step for each kind of finding.
function actionFor(finding: Finding): string | undefined {
  const { id, level } = finding;
  if (id === "adherence") return level === "alert"
    ? "Ask what's getting in the way - time, energy or the plan itself - before adding anything. Fewer or shorter sessions they will do beat a plan they won't."
    : level === "watch" ? "Check in on their week, and consider moving or shortening the session they miss most." : "Keep the plan as it is.";
  if (id === "load") return level === "alert" ? "Hold or reduce load next week instead of adding more, and let this jump settle before the next step up."
    : finding.text.includes("dropped") ? "If this was a planned deload or taper, nothing to do. If not, ask what happened - illness, travel, work or motivation."
    : level === "watch" ? "Don't add more this week; check soreness and sleep." : "Load is building steadily - keep progressing at this pace.";
  if (id === "load_spike") return "Watch for soreness or niggles from that week, and build up in smaller steps next time.";
  if (id.startsWith("velocity_")) return finding.level === "good" ? "Faster at the same weight usually means stronger - an estimated max may be behind; consider retesting." : "Slower at the same weight is an early sign of fatigue - check sleep and recent load, and consider a lighter few days before the next heavy session.";
  if (id === "prilepin_high") return "Prilepin's table is a guide built on weightlifters, not a rule - but if heavy sessions keep running long, watch bar speed and recovery between them.";
  const injury = injuryActionFor(id) ?? forwardActionFor(id);
  if (injury) return injury;
  if (id === "load_story") return "If the drop was planned recovery after the big week, that's fine. If not, ask what happened - and build back up gradually rather than with another jump.";
  if (id === "hrv_low" || id === "rhr_high") return "A sign the body is under strain - illness, poor sleep or accumulated fatigue. Ask how they are, and consider a lighter session until it settles.";
  if (id === "hsr_spike") return "Big jumps in high-speed running are the ones most linked to hamstring and calf niggles - build exposure up in smaller steps.";
  if (id === "load_estimated") return "Ask the athlete to rate each session (how hard, how long) when they finish, and to log practice and matches - the load figures then reflect their real week.";
  if (id === "monotony") return "Make the easy days easier: alternate hard and light sessions through the week.";
  if (id === "readiness") return "Ask how they're sleeping and coping. Consider a lighter session, or moving the hardest session later in the week.";
  if (id.startsWith("checkin_")) return "Have a conversation - a drop in energy, sleep or motivation often comes before missed sessions.";
  if (id.startsWith("strength_fatigue_")) return "Signs of fatigue: plan a lighter week before pushing this lift again.";
  if (id.startsWith("strength_")) return level === "alert" ? "Look at fatigue, sleep and pain first - a lighter week often brings it back. If it keeps falling, change the stimulus."
    : level === "watch" ? "Change something: the rep range, an exercise variation, the volume or how often it's trained." : "Tell them - and keep the current plan going.";
  if (id === "execution") return "The weights are probably too heavy: drop the load a little or widen the rep range.";
  if (id === "creep") return "Fatigue is building on this lift - consider a lighter week soon.";
  if (id.startsWith("effort_target_")) return level === "info" ? "Add weight next time - they have more in the tank." : "Lighten it to match the effort you meant, or check they understand the rating scale.";
  if (id.startsWith("test_")) return level === "good" ? "The training is working for this quality - tell them, and keep it in the plan." : "Check fatigue and the test conditions (warm-up, surface, time of day) first; if it holds on a retest, look at what the training gives this quality.";
  if (id === "plan_under") return "Find out what's being cut - whole sessions, the last exercises, or lighter weights - and adjust the plan to what they can do.";
  if (id === "plan_over") return "They're adding extra on top of the plan - check it's intended, as it adds fatigue you didn't plan for.";
  if (id.startsWith("bodyweight_")) return "Progress it: more reps, a harder variation or a little added weight.";
  if (id.startsWith("pain_")) return "Check technique and load on the exercises involved and swap them if needed. If it continues, refer them to a medical professional.";
  return undefined;
}

const SECTION_ORDER: Record<string, number> = { injuries: -1, pain: 0, strength: 1, readiness: 2, load: 3, gps: 3.5, adherence: 4, execution: 5, testing: 6 };

// One story instead of two lines that look like they disagree.
function mergeRelated(list: Finding[]): Finding[] {
  let out = [...list];
  const load = out.find((f) => f.id === "load");
  const spike = out.find((f) => f.id === "load_spike");
  if (load && spike && load.text.includes("dropped")) {
    const drop = load.text.replace(/^Training load dropped /u, "dropped ").replace(/\.$/u, "");
    out = out.filter((f) => f !== load && f !== spike);
    out.push({ id: "load_story", section: "load", level: "watch", text: `${spike.text.replace(/\.$/u, "")}, then ${drop}.` });
  }
  // A lift that's down or stuck and also feels harder: one fatigue finding.
  for (const strength of out.filter((f) => f.id.startsWith("strength_") && f.level !== "good" && f.exercise_id)) {
    const effort = out.find((f) => (f.id === "creep" || f.id.startsWith("effort_target_")) && f.level !== "info" && f.exercise_id === strength.exercise_id);
    if (!effort) continue;
    const detail = effort.text.replace(/^[^:]+: /u, "").replace(/\.$/u, "");
    out = out.filter((f) => f !== strength && f !== effort);
    out.push({ id: `strength_fatigue_${strength.exercise_id}`, section: "strength", level: strength.level, exercise_id: strength.exercise_id, text: `${strength.text.replace(/\.$/u, "")}, and it feels harder (${detail}).` });
  }
  return out;
}

const lastValue = <T,>(rows: readonly T[], pick: (row: T) => number | null | undefined) => {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const value = pick(rows[index]);
    if (value !== null && value !== undefined && Number.isFinite(value)) return { value, index };
  }
  return null;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "this week", "last week" or "the week of 28 Sep".
export function weekLabel(week: string, currentWeek: string): string {
  if (currentWeek && week === currentWeek) return "this week";
  if (currentWeek && week === addDays(currentWeek, -7)) return "last week";
  const d = new Date(`${week}T00:00:00Z`);
  return `the week of ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function findings(analysis: Json): Finding[] {
  const out: Finding[] = [];
  const a = analysis as Record<string, Json>;
  const weeksShown = a.weeks as unknown as string[];
  // An ended period names its weeks by date, not "this week".
  const currentWeek = a.closed ? "" : weeksShown[weeksShown.length - 1];

  // Adherence: the last 2 complete weeks.
  const adherenceRows = (a.adherence.rows as Json[]).filter((row) => row.adherence_pct !== null);
  const lastTwo = adherenceRows.slice(-2);
  if (lastTwo.length) {
    // A one-week report has one week to count; an ended period's are its last.
    const span = lastTwo.length === 1 ? (a.closed ? "that week" : "last week") : a.closed ? "in its last 2 weeks" : "in the last 2 weeks";
    const done = lastTwo.reduce((sum, row) => sum + Number(row.completed) + Number(row.partial) * 0.5, 0);
    const planned = lastTwo.reduce((sum, row) => sum + Number(row.planned ?? 0), 0);
    // Extra sessions don't make it over 100%.
    const pct = planned ? Math.min(100, Math.round((done / planned) * 100)) : null;
    if (pct !== null) {
      const missed = Math.max(0, Math.round(planned - done));
      out.push(pct < 70
        ? { id: "adherence", section: "adherence", level: "alert", text: `Missed ${missed} of ${planned} planned sessions ${span} (${pct}% done).` }
        : pct < 90
          ? { id: "adherence", section: "adherence", level: "watch", text: `${pct}% of planned sessions done ${span}.` }
          : { id: "adherence", section: "adherence", level: "good", text: `Training as planned: ${pct}% of sessions done ${span}.` });
    }
  }

  // Load: this week's acute:chronic ratio.
  // Load and execution read the latest complete week: the current one is
  // only partly trained.
  const complete = (rows: Json[]) => rows.filter((row) => row.partial_week !== true);
  const acwr = lastValue(complete(a.load.rows as Json[]), (row) => row.acute_chronic as number | null);
  if (acwr) {
    const pct = Math.round((acwr.value - 1) * 100);
    if (acwr.value > 1.5) out.push({ id: "load", section: "load", level: "alert", text: `Training load jumped ${pct}% above their 4-week normal (ratio ${acwr.value}).` });
    else if (acwr.value > 1.3) out.push({ id: "load", section: "load", level: "watch", text: `Training load is ${pct}% above their 4-week normal (ratio ${acwr.value}).` });
    else if (acwr.value < 0.8) out.push({ id: "load", section: "load", level: "watch", text: `Training load dropped ${Math.abs(pct)}% below their 4-week normal (ratio ${acwr.value}).` });
    else out.push({ id: "load", section: "load", level: "good", text: `Training load is in line with their 4-week normal (ratio ${acwr.value}).` });
  }
  // A spike in the last 3 complete weeks, if the latest week isn't it.
  const recentRows = complete(a.load.rows as Json[]).slice(-3);
  const spike = recentRows.filter((row) => Number(row.acute_chronic) > 1.5).sort((x, y) => Number(y.acute_chronic) - Number(x.acute_chronic))[0];
  if (spike && (!acwr || spike !== complete(a.load.rows as Json[])[acwr.index])) {
    out.push({ id: "load_spike", section: "load", level: "watch", text: `Training load spiked to ${spike.acute_chronic}x their 4-week normal in ${weekLabel(String(spike.week_start), currentWeek)}.` });
  }
  // Most gym loads estimated: say so, and how to fix it.
  const quality = (a.load as Json).quality as Json | undefined;
  if (quality && Number(quality.gym_sessions) >= 3 && Number(quality.measured_pct) < 50) {
    out.push({ id: "load_estimated", section: "load", level: "info", text: `${100 - Number(quality.measured_pct)}% of gym session loads are estimated from the app's timings - the athlete didn't rate them when they finished.` });
  }
  const mono = lastValue(complete(a.load.rows as Json[]), (row) => row.monotony as number | null);
  if (mono && mono.value > 2) out.push({ id: "monotony", section: "load", level: "watch", text: `Training has been very samey day to day (monotony ${mono.value}; above 2 is high).` });

  // Readiness against their own normal (the latest week with check-ins).
  const readiness = lastValue(a.readiness.rows as Json[], (row) => row.z as number | null);
  if (readiness && readiness.value <= -1) {
    const row = (a.readiness.rows as Json[])[readiness.index];
    const when = weekLabel(String(row.week_start), currentWeek);
    out.push({ id: "readiness", section: "readiness", level: readiness.value <= -1.5 ? "alert" : "watch", text: `Readiness well below their normal ${when} (sleep ${row.sleep}, soreness ${row.soreness}, stress ${row.stress} out of 5).` });
  }

  // HRV well below, or resting HR well above, their own normal.
  const physiology = lastValue(a.readiness.rows as Json[], (row) => row.hrv_z as number | null);
  if (physiology && physiology.value <= -1.5) {
    const row = (a.readiness.rows as Json[])[physiology.index];
    out.push({ id: "hrv_low", section: "readiness", level: "watch", text: `HRV well below their normal ${weekLabel(String(row.week_start), currentWeek)} (${row.hrv_ms} ms on average).` });
  }
  const rhr = lastValue(a.readiness.rows as Json[], (row) => row.resting_hr_delta as number | null);
  if (rhr && rhr.value >= 5) {
    const row = (a.readiness.rows as Json[])[rhr.index];
    out.push({ id: "rhr_high", section: "readiness", level: "watch", text: `Resting heart rate ${rhr.value} bpm above their normal ${weekLabel(String(row.week_start), currentWeek)}.` });
  }
  // High-speed running jumping against their usual (GPS).
  const hsr = lastValue(complete(((a.external as Json | undefined)?.rows ?? []) as Json[]), (row) => row.hsr_ratio as number | null);
  if (hsr && hsr.value > 1.5) out.push({ id: "hsr_spike", section: "gps", level: "watch", text: `High-speed running jumped to ${hsr.value}× their usual last week.` });

  // Weekly check-ins: energy or sleep in the last 2 against the weeks before.
  const checkins = (a.readiness.checkins as Json[]);
  for (const [key, label] of [["energy", "Energy"], ["sleep", "Sleep"], ["motivation", "Motivation"]] as const) {
    const rated = checkins.filter((row) => row[key] !== null && row[key] !== undefined);
    if (rated.length < 4) continue;
    const recent = rated.slice(-2).map((row) => Number(row[key]));
    const before = rated.slice(0, -2).map((row) => Number(row[key]));
    const recentMean = mean(recent);
    const beforeMean = mean(before);
    if (beforeMean - recentMean >= 1.5) {
      out.push({ id: `checkin_${key}`, section: "readiness", level: "watch", text: `${label} rated ${round(recentMean, 1)}/5 in their last 2 weekly check-ins (usually ${round(beforeMean, 1)}).` });
      break;
    }
  }

  // Strength.
  for (const lift of (a.strength.lifts as Json[]).filter((entry) => entry.main !== false)) {
    if (lift.status === "falling") out.push({ id: `strength_${lift.exercise_id}`, section: "strength", level: "alert", exercise_id: String(lift.exercise_id), text: `${lift.name} estimated max is ${Math.abs(Number(lift.recent_off_peak_pct))}% below its peak of ${lift.peak} kg.` });
    else if (lift.status === "plateau") out.push({ id: `strength_${lift.exercise_id}`, section: "strength", level: "watch", exercise_id: String(lift.exercise_id), text: `${lift.name} hasn't beaten ${lift.peak} kg for ${lift.weeks_since_peak} weeks.` });
    else if (lift.status === "rising" && lift.change_pct !== null) out.push({ id: `strength_${lift.exercise_id}`, section: "strength", level: "good", text: `${lift.name} estimated max up ${lift.change_pct}% to ${lift.latest} kg.` });
  }

  // Execution.
  const reps = lastValue(complete(a.execution.rows as Json[]), (row) => row.reps_hit_pct as number | null);
  if (reps && reps.value < 80) out.push({ id: "execution", section: "execution", level: reps.value < 65 ? "alert" : "watch", text: `Hit the prescribed reps on ${reps.value}% of sets in their latest training week.` });
  const creep = (a.execution.effort_creep as Json[])[0];
  if (creep && Number(creep.effort_change) >= 1) out.push({ id: "creep", section: "execution", level: "watch", exercise_id: String(creep.exercise_id), text: `${creep.name} feels harder at the same weight: ${creep.scale_label} ${creep.early} → ${creep.late} at about ${creep.load_kg} kg.` });
  // Effort against an RPE, Borg or CR10 target (at least 3 ratings).
  const targets = ((a.execution.effort_targets ?? []) as Json[]).filter((row) => Number(row.ratings) >= 3);
  const over = targets.find((row) => Number(row.diff_10) >= 1);
  const under = targets.find((row) => Number(row.diff_10) <= -1.5);
  const targetText = (row: Json) => `${SCALE_LABEL[row.scale as EffortScale]} ${row.target}${row.target_max ? `-${row.target_max}` : ""}`;
  if (over) out.push({ id: `effort_target_${over.exercise_id}`, section: "execution", level: "watch", exercise_id: String(over.exercise_id), text: `${over.name} is rated harder than prescribed: ${targetText(over)} set, rated ${over.rated_average} on average.` });
  if (under) out.push({ id: `effort_target_${under.exercise_id}`, section: "execution", level: "info", text: `${under.name} is rated easier than prescribed: ${targetText(under)} set, rated ${under.rated_average} on average - room to add weight.` });
  // Tests: a real change since last time (beyond the test's noise).
  for (const testRow of ((a.testing as Json | undefined)?.tests ?? []) as Json[]) {
    if (testRow.verdict === "improved") out.push({ id: `test_${testRow.test_id}`, section: "testing", level: "good", text: `${testRow.name} improved to ${(testRow.latest as Json).value} ${testRow.unit} (from ${(testRow.previous as Json).value}) - a real change.` });
    if (testRow.verdict === "declined") out.push({ id: `test_${testRow.test_id}`, section: "testing", level: "watch", text: `${testRow.name} went back to ${(testRow.latest as Json).value} ${testRow.unit} (from ${(testRow.previous as Json).value}) - more than normal variation.` });
  }
  // Doing less (or more) than the plan, by tonnage, over the last 2 complete weeks.
  const planWeeks = complete(((a.plan as Json | undefined)?.rows ?? []) as Json[]).filter((row) => Number(row.planned_tonnage_kg) > 0).slice(-2);
  if (planWeeks.length) {
    const planned = planWeeks.reduce((sum, row) => sum + Number(row.planned_tonnage_kg), 0);
    const doneT = planWeeks.reduce((sum, row) => sum + Number(row.done_tonnage_kg), 0);
    const pct = Math.round((doneT / planned) * 100);
    if (pct < 75) out.push({ id: "plan_under", section: "execution", level: "watch", text: `Did ${pct}% of the planned tonnage over the last ${planWeeks.length === 1 ? "week" : "2 weeks"}.` });
    if (pct > 115) out.push({ id: "plan_over", section: "execution", level: "watch", text: `Did ${pct}% of the planned tonnage over the last ${planWeeks.length === 1 ? "week" : "2 weeks"} - more than the plan.` });
  }
  // Bodyweight strength: more reps on their best set.
  for (const lift of ((a.strength.bodyweight ?? []) as Json[]).filter((row) => Number(row.change) >= 2).slice(0, 2)) {
    out.push({ id: `bodyweight_${lift.exercise_id}`, section: "strength", level: "good", text: `${lift.name} best set up from ${lift.first} to ${lift.latest} reps.` });
  }

  // Pain.
  const recurring = (a.pain.areas as Json[]).filter((area) => Number(area.weeks) >= 2);
  for (const area of recurring.slice(0, 2)) {
    const name = String(area.area).replace("_", " ");
    const label = name.charAt(0).toUpperCase() + name.slice(1);
    const onSpike = Number(area.first_week_acute_chronic) > 1.3 ? `, first in ${weekLabel(String(area.first_week), currentWeek)} when load was ${area.first_week_acute_chronic}x normal` : "";
    out.push({ id: `pain_${area.area}`, section: "pain", level: "alert", text: `${label} pain reported in ${area.weeks} different weeks${(area.exercises as string[]).length ? ` (${(area.exercises as string[]).slice(0, 2).join(", ")})` : ""}${onSpike}.` });
  }

  if (a.injuries) out.push(...(injuryFindings(a.injuries, String((a.injuries as Json).as_of)) as Finding[]));
  for (const lift of (((a.velocity as Json | undefined)?.lifts ?? []) as Json[])) {
    const change = Number(lift.speed_change);
    if (finite(lift.speed_change) && change <= -0.06) out.push({ id: `velocity_${lift.exercise_id}`, section: "strength", level: "watch", exercise_id: String(lift.exercise_id), text: `${lift.name}: bar speed at ${lift.common_load_kg} kg is down ${Math.abs(change).toFixed(2)} m/s (${lift.speed_before} to ${lift.speed_after}).` });
    else if (finite(lift.speed_change) && change >= 0.06) out.push({ id: `velocity_${lift.exercise_id}`, section: "strength", level: "good", exercise_id: String(lift.exercise_id), text: `${lift.name}: bar speed at ${lift.common_load_kg} kg is up ${change.toFixed(2)} m/s (${lift.speed_before} to ${lift.speed_after}).` });
  }
  const overPrilepin = ((((a.execution as Json)?.intensity as Json | undefined)?.prilepin ?? []) as Json[]).filter((entry) => ((entry.zones ?? []) as Json[]).some((zone) => zone.verdict === "above" && String(zone.zone) !== "55-69%"));
  if (overPrilepin.length >= 2) out.push({ id: "prilepin_high", section: "strength", level: "info", text: `${overPrilepin.length} recent heavy sessions went past Prilepin's range for reps at 70%+ (${[...new Set(overPrilepin.map((entry) => String(entry.name)))].slice(0, 2).join(", ")}).` });
  if (!a.closed) out.push(...(forwardFindings((((a.plan as Json)?.ahead as Json | undefined)?.rows ?? []) as Json[]) as Finding[]));

  const order = { alert: 0, watch: 1, info: 2, good: 3 };
  return mergeRelated(out)
    .map((finding) => { const action = actionFor(finding); return action ? { ...finding, action } : finding; })
    .sort((x, y) => order[x.level] - order[y.level] || (SECTION_ORDER[x.section] ?? 9) - (SECTION_ORDER[y.section] ?? 9));
}

export function attentionScore(list: readonly Finding[]): number {
  return list.reduce((sum, finding) => sum + (finding.level === "alert" ? 3 : finding.level === "watch" ? 1 : 0), 0);
}
