import type { Request, Response } from "express";
import crypto from "node:crypto";

import { pool } from "../db/pool.js";

import { applyRuntimeEvents } from "../../engine/src/runtime/apply_runtime_event.js";
import type { RuntimeEvent } from "../../engine/src/runtime/runtime_event.js";
import type { Phase6SessionOutput } from "../../engine/src/phases/phase6.js";

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export async function createSession(req: Request, res: Response) {
  const planned = req.body?.planned_session as Phase6SessionOutput | undefined;

  if (!planned || typeof planned !== "object") {
    return res.status(400).json({ error: "Missing planned_session" });
  }

  const session_id =
    typeof (planned as any).session_id === "string" && (planned as any).session_id.length > 0
      ? (planned as any).session_id
      : `s_${crypto.randomUUID().replace(/-/g, "")}`;

  const plannedToStore: Phase6SessionOutput = { ...(planned as any), session_id };

  try {
    await pool.query(
      `
      INSERT INTO sessions (session_id, status, planned_session)
      VALUES ($1, 'not_started', $2::jsonb)
      ON CONFLICT (session_id) DO NOTHING
      `,
      [session_id, JSON.stringify(plannedToStore)]
    );

    return res.status(201).json({ session_id });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message ?? String(err) });
  }
}

export async function startSession(req: Request, res: Response) {
  const session_id = asString(req.params?.session_id);
  if (!session_id) return res.status(400).json({ error: "Missing session_id" });

  const result = await pool.query(
    `
    UPDATE sessions
    SET status = 'in_progress'
    WHERE session_id = $1
      AND status = 'not_started'
    RETURNING session_id
    `,
    [session_id]
  );

  if ((result.rowCount ?? 0) === 0) {
    return res.status(400).json({ error: "Session cannot be started" });
  }

  return res.json({ ok: true });
}

export async function appendRuntimeEvent(req: Request, res: Response) {
  const session_id = asString(req.params?.session_id);
  if (!session_id) return res.status(400).json({ error: "Missing session_id" });

  const event = req.body?.event as RuntimeEvent | undefined;
  if (!event || typeof event !== "object") {
    return res.status(400).json({ error: "Missing runtime event" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const sessionRes = await client.query(
      `SELECT planned_session FROM sessions WHERE session_id = $1`,
      [session_id]
    );

    if ((sessionRes.rowCount ?? 0) === 0) {
      throw new Error("Session not found");
    }

    const plannedSession = sessionRes.rows[0].planned_session as Phase6SessionOutput;

    const eventsRes = await client.query(
      `
      SELECT seq, event
      FROM runtime_events
      WHERE session_id = $1
      ORDER BY seq ASC
      `,
      [session_id]
    );

    const existingEvents: RuntimeEvent[] =
      (eventsRes.rows as Array<{ event: RuntimeEvent }>).map((r) => r.event);

    // Validate by replay (throws if invalid)
    applyRuntimeEvents(plannedSession, [...existingEvents, event]);

    const lastSeq =
      eventsRes.rows.length > 0
        ? Number((eventsRes.rows[eventsRes.rows.length - 1] as any).seq)
        : 0;

    const nextSeq = lastSeq + 1;

    await client.query(
      `
      INSERT INTO runtime_events (session_id, seq, event)
      VALUES ($1, $2, $3)
      `,
      [session_id, nextSeq, event]
    );

    await client.query("COMMIT");
    return res.json({ ok: true });
  } catch (err: any) {
    await client.query("ROLLBACK");
    return res.status(400).json({ error: err?.message ?? String(err) });
  } finally {
    client.release();
  }
}

export async function getSessionState(req: Request, res: Response) {
  const session_id = asString(req.params?.session_id);
  if (!session_id) return res.status(400).json({ error: "Missing session_id" });

  const sessionRes = await pool.query(
    `SELECT planned_session FROM sessions WHERE session_id = $1`,
    [session_id]
  );

  if ((sessionRes.rowCount ?? 0) === 0) {
    return res.status(404).json({ error: "Session not found" });
  }

  const plannedSession = sessionRes.rows[0].planned_session as Phase6SessionOutput;

  const eventsRes = await pool.query(
    `
    SELECT event
    FROM runtime_events
    WHERE session_id = $1
    ORDER BY seq ASC
    `,
    [session_id]
  );

  const events: RuntimeEvent[] =
    (eventsRes.rows as Array<{ event: RuntimeEvent }>).map((r) => r.event);

  const state = applyRuntimeEvents(plannedSession, events);

  return res.json(state);
}


