import { execSync } from "node:child_process";

const env = { ...process.env, UPDATE_GOLDEN: "1" };

// Run golden generation (will update expected snapshots)
execSync("npm run e2e:golden", { stdio: "inherit", env });

// Rebuild the pinned manifest file from disk
execSync("node ci/scripts/write_golden_manifest.mjs", { stdio: "inherit", env: process.env });

console.log("golden:update: done (snapshots + manifest regenerated).");