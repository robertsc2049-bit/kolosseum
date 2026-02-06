// src/api/sessions.handlers.ts
import type { Request, Response } from "express";
import { pool } from "../db/pool.js";

// Canonical semantics: API maps wire events -> engine runtime reducer.
// One reducer. One state model. One set of invariants.
import { applyRuntimeEvent, makeRuntimeState } from "../../engine/src/runtime/session_runtime.js";
import type {
  RuntimeEvent as EngineRuntimeEvent,
  RuntimeState as EngineRuntimeState
} from "../../engine/src/runtime/types.js";

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
 * - to upgrade legacy summaries
 * Once started=true, response trace and lists are derived ONLY from stored runtime snapshot.
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

  if (
    t === "START_SESSION" ||
    t === "SPLIT_SESSION" ||
    t === "RETURN_CONTINUE" ||
    t === "RETURN_SKIP"
  ) {
    return { ...(v as any), type: t } as WireRuntimeEvent;
  }

  // Forward compatible: store unknown types, but they do not mutate summary.
  return { ...(v as any), type: t } as WireRuntimeEvent;
}

/**
 * Engine runtime state is Set-heavy; summaries are JSONB.
 * We store a JSON-serialised runtime state (arrays) as V3 summary.
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

function uniqStable(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = typeof raw === "string" ? raw : String(raw ?? "");
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function normalizeRuntimeJson(rs: RuntimeStateJson): RuntimeStateJson {
  const completed = uniqStable(Array.isArray(rs.completed_ids) ? rs.completed_ids : []);
  const skipped = uniqStable(Array.isArray(rs.skipped_ids) ? rs.skipped_ids : []);
  const terminal = new Set<string>([...completed, ...skipped]);

  const remainingRaw = Array.isArray(rs.remaining_ids) ? rs.remaining_ids : [];
  const remaining = uniqStable(remainingRaw).filter((id) => !terminal.has(id));

  let split: RuntimeStateJson["split"] = undefined;
  if (rs.split && typeof rs.split === "object") {
    const active = rs.split.active === true;
    const snap = uniqStable(Array.isArray(rs.split.remaining_at_split) ? rs.split.remaining_at_split : []);
    split = { active, remaining_at_split: snap };
  }

  // Also ensure split snapshot doesn't contain terminal ids
  if (split) {
    const cleanedSnap = split.remaining_at_split.filter((id) => !terminal.has(id));
    split = { ...split, remaining_at_split: cleanedSnap };
  }

  return {
    remaining_ids: remaining,
    completed_ids: completed,
    skipped_ids: skipped,
    split
  };
}

function toEngineState(rs: RuntimeStateJson): EngineRuntimeState {
  const n = normalizeRuntimeJson(rs);
  return {
    remaining_ids: [...n.remaining_ids],
    completed_ids: new Set(n.completed_ids),
    skipped_ids: new Set(n.skipped_ids),
    split: n.split ? { active: n.split.active, remaining_at_split: [...n.split.remaining_at_split] } : undefined
  };
}

function fromEngineState(state: EngineRuntimeState): RuntimeStateJson {
  const out: RuntimeStateJson = {
    remaining_ids: uniqStable(Array.isArray(state.remaining_ids) ? state.remaining_ids : []),
    completed_ids: uniqStable(Array.from(state.completed_ids ?? [])),
    skipped_ids: uniqStable(Array.from(state.skipped_ids ?? [])),
    split: state.split
      ? {
          active: state.split.active === true,
          remaining_at_split: uniqStable(Array.isArray(state.split.remaining_at_split) ? state.split.remaining_at_split : [])
        }
      : undefined
  };
  return normalizeRuntimeJson(out);
}

function applyEngineEventJson(rs: RuntimeStateJson, ev: EngineRuntimeEvent): RuntimeStateJson {
  const next = applyRuntimeEvent(toEngineState(rs), ev);
  return fromEngineState(next);
}

function plannedIds(planned: PlannedSession): string[] {
  const exs = Array.isArray(planned?.exercises) ? planned.exercises : [];
  return uniqStable(
    exs
      .map((e) => (e && typeof e.exercise_id === "string" ? e.exercise_id : ""))
      .filter(Boolean)
  );
}

function toPlannedExercisesFromIds(planned: PlannedSession, ids: string[]): PlannedExercise[] {
  const exs = Array.isArray(planned?.exercises) ? planned.exercises : [];
  const byId = new Map<string, PlannedExercise>();
  for (const ex of exs) {
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

/**
 * Summary formats:
 * - V1: legacy ids lists (no split)
 * - V2: legacy lists of exercise objects + split snapshot (API-owned semantics)
 * - V3: engine runtime state JSON (canonical)
 */

type SessionSummaryV3 = {
  version: 3;
  started: boolean;
  runtime: RuntimeStateJson; // canonical
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
  return v.version === 2 &&
    typeof (v as any).started === "boolean" &&
    Array.isArray((v as any).remaining_exercises) &&
    Array.isArray((v as any).completed_exercises) &&
    Array.isArray((v as any).dropped_exercises);
}

function isV1Summary(v: unknown): v is LegacySessionSummaryV1 {
  if (!isRecord(v)) return false;
  return typeof (v as any).started === "boolean" &&
    Array.isArray((v as any).remaining_ids) &&
    Array.isArray((v as any).completed_ids) &&
    Array.isArray((v as any).dropped_ids);
}

function summaryFromPlanned(planned: PlannedSession): SessionSummaryV3 {
  const ids = plannedIds(planned);
  const base = fromEngineState(makeRuntimeState(ids));
  return {
    version: 3,
    started: false,
    runtime: base,
    last_seq: 0
  };
}

function summaryV3FromV2(planned: PlannedSession, v2: SessionSummaryV2): SessionSummaryV3 {
  const remaining_ids = uniqStable((v2.remaining_exercises ?? []).map((e) => e?.exercise_id).filter(Boolean) as string[]);
  const completed_ids = uniqStable((v2.completed_exercises ?? []).map((e) => e?.exercise_id).filter(Boolean) as string[]);
  const skipped_ids = uniqStable((v2.dropped_exercises ?? []).map((e) => e?.exercise_id).filter(Boolean) as string[]);

  const rt: RuntimeStateJson = normalizeRuntimeJson({
    remaining_ids,
    completed_ids,
    skipped_ids,
    split: v2.split
      ? {
          active: v2.split.active === true,
          remaining_at_split: uniqStable((v2.split.remaining_at_split_ids ?? []).filter((x) => typeof x === "string") as string[])
        }
      : undefined
  });

  // Ensure runtime is scoped to planned ids only (hard safety, deterministic)
  const allowed = new Set(plannedIds(planned));
  const scoped = normalizeRuntimeJson({
    remaining_ids: rt.remaining_ids.filter((id) => allowed.has(id)),
    completed_ids: rt.completed_ids.filter((id) => allowed.has(id)),
    skipped_ids: rt.skipped_ids.filter((id) => allowed.has(id)),
    split: rt.split
      ? {
          active: rt.split.active,
          remaining_at_split: rt.split.remaining_at_split.filter((id) => allowed.has(id))
        }
      : undefined
  });

  return {
    version: 3,
    started: v2.started === true,
    runtime: scoped,
    last_seq: Number((v2 as any).last_seq ?? 0)
  };
}

function summaryV3FromV1(planned: PlannedSession, v1: LegacySessionSummaryV1): SessionSummaryV3 {
  const remaining_ids = uniqStable((v1.remaining_ids ?? []).filter((x) => typeof x === "string") as string[]);
  const completed_ids = uniqStable((v1.completed_ids ?? []).filter((x) => typeof x === "string") as string[]);
  const skipped_ids = uniqStable((v1.dropped_ids ?? []).filter((x) => typeof x === "string") as string[]);

  const rt: RuntimeStateJson = normalizeRuntimeJson({
    remaining_ids,
    completed_ids,
    skipped_ids,
    split: undefined
  });

  const allowed = new Set(plannedIds(planned));
  const scoped = normalizeRuntimeJson({
    remaining_ids: rt.remaining_ids.filter((id) => allowed.has(id)),
    completed_ids: rt.completed_ids.filter((id) => allowed.has(id)),
    skipped_ids: rt.skipped_ids.filter((id) => allowed.has(id)),
    split: undefined
  });

  return {
    version: 3,
    started: v1.started === true,
    runtime: scoped,
    last_seq: Number((v1 as any).last_seq ?? 0)
  };
}

function normalizeSummary(planned: PlannedSession, raw: unknown): { summary: SessionSummaryV3; needsUpgrade: boolean } {
  if (isV3Summary(raw)) {
    const s = raw as SessionSummaryV3;
    const rt = normalizeRuntimeJson((s as any).runtime as RuntimeStateJson);

    // Also enforce planned scoping on every load (product-safe)
    const allowed = new Set(plannedIds(planned));
    const scoped = normalizeRuntimeJson({
      remaining_ids: rt.remaining_ids.filter((id) => allowed.has(id)),
      completed_ids: rt.completed_ids.filter((id) => allowed.has(id)),
      skipped_ids: rt.skipped_ids.filter((id) => allowed.has(id)),
      split: rt.split
        ? {
            active: rt.split.active,
            remaining_at_split: rt.split.remaining_at_split.filter((id) => allowed.has(id))
          }
        : undefined
    });

    const fixed: SessionSummaryV3 = {
      version: 3,
      started: s.started === true,
      runtime: scoped,
      last_seq: Number((s as any).last_seq ?? 0)
    };

    // If runtime changed due to normalization, upgrade storage.
    const needs = JSON.stringify((s as any).runtime) !== JSON.stringify(fixed.runtime) ||
      Number((s as any).last_seq ?? 0) !== fixed.last_seq ||
      (s as any).version !== 3;

    return { summary: fixed, needsUpgrade: needs };
  }

  if (isV2Summary(raw)) {
    return { summary: summaryV3FromV2(planned, raw as SessionSummaryV2), needsUpgrade: true };
  }

  if (isV1Summary(raw)) {
    return { summary: summaryV3FromV1(planned, raw as LegacySessionSummaryV1), needsUpgrade: true };
  }

  return { summary: summaryFromPlanned(planned), needsUpgrade: true };
}

function deriveTrace(summary: SessionSummaryV3) {
  const rt = normalizeRuntimeJson(summary.runtime);
  return {
    started: summary.started === true,
    remaining_ids: rt.remaining_ids,
    completed_ids: rt.completed_ids,
    dropped_ids: rt.skipped_ids,
    split_active: rt.split?.active === true,
    remaining_at_split_ids: rt.split?.remaining_at_split ?? []
  };
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

function applyWireEventToSummaryV3(summary: SessionSummaryV3, ev: WireRuntimeEvent): SessionSummaryV3 {
  const out: SessionSummaryV3 = {
    ...summary,
    runtime: normalizeRuntimeJson(summary.runtime),
    last_seq: Number(summary.last_seq ?? 0)
  };

  if (ev.type === "START_SESSION") {
    out.started = true;
    // Deterministic normalization only; runtime ids already scoped.
    out.runtime = normalizeRuntimeJson(out.runtime);
    return out;
  }

  const engineEv = toEngineEvent(ev);
  if (!engineEv) {
    // Unknown event types do not mutate runtime snapshot (forward compatible).
    return out;
  }

  out.runtime = applyEngineEventJson(out.runtime, engineEv);
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
    const { summary: normalized, needsUpgrade } = normalizeSummary(planned, s.session_state_summary);

    // If already started, ensure status and (optionally) upgrade stored summary
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

    const nextSummary = applyWireEventToSummaryV3(normalized, ev);
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

/**
 * POST /sessions/:session_id/events
 * body: { event: {...} }
 * - allocates seq O(1)
 * - inserts runtime_events row
 * - updates session_state_summary incrementally (V3, engine canonical)
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

    // If not started, auto-start (product-safe)
    if (workingSummary.started !== true) {
      const startSeq = await allocNextSeq(client, session_id);
      const startEv: WireRuntimeEvent = { type: "START_SESSION" };

      await client.query(
        `INSERT INTO runtime_events(session_id, seq, event)
         VALUES ($1, $2, $3::jsonb)`,
        [session_id, startSeq, JSON.stringify(startEv)]
      );

      workingSummary = applyWireEventToSummaryV3(workingSummary, startEv);
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
      // Persist upgraded V3 snapshot even if started already
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

    const nextSummary = applyWireEventToSummaryV3(workingSummary, event);
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
 * - Once started=true, response is derived ONLY from the stored runtime snapshot.
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