// DEV NOTE: BETA-14 clean-checkout runtime reducer test runner.

import { spawnSync } from "node:child_process";
import process from "node:process";

function run(command, args, label) {
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

    process.exit(result.status ?? 1);
  }
}

if (process.platform === "win32") {
  run(
    process.env.ComSpec || "cmd.exe",
    ["/d", "/s", "/c", "npm run build"],
    "BETA-14 clean-checkout engine build"
  );
}
else {
  run(
    "npm",
    ["run", "build"],
    "BETA-14 clean-checkout engine build"
  );
}

run(
  process.execPath,
  [
    "--test",
    "test/beta_14_phase6_runtime_reducer.test.mjs"
  ],
  "BETA-14 Phase 6 runtime reducer tests"
);
