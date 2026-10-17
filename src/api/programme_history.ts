// DEV NOTE: The programmes behind an athlete's trained sessions - a coach's
// assignment or a Kolosseum programme run - with the block each session sat
// in (name and type, from the programme's own structure). Read-only; used
// by progress reports (block and programme periods) and by Analysis (deload
// and peak markers on the charts). Callers check access first.
import { pool } from "../db/pool.js";
import { loadExecutableCoachTemplateById, orderedTemplateSessions } from "./beta18_programme_template_service.js";
import { getCurrentProgrammeRun } from "./programme_catalogue_service.js";
import type { ProgrammeHistory } from "./coach_report_periods.js";

type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

// The programmes behind the athlete's trained sessions, oldest first: a
// coach's assignment or a Kolosseum programme run, with the block each
// session sat in (from the programme's own structure).
export async function programmeHistory(athleteUserId: string): Promise<ProgrammeHistory[]> {
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

