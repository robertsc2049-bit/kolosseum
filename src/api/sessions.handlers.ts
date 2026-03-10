/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { assertNextSessionEventSequence } from "../domain/session_event_sequence.js";
import {
  type PlannedSession,
  ensureReturnDecisionContract,
  invalidateSessionStateCache,
  loadSessionStateRow,
  projectSessionStatePayload,
  readCachedSessionState,
  uniqStable,
  writeCachedSessionState
} from "./session_state_read_model.js";

type JsonRecord = Record<string, unknown>;

function __kolosseumWireSentinel(evt: any) {
  if (process.env.KOLOSSEUM_TEST_FORCE_WIRE_APPLY_THROW !== "1") return;
  const t = typeof evt?.type === "string" ? String(evt.type).toUpperCase() : "";
  if (!t.includes("START")) {
    throw new Error("KOLOSSEUM_TEST_FORCE_WIRE_APPLY_THROW: unhandled wire apply failure sentinel");
  }
}

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

  const url = pathToFileURL(runnerPath).href;
  const mod: any = await import(url);

  const fn = mod?.runPipeline || (mod?.default && (mod.default.runPipeline || mod.default));

  if (typeof fn !== "function") {
    throw internalError("Missing export runPipeline in dist runner", { runnerPath });
  }

  return await fn(input);
}

async function ensureEngineRunsTable(): Promise<void> {
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

export async function planSession(req: Request, res: Response) {
  const bodyUnknown = req.body as unknown;

  let input: any;
  if (isRecord(bodyUnknown)) input = (bodyUnknown as any).input ?? bodyUnknown;
  else if (typeof bodyUnknown === "undefined" || bodyUnknown === null) input = {};
  else throw badRequest("Invalid JSON body (expected object)");

  const effectiveInput =
    input && typeof input === "object" && Object.keys(input).length > 0
      ? input
      : await loadDefaultFixture();

  const inputStr = JSON.stringify(effectiveInput);
  const inputHash = sha256Hex(inputStr);

  const out = await runPipelineFromDist(effectiveInput);

  if (!out || out.ok !== true) {
    throw upstreamBadGateway("Engine output invalid (ok !== true)", { output: out ?? null });
  }

  if (!out.session || !Array.isArray(out.session.exercises) || out.session.exercises.length < 1) {
    throw upstreamBadGateway("Engine output invalid (missing session.exercises)", { output: out ?? null });
  }

  try {
    await ensureEngineRunsTable();
    const id = `er_${crypto.randomUUID().replace(/-/g, "")}`;

    await pool.query(
      `INSERT INTO engine_runs (id, kind, input_hash, input, output)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)`,
      [id, "plan_session", inputHash, JSON.stringify(effectiveInput), JSON.stringify(out)]
    );
  } catch {
    // best-effort
  }

  return res.status(200).json(out);
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
  if (rowCount !== 1) throw internalError("allocNextSeq invariant violated (expected 1 row)", { rowCount });

  const nextSeq = Number(r.rows?.[0]?.next_seq);
  if (!Number.isFinite(nextSeq) || nextSeq < 1) {
    throw internalError("allocNextSeq invariant violated (invalid next_seq)", { next_seq: r.rows?.[0]?.next_seq });
  }

  assertNextSessionEventSequence(nextSeq - 1, nextSeq);

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

function extractRawEvent(req: Request): unknown {
  const body = req.body as any;
  if (!body || typeof body !== "object") return null;
  return body.event ?? null;
}

function rawEventType(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const t = (raw as any).type;
  if (typeof t !== "string" || t.length === 0) return null;
  return t;
}

function isApiCompleteStep(raw: unknown): boolean {
  const t = rawEventType(raw);
  return t === "COMPLETE_STEP";
}

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

    const upgraded0 = ensureReturnDecisionContract(normalized, deriveTrace);
    const shouldPersist0 = needsUpgrade || upgraded0.changed;

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
      invalidateSessionStateCache(session_id);
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
      __kolosseumWireSentinel(ev as any);
      nextSummary = applyWireEvent(upgraded0.summary as any, ev as any, planned as any) as any;
    } catch (e: unknown) {
      mapEngineWireApplyError(e);
    }

    nextSummary.last_seq = seq;

    const upgraded1 = ensureReturnDecisionContract(nextSummary, deriveTrace);

    await client.query(
      `UPDATE sessions
       SET status = 'in_progress',
           session_state_summary = $2::jsonb,
           updated_at = now()
       WHERE session_id = $1`,
      [session_id, JSON.stringify(upgraded1.summary)]
    );

    await client.query("COMMIT");
    invalidateSessionStateCache(session_id);

    return res.status(200).json({ ok: true, session_id, started: true, seq });
  } catch (err: unknown) {
    try { await client.query("ROLLBACK"); } catch {}
    throw err;
  } finally {
    client.release();
  }
}

export async function appendRuntimeEvent(req: Request, res: Response) {
  const session_id = asString(req.params?.session_id);
  if (!session_id) throw badRequest("Missing session_id");

  const raw = extractRawEvent(req);
  if (!raw) throw badRequest("Missing/invalid event");

  if (rawEventType(raw) === "START_SESSION") {
    throw badRequest("START_SESSION must be created via /start");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const s = await loadSessionForUpdate(client, session_id);
    if (!s) throw notFound("Session not found");

    if (
      process.env.KOLOSSEUM_HTTP_E2E_UNKNOWN_ENGINE_500 === "1" &&
      rawEventType(raw) === "E2E_FORCE_UNKNOWN_ENGINE_ERROR"
    ) {
      mapEngineWireApplyError(new Error("E2E_FORCED_UNKNOWN_ENGINE_EXCEPTION"));
    }

    const planned = s.planned_session as PlannedSession;
    const { summary: normalized, needsUpgrade } = normalizeSummary(planned as any, s.session_state_summary);

    const upgraded0 = ensureReturnDecisionContract(normalized, deriveTrace);
    const shouldPersist0 = needsUpgrade || upgraded0.changed;

    let workingSummary: any = upgraded0.summary;

    if (workingSummary.started !== true) {
      const startSeq = await allocNextSeq(client, session_id);
      const startEv = { type: "START_SESSION" };

      await client.query(
        `INSERT INTO runtime_events(session_id, seq, event)
         VALUES ($1, $2, $3::jsonb)`,
        [session_id, startSeq, JSON.stringify(startEv)]
      );

      try {
        __kolosseumWireSentinel(startEv as any);
        workingSummary = applyWireEvent(workingSummary, startEv as any, planned as any);
      } catch (e: unknown) {
        mapEngineWireApplyError(e);
      }

      workingSummary.last_seq = startSeq;
      workingSummary = ensureReturnDecisionContract(workingSummary, deriveTrace).summary;

      await client.query(
        `UPDATE sessions
         SET status = 'in_progress',
             session_state_summary = $2::jsonb,
             updated_at = now()
         WHERE session_id = $1`,
        [session_id, JSON.stringify(workingSummary)]
      );
    } else if (shouldPersist0) {
      await client.query(
        `UPDATE sessions
         SET session_state_summary = $2::jsonb,
             updated_at = now()
         WHERE session_id = $1`,
        [session_id, JSON.stringify(workingSummary)]
      );
    }

    let event: any;

    if (isApiCompleteStep(raw)) {
      const trace0: any = deriveTrace(workingSummary as any) as any;
      const remaining = uniqStable(trace0?.remaining_ids);
      const nextId = remaining.length > 0 ? remaining[0] : null;
      if (!nextId) {
        throw badRequest("COMPLETE_STEP rejected (no remaining exercise)", {
          failure_token: "no_remaining_exercise"
        });
      }
      event = { type: "COMPLETE_EXERCISE", exercise_id: nextId };
    } else {
      const validated = validateWireRuntimeEvent(raw);
      if (!validated) throw badRequest("Missing/invalid event");
      event = validated;
    }

    const seq = await allocNextSeq(client, session_id);

    await client.query(
      `INSERT INTO runtime_events(session_id, seq, event)
       VALUES ($1, $2, $3::jsonb)`,
      [session_id, seq, JSON.stringify(event)]
    );

    let nextSummary: any;
    try {
      __kolosseumWireSentinel(event as any);
      nextSummary = applyWireEvent(workingSummary, event as any, planned as any) as any;
    } catch (e: unknown) {
      mapEngineWireApplyError(e);
    }

    nextSummary.last_seq = seq;
    nextSummary = ensureReturnDecisionContract(nextSummary, deriveTrace).summary;

    await client.query(
      `UPDATE sessions
       SET session_state_summary = $2::jsonb,
           updated_at = now()
       WHERE session_id = $1`,
      [session_id, JSON.stringify(nextSummary)]
    );

    await client.query("COMMIT");
    invalidateSessionStateCache(session_id);

    return res.status(201).json({ ok: true, session_id, seq });
  } catch (err: unknown) {
    try { await client.query("ROLLBACK"); } catch {}
    throw err;
  } finally {
    client.release();
  }
}

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

export async function getSessionState(req: Request, res: Response) {
  const session_id = asString(req.params?.session_id);
  if (!session_id) throw badRequest("Missing session_id");

  const cached = readCachedSessionState(session_id);
  if (cached) return res.json(cached);

  const client = await pool.connect();
  try {
    const row = await loadSessionStateRow(client, session_id);
    if (!row) throw notFound("Session not found");

    const planned = row.planned_session as PlannedSession;
    const { summary: normalized, needsUpgrade } = normalizeSummary(planned as any, row.session_state_summary);

    const upgraded = ensureReturnDecisionContract(normalized, deriveTrace);
    const shouldPersist = needsUpgrade || upgraded.changed;

    if (shouldPersist) {
      await client.query(
        `UPDATE sessions
         SET session_state_summary = $2::jsonb,
             updated_at = now()
         WHERE session_id = $1`,
        [session_id, JSON.stringify(upgraded.summary)]
      );
    }

    const derivedTrace = deriveTrace(upgraded.summary as any) as any;
    const payload = projectSessionStatePayload(session_id, planned, upgraded.summary, derivedTrace);

    writeCachedSessionState(session_id, payload);
    return res.json(payload);
  } finally {
    client.release();
  }
}