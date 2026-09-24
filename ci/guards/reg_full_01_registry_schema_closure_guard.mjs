// @law: Registry Law
// @severity: high
// @scope: registry
// @desc: DEV NOTE: REG-FULL-01 final registry schema and canonical ID closure guard.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { TOKEN, validateSchemaManifest, auditRepository } from "../registry/reg_full_01_registry_schema_closure.mjs";

const ROOT = process.cwd();
const schemaManifestPath = path.join(ROOT, "registries", "final_registry_schema_manifest.json");
const surfaceManifestPath = path.join(ROOT, "registries", "final_registry_surface_manifest.json");
function fail(subcode, details) {
  console.error(JSON.stringify({ ok:false, token:TOKEN, guard:"REG-FULL-01", subcode, details }, null, 2));
  process.exit(1);
}
for (const p of [schemaManifestPath, surfaceManifestPath]) if (!fs.existsSync(p)) fail("MANIFEST_MISSING", path.relative(ROOT,p));
let schemaManifest, surfaceManifest;
try { schemaManifest = JSON.parse(fs.readFileSync(schemaManifestPath,'utf8')); surfaceManifest = JSON.parse(fs.readFileSync(surfaceManifestPath,'utf8')); }
catch (error) { fail("MANIFEST_JSON_INVALID", String(error?.message ?? error)); }
const manifestResult = validateSchemaManifest(schemaManifest, surfaceManifest);
if (!manifestResult.ok) fail("SCHEMA_MANIFEST_INVALID", manifestResult.errors);
const repoResult = auditRepository(ROOT, schemaManifest, surfaceManifest);
if (!repoResult.ok) fail("REPOSITORY_SCHEMA_CLOSURE_INVALID", repoResult.errors);
console.log(JSON.stringify({ ok:true, token:TOKEN, guard:"REG-FULL-01", required_active:schemaManifest.summary.required_active_registry_count, authoritative_schemas:schemaManifest.summary.authoritative_schema_count, schema_conflicts:0, permanent_dual_read:false }, null, 2));
