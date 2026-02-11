import fs from "node:fs";
import path from "node:path";

export type Phase3Constraints = Record<string, any>;

export type Phase3ResolutionSummary = {
  rules_applied: string[];
  removed_from_available_equipment?: string[];
};

export type Phase3Output = {
  constraints_resolved: boolean;
  notes: string[];
  registry_index_version: string;
  loaded_registries: string[];
  constraints: Phase3Constraints;

  // High-signal, stable debug for golden fixtures (no circular refs)
  constraints_resolution?: Phase3ResolutionSummary;
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

  if (Array.isArray(idx)) {
    return idx
      .map(asId)
      .map((s: string) => String(s).trim())
      .filter(Boolean);
  }

  if (!isRecord(idx)) return [];

  const anyIdx: any = idx;

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

function pickStringArray(xs: unknown): string[] | undefined {
  if (!Array.isArray(xs)) return undefined;
  const out: string[] = [];
  for (const v of xs) {
    if (typeof v !== "string") continue;
    const s = v.trim();
    if (s.length > 0) out.push(s);
  }
  const uniq = Array.from(new Set(out));
  return uniq.length > 0 ? uniq : undefined;
}

function sortedUnique(xs: string[] | undefined): string[] | undefined {
  if (!xs || xs.length === 0) return undefined;
  const uniq = Array.from(new Set(xs));
  uniq.sort((a, b) => a.localeCompare(b));
  return uniq.length ? uniq : undefined;
}

export function phase3ResolveConstraintsAndLoadRegistries(canonicalInput: any): Phase3Result {
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

  for (const id of indexList) {
    loaded_registries.push(id);

    const candidates = [
      path.join(repoRoot(), "registries", id, `${id}.registry.json`),
      path.join(repoRoot(), "registries", id, `${id}.registry.v1.0.0.json`),
      path.join(repoRoot(), "registries", id, "registry.json"),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        void readJson(p);
        break;
      }
    }
  }

  let constraints: Phase3Constraints = {};

  const env = canonicalInput?.constraints;
  if (!env) {
    notes.push("PHASE_3: registries loaded");
    notes.push("PHASE_3: constraints envelope absent  -  defaults permitted (v0)");
    return {
      ok: true,
      phase3: {
        constraints_resolved: true,
        notes,
        registry_index_version,
        loaded_registries,
        constraints,
      },
      notes,
    };
  }

  if (!isRecord(env)) {
    return {
      ok: false,
      failure_token: "type_mismatch",
      details: { path: "constraints", expected: "object" },
    };
  }

  // Canonical constraints: exclude constraints_version, normalize known list fields.
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(env)) {
    if (k === "constraints_version") continue;
    out[k] = v;
  }

  // Normalize specific list fields we care about for precedence
  const available_equipment = sortedUnique(pickStringArray(out.available_equipment));
  const banned_equipment = sortedUnique(pickStringArray(out.banned_equipment));

  const resolution: Phase3ResolutionSummary = { rules_applied: [] };

  // Precedence rule: banned overrides available (remove banned from available)
  if (available_equipment && banned_equipment) {
    const bannedSet = new Set(banned_equipment);
    const filtered = available_equipment.filter((id) => !bannedSet.has(id));
    const removed = available_equipment.filter((id) => bannedSet.has(id));
    const filteredSorted = sortedUnique(filtered);

    out.available_equipment = filteredSorted ?? [];
    out.banned_equipment = banned_equipment;

    resolution.rules_applied.push("banned_over_available_equipment");
    if (removed.length) {
      removed.sort((a, b) => a.localeCompare(b));
      resolution.removed_from_available_equipment = removed;
    }
  } else {
    // Even if no precedence applied, still canonicalize list fields if present
    if (available_equipment) out.available_equipment = available_equipment;
    if (banned_equipment) out.banned_equipment = banned_equipment;
  }

  constraints = out;

  notes.push("PHASE_3: registries loaded");
  notes.push("PHASE_3: constraints envelope present  -  canonicalized (v1)");

  return {
    ok: true,
    phase3: {
      constraints_resolved: true,
      notes,
      registry_index_version,
      loaded_registries,
      constraints,
      constraints_resolution: resolution.rules_applied.length ? resolution : undefined,
    },
    notes,
  };
}

export default phase3ResolveConstraintsAndLoadRegistries;
