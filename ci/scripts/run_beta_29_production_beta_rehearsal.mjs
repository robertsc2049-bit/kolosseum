// DEV NOTE: BETA-29 release-candidate rehearsal composition runner.

import {
  spawnSync
} from "node:child_process";

import process from "node:process";

function run(
  command,
  args,
  label
) {
  console.log("");
  console.log("BETA-29 STAGE: " + label);

  const result =
    spawnSync(
      command,
      args,
      {
        cwd:
          process.cwd(),
        stdio:
          "inherit",
        shell:
          false,
        windowsHide:
          true
      }
    );

  if (result.error) {
    console.error(
      label +
      " could not start: " +
      result.error.message
    );

    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(
      label +
      " failed with exit code " +
      String(result.status ?? 1)
    );

    process.exit(
      result.status ?? 1
    );
  }
}

function runNpm(
  script,
  label
) {
  if (process.platform === "win32") {
    run(
      process.env.ComSpec ||
        "cmd.exe",
      [
        "/d",
        "/s",
        "/c",
        "npm.cmd run " + script
      ],
      label
    );

    return;
  }

  run(
    "npm",
    [
      "run",
      script
    ],
    label
  );
}

runNpm(
  "build",
  "clean-checkout build"
);

run(
  process.execPath,
  [
    "--test",
    "test/beta_29_production_beta_rehearsal.test.mjs"
  ],
  "integrated Phase 1-8 rehearsal"
);

run(
  process.execPath,
  [
    "ci/scripts/run_beta_22_replay_verify.mjs",
    "--verify"
  ],
  "verify-only replay suite"
);

run(
  process.execPath,
  [
    "ci/scripts/kolosseum_v0_test_suite.mjs",
    "--json"
  ],
  "forbidden-copy and active-scope scan"
);

run(
  process.execPath,
  [
    "ci/scripts/run_beta_28_secret_scan.mjs"
  ],
  "tracked-file secret scan"
);

run(
  process.execPath,
  [
    "ci/scripts/run_beta_28_dependency_audit.mjs"
  ],
  "production dependency audit"
);

console.log("");
console.log(
  "CI_BETA_29_PRODUCTION_BETA_REHEARSAL::PASS"
);
