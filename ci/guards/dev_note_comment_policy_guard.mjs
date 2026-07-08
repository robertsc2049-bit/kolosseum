// @law: Repo Governance
// @severity: medium
// @scope: repo
// @law dev_note_comment_policy
// @severity error
// @scope developer-handover

// DEV NOTE: Code comment policy guard. This script makes the developer handover
// comment standard executable by checking policy docs, required DEV NOTE blocks,
// forbidden claim terms inside those blocks, guard indexing, and package script
// wiring. Canonical docs define law; this guard proves the signposting surface
// has not drifted.

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

// DEV NOTE: These docs are the policy anchors for code comments and critical code
// signposting. The guard fails if they disappear or stop carrying the required
// docs-tests-CI hierarchy phrases.
const requiredDocs = Object.freeze([
  "docs/dev/CODE_COMMENT_POLICY.md",
  "docs/dev/CRITICAL_CODE_SIGNPOSTING_MAP.md",
  "docs/roadmap/DEV_NOTES_COMMENT_BASELINE.md"
]);

// DEV NOTE: Required note files are the enforced critical-code surface.
// Missing files are skipped so branches that do not yet contain a later surface
// do not fail, but existing files must contain structured DEV NOTE blocks.
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

// DEV NOTE: Every enforced DEV NOTE block must carry the same core sections.
// This keeps purpose, boundary, deterministic behaviour, and failure behaviour
// visible to a future developer without needing hidden context.
const requiredSections = Object.freeze([
  "DEV NOTE:",
  "Purpose:",
  "Boundary:",
  "Determinism:",
  "Failure:"
]);

// DEV NOTE: These words are blocked inside enforced DEV NOTE blocks because code
// comments must explain implementation boundaries, not introduce claims, advice,
// judgement labels, or product meaning outside canonical docs.
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

/**
 * DEV NOTE: Terminate with a stable guard-owned message and non-zero exit code.
 * Policy failures should be readable in CI and PowerShell output rather than
 * surfacing as unhandled JavaScript stack traces.
 */
function fail(message) {
  console.error(`dev_note_comment_policy_guard: FAIL: ${message}`);
  process.exit(1);
}

/**
 * DEV NOTE: Read a required repo text file relative to the current repo root.
 * Missing policy docs, package.json, or guard index files are hard failures
 * because the comment policy cannot be proven without them.
 */
function readText(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);

  if (!fs.existsSync(fullPath)) {
    fail(`missing required file: ${relativePath}`);
  }

  return fs.readFileSync(fullPath, "utf8");
}

/**
 * DEV NOTE: Extract JSDoc-style DEV NOTE blocks from a source file.
 * The guard intentionally checks block comments only because critical signposting
 * should be structured and reviewable, not scattered across incidental line notes.
 */
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

// DEV NOTE: Required documentation phrases prove the policy docs still state the
// intended hierarchy: canonical docs define law, DEV NOTE blocks explain, tests
// prove behaviour, and CI blocks drift.
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

// DEV NOTE: Existing required files must contain at least one structured DEV NOTE
// block. Each block must include the required sections and avoid forbidden terms
// so comments stay explanatory rather than becoming a second product authority.
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

// DEV NOTE: package.json wiring keeps the policy active during lint:fast.
// If this check fails, the guard may exist but not run in the expected local and
// CI entrypoint.
const packageText = readText("package.json");
if (!packageText.includes("node ci/guards/dev_note_comment_policy_guard.mjs")) {
  fail("package.json lint:fast does not invoke dev_note_comment_policy_guard");
}

// DEV NOTE: Guard index wiring keeps the policy discoverable for future
// developers. A guard that is not indexed is harder to understand and maintain.
const guardsIndexText = readText("docs/GUARDS_INDEX.md");
if (!guardsIndexText.includes("dev_note_comment_policy_guard")) {
  fail("docs/GUARDS_INDEX.md does not index dev_note_comment_policy_guard");
}

console.log("OK: dev_note_comment_policy_guard");
