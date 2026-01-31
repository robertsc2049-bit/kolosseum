import fs from "node:fs";
import path from "node:path";

export type Phase3Constraints = Record<string, any>;

export type Phase3Output = {
  constraints_resolved: boolean;
  notes: string[];
  registry_index_version: string;
  loaded_registries: string[];
  constraints: Phase3Constraints;
};

export type Phase3Result =
  | { ok: true; phase3: Phase3Output; notes: string[] }
  | { ok: false; failure_token: string; details?: unknown };

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function readJson(p: string): any {
  return JSON.parse(stripBom(fs.readFileSync(p, "utf8")));
}

function repoRoot(): string {
  return process.cwd();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function asId(x: unknown): string {
  if (typeof x === "string") return x;
  if (!x || typeof x !== "object") return "";
  const o = x as any;
  return String(o.id ?? o.registry_id ?? o.name ?? o.key ?? "");
}

/**
 * Extract registry ids from registry_index.json across multiple plausible schemas.
 * Goal: return an ordered list of registry ids (strings).
 */
function extractRegistryIds(idx: unknown): string[] {
  if (!idx) return [];

  // If the root itself is an array (rare, but handle it)
  if (Array.isArray(idx)) {
    return idx
      .map(asId)
      .map((s: string) => String(s).trim())
      .filter(Boolean);
  }

  if (!isRecord(idx)) return [];

  const anyIdx: any = idx;

  // Common array shapes
  const rawArray =
    (Array.isArray(anyIdx.index) && anyIdx.index) ||
    (Array.isArray(anyIdx.registries) && anyIdx.registries) ||
    (Array.isArray(anyIdx.items) && anyIdx.items) ||
    (Array.isArray(anyIdx.entries) && anyIdx.entries) ||
    (Array.isArray(anyIdx.order) && anyIdx.order) ||
    null;

  if (rawArray) {
    return rawArray
      .map(asId)
      .map((s: string) => String(s).trim())
      .filter(Boolean);
  }

  // Nested arrays under index/registries/items
  if (isRecord(anyIdx.index) && Array.isArray((anyIdx.index as any).entries)) {
    return (anyIdx.index as any).entries
      .map(asId)
      .map((s: string) => String(s).trim())
      .filter(Boolean);
  }
  if (isRecord(anyIdx.registries) && Array.isArray((anyIdx.registries as any).entries)) {
    return (anyIdx.registries as any).entries
      .map(asId)
      .map((s: string) => String(s).trim())
      .filter(Boolean);
  }
  if (isRecord(anyIdx.items) && Array.isArray((anyIdx.items as any).entries)) {
    return (anyIdx.items as any).entries
      .map(asId)
      .map((s: string) => String(s).trim())
      .filter(Boolean);
  }

  // Object-map shapes where the keys are the registry ids
  // (Preserves insertion order in modern JS engines for non-integer keys)
  const mapCandidate =
    (isRecord(anyIdx.registries) && anyIdx.registries) ||
    (isRecord(anyIdx.index) && anyIdx.index) ||
    (isRecord(anyIdx.entries) && anyIdx.entries) ||
    null;

  if (mapCandidate) {
    return Object.keys(mapCandidate)
      .map((s: string) => String(s).trim())
      .filter(Boolean);
  }

  return [];
}

export function phase3ResolveConstraintsAndLoadRegistries(
  canonicalInput: any
): Phase3Result {
  const notes: string[] = [];
  const loaded_registries: string[] = [];

  const idxPath = path.join(repoRoot(), "registries", "registry_index.json");
  let registry_index_version = "unknown";
  let indexList: string[] = [];

  if (fs.existsSync(idxPath)) {
    const idx = readJson(idxPath);
    if (typeof idx?.version === "string") registry_index_version = idx.version;

    indexList = extractRegistryIds(idx);
  }

  // Load registries in that exact order (best-effort) and record the order deterministically.
  for (const id of indexList) {
    loaded_registries.push(id);

    // Best-effort read of possible registry file names under registries/<id>/
    const candidates = [
      path.join(repoRoot(), "registries", id, `${id}.registry.json`),
      path.join(repoRoot(), "registries", id, `${id}.registry.v1.0.0.json`),
      path.join(repoRoot(), "registries", id, "registry.json")
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        void readJson(p);
        break;
      }
    }
  }

  // --- Constraints envelope resolution ---
  let constraints: Phase3Constraints = {};

  const env = canonicalInput?.constraints;
  if (!env) {
    notes.push("PHASE_3: registries loaded");
    notes.push("PHASE_3: constraints envelope absent — defaults permitted (v0)");
    return {
      ok: true,
      phase3: {
        constraints_resolved: true,
        notes,
        registry_index_version,
        loaded_registries,
        constraints
      },
      notes
    };
  }

  if (!isRecord(env)) {
    return {
      ok: false,
      failure_token: "type_mismatch",
      details: { path: "constraints", expected: "object" }
    };
  }

  // Canonical constraints must exclude constraints_version.
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(env)) {
    if (k === "constraints_version") continue;
    out[k] = v;
  }
  constraints = out;

  notes.push("PHASE_3: registries loaded");
  notes.push("PHASE_3: constraints envelope present — canonicalized (v1)");

  return {
    ok: true,
    phase3: {
      constraints_resolved: true,
      notes,
      registry_index_version,
      loaded_registries,
      constraints
    },
    notes
  };
}

export default phase3ResolveConstraintsAndLoadRegistries;