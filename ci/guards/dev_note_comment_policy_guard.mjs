// @law: Repo Governance
// @severity: medium
// @scope: repo
// @law dev_note_comment_policy
// @severity error
// @scope developer-handover

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const requiredDocs = Object.freeze([
  "docs/dev/CODE_COMMENT_POLICY.md",
  "docs/dev/CRITICAL_CODE_SIGNPOSTING_MAP.md",
  "docs/roadmap/DEV_NOTES_COMMENT_BASELINE.md"
]);

const requiredNoteFiles = Object.freeze([
  "shared/v1-boundary/v1BoundaryGuards.mjs",
  "shared/v1-registry/v1RegistryDomainScaffold.mjs",
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
  "DEV NOTE:",
  "Purpose:",
  "Boundary:",
  "Determinism:",
  "Failure:"
]);

const forbiddenDevNoteTerms = Object.freeze([
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
  console.error(`dev_note_comment_policy_guard: FAIL: ${message}`);
  process.exit(1);
}

function readText(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);

  if (!fs.existsSync(fullPath)) {
    fail(`missing required file: ${relativePath}`);
  }

  return fs.readFileSync(fullPath, "utf8");
}

function extractDevNoteBlocks(text) {
  const blocks = [];
  const pattern = /\/\*\*[\s\S]*?DEV NOTE:[\s\S]*?\*\//gu;
  let match = pattern.exec(text);

  while (match) {
    blocks.push(match[0]);
    match = pattern.exec(text);
  }

  return blocks;
}

for (const docPath of requiredDocs) {
  const text = readText(docPath);

  for (const required of [
    "Canonical docs define law",
    "DEV NOTE",
    "Tests prove behaviour",
    "CI blocks drift"
  ]) {
    if (!text.includes(required)) {
      fail(`${docPath} missing required policy phrase: ${required}`);
    }
  }
}

for (const noteFile of requiredNoteFiles) {
  const fullPath = path.join(repoRoot, noteFile);

  if (!fs.existsSync(fullPath)) {
    continue;
  }

  const text = fs.readFileSync(fullPath, "utf8");
  const blocks = extractDevNoteBlocks(text);

  if (blocks.length === 0) {
    fail(`missing DEV NOTE block: ${noteFile}`);
  }

  for (const block of blocks) {
    for (const section of requiredSections) {
      if (!block.includes(section)) {
        fail(`${noteFile} DEV NOTE missing section: ${section}`);
      }
    }

    const lower = block.toLowerCase();

    for (const forbidden of forbiddenDevNoteTerms) {
      if (lower.includes(forbidden)) {
        fail(`${noteFile} DEV NOTE contains forbidden term: ${forbidden}`);
      }
    }
  }
}

const packageText = readText("package.json");
if (!packageText.includes("node ci/guards/dev_note_comment_policy_guard.mjs")) {
  fail("package.json lint:fast does not invoke dev_note_comment_policy_guard");
}

const guardsIndexText = readText("docs/GUARDS_INDEX.md");
if (!guardsIndexText.includes("dev_note_comment_policy_guard")) {
  fail("docs/GUARDS_INDEX.md does not index dev_note_comment_policy_guard");
}

console.log("OK: dev_note_comment_policy_guard");
