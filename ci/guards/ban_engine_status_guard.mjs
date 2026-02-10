// @law: Runtime Boundary
// @severity: high
// @scope: engine
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

const banned = "scripts/engine-status.ps1";
const bannedNorm = banned.replace(/\\/g, "/").toLowerCase();

if (existsSync(banned)) {
  die(`\u274C BANNED FOOTGUN PRESENT ON DISK: ${banned}`);
}

try {
  const tracked = execSync("git ls-files -z", { stdio: ["ignore", "pipe", "ignore"] })
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((p) => p.replace(/\\/g, "/").toLowerCase());

  if (tracked.includes(bannedNorm)) {
    die(`\u274C BANNED FOOTGUN IS TRACKED IN GIT: ${banned}`);
  }
} catch (e) {
  die(`\u274C ban_engine_status_guard: git ls-files failed (${e?.message ?? e})`);
}

console.log(`OK: banned footgun not present or tracked (${banned})`);
