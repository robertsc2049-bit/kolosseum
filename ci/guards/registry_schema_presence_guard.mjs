// @law: Registry Law
// @severity: high
// @scope: registry

// DEV NOTE: CI guard surface. This file enforces both the current loaded schema
// presence contract and REG-FULL-01 final required-active schema authority.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function die(msg) { console.error(msg); process.exit(1); }
function readJson(p) { return JSON.parse(fs.readFileSync(p, "utf8")); }

const indexPath = path.join("registries", "registry_index.json");
if (!fs.existsSync(indexPath)) die(`registry_schema_presence_guard: missing ${indexPath}`);
const index = readJson(indexPath);
if (!index || typeof index !== "object" || !Array.isArray(index.order)) die("registry_schema_presence_guard: registry_index.order must be an array");

const missing = [];
for (const name of index.order) {
  if (typeof name !== "string" || name.trim() === "") die("registry_schema_presence_guard: registry_index.order contains a non-string/empty entry");
  const schemaPath = path.join("ci", "schemas", `${name}.registry.schema.json`);
  if (!fs.existsSync(schemaPath)) missing.push(schemaPath);
}

const surfacePath = path.join("registries", "final_registry_surface_manifest.json");
const schemaManifestPath = path.join("registries", "final_registry_schema_manifest.json");
if (!fs.existsSync(surfacePath)) die(`registry_schema_presence_guard: missing ${surfacePath}`);
if (!fs.existsSync(schemaManifestPath)) die(`registry_schema_presence_guard: missing ${schemaManifestPath}`);
const surface = readJson(surfacePath);
const schemaManifest = readJson(schemaManifestPath);
const requiredActive = (surface.entities || []).filter((e) => e?.classification === "required_active");
const schemaById = new Map((schemaManifest.registries || []).map((r) => [r.canonical_registry_id, r]));
for (const entity of requiredActive) {
  const row = schemaById.get(entity.canonical_registry_id);
  if (!row || typeof row.schema_path !== "string" || !row.schema_path) {
    missing.push(`authoritative schema manifest entry for ${entity.canonical_registry_id}`);
    continue;
  }
  if (!fs.existsSync(row.schema_path)) missing.push(row.schema_path);
}
if ((schemaManifest.registries || []).length !== requiredActive.length) {
  die(`registry_schema_presence_guard: final schema authority count mismatch: ${(schemaManifest.registries || []).length} schemas for ${requiredActive.length} required-active registries`);
}

if (missing.length) {
  die("registry_schema_presence_guard: missing registry schema(s):\n" + missing.map((p) => ` - ${p}`).join("\n"));
}
console.log(`OK: registry_schema_presence_guard current=${index.order.length} final_required_active=${requiredActive.length}`);
