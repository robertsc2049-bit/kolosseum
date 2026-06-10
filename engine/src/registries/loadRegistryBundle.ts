import fs from "node:fs";

function stripBom(s: string): string {
  return s.length > 0 && s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}

export type RegistryBundle = {
  version: string;
  note?: string;
  registries: Record<string, unknown>;
};

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
