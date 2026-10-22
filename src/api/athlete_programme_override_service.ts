// DEV NOTE: Adjusting a coach's programme for one athlete. A coach with 25
// players on one programme changes a single player's upcoming session - fewer
// sets around a niggle, a different weight, an exercise left out, a note -
// without copying the whole programme. Kept as the athlete's own account
// events (GDPR export and erasure cover them): set and cleared, never edited.
// Applied when that session is created (blocks.handlers.ts), stamped for
// coach review; the programme itself is untouched.
import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import { requireCoachAthleteAccess } from "./beta19_coach_workspace_service.js";

type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null);

const SET = "programme_override_set";
const CLEARED = "programme_override_cleared";

export class ProgrammeOverrideError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ProgrammeOverrideError";
    this.status = status;
  }
}

import type { ProgrammeOverride } from "./programme_override.js";
export { applyProgrammeOverrides, type ProgrammeOverride } from "./programme_override.js";

// The athlete's current coach assignment (the latest, still assigned).
async function currentAssignmentId(athleteUserId: string): Promise<string | null> {
  const result = await pool.query(
    `SELECT record_payload FROM beta_product_records
     WHERE record_type = 'beta17_assignment_trigger' AND subject_user_id = $1
     ORDER BY effective_at DESC, created_at DESC, record_id DESC, record_sha256 DESC LIMIT 1`,
    [athleteUserId]
  );
  const latest = result.rows[0]?.record_payload;
  return isRecord(latest) && (text(latest.assignment_status) || "assigned") === "assigned" ? text(latest.assignment_id) || null : null;
}

function validChange(body: Json): Omit<ProgrammeOverride, "assignment_id" | "session_index" | "exercise_id"> {
  if (body.remove === true) return { remove: true, ...(text(body.note) ? { note: text(body.note).slice(0, 200) } : {}) };
  const out: Record<string, unknown> = {};
  const sets = num(body.sets);
  if (sets !== null) { if (!Number.isInteger(sets) || sets < 1 || sets > 30) throw new ProgrammeOverrideError("programme_override_sets_invalid"); out.sets = sets; }
  const reps = num(body.reps);
  if (reps !== null) { if (!Number.isInteger(reps) || reps < 1 || reps > 100) throw new ProgrammeOverrideError("programme_override_reps_invalid"); out.reps = reps; }
  const load = num(body.load_kg);
  if (load !== null) { if (load <= 0 || load > 1000) throw new ProgrammeOverrideError("programme_override_load_invalid"); out.load_kg = Math.round(load * 4) / 4; }
  const rpe = num(body.rpe);
  if (rpe !== null) { if (rpe < 1 || rpe > 10 || Math.round(rpe * 2) !== rpe * 2) throw new ProgrammeOverrideError("programme_override_rpe_invalid"); out.rpe = rpe; }
  if (out.load_kg !== undefined && out.rpe !== undefined) throw new ProgrammeOverrideError("programme_override_load_or_rpe");
  const note = text(body.note);
  if (note.length > 200) throw new ProgrammeOverrideError("programme_override_note_too_long");
  if (note) out.note = note;
  if (!Object.keys(out).length) throw new ProgrammeOverrideError("programme_override_empty");
  return out as Omit<ProgrammeOverride, "assignment_id" | "session_index" | "exercise_id">;
}

export async function setProgrammeOverride(coachUserId: string, athleteUserId: string, input: unknown): Promise<Json> {
  await requireCoachAthleteAccess(coachUserId, athleteUserId);
  const body = isRecord(input) ? input : {};
  const assignmentId = await currentAssignmentId(athleteUserId);
  if (!assignmentId) throw new ProgrammeOverrideError("programme_override_no_programme", 404);
  const sessionIndex = num(body.session_index);
  if (sessionIndex === null || !Number.isInteger(sessionIndex) || sessionIndex < 0 || sessionIndex > 1000) throw new ProgrammeOverrideError("programme_override_session_invalid");
  const exerciseId = text(body.exercise_id);
  if (!/^[a-z0-9_]{2,80}$/u.test(exerciseId)) throw new ProgrammeOverrideError("programme_override_exercise_invalid");
  const clientRequestId = text(body.client_request_id);
  if (!/^[A-Za-z0-9_-]{8,80}$/u.test(clientRequestId)) throw new ProgrammeOverrideError("programme_override_client_request_id_invalid");
  const override = { assignment_id: assignmentId, session_index: sessionIndex, exercise_id: exerciseId, ...validChange(body), set_by: coachUserId };
  const id = `po_${crypto.createHash("sha256").update(`${coachUserId}|${athleteUserId}|${clientRequestId}`).digest("hex").slice(0, 32)}`;
  const inserted = await pool.query(
    "INSERT INTO product_account_events (event_id, user_id, event_type, event_payload) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (event_id) DO NOTHING",
    [id, athleteUserId, SET, JSON.stringify({ id, ...override })]
  );
  return { ok: true, override, added: inserted.rowCount === 1 };
}

export async function clearProgrammeOverride(coachUserId: string, athleteUserId: string, input: unknown): Promise<Json> {
  await requireCoachAthleteAccess(coachUserId, athleteUserId);
  const body = isRecord(input) ? input : {};
  const assignmentId = await currentAssignmentId(athleteUserId);
  const sessionIndex = num(body.session_index);
  const exerciseId = text(body.exercise_id);
  if (!assignmentId || sessionIndex === null || !exerciseId) throw new ProgrammeOverrideError("programme_override_not_found", 404);
  const id = `poc_${crypto.randomUUID().replace(/-/gu, "")}`;
  await pool.query(
    "INSERT INTO product_account_events (event_id, user_id, event_type, event_payload) VALUES ($1, $2, $3, $4::jsonb)",
    [id, athleteUserId, CLEARED, JSON.stringify({ assignment_id: assignmentId, session_index: sessionIndex, exercise_id: exerciseId, cleared_by: coachUserId })]
  );
  return { ok: true, cleared: { session_index: sessionIndex, exercise_id: exerciseId } };
}

// The overrides standing for this assignment: the latest per session and
// exercise, unless cleared after it. No access check: callers check.
export async function loadProgrammeOverrides(athleteUserId: string, assignmentId: string): Promise<ProgrammeOverride[]> {
  const result = await pool.query(
    `SELECT event_type, event_payload FROM product_account_events
     WHERE user_id = $1 AND event_type IN ($2, $3) AND event_payload->>'assignment_id' = $4
     ORDER BY occurred_at ASC, event_id ASC`,
    [athleteUserId, SET, CLEARED, assignmentId]
  );
  const latest = new Map<string, ProgrammeOverride | null>();
  for (const row of result.rows) {
    const payload = isRecord(row.event_payload) ? row.event_payload : {};
    const key = `${num(payload.session_index)}|${text(payload.exercise_id)}`;
    latest.set(key, row.event_type === CLEARED ? null : (payload as unknown as ProgrammeOverride));
  }
  return [...latest.values()].filter((entry): entry is ProgrammeOverride => entry !== null);
}

export async function currentProgrammeOverrides(athleteUserId: string): Promise<ProgrammeOverride[]> {
  const assignmentId = await currentAssignmentId(athleteUserId);
  return assignmentId ? loadProgrammeOverrides(athleteUserId, assignmentId) : [];
}

