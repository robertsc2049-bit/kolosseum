// @law: Repo Governance
// @severity: medium
// @scope: repo
// @law dev_function_note_policy
// @severity error
// @scope developer-handover

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const requiredDocs = Object.freeze([
  "docs/dev/FUNCTION_DOCUMENTATION_POLICY.md",
  "docs/roadmap/DEV_FUNCTION_NOTES_BASELINE.md"
]);

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

function fail(message) {
  console.error(`dev_function_note_policy_guard: FAIL: ${message}`);
  process.exit(1);
}

function readText(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);

  if (!fs.existsSync(fullPath)) {
    fail(`missing required file: ${relativePath}`);
  }

  return fs.readFileSync(fullPath, "utf8");
}

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

const packageText = readText("package.json");
if (!packageText.includes("node ci/guards/dev_function_note_policy_guard.mjs")) {
  fail("package.json lint:fast does not invoke dev_function_note_policy_guard");
}

const guardsIndexText = readText("docs/GUARDS_INDEX.md");
if (!guardsIndexText.includes("dev_function_note_policy_guard")) {
  fail("docs/GUARDS_INDEX.md does not index dev_function_note_policy_guard");
}

console.log("OK: dev_function_note_policy_guard");
