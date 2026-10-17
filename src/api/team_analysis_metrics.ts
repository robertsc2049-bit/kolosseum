// DEV NOTE: Team and organisation analysis (pure: no clock, no database).
// Sums up a group of athletes' analysis rows (coach_analysis_service.ts
// rosterRowFor) - how many need a look, attendance, load against their
// usual, readiness, recurring pain, main-lift trends - into plain-English
// group findings with a suggested next step, and the same summary per
// position or per coach. Pain is only ever a count here: the detail stays
// with the athlete's own coach.
import { PERFORMANCE_TESTS } from "./coach_analysis_metrics.js";

type Json = Record<string, unknown>;

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const round = (value: number, places = 0) => Math.round(value * 10 ** places) / 10 ** places;
const mean = (values: readonly number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export type GroupFinding = Readonly<{ id: string; section: string; level: "alert" | "watch" | "good" | "info"; text: string; action?: string }>;

const statusOf = (row: Json) => {
  if (row.unavailable) return "unavailable";
  if (!row.last_session && Number(row.attention ?? 0) === 0) return "no_training";
  const attention = Number(row.attention ?? 0);
  return attention >= 3 ? "needs_a_look" : attention >= 1 ? "keep_an_eye_on" : "on_track";
};

// One group's numbers. includePain: false leaves pain out altogether (a gym
// owner never sees it, even as a count).
export function summariseGroup(rows: readonly Json[], options: { includePain?: boolean } = {}): Json {
  const includePain = options.includePain !== false;
  const trained = rows.filter((row) => row.last_session);
  const statuses = rows.map(statusOf);
  const count = (status: string) => statuses.filter((s) => s === status).length;
  const adherence = trained.map((row) => (row.adherence as Json | undefined)?.latest_pct).filter(finite);
  const ratios = trained.map((row) => (row.load as Json | undefined)?.acute_chronic).filter(finite);
  const zs = trained.map((row) => (row.readiness as Json | undefined)?.z).filter(finite);
  const lifts = trained.flatMap((row) => ((row.strength ?? []) as Json[]));
  const liftCount = (status: string) => lifts.filter((lift) => lift.status === status).length;

  // Week by week: the group's average attendance and load against usual,
  // and how many were low on readiness.
  const weeks = (rows.find((row) => Array.isArray(row.weeks))?.weeks ?? []) as string[];
  const byWeek = (pick: (row: Json) => unknown[] | undefined) => weeks.map((_, index) => trained.map((row) => (pick(row) ?? [])[index]).filter(finite));
  const adherenceWeeks = byWeek((row) => (row.adherence as Json | undefined)?.by_week as unknown[]);
  const ratioWeeks = byWeek((row) => (row.load as Json | undefined)?.ratio_by_week as unknown[]);
  const zWeeks = byWeek((row) => (row.readiness as Json | undefined)?.z_by_week as unknown[]);

  return {
    athletes: rows.length,
    trained: trained.length,
    status: { needs_a_look: count("needs_a_look"), keep_an_eye_on: count("keep_an_eye_on"), on_track: count("on_track"), no_training: count("no_training") },
    adherence: { average_pct: adherence.length ? round(mean(adherence)!) : null, under_70: adherence.filter((value) => value < 70).length, counted: adherence.length },
    load: { average_ratio: ratios.length ? round(mean(ratios)!, 2) : null, high: ratios.filter((value) => value > 1.3).length, low: ratios.filter((value) => value < 0.8).length, counted: ratios.length },
    readiness: { low: zs.filter((value) => value <= -1).length, counted: zs.length },
    ...(includePain ? { availability: {
      unavailable: rows.filter((row) => (row.availability as Json | undefined)?.status === "unavailable").length,
      modified: rows.filter((row) => (row.availability as Json | undefined)?.status === "modified").length,
      available: rows.filter((row) => (row.availability as Json | undefined)?.status === "available").length
    } } : {}),
    ...(includePain ? { pain: { athletes_with_recurring_pain: trained.filter((row) => (((row.pain as Json | undefined)?.recurring_areas ?? []) as unknown[]).length > 0).length } } : {}),
    lifts: { counted: lifts.length, rising: liftCount("rising"), steady: liftCount("steady"), plateau: liftCount("plateau"), falling: liftCount("falling") },
    weekly: weeks.map((week, index) => ({
      week_start: week,
      adherence_pct: adherenceWeeks[index].length ? round(mean(adherenceWeeks[index])!) : null,
      load_ratio: ratioWeeks[index].length ? round(mean(ratioWeeks[index])!, 2) : null,
      readiness_low: zWeeks[index].filter((value) => value <= -1).length
    }))
  };
}

// The group in a few plain sentences, each with a suggested next step.
// "team" reads "the team", a coach's group "this group".
export function groupFindings(summary: Json, noun = "the team"): GroupFinding[] {
  const out: GroupFinding[] = [];
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);
  const trained = Number(summary.trained ?? 0);
  const adherence = summary.adherence as Json;
  const load = summary.load as Json;
  const readiness = summary.readiness as Json;
  const pain = summary.pain as Json | undefined;
  const lifts = summary.lifts as Json;
  const status = summary.status as Json;

  if (finite(adherence.average_pct) && Number(adherence.counted) >= 2) {
    const pct = adherence.average_pct;
    const under = Number(adherence.under_70);
    if (pct < 70) out.push({ id: "group_adherence", section: "adherence", level: "alert", text: `${Noun} did ${pct}% of planned sessions last week on average${under ? ` - ${plural(under, "athlete")} under 70%` : ""}.`, action: "Look at what changed for the whole group - fixtures, exams, holidays, travel or the session times - before chasing individuals." });
    else if (pct < 85) out.push({ id: "group_adherence", section: "adherence", level: "watch", text: `${Noun} did ${pct}% of planned sessions last week on average${under ? ` - ${plural(under, "athlete")} under 70%` : ""}.`, action: "Check in with the athletes under 70% first; if it's most of the group, look at the schedule." });
    else out.push({ id: "group_adherence", section: "adherence", level: "good", text: `${Noun} is training as planned: ${pct}% of planned sessions done last week on average.`, action: "Keep the plan and schedule as they are." });
  }
  const counted = Number(load.counted ?? 0);
  if (counted >= 2) {
    const high = Number(load.high);
    const low = Number(load.low);
    if (high >= 2 && high / counted >= 0.25) out.push({ id: "group_load_high", section: "load", level: high / counted >= 0.5 ? "alert" : "watch", text: `${plural(high, "athlete")} of ${counted} had a big jump in training load last week (over 1.3× their usual).`, action: "A jump across the group usually comes from the plan or the fixture list, not the athletes - ease the next week for everyone affected." });
    if (low >= 2 && low / counted >= 0.3) out.push({ id: "group_load_low", section: "load", level: "watch", text: `${plural(low, "athlete")} of ${counted} trained well below their usual load last week (under 0.8×).`, action: "If it wasn't a planned deload, taper or match week, find out why - illness going round, travel or motivation." });
  }
  const zCounted = Number(readiness.counted ?? 0);
  if (zCounted >= 2 && Number(readiness.low) >= 2 && Number(readiness.low) / zCounted >= 0.25) {
    out.push({ id: "group_readiness", section: "readiness", level: Number(readiness.low) / zCounted >= 0.4 ? "alert" : "watch", text: `${plural(Number(readiness.low), "athlete")} of ${zCounted} ${Number(readiness.low) === 1 ? "is" : "are"} well below their normal readiness.`, action: "When several dip together it's usually the schedule, exams or an illness going round - consider lightening the group's next session and asking how they are." });
  }
  if (pain && Number(pain.athletes_with_recurring_pain) > 0) {
    const n = Number(pain.athletes_with_recurring_pain);
    out.push({ id: "group_pain", section: "pain", level: n >= 3 ? "alert" : "watch", text: `${plural(n, "athlete")} ${n === 1 ? "has" : "have"} reported pain in the same area in 2 or more weeks.`, action: "Each athlete's own coach has the detail and handles their case. If several share it, check the exercises and loads the group has in common." });
  }
  if (Number(lifts.counted) >= 3) {
    const falling = Number(lifts.falling);
    const rising = Number(lifts.rising);
    if (falling / Number(lifts.counted) >= 0.25 && falling >= 2) out.push({ id: "group_lifts_falling", section: "strength", level: "watch", text: `${falling} of ${lifts.counted} main lifts across ${noun} are going backwards.`, action: "Several athletes losing strength at once points at accumulated fatigue - consider a lighter week for the group." });
    else if (rising / Number(lifts.counted) >= 0.5) out.push({ id: "group_lifts_rising", section: "strength", level: "good", text: `${rising} of ${lifts.counted} main lifts across ${noun} are rising.`, action: "The plan is working - keep progressing it." });
  }
  const availability = summary.availability as Json | undefined;
  if (availability && Number(availability.unavailable) + Number(availability.modified) > 0) {
    const out_ = Number(availability.unavailable);
    const modified = Number(availability.modified);
    out.push({ id: "group_availability", section: "pain", level: out_ > 0 ? "watch" : "info", text: `${[out_ ? `${plural(out_, "athlete")} unavailable` : "", modified ? `${plural(modified, "athlete")} on modified training` : ""].filter(Boolean).join(", ")} today.`, action: "Plan the week around who's available. Modified athletes follow their pain plan; unavailable ones return only when their stand-down ends." });
  }
  if (Number(status.no_training) > 0) {
    out.push({ id: "group_no_training", section: "adherence", level: "info", text: `${plural(Number(status.no_training), "athlete")} ${Number(status.no_training) === 1 ? "has" : "have"} no sessions logged in the last 8 weeks.`, action: "Check they have a programme and know how to log their sessions." });
  }
  if (trained === 0) out.push({ id: "group_empty", section: "adherence", level: "info", text: `No one in ${noun} has logged a session in the last 8 weeks yet.`, action: "Once athletes log sessions, the group's patterns show here." });
  const order = { alert: 0, watch: 1, info: 2, good: 3 };
  return out.sort((x, y) => order[x.level] - order[y.level]);
}

// The same numbers per position or per coach. Groups under minSize are
// withheld (a gym owner's per-coach view needs at least 3 athletes so no
// average points at one person).
export function summariseBy(rows: readonly Json[], keyOf: (row: Json) => string, labelOf: (key: string) => string, options: { includePain?: boolean; minSize?: number } = {}): Json[] {
  const groups = new Map<string, Json[]>();
  for (const row of rows) {
    const key = keyOf(row) || "unknown";
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()]
    .map(([key, members]) => {
      const summary = summariseGroup(members, options);
      const withheld = options.minSize !== undefined && Number(summary.trained) < options.minSize;
      return withheld
        ? { key, label: labelOf(key), athletes: members.length, withheld: true }
        : { key, label: labelOf(key), athletes: members.length, summary, findings: groupFindings(summary, "this group") };
    })
    .sort((a, b) => Number(b.athletes) - Number(a.athletes) || String(a.label).localeCompare(String(b.label)));
}

// The squad's test results side by side: per test, every athlete's latest,
// where they rank (percentile, best = 100), the squad and position-group
// averages, and the smallest worthwhile change - the squad's own (0.2 x the
// between-athlete SD) once 10 or more have the test, else the test's
// typical value.
export function squadTesting(rows: readonly Json[]): Json[] {
  const ids = [...new Set(rows.flatMap((row) => Object.keys(((row.tests_latest ?? {}) as Json))))];
  return ids.filter((id) => PERFORMANCE_TESTS[id]).map((testId) => {
    const definition = PERFORMANCE_TESTS[testId];
    const entries = rows
      .map((row) => ({ row, latest: (((row.tests_latest ?? {}) as Json)[testId] ?? null) as Json | null }))
      .filter((entry) => entry.latest && finite(entry.latest.value))
      .map((entry) => ({ athlete_user_id: entry.row.athlete_user_id, display_name: entry.row.display_name, position: entry.row.position ?? null, value: Number(entry.latest!.value), date: entry.latest!.date }));
    const values = entries.map((entry) => entry.value);
    const average = mean(values) ?? 0;
    const sd = values.length >= 2 ? Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1)) : null;
    const squadSwc = values.length >= 10 && sd !== null ? round(0.2 * sd, definition.decimals) : null;
    const betterThan = (a: number, b: number) => (definition.better === "higher" ? a > b : a < b);
    const percentile = (value: number) => (values.length > 1 ? round((values.filter((other) => betterThan(value, other)).length / (values.length - 1)) * 100) : null);
    const positions = [...new Set(entries.map((entry) => entry.position).filter(Boolean))].map((position) => {
      const mine = entries.filter((entry) => entry.position === position).map((entry) => entry.value);
      return { position, athletes: mine.length, average: round(mean(mine)!, definition.decimals) };
    });
    const best = entries.reduce<typeof entries[number] | null>((top, entry) => (!top || betterThan(entry.value, top.value) ? entry : top), null);
    return {
      test_id: testId, name: definition.name, unit: definition.unit, better: definition.better,
      athletes: entries.length, average: round(average, definition.decimals), sd: sd === null ? null : round(sd, definition.decimals + 1),
      swc: squadSwc ?? definition.swc, swc_source: squadSwc !== null ? "squad" : "typical",
      best: best ? { display_name: best.display_name, value: best.value } : null,
      positions,
      results: entries.map((entry) => ({ ...entry, percentile: percentile(entry.value), vs_position: (() => {
        const group = positions.find((p) => p.position === entry.position);
        return group && group.athletes > 1 ? round(entry.value - group.average, definition.decimals) : null;
      })() })).sort((a, b) => (betterThan(a.value, b.value) ? -1 : 1))
    };
  });
}

// A teammate's row for someone who isn't their coach (a fellow team coach,
// or the org owner): pain stays a flag, never the area or the detail.
export function withoutPainDetail(row: Json): Json {
  const areas = (((row.pain as Json | undefined)?.recurring_areas ?? []) as unknown[]).length;
  const findings = ((row.findings ?? []) as Json[]).filter((finding) => !String(finding.id).startsWith("pain_"));
  const availability = row.availability as Json | undefined;
  return {
    ...row,
    ...(availability ? { availability: { status: availability.status } } : {}),
    pain: { recurring: areas > 0 },
    findings: areas > 0
      ? [{ id: "pain_reported", section: "pain", level: "alert", text: "Recurring pain reported - the detail is with their coach.", action: "Their coach handles it; check with them before changing this athlete's training." }, ...findings]
      : findings
  };
}
