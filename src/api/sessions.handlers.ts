// src/api/sessions.handlers.ts
import type { Request, Response } from "express";
import { pool } from "../db/pool.js";

// Canonical semantics + summary normalization live in engine runtime.
// API is a thin wrapper: validate wire event -> map -> reducer -> persist snapshot.
import {
  applyWireEvent,
  deriveTrace,
  normalizeSummary,
  validateWireRuntimeEvent
} from "../../engine/src/runtime/session_summary.js";

type JsonRecord = Record<string, unknown>;

function isRecord(v: unknown): v is JsonRecord {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function pgErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const anyErr = err as any;
    if (typeof anyErr.detail === "string" && anyErr.detail.length > 0) return anyErr.detail;
    if (typeof anyErr.message === "string" && anyErr.message.length > 0) return anyErr.message;
  }
  return String(err);
}

/**
 * Planned session is immutable input. We only use it to:
 * - build initial runtime state at START
 * - upgrade legacy summaries
 * Once started=true, all semantics are driven by the stored runtime snapshot + reducer.
 */

type PlannedExercise = {
  exercise_id: string;
  source: "program";
};

type PlannedSession = {
  exercises: PlannedExercise[];
  notes?: unknown[];
};

function uniqStable(ids: unknown): string[] {
  const arr = Array.isArray(ids) ? ids : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    const s = typeof v === "string" ? v : String(v ?? "");
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function plannedIds(planned: PlannedSession): string[] {
  const exs = Array.isArray(planned?.exercises) ? planned.exercises : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ex of exs) {
    const id = ex && typeof ex.exercise_id === "string" ? ex.exercise_id : "";
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function toPlannedExercisesFromIds(planned: PlannedSession, ids: string[]): PlannedExercise[] {
  const exs = Array.isArray(planned?.exercises) ? planned.exercises : [];
  const byId = new Map<string, PlannedExercise>();
  for (const ex of exs) {
    if (ex && typeof ex.exercise_id === "string" && ex.exercise_id.length > 0) byId.set(ex.exercise_id, ex);
  }

  const out: PlannedExercise[] = [];
  for (const id of ids) {
    const ex = byId.get(id);
    if (ex) out.push(ex);
  }
  return out;
}

async function allocNextSeq(client: any, session_id: string): Promise<number> {
  await client.query(
    `INSERT INTO session_event_seq(session_id, next_seq)
     VALUES ($1, 0)
     ON CONFLICT (session_id) DO NOTHING`,
    [session_id]
  );

  const r = await client.query(
    `UPDATE session_event_seq
     SET next_seq = next_seq + 1
     WHERE session_id = $1
     RETURNING next_seq`,
    [session_id]
  );

  return Number(r.rows?.[0]?.next_seq ?? 1);
}

async function loadSessionForUpdate(client: any, session_id: string) {
  const r = await client.query(
    `SELECT session_id, status, planned_session, session_state_summary
     FROM sessions
     WHERE session_id = $1
     FOR UPDATE`,
    [session_id]
  );
  return (r.rowCount ?? 0) > 0 ? r.rows[0] : null;
}

async function loadSession(client: any, session_id: string) {
  const r = await client.query(
    `SELECT session_id, planned_session, session_state_summary
     FROM sessions
     WHERE session_id = $1`,
    [session_id]
  );
  return (r.rowCount ?? 0) > 0 ? r.rows[0] : null;
}

/**
 * POST /sessions/:session_id/start
 * - idempotent
 * - persists START_SESSION + sets status + ensures summary is V3
 */
export async function startSession(req: Request, res: Response) {
  const session_id = asString(req.params?.session_id);
  if (!session_id) return res.status(400).json({ error: "Missing session_id" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const s = await loadSessionForUpdate(client, session_id);
    if (!s) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Session not found" });
    }

    const planned = s.planned_session as PlannedSession;
    const { summary: normalized, needsUpgrade } = normalizeSummary(planned as any, s.session_state_summary);

    // If already started, just ensure status + optionally upgrade summary
    if (normalized.started === true) {
      await client.query(
        `UPDATE sessions
         SET status = 'in_progress',
             session_state_summary = $2::jsonb,
             updated_at = now()
         WHERE session_id = $1`,
        [session_id, JSON.stringify(needsUpgrade ? normalized : (s.session_state_summary ?? normalized))]
      );

      await client.query("COMMIT");
      return res.json({ ok: true, session_id, started: true });
    }

    const seq = await allocNextSeq(client, session_id);
    const ev = { type: "START_SESSION" };

    await client.query(
      `INSERT INTO runtime_events(session_id, seq, event)
       VALUES ($1, $2, $3::jsonb)`,
      [session_id, seq, JSON.stringify(ev)]
    );

    const nextSummary = applyWireEvent(normalized as any, ev as any, planned as any) as any;
    nextSummary.last_seq = seq;

    await client.query(
      `UPDATE sessions
       SET status = 'in_progress',
           session_state_summary = $2::jsonb,
           updated_at = now()
       WHERE session_id = $1`,
      [session_id, JSON.stringify(nextSummary)]
    );

    await client.query("COMMIT");
    return res.status(200).json({ ok: true, session_id, started: true, seq });
  } catch (err: unknown) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    return res.status(400).json({ error: pgErrorMessage(err) });
  } finally {
    client.release();
  }
}

/**
 * POST /sessions/:session_id/events
 * body: { event: {...} }
 * - allocates seq O(1)
 * - inserts runtime_events row
 * - updates session_state_summary incrementally (V3, reducer canonical)
 */
export async function appendRuntimeEvent(req: Request, res: Response) {
  const session_id = asString(req.params?.session_id);
  if (!session_id) return res.status(400).json({ error: "Missing session_id" });

  const event = validateWireRuntimeEvent((req.body as any)?.event);
  if (!event) return res.status(400).json({ error: "Missing/invalid event" });

  // Prevent clients from manually writing START_SESSION via /events
  if ((event as any).type === "START_SESSION") {
    return res.status(400).json({ error: "START_SESSION must be created via /start" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const s = await loadSessionForUpdate(client, session_id);
    if (!s) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Session not found" });
    }

    const planned = s.planned_session as PlannedSession;
    const { summary: normalized, needsUpgrade } = normalizeSummary(planned as any, s.session_state_summary);

    let workingSummary: any = normalized;

    // Product-safe: auto-start if not started
    if (workingSummary.started !== true) {
      const startSeq = await allocNextSeq(client, session_id);
      const startEv = { type: "START_SESSION" };

      await client.query(
        `INSERT INTO runtime_events(session_id, seq, event)
         VALUES ($1, $2, $3::jsonb)`,
        [session_id, startSeq, JSON.stringify(startEv)]
      );

      workingSummary = applyWireEvent(workingSummary, startEv as any, planned as any);
      workingSummary.last_seq = startSeq;

      await client.query(
        `UPDATE sessions
         SET status = 'in_progress',
             session_state_summary = $2::jsonb,
             updated_at = now()
         WHERE session_id = $1`,
        [session_id, JSON.stringify(workingSummary)]
      );
    } else if (needsUpgrade) {
      // Persist upgraded snapshot even if already started
      await client.query(
        `UPDATE sessions
         SET session_state_summary = $2::jsonb,
             updated_at = now()
         WHERE session_id = $1`,
        [session_id, JSON.stringify(workingSummary)]
      );
    }

    const seq = await allocNextSeq(client, session_id);

    await client.query(
      `INSERT INTO runtime_events(session_id, seq, event)
       VALUES ($1, $2, $3::jsonb)`,
      [session_id, seq, JSON.stringify(event)]
    );

    const nextSummary = applyWireEvent(workingSummary, event as any, planned as any) as any;
    nextSummary.last_seq = seq;

    await client.query(
      `UPDATE sessions
       SET session_state_summary = $2::jsonb,
           updated_at = now()
       WHERE session_id = $1`,
      [session_id, JSON.stringify(nextSummary)]
    );

    await client.query("COMMIT");
    return res.status(201).json({ ok: true, session_id, seq });
  } catch (err: unknown) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    return res.status(400).json({ error: pgErrorMessage(err) });
  } finally {
    client.release();
  }
}

/**
 * GET /sessions/:session_id/events
 * (history endpoint)
 */
export async function listRuntimeEvents(req: Request, res: Response) {
  const session_id = asString(req.params?.session_id);
  if (!session_id) return res.status(400).json({ error: "Missing session_id" });

  const r = await pool.query(
    `SELECT seq, event, created_at
     FROM runtime_events
     WHERE session_id = $1
     ORDER BY seq ASC`,
    [session_id]
  );

  return res.json({ session_id, events: r.rows });
}

/**
 * GET /sessions/:session_id/state
 * - O(1) read from sessions.session_state_summary (no runtime_events scan)
 * - Once started=true, response is derived ONLY from stored runtime snapshot + reducer-owned invariants.
 */
export async function getSessionState(req: Request, res: Response) {
  const session_id = asString(req.params?.session_id);
  if (!session_id) return res.status(400).json({ error: "Missing session_id" });

  const client = await pool.connect();
  try {
    const row = await loadSession(client, session_id);
    if (!row) return res.status(404).json({ error: "Session not found" });

    const planned = row.planned_session as PlannedSession;
    const { summary, needsUpgrade } = normalizeSummary(planned as any, row.session_state_summary);

    // If legacy/invalid, upgrade storage silently (product-safe)
    if (needsUpgrade) {
      await client.query(
        `UPDATE sessions
         SET session_state_summary = $2::jsonb,
             updated_at = now()
         WHERE session_id = $1`,
        [session_id, JSON.stringify(summary)]
      );
    }

    const trace = deriveTrace(summary as any) as any;

    // Derive exercise objects from planned + runtime ids (order-preserving)
    const remaining_exercises = toPlannedExercisesFromIds(planned, uniqStable(trace.remaining_ids));
    const completed_exercises = toPlannedExercisesFromIds(planned, uniqStable(trace.completed_ids));
    const dropped_exercises = toPlannedExercisesFromIds(planned, uniqStable(trace.dropped_ids));

    return res.json({
      session_id,
      started: trace.started,
      remaining_exercises,
      completed_exercises,
      dropped_exercises,
      trace,
      event_log: [] // history is /events; state is O(1)
    });
  } catch (err: unknown) {
    return res.status(400).json({ error: pgErrorMessage(err) });
  } finally {
    client.release();
  }
}