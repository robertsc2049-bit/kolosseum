
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import { execSync } from "node:child_process";

function sh(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

sh("node ci/guards/artefacts_map_guard.mjs");
