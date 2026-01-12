import fs from "node:fs";
import path from "node:path";

function stripBom(s: string): string {
  return s.length > 0 && s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}

function readJson(p: string): any {
  const raw = stripBom(fs.readFileSync(p, "utf8"));
  return JSON.parse(raw);
}

function repoRoot(): string {
  return process.cwd();
}

export type LoadedRegistries = {
  registry_index_version: string;
  loaded_registries: string[];
  registries: Record<string, any>;
};

function pickOrder(index: any): string[] {
  const candidates = [
    index?.registry_order,
    index?.index_order,
    index?.registry_ids,
    index?.order,
    index?.registries
  ];

  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c.map(String);
  }

  return [];
}

export function loadRegistries(): LoadedRegistries {
  const root = repoRoot();
  const indexPath = path.join(root, "registries", "registry_index.json");
  if (!fs.existsSync(indexPath)) {
    throw new Error(`CI_MISSING_HARD_FAIL: registry index missing: ${path.relative(root, indexPath)}`);
  }

  const index = readJson(indexPath);
  const registry_index_version = String(index?.version ?? "unknown");

  const order = pickOrder(index);
  if (order.length === 0) {
    throw new Error("CI_REGISTRY_INDEX_INVALID: registry order missing/empty (expected registry_order|index_order|registry_ids|order)");
  }

  const registries: Record<string, any> = {};
  const loaded_registries: string[] = [];

  for (const registryId of order) {
    const p = path.join(root, "registries", registryId, `${registryId}.registry.json`);
    if (!fs.existsSync(p)) {
      throw new Error(`CI_MISSING_HARD_FAIL: registry file missing: ${path.relative(root, p)}`);
    }
    registries[registryId] = readJson(p);
    loaded_registries.push(registryId);
  }

  return { registry_index_version, loaded_registries, registries };
}
