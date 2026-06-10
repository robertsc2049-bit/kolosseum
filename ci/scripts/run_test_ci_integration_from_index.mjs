
// DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
// deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
// failure output readable for PowerShell and CI users.

import { execSync } from "node:child_process";
import { composeTestCiIntegrationCommands } from "./compose_test_ci_integration_from_index.mjs";

const commands = composeTestCiIntegrationCommands();

for (const command of commands) {
  execSync(command, { stdio: "inherit" });
}
