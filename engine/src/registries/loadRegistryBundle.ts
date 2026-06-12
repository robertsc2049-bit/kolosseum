
// DEV NOTE: Engine-side implementation surface. Keep this code deterministic, closed-world, and
// free of product/UI/coach-note influence. Engine truth must come from explicit inputs,
// canonical registries, and validated contracts only.

import fs from "node:fs";

function stripBom(s: string): string {
  return s.length > 0 && s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}

export type RegistryBundle = {
  version: string;
  note?: string;
  registries: Record<string, unknown>;
};

/**
 * DEV NOTE: Registry bundle loader boundary.
 * Purpose: load the sealed registry bundle used by template selection and later
 * registry-backed engine operations.
 * Boundary: this function validates only the bundle container shape; domain law
 * stays in canonical registry guards and phase-specific validation.
 * Determinism: the caller receives the parsed bundle from the declared path with
 * BOM removed and no environment-dependent path discovery.
 * Failure: missing or malformed bundle shape throws stable type errors before
 * engine phases consume incomplete registry data.
 */
export function loadRegistryBundle(path = "registries/registry_bundle.json"): RegistryBundle {
  if (!fs.existsSync(path)) {
    throw new Error(`CI_MISSING_HARD_FAIL: registry bundle missing at ${path}`);
  }
  const raw = stripBom(fs.readFileSync(path, "utf8"));
  const parsed = JSON.parse(raw);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("type_mismatch: registry bundle must be an object");
  }
  if (typeof parsed.version !== "string") {
    throw new Error("type_mismatch: registry bundle must include version:string");
  }
  if (!parsed.registries || typeof parsed.registries !== "object") {
    throw new Error("type_mismatch: registry bundle must include registries:object");
  }

  return parsed as RegistryBundle;
}
