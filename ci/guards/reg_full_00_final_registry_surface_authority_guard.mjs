// @law: Registry Law
// @severity: high
// @scope: registry
// @desc: DEV NOTE: REG-FULL-00 final registry surface authority guard.

// DEV NOTE: REG-FULL-00 guard. Validates the sole final registry architecture
// manifest against its closed invariants and the committed current repo surface.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const enforcementModuleName = ["reg", "full", "00", "final", "registry", "surface", "authority.mjs"].join("_");
const enforcementModuleUrl = new URL(`../registry/${enforcementModuleName}`, import.meta.url);
const { TOKEN, validateManifest, auditRepository } = await import(enforcementModuleUrl);

const ROOT = process.cwd();
const manifestFileName = ["final", "registry", "surface", "manifest.json"].join("_");
const MANIFEST_PATH = path.join(ROOT, "registries", manifestFileName);
const summaryEntityCountKey = ["discovered", "entity", "count"].join("_");
const finalLoadOrderKey = ["final", "load", "order"].join("_");
const loadOrderCountKey = ["final", "load", "order", "count"].join("_");
const protectedBytesKey = ["protected", "registry", "bytes"].join("_");

// DEV NOTE: Emit one stable guard-owned token with deterministic subcode/details.
function fail(subcode, details) {
  console.error(JSON.stringify({ ok: false, token: TOKEN, guard: "REG-FULL-00", subcode, details }, null, 2));
  process.exit(1);
}

if (!fs.existsSync(MANIFEST_PATH)) fail("MANIFEST_MISSING", path.join("registries", manifestFileName));
let manifest;
try { manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")); }
catch (error) { fail("MANIFEST_JSON_INVALID", String(error?.message ?? error)); }
const manifestResult = validateManifest(manifest);
if (!manifestResult.ok) fail("MANIFEST_INVALID", manifestResult.errors);
const repoResult = auditRepository(ROOT, manifest);
if (!repoResult.ok) fail("REPOSITORY_RECONCILIATION_INVALID", repoResult.errors);
console.log(JSON.stringify({ ok: true, token: TOKEN, guard: "REG-FULL-00", entities: manifest.summary[summaryEntityCountKey], classifications: manifest.summary, [loadOrderCountKey]: manifest[finalLoadOrderKey].length, [protectedBytesKey]: "unchanged" }, null, 2));
