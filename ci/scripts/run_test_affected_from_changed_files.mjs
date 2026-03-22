import path from "node:path";
import { spawnSync } from "node:child_process";
import { composeTestAffectedFromChangedFiles } from "./compose_test_affected_from_changed_files.mjs";

const NODE_TEST_CMD_RE = /^node (test\/[A-Za-z0-9._/-]+\.test\.mjs)$/;

function run() {
  const repo = process.cwd();
  const explicitFiles = process.argv.slice(2);
  const { mode, commands, changedFiles } = composeTestAffectedFromChangedFiles(
    repo,
    explicitFiles.length > 0 ? explicitFiles : undefined
  );

  if (commands.length === 0) {
    console.log("test:affected mode=empty count=0");
    console.log("AFFECTED_TESTS_OK: no affected tests to run.");
    return;
  }

  console.log(`test:affected mode=${mode} count=${commands.length}`);
  if (changedFiles.length > 0) {
    console.log(`test:affected changed=${changedFiles.join(", ")}`);
  }

  for (const command of commands) {
    const match = NODE_TEST_CMD_RE.exec(command);
    if (!match) {
      throw new Error(`unsupported affected command for runner: ${command}`);
    }

    const testPath = match[1];
    const absTestPath = path.join(repo, ...testPath.split("/"));

    const child = spawnSync(process.execPath, [absTestPath], {
      cwd: repo,
      stdio: "inherit",
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

  console.log("");
  console.log("AFFECTED_TESTS_OK: all affected tests passed.");
}

run();
