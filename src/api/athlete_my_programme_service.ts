// "My programme": the athlete's whole current programme - the one their
// coach assigned, else the Kolosseum programme they're running - laid out
// block > week > session with every exercise's dose, which sessions are
// done, and where they are now. Read-only: it never creates or changes a
// session (Today and the session screen do that), and the order is the
// server's own (orderedTemplateSessions), so "session 7" here is session 7
// when it's created.
import { pool } from "../db/pool.js";
import { orderedTemplateSessions, loadExecutableCoachTemplateById } from "./beta18_programme_template_service.js";
import { loadAthleteStrengthProfile, resolvePercentageLoad } from "./beta19_coach_workspace_service.js";
import { getCurrentProgrammeRun } from "./programme_catalogue_service.js";
import { getAthleteCustomExerciseNames, sessionExerciseDisplayNames } from "./athlete_onboarding_service.js";

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
    ? `${num(prescription.minimum)}-${num(prescription.maximum)}${suffix}`
    : num(prescription.value) === null ? "" : `${num(prescription.value)}${suffix}`;
}

function dose(item: Json, profile: Json | null): Json {
  const mode = text(item.prescription_mode) || "reps";
  const distance = isRecord(item.distance_prescription) ? item.distance_prescription : {};
  const reps = mode === "duration"
    ? range(item.duration_prescription, "s")
    : mode === "distance"
      ? range(distance, text(distance.unit) === "feet" ? "ft" : "m")
      : range(item.rep_prescription, "") || String(num(item.planned_reps) ?? "");
  const loading = isRecord(item.loading_reference) ? item.loading_reference : {};
  const value = num(loading.value);
  let load = "";
  if (loading.type === "percent_1rm" && value !== null) {
    const resolved = profile ? resolvePercentageLoad(profile, text(item.exercise_id), value) : null;
    load = resolved && num(resolved.value) !== null ? `${num(resolved.value)} ${text(resolved.unit) || "kg"}` : "";
  }
  else if (loading.type === "load" && value !== null) load = `${value} ${text(loading.unit) || "kg"}`;
  else if (loading.type === "rpe" && value !== null) load = `RPE ${value}`;
  else if (loading.type === "borg" && value !== null) load = `Effort ${value}/20`;
  else if (loading.type === "cr10" && value !== null) load = `Effort ${value}/10`;
  return { sets: num(item.planned_sets) ?? 1, reps, load, rest_seconds: num(item.rest_seconds), notes: text(item.coaching_notes) };
}

export async function loadAthleteMyProgramme(athleteUserId: string): Promise<Readonly<Json>> {
  const assignment = await currentAssignment(athleteUserId);
  const run = assignment ? null : await getCurrentProgrammeRun(athleteUserId);
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
  const names = sessionExerciseDisplayNames(ids, await getAthleteCustomExerciseNames(athleteUserId).catch(() => ({})));

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
      exercises: (Array.isArray(session.work_items) ? session.work_items : []).filter(isRecord).map((item) => ({
        exercise_id: text(item.exercise_id),
        name: names[text(item.exercise_id)] ?? text(item.exercise_id),
        segment: ["warm_up", "cool_down"].includes(text(item.segment)) ? text(item.segment) : "working",
        ...dose(item, profile)
      }))
    });
  });

  const currentSession = ordered[Math.min(current, ordered.length - 1)];
  return {
    ok: true,
    status: current >= ordered.length ? "complete" : "active",
    source: assignment ? "coach" : "kolosseum",
    programme: { name: text(template.template_name), activity_id: text(template.activity_id), total_sessions: ordered.length },
    current: {
      session_index: Math.min(current, ordered.length - 1),
      week_number: currentWeek,
      block_name: text(currentSession?.template_block_name)
    },
    completed_sessions: [...done.values()].filter((record) => ["completed", "partial"].includes(text(record.status))).length,
    blocks: blocks.map(({ key: _key, ...block }) => ({ ...block, weeks: (block.weeks as Json[]).map(({ key: _week, ...week }) => week) }))
  };
}
