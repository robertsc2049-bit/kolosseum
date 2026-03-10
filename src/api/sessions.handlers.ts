/* eslint-disable @typescript-eslint/no-explicit-any */
// src/api/sessions.handlers.ts
import type { Request, Response } from "express";
import { pool } from "../db/pool.js";

import crypto from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import fs from "node:fs";

import {
  deriveTrace,
  normalizeSummary
} from "@kolosseum/engine/runtime/session_summary.js";

import {
  badRequest,
  notFound,
  upstreamBadGateway,
  internalError
} from "./http_errors.js";
import {
  type PlannedSession,
  ensureReturnDecisionContract,
  loadSessionStateRow,
  projectSessionStatePayload,
  readCachedSessionState,
  writeCachedSessionState
} from "./session_state_read_model.js";
import {
  appendRuntimeEventMutation,
  extractRawEventFromBody,
  startSessionMutation
} from "./session_state_write_service.js";

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

export async function startSession(req: Request, res: Response) {
  const session_id = asString(req.params?.session_id);
  if (!session_id) throw badRequest("Missing session_id");

  const result = await startSessionMutation(session_id);
  return res.status(200).json(result);
}

export async function appendRuntimeEvent(req: Request, res: Response) {
  const session_id = asString(req.params?.session_id);
  if (!session_id) throw badRequest("Missing session_id");

  const raw = extractRawEventFromBody(req.body);
  const result = await appendRuntimeEventMutation(session_id, raw);
  return res.status(201).json(result);
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