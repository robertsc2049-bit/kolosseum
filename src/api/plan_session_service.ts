/* eslint-disable @typescript-eslint/no-explicit-any */
// src/api/plan_session_service.ts
import { pool } from "../db/pool.js";
import crypto from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import fs from "node:fs";
import {
  upstreamBadGateway,
  internalError
} from "./http_errors.js";

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

export async function planSessionService(input: any) {
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

  return out;
}