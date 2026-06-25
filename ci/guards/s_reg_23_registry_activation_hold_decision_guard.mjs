// @law: Registry Law
// @severity: high
// @scope: registry
/**
 * DEV NOTE: S-REG-23 guard.
 * Purpose: proves the activation result after S-REG-22 is a hold decision only.
 * Boundary: permits only S-REG-23 hold-decision files, package wiring,
 * generated indexes, generated checksums, and documentation. It must not permit
 * active registry activation, registry_index.json mutation, registry_bundle.json
 * mutation, active registry law mutation, engine consumption, marker evaluator
 * behaviour, value comparison, advice, outcome inference, UI behaviour,
 * programme assignment, substitution runtime, or coach interpretation.
 * Failure: emits CI_S_REG_23_REGISTRY_ACTIVATION_HOLD_DECISION.
 */

import fs from "node:fs";
import { execFileSync } from "node:child_process";

import {
  S_REG_23_FAILURE_TOKEN,
  S_REG_23_RUNTIME_STATUS,
  sReg23LoadRegistryActivationHoldDecision,
  sReg23ValidateRegistryActivationHoldDecision
} from "../registry/s_reg_23_registry_activation_hold_decision.mjs";

const repoRoot = process.cwd();
const GUARD = "S-REG-23";
const TOKEN = S_REG_23_FAILURE_TOKEN;

const allowedChangedFiles = new Set([
  "ci/registry/s_reg_23_registry_activation_hold_decision.mjs",
  "ci/registry/s_reg_23_registry_activation_hold_decision.json",
  "test/s_reg_23_registry_activation_hold_decision.test.mjs",
  "ci/guards/s_reg_23_registry_activation_hold_decision_guard.mjs",
  "docs/roadmap/S_REG_23_REGISTRY_ACTIVATION_HOLD_DECISION.md",
  "package.json",
  "ci/guards/_entrypoints.json",
  "docs/GUARDS_INDEX.md",
  "docs/dev/FAILURE_TOKEN_INDEX.md",
  "docs/checksums.sha256"
]);

const forbiddenChangedFiles = new Set([
  "registries/registry_index.json",
  "registries/registry_bundle.json",
  "ci/registry/s_reg_22_candidate_registry_build_review.json",
  "ci/registry/s_reg_21_threshold_marker_candidate_records.json",
  "ci/registry/s_reg_20_metric_exercise_link_candidate_expansion.json",
  "ci/registry/s_reg_19_sport_metric_candidate_expansion.json",
  "ci/registry/s_reg_18_exercise_activity_applicability_candidate_expansion.json",
  "ci/registry/s_reg_17_exercise_equipment_candidate_fk_closure_expansion.json",
  "ci/registry/s_reg_16_candidate_equipment_registry_content_batch_1.json",
  "ci/registry/s_reg_15_candidate_exercise_registry_content_batch_1.json"
]);

const forbiddenChangedPrefixes = Object.freeze([
  "engine/",
  "src/",
  "server/",
  "app/",
  "web/",
  "supabase/",
  "registries/",
  "shared/pilot-lifecycle/",
  "shared/v1-boundary/"
]);

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    guard: GUARD,
    token: TOKEN,
    message,
    ...details
  }, null, 2));
  process.exit(1);
}

function repoPath(relativePath) {
  return `${repoRoot}/${relativePath}`;
}

function readText(relativePath) {
  return fs.readFileSync(repoPath(relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function runGit(args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function assertIncludes(text, marker, context) {
  if (!text.includes(marker)) {
    fail("Required S-REG-23 marker is missing.", { marker, context });
  }
}

function parsePorcelainPath(line) {
  const rawPath = line.length >= 4 && line[2] === " "
    ? line.slice(3).trim()
    : line.replace(/^[ MADRCU?!]{1,2}\s+/u, "").trim();

  if (!rawPath) {
    return "";
  }

  if (rawPath.includes(" -> ")) {
    return rawPath.split(" -> ").pop().trim().replace(/^"|"$/gu, "").replace(/\\/gu, "/");
  }

  return rawPath.replace(/^"|"$/gu, "").replace(/\\/gu, "/");
}

function collectChangedFiles() {
  const branchName = runGit(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (!branchName.includes("s-reg-23-registry-activation-hold-decision")) {
    return [];
  }

  const changed = new Set();
  const porcelain = runGit(["status", "--porcelain=v1"]);

  for (const line of porcelain.split(/\r?\n/u).filter(Boolean)) {
    const relPath = parsePorcelainPath(line);
    if (relPath) {
      changed.add(relPath);
    }
  }

  const mergeBase = runGit(["merge-base", "HEAD", "origin/main"]);
  const committed = runGit(["diff", "--name-only", `${mergeBase}..HEAD`]);

  for (const relPath of committed.split(/\r?\n/u).filter(Boolean)) {
    changed.add(relPath.replace(/\\/gu, "/"));
  }

  return [...changed].sort();
}

function assertChangedFilesWithinBoundary() {
  const changed = collectChangedFiles();
  const disallowed = changed.filter((relativePath) => !allowedChangedFiles.has(relativePath));

  if (disallowed.length > 0) {
    fail("S-REG-23 touched files outside the registry activation hold decision boundary.", {
      changed_files: changed,
      disallowed_files: disallowed,
      allowed_files: [...allowedChangedFiles].sort()
    });
  }

  for (const relativePath of changed) {
    if (forbiddenChangedFiles.has(relativePath)) {
      fail("S-REG-23 touched a forbidden active or candidate dependency surface.", { path: relativePath });
    }

    for (const prefix of forbiddenChangedPrefixes) {
      if (relativePath.startsWith(prefix) && !allowedChangedFiles.has(relativePath)) {
        fail("S-REG-23 touched a forbidden active or runtime surface.", {
          path: relativePath,
          forbidden_prefix: prefix
        });
      }
    }
  }

  return changed;
}

function assertRequiredFilesPresent() {
  for (const relativePath of [
    "ci/registry/s_reg_23_registry_activation_hold_decision.mjs",
    "ci/registry/s_reg_23_registry_activation_hold_decision.json",
    "test/s_reg_23_registry_activation_hold_decision.test.mjs",
    "ci/guards/s_reg_23_registry_activation_hold_decision_guard.mjs",
    "docs/roadmap/S_REG_23_REGISTRY_ACTIVATION_HOLD_DECISION.md",
    "package.json"
  ]) {
    if (!fs.existsSync(repoPath(relativePath))) {
      fail("Required S-REG-23 file is missing.", { path: relativePath });
    }
  }
}

function assertPackageWiring() {
  const packageJson = readJson("package.json");
  const expected = "node --test test/s_reg_23_registry_activation_hold_decision.test.mjs && node ci/guards/s_reg_23_registry_activation_hold_decision_guard.mjs";

  if (packageJson.scripts?.["proof:s-reg-23"] !== expected) {
    fail("S-REG-23 package proof script is missing or incorrect.", {
      actual: packageJson.scripts?.["proof:s-reg-23"],
      expected
    });
  }

  if (packageJson.scripts?.["lint:fast"]?.includes("s_reg_23_registry_activation_hold_decision")) {
    fail("S-REG-23 must not append to the top-level lint:fast command.");
  }

  if (!packageJson.scripts?.["lint:fast:inline"]?.includes("s_reg_23_registry_activation_hold_decision")) {
    fail("S-REG-23 lint:fast:inline package wiring is missing.");
  }

  if (!packageJson.scripts?.["test:unit"]?.includes("s_reg_23_registry_activation_hold_decision_guard.mjs")) {
    fail("S-REG-23 test:unit guard wiring is missing.");
  }
}

function assertGeneratedIndexes() {
  const guardsIndex = readText("docs/GUARDS_INDEX.md");
  const failureTokenIndex = readText("docs/dev/FAILURE_TOKEN_INDEX.md");

  assertIncludes(
    guardsIndex,
    "ci/guards/s_reg_23_registry_activation_hold_decision_guard.mjs",
    "docs/GUARDS_INDEX.md"
  );

  assertIncludes(
    failureTokenIndex,
    "CI_S_REG_23_REGISTRY_ACTIVATION_HOLD_DECISION",
    "docs/dev/FAILURE_TOKEN_INDEX.md"
  );
}

function assertDocMarkers() {
  const doc = readText("docs/roadmap/S_REG_23_REGISTRY_ACTIVATION_HOLD_DECISION.md");

  for (const marker of [
    "S-REG-23",
    "registry_activation_hold_decision",
    "Hold decision only",
    "No active registry activation",
    "No registry bundle mutation",
    "No marker evaluator behaviour",
    "No real comparison",
    "No advice",
    "No outcome inference",
    "explicit activation slice"
  ]) {
    assertIncludes(doc, marker, "docs/roadmap/S_REG_23_REGISTRY_ACTIVATION_HOLD_DECISION.md");
  }
}

function assertSourceReviewStillHeld() {
  const review = readJson("ci/registry/s_reg_22_candidate_registry_build_review.json");

  if (review.activation_decision !== "not_authorised_pending_later_explicit_activation_slice") {
    fail("S-REG-22 source review no longer requires later activation decision.", {
      activation_decision: review.activation_decision
    });
  }

  if (review.active_registry_activation !== false || review.activation_ready !== false) {
    fail("S-REG-22 source review activation flags drifted.", {
      active_registry_activation: review.active_registry_activation,
      activation_ready: review.activation_ready
    });
  }
}

function main() {
  assertRequiredFilesPresent();
  const changedFiles = assertChangedFilesWithinBoundary();
  assertPackageWiring();
  assertGeneratedIndexes();
  assertDocMarkers();
  assertSourceReviewStillHeld();

  const decision = sReg23LoadRegistryActivationHoldDecision();
  const result = sReg23ValidateRegistryActivationHoldDecision();

  if (
    result.ok !== true ||
    result.decision_id !== "registry_activation_hold_decision" ||
    result.decision_type !== "hold" ||
    result.activation_decision !== "hold" ||
    result.activation_authorised !== false ||
    result.activation_ready !== false ||
    result.active_registry_activation !== false ||
    result.runtime_status !== S_REG_23_RUNTIME_STATUS
  ) {
    fail("S-REG-23 validation result is invalid.", { result });
  }

  console.log(JSON.stringify({
    ok: true,
    guard: GUARD,
    token: TOKEN,
    slice_id: "S-REG-23",
    decision_id: decision.decision_id,
    decision_type: result.decision_type,
    activation_decision: result.activation_decision,
    activation_authorised: false,
    activation_ready: false,
    active_registry_activation: false,
    runtime_status: S_REG_23_RUNTIME_STATUS,
    hold_reason_codes: result.hold_reason_codes,
    required_before_activation_count: result.required_before_activation.length,
    candidate_chain_reviewed: result.candidate_chain_reviewed,
    changed_files: changedFiles
  }, null, 2));
}

try {
  main();
} catch (error) {
  fail("S-REG-23 guard crashed.", {
    error: error?.message ?? String(error),
    code: error?.code,
    reason: error?.reason,
    details: error?.details
  });
}
