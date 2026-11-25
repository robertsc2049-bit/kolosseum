// Block-complete awards (block_award_rule.ts): one for each block of a
// coach's programme, or a Kolosseum programme, the athlete has finished.
// Worked out from the sessions they trained and kept as the athlete's own
// account event the first time it's seen, so it stays theirs if the
// programme is later changed, replaced or removed (it's in their data export
// and goes with their account). Self-coached weeks have no blocks.
import { pool } from "../db/pool.js";
import { assignmentPositionIds, loadExecutableCoachTemplateById, orderedTemplateSessions } from "./beta18_programme_template_service.js";
import { type AwardSlot, finishedBlocks } from "./block_award_rule.js";
import { coachBusinessName, coachNameWithBusiness } from "./coach_branding_service.js";
import { getSessionStateQuery } from "./session_state_query_service.js";

type Json = Record<string, unknown>;
type DoneSession = { session_id: string; finished_at: string };
type Programme = { id: string; owner: string; template: string; kind: "coach" | "kolosseum" };

const AWARD_EVENT = "block_award_earned";
const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const payloadOf = (value: unknown): Json => (isRecord(value) ? value : {});

// Nothing for an account that has been erased.
async function displayName(userId: string): Promise<string> {
  const result = await pool.query("SELECT display_name FROM product_accounts WHERE user_id = $1 AND account_state <> 'deleted'", [userId]);
  return text(result.rows[0]?.display_name);
}

// The programmes the athlete has been on. An assignment that carries on from
// an earlier version of the same programme stands for both, so a block
// trained partly on each is one block.
async function programmesOf(athleteUserId: string): Promise<Programme[]> {
  const [assignments, runs] = await Promise.all([
    pool.query(
      `SELECT DISTINCT ON (record_payload->>'assignment_id') record_payload FROM beta_product_records
       WHERE record_type = 'beta17_assignment_trigger' AND subject_user_id = $1
       ORDER BY record_payload->>'assignment_id', effective_at DESC, created_at DESC`,
      [athleteUserId]
    ),
    pool.query(
      `SELECT event_payload FROM product_account_events
       WHERE user_id = $1 AND event_type = 'athlete_programme_run_started' ORDER BY occurred_at ASC`,
      [athleteUserId]
    )
  ]);
  const assigned = assignments.rows.map((row) => payloadOf(row.record_payload));
  const continued = new Set(assigned.map((payload) => text(payload.continues_position_from_assignment_id)).filter(Boolean));
  return [
    ...assigned
      .filter((payload) => text(payload.assignment_id) && !continued.has(text(payload.assignment_id)))
      .map((payload): Programme => ({ id: text(payload.assignment_id), owner: text(payload.assigned_by_coach_id), template: text(payload.template_id), kind: "coach" })),
    ...runs.rows
      .map((row) => payloadOf(row.event_payload))
      .filter((payload) => text(payload.run_id))
      .map((payload): Programme => ({ id: text(payload.run_id), owner: text(payload.author_user_id), template: text(payload.template_id), kind: "kolosseum" }))
  ];
}

async function doneSessions(athleteUserId: string, programme: Programme): Promise<Map<number, DoneSession>> {
  const ids = programme.kind === "coach" ? await assignmentPositionIds(programme.id) : [];
  const result = await pool.query(
    `SELECT session_id, updated_at, planned_session->'template_position'->>'template_session_index' AS template_session_index
     FROM sessions
     WHERE beta_subject_user_id = $1 AND status IN ('completed', 'partial')
       AND (beta_assignment_id = ANY($2::text[]) OR planned_session->'programme_run'->>'run_id' = $3)
     ORDER BY created_at ASC, session_id ASC`,
    [athleteUserId, ids, programme.id]
  );
  const byIndex = new Map<number, DoneSession>();
  for (const row of result.rows) {
    if (!/^\d+$/u.test(String(row.template_session_index ?? ""))) continue;
    byIndex.set(Number(row.template_session_index), { session_id: String(row.session_id), finished_at: new Date(row.updated_at).toISOString() });
  }
  return byIndex;
}

// A session ended with every exercise left out trained nothing.
async function trainedSomething(sessionId: string): Promise<boolean> {
  const state = payloadOf(await getSessionStateQuery(sessionId).catch(() => null));
  return Array.isArray(state.completed_exercises) && state.completed_exercises.length > 0;
}

async function keepNewAwards(athleteUserId: string): Promise<void> {
  const kept = await pool.query(
    `SELECT event_payload FROM product_account_events WHERE user_id = $1 AND event_type = $2`,
    [athleteUserId, AWARD_EVENT]
  );
  const keptPayloads = kept.rows.map((row) => payloadOf(row.event_payload));
  const keptBlocks = new Set(keptPayloads.map((payload) => `${text(payload.programme_id)}|${text(payload.block_id)}`));
  const keptSessions = new Set(keptPayloads.map((payload) => text(payload.last_session_id)));

  for (const programme of await programmesOf(athleteUserId)) {
    const sessions = await doneSessions(athleteUserId, programme);
    if (!sessions.size) continue;
    const template = await loadExecutableCoachTemplateById(programme.owner, programme.template).catch(() => null);
    if (!template) continue;
    const slots: AwardSlot[] = orderedTemplateSessions(template).map((slot) => ({
      block_id: text(slot.template_block_id),
      block_name: text(slot.template_block_name),
      week_key: `${text(slot.template_week_id)}|${String(slot.template_week_order ?? "")}`
    }));
    const lastOf = (block: { indexes: readonly number[] }) => sessions.get(block.indexes[block.indexes.length - 1]);
    const isNew = (block: { block_id: string; indexes: readonly number[] }) =>
      !keptBlocks.has(`${programme.id}|${block.block_id}`) && !keptSessions.has(lastOf(block)?.session_id ?? "");
    const candidates = finishedBlocks(slots, new Set(sessions.keys())).filter(isNew);
    if (!candidates.length) continue;

    const trained = new Set<number>();
    for (const index of new Set(candidates.flatMap((block) => block.indexes))) {
      const session = sessions.get(index);
      if (session && (await trainedSomething(session.session_id))) trained.add(index);
    }
    for (const block of finishedBlocks(slots, trained).filter(isNew)) {
      const last = lastOf(block);
      if (!last) continue;
      await pool.query(
        `INSERT INTO product_account_events (event_id, user_id, event_type, event_payload, occurred_at)
         VALUES ($1, $2, $3, $4::jsonb, $5) ON CONFLICT (event_id) DO NOTHING`,
        [
          `block_award_${last.session_id}`, athleteUserId, AWARD_EVENT,
          JSON.stringify({
            programme_id: programme.id,
            block_id: block.block_id,
            last_session_id: last.session_id,
            block_name: block.block_name || "Block",
            programme_name: text(template.template_name),
            source: programme.kind,
            // Their name is looked up when it is shown, never copied here.
            coach_user_id: programme.kind === "coach" ? programme.owner : "",
            weeks: block.weeks,
            sessions_done: block.indexes.filter((index) => trained.has(index)).length,
            sessions_total: block.sessions_total
          }),
          last.finished_at
        ]
      );
    }
  }
}

// The athlete's awards, newest first, and their name for the certificate.
export async function loadBlockAwards(athleteUserId: string): Promise<Readonly<Json>> {
  await keepNewAwards(athleteUserId);
  const result = await pool.query(
    `SELECT event_id, event_payload, occurred_at FROM product_account_events
     WHERE user_id = $1 AND event_type = $2 ORDER BY occurred_at DESC, event_id DESC LIMIT 200`,
    [athleteUserId, AWARD_EVENT]
  );
  const coachNames = new Map<string, string>();
  for (const coachId of new Set(result.rows.map((row) => text(payloadOf(row.event_payload).coach_user_id)).filter(Boolean))) {
    const name = await displayName(coachId);
    coachNames.set(coachId, name ? coachNameWithBusiness(name, await coachBusinessName(coachId)) : "");
  }
  return Object.freeze({
    ok: true,
    athlete_name: await displayName(athleteUserId),
    awards: result.rows.map((row) => {
      const payload = payloadOf(row.event_payload);
      return {
        award_id: String(row.event_id),
        block_name: text(payload.block_name) || "Block",
        programme_name: text(payload.programme_name),
        coach_name: coachNames.get(text(payload.coach_user_id)) ?? "",
        source: text(payload.source) || "coach",
        weeks: Number(payload.weeks) || 0,
        sessions_done: Number(payload.sessions_done) || 0,
        sessions_total: Number(payload.sessions_total) || 0,
        finished_at: new Date(row.occurred_at).toISOString()
      };
    })
  });
}
