import { execSync } from "node:child_process";
import { composeTestCiIntegrationCommands } from "./compose_test_ci_integration_from_index.mjs";

const commands = composeTestCiIntegrationCommands();

for (const command of commands) {
  execSync(command, { stdio: "inherit" });
}