import type { Phase4Template } from "./types.js";
import { loadRegistryBundle } from "../../registries/loadRegistryBundle.js";

type ProgramTemplateEntry = {
  id: string; // activity key
  program_id: string;
  intent: string[];
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

    const id = row["id"];
    const program_id = row["program_id"];
    const intent = row["intent"];

    if (typeof id !== "string" || id.trim() === "") die(`program.entries[${i}].id invalid`);
    if (typeof program_id !== "string" || program_id.trim() === "") die(`program.entries[${i}].program_id invalid`);
    if (!Array.isArray(intent)) die(`program.entries[${i}].intent must be array`);

    const intentOut: string[] = [];
    for (let j = 0; j < intent.length; j++) {
      const ex = intent[j];
      if (typeof ex !== "string" || ex.trim() === "") die(`program.entries[${i}].intent[${j}] invalid`);
      intentOut.push(ex);
    }

    out.push({ id: id.trim(), program_id: program_id.trim(), intent: intentOut });
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
  const hit = reg.entries.find((t) => t.id === act);
  if (!hit) return null;

  return { program_id: hit.program_id, intent: hit.intent };
}
