
// DEV NOTE: API boundary surface. This file may expose or transport engine results, but must
// not bypass engine package boundaries, infer hidden truth, or let UI/product state mutate
// deterministic engine behaviour.

/* eslint-disable @typescript-eslint/no-explicit-any */
// src/api/plan_session_default_input_service.ts
import { resolve } from "node:path";
import fs from "node:fs";

import { internalError } from "./http_errors.js";

export async function loadPlanSessionDefaultInput(): Promise<any> {
  const fixture = resolve(process.cwd(), "test", "fixtures", "golden", "inputs", "vanilla_minimal.json");
  if (!fs.existsSync(fixture)) {
    throw internalError("Missing default fixture on server", { fixture });
  }
  return JSON.parse(fs.readFileSync(fixture, "utf8"));
}
