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

function asId(x: any): string {
  if (typeof x === "string") return x;
  if (!x || typeof x !== "object") return "";
  return String(
    (x as any).id ??
      (x as any).registry_id ??
      (x as any).name ??
      (x as any).key ??
      ""
  );
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

    // Accept common shapes:
    //  - { index: ["activity","movement","exercise"] }
    //  - { index: [{ id: "activity" }, ...] }
    //  - { registries: ["activity", ...] }
    //  - { registries: [{ registry_id: "activity" }, ...] }
    //  - { items: [{ id: "activity" }, ...] }
    const raw =
      (Array.isArray(idx?.index) && idx.index) ||
      (Array.isArray(idx?.registries) && idx.registries) ||
      (Array.isArray(idx?.items) && idx.items) ||
      [];

    indexList = raw.map(asId).map(s => String(s).trim()).filter(Boolean);
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
    return { ok: false, failure_token: "type_mismatch", details: { path: "constraints", expected: "object" } };
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