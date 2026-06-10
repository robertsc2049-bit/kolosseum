
// DEV NOTE: API boundary surface. This file may expose or transport engine results, but must
// not bypass engine package boundaries, infer hidden truth, or let UI/product state mutate
// deterministic engine behaviour.

/* eslint-disable @typescript-eslint/no-explicit-any */
// src/api/engine_runner_service.ts
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import fs from "node:fs";

import { internalError } from "./http_errors.js";

export async function runPipelineFromDist(input: any): Promise<any> {
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
