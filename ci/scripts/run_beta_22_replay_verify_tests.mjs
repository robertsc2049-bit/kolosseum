// DEV NOTE: BETA-22 clean-checkout verify-runner proof wrapper.

import {
  spawnSync
} from "node:child_process";

import process from "node:process";

function run(
  command,
  args,
  label
) {
  const result =
    spawnSync(
      command,
      args,
      {
        cwd:
          process.cwd(),
        stdio:
          "inherit",
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
    "BETA-22 clean-checkout build"
  );
}
else {
  run(
    "npm",
    [
      "run",
      "build"
    ],
    "BETA-22 clean-checkout build"
  );
}

run(
  process.execPath,
  [
    "--test",
    "test/beta_22_replay_verify_runner.test.mjs"
  ],
  "BETA-22 replay verify tests"
);

run(
  process.execPath,
  [
    "ci/scripts/run_beta_22_replay_verify.mjs",
    "--verify"
  ],
  "BETA-22 verify-only replay runner"
);
