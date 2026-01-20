// src/api/sessions.handlers.ts
import type { Request, Response } from "express";
import crypto from "node:crypto";
import { pool } from "../db/pool.js";

type JsonRecord = Record<string, unknown>;

function isRecord(v: unknown): v is JsonRecord {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

function pgErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const anyErr = err as any;
    if (typeof anyErr.detail === "string" && anyErr.detail.length > 0) return anyErr.detail;
    if (typeof anyErr.message === "string" && anyErr.message.length > 0) return anyErr.message;
  }
  return String(err);
}

type PlannedExercise = {
  exercise_id: string;
  source: "program";
};

type PlannedSession = {
  session_id?: string;
  status?: string; // not trusted; DB status is source of truth
  exercises: PlannedExercise[];
  notes?: unknown[];
};

// Runtime events we currently use in smoke + phase6 runtime tests
type RuntimeEvent =
  | { type: "START_SESSION" }
  | { type: "COMPLETE_EXERCISE"; exercise_id: string }
  | { type: "SKIP_EXERCISE"; exercise_id: string }
  | { type: "SPLIT_SESSION" }
  | { type: "RETURN_CONTINUE" }
  | { type: "RETURN_SKIP" }
  // forward compatible
  | ({ type: string } & JsonRecord);

function validateRuntimeEvent(v: unknown): RuntimeEvent | null {
  if (!isRecord(v)) return null;
  const t = asString(v.type);
  if (!t) return null;

  if (t === "COMPLETE_EXERCISE" || t === "SKIP_EXERCISE") {
    const exercise_id = asString((v as any).exercise_id);
    if (!exercise_id) return null;
    return { ...(v as any), type: t, exercise_id } as RuntimeEvent;
  }

  if (t === "START_SESSION" || t === "SPLIT_SESSION" || t === "RETURN_CONTINUE" || t === "RETURN_SKIP") {
    return { ...(v as any), type: t } as RuntimeEvent;
  }

  // Unknown event types are allowed to be stored, but they won't affect state unless you teach the reducer.
  return { ...(v as any), type: t } as RuntimeEvent;
}

async function nextSeq(session_id: string): Promise<number> {
  const r = await pool.query(
    `SELECT COALESCE(MAX(seq), 0) AS max_seq FROM runtime_events WHERE session_id = $1`,
    [session_id]
  );
  const maxSeq = Number(r.rows?.[0]?.max_seq ?? 0);
  return maxSeq + 1;
}

async function loadSessionOr404(res: Response, session_id: string) {
  const r = await pool.query(
    `SELECT session_id, block_id, status, planned_session, created_at, updated_at
     FROM sessions
     WHERE session_id = $1`,
    [session_id]
  );
  if ((r.rowCount ?? 0) === 0) {
    res.status(404).json({ error: "Session not found" });
    return null;
  }
  return r.rows[0] as any;
}

/**
 * POST /sessions/:session_id/start
 * - idempotent: if START already exists, do nothing
 * - persists START_SESSION as a runtime_events row
 */
export async function startSession(req: Request, res: Response) {
  const session_id = asString(req.params?.session_id);
  if (!session_id) return res.status(400).json({ error: "Missing session_id" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const s = await client.query(
      `SELECT session_id, status FROM sessions WHERE session_id = $1 FOR UPDATE`,
      [session_id]
    );
    if ((s.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Session not found" });
    }

    // If a START_SESSION already exists, we're done.
    const already = await client.query(
      `SELECT 1 FROM runtime_events WHERE session_id = $1 AND (event->>'type') = 'START_SESSION' LIMIT 1`,
      [session_id]
    );
    if ((already.rowCount ?? 0) === 0) {
      const seq = await (async () => {
        const r = await client.query(
          `SELECT COALESCE(MAX(seq), 0) AS max_seq FROM runtime_events WHERE session_id = $1`,
          [session_id]
        );
        const maxSeq = Number(r.rows?.[0]?.max_seq ?? 0);
        return maxSeq + 1;
      })();

      await client.query(
        `INSERT INTO runtime_events(session_id, seq, event) VALUES ($1, $2, $3::jsonb)`,
        [session_id, seq, JSON.stringify({ type: "START_SESSION" } satisfies RuntimeEvent)]
      );
    }

    await client.query(
      `UPDATE sessions SET status = 'in_progress', updated_at = now() WHERE session_id = $1`,
      [session_id]
    );

    await client.query("COMMIT");
    return res.json({ ok: true, session_id });
  } catch (err: unknown) {
    try { await client.query("ROLLBACK"); } catch {}
    return res.status(400).json({ error: pgErrorMessage(err) });
  } finally {
    client.release();
  }
}

/**
 * POST /sessions/:session_id/events
 * body: { event: {...} }
 * - appends runtime event with seq = nextSeq
 */
export async function appendRuntimeEvent(req: Request, res: Response) {
  const session_id = asString(req.params?.session_id);
  if (!session_id) return res.status(400).json({ error: "Missing session_id" });

  const event = validateRuntimeEvent((req.body as any)?.event);
  if (!event) return res.status(400).json({ error: "Missing/invalid event" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const s = await client.query(
      `SELECT session_id FROM sessions WHERE session_id = $1 FOR UPDATE`,
      [session_id]
    );
    if ((s.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Session not found" });
    }

    const r = await client.query(
      `SELECT COALESCE(MAX(seq), 0) AS max_seq FROM runtime_events WHERE session_id = $1`,
      [session_id]
    );
    const seq = Number(r.rows?.[0]?.max_seq ?? 0) + 1;

    await client.query(
      `INSERT INTO runtime_events(session_id, seq, event) VALUES ($1, $2, $3::jsonb)`,
      [session_id, seq, JSON.stringify(event)]
    );

    await client.query(`UPDATE sessions SET updated_at = now() WHERE session_id = $1`, [session_id]);

    await client.query("COMMIT");
    return res.status(201).json({ ok: true, session_id, seq });
  } catch (err: unknown) {
    try { await client.query("ROLLBACK"); } catch {}
    return res.status(400).json({ error: pgErrorMessage(err) });
  } finally {
    client.release();
  }
}

/**
 * GET /sessions/:session_id/events
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
 * Deterministic reducer over planned_session.exercises + runtime_events.
 */
export async function getSessionState(req: Request, res: Response) {
  const session_id = asString(req.params?.session_id);
  if (!session_id) return res.status(400).json({ error: "Missing session_id" });

  const session = await loadSessionOr404(res, session_id);
  if (!session) return;

  const planned = session.planned_session as PlannedSession;
  const plannedExercises: PlannedExercise[] = Array.isArray(planned?.exercises) ? planned.exercises : [];

  const evr = await pool.query(
    `SELECT seq, event, created_at
     FROM runtime_events
     WHERE session_id = $1
     ORDER BY seq ASC`,
    [session_id]
  );

  // State
  const remaining: PlannedExercise[] = plannedExercises.map((x) => ({ ...x }));
  const completed: PlannedExercise[] = [];
  const dropped: PlannedExercise[] = [];
  const event_log: RuntimeEvent[] = [];

  function removeFromRemaining(exercise_id: string): PlannedExercise | null {
    const idx = remaining.findIndex((e) => e.exercise_id === exercise_id);
    if (idx < 0) return null;
    const [ex] = remaining.splice(idx, 1);
    return ex ?? null;
  }

  for (const row of evr.rows) {
    const event = row.event as RuntimeEvent;
    if (!event || typeof event !== "object") continue;

    // Keep log excluding START_SESSION? For now include everything; smoke expects START too.
    event_log.push(event);

    switch (event.type) {
      case "COMPLETE_EXERCISE": {
        const ex = removeFromRemaining((event as any).exercise_id);
        if (ex) completed.push(ex);
        break;
      }
      case "SKIP_EXERCISE": {
        const ex = removeFromRemaining((event as any).exercise_id);
        if (ex) dropped.push(ex);
        break;
      }
      case "RETURN_SKIP": {
        // drop everything remaining
        while (remaining.length > 0) {
          const ex = remaining.shift();
          if (ex) dropped.push(ex);
        }
        break;
      }
      case "START_SESSION":
      case "SPLIT_SESSION":
      case "RETURN_CONTINUE":
      default:
        // no-op for state right now
        break;
    }
  }

  return res.json({
    session_id,
    remaining_exercises: remaining,
    completed_exercises: completed,
    dropped_exercises: dropped,
    event_log
  });
}







