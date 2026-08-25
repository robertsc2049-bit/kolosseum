
// DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
// deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
// failure output readable for PowerShell and CI users.

import path from "node:path";
import { spawnSync } from "node:child_process";
import { composeTestCiFromIndex } from "./compose_test_ci_from_index.mjs";
import { applyDefaultNodeTestReporterEnv } from "./test_reporter_env.mjs";

const NODE_TEST_CMD_RE = /^node (test\/[A-Za-z0-9._/-]+\.test\.mjs)$/;
const NPM_RUN_CMD_RE = /^npm run ([A-Za-z0-9:_-]+)$/;
const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";

applyDefaultNodeTestReporterEnv();

function runCommand(executable, args, options = {}) {
  const child = spawnSync(executable, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
    ...options
  });

  if (child.error) {
    throw child.error;
  }

  if (typeof child.status === "number" && child.status !== 0) {
    process.exit(child.status);
  }

  if (child.signal) {
    process.kill(process.pid, child.signal);
    return false;
  }

  return true;
}

function run() {
  const repo = process.cwd();
  const { commands } = composeTestCiFromIndex(repo);

  for (const command of commands) {
    const nodeTestMatch = NODE_TEST_CMD_RE.exec(command);
    if (nodeTestMatch) {
      const absTestPath = path.join(repo, ...nodeTestMatch[1].split("/"));
      if (!runCommand(process.execPath, [absTestPath])) return;
      continue;
    }

    const npmRunMatch = NPM_RUN_CMD_RE.exec(command);
    if (npmRunMatch) {
      // Windows can't spawnSync a .cmd file directly without a shell
      // (throws EINVAL) - shell:true is safe here since the only argument
      // is npmRunMatch[1], already constrained to [A-Za-z0-9:_-]+ by the
      // regex above.
      if (!runCommand(npmCommand, ["run", npmRunMatch[1]], { shell: isWindows })) return;
      continue;
    }

    throw new Error(`unsupported composed command for runner: ${command}`);
  }
}

run();
