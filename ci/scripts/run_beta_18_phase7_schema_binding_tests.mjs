// DEV NOTE: BETA-18 clean-checkout Phase 7 schema and binding test runner.

import {
  spawnSync
} from "node:child_process";
import process from "node:process";

function run(
  command,
  args,
  label
) {
  const result = spawnSync(
    command,
    args,
    {
      cwd: process.cwd(),
      stdio: "inherit",
      shell: false,
      windowsHide: true
    }
  );

  if (result.error) {
    console.error(
      `${label} could not start: ${result.error.message}`
    );

    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(
      `${label} failed with exit code ${result.status ?? 1}`
    );

    process.exit(
      result.status ?? 1
    );
  }
}

if (process.platform === "win32") {
  run(
    process.env.ComSpec ||
      "cmd.exe",
    [
      "/d",
      "/s",
      "/c",
      "npm run build"
    ],
    "BETA-18 clean-checkout build"
  );
}
else {
  run(
    "npm",
    [
      "run",
      "build"
    ],
    "BETA-18 clean-checkout build"
  );
}

run(
  process.execPath,
  [
    "--test",
    "test/beta_18_phase7_schema_binding.test.mjs"
  ],
  "BETA-18 Phase 7 schema binding"
);
