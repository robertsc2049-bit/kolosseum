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

/**
 * Planned session is immutable input. We only use it:
 * - to initialize runtime snapshot at START
 * - to silently upgrade legacy summaries that did not store exercise objects
 * Once started=true, we return only from the stored runtime snapshot.
 */

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

  if (t === "START_SESSION" || t === "SPLIT_SESSION" || t === "RETURN_CONTINUE" || t === "RETURN_SKIP") {
    return { ...(v as any), type: t } as RuntimeEvent;
  }

  return { ...(v as any), type: t } as RuntimeEvent;
}

/**
 * Runtime snapshot summary (authoritative once started=true).
 * Trace is derived from these lists only.
 */
type SplitSnapshot = {
  active: boolean;
  remaining_at_split_ids: string[];
};

type SessionSummaryV2 = {
  version: 2;
  started: boolean;
  remaining_exercises: PlannedExercise[];
  completed_exercises: PlannedExercise[];
  dropped_exercises: PlannedExercise[]; // product semantics: dropped == skipped
  split?: SplitSnapshot;
  last_seq: number; // 0 if none
};

type LegacySessionSummaryV1 = {
  started: boolean;
  remaining_ids: string[];
  completed_ids: string[];
  dropped_ids: string[];
  last_seq: number;
};

function toPlannedExercisesFromIds(planned: PlannedSession, ids: string[]): PlannedExercise[] {
  const plannedExercises = Array.isArray(planned?.exercises) ? planned.exercises : [];
  const byId = new Map<string, PlannedExercise>();
  for (const ex of plannedExercises) {
    if (ex && typeof ex.exercise_id === "string" && ex.exercise_id.length > 0) {
      byId.set(ex.exercise_id, ex);
    }
  }

  const out: PlannedExercise[] = [];
  for (const id of ids) {
    const ex = byId.get(id);
    if (ex) out.push(ex);
  }
  return out;
}

function summaryFromPlanned(planned: PlannedSession): SessionSummaryV2 {
  const exercises = Array.isArray(planned?.exercises) ? planned.exercises : [];
  const safeExercises: PlannedExercise[] = exercises
    .map((e) => (e && typeof e.exercise_id === "string" ? { exercise_id: e.exercise_id, source: "program" as const } : null))
    .filter(Boolean) as PlannedExercise[];

  return {
    version: 2,
    started: false,
    remaining_exercises: safeExercises,
    completed_exercises: [],
    dropped_exercises: [],
    split: undefined,
    last_seq: 0
  };
}

function isV2Summary(v: unknown): v is SessionSummaryV2 {
  if (!isRecord(v)) return false;
  return (
    v.version === 2 &&
    typeof (v as any).started === "boolean" &&
    Array.isArray((v as any).remaining_exercises) &&
    Array.isArray((v as any).completed_exercises) &&
    Array.isArray((v as any).dropped_exercises)
  );
}

function isV1Summary(v: unknown): v is LegacySessionSummaryV1 {
  if (!isRecord(v)) return false;
  return (
    typeof (v as any).started === "boolean" &&
    Array.isArray((v as any).remaining_ids) &&
    Array.isArray((v as any).completed_ids) &&
    Array.isArray((v as any).dropped_ids)
  );
}

function uniqueById(list: PlannedExercise[]): PlannedExercise[] {
  const seen = new Set<string>();
  const out: PlannedExercise[] = [];
  for (const ex of list) {
    if (!ex || typeof ex.exercise_id !== "string") continue;
    const id = ex.exercise_id;
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(ex);
  }
  return out;
}

function listHasId(list: PlannedExercise[], id: string): boolean {
  return list.some((e) => e.exercise_id === id);
}

function removeByIdFromList(list: PlannedExercise[], id: string): [PlannedExercise | undefined, PlannedExercise[]] {
  const idx = list.findIndex((e) => e.exercise_id === id);
  if (idx < 0) return [undefined, list];
  const found = list[idx];
  return [found, [...list.slice(0, idx), ...list.slice(idx + 1)]];
}

function dropByIdsPreserveOrder(
  remaining: PlannedExercise[],
  idsToDrop: Set<string>
): { remaining: PlannedExercise[]; dropped: PlannedExercise[] } {
  if (idsToDrop.size === 0) return { remaining, dropped: [] };

  const nextRemaining: PlannedExercise[] = [];
  const dropped: PlannedExercise[] = [];

  for (const ex of remaining) {
    if (idsToDrop.has(ex.exercise_id)) dropped.push(ex);
    else nextRemaining.push(ex);
  }

  return { remaining: nextRemaining, dropped };
}

function applyEventToSummaryV2(summary: SessionSummaryV2, ev: RuntimeEvent): SessionSummaryV2 {
  const out: SessionSummaryV2 = {
    ...summary,
    remaining_exercises: [...summary.remaining_exercises],
    completed_exercises: [...summary.completed_exercises],
    dropped_exercises: [...summary.dropped_exercises],
    split: summary.split ? { ...summary.split, remaining_at_split_ids: [...summary.split.remaining_at_split_ids] } : undefined
  };

  switch (ev.type) {
    case "START_SESSION": {
      out.started = true;
      out.remaining_exercises = uniqueById(out.remaining_exercises);
      out.completed_exercises = uniqueById(out.completed_exercises);
      out.dropped_exercises = uniqueById(out.dropped_exercises);
      return out;
    }

    case "COMPLETE_EXERCISE": {
      const exercise_id = (ev as any).exercise_id as string;
      if (typeof exercise_id !== "string" || exercise_id.length === 0) return out;

      if (listHasId(out.completed_exercises, exercise_id) || listHasId(out.dropped_exercises, exercise_id)) {
        const [, rem] = removeByIdFromList(out.remaining_exercises, exercise_id);
        out.remaining_exercises = rem;
        return out;
      }

      const [found, rem] = removeByIdFromList(out.remaining_exercises, exercise_id);
      out.remaining_exercises = rem;
      if (found) out.completed_exercises.push(found);
      return out;
    }

    case "SKIP_EXERCISE": {
      const exercise_id = (ev as any).exercise_id as string;
      if (typeof exercise_id !== "string" || exercise_id.length === 0) return out;

      if (listHasId(out.completed_exercises, exercise_id) || listHasId(out.dropped_exercises, exercise_id)) {
        const [, rem] = removeByIdFromList(out.remaining_exercises, exercise_id);
        out.remaining_exercises = rem;
        return out;
      }

      const [found, rem] = removeByIdFromList(out.remaining_exercises, exercise_id);
      out.remaining_exercises = rem;
      if (found) out.dropped_exercises.push(found);
      return out;
    }

    case "SPLIT_SESSION": {
      if (out.split?.active) return out;

      out.split = {
        active: true,
        remaining_at_split_ids: out.remaining_exercises.map((e) => e.exercise_id)
      };
      return out;
    }

    case "RETURN_CONTINUE": {
      if (!out.split?.active) return out;
      out.split = { ...out.split, active: false };
      return out;
    }

    case "RETURN_SKIP": {
      if (out.split?.active) {
        const stillRemainingIds = new Set(out.remaining_exercises.map((e) => e.exercise_id));
        const dropNow = new Set<string>();

        for (const id of out.split.remaining_at_split_ids) {
          if (stillRemainingIds.has(id)) dropNow.add(id);
        }

        const { remaining, dropped } = dropByIdsPreserveOrder(out.remaining_exercises, dropNow);
        out.remaining_exercises = remaining;
        if (dropped.length > 0) out.dropped_exercises.push(...dropped);

        out.split = { ...out.split, active: false };
        return out;
      }

      // No split active -> drop everything remaining, preserve order.
      if (out.remaining_exercises.length > 0) {
        out.dropped_exercises.push(...out.remaining_exercises);
        out.remaining_exercises = [];
      }
      return out;
    }

    default:
      return out;
  }
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

function normalizeSummary(planned: PlannedSession, raw: unknown): { summary: SessionSummaryV2; needsUpgrade: boolean } {
  if (isV2Summary(raw)) {
    return { summary: raw as SessionSummaryV2, needsUpgrade: false };
  }

  if (isV1Summary(raw)) {
    const v1 = raw as LegacySessionSummaryV1;

    const remaining_ids = (v1.remaining_ids ?? []).filter((x) => typeof x === "string" && x.length > 0);
    const completed_ids = (v1.completed_ids ?? []).filter((x) => typeof x === "string" && x.length > 0);
    const dropped_ids = (v1.dropped_ids ?? []).filter((x) => typeof x === "string" && x.length > 0);

    const upgraded: SessionSummaryV2 = {
      version: 2,
      started: v1.started === true,
      remaining_exercises: toPlannedExercisesFromIds(planned, remaining_ids),
      completed_exercises: toPlannedExercisesFromIds(planned, completed_ids),
      dropped_exercises: toPlannedExercisesFromIds(planned, dropped_ids),
      split: undefined,
      last_seq: Number((v1 as any).last_seq ?? 0)
    };

    return { summary: upgraded, needsUpgrade: true };
  }

  return { summary: summaryFromPlanned(planned), needsUpgrade: true };
}

function deriveTrace(summary: SessionSummaryV2) {
  return {
    started: summary.started,
    remaining_ids: summary.remaining_exercises.map((e) => e.exercise_id),
    completed_ids: summary.completed_exercises.map((e) => e.exercise_id),
    dropped_ids: summary.dropped_exercises.map((e) => e.exercise_id),
    split_active: summary.split?.active === true,
    remaining_at_split_ids: summary.split?.remaining_at_split_ids ?? []
  };
}

type SessionExerciseStatus = "pending" | "completed" | "skipped";

type SessionExerciseWithStatus = {
  exercise_id: string;
  source: "program";
  status: SessionExerciseStatus;
};

function deriveSessionExercises(summary: SessionSummaryV2): SessionExerciseWithStatus[] {
  // Deterministic ordering for UI:
  // 1) remaining (pending) in remaining order
  // 2) completed in completion order
  // 3) dropped (skipped) in drop order
  const out: SessionExerciseWithStatus[] = [];

  for (const ex of summary.remaining_exercises) {
    out.push({ exercise_id: ex.exercise_id, source: "program", status: "pending" });
  }
  for (const ex of summary.completed_exercises) {
    out.push({ exercise_id: ex.exercise_id, source: "program", status: "completed" });
  }
  for (const ex of summary.dropped_exercises) {
    out.push({ exercise_id: ex.exercise_id, source: "program", status: "skipped" });
  }

  return out;
}

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
    const { summary: normalized, needsUpgrade } = normalizeSummary(planned, s.session_state_summary);

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
    const ev: RuntimeEvent = { type: "START_SESSION" };

    await client.query(
      `INSERT INTO runtime_events(session_id, seq, event)
       VALUES ($1, $2, $3::jsonb)`,
      [session_id, seq, JSON.stringify(ev)]
    );

    const nextSummary = applyEventToSummaryV2(normalized, ev);
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
    try { await client.query("ROLLBACK"); } catch {}
    return res.status(400).json({ error: pgErrorMessage(err) });
  } finally {
    client.release();
  }
}

export async function appendRuntimeEvent(req: Request, res: Response) {
  const session_id = asString(req.params?.session_id);
  if (!session_id) return res.status(400).json({ error: "Missing session_id" });

  const event = validateRuntimeEvent((req.body as any)?.event);
  if (!event) return res.status(400).json({ error: "Missing/invalid event" });

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
    const { summary: normalized, needsUpgrade } = normalizeSummary(planned, s.session_state_summary);

    let workingSummary = normalized;

    if (workingSummary.started !== true) {
      const startSeq = await allocNextSeq(client, session_id);
      const startEv: RuntimeEvent = { type: "START_SESSION" };

      await client.query(
        `INSERT INTO runtime_events(session_id, seq, event)
         VALUES ($1, $2, $3::jsonb)`,
        [session_id, startSeq, JSON.stringify(startEv)]
      );

      workingSummary = applyEventToSummaryV2(workingSummary, startEv);
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

    const nextSummary = applyEventToSummaryV2(workingSummary, event);
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
    try { await client.query("ROLLBACK"); } catch {}
    return res.status(400).json({ error: pgErrorMessage(err) });
  } finally {
    client.release();
  }
}

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

export async function getSessionState(req: Request, res: Response) {
  const session_id = asString(req.params?.session_id);
  if (!session_id) return res.status(400).json({ error: "Missing session_id" });

  const client = await pool.connect();
  try {
    const row = await loadSession(client, session_id);
    if (!row) return res.status(404).json({ error: "Session not found" });

    const planned = row.planned_session as PlannedSession;
    const { summary, needsUpgrade } = normalizeSummary(planned, row.session_state_summary);

    if (needsUpgrade) {
      await client.query(
        `UPDATE sessions
         SET session_state_summary = $2::jsonb,
             updated_at = now()
         WHERE session_id = $1`,
        [session_id, JSON.stringify(summary)]
      );
    }

    const trace = deriveTrace(summary);
    const session_exercises = deriveSessionExercises(summary);

    return res.json({
      session_id,
      started: trace.started,

      // New: unified, status-bearing list (for UI + deterministic rendering)
      session_exercises,

      // Back-compat fields
      remaining_exercises: summary.remaining_exercises,
      completed_exercises: summary.completed_exercises,
      dropped_exercises: summary.dropped_exercises,

      trace,
      event_log: []
    });
  } catch (err: unknown) {
    return res.status(400).json({ error: pgErrorMessage(err) });
  } finally {
    client.release();
  }
}