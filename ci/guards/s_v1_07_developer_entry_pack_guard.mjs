// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-07 developer entry pack guard.
 * Purpose: proves the minimum developer handover entry pack exists, cross-links
 * to the active release boundary, and explains authority without creating
 * product, engine, registry, runtime, commercial, workflow, or CI-token law.
 * Boundary: documentation marker checks only. It does not inspect, execute, or
 * alter runtime behaviour, engine behaviour, app implementation, registry
 * content, payment/auth/UI implementation, workflows, or database state.
 * Determinism: reads fixed repository files and exact marker strings without
 * network, clock, database, or runtime state.
 * Failure: emits CI_V1_DEVELOPER_ENTRY_PACK when the handover entry pack drifts.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GUARD = "S-V1-07";
const TOKEN = "CI_V1_DEVELOPER_ENTRY_PACK";

const FILES = {
  readme: "README.md",
  gettingStarted: "docs/dev/GETTING_STARTED.md",
  commandGuide: "docs/dev/COMMAND_GUIDE.md",
  ciFailureGuide: "docs/dev/CI_FAILURE_GUIDE.md",
  repoMap: "docs/dev/REPO_MAP.md",
  namingConventions: "docs/dev/NAMING_CONVENTIONS.md",
  developerConventions: "docs/dev/DEVELOPER_OPERATING_CONVENTIONS.md",
  activeBoundary: "docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md",
  v1ReleaseBoundary: "docs/v1/V1_RELEASE_BOUNDARY.md",
  v1NotInScope: "docs/v1/V1_NOT_IN_SCOPE.md",
  adrReadme: "docs/adr/README.md"
};

const REQUIRED_MARKERS = new Map([
  [FILES.readme, [
    "S-V1-07:DEVELOPER-ENTRY-PACK:START",
    "future developer",
    "current release boundary",
    "setup commands",
    "check commands",
    "what not to touch",
    "docs/dev/GETTING_STARTED.md",
    "docs/dev/COMMAND_GUIDE.md",
    "docs/dev/CI_FAILURE_GUIDE.md",
    "docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md",
    "docs/v1/V1_RELEASE_BOUNDARY.md",
    "docs/v1/V1_NOT_IN_SCOPE.md",
    "Docs define law.",
    "Tests prove behaviour.",
    "Comments explain boundaries.",
    "CI blocks drift.",
    "npm.cmd run verify"
  ]],
  [FILES.gettingStarted, [
    "S-V1-07:GETTING-STARTED-ENTRY-PACK:START",
    "future developer",
    "current release boundary",
    "setup commands",
    "check commands",
    "what not to touch",
    "docs/dev/COMMAND_GUIDE.md",
    "docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md",
    "docs/v1/V1_RELEASE_BOUNDARY.md",
    "docs/v1/V1_NOT_IN_SCOPE.md",
    "docs/dev/CI_FAILURE_GUIDE.md",
    "Docs define law.",
    "Tests prove behaviour.",
    "Comments explain boundaries.",
    "CI blocks drift.",
    "npm.cmd run verify"
  ]],
  [FILES.commandGuide, [
    "# Command Guide",
    "Slice: S-V1-07.",
    "future developer",
    "setup commands",
    "check commands",
    "npm.cmd ci",
    "npm.cmd run verify",
    "npm.cmd run guard:index",
    "node ci/scripts/run_failure_token_index_guard.mjs --write",
    "npm.cmd run hash:write",
    "docs/dev/CI_FAILURE_GUIDE.md",
    "docs/dev/FAILURE_TOKEN_INDEX.md",
    "docs/GUARDS_INDEX.md",
    "Docs define law.",
    "Tests prove behaviour.",
    "Comments explain boundaries.",
    "CI blocks drift."
  ]],
  [FILES.ciFailureGuide, [
    "S-V1-07:CI-FAILURE-ENTRY-PACK:START",
    "future developer",
    "current release boundary",
    "docs/dev/COMMAND_GUIDE.md",
    "docs/dev/FAILURE_TOKEN_INDEX.md",
    "docs/GUARDS_INDEX.md",
    "docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md",
    "what not to touch",
    "npm.cmd run verify",
    "Docs define law.",
    "Tests prove behaviour.",
    "Comments explain boundaries.",
    "CI blocks drift."
  ]],
  [FILES.repoMap, [
    "S-V1-07:DEVELOPER-ENTRY-PACK-MAP:START",
    "README.md",
    "docs/dev/GETTING_STARTED.md",
    "docs/dev/COMMAND_GUIDE.md",
    "docs/dev/CI_FAILURE_GUIDE.md",
    "docs/dev/REPO_MAP.md",
    "docs/dev/NAMING_CONVENTIONS.md",
    "docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md",
    "docs/adr/README.md",
    "Docs define law.",
    "Tests prove behaviour.",
    "Comments explain boundaries.",
    "CI blocks drift."
  ]],
  [FILES.namingConventions, [
    "S-V1-07:ENTRY-PACK-NAMING:START",
    "Developer entry pack names",
    "docs/dev/COMMAND_GUIDE.md",
    "Entry-pack docs explain authority without creating product law."
  ]],
  [FILES.developerConventions, [
    "S-V1-07:DEVELOPER-ENTRY-PACK-RULE:START",
    "docs/dev/COMMAND_GUIDE.md",
    "future developer",
    "current release boundary",
    "setup commands",
    "check commands",
    "what not to touch",
    "These docs explain authority without creating new product law."
  ]]
]);

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    guard: GUARD,
    token: TOKEN,
    message,
    ...details
  }, null, 2));

  process.exitCode = 1;
}

function readRequiredText(relPath) {
  const absPath = path.join(ROOT, relPath);

  if (!fs.existsSync(absPath)) {
    fail("Required developer entry-pack file is missing.", { path: relPath });
    return "";
  }

  return fs.readFileSync(absPath, "utf8");
}

for (const relPath of Object.values(FILES)) {
  readRequiredText(relPath);
}

for (const [relPath, markers] of REQUIRED_MARKERS.entries()) {
  const text = readRequiredText(relPath);

  for (const marker of markers) {
    if (!text.includes(marker)) {
      fail("Required developer entry-pack marker is missing.", {
        path: relPath,
        marker
      });
    }
  }
}

if (process.exitCode && process.exitCode !== 0) {
  throw new Error("S-V1-07 developer entry pack guard failed.");
}

console.log(JSON.stringify({
  ok: true,
  guard: GUARD,
  token: TOKEN,
  entry_pack_files_checked: Object.keys(FILES).length,
  message: "Developer entry pack passed."
}, null, 2));
