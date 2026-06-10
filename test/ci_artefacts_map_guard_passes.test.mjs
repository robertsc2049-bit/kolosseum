import { execSync } from "node:child_process";

function sh(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

sh("node ci/guards/artefacts_map_guard.mjs");
