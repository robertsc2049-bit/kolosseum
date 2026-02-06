// src/api/sessions.handlers.ts
import type { Request, Response } from "express";
import { pool } from "../db/pool.js";

// Canonical semantics live in the engine runtime reducer.
// API is a thin wrapper: validate wire event -> map -> reducer -> persist snapshot.
import { applyRuntimeEvent, makeRuntimeState } from "../../engine/src/runtime/session_runtime.js";
import type { RuntimeEvent as EngineRuntimeEvent, RuntimeState as EngineRuntimeState } from "../../engine/src/runtime/types.js";

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

/**
 * Wire/runtime events as stored in DB runtime_events.event (back-compat).
 * We accept these types, store them as-is, and map to engine runtime events for semantics.
 */
type WireRuntimeEvent =
  | { type: "START_SESSION" }
  | { type: "COMPLETE_EXERCISE"; exercise_id: string }
  | { type: "SKIP_EXERCISE"; exercise_id: string }
  | { type: "SPLIT_SESSION" }
  | { type: "RETURN_CONTINUE" }
  | { type: "RETURN_SKIP" }
  | ({ type: string } & JsonRecord);

function validateWireRuntimeEvent(v: unknown): WireRuntimeEvent | null {
  if (!isRecord(v)) return null;
  const t = asString(v.type);
  if (!t) return null;

  if (t === "COMPLETE_EXERCISE" || t === "SKIP_EXERCISE") {
    const exercise_id = asString((v as any).exercise_id);
    if (!exercise_id) return null;
    return { ...(v as any), type: t, exercise_id } as WireRuntimeEvent;
  }

  if (t === "START_SESSION" || t === "SPLIT_SESSION" || t === "RETURN_CONTINUE" || t === "RETURN_SKIP") {
    return { ...(v as any), type: t } as WireRuntimeEvent;
  }

  // Forward compatible: store unknown types; they do not affect runtime snapshot.
  return { ...(v as any), type: t } as WireRuntimeEvent;
}

/**
 * JSONB storage form for runtime state (engine uses Sets).
 * This is purely a serialization container — semantics are from reducer.
 */
type RuntimeStateJson = {
  remaining_ids: string[];
  completed_ids: string[];
  skipped_ids: string[];
  split?: {
    active: boolean;
    remaining_at_split: string[];
  };
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

/**
 * Engine <-> JSON conversions.
 * Important: we DO NOT re-implement invariants here.
 * - We reconstruct state through the reducer when upgrading legacy summaries.
 * - For V3, we accept stored snapshot and only "scope to plan" (safety), not semantics.
 */
function fromEngineState(state: EngineRuntimeState): RuntimeStateJson {
  return {
    remaining_ids: Array.isArray(state.remaining_ids) ? [...state.remaining_ids] : [],
    completed_ids: Array.from(state.completed_ids ?? []),
    skipped_ids: Array.from(state.skipped_ids ?? []),
    split: state.split ? { active: state.split.active === true, remaining_at_split: [...state.split.remaining_at_split] } : undefined
  };
}

function scopeRuntimeJsonToPlan(planned_ids: string[], rt: RuntimeStateJson): RuntimeStateJson {
  const allowed = new Set(planned_ids);
  const remaining_ids = uniqStable(rt.remaining_ids).filter((id) => allowed.has(id));
  const completed_ids = uniqStable(rt.completed_ids).filter((id) => allowed.has(id));
  const skipped_ids = uniqStable(rt.skipped_ids).filter((id) => allowed.has(id));

  const split =
    rt.split && typeof rt.split === "object"
      ? {
          active: rt.split.active === true,
          remaining_at_split: uniqStable(rt.split.remaining_at_split).filter((id) => allowed.has(id))
        }
      : undefined;

  return { remaining_ids, completed_ids, skipped_ids, split };
}

function engineStateFromV3Snapshot(planned_ids: string[], raw: unknown): EngineRuntimeState {
  // Start from plan (gives a stable base ordering), then restore terminals via reducer.
  const base = makeRuntimeState(planned_ids);

  const rtRaw: RuntimeStateJson = isRecord(raw)
    ? {
        remaining_ids: uniqStable((raw as any).remaining_ids),
        completed_ids: uniqStable((raw as any).completed_ids),
        skipped_ids: uniqStable((raw as any).skipped_ids),
        split: isRecord((raw as any).split)
          ? {
              active: (raw as any).split.active === true,
              remaining_at_split: uniqStable((raw as any).split.remaining_at_split)
            }
          : undefined
      }
    : { remaining_ids: [], completed_ids: [], skipped_ids: [], split: undefined };

  const scoped = scopeRuntimeJsonToPlan(planned_ids, rtRaw);

  // Rebuild terminals through reducer to guarantee invariants.
  let st = base;
  for (const id of scoped.completed_ids) st = applyRuntimeEvent(st, { type: "complete_exercise", exercise_id: id });
  for (const id of scoped.skipped_ids) st = applyRuntimeEvent(st, { type: "skip_exercise", exercise_id: id });

  // Remaining_ids is implicitly "plan minus terminals" at this point (engine invariant).
  // Restore split shape as stored (it is runtime state data, not a second semantics implementation).
  if (scoped.split) {
    st = {
      ...st,
      split: {
        active: scoped.split.active === true,
        remaining_at_split: [...scoped.split.remaining_at_split]
      }
    };
  }

  return st;
}

/**
 * Summary formats:
 * - V1: legacy ids lists (no split)
 * - V2: legacy lists of exercise objects + split snapshot
 * - V3: canonical engine runtime state JSON snapshot
 */

type SessionSummaryV3 = {
  version: 3;
  started: boolean;
  runtime: RuntimeStateJson;
  last_seq: number; // 0 if none
};

type SplitSnapshotV2 = {
  active: boolean;
  remaining_at_split_ids: string[];
};

type SessionSummaryV2 = {
  version: 2;
  started: boolean;
  remaining_exercises: PlannedExercise[];
  completed_exercises: PlannedExercise[];
  dropped_exercises: PlannedExercise[];
  split?: SplitSnapshotV2;
  last_seq: number;
};

type LegacySessionSummaryV1 = {
  started: boolean;
  remaining_ids: string[];
  completed_ids: string[];
  dropped_ids: string[];
  last_seq: number;
};

function isV3Summary(v: unknown): v is SessionSummaryV3 {
  if (!isRecord(v)) return false;
  if (v.version !== 3) return false;
  if (typeof (v as any).started !== "boolean") return false;
  if (!isRecord((v as any).runtime)) return false;
  return typeof (v as any).last_seq === "number" || typeof (v as any).last_seq === "string";
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

function summaryFromPlanned(planned: PlannedSession): SessionSummaryV3 {
  const ids = plannedIds(planned);
  const runtime = fromEngineState(makeRuntimeState(ids));
  return { version: 3, started: false, runtime, last_seq: 0 };
}

function summaryV3FromLegacy(planned: PlannedSession, legacy: LegacySessionSummaryV1 | SessionSummaryV2): SessionSummaryV3 {
  const ids = plannedIds(planned);

  const completed_ids =
    "completed_ids" in legacy
      ? uniqStable((legacy as any).completed_ids)
      : uniqStable((legacy as any).completed_exercises?.map((e: any) => e?.exercise_id));

  const skipped_ids =
    "dropped_ids" in legacy
      ? uniqStable((legacy as any).dropped_ids)
      : uniqStable((legacy as any).dropped_exercises?.map((e: any) => e?.exercise_id));

  let st = makeRuntimeState(ids);
  for (const id of completed_ids) st = applyRuntimeEvent(st, { type: "complete_exercise", exercise_id: id });
  for (const id of skipped_ids) st = applyRuntimeEvent(st, { type: "skip_exercise", exercise_id: id });

  // Preserve any legacy split snapshot if present.
  const splitV2 = (legacy as any).split;
  if (splitV2 && typeof splitV2 === "object") {
    st = {
      ...st,
      split: {
        active: splitV2.active === true,
        remaining_at_split: uniqStable(splitV2.remaining_at_split_ids)
      }
    };
  }

  const last_seq = Number((legacy as any).last_seq ?? 0);
  return {
    version: 3,
    started: (legacy as any).started === true,
    runtime: fromEngineState(st),
    last_seq
  };
}

function normalizeSummary(planned: PlannedSession, raw: unknown): { summary: SessionSummaryV3; needsUpgrade: boolean } {
  // Canonical V3: scope to plan + rebuild terminals through reducer (no API semantics).
  if (isV3Summary(raw)) {
    const ids = plannedIds(planned);
    const last_seq = Number((raw as any).last_seq ?? 0);
    const started = (raw as any).started === true;

    const st = engineStateFromV3Snapshot(ids, (raw as any).runtime);
    const runtime = fromEngineState(st);

    // upgrade storage if last_seq coerces, runtime shape normalizes, or version mismatch
    const needs =
      (raw as any).version !== 3 ||
      Number((raw as any).last_seq ?? 0) !== last_seq ||
      JSON.stringify((raw as any).runtime) !== JSON.stringify(runtime);

    return { summary: { version: 3, started, runtime, last_seq }, needsUpgrade: needs };
  }

  // Legacy -> V3 via reducer reconstruction
  if (isV2Summary(raw) || isV1Summary(raw)) {
    return { summary: summaryV3FromLegacy(planned, raw as any), needsUpgrade: true };
  }

  // Unknown -> fresh V3
  return { summary: summaryFromPlanned(planned), needsUpgrade: true };
}

/**
 * Wire -> engine event mapping.
 * Unknown wire events are accepted/stored but do not mutate runtime snapshot.
 */
function toEngineEvent(w: WireRuntimeEvent): EngineRuntimeEvent | null {
  switch (w.type) {
    case "COMPLETE_EXERCISE":
      return { type: "complete_exercise", exercise_id: (w as any).exercise_id as string };
    case "SKIP_EXERCISE":
      return { type: "skip_exercise", exercise_id: (w as any).exercise_id as string };
    case "SPLIT_SESSION":
      return { type: "split_start" };
    case "RETURN_CONTINUE":
      return { type: "split_return_continue" };
    case "RETURN_SKIP":
      return { type: "split_return_skip" };
    default:
      return null;
  }
}

function applyWireEvent(summary: SessionSummaryV3, ev: WireRuntimeEvent, planned: PlannedSession): SessionSummaryV3 {
  // START is API-level: it flips started and initializes runtime snapshot from plan (via reducer base).
  if (ev.type === "START_SESSION") {
    const ids = plannedIds(planned);
    const st = makeRuntimeState(ids);
    return { ...summary, started: true, runtime: fromEngineState(st) };
  }

  const engineEv = toEngineEvent(ev);
  if (!engineEv) return summary; // forward-compatible: no-op for unknown types

  const ids = plannedIds(planned);
  const st = engineStateFromV3Snapshot(ids, summary.runtime);
  const next = applyRuntimeEvent(st, engineEv);
  return { ...summary, runtime: fromEngineState(next) };
}

function deriveTrace(summary: SessionSummaryV3) {
  const rt = summary.runtime;
  return {
    started: summary.started === true,
    remaining_ids: uniqStable(rt.remaining_ids),
    completed_ids: uniqStable(rt.completed_ids),
    dropped_ids: uniqStable(rt.skipped_ids),
    split_active: rt.split?.active === true,
    remaining_at_split_ids: rt.split?.remaining_at_split ? uniqStable(rt.split.remaining_at_split) : []
  };
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
    const { summary: normalized, needsUpgrade } = normalizeSummary(planned, s.session_state_summary);

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
    const ev: WireRuntimeEvent = { type: "START_SESSION" };

    await client.query(
      `INSERT INTO runtime_events(session_id, seq, event)
       VALUES ($1, $2, $3::jsonb)`,
      [session_id, seq, JSON.stringify(ev)]
    );

    const nextSummary = applyWireEvent(normalized, ev, planned);
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

    // Product-safe: auto-start if not started
    if (workingSummary.started !== true) {
      const startSeq = await allocNextSeq(client, session_id);
      const startEv: WireRuntimeEvent = { type: "START_SESSION" };

      await client.query(
        `INSERT INTO runtime_events(session_id, seq, event)
         VALUES ($1, $2, $3::jsonb)`,
        [session_id, startSeq, JSON.stringify(startEv)]
      );

      workingSummary = applyWireEvent(workingSummary, startEv, planned);
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

    const nextSummary = applyWireEvent(workingSummary, event, planned);
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
    const { summary, needsUpgrade } = normalizeSummary(planned, row.session_state_summary);

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

    const trace = deriveTrace(summary);

    // Derive exercise objects from planned + runtime ids (order-preserving)
    const remaining_exercises = toPlannedExercisesFromIds(planned, trace.remaining_ids);
    const completed_exercises = toPlannedExercisesFromIds(planned, trace.completed_ids);
    const dropped_exercises = toPlannedExercisesFromIds(planned, trace.dropped_ids);

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