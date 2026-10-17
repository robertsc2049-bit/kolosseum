// DEV NOTE: Coach progress reports - the list of reports an athlete has
// (every week, programme block, training-cycle phase, programme and year
// they've trained in) and one report: that period's analysis
// (coach_analysis_service.ts) summed up and compared with the period of the
// same kind before it. Computed on request from the athlete's logged
// training, so a report is always "compiled" for every period that has
// ended, and the current one shows so far. Coach-only, like Analysis.
import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import { addDays, findings, weekStart } from "./coach_analysis_metrics.js";
import { analyseWindowForCoach } from "./coach_analysis_service.js";
import {
  REPORT_TYPES, athleteReport, compareReports, customPeriodFromId, cyclePeriods, previousCustomPeriod, programmePeriods, summariseReport, weekPeriods, weeksIn, yearPeriods,
  type ProgrammeHistory, type ReportPeriod, type ReportType
} from "./coach_report_periods.js";
import { requireCoachAthleteAccess } from "./beta19_coach_workspace_service.js";
import { loadExecutableCoachTemplateById, orderedTemplateSessions } from "./beta18_programme_template_service.js";
import { getCurrentProgrammeRun } from "./programme_catalogue_service.js";
import { getAthleteTrainingPlan } from "./athlete_onboarding_service.js";
import { macroPhaseFor } from "./training_cycle.js";
import { bodyweightHistory } from "./athlete_my_programme_service.js";
import { sendCoachAthleteMessage } from "./coach_athlete_messaging_service.js";

type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export class CoachReportNotFoundError extends Error {}
export class CoachReportInputError extends Error {}

// The programmes behind the athlete's trained sessions, oldest first: a
// coach's assignment or a Kolosseum programme run, with the block each
// session sat in (from the programme's own structure).
async function programmeHistory(athleteUserId: string): Promise<ProgrammeHistory[]> {
  const sessions = await pool.query(
    `SELECT created_at, beta_assignment_id,
            planned_session->'programme_run'->>'run_id' AS run_id,
            planned_session->'template_position'->>'template_session_index' AS template_session_index
     FROM sessions
     WHERE beta_subject_user_id = $1 AND status IN ('completed', 'partial')
       AND (beta_assignment_id IS NOT NULL OR planned_session->'programme_run'->>'run_id' IS NOT NULL)
     ORDER BY created_at ASC, session_id ASC`,
    [athleteUserId]
  );
  const groups = new Map<string, { kind: "assignment" | "run"; rows: Json[] }>();
  for (const row of sessions.rows) {
    const id = text(row.beta_assignment_id) || text(row.run_id);
    const group = groups.get(id) ?? { kind: text(row.beta_assignment_id) ? "assignment" as const : "run" as const, rows: [] };
    group.rows.push(row);
    groups.set(id, group);
  }
  if (!groups.size) return [];

  const ids = [...groups.keys()];
  const [assignments, runs, latestAssignment, currentRun] = await Promise.all([
    pool.query(
      `SELECT DISTINCT ON (record_payload->>'assignment_id') record_payload FROM beta_product_records
       WHERE record_type = 'beta17_assignment_trigger' AND subject_user_id = $1 AND record_payload->>'assignment_id' = ANY($2::text[])
       ORDER BY record_payload->>'assignment_id', effective_at DESC, created_at DESC`,
      [athleteUserId, ids]
    ),
    pool.query(
      `SELECT event_payload FROM product_account_events
       WHERE user_id = $1 AND event_type = 'athlete_programme_run_started' AND event_payload->>'run_id' = ANY($2::text[])`,
      [athleteUserId, ids]
    ),
    pool.query(
      `SELECT record_payload FROM beta_product_records
       WHERE record_type = 'beta17_assignment_trigger' AND subject_user_id = $1
       ORDER BY effective_at DESC, created_at DESC, record_id DESC LIMIT 1`,
      [athleteUserId]
    ),
    getCurrentProgrammeRun(athleteUserId).catch(() => null)
  ]);
  const owner = new Map<string, { owner: string; template: string; title?: string }>();
  for (const row of assignments.rows) {
    const payload = isRecord(row.record_payload) ? row.record_payload : {};
    owner.set(text(payload.assignment_id), { owner: text(payload.assigned_by_coach_id), template: text(payload.template_id) });
  }
  for (const row of runs.rows) {
    const payload = isRecord(row.event_payload) ? row.event_payload : {};
    owner.set(text(payload.run_id), { owner: text(payload.author_user_id), template: text(payload.template_id), title: text(payload.title) });
  }
  const latest = isRecord(latestAssignment.rows[0]?.record_payload) ? latestAssignment.rows[0].record_payload : null;
  const currentId = latest && (text(latest.assignment_status) || "assigned") === "assigned" ? text(latest.assignment_id) : currentRun?.run_id ?? "";

  const out: ProgrammeHistory[] = [];
  for (const [id, group] of groups) {
    const source = owner.get(id);
    const template = source ? await loadExecutableCoachTemplateById(source.owner, source.template).catch(() => null) : null;
    const ordered = template ? orderedTemplateSessions(template) : [];
    out.push({
      id,
      name: text(template?.template_name) || source?.title || (group.kind === "run" ? "Kolosseum programme" : "Coach's programme"),
      current: id === currentId,
      sessions: group.rows.map((row, position) => {
        const index = /^\d+$/u.test(String(row.template_session_index ?? "")) ? Number(row.template_session_index) : position;
        const slot = ordered[index];
        const blockName = text(slot?.template_block_name);
        return {
          date: new Date(String(row.created_at)).toISOString().slice(0, 10),
          block_key: slot ? `${text(slot.template_block_id)}|${String(slot.template_block_order ?? "")}` : "programme",
          block_name: blockName || "Block",
          ...(text(slot?.template_block_type) ? { block_type: text(slot?.template_block_type) } : {})
        };
      })
    });
  }
  return out;
}

async function firstSessionDate(athleteUserId: string): Promise<string | null> {
  const result = await pool.query(
    `SELECT MIN(created_at) AS first FROM sessions WHERE beta_subject_user_id = $1 AND status IN ('completed', 'partial')`,
    [athleteUserId]
  );
  const first = result.rows[0]?.first;
  return first ? new Date(first).toISOString().slice(0, 10) : null;
}

async function allPeriods(athleteUserId: string, today: string): Promise<ReportPeriod[]> {
  const [first, programmes, plan] = await Promise.all([
    firstSessionDate(athleteUserId),
    programmeHistory(athleteUserId),
    getAthleteTrainingPlan(athleteUserId).catch(() => null)
  ]);
  // Training-cycle phases come from the athlete's training plan (its season
  // or competition dates) as it stands now.
  const phaseOfWeek = (monday: string) => {
    if (!plan) return null;
    try { return macroPhaseFor(plan as Parameters<typeof macroPhaseFor>[0], new Date(`${addDays(monday, 3)}T00:00:00Z`)); }
    catch { return null; }
  };
  return [
    ...weekPeriods(first, today),
    ...programmePeriods(programmes, today),
    ...cyclePeriods(first, today, phaseOfWeek),
    ...yearPeriods(first, today)
  ];
}

const newestFirst = (a: ReportPeriod, b: ReportPeriod) => b.start.localeCompare(a.start) || b.end.localeCompare(a.end);

export async function listCoachReports(coachUserId: string, athleteUserId: string, today = new Date().toISOString().slice(0, 10)): Promise<Json> {
  await requireCoachAthleteAccess(coachUserId, athleteUserId);
  const periods = await allPeriods(athleteUserId, today);
  const byType = Object.fromEntries(REPORT_TYPES.map((type) => [type, periods.filter((period) => period.type === type).sort(newestFirst)]));
  return { ok: true, today, reports: byType };
}

// The analysis window for a period: up to its last day (or today, for one
// still going), its weeks closed when it has ended; a custom period counts
// only the days between its dates.
async function periodSummary(coachUserId: string, athleteUserId: string, period: ReportPeriod, today: string) {
  const lastDay = period.to ?? period.end;
  const ended = lastDay < today;
  const asOf = ended ? lastDay : today;
  const weeks = Math.max(1, Math.round((Date.parse(weekStart(asOf)) - Date.parse(period.start)) / (7 * 86_400_000)) + 1);
  const result = await analyseWindowForCoach(coachUserId, athleteUserId, weeks, asOf, {
    closed: ended,
    ...(period.from ? { from: period.from } : {}),
    ...(period.to ? { to: period.to } : {})
  });
  return { analysis: result.analysis as Json, summary: summariseReport(result.analysis as Json) };
}

async function displayName(userId: string): Promise<string> {
  const result = await pool.query("SELECT display_name FROM product_accounts WHERE user_id = $1", [userId]).catch(() => null);
  return text(result?.rows?.[0]?.display_name);
}

// The bodyweights the coach recorded during the period (and the last one
// before it, as the starting point).
async function bodyweightDuring(coachUserId: string, athleteUserId: string, period: ReportPeriod): Promise<Json[]> {
  const history = await bodyweightHistory(coachUserId, athleteUserId).catch(() => [] as Json[]);
  const from = period.from ?? period.start;
  const to = period.to ?? period.end;
  const before = history.filter((entry) => text(entry.date) && text(entry.date) < from).slice(-1);
  return [...before, ...history.filter((entry) => text(entry.date) >= from && text(entry.date) <= to)];
}

// Which period a type and id name, and the one before it of the same kind.
async function resolvePeriod(athleteUserId: string, type: string, id: string, today: string): Promise<{ period: ReportPeriod; previous: ReportPeriod | null }> {
  if (type === "custom") {
    const period = customPeriodFromId(id, today);
    if (!period) throw new CoachReportNotFoundError("report_custom_dates_invalid");
    return { period, previous: previousCustomPeriod(period, today) };
  }
  if (!(REPORT_TYPES as readonly string[]).includes(type)) throw new CoachReportNotFoundError("report_type_unknown");
  const periods = (await allPeriods(athleteUserId, today)).filter((period) => period.type === (type as ReportType)).sort(newestFirst);
  const index = periods.findIndex((period) => period.id === id);
  if (index < 0) throw new CoachReportNotFoundError("report_not_found");
  return { period: periods[index], previous: periods[index + 1] ?? null };
}

async function compileReport(coachUserId: string, athleteUserId: string, type: string, id: string, today: string) {
  await requireCoachAthleteAccess(coachUserId, athleteUserId);
  const { period, previous } = await resolvePeriod(athleteUserId, type, id, today);
  const [current, before, bodyweight, name] = await Promise.all([
    periodSummary(coachUserId, athleteUserId, period, today),
    previous ? periodSummary(coachUserId, athleteUserId, previous, today) : Promise.resolve(null),
    bodyweightDuring(coachUserId, athleteUserId, period),
    displayName(athleteUserId)
  ]);
  return { period, previous, current, before, bodyweight, name };
}

export async function loadCoachReport(coachUserId: string, athleteUserId: string, type: string, id: string, today = new Date().toISOString().slice(0, 10)): Promise<Json> {
  const { period, previous, current, before, bodyweight, name } = await compileReport(coachUserId, athleteUserId, type, id, today);
  return {
    ok: true,
    athlete: { user_id: athleteUserId, display_name: name },
    period: { ...period, weeks: weeksIn(period) },
    previous: previous ? { type: previous.type, id: previous.id, label: previous.label, start: previous.from ?? previous.start, end: previous.to ?? previous.end } : null,
    findings: findings(current.analysis),
    summary: { ...current.summary, bodyweight },
    compared: compareReports(current.summary, before?.summary ?? null),
    analysis: current.analysis
  };
}

// ---------- the athlete's copy ----------
const SENT_EVENT = "coach_progress_report_sent";
export const REPORT_MESSAGE_MAX = 2000;

// What the athlete would get - shown to the coach before sending.
export async function previewAthleteReport(coachUserId: string, athleteUserId: string, type: string, id: string, today = new Date().toISOString().slice(0, 10)): Promise<Json> {
  const { period, current } = await compileReport(coachUserId, athleteUserId, type, id, today);
  return { ok: true, report: athleteReport(period, current.summary, current.analysis, { name: await displayName(coachUserId), message: "" }) };
}

// Send the athlete their copy, with the coach's message: kept on the
// athlete's account (History > Reports from your coach) and announced in
// their messages with the coach. A repeat of the same client_request_id
// sends nothing new.
export async function sendAthleteReport(coachUserId: string, athleteUserId: string, type: string, id: string, body: unknown, today = new Date().toISOString().slice(0, 10)): Promise<Json> {
  const input = isRecord(body) ? body : {};
  const message = text(input.message);
  if (message.length > REPORT_MESSAGE_MAX) throw new CoachReportInputError("report_message_too_long");
  const clientRequestId = text(input.client_request_id);
  if (!/^[A-Za-z0-9_-]{8,80}$/u.test(clientRequestId)) throw new CoachReportInputError("report_client_request_id_invalid");

  const { period, current } = await compileReport(coachUserId, athleteUserId, type, id, today);
  const coachName = await displayName(coachUserId);
  const report = athleteReport(period, current.summary, current.analysis, { name: coachName, message });
  const reportId = `cpr_${crypto.createHash("sha256").update(`${coachUserId}|${athleteUserId}|${clientRequestId}`).digest("hex").slice(0, 32)}`;
  const sentAt = new Date().toISOString();
  const inserted = await pool.query(
    `INSERT INTO product_account_events (event_id, user_id, event_type, event_payload) VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (event_id) DO NOTHING`,
    [reportId, athleteUserId, SENT_EVENT, JSON.stringify({ report_id: reportId, coach_user_id: coachUserId, sent_at: sentAt, report })]
  );
  if (inserted.rowCount) {
    const note = `Your progress report is ready: ${period.label}.${message ? `\n\n${message}` : ""}\n\nOpen it in History > Reports from your coach.`;
    await sendCoachAthleteMessage("coach", coachUserId, athleteUserId, note, `report_${reportId}`).catch(() => null);
  }
  return { ok: true, report_id: reportId, sent: inserted.rowCount === 1 };
}

// The reports the athlete's coaches have sent them, newest first.
export async function listAthleteReports(athleteUserId: string): Promise<Json> {
  const result = await pool.query(
    `SELECT event_payload, occurred_at FROM product_account_events WHERE user_id = $1 AND event_type = $2 ORDER BY occurred_at DESC, event_id DESC LIMIT 200`,
    [athleteUserId, SENT_EVENT]
  );
  return {
    ok: true,
    reports: result.rows.filter((row) => isRecord(row.event_payload)).map((row) => ({
      report_id: text(row.event_payload.report_id),
      sent_at: text(row.event_payload.sent_at) || new Date(String(row.occurred_at)).toISOString(),
      report: row.event_payload.report
    }))
  };
}
