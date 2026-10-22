// "My programme": the athlete's whole current programme - the one their
// coach assigned, else the Kolosseum programme they're running - laid out
// block > week > session with every exercise's dose, which sessions are
// done, and where they are now. Read-only: it never creates or changes a
// session (Today and the session screen do that), and the order is the
// server's own (orderedTemplateSessions), so "session 7" here is session 7
// when it's created.
import { pool } from "../db/pool.js";
import { orderedTemplateSessions, loadExecutableCoachTemplateById } from "./beta18_programme_template_service.js";
import { loadAthleteStrengthProfile, requireCoachAthleteAccess, resolvePercentageLoad } from "./beta19_coach_workspace_service.js";
import { getCurrentProgrammeRun } from "./programme_catalogue_service.js";
import { getAthleteCustomExerciseNames, getAthleteTrainingPlan, sessionExerciseDisplayNames } from "./athlete_onboarding_service.js";
import { loadTodayEventStatus } from "./athlete_today_service.js";
import { getWeightClass } from "./weight_class_service.js";
import type { PlannedWeek } from "./forward_load.js";
import { loadProgrammeOverrides } from "./athlete_programme_override_service.js";

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

async function currentAssignment(athleteUserId: string): Promise<Json | null> {
  const result = await pool.query(
    `SELECT record_payload FROM beta_product_records
     WHERE record_type = 'beta17_assignment_trigger' AND subject_user_id = $1
     ORDER BY effective_at DESC, created_at DESC, record_id DESC, record_sha256 DESC
     LIMIT 1`,
    [athleteUserId]
  );
  const latest = result.rows[0]?.record_payload;
  if (!isRecord(latest)) return null;
  return (text(latest.assignment_status) || "assigned") === "assigned" ? latest : null;
}

// Template session index -> the athlete's session for it (the latest one).
async function sessionsByIndex(trackingId: string): Promise<Map<number, Json>> {
  const result = await pool.query(
    `SELECT session_id, status, created_at, updated_at,
            planned_session->'template_position'->>'template_session_index' AS template_session_index
     FROM sessions
     WHERE beta_assignment_id = $1 OR planned_session->'programme_run'->>'run_id' = $1
     ORDER BY created_at ASC, session_id ASC`,
    [trackingId]
  );
  const byIndex = new Map<number, Json>();
  result.rows.forEach((row, position) => {
    const stamped = /^\d+$/u.test(String(row.template_session_index ?? "")) ? Number(row.template_session_index) : position;
    byIndex.set(stamped, { session_id: String(row.session_id), status: String(row.status), date: new Date(row.updated_at ?? row.created_at).toISOString() });
  });
  return byIndex;
}

// A stored item's dose in plain words: "5" / "8-10" / "30s" / "400 m", and
// the load as the weight to lift (from the athlete's max) or an RPE. Never
// the % of max behind a weight: that is the coach's programme design, and
// athletes are not shown it (nor encouraged to copy the programme).
function range(prescription: unknown, unit: string): string {
  if (!isRecord(prescription)) return "";
  const suffix = unit === "s" ? "s" : unit ? ` ${unit}` : "";
  return prescription.type === "range"
    ? `${num(prescription.minimum)}–${num(prescription.maximum)}${suffix}`
    : num(prescription.value) === null ? "" : `${num(prescription.value)}${suffix}`;
}

function dose(item: Json, profile: Json | null): Json & { percent: number | null; percent_max: number | null } {
  const mode = text(item.prescription_mode) || "reps";
  const distance = isRecord(item.distance_prescription) ? item.distance_prescription : {};
  const reps = mode === "duration"
    ? range(item.duration_prescription, "s")
    : mode === "distance"
      ? range(distance, text(distance.unit) === "feet" ? "ft" : "m")
      : range(item.rep_prescription, "") || String(num(item.planned_reps) ?? "");
  const loading = isRecord(item.loading_reference) ? item.loading_reference : {};
  const value = num(loading.value);
  const top = num(loading.maximum);
  const maximum = top !== null && value !== null && top > value ? top : null;
  let load = "";
  if (loading.type === "percent_1rm" && value !== null) {
    const resolved = profile ? resolvePercentageLoad(profile, text(item.exercise_id), value) : null;
    const resolvedTop = profile && maximum !== null ? resolvePercentageLoad(profile, text(item.exercise_id), maximum) : null;
    const unit = text(resolved?.unit) || "kg";
    load = resolved && num(resolved.value) !== null
      ? resolvedTop && num(resolvedTop.value)! > num(resolved.value)! ? `${num(resolved.value)}–${num(resolvedTop.value)} ${unit}` : `${num(resolved.value)} ${unit}`
      : "";
  }
  else if (loading.type === "load" && value !== null) load = maximum !== null ? `${value}–${maximum} ${text(loading.unit) || "kg"}` : `${value} ${text(loading.unit) || "kg"}`;
  else if (loading.type === "bodyweight" && text(item.segment) !== "warm_up" && text(item.segment) !== "cool_down") load = "Bodyweight";
  else if (loading.type === "rpe" && value !== null) load = `RPE ${value}`;
  else if (loading.type === "borg" && value !== null) load = `Effort ${value}/20`;
  else if (loading.type === "cr10" && value !== null) load = `Effort ${value}/10`;
  const setRange = isRecord(item.set_prescription) && item.set_prescription.type === "range" ? num(item.set_prescription.maximum) : null;
  const sets = num(item.planned_sets) ?? 1;
  return {
    sets,
    ...(setRange !== null && setRange > sets ? { sets_max: setRange } : {}),
    reps,
    load,
    rest_seconds: num(item.rest_seconds),
    notes: text(item.coaching_notes),
    percent: loading.type === "percent_1rm" ? value : null,
    percent_max: loading.type === "percent_1rm" ? maximum : null
  };
}

async function displayName(userId: string): Promise<string> {
  if (!userId) return "";
  const result = await pool.query("SELECT display_name FROM product_accounts WHERE user_id = $1", [userId]).catch(() => null);
  return text(result?.rows?.[0]?.display_name);
}

const BASIS_LABEL: Record<string, string> = { tested_1rm: "Tested 1RM", estimated_1rm: "Estimated 1RM", training_max: "Training max" };

// Every bodyweight the coach has recorded, oldest first, one line per change.
export async function bodyweightHistory(coachUserId: string, athleteUserId: string): Promise<Json[]> {
  const result = await pool.query(
    `SELECT record_payload FROM beta_product_records
     WHERE record_type = 'beta19_athlete_strength_profile' AND actor_user_id = $1 AND subject_user_id = $2
     ORDER BY created_at ASC, record_id ASC`,
    [coachUserId, athleteUserId]
  );
  const history: Json[] = [];
  for (const row of result.rows) {
    const payload = isRecord(row.record_payload) ? row.record_payload : {};
    const value = num(payload.bodyweight);
    if (value === null) continue;
    const last = history[history.length - 1];
    if (last && last.value === value) continue;
    history.push({ value, unit: text(payload.bodyweight_unit) || "kg", date: text(payload.updated_at_iso8601).slice(0, 10) || null });
  }
  return history;
}

type Viewer = "athlete" | "coach";

// The programme laid out block > week > session, plus a cover: who it is
// for, who wrote it, when it started, the competition it builds to, the
// athlete's bodyweight and weight class, and the coach's notes. The coach's
// copy (viewer "coach") also keeps the % of max behind every weight and adds
// the maxes and bodyweight history; the athlete's never has either.
async function buildProgramme(athleteUserId: string, viewer: Viewer, assignment: Json | null, run: Awaited<ReturnType<typeof getCurrentProgrammeRun>>): Promise<Readonly<Json>> {
  if (!assignment && !run) return { ok: true, status: "none" };

  const ownerId = assignment ? text(assignment.assigned_by_coach_id) : run!.author_user_id;
  const templateId = assignment ? text(assignment.template_id) : run!.template_id;
  const template = await loadExecutableCoachTemplateById(ownerId, templateId);
  if (!template) return { ok: true, status: "unavailable" };

  const ordered = orderedTemplateSessions(template);
  const done = await sessionsByIndex(assignment ? text(assignment.assignment_id) : run!.run_id);
  // A coach's programme gives a weight from the maxes the coach recorded;
  // a Kolosseum programme's athlete sets their own loads on the day.
  const profile = assignment ? await loadAthleteStrengthProfile(ownerId, athleteUserId).catch(() => null) : null;
  const ids = [...new Set(ordered.flatMap((session) => (Array.isArray(session.work_items) ? session.work_items : []).map((item) => text(isRecord(item) ? item.exercise_id : ""))))];
  const custom = await getAthleteCustomExerciseNames(athleteUserId).catch(() => ({}));
  const names = sessionExerciseDisplayNames(ids, custom);

  // Where they are: the open session if there is one, else the one after
  // the furthest they've reached (weeks skipped for a competition stay
  // behind them, marked as skipped).
  const indexes = [...done.keys()];
  const open = indexes.filter((index) => ["created", "in_progress"].includes(text(done.get(index)?.status))).sort((a, b) => b - a)[0];
  const furthest = indexes.length ? Math.max(...indexes) : -1;
  const current = open ?? Math.min(furthest + 1, ordered.length);

  const blocks: Json[] = [];
  let weekCount = 0;
  let currentWeek = 1;
  ordered.forEach((session, index) => {
    const blockKey = `${text(session.template_block_id)}|${num(session.template_block_order)}`;
    let block = blocks.find((entry) => entry.key === blockKey);
    if (!block) {
      block = { key: blockKey, name: text(session.template_block_name) || `Block ${blocks.length + 1}`, block_type: text(session.template_block_type) || "general", weeks: [] };
      blocks.push(block);
    }
    const weeks = block.weeks as Json[];
    const weekKey = `${blockKey}|${text(session.template_week_id)}|${num(session.template_week_order)}`;
    let week = weeks.find((entry) => entry.key === weekKey);
    if (!week) {
      week = { key: weekKey, week_number: ++weekCount, sessions: [] };
      weeks.push(week);
    }
    if (index === Math.min(current, ordered.length - 1)) currentWeek = week.week_number as number;
    const record = done.get(index);
    const status = text(record?.status);
    const state = status === "completed" ? "done" : status === "partial" ? "partial" : index === current ? "current" : index < current ? "skipped" : "upcoming";
    (week.sessions as Json[]).push({
      session_index: index,
      title: text(session.title) || `Session ${index + 1}`,
      state,
      date: record?.date ?? null,
      exercises: (Array.isArray(session.work_items) ? session.work_items : []).filter(isRecord).map((item) => {
        const { percent, percent_max: percentMax, ...prescribed } = dose(item, profile);
        return {
          exercise_id: text(item.exercise_id),
          name: names[text(item.exercise_id)] ?? text(item.exercise_id),
          segment: ["warm_up", "cool_down"].includes(text(item.segment)) ? text(item.segment) : "working",
          ...prescribed,
          ...(viewer === "coach" ? { percent, percent_max: percentMax } : {})
        };
      })
    });
  });

  // The cover.
  const plan = await getAthleteTrainingPlan(athleteUserId).catch(() => null);
  const event = assignment ? await loadTodayEventStatus(ownerId, athleteUserId, text(assignment.assignment_id)).catch(() => null) : null;
  const weightClass = await getWeightClass(athleteUserId).catch(() => null);
  const bodyweight = num(profile?.bodyweight);
  const competitionDate = text(event?.event_date) || text(plan?.competition_date);
  const cover: Json = {
    athlete_name: await displayName(athleteUserId),
    coach_name: assignment ? await displayName(ownerId) : "",
    description: text(template.description),
    started_on: (assignment ? text(assignment.requested_at_iso8601) : text(run!.started_at)).slice(0, 10) || null,
    competition: competitionDate ? { name: text(event?.event_name) || "Competition", date: competitionDate } : null,
    bodyweight: bodyweight !== null ? { value: bodyweight, unit: text(profile?.bodyweight_unit) || "kg", as_of: text(profile?.updated_at_iso8601).slice(0, 10) || null } : null,
    weight_class_kg: weightClass?.competes_at_weight_class && num(weightClass.weight_class_kg) !== null ? num(weightClass.weight_class_kg) : null
  };
  if (viewer === "coach") {
    const benchmarks = Array.isArray(profile?.benchmarks) ? (profile!.benchmarks as unknown[]).filter(isRecord) : [];
    const maxNames = sessionExerciseDisplayNames(benchmarks.map((benchmark) => text(benchmark.exercise_id)), custom);
    cover.maxes = benchmarks.map((benchmark) => ({
      exercise_id: text(benchmark.exercise_id),
      name: maxNames[text(benchmark.exercise_id)] ?? text(benchmark.exercise_id),
      value: num(benchmark.value),
      unit: text(benchmark.unit) || "kg",
      basis: BASIS_LABEL[text(benchmark.basis)] ?? "Max",
      date: text(benchmark.effective_date) || null
    }));
    cover.bodyweight_history = assignment ? await bodyweightHistory(ownerId, athleteUserId).catch(() => []) : [];
  }

  const currentSession = ordered[Math.min(current, ordered.length - 1)];
  return {
    ok: true,
    status: current >= ordered.length ? "complete" : "active",
    source: assignment ? "coach" : "kolosseum",
    viewer,
    programme: { name: text(template.template_name), activity_id: text(template.activity_id), total_sessions: ordered.length },
    current: {
      session_index: Math.min(current, ordered.length - 1),
      week_number: currentWeek,
      block_name: text(currentSession?.template_block_name)
    },
    completed_sessions: [...done.values()].filter((record) => ["completed", "partial"].includes(text(record.status))).length,
    cover,
    blocks: blocks.map(({ key: _key, ...block }) => ({ ...block, weeks: (block.weeks as Json[]).map(({ key: _week, ...week }) => week) }))
  };
}

export async function loadAthleteMyProgramme(athleteUserId: string): Promise<Readonly<Json>> {
  const assignment = await currentAssignment(athleteUserId);
  const run = assignment ? null : await getCurrentProgrammeRun(athleteUserId);
  return buildProgramme(athleteUserId, "athlete", assignment, run);
}

// The coach's printable copy of the programme they assigned this athlete.
// Only for the coach who assigned it (and who still coaches the athlete).
export async function loadCoachAthleteProgramme(coachUserId: string, athleteUserId: string): Promise<Readonly<Json>> {
  await requireCoachAthleteAccess(coachUserId, athleteUserId);
  const assignment = await currentAssignment(athleteUserId);
  if (!assignment || text(assignment.assigned_by_coach_id) !== coachUserId) return { ok: true, status: "none" };
  const programme = await buildProgramme(athleteUserId, "coach", assignment, null);
  // This athlete's own changes to the programme, beside each exercise.
  const overrides = await loadProgrammeOverrides(athleteUserId, text(assignment.assignment_id)).catch(() => []);
  if (!overrides.length || !Array.isArray(programme.blocks)) return programme;
  const withOverrides = (programme.blocks as Json[]).map((block) => ({
    ...block,
    weeks: (block.weeks as Json[]).map((week) => ({
      ...week,
      sessions: (week.sessions as Json[]).map((session) => ({
        ...session,
        exercises: (session.exercises as Json[]).map((exercise) => {
          const override = overrides.find((entry) => entry.session_index === session.session_index && entry.exercise_id === exercise.exercise_id);
          return override ? { ...exercise, override } : exercise;
        })
      }))
    }))
  }));
  return { ...programme, blocks: withOverrides };
}

// The programme's weeks still to come, as numbers for the coach's Analysis
// (forward_load.ts): from the current week on, each week's sessions left,
// working sets, tonnage from the weights the plan gives (from the coach's
// maxes, or fixed loads), sets at 80%+ / 90%+ of max and the average target
// RPE. Coach-side only.
const LB_PER_KG = 2.2046226218;
const toKg = (value: number, unit: string) => (unit === "lb" ? value / LB_PER_KG : value);
function repsOf(item: Json): number | null {
  if ((text(item.prescription_mode) || "reps") !== "reps") return null;
  const prescription = isRecord(item.rep_prescription) ? item.rep_prescription : {};
  if (prescription.type === "range" && num(prescription.minimum) !== null && num(prescription.maximum) !== null) return (num(prescription.minimum)! + num(prescription.maximum)!) / 2;
  return num(prescription.value) ?? num(item.planned_reps);
}
export async function plannedWeeksAhead(athleteUserId: string, weeksAhead = 4): Promise<PlannedWeek[]> {
  const assignment = await currentAssignment(athleteUserId);
  const run = assignment ? null : await getCurrentProgrammeRun(athleteUserId);
  if (!assignment && !run) return [];
  const ownerId = assignment ? text(assignment.assigned_by_coach_id) : run!.author_user_id;
  const template = await loadExecutableCoachTemplateById(ownerId, assignment ? text(assignment.template_id) : run!.template_id);
  if (!template) return [];
  const ordered = orderedTemplateSessions(template);
  const done = await sessionsByIndex(assignment ? text(assignment.assignment_id) : run!.run_id);
  const indexes = [...done.keys()];
  const open = indexes.filter((index) => ["created", "in_progress"].includes(text(done.get(index)?.status))).sort((a, b) => b - a)[0];
  const current = open ?? Math.min((indexes.length ? Math.max(...indexes) : -1) + 1, ordered.length);
  if (current >= ordered.length) return [];
  const profile = assignment ? await loadAthleteStrengthProfile(ownerId, athleteUserId).catch(() => null) : null;

  const weeks: Array<{ -readonly [K in keyof PlannedWeek]: PlannedWeek[K] } & { key: string; rpe: number[] }> = [];
  let weekNumber = 0;
  let lastKey = "";
  ordered.forEach((session, index) => {
    const key = `${text(session.template_block_id)}|${num(session.template_block_order)}|${text(session.template_week_id)}|${num(session.template_week_order)}`;
    if (key !== lastKey) { weekNumber += 1; lastKey = key; }
    if (index < current) return;
    let week = weeks.find((entry) => entry.key === key);
    if (!week) {
      if (weeks.length >= weeksAhead) return;
      week = { key, week_number: weekNumber, block_name: text(session.template_block_name) || "Block", block_type: text(session.template_block_type) || "general", current: weeks.length === 0, sessions: 0, working_sets: 0, tonnage_kg: null, sets_80: 0, sets_90: 0, avg_rpe: null, rpe: [] };
      weeks.push(week);
    }
    week.sessions += 1;
    for (const item of (Array.isArray(session.work_items) ? session.work_items : []).filter(isRecord)) {
      if (["warm_up", "cool_down"].includes(text(item.segment))) continue;
      const sets = num(item.planned_sets) ?? 1;
      week.working_sets += sets;
      const loading = isRecord(item.loading_reference) ? item.loading_reference : {};
      const value = num(loading.value);
      const reps = repsOf(item);
      let kg: number | null = null;
      if (loading.type === "percent_1rm" && value !== null) {
        if (value >= 80) week.sets_80 += sets;
        if (value >= 90) week.sets_90 += sets;
        const resolved = profile ? resolvePercentageLoad(profile, text(item.exercise_id), value) : null;
        if (resolved && num(resolved.value) !== null) kg = toKg(num(resolved.value)!, text(resolved.unit) || "kg");
      }
      else if (loading.type === "load" && value !== null) kg = toKg(value, text(loading.unit) || "kg");
      else if (loading.type === "rpe" && value !== null) week.rpe.push(value);
      if (kg !== null && reps !== null) week.tonnage_kg = Math.round((week.tonnage_kg ?? 0) + sets * reps * kg);
    }
  });
  return weeks.map(({ key: _key, rpe, ...week }) => ({ ...week, avg_rpe: rpe.length ? Math.round((rpe.reduce((sum, value) => sum + value, 0) / rpe.length) * 10) / 10 : null }));
}
