import process from "node:process";
import { spawnSync } from "node:child_process";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function main() {
  const r = spawnSync(
    process.execPath,
    ["ci/scripts/evidence_seal.mjs", "--check"],
    { stdio: "inherit" }
  );
  if (r.status !== 0) {
    die("evidence_seal_guard: FAILED (envelope/seal out of date). See message above.");
  }
}

main();
