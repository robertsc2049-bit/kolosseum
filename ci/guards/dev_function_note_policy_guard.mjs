// @law: Repo Governance
// @severity: medium
// @scope: repo
// @law dev_function_note_policy
// @severity error
// @scope developer-handover

// DEV NOTE: Developer function-note policy guard. This script makes the
// developer-handover standard executable by checking policy docs, critical export
// documentation blocks, guard indexing, and package script wiring.
// It does not define product law; it proves the repo keeps the handover notes
// that help future developers understand critical exported boundaries.

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

// DEV NOTE: These docs are the policy anchors for function-level developer notes.
// The guard fails if either file is missing or stops carrying the required policy
// phrases that describe the docs-tests-CI hierarchy.
const requiredDocs = Object.freeze([
  "docs/dev/FUNCTION_DOCUMENTATION_POLICY.md",
  "docs/roadmap/DEV_FUNCTION_NOTES_BASELINE.md"
]);

// DEV NOTE: Critical files are the first enforced documentation surface.
// Missing files are skipped because some release branches may not contain every
// later surface yet; existing files must document each exported entrypoint.
const criticalFiles = Object.freeze([
  "shared/v1-boundary/v1BoundaryGuards.mjs",
  "server/api/coachNotes.ts",
  "server/api/sessionArtefactViewer.ts",
  "server/history/historyCounts.access.ts",
  "server/history/historyCounts.contract.ts",
  "server/history/historyCounts.query.ts",
  "shared/pilot-lifecycle/coachOperableGateContract.mjs",
  "shared/pilot-lifecycle/declarationAcceptanceStateSurface.mjs",
  "shared/pilot-lifecycle/onboardingStartGateContract.mjs",
  "shared/pilot-lifecycle/pilotLifecycleStateMachine.mjs",
  "shared/pilot-lifecycle/pilotStatusReasonCodes.mjs",
  "shared/presentation/nd_mode_execution_surface.mjs"
]);

// DEV NOTE: Every enforced function note must use the same section names.
// This keeps exported boundary documentation predictable for future maintainers
// and makes missing purpose, input, output, boundary, determinism, or failure
// detail visible in CI.
const requiredSections = Object.freeze([
  "FUNCTION NOTE:",
  "Export:",
  "Purpose:",
  "Inputs:",
  "Output:",
  "Boundary:",
  "Determinism:",
  "Failure:"
]);

// DEV NOTE: These words are blocked inside FUNCTION NOTE blocks because developer
// comments must not introduce claims, advice, evaluation language, or hidden
// product meaning. Canonical docs define law; comments explain boundaries.
const forbiddenTerms = Object.freeze([
  "optimal",
  "recommended",
  "safe",
  "injury risk",
  "readiness",
  "fatigue",
  "diagnosis",
  "rehabilitation",
  "predicts",
  "prevents",
  "guarantees",
  "programme worked",
  "programme failed"
]);

/**
 * DEV NOTE: Terminate with a stable guard-owned message and non-zero exit code.
 * Policy failures should be readable in CI and PowerShell output instead of
 * surfacing as unhandled JavaScript stack traces.
 */
function fail(message) {
  console.error(`dev_function_note_policy_guard: FAIL: ${message}`);
  process.exit(1);
}

/**
 * DEV NOTE: Read a required repo text file relative to the current repo root.
 * Missing required docs, package.json, or guard index files are hard failures
 * because the policy surface cannot be proven without them.
 */
function readText(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);

  if (!fs.existsSync(fullPath)) {
    fail(`missing required file: ${relativePath}`);
  }

  return fs.readFileSync(fullPath, "utf8");
}

/**
 * DEV NOTE: Extract exported function and const entrypoints from a source file.
 * The guard intentionally checks simple named exports only; extending export
 * forms should be a deliberate guard change with matching tests.
 */
function exportedEntrypoints(text) {
  const exports = [];
  const pattern = /^\s*export\s+(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(|^\s*export\s+const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=/gmu;
  let match = pattern.exec(text);

  while (match) {
    exports.push({
      name: match[1] || match[2],
      index: match.index
    });

    match = pattern.exec(text);
  }

  return exports;
}

/**
 * DEV NOTE: Find the nearest FUNCTION NOTE block before an export.
 * The bounded lookback window prevents one old block at the top of a file from
 * accidentally documenting many later exports.
 */
function functionNoteBefore(text, exportIndex) {
  const prefix = text.slice(0, exportIndex);
  const window = prefix.slice(Math.max(0, prefix.length - 1400));
  const pattern = /\/\*\*[\s\S]*?FUNCTION NOTE:[\s\S]*?\*\//gu;
  let found = "";
  let match = pattern.exec(window);

  while (match) {
    found = match[0];
    match = pattern.exec(window);
  }

  return found;
}

// DEV NOTE: Required documentation phrases prove the policy docs still state the
// intended hierarchy: canonical docs define law, function notes explain, tests
// prove behaviour, and CI blocks drift.
for (const docPath of requiredDocs) {
  const text = readText(docPath);

  for (const required of [
    "Canonical docs define law",
    "FUNCTION NOTE",
    "Tests prove behaviour",
    "CI blocks drift"
  ]) {
    if (!text.includes(required)) {
      fail(`${docPath} missing required policy phrase: ${required}`);
    }
  }
}

// DEV NOTE: Existing critical files must document each named exported entrypoint.
// Each note must match the export name, include all required sections, and avoid
// forbidden claim language inside the developer note itself.
for (const criticalFile of criticalFiles) {
  const fullPath = path.join(repoRoot, criticalFile);

  if (!fs.existsSync(fullPath)) {
    continue;
  }

  const text = fs.readFileSync(fullPath, "utf8");
  const exports = exportedEntrypoints(text);

  for (const entrypoint of exports) {
    const note = functionNoteBefore(text, entrypoint.index);

    if (!note) {
      fail(`${criticalFile} missing FUNCTION NOTE for export: ${entrypoint.name}`);
    }

    for (const section of requiredSections) {
      if (!note.includes(section)) {
        fail(`${criticalFile} FUNCTION NOTE for ${entrypoint.name} missing section: ${section}`);
      }
    }

    if (!note.includes(`Export: ${entrypoint.name}`)) {
      fail(`${criticalFile} FUNCTION NOTE has wrong Export field for: ${entrypoint.name}`);
    }

    const lower = note.toLowerCase();

    for (const forbidden of forbiddenTerms) {
      if (lower.includes(forbidden)) {
        fail(`${criticalFile} FUNCTION NOTE for ${entrypoint.name} contains forbidden term: ${forbidden}`);
      }
    }
  }
}

// DEV NOTE: package.json wiring keeps the policy active during lint:fast.
// If this check fails, the guard may exist but not run in the expected local and
// CI entrypoint.
const packageText = readText("package.json");
if (!packageText.includes("node ci/guards/dev_function_note_policy_guard.mjs")) {
  fail("package.json lint:fast does not invoke dev_function_note_policy_guard");
}

// DEV NOTE: Guard index wiring keeps the policy discoverable for future
// developers. A guard that is not indexed is harder to understand and maintain.
const guardsIndexText = readText("docs/GUARDS_INDEX.md");
if (!guardsIndexText.includes("dev_function_note_policy_guard")) {
  fail("docs/GUARDS_INDEX.md does not index dev_function_note_policy_guard");
}

console.log("OK: dev_function_note_policy_guard");
