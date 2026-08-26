// @law: Registry Law
// @severity: high
// @scope: registry
// @desc: DEV NOTE: REG-FULL-00 final registry surface authority guard.

// DEV NOTE: REG-FULL-00 guard. Validates the sole final registry architecture
// manifest against its closed invariants and the committed current repo surface.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { TOKEN, validateManifest, auditRepository } from "../registry/reg_full_00_final_registry_surface_authority.mjs";

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, "registries", "final_registry_surface_manifest.json");

// DEV NOTE: Emit one stable guard-owned token with deterministic subcode/details.
function fail(subcode, details) {
  console.error(JSON.stringify({ ok: false, token: TOKEN, guard: "REG-FULL-00", subcode, details }, null, 2));
  process.exit(1);
}

if (!fs.existsSync(MANIFEST_PATH)) fail("MANIFEST_MISSING", "registries/final_registry_surface_manifest.json");
let manifest;
try { manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")); }
catch (error) { fail("MANIFEST_JSON_INVALID", String(error?.message ?? error)); }
const manifestResult = validateManifest(manifest);
if (!manifestResult.ok) fail("MANIFEST_INVALID", manifestResult.errors);
const repoResult = auditRepository(ROOT, manifest);
if (!repoResult.ok) fail("REPOSITORY_RECONCILIATION_INVALID", repoResult.errors);
console.log(JSON.stringify({ ok: true, token: TOKEN, guard: "REG-FULL-00", entities: manifest.summary.discovered_entity_count, classifications: manifest.summary, final_load_order_count: manifest.final_load_order.length, protected_registry_bytes: "unchanged" }, null, 2));
