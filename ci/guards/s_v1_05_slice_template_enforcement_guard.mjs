// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-05 slice template enforcement guard.
 * Purpose: proves v1 slices must declare target, invariants, allowed files,
 * forbidden files, proof, branch rule, commit rule, PR rule, boundary, and
 * non-scope before implementation.
 * Boundary: checks developer docs and PR template markers only. It does not
 * inspect, execute, or alter engine, registry, app, auth, payment, UI, or
 * workflow behaviour.
 * Determinism: reads fixed repository files and exact marker strings without
 * network, clock, database, or runtime state.
 * Failure: emits CI_V1_SLICE_TEMPLATE_ENFORCEMENT when v1 slice execution
 * markers drift.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GUARD = "S-V1-05";
const TOKEN = "CI_V1_SLICE_TEMPLATE_ENFORCEMENT";

const SLICE_TEMPLATE = "docs/dev/SLICE_TEMPLATE.md";
const PR_TEMPLATE = ".github/pull_request_template.md";
const BRANCH_CONVENTIONS = "docs/dev/BRANCH_AND_PR_CONVENTIONS.md";
const DEVELOPER_CONVENTIONS = "docs/dev/DEVELOPER_OPERATING_CONVENTIONS.md";
const ACCEPTANCE_GATE = "docs/v1/V1_ACCEPTANCE_GATE.md";

const REQUIRED_SLICE_TEMPLATE_MARKERS = [
  "## V1 enforced slice template",
  "No v1 work may start without a slice ID.",
  "Do not implement before preflight.",
  "- Slice ID:",
  "- Title:",
  "- Goal:",
  "- Target:",
  "- Boundary:",
  "- Invariants:",
  "- Allowed files:",
  "- Forbidden files:",
  "- Expected proof:",
  "- Branch rule:",
  "- Commit rule:",
  "- PR rule:",
  "- Non-scope:",
  "V1 branch names must use `ticket/s-v1-<number>-<short-name>`.",
  "Do not use vague branches such as `fix-stuff`, `fixes`, `misc`, `stuff`, or `wip`.",
  "Every v1 commit must start with the slice ID.",
  "Every v1 PR must state Boundary, Proof, and Non-scope.",
  "Generated files must be refreshed only through owning generators.",
  "`npm.cmd run verify` passes from a clean tree"
];

const REQUIRED_PR_TEMPLATE_MARKERS = [
  "## S-V1-05 v1 slice enforcement checklist",
  "- [ ] Target uses a slice ID.",
  "- [ ] Boundary is stated.",
  "- [ ] Proof is stated.",
  "- [ ] Non-scope is stated.",
  "- [ ] Tests or guards run are listed.",
  "- [ ] Branch follows `ticket/s-v1-<number>-<short-name>` for v1 work.",
  "- [ ] Commit starts with the slice ID.",
  "- [ ] This PR does not hide v1 work without a slice ID.",
  "- [ ] This PR does not use a vague branch such as `fix-stuff`, `fixes`, `misc`, `stuff`, or `wip`."
];

const REQUIRED_BRANCH_CONVENTION_MARKERS = [
  "## S-V1-05 enforced v1 branch, commit, and PR rules",
  "No v1 work may start without a slice ID.",
  "Every v1 branch must use `ticket/s-v1-<number>-<short-name>`.",
  "Do not use vague branch names such as `fix-stuff`, `fixes`, `misc`, `stuff`, or `wip`.",
  "Every v1 commit must start with the slice ID.",
  "Every v1 PR must state Boundary, Proof, and Non-scope.",
  "Every v1 PR must list the tests or guards run.",
  "A v1 PR must not be merged until every reported PR check is complete and green."
];

const REQUIRED_DEVELOPER_CONVENTION_MARKERS = [
  "A slice must have:",
  "- target,",
  "- invariant,",
  "- proof,",
  "- allowed files,",
  "- forbidden files,",
  "- tests,",
  "- rollback plan.",
  "Every PR must describe boundary and proof."
];

const REQUIRED_ACCEPTANCE_MARKERS = [
  "slice template exists",
  "PR template requires boundary, proof, and non-scope",
  "future developer can find current boundary without founder memory"
];

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
    fail("Required file is missing.", { path: relPath });
    return "";
  }

  return fs.readFileSync(absPath, "utf8");
}

function assertMarkers(relPath, markers, markerType) {
  const text = readRequiredText(relPath);

  for (const marker of markers) {
    if (!text.includes(marker)) {
      fail("Required v1 slice template enforcement marker is missing.", {
        path: relPath,
        marker_type: markerType,
        marker
      });
    }
  }
}

assertMarkers(SLICE_TEMPLATE, REQUIRED_SLICE_TEMPLATE_MARKERS, "slice_template");
assertMarkers(PR_TEMPLATE, REQUIRED_PR_TEMPLATE_MARKERS, "pr_template");
assertMarkers(BRANCH_CONVENTIONS, REQUIRED_BRANCH_CONVENTION_MARKERS, "branch_conventions");
assertMarkers(DEVELOPER_CONVENTIONS, REQUIRED_DEVELOPER_CONVENTION_MARKERS, "developer_conventions");
assertMarkers(ACCEPTANCE_GATE, REQUIRED_ACCEPTANCE_MARKERS, "acceptance_gate");

if (process.exitCode && process.exitCode !== 0) {
  throw new Error("S-V1-05 slice template enforcement guard failed.");
}

console.log(JSON.stringify({
  ok: true,
  guard: GUARD,
  token: TOKEN,
  slice_template: SLICE_TEMPLATE,
  pr_template: PR_TEMPLATE,
  branch_conventions: BRANCH_CONVENTIONS,
  message: "V1 slice template enforcement passed."
}, null, 2));
