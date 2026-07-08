// @law: CI Integrity
// @severity: high
// @scope: repo

// DEV NOTE: Green/CI parity guard. This script protects the local-to-CI contract
// by requiring a GitHub Actions workflow to invoke npm run green:ci whenever
// package.json exposes scripts.green. Local green and CI green must remain aligned
// so developers do not trust a local path that CI never runs.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

/**
 * DEV NOTE: Terminate with a stable guard-owned message and non-zero exit code.
 * CI parity failures should be readable in local and GitHub Actions output rather
 * than surfacing as unhandled JavaScript stack traces.
 */
function die(msg) {
  console.error(msg);
  process.exit(1);
}

/**
 * DEV NOTE: Existence helper used for optional surfaces.
 * Missing workflows can be valid only when scripts.green is absent; once green
 * exists, missing workflow files become a CI parity failure.
 */
function exists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * DEV NOTE: Read UTF-8 text from repo files. This guard only needs textual
 * package/workflow inspection and does not execute workflow YAML.
 */
function readUtf8(p) {
  return fs.readFileSync(p, "utf8");
}

/**
 * DEV NOTE: List workflow YAML files from .github/workflows without recursion.
 * GitHub workflow entrypoints are expected to live directly in that directory,
 * so hidden nested discovery is deliberately avoided.
 */
function listYamlFiles(dirAbs) {
  if (!exists(dirAbs)) return [];
  return fs
    .readdirSync(dirAbs, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .filter((n) => n.toLowerCase().endsWith(".yml") || n.toLowerCase().endsWith(".yaml"))
    .map((n) => path.join(dirAbs, n));
}

const repo = process.cwd();
const pkgPath = path.join(repo, "package.json");

// DEV NOTE: package.json is mandatory because scripts.green is the trigger for
// this parity rule. Running outside the repo root should fail loudly.
if (!exists(pkgPath)) die("green_ci_parity_guard: package.json missing (run from repo root)");

let pkg;
try {
  pkg = JSON.parse(readUtf8(pkgPath));
} catch (e) {
  die("green_ci_parity_guard: failed to parse package.json: " + String(e));
}

const scripts = (pkg && pkg.scripts) || {};
const hasGreen = Object.prototype.hasOwnProperty.call(scripts, "green");

// DEV NOTE: If no local green script exists, there is no green-to-CI parity
// contract to enforce. This is a deliberate skip, not approval of CI coverage.
if (!hasGreen) {
  console.log("OK: green_ci_parity_guard (no scripts.green; skipping)");
  process.exit(0);
}

const wfDir = path.join(repo, ".github", "workflows");
const ymls = listYamlFiles(wfDir);

if (ymls.length === 0) {
  die("green_ci_parity_guard: scripts.green exists but no workflow YAML files found in .github/workflows");
}

// DEV NOTE: The required CI invocation is npm run green:ci, not npm run green.
// green:ci is the CI-safe entrypoint and avoids local-only assumptions leaking
// into GitHub Actions.
const needle = /npm\s+run\s+green:ci\b/;
let hitFile = "";

// DEV NOTE: Any workflow may own the invocation, but at least one must contain it.
// The first hit is reported so future developers can locate the CI parity anchor.
for (const f of ymls) {
  const txt = readUtf8(f);
  if (needle.test(txt)) {
    hitFile = path.relative(repo, f);
    break;
  }
}

// DEV NOTE: Failure means local green exists without a matching CI green path.
// Do not fix this by deleting scripts.green or weakening the regex; wire CI to
// npm run green:ci unless the release boundary intentionally changes.
if (!hitFile) {
  die("green_ci_parity_guard: scripts.green exists but CI does not invoke 'npm run green:ci' in any workflow YAML");
}

// DEV NOTE: Success means CI has at least one visible workflow path invoking the
// CI-safe green script. It does not prove every workflow is complete by itself.
console.log("OK: green_ci_parity_guard (workflow invokes green:ci: " + hitFile + ")");
