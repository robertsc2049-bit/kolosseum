// DEV NOTE: Coach progress reports (pure: no clock, no database). The
// periods a report can cover - every week, every programme block, every
// training-cycle phase, every programme and every year the athlete has
// trained in - and the report itself: one period's analysis
// (coach_analysis_metrics.ts) summed up, and compared with the period of
// the same kind before it. Periods are whole Monday-Sunday weeks, so a
// block's report starts the Monday of its first session's week.
import { addDays, weekStart } from "./coach_analysis_metrics.js";

type Json = Record<string, unknown>;

export const REPORT_TYPES = Object.freeze(["week", "block", "cycle", "programme", "year"] as const);
export type ReportType = (typeof REPORT_TYPES)[number] | "custom";

export type ReportPeriod = Readonly<{
  type: ReportType;
  id: string;
  label: string;
  start: string; // a Monday
  end: string; // a Sunday
  complete: boolean;
  detail?: string;
  // A custom report's exact dates (the weeks around them hold its rows).
  from?: string;
  to?: string;
}>;

// A programme the athlete has run: its sessions' dates and the block each
// belongs to, in order.
export type ProgrammeHistory = Readonly<{
  id: string;
  name: string;
  current: boolean;
  sessions: ReadonlyArray<{ date: string; block_key: string; block_name: string; block_type?: string }>;
}>;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function shortDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
const sundayOf = (date: string) => addDays(weekStart(date), 6);
export const weeksIn = (period: Pick<ReportPeriod, "start" | "end">) => Math.round((Date.parse(period.end) - Date.parse(period.start)) / (7 * 86_400_000) + 1 / 7);

// Every week from the first one they trained in to this one.
export function weekPeriods(firstDate: string | null, today: string): ReportPeriod[] {
  if (!firstDate) return [];
  const out: ReportPeriod[] = [];
  const current = weekStart(today);
  for (let start = weekStart(firstDate); start <= current; start = addDays(start, 7)) {
    out.push({ type: "week", id: start, label: `Week of ${shortDate(start)}`, start, end: addDays(start, 6), complete: start < current });
  }
  return out;
}

// ISO years: a year's weeks are the ones whose Thursday falls in it.
export function yearPeriods(firstDate: string | null, today: string): ReportPeriod[] {
  if (!firstDate) return [];
  const isoYear = (date: string) => Number(addDays(weekStart(date), 3).slice(0, 4));
  const out: ReportPeriod[] = [];
  for (let year = isoYear(firstDate); year <= isoYear(today); year += 1) {
    const start = weekStart(`${year}-01-04`);
    const end = addDays(weekStart(`${year}-12-28`), 6);
    out.push({ type: "year", id: String(year), label: String(year), start, end: end < sundayOf(today) ? end : sundayOf(today), complete: end < weekStart(today) });
  }
  return out;
}

const PHASE_LABEL: Record<string, string> = {
  off_season: "Off-season", pre_season: "Pre-season", in_season: "In-season", transition: "Transition",
  accumulation: "Accumulation", intensification: "Intensification", peak: "Peak",
  base: "Base", build: "Build", specific: "Specific", taper: "Taper"
};
export const phaseLabel = (phase: string) => PHASE_LABEL[phase] ?? phase.replaceAll("_", " ").replace(/^./u, (c) => c.toUpperCase());

// Runs of consecutive weeks in the same training-cycle phase.
export function cyclePeriods(firstDate: string | null, today: string, phaseOfWeek: (monday: string) => string | null): ReportPeriod[] {
  if (!firstDate) return [];
  const out: Array<ReportPeriod & { phase: string }> = [];
  const current = weekStart(today);
  for (let start = weekStart(firstDate); start <= current; start = addDays(start, 7)) {
    const phase = phaseOfWeek(start);
    if (!phase) continue;
    const last = out[out.length - 1];
    if (last && last.phase === phase && addDays(last.end, 1) === start) {
      out[out.length - 1] = { ...last, end: addDays(start, 6), complete: start < current };
    }
    else {
      out.push({ type: "cycle", id: start, phase, label: phaseLabel(phase), start, end: addDays(start, 6), complete: start < current });
    }
  }
  return out.map(({ phase: _phase, ...period }) => period);
}

// Each programme, and each block within it, from the first to the last
// week a session of it was trained. The current programme's latest block
// is still going.
export function programmePeriods(programmes: readonly ProgrammeHistory[], today: string): ReportPeriod[] {
  const out: ReportPeriod[] = [];
  for (const programme of programmes) {
    const sessions = [...programme.sessions].sort((a, b) => a.date.localeCompare(b.date));
    if (!sessions.length) continue;
    const lastDate = sessions[sessions.length - 1].date;
    const going = programme.current;
    out.push({
      type: "programme", id: programme.id, label: programme.name,
      start: weekStart(sessions[0].date), end: going ? sundayOf(today) : sundayOf(lastDate),
      complete: !going, detail: `${sessions.length} session${sessions.length === 1 ? "" : "s"}`
    });
    const blocks: Array<{ key: string; name: string; type?: string; dates: string[] }> = [];
    for (const session of sessions) {
      const last = blocks[blocks.length - 1];
      if (last && last.key === session.block_key) last.dates.push(session.date);
      else blocks.push({ key: session.block_key, name: session.block_name, type: session.block_type, dates: [session.date] });
    }
    blocks.forEach((block, index) => {
      const latest = going && index === blocks.length - 1;
      out.push({
        type: "block", id: `${programme.id}:${index}`, label: `${block.name} - ${programme.name}`,
        start: weekStart(block.dates[0]), end: latest ? sundayOf(today) : sundayOf(block.dates[block.dates.length - 1]),
        complete: !latest, detail: block.type && block.type !== "general" && block.type !== "custom" ? `${block.type} block` : undefined
      });
    });
  }
  return out;
}

// A report from a set date to another (inclusive), up to 2 years. The
// comparison is the same number of days just before it.
export const CUSTOM_MAX_DAYS = 731;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const validDate = (value: string) => ISO_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

export function customPeriod(fromInput: unknown, toInput: unknown, today: string): ReportPeriod | null {
  const from = typeof fromInput === "string" ? fromInput.trim() : "";
  const toRaw = typeof toInput === "string" && toInput.trim() ? toInput.trim() : today;
  if (!validDate(from) || !validDate(toRaw)) return null;
  const to = toRaw > today ? today : toRaw;
  if (from > to || daysBetween(from, to) + 1 > CUSTOM_MAX_DAYS) return null;
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return {
    type: "custom", id: `${from}_${to}`,
    label: `${shortDate(from)}${sameYear ? "" : ` ${from.slice(0, 4)}`} – ${shortDate(to)} ${to.slice(0, 4)}`,
    start: weekStart(from), end: sundayOf(to), complete: to < today, from, to,
    detail: `${daysBetween(from, to) + 1} days`
  };
}

export function customPeriodFromId(id: string, today: string): ReportPeriod | null {
  const [from, to] = id.split("_");
  return customPeriod(from, to, today);
}

export function previousCustomPeriod(period: ReportPeriod, today: string): ReportPeriod | null {
  if (!period.from || !period.to) return null;
  const length = daysBetween(period.from, period.to) + 1;
  return customPeriod(addDays(period.from, -length), addDays(period.from, -1), today);
}

// ---------- the report ----------
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const round = (value: number, places = 1) => Math.round(value * 10 ** places) / 10 ** places;
const mean = (values: readonly number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
const values = (rows: readonly Json[], key: string) => rows.map((row) => row[key]).filter(finite);

// One period's analysis, summed up.
export function summariseReport(analysis: Json): Json {
  const a = analysis as Record<string, Json>;
  const adherence = a.adherence.rows as Json[];
  const counted = adherence.filter((row) => finite(row.adherence_pct));
  const planned = counted.reduce((sum, row) => sum + Number(row.planned ?? 0), 0);
  const doneCounted = counted.reduce((sum, row) => sum + Number(row.completed) + Number(row.partial) * 0.5, 0);
  const loadRows = a.load.rows as Json[];
  const loads = values(loadRows, "load");
  const peak = loadRows.filter((row) => finite(row.acute_chronic)).reduce<Json | null>((best, row) => (!best || Number(row.acute_chronic) > Number(best.acute_chronic) ? row : best), null);
  const sessions = a.load.sessions as Json[];
  const volume = a.volume.rows as Json[];
  const lifts = (a.strength.lifts as Json[]).map((lift) => {
    const points = (lift.series as Json[]).filter((point) => finite(point.e1rm));
    const first = points[0];
    const last = points[points.length - 1];
    const best = points.reduce<Json | null>((top, point) => (!top || Number(point.e1rm) > Number(top.e1rm) ? point : top), null);
    return {
      exercise_id: lift.exercise_id, name: lift.name, main: lift.main,
      start: first ? first.e1rm : null, end: last ? last.e1rm : null, best: best ? best.e1rm : null,
      best_from: best ? best.from : null,
      change_pct: first && last && first !== last ? round(((Number(last.e1rm) - Number(first.e1rm)) / Number(first.e1rm)) * 100, 1) : null
    };
  }).sort((x, y) => Number(y.main) - Number(x.main));
  const execution = a.execution as Json;
  const readinessDays = (a.readiness as Json).days as Json[];
  const readinessRows = (a.readiness as Json).rows as Json[];
  const checkins = (a.readiness as Json).checkins as Json[];
  const pain = a.pain as Json;
  const avg = (list: readonly number[], places = 1) => { const m = mean(list); return m === null ? null : round(m, places); };
  return {
    sessions: {
      completed: adherence.reduce((sum, row) => sum + Number(row.completed), 0),
      partial: adherence.reduce((sum, row) => sum + Number(row.partial), 0),
      not_finished: adherence.reduce((sum, row) => sum + Number(row.abandoned), 0),
      planned: planned || null,
      adherence_pct: planned ? Math.min(100, Math.round((doneCounted / planned) * 100)) : null,
      minutes: Math.round(values(sessions, "minutes").reduce((sum, value) => sum + value, 0)),
      average_effort: avg(values(sessions, "effort"))
    },
    training: {
      sets: volume.reduce((sum, row) => sum + Number(row.sets ?? 0), 0),
      tonnage_kg: volume.reduce((sum, row) => sum + Number(row.tonnage_kg ?? 0), 0),
      bodyweight_reps: volume.reduce((sum, row) => sum + Number(row.bodyweight_reps ?? 0), 0),
      timed_minutes: round(volume.reduce((sum, row) => sum + Number(row.timed_minutes ?? 0), 0), 1),
      distance_m: Math.round(volume.reduce((sum, row) => sum + Number(row.distance_m ?? 0), 0)),
      load_total: loads.length ? Math.round(loads.reduce((sum, value) => sum + value, 0)) : null,
      load_weekly_average: loads.length ? Math.round(mean(loads)!) : null,
      peak_acute_chronic: peak ? { value: peak.acute_chronic, week_start: peak.week_start } : null,
      average_monotony: avg(values(loadRows, "monotony"), 2)
    },
    strength: lifts,
    bodyweight_strength: ((a.strength as Json).bodyweight ?? []) as Json[],
    intensity: (execution.intensity ?? null) as Json | null,
    execution: {
      reps_hit_pct: avg(values(execution.rows as Json[], "reps_hit_pct"), 0),
      sets_logged_pct: avg(values(execution.rows as Json[], "sets_logged_pct"), 0),
      effort_creep: execution.effort_creep,
      effort_targets: execution.effort_targets ?? [],
      load_vs_plan_pct: avg(values(execution.rows as Json[], "load_vs_plan_pct")),
      effort_vs_plan: avg(values(execution.rows as Json[], "effort_vs_plan")),
      most_missed: execution.most_missed,
      most_skipped: (a.adherence as Json).most_skipped
    },
    wellbeing: {
      check_ins: readinessDays.length,
      readiness_average: avg(values(readinessDays, "total")),
      low_weeks: readinessRows.filter((row) => finite(row.z) && Number(row.z) <= -1).length,
      energy: avg(values(checkins, "energy")),
      motivation: avg(values(checkins, "motivation")),
      sleep: avg(values(checkins, "sleep"))
    },
    pain: { reports: values(pain.rows as Json[], "reports").reduce((sum, value) => sum + value, 0), areas: pain.areas },
    exercises: ((a.exercises ?? {}) as Json).rows ?? [],
    effort_bands: ((a.exercises ?? {}) as Json).effort_bands ?? [],
    effort_rated: ((a.exercises ?? {}) as Json).rated ?? 0,
    effort_rated_by: ((a.exercises ?? {}) as Json).rated_by ?? null,
    patterns: ((a.exercises ?? {}) as Json).patterns ?? [],
    session_log: sessions
  };
}

// The athlete's copy a coach sends: what they did and how it went, in
// plain words - sessions, weekly consistency, the best set they lifted on
// each exercise (weight x reps they actually did), volume, how they felt,
// and the coach's own message. Never an estimated max, a % of max, a load
// ratio or the coach's flags: those are the coach's tools, not the
// athlete's (and the athlete's numbers stay their lifted weights).
export function athleteReport(period: ReportPeriod, summary: Json, analysis: Json, coach: Readonly<{ name: string; message: string }>): Json {
  const a = analysis as Record<string, Json>;
  const sessions = (summary.sessions ?? {}) as Json;
  const training = (summary.training ?? {}) as Json;
  const wellbeing = (summary.wellbeing ?? {}) as Json;
  const pain = (summary.pain ?? {}) as Json;
  const adherence = (a.adherence?.rows ?? []) as Json[];
  const weeks = (a.weeks ?? []) as unknown as string[];
  const exercises = (summary.exercises ?? []) as Json[];
  return {
    period: { type: period.type, label: period.label, start: period.from ?? period.start, end: period.to ?? period.end, complete: period.complete },
    coach: { name: coach.name, message: coach.message },
    sessions: { completed: sessions.completed, partial: sessions.partial, planned: sessions.planned, minutes: sessions.minutes },
    weeks: weeks.map((week, index) => ({ week_start: week, sessions: Number(adherence[index]?.completed ?? 0) + Number(adherence[index]?.partial ?? 0), planned: adherence[index]?.planned ?? null })),
    training: { sets: training.sets, tonnage_kg: training.tonnage_kg, bodyweight_reps: training.bodyweight_reps, timed_minutes: training.timed_minutes, distance_m: training.distance_m },
    exercises: exercises.map((row) => ({
      name: row.name, sessions: row.sessions, sets: row.sets, reps: row.reps,
      best_set: row.top_set ?? null,
      best_bodyweight_reps: row.best_bodyweight_reps ?? null,
      minutes: row.minutes ?? null,
      distance_m: row.distance_m ?? null,
      average_effort: row.average_effort ?? null,
      effort_scale: row.effort_scale ?? null
    })),
    wellbeing: { check_ins: wellbeing.check_ins, energy: wellbeing.energy, motivation: wellbeing.motivation, sleep: wellbeing.sleep },
    pain: { reports: pain.reports, areas: ((pain.areas ?? []) as Json[]).map((area) => ({ area: area.area, reports: area.reports })) }
  };
}

// This report against the one before it of the same kind: the change in
// each headline number (null where either side has none).
export function compareReports(current: Json, previous: Json | null): Json | null {
  if (!previous) return null;
  const get = (summary: Json, path: string) => path.split(".").reduce<unknown>((value, key) => (value && typeof value === "object" ? (value as Json)[key] : undefined), summary);
  const delta = (path: string, places = 1) => {
    const now = get(current, path);
    const before = get(previous, path);
    return finite(now) && finite(before) ? round(now - before, places) : null;
  };
  const pct = (path: string) => {
    const now = get(current, path);
    const before = get(previous, path);
    return finite(now) && finite(before) && before !== 0 ? round(((now - before) / before) * 100, 0) : null;
  };
  const before = new Map(((previous.strength as Json[]) ?? []).map((lift) => [lift.exercise_id, lift]));
  return {
    sessions_completed: delta("sessions.completed", 0),
    adherence_pct: delta("sessions.adherence_pct", 0),
    sets_pct: pct("training.sets"),
    tonnage_pct: pct("training.tonnage_kg"),
    load_weekly_average_pct: pct("training.load_weekly_average"),
    reps_hit_pct: delta("execution.reps_hit_pct", 0),
    readiness_average: delta("wellbeing.readiness_average"),
    pain_reports: delta("pain.reports", 0),
    strength: ((current.strength as Json[]) ?? []).map((lift) => {
      const earlier = before.get(lift.exercise_id);
      return {
        exercise_id: lift.exercise_id,
        name: lift.name,
        change_pct: earlier && finite(lift.end) && finite(earlier.end) ? round(((lift.end - earlier.end) / earlier.end) * 100, 1) : null
      };
    }).filter((lift) => lift.change_pct !== null)
  };
}
