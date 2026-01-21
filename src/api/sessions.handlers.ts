// src/api/sessions.handlers.ts
import type { Request, Response } from "express";
import { pool } from "../db/pool.js";

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

type PlannedExercise = {
  exercise_id: string;
  source: "program";
};

type PlannedSession = {
  exercises: PlannedExercise[];
  notes?: unknown[];
};

type RuntimeEvent =
  | { type: "START_SESSION" }
  | { type: "COMPLETE_EXERCISE"; exercise_id: string }
  | { type: "SKIP_EXERCISE"; exercise_id: string }
  | { type: "SPLIT_SESSION" }
  | { type: "RETURN_CONTINUE" }
  | { type: "RETURN_SKIP" }
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

  // known no-arg events
  if (
    t === "START_SESSION" ||
    t === "SPLIT_SESSION" ||
    t === "RETURN_CONTINUE" ||
    t === "RETURN_SKIP"
  ) {
    return { ...(v as any), type: t } as RuntimeEvent;
  }

  // forward compatible: store unknown types; reducer ignores unless handled
  return { ...(v as any), type: t } as RuntimeEvent;
}

type SessionSummary = {
  started: boolean;
  remaining_ids: string[];
  completed_ids: string[];
  dropped_ids: string[];
  last_seq: number; // 0 if none
};

function summaryFromPlanned(planned: PlannedSession): SessionSummary {
  const exercises = Array.isArray(planned?.exercises) ? planned.exercises : [];
  const ids = exercises
    .map((e) => (e && typeof e.exercise_id === "string" ? e.exercise_id : ""))
    .filter((x) => x.length > 0);

  return {
    started: false,
    remaining_ids: ids,
    completed_ids: [],
    dropped_ids: [],
    last_seq: 0
  };
}

function applyEventToSummary(summary: SessionSummary, ev: RuntimeEvent): SessionSummary {
  const out: SessionSummary = {
    started: summary.started,
    remaining_ids: [...summary.remaining_ids],
    completed_ids: [...summary.completed_ids],
    dropped_ids: [...summary.dropped_ids],
    last_seq: summary.last_seq
  };

  const removeRemaining = (exercise_id: string): boolean => {
    const idx = out.remaining_ids.indexOf(exercise_id);
    if (idx < 0) return false;
    out.remaining_ids.splice(idx, 1);
    return true;
  };

  switch (ev.type) {
    case "START_SESSION":
      out.started = true;
      return out;

    case "COMPLETE_EXERCISE": {
      const exercise_id = (ev as any).exercise_id as string;
      if (typeof exercise_id === "string" && exercise_id.length > 0) {
        if (removeRemaining(exercise_id)) out.completed_ids.push(exercise_id);
      }
      return out;
    }

    case "SKIP_EXERCISE": {
      const exercise_id = (ev as any).exercise_id as string;
      if (typeof exercise_id === "string" && exercise_id.length > 0) {
        if (removeRemaining(exercise_id)) out.dropped_ids.push(exercise_id);
      }
      return out;
    }

    case "RETURN_SKIP": {
      // drop everything remaining
      while (out.remaining_ids.length > 0) {
        const id = out.remaining_ids.shift();
        if (id) out.dropped_ids.push(id);
      }
      return out;
    }

    // No state change for these (yet)
    case "SPLIT_SESSION":
    case "RETURN_CONTINUE":
    default:
      return out;
  }
}

async function allocNextSeq(client: any, session_id: string): Promise<number> {
  // Requires session_event_seq table with row per session_id.
  // If row doesn't exist, create it (0) and then increment.
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

/**
 * POST /sessions/:session_id/start
 * - idempotent: if START_SESSION already exists in summary.started=true, do nothing
 * - persists START_SESSION event + sets sessions.status + initializes session_state_summary
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

    // Initialize summary if missing/invalid
    const existingSummaryRaw = s.session_state_summary;
    const existingSummary =
      existingSummaryRaw &&
      typeof existingSummaryRaw === "object" &&
      Array.isArray((existingSummaryRaw as any).remaining_ids)
        ? (existingSummaryRaw as SessionSummary)
        : summaryFromPlanned(planned);

    if (existingSummary.started === true) {
      // Ensure status is consistent
      await client.query(
        `UPDATE sessions
         SET status = 'in_progress', updated_at = now()
         WHERE session_id = $1`,
        [session_id]
      );

      await client.query("COMMIT");
      return res.json({ ok: true, session_id, started: true });
    }

    // Allocate seq, insert START event
    const seq = await allocNextSeq(client, session_id);
    const ev: RuntimeEvent = { type: "START_SESSION" };

    await client.query(
      `INSERT INTO runtime_events(session_id, seq, event)
       VALUES ($1, $2, $3::jsonb)`,
      [session_id, seq, JSON.stringify(ev)]
    );

    // Update summary
    const nextSummary = applyEventToSummary(existingSummary, ev);
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
 * - updates session_state_summary incrementally (O(1) + small array ops)
 */
export async function appendRuntimeEvent(req: Request, res: Response) {
  const session_id = asString(req.params?.session_id);
  if (!session_id) return res.status(400).json({ error: "Missing session_id" });

  const event = validateRuntimeEvent((req.body as any)?.event);
  if (!event) return res.status(400).json({ error: "Missing/invalid event" });

  // Prevent clients from manually writing START_SESSION via /events
  if (event.type === "START_SESSION") {
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

    const summaryRaw = s.session_state_summary;
    const summary =
      summaryRaw &&
      typeof summaryRaw === "object" &&
      Array.isArray((summaryRaw as any).remaining_ids)
        ? (summaryRaw as SessionSummary)
        : summaryFromPlanned(planned);

    // If not started, auto-start (product-safe for now)
    // Insert START first so seq is monotonic
    let workingSummary = summary;
    if (workingSummary.started !== true) {
      const startSeq = await allocNextSeq(client, session_id);
      const startEv: RuntimeEvent = { type: "START_SESSION" };

      await client.query(
        `INSERT INTO runtime_events(session_id, seq, event)
         VALUES ($1, $2, $3::jsonb)`,
        [session_id, startSeq, JSON.stringify(startEv)]
      );

      workingSummary = applyEventToSummary(workingSummary, startEv);
      workingSummary.last_seq = startSeq;

      await client.query(
        `UPDATE sessions
         SET status = 'in_progress',
             session_state_summary = $2::jsonb,
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

    const nextSummary = applyEventToSummary(workingSummary, event);
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
 * O(1): read from sessions.session_state_summary (no runtime_events scan)
 */
export async function getSessionState(req: Request, res: Response) {
  const session_id = asString(req.params?.session_id);
  if (!session_id) return res.status(400).json({ error: "Missing session_id" });

  const r = await pool.query(
    `SELECT planned_session, session_state_summary
     FROM sessions
     WHERE session_id = $1`,
    [session_id]
  );

  if ((r.rowCount ?? 0) === 0) return res.status(404).json({ error: "Session not found" });

  const planned = r.rows[0].planned_session as PlannedSession;
  const summaryRaw = r.rows[0].session_state_summary;

  const summary =
    summaryRaw &&
    typeof summaryRaw === "object" &&
    Array.isArray((summaryRaw as any).remaining_ids)
      ? (summaryRaw as SessionSummary)
      : summaryFromPlanned(planned);

  // Map ids back to exercise objects for the client
  const plannedExercises = Array.isArray(planned?.exercises) ? planned.exercises : [];
  const byId = new Map<string, PlannedExercise>();
  for (const ex of plannedExercises) {
    if (ex && typeof ex.exercise_id === "string") byId.set(ex.exercise_id, ex);
  }

  const remaining = summary.remaining_ids.map((id) => byId.get(id)).filter(Boolean);
  const completed = summary.completed_ids.map((id) => byId.get(id)).filter(Boolean);
  const dropped = summary.dropped_ids.map((id) => byId.get(id)).filter(Boolean);

  return res.json({
    session_id,
    remaining_exercises: remaining,
    completed_exercises: completed,
    dropped_exercises: dropped,
    event_log: [] // history is /events; state is O(1)
  });
}












