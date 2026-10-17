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
  load_kg: number | null;
}>;

export type AnalysisSession = Readonly<{
  session_id: string;
  status: string;
  created_at: string;
  title?: string;
  planned: readonly AnalysisPlannedExercise[];
  events: readonly AnalysisEvent[];
}>;

export type ReadinessFact = Readonly<{ date: string; sleep: number; soreness: number; stress: number }>;
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
  const dailyLoad = new Map<string, number>();
  const sessionRows: Json[] = [];
  for (const session of allSessions.filter(done)) {
    const load = sessionLoad(session.events);
    const date = sessionDay(session);
    if (load !== null) dailyLoad.set(date, (dailyLoad.get(date) ?? 0) + load);
    if (!inRange(date)) continue;
    sessionRows.push({ session_id: session.session_id, date, title: session.title ?? null, status: session.status, effort: sessionEffort(session.events), minutes: sessionMinutes(session.events), load, sets: setLogs(session).length, pain: session.events.some((event) => event.type === "PAIN_REPORT"), skipped: session.events.filter((event) => event.type === "SKIP_EXERCISE").length });
  }
  const firstTrainedWeek = allSessions.some(done) ? weekStart(sessionDay(allSessions.filter(done)[0])) : null;
  const weeklyLoadAll = loadWeeks.map((start) => {
    // Before their first session there is no load history: "no data", not 0.
    if (firstTrainedWeek === null || start < firstTrainedWeek) return null;
    const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
    const rated = days.some((date) => dailyLoad.has(date));
    const trained = allSessions.some((session) => done(session) && weekStart(sessionDay(session)) === start);
    return rated ? days.reduce((sum, date) => sum + (dailyLoad.get(date) ?? 0), 0) : trained ? null : 0;
  });
  const loadRows = weeks.map((start) => {
    const index = loadWeeks.indexOf(start);
    const daily = Array.from({ length: 7 }, (_, offset) => dailyLoad.get(addDays(start, offset)) ?? 0);
    const weekly = weeklyLoadAll[index];
    const mono = weekly ? monotony(daily) : null;
    return { week_start: start, partial_week: start === currentWeek, load: weekly, acute_chronic: acuteChronic(weeklyLoadAll, index), monotony: mono, strain: weekly && mono ? round(weekly * mono, 0) : null };
  });

  // --- volume ---
  const volumeRows = weeks.map((start) => {
    const logs = sessions.filter((session) => weekStart(sessionDay(session)) === start).flatMap(setLogs);
    const tonnage = logs.reduce((sum, log) => sum + (finite(log.load_kg) && finite(log.reps) ? log.load_kg * log.reps : 0), 0);
    return { week_start: start, sets: logs.length, tonnage_kg: round(tonnage, 0) };
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
  const ranked = [...liftWeeks.entries()]
    .map(([lift, byWeek]) => ({ lift, inWindow: [...byWeek.keys()].filter((week) => week >= first) }))
    .filter((entry) => entry.inWindow.length >= 2)
    .sort((a, b) => b.inWindow.length - a.inWindow.length || a.lift.localeCompare(b.lift))
    .slice(0, 6);
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
      const status = (offPeak !== null && offPeak <= -5) || (change !== null && change <= -5) ? "falling" : weeksSincePeak >= 6 && recent.length > 0 ? "plateau" : change !== null && change >= 2 ? "rising" : "steady";
      return { exercise_id: lift, name: input.exercise_name(lift), main: isMain(lift, rank), series, latest: latest.e1rm, change_pct: change, change_from_week: baseline?.week_start ?? null, peak: peak.e1rm, peak_week: peak.week_start, weeks_since_peak: weeksSincePeak, recent_off_peak_pct: offPeak, status };
    });

  // --- execution vs the plan ---
  type ExecutionTally = { sets_planned: number; sets_logged: number; reps_checked: number; reps_hit: number; load_ratio: number[]; missed: Map<string, number> };
  const tally = (): ExecutionTally => ({ sets_planned: 0, sets_logged: 0, reps_checked: 0, reps_hit: 0, load_ratio: [], missed: new Map() });
  const executionByWeek = new Map<string, ExecutionTally>();
  const missedByExercise = new Map<string, { missed_sets: number; sets: number }>();
  for (const session of sessions.filter((s) => done(s) && inWindow(sessionDay(s)))) {
    const week = weekStart(sessionDay(session));
    const t = executionByWeek.get(week) ?? tally();
    const logs = session.events.filter((event) => event.type === "SET_LOG_REPORT");
    for (const planned of session.planned.filter((p) => p.segment === "working")) {
      const mine = logs.filter((log) => log.exercise_id === planned.exercise_id);
      t.sets_planned += planned.sets;
      t.sets_logged += Math.min(mine.length, planned.sets_max ?? planned.sets);
      const ex = missedByExercise.get(baseExercise(planned.exercise_id)) ?? { missed_sets: 0, sets: 0 };
      ex.sets += planned.sets;
      if (planned.reps_target !== null) {
        for (const log of mine) {
          t.reps_checked += 1;
          if (finite(log.reps) && log.reps >= planned.reps_target) t.reps_hit += 1;
          else ex.missed_sets += 1;
        }
      }
      ex.missed_sets += Math.max(0, planned.sets - mine.length);
      missedByExercise.set(baseExercise(planned.exercise_id), ex);
      if (planned.load_kg && planned.load_kg > 0) {
        for (const log of mine) if (finite(log.load_kg) && log.load_kg > 0) t.load_ratio.push(log.load_kg / planned.load_kg);
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
      load_vs_plan_pct: t && t.load_ratio.length ? round((mean(t.load_ratio) - 1) * 100, 1) : null
    };
  });
  const mostMissed = [...missedByExercise.entries()]
    .filter(([, value]) => value.missed_sets > 0)
    .map(([exerciseId, value]) => ({ exercise_id: exerciseId, name: input.exercise_name(exerciseId), missed_sets: value.missed_sets, planned_sets: value.sets, missed_pct: round((value.missed_sets / value.sets) * 100, 0) }))
    .sort((a, b) => b.missed_pct - a.missed_pct || b.missed_sets - a.missed_sets)
    .slice(0, 5);

  // RPE creep: the same exercise at about the same top weight (within 2.5%),
  // rated in the first half of the window and again in the second.
  const rated = new Map<string, Array<{ date: string; load: number; rpe: number }>>();
  for (const session of sessions.filter((s) => done(s) && inWindow(sessionDay(s)))) {
    for (const event of session.events.filter((e) => e.type === "RPE_REPORT" && e.exercise_id && finite(e.rpe))) {
      const lift = baseExercise(event.exercise_id!);
      const loads = setLogs(session).filter((log) => log.exercise_id && baseExercise(log.exercise_id) === lift && finite(log.load_kg)).map((log) => log.load_kg as number);
      if (!loads.length) continue;
      const list = rated.get(lift) ?? [];
      list.push({ date: sessionDay(session), load: Math.max(...loads), rpe: event.rpe! });
      rated.set(lift, list);
    }
  }
  const midpoint = addDays(first, Math.round((input.weeks * 7) / 2));
  const effortCreep = [...rated.entries()].flatMap(([lift, list]) => {
    const early = list.filter((entry) => entry.date < midpoint);
    const late = list.filter((entry) => entry.date >= midpoint);
    let best: Json | null = null;
    for (const e of early) {
      const matches = late.filter((l) => Math.abs(l.load - e.load) / e.load <= 0.025);
      if (!matches.length) continue;
      const lateRpe = mean(matches.map((m) => m.rpe));
      const delta = round(lateRpe - e.rpe, 1);
      if (!best || Math.abs(delta) > Math.abs(Number(best.rpe_change))) best = { exercise_id: lift, name: input.exercise_name(lift), load_kg: e.load, early_rpe: e.rpe, late_rpe: round(lateRpe, 1), rpe_change: delta, early_date: e.date, late_date: matches[matches.length - 1].date };
    }
    return best ? [best] : [];
  }).sort((a, b) => Math.abs(Number(b.rpe_change)) - Math.abs(Number(a.rpe_change)));

  // --- adherence ---
  const expected = input.planned_days_per_week && input.planned_days_per_week > 0 ? input.planned_days_per_week : null;
  const staleCutoff = addDays(input.today, -2);
  // Adherence counts from the week they started: no "missed sessions" for
  // weeks before their first one (a new athlete, or a new coach).
  const firstSession = sessions.length ? sessionDay(sessions[0]) : null;
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
    return { ...check, total, z };
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
      z: zs.length ? round(mean(zs), 2) : null
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

  // --- per exercise, effort ratings and movement patterns ---
  const counted = sessions.filter((s) => done(s) && inWindow(sessionDay(s)));
  const perExercise = new Map<string, { sessions: Set<string>; sets: number; reps: number; tonnage: number; top: { load: number; reps: number } | null; rpes: number[] }>();
  for (const session of counted) {
    for (const log of setLogs(session)) {
      if (!log.exercise_id) continue;
      const lift = baseExercise(log.exercise_id);
      const entry = perExercise.get(lift) ?? { sessions: new Set(), sets: 0, reps: 0, tonnage: 0, top: null, rpes: [] };
      entry.sessions.add(session.session_id);
      entry.sets += 1;
      if (finite(log.reps)) entry.reps += log.reps;
      if (finite(log.load_kg) && finite(log.reps)) {
        entry.tonnage += log.load_kg * log.reps;
        if (!entry.top || log.load_kg > entry.top.load || (log.load_kg === entry.top.load && log.reps > entry.top.reps)) entry.top = { load: log.load_kg, reps: log.reps };
      }
      perExercise.set(lift, entry);
    }
    for (const event of session.events.filter((e) => e.type === "RPE_REPORT" && e.exercise_id && finite(e.rpe))) {
      const entry = perExercise.get(baseExercise(event.exercise_id!));
      if (entry) entry.rpes.push(event.rpe!);
    }
  }
  const exerciseRows = [...perExercise.entries()].map(([exerciseId, entry]) => ({
    exercise_id: exerciseId,
    name: input.exercise_name(exerciseId),
    pattern: input.pattern_of?.(exerciseId) ?? null,
    sessions: entry.sessions.size,
    sets: entry.sets,
    reps: entry.reps,
    tonnage_kg: round(entry.tonnage, 0),
    top_set: entry.top ? { load_kg: entry.top.load, reps: entry.top.reps } : null,
    average_rpe: entry.rpes.length ? round(mean(entry.rpes), 1) : null
  })).sort((a, b) => b.sets - a.sets || a.name.localeCompare(b.name));
  // How hard the athlete rated each exercise (their hardest set), by band.
  const bands = [{ band: "6 or less", test: (r: number) => r <= 6 }, { band: "7", test: (r: number) => r > 6 && r <= 7.5 }, { band: "8", test: (r: number) => r > 7.5 && r <= 8.5 }, { band: "9", test: (r: number) => r > 8.5 && r <= 9.5 }, { band: "10", test: (r: number) => r > 9.5 }];
  const allRpes = counted.flatMap((session) => session.events.filter((e) => e.type === "RPE_REPORT" && finite(e.rpe)).map((e) => e.rpe as number));
  const effortBands = bands.map(({ band, test }) => ({ band, ratings: allRpes.filter(test).length, pct: allRpes.length ? round((allRpes.filter(test).length / allRpes.length) * 100, 0) : null }));
  const patternSets = new Map<string, number>();
  for (const row of exerciseRows) patternSets.set(row.pattern ?? "other", (patternSets.get(row.pattern ?? "other") ?? 0) + row.sets);
  const patternRows = [...patternSets.entries()].map(([pattern, sets]) => ({ pattern, sets })).sort((a, b) => b.sets - a.sets);

  return {
    weeks,
    ...(input.from || input.to ? { range: { from: input.from ?? null, to: input.to ?? null } } : {}),
    ...(input.closed ? { closed: true } : {}),
    load: { rows: loadRows, sessions: sessionRows.filter((row) => inWindow(String(row.date))) },
    volume: { rows: volumeRows },
    strength: { lifts },
    execution: { rows: executionRows, most_missed: mostMissed, effort_creep: effortCreep.slice(0, 5) },
    adherence: { rows: adherenceRows, planned_days_per_week: expected, by_weekday: byWeekday, most_skipped: mostSkipped },
    readiness: { rows: readinessRows, days: readinessDays.filter((entry) => inWindow(entry.date) && inRange(entry.date)), checkins: checkinRows },
    pain: { rows: painRows, areas: painAreas, weeks_with_pain_on_load_spike: painOnSpikes },
    exercises: { rows: exerciseRows, effort_bands: effortBands, rated: allRpes.length, patterns: patternRows }
  };
}

// ---------- findings: plain-English headlines and flags ----------
export type Finding = Readonly<{ id: string; section: string; level: "alert" | "watch" | "good" | "info"; text: string }>;

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
  const mono = lastValue(complete(a.load.rows as Json[]), (row) => row.monotony as number | null);
  if (mono && mono.value > 2) out.push({ id: "monotony", section: "load", level: "watch", text: `Training has been very samey day to day (monotony ${mono.value}; above 2 is high).` });

  // Readiness against their own normal (the latest week with check-ins).
  const readiness = lastValue(a.readiness.rows as Json[], (row) => row.z as number | null);
  if (readiness && readiness.value <= -1) {
    const row = (a.readiness.rows as Json[])[readiness.index];
    const when = weekLabel(String(row.week_start), currentWeek);
    out.push({ id: "readiness", section: "readiness", level: readiness.value <= -1.5 ? "alert" : "watch", text: `Readiness well below their normal ${when} (sleep ${row.sleep}, soreness ${row.soreness}, stress ${row.stress} out of 5).` });
  }

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
    if (lift.status === "falling") out.push({ id: `strength_${lift.exercise_id}`, section: "strength", level: "alert", text: `${lift.name} estimated max is ${Math.abs(Number(lift.recent_off_peak_pct))}% below its peak of ${lift.peak} kg.` });
    else if (lift.status === "plateau") out.push({ id: `strength_${lift.exercise_id}`, section: "strength", level: "watch", text: `${lift.name} hasn't beaten ${lift.peak} kg for ${lift.weeks_since_peak} weeks.` });
    else if (lift.status === "rising" && lift.change_pct !== null) out.push({ id: `strength_${lift.exercise_id}`, section: "strength", level: "good", text: `${lift.name} estimated max up ${lift.change_pct}% to ${lift.latest} kg.` });
  }

  // Execution.
  const reps = lastValue(complete(a.execution.rows as Json[]), (row) => row.reps_hit_pct as number | null);
  if (reps && reps.value < 80) out.push({ id: "execution", section: "execution", level: reps.value < 65 ? "alert" : "watch", text: `Hit the prescribed reps on ${reps.value}% of sets in their latest training week.` });
  const creep = (a.execution.effort_creep as Json[])[0];
  if (creep && Number(creep.rpe_change) >= 1) out.push({ id: "creep", section: "execution", level: "watch", text: `${creep.name} feels harder at the same weight: RPE ${creep.early_rpe} → ${creep.late_rpe} at about ${creep.load_kg} kg.` });

  // Pain.
  const recurring = (a.pain.areas as Json[]).filter((area) => Number(area.weeks) >= 2);
  for (const area of recurring.slice(0, 2)) {
    const name = String(area.area).replace("_", " ");
    const label = name.charAt(0).toUpperCase() + name.slice(1);
    const onSpike = Number(area.first_week_acute_chronic) > 1.3 ? `, first in ${weekLabel(String(area.first_week), currentWeek)} when load was ${area.first_week_acute_chronic}x normal` : "";
    out.push({ id: `pain_${area.area}`, section: "pain", level: "alert", text: `${label} pain reported in ${area.weeks} different weeks${(area.exercises as string[]).length ? ` (${(area.exercises as string[]).slice(0, 2).join(", ")})` : ""}${onSpike}.` });
  }

  const order = { alert: 0, watch: 1, info: 2, good: 3 };
  return out.sort((x, y) => order[x.level] - order[y.level]);
}

export function attentionScore(list: readonly Finding[]): number {
  return list.reduce((sum, finding) => sum + (finding.level === "alert" ? 3 : finding.level === "watch" ? 1 : 0), 0);
}
