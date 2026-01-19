import type { Request, Response } from "express";
import { pool } from "../db/pool.js";

import { applyRuntimeEvents } from "../../engine/src/runtime/apply_runtime_event.js";
import { assertRuntimeEvent } from "../../engine/src/runtime/runtime_event.js";
import type { RuntimeEvent } from "../../engine/src/runtime/runtime_event.js";
import type { Phase6SessionOutput } from "../../engine/src/phases/phase6.js";

import crypto from "node:crypto";

function getSessionIdParam(req: Request): string {
  const raw: unknown = (req as any).params?.session_id;

  if (typeof raw === "string" && raw.length > 0) return raw;

  if (Array.isArray(raw)) {
    const first = raw.find((x) => typeof x === "string" && x.length > 0);
    if (typeof first === "string") return first;
  }

  throw new Error("Missing session_id");
}

async function loadPlannedAndEvents(
  session_id: string,
  client?: { query: (q: string, p?: any[]) => Promise<any> }
): Promise<{ planned: Phase6SessionOutput; events: RuntimeEvent[] }> {
  const q = client?.query.bind(client) ?? pool.query.bind(pool);

  const sessionRes = await q(
    `SELECT planned_session FROM sessions WHERE session_id = $1`,
    [session_id]
  );

  if ((sessionRes.rowCount ?? 0) === 0) {
    throw new Error("Session not found");
  }

  const planned = sessionRes.rows[0].planned_session as Phase6SessionOutput;

  const eventsRes = await q(
    `
    SELECT seq, event
    FROM runtime_events
    WHERE session_id = $1
    ORDER BY seq ASC
    `,
    [session_id]
  );

  const events: RuntimeEvent[] = (eventsRes.rows as Array<{ event: RuntimeEvent }>).map(
    (r) => r.event
  );

  return { planned, events };
}

export async function createSession(req: Request, res: Response) {
  const planned = req.body?.planned_session as Phase6SessionOutput | undefined;

  if (!planned || typeof planned !== "object") {
    return res.status(400).json({ error: "Missing planned_session" });
  }

  const providedId =
    typeof (planned as any).session_id === "string" && (planned as any).session_id.length > 0
      ? (planned as any).session_id
      : undefined;

  const session_id = providedId ?? `s_${crypto.randomUUID().replace(/-/g, "")}`;
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
    return res.status(400).json({ error: err.message });
  }
}

export async function startSession(req: Request, res: Response) {
  let session_id: string;

  try {
    session_id = getSessionIdParam(req);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }

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
  let session_id: string;

  try {
    session_id = getSessionIdParam(req);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }

  const event = req.body?.event as RuntimeEvent | undefined;
  if (!event) {
    return res.status(400).json({ error: "Missing runtime event" });
  }

  try {
    assertRuntimeEvent(event);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { planned, events: existingEvents } = await loadPlannedAndEvents(session_id, client);

    applyRuntimeEvents(planned, [...existingEvents, event]);

    const maxRes = await client.query(
      `SELECT COALESCE(MAX(seq), 0) AS max_seq FROM runtime_events WHERE session_id = $1`,
      [session_id]
    );

    const lastSeq = Number(maxRes.rows[0]?.max_seq ?? 0);
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
    return res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
}

export async function getSessionState(req: Request, res: Response) {
  let session_id: string;

  try {
    session_id = getSessionIdParam(req);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }

  try {
    const { planned, events } = await loadPlannedAndEvents(session_id);
    const state = applyRuntimeEvents(planned, events);
    return res.json(state);
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    const status = msg === "Session not found" ? 404 : 400;
    return res.status(status).json({ error: msg });
  }
}
