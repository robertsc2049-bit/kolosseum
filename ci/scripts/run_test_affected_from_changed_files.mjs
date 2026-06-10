import { spawnSync } from "node:child_process";
import { composeTestAffectedFromChangedFiles } from "./compose_test_affected_from_changed_files.mjs";
import { applyDefaultNodeTestReporterEnv } from "./test_reporter_env.mjs";

applyDefaultNodeTestReporterEnv();

function run() {
  const repo = process.cwd();
  const result = composeTestAffectedFromChangedFiles(repo);

  console.log(`test:affected mode=${result.mode} count=${result.commands.length}`);
  console.log(`test:affected changed=${result.changedFiles.join(", ") || "(none)"}`);

  if (result.commands.length === 0) {
    console.log("AFFECTED_TESTS_OK: no affected tests.");
    return;
  }

  for (const command of result.commands) {
    const child = spawnSync(command, {
      cwd: repo,
      stdio: "inherit",
      shell: true,
      env: process.env
    });

    if (child.error) {
      throw child.error;
    }

    if (typeof child.status === "number" && child.status !== 0) {
      process.exit(child.status);
    }

    if (child.signal) {
      process.kill(process.pid, child.signal);
      return;
    }
  }

  console.log("AFFECTED_TESTS_OK: all affected tests passed.");
}

run();
