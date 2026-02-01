import { existsSync } from "node:fs";
import { execSync } from "node:child_process";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

const banned = "scripts/engine-status.ps1";

if (existsSync(banned)) {
  die(`❌ BANNED FOOTGUN PRESENT ON DISK: ${banned}`);
}

try {
  const tracked = execSync("git ls-files", { stdio: ["ignore", "pipe", "ignore"] })
    .toString("utf8")
    .split(/\r?\n/)
    .filter(Boolean);

  if (tracked.includes(banned)) {
    die(`❌ BANNED FOOTGUN IS TRACKED IN GIT: ${banned}`);
  }
} catch (e) {
  die(`❌ ban_engine_status_guard: git ls-files failed (${e?.message ?? e})`);
}

console.log(`OK: banned footgun not present or tracked (${banned})`);