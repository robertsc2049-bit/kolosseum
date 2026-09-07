// @law: Registry Law
// @severity: high
// @scope: registry

// DEV NOTE: CI guard surface. Proves the static JSON layer (JSON Schema
// enum/const arrays and the two derived manifest files that cannot literally
// import shared/v1-boundary/v1ActivityRegistry.mjs) is still in sync with
// that single source of truth, via scripts/sync_v1_activity_surfaces.mjs's
// own --check mode. Do not weaken this guard to make a failing build pass;
// run `node scripts/sync_v1_activity_surfaces.mjs --write` and commit the
// result instead.

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const scriptPath = path.join(repoRoot, "scripts", "sync_v1_activity_surfaces.mjs");

const result = spawnSync(process.execPath, [scriptPath, "--check"], {
  cwd: repoRoot,
  encoding: "utf8"
});

if (result.status !== 0) {
  console.error("v1_activity_surfaces_sync_guard: FAIL");
  console.error(result.stdout);
  console.error(result.stderr);
  process.exit(1);
}

console.log("OK: v1_activity_surfaces_sync_guard");
