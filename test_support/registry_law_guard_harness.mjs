import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
`nexport const rmrf = cleanupTempRepoRoot;

export function runRegistryLawGuard(tempRootAbs) {
  return spawnSync(process.execPath, [p("ci/guards/registry_law_guard.mjs")], {
    cwd: tempRootAbs,
    encoding: "utf8"
  });
}
