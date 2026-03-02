// src/api/sessions.handlers.ts
import type { Request, Response } from "express";
import { pool } from "../db/pool.js";

import crypto from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import fs from "node:fs";

import {
  applyWireEvent,
  deriveTrace,
  normalizeSummary,
  validateWireRuntimeEvent
} from "@kolosseum/engine/runtime/session_summary.js";

import {
  badRequest,
  notFound,
  upstreamBadGateway,
  internalError
} from "./http_errors.js";

type JsonRecord = Record<string, unknown>;

function isRecord(v: unknown): v is JsonRecord {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

function mapEngineWireApplyError(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);

  if (msg.startsWith("PHASE6_RUNTIME_AWAIT_RETURN_DECISION")) {
    throw badRequest("Runtime event rejected (await return decision)", {
      failure_token: "phase6_runtime_await_return_decision",
      cause: msg
    });
  }
  if (msg.startsWith("PHASE6_RUNTIME_UNKNOWN_EVENT")) {
    throw badRequest("Runtime event rejected (unknown event type)", {
      failure_token: "phase6_runtime_unknown_event",
      cause: msg
    });
  }
  if (msg.startsWith("PHASE6_RUNTIME_INVALID_EVENT")) {
    throw badRequest("Runtime event rejected (invalid event shape)", {
      failure_token: "phase6_runtime_invalid_event",
      cause: msg
    });
  }

  // Default: unknown engine exception => server fault, not client fault.
  // This prevents misclassifying invariant bugs as 4xx.
  throw internalError("Runtime event rejected (unexpected engine error)", { cause: msg });
}

async function loadDefaultFixture(): Promise<any> {
  const fixture = resolve(process.cwd(), "test", "fixtures", "golden", "inputs", "vanilla_minimal.json");
  if (!fs.existsSync(fixture)) {
    throw internalError("Missing default fixture on server", { fixture });
  }
  return JSON.parse(fs.readFileSync(fixture, "utf8"));
}

async function runPipelineFromDist(input: any): Promise<any> {
  const runnerPath = resolve(process.cwd(), "dist", "src", "run_pipeline.js");
  if (!fs.existsSync(runnerPath)) {
    throw internalError("Missing dist runner (did you run build:fast?)", { runnerPath });
  }

  // ESM-safe import using file URL
  const url = pathToFileURL(runnerPath).href;
  const mod: any = await import(url);

  const fn = mod?.runPipeline || (mod?.default && (mod.default.runPipeline || mod.default));

  if (typeof fn !== "function") {
    throw internalError("Missing export runPipeline in dist runner", { runnerPath });
  }

  return await fn(input);
}

async function ensureEngineRunsTable(): Promise<void> {
  // This table is independent (no FK deps) so smoke can run even if the full schema isn't present.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS engine_runs (
      id          text PRIMARY KEY,
      kind        text NOT NULL,
      input_hash  text NOT NULL,
      input       jsonb NOT NULL,
      output      jsonb NOT NULL,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS engine_runs_kind_created_at_idx
    ON engine_runs(kind, created_at DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS engine_runs_input_hash_idx
    ON engine_runs(input_hash);
  `);
}

/**
 * ---------------------------
 * Vertical slice: plan session
 * POST /sessions/plan
 * ---------------------------
 *
 * - Calls dist runner (never engine src)
 * - Returns engine output
 * - Persists input/output row in engine_runs (best-effort)
 */
export async function planSession(req: Request, res: Response) {
  // body can be: { input: <engine-input> } or raw object treated as input
  const bodyUnknown = req.body as unknown;

  let input: any;
  if (isRecord(bodyUnknown)) input = (bodyUnknown as any).input ?? bodyUnknown;
  else if (typeof bodyUnknown === "undefined" || bodyUnknown === null) input = {};
  else {
    // express.json already parsed; if it's an array/primitive, treat as invalid request shape
    throw badRequest("Invalid JSON body (expected object)");
  }

  const effectiveInput =
    input && typeof input === "object" && Object.keys(input).length > 0
      ? input
      : await loadDefaultFixture();

  const inputStr = JSON.stringify(effectiveInput);
  const inputHash = sha256Hex(inputStr);

  const out = await runPipelineFromDist(effectiveInput);

  // Minimal invariants for vertical slice
  if (!out || out.ok !== true) {
    throw upstreamBadGateway("Engine output invalid (ok !== true)", { output: out ?? null });
  }

  if (!out.session || !Array.isArray(out.session.exercises) || out.session.exercises.length < 1) {
    throw upstreamBadGateway("Engine output invalid (missing session.exercises)", { output: out ?? null });
  }

  // Best-effort persistence. If DB is not configured (SMOKE_NO_DB), this is a no-op via NoDbPool.
  try {
    await ensureEngineRunsTable();
    const id = `er_${crypto.randomUUID().replace(/-/g, "")}`;

    await pool.query(
      `INSERT INTO engine_runs (id, kind, input_hash, input, output)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)`,
      [id, "plan_session", inputHash, JSON.stringify(effectiveInput), JSON.stringify(out)]
    );
  } catch {
    // Don't break response due to Tier-0 DB unavailability.
  }

  return res.status(200).json(out);
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
 * Contract upgrade:
 * - We DO NOT infer gate semantics at response time.
 * - We MAY map legacy fields -> new explicit fields during normalization/upgrade.
 *
 * Legacy: runtime.split_active (boolean)
 * New:    runtime.return_decision_required (boolean)
 *         runtime.return_decision_options  ("RETURN_CONTINUE" | "RETURN_SKIP")[]
 */
function ensureReturnDecisionContract(summary: any): { summary: any; changed: boolean } {
  const rt: any = summary?.runtime;
  if (!rt || typeof rt !== "object") return { summary, changed: false };

  const hasRequired = typeof rt.return_decision_required === "boolean";
  const hasOptions = Array.isArray(rt.return_decision_options);

  if (hasRequired && hasOptions) return { summary, changed: false };

  let changed = false;

  // Upgrade mapping: if legacy has split_active, map it into the explicit contract fields.
  // This is a one-way upgrade step, not response-time inference.
  const splitActive = typeof rt.split_active === "boolean" ? rt.split_active : false;

  if (!hasRequired) {
    rt.return_decision_required = splitActive === true;
    changed = true;
  }

  if (!hasOptions) {
    rt.return_decision_options = rt.return_decision_required === true ? ["RETURN_CONTINUE", "RETURN_SKIP"] : [];
    changed = true;
  }

  return { summary, changed };
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

  const rowCount = Number(r?.rowCount ?? 0);
  if (rowCount !== 1) {
    throw internalError("allocNextSeq invariant violated (expected 1 row)", { rowCount });
  }
  const nextSeq = Number(r.rows?.[0]?.next_seq);
  if (!Number.isFinite(nextSeq) || nextSeq < 1) {
    throw internalError("allocNextSeq invariant violated (invalid next_seq)", { next_seq: r.rows?.[0]?.next_seq });
  }
  return nextSeq;
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
  if (!session_id) throw badRequest("Missing session_id");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const s = await loadSessionForUpdate(client, session_id);
    if (!s) throw notFound("Session not found");

    const planned = s.planned_session as PlannedSession;
    const { summary: normalized, needsUpgrade } = normalizeSummary(planned as any, s.session_state_summary);

    // Ensure contract fields exist (upgrade step).
    const upgraded0 = ensureReturnDecisionContract(normalized);
    const shouldPersist0 = needsUpgrade || upgraded0.changed;

    // If already started, just ensure status + optionally upgrade summary
    if (upgraded0.summary.started === true) {
      await client.query(
        `UPDATE sessions
         SET status = 'in_progress',
             session_state_summary = $2::jsonb,
             updated_at = now()
         WHERE session_id = $1`,
        [session_id, JSON.stringify(shouldPersist0 ? upgraded0.summary : (s.session_state_summary ?? upgraded0.summary))]
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

    let nextSummary: any;
    try {
      nextSummary = applyWireEvent(upgraded0.summary as any, ev as any, planned as any) as any;
    } catch (e: unknown) {
      mapEngineWireApplyError(e);
    }
    nextSummary.last_seq = seq;

    // Ensure contract fields exist after reducer application.
    const upgraded1 = ensureReturnDecisionContract(nextSummary);

    await client.query(
      `UPDATE sessions
       SET status = 'in_progress',
           session_state_summary = $2::jsonb,
           updated_at = now()
       WHERE session_id = $1`,
      [session_id, JSON.stringify(upgraded1.summary)]
    );

    await client.query("COMMIT");
    return res.status(200).json({ ok: true, session_id, started: true, seq });
  } catch (err: unknown) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw err;
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
  if (!session_id) throw badRequest("Missing session_id");

  const event = validateWireRuntimeEvent((req.body as any)?.event);
  if (!event) throw badRequest("Missing/invalid event");

  // Prevent clients from manually writing START_SESSION via /events
  if ((event as any).type === "START_SESSION") {
    throw badRequest("START_SESSION must be created via /start");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const s = await loadSessionForUpdate(client, session_id);
    if (!s) throw notFound("Session not found");

    const planned = s.planned_session as PlannedSession;
    const { summary: normalized, needsUpgrade } = normalizeSummary(planned as any, s.session_state_summary);

    // Ensure contract fields exist (upgrade step).
    const upgraded0 = ensureReturnDecisionContract(normalized);
    const shouldPersist0 = needsUpgrade || upgraded0.changed;

    let workingSummary: any = upgraded0.summary;

    // Product-safe: auto-start if not started
    if (workingSummary.started !== true) {
      const startSeq = await allocNextSeq(client, session_id);
      const startEv = { type: "START_SESSION" };

      await client.query(
        `INSERT INTO runtime_events(session_id, seq, event)
         VALUES ($1, $2, $3::jsonb)`,
        [session_id, startSeq, JSON.stringify(startEv)]
      );

      try {
        workingSummary = applyWireEvent(workingSummary, startEv as any, planned as any);
      } catch (e: unknown) {
        mapEngineWireApplyError(e);
      }
      workingSummary.last_seq = startSeq;

      // Ensure contract fields exist after reducer application.
      workingSummary = ensureReturnDecisionContract(workingSummary).summary;

      await client.query(
        `UPDATE sessions
         SET status = 'in_progress',
             session_state_summary = $2::jsonb,
             updated_at = now()
         WHERE session_id = $1`,
        [session_id, JSON.stringify(workingSummary)]
      );
    } else if (shouldPersist0) {
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

    let nextSummary: any;
    try {
      nextSummary = applyWireEvent(workingSummary, event as any, planned as any) as any;
    } catch (e: unknown) {
      mapEngineWireApplyError(e);
    }
    nextSummary.last_seq = seq;

    // Ensure contract fields exist after reducer application.
    nextSummary = ensureReturnDecisionContract(nextSummary).summary;

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
    throw err;
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
  if (!session_id) throw badRequest("Missing session_id");

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
  if (!session_id) throw badRequest("Missing session_id");

  const client = await pool.connect();
  try {
    const row = await loadSession(client, session_id);
    if (!row) throw notFound("Session not found");

    const planned = row.planned_session as PlannedSession;
    const { summary: normalized, needsUpgrade } = normalizeSummary(planned as any, row.session_state_summary);

    // Ensure contract fields exist (upgrade step). No response-time inference.
    const upgraded = ensureReturnDecisionContract(normalized);
    const shouldPersist = needsUpgrade || upgraded.changed;

    // If legacy/invalid, upgrade storage silently (product-safe)
    if (shouldPersist) {
      await client.query(
        `UPDATE sessions
         SET session_state_summary = $2::jsonb,
             updated_at = now()
         WHERE session_id = $1`,
        [session_id, JSON.stringify(upgraded.summary)]
      );
    }

    const trace = deriveTrace(upgraded.summary as any) as any;

    // Contract lock:
    // Expose gate semantics ONLY via return_decision_* fields (never derive from split_active in response).
    const rt: any = (upgraded.summary as any)?.runtime ?? {};

    const return_decision_required: boolean =
      typeof rt?.return_decision_required === "boolean" ? rt.return_decision_required : false;

    const return_decision_options: Array<"RETURN_CONTINUE" | "RETURN_SKIP"> =
      Array.isArray(rt?.return_decision_options)
        ? rt.return_decision_options
            .map((x: any) => String(x))
            .filter((x: string) => x === "RETURN_CONTINUE" || x === "RETURN_SKIP")
        : [];

    trace.return_decision_required = return_decision_required;
    trace.return_decision_options = return_decision_options;

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
  } finally {
    client.release();
  }
}