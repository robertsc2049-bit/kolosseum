
// DEV NOTE: Engine-side implementation surface. Keep this code deterministic, closed-world, and
// free of product/UI/coach-note influence. Engine truth must come from explicit inputs,
// canonical registries, and validated contracts only.

import type { Phase4ItemPrescription, Phase4Template } from "./types.js";
import { loadRegistryBundle } from "../../registries/loadRegistryBundle.js";

type ProgramTemplateEntry = {
  activity_id: string;
  template_id: string;
  exercise_eligibility: string[];
  item_prescriptions?: Phase4ItemPrescription[];
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

function positiveInt(x: unknown): x is number {
  return typeof x === "number" && Number.isInteger(x) && x > 0;
}

// item_prescriptions is optional; when present it must align 1:1 with a
// duplicate-free exercise_eligibility so planned item i gets prescription i.
function validateItemPrescriptions(raw: unknown, i: number, eligibility: string[]): Phase4ItemPrescription[] {
  const at = `program.entries[${i}].item_prescriptions`;
  if (!Array.isArray(raw)) die(`${at} must be an array`);
  if (raw.length !== eligibility.length) die(`${at} must align 1:1 with exercise_eligibility`);
  if (new Set(eligibility).size !== eligibility.length) die(`${at} requires a duplicate-free exercise_eligibility`);

  return raw.map((p, j) => {
    if (!isPlainObject(p)) die(`${at}[${j}] not an object`);
    const { sets, reps, rest_seconds, intensity } = p;
    if (!positiveInt(sets)) die(`${at}[${j}].sets must be a positive integer`);
    if (!positiveInt(reps)) die(`${at}[${j}].reps must be a positive integer`);
    if (!positiveInt(rest_seconds)) die(`${at}[${j}].rest_seconds must be a positive integer`);
    if (!isPlainObject(intensity)) die(`${at}[${j}].intensity not an object`);

    const type = intensity["type"];
    const value = intensity["value"];
    if (type === "bodyweight") return { sets, reps, rest_seconds, intensity: { type } };
    if (type === "percent_1rm" && typeof value === "number" && value > 0 && value <= 100) {
      return { sets, reps, rest_seconds, intensity: { type, value } };
    }
    if (type === "rpe" && typeof value === "number" && value >= 1 && value <= 10) {
      return { sets, reps, rest_seconds, intensity: { type, value } };
    }
    die(`${at}[${j}].intensity must be bodyweight, percent_1rm (0-100] or rpe [1-10]`);
  });
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

    const entry: ProgramTemplateEntry = {
      activity_id: activity_id.trim(),
      template_id: template_id.trim(),
      exercise_eligibility: exerciseEligibilityOut
    };
    if (row["item_prescriptions"] !== undefined) {
      entry.item_prescriptions = validateItemPrescriptions(row["item_prescriptions"], i, exerciseEligibilityOut);
    }
    out.push(entry);
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

  return hit.item_prescriptions
    ? { program_id: hit.template_id, intent: hit.exercise_eligibility, prescriptions: hit.item_prescriptions }
    : { program_id: hit.template_id, intent: hit.exercise_eligibility };
}
