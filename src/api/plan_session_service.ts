/* eslint-disable @typescript-eslint/no-explicit-any */
// src/api/plan_session_service.ts
import { resolve } from "node:path";
import fs from "node:fs";

import {
  upstreamBadGateway,
  internalError
} from "./http_errors.js";
import { runPipelineFromDist } from "./engine_runner_service.js";
import { persistEngineRunBestEffort } from "./engine_run_persistence_service.js";

async function loadDefaultFixture(): Promise<any> {
  const fixture = resolve(process.cwd(), "test", "fixtures", "golden", "inputs", "vanilla_minimal.json");
  if (!fs.existsSync(fixture)) {
    throw internalError("Missing default fixture on server", { fixture });
  }
  return JSON.parse(fs.readFileSync(fixture, "utf8"));
}

export async function planSessionService(input: any) {
  const effectiveInput =
    input && typeof input === "object" && Object.keys(input).length > 0
      ? input
      : await loadDefaultFixture();

  const out = await runPipelineFromDist(effectiveInput);

  if (!out || out.ok !== true) {
    throw upstreamBadGateway("Engine output invalid (ok !== true)", { output: out ?? null });
  }

  if (!out.session || !Array.isArray(out.session.exercises) || out.session.exercises.length < 1) {
    throw upstreamBadGateway("Engine output invalid (missing session.exercises)", { output: out ?? null });
  }

  await persistEngineRunBestEffort("plan_session", effectiveInput, out);

  return out;
}