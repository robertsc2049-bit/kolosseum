
// DEV NOTE: Engine-side implementation surface. Keep this code deterministic, closed-world, and
// free of product/UI/coach-note influence. Engine truth must come from explicit inputs,
// canonical registries, and validated contracts only.

import type { Phase4Template } from "./types.js";
import { loadRegistryBundle } from "../../registries/loadRegistryBundle.js";

type ProgramTemplateEntry = {
  activity_id: string;
  template_id: string;
  exercise_eligibility: string[];
};

type ProgramTemplateRegistry = {
  registry_id: "program";
  version: string;
  entries: ProgramTemplateEntry[];
};

function die(msg: string): never {
  throw new Error(`PHASE4_TEMPLATE_REGISTRY: ${msg}`);
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function validateProgramRegistry(doc: unknown): ProgramTemplateRegistry {
  if (!isPlainObject(doc)) die(`program registry not an object`);

  const registry_id = doc["registry_id"];
  const version = doc["version"];
  const entries = doc["entries"];

  if (registry_id !== "program") die(`program.registry_id must be "program"`);
  if (typeof version !== "string" || version.trim() === "") die(`program.version must be non-empty string`);
  if (!Array.isArray(entries)) die(`program.entries must be an array`);

  const out: ProgramTemplateEntry[] = [];
  for (let i = 0; i < entries.length; i++) {
    const row = entries[i];
    if (!isPlainObject(row)) die(`program.entries[${i}] not an object`);

    const activity_id = row["activity_id"];
    const template_id = row["template_id"];
    const exercise_eligibility = row["exercise_eligibility"];

    if (typeof activity_id !== "string" || activity_id.trim() === "") die(`program.entries[${i}].activity_id invalid`);
    if (typeof template_id !== "string" || template_id.trim() === "") die(`program.entries[${i}].template_id invalid`);
    if (!Array.isArray(exercise_eligibility)) die(`program.entries[${i}].exercise_eligibility must be array`);

    const exerciseEligibilityOut: string[] = [];
    for (let j = 0; j < exercise_eligibility.length; j++) {
      const ex = exercise_eligibility[j];
      if (typeof ex !== "string" || ex.trim() === "") die(`program.entries[${i}].exercise_eligibility[${j}] invalid`);
      exerciseEligibilityOut.push(ex);
    }

    out.push({ activity_id: activity_id.trim(), template_id: template_id.trim(), exercise_eligibility: exerciseEligibilityOut });
  }

  return { registry_id: "program", version, entries: out };
}

let _cache: ProgramTemplateRegistry | null = null;

function loadProgramRegistry(): ProgramTemplateRegistry {
  if (_cache) return _cache;

  const bundle = loadRegistryBundle();
  const program = bundle?.registries?.["program"];

  if (!program) {
    die(`registry bundle missing registries["program"]`);
  }

  _cache = validateProgramRegistry(program);
  return _cache;
}

export function selectTemplate(activity: string): Phase4Template | null {
  const act = String(activity ?? "").trim();
  if (!act) return null;

  const reg = loadProgramRegistry();
  const hit = reg.entries.find((t) => t.activity_id === act);
  if (!hit) return null;

  return { program_id: hit.template_id, intent: hit.exercise_eligibility };
}
