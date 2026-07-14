// DEV NOTE: BETA-25 clean-checkout Phase 8 chain and seal-gate proof wrapper.

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
      "npm.cmd run build"
    ],
    "BETA-25 clean-checkout build"
  );
}
else {
  run(
    "npm",
    [
      "run",
      "build"
    ],
    "BETA-25 clean-checkout build"
  );
}

run(
  process.execPath,
  [
    "--test",
    "test/beta_25_phase8_chain_seal_gates.test.mjs"
  ],
  "BETA-25 Phase 8 chain and seal-gate tests"
);
