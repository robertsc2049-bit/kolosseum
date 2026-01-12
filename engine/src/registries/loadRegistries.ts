import fs from "node:fs";
import path from "node:path";

function stripBom(s: string): string {
  return s.length > 0 && s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}

export type RegistryFile = {
  registry_id: string;
  version: string;
  entries: Record<string, unknown>;
};

export type LoadedRegistries = {
  index_version: string;
  registries: Record<string, RegistryFile>;
};

export function loadRegistries(basePath = "registries"): LoadedRegistries {
  const indexPath = path.join(basePath, "registry_index.json");
  if (!fs.existsSync(indexPath)) {
    throw new Error(`CI_MISSING_HARD_FAIL: registry_index.json missing at ${indexPath}`);
  }

  const indexRaw = stripBom(fs.readFileSync(indexPath, "utf8"));
  const index = JSON.parse(indexRaw);

  if (!Array.isArray(index.order)) {
    throw new Error("type_mismatch: registry_index.order must be array");
  }

  const registries: Record<string, RegistryFile> = {};

  for (const id of index.order) {
    const filePath = path.join(basePath, id, `${id}.registry.json`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`CI_MISSING_HARD_FAIL: registry file missing: ${filePath}`);
    }

    const raw = stripBom(fs.readFileSync(filePath, "utf8"));
    const parsed = JSON.parse(raw);

    if (parsed.registry_id !== id) {
      throw new Error(`type_mismatch: registry_id mismatch in ${filePath}`);
    }

    registries[id] = parsed;
  }

  return {
    index_version: index.version,
    registries
  };
}
