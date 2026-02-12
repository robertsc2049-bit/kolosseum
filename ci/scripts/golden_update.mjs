import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function run(cmd, args, env = {}) {
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: false,
    env: { ...process.env, ...env }
  });
  if (r.status !== 0) die(`Command failed: ${cmd} ${args.join(" ")}`);
}

function sha256File(p) {
  const buf = fs.readFileSync(p);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function patchPinnedShaInGuard(guardPath, constName, newSha) {
  const txt = fs.readFileSync(guardPath, "utf8");
  const re = new RegExp(`(const\\s+${constName}\\s*=\\s*")[a-f0-9]{64}(";)`, "i");
  if (!re.test(txt)) {
    die(`Could not find ${constName} constant in ${guardPath}`);
  }
  const next = txt.replace(re, `$1${newSha.toLowerCase()}$2`);
  fs.writeFileSync(guardPath, next, "utf8");
  console.log(`✅ Updated ${path.relative(process.cwd(), guardPath)} ${constName}=${newSha.toLowerCase()}`);
}

function main() {
  const isCI =
    String(process.env.CI || "").toLowerCase() === "true" ||
    process.env.GITHUB_ACTIONS === "true";
  if (isCI) die("golden:update is not allowed in CI. Run locally and commit the results.");

  // 1) Update snapshots
  run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "e2e:golden"], { UPDATE_GOLDEN: "1" });

  // 2) Rewrite manifest + outputs + their pins
  run(process.platform === "win32" ? "node.exe" : "node", ["ci/scripts/write_golden_manifest.mjs"]);
  run(process.platform === "win32" ? "node.exe" : "node", ["ci/scripts/write_golden_outputs.mjs"]);

  // 3) Patch pinned manifest SHA in the guard (so no manual edits)
  const manifestPath = path.join(process.cwd(), "test", "fixtures", "golden", "golden_manifest.v1.json");
  const manifestSha = sha256File(manifestPath);
  const manifestGuard = path.join(process.cwd(), "ci", "guards", "golden_manifest_guard.mjs");
  patchPinnedShaInGuard(manifestGuard, "PINNED_MANIFEST_SHA256", manifestSha);

  // 4) Verify everything clean without update mode
  run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "lint"]);
  run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "e2e:golden"]);

  console.log("✅ golden:update complete. Now git add + commit.");
}

main();