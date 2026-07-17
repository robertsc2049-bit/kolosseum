// DEV NOTE: BETA-FIX-01 targeted copy-registry reconciliation test runner.

import process from "node:process";
import { spawnSync } from "node:child_process";

const result = spawnSync(
  process.execPath,
  ["--test", "test/beta_fix_01_copy_registry_reconciliation.test.mjs"],
  {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: false,
    windowsHide: true
  }
);

if (result.error) {
  console.error("BETA-FIX-01 tests could not start: " + result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
