import path from "node:path";
import { spawnSync } from "node:child_process";
import { composeTestCiFromIndex } from "./compose_test_ci_from_index.mjs";

const NODE_TEST_CMD_RE = /^node (test\/[A-Za-z0-9._/-]+\.test\.mjs)$/;

function run() {
  const repo = process.cwd();
  const { commands } = composeTestCiFromIndex(repo);

  for (const command of commands) {
    const match = NODE_TEST_CMD_RE.exec(command);
    if (!match) {
      throw new Error(`unsupported composed command for runner: ${command}`);
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
}

run();