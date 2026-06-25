// @law: Registry Law
// @severity: high
// @scope: registry
/**
 * DEV NOTE: S-REG-22 guard.
 * Purpose: proves the final candidate registry build review is an inert review
 * gate only after S-REG-15 through S-REG-21 candidate batches.
 * Boundary: permits only S-REG-22 review files, package wiring, generated
 * indexes/checksums, and docs. It must not permit active registry activation,
 * registry bundle mutation, registry law mutation, marker evaluator behaviour,
 * real comparison, advice, outcome inference, UI behaviour, programme
 * assignment, substitution runtime, or coach interpretation.
 * Failure: emits CI_S_REG_22_CANDIDATE_REGISTRY_BUILD_REVIEW.
 */

import fs from "node:fs";
import { execFileSync } from "node:child_process";

import {
  S_REG_22_BATCH_ID,
  S_REG_22_DEPENDENCY_INPUTS,
  S_REG_22_FAILURE_TOKEN,
  S_REG_22_REGISTRY_TARGET,
  S_REG_22_RUNTIME_STATUS,
  sReg22LoadCandidateRegistryBuildReview,
  sReg22ValidateCandidateRegistryBuildReview
} from "../registry/s_reg_22_candidate_registry_build_review.mjs";

const repoRoot = process.cwd();
const GUARD = "S-REG-22";
const TOKEN = S_REG_22_FAILURE_TOKEN;

const allowedChangedFiles = new Set([
  "ci/registry/s_reg_22_candidate_registry_build_review.mjs",
  "ci/registry/s_reg_22_candidate_registry_build_review.json",
  "test/s_reg_22_candidate_registry_build_review.test.mjs",
  "ci/guards/s_reg_22_candidate_registry_build_review_guard.mjs",
  "docs/roadmap/S_REG_22_CANDIDATE_REGISTRY_BUILD_REVIEW.md",
  "package.json",
  "ci/guards/_entrypoints.json",
  "docs/GUARDS_INDEX.md",
  "docs/dev/FAILURE_TOKEN_INDEX.md",
  "docs/checksums.sha256"
]);

const forbiddenChangedFiles = new Set([
  "registries/registry_index.json",
  "registries/registry_bundle.json",
  "ci/registry/s_reg_14_registry_build_readiness_start_gate.mjs",
  "ci/registry/s_reg_14_registry_build_readiness_start_gate_manifest.json",
  "ci/registry/s_reg_15_candidate_exercise_registry_content_batch_1.json",
  "ci/registry/s_reg_16_candidate_equipment_registry_content_batch_1.json",
  "ci/registry/s_reg_17_exercise_equipment_candidate_fk_closure_expansion.json",
  "ci/registry/s_reg_18_exercise_activity_applicability_candidate_expansion.json",
  "ci/registry/s_reg_19_sport_metric_candidate_expansion.json",
  "ci/registry/s_reg_20_metric_exercise_link_candidate_expansion.json",
  "ci/registry/s_reg_21_threshold_marker_candidate_records.json"
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
    fail("Required S-REG-22 marker is missing.", { marker, context });
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
  if (!branchName.includes("s-reg-22-candidate-registry-build-review")) {
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
    fail("S-REG-22 touched files outside the candidate registry build review boundary.", {
      changed_files: changed,
      disallowed_files: disallowed,
      allowed_files: [...allowedChangedFiles].sort()
    });
  }

  for (const relativePath of changed) {
    if (forbiddenChangedFiles.has(relativePath)) {
      fail("S-REG-22 touched a forbidden active or dependency surface.", { path: relativePath });
    }

    for (const prefix of forbiddenChangedPrefixes) {
      if (relativePath.startsWith(prefix) && !allowedChangedFiles.has(relativePath)) {
        fail("S-REG-22 touched a forbidden active or runtime surface.", {
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
    "ci/registry/s_reg_22_candidate_registry_build_review.mjs",
    "ci/registry/s_reg_22_candidate_registry_build_review.json",
    "test/s_reg_22_candidate_registry_build_review.test.mjs",
    "ci/guards/s_reg_22_candidate_registry_build_review_guard.mjs",
    "docs/roadmap/S_REG_22_CANDIDATE_REGISTRY_BUILD_REVIEW.md",
    "package.json"
  ]) {
    if (!fs.existsSync(repoPath(relativePath))) {
      fail("Required S-REG-22 file is missing.", { path: relativePath });
    }
  }
}

function assertPackageWiring() {
  const packageJson = readJson("package.json");
  const expected = "node --test test/s_reg_22_candidate_registry_build_review.test.mjs && node ci/guards/s_reg_22_candidate_registry_build_review_guard.mjs";

  if (packageJson.scripts?.["proof:s-reg-22"] !== expected) {
    fail("S-REG-22 package proof script is missing or incorrect.", {
      actual: packageJson.scripts?.["proof:s-reg-22"],
      expected
    });
  }

  if (packageJson.scripts?.["lint:fast"]?.includes("s_reg_22_candidate_registry_build_review")) {
    fail("S-REG-22 must not append to the top-level lint:fast command.");
  }

  if (!packageJson.scripts?.["lint:fast:inline"]?.includes("s_reg_22_candidate_registry_build_review")) {
    fail("S-REG-22 lint:fast:inline package wiring is missing.");
  }

  if (!packageJson.scripts?.["test:unit"]?.includes("s_reg_22_candidate_registry_build_review_guard.mjs")) {
    fail("S-REG-22 test:unit guard wiring is missing.");
  }
}

function assertGeneratedIndexes() {
  const guardsIndex = readText("docs/GUARDS_INDEX.md");
  const failureTokenIndex = readText("docs/dev/FAILURE_TOKEN_INDEX.md");

  assertIncludes(
    guardsIndex,
    "ci/guards/s_reg_22_candidate_registry_build_review_guard.mjs",
    "docs/GUARDS_INDEX.md"
  );

  assertIncludes(
    failureTokenIndex,
    "CI_S_REG_22_CANDIDATE_REGISTRY_BUILD_REVIEW",
    "docs/dev/FAILURE_TOKEN_INDEX.md"
  );
}

function assertDocMarkers() {
  const doc = readText("docs/roadmap/S_REG_22_CANDIDATE_REGISTRY_BUILD_REVIEW.md");

  for (const marker of [
    "S-REG-22",
    "candidate_registry_review_and_activation_gate",
    "candidate_registry_review_gate",
    "Review gate only",
    "No active registry activation",
    "No marker evaluator behaviour",
    "No real comparison",
    "No advice",
    "No outcome inference",
    "separate explicit activation slice"
  ]) {
    assertIncludes(doc, marker, "docs/roadmap/S_REG_22_CANDIDATE_REGISTRY_BUILD_REVIEW.md");
  }
}

function assertSReg14QueueStillEndsAtSReg22() {
  const manifest = readJson("ci/registry/s_reg_14_registry_build_readiness_start_gate_manifest.json");
  const finalEntry = manifest.candidate_build_queue.at(-1);

  if (finalEntry?.slice_id !== "S-REG-22") {
    fail("S-REG-14 candidate build queue no longer ends at S-REG-22.", { finalEntry });
  }

  if (finalEntry?.content_status_after_slice !== "candidate_reviewed_fk_closed_pending_activation_decision") {
    fail("S-REG-14 final review content status drifted.", { finalEntry });
  }

  if (JSON.stringify(finalEntry.dependency_inputs) !== JSON.stringify(S_REG_22_DEPENDENCY_INPUTS)) {
    fail("S-REG-14 final review dependency inputs drifted.", { finalEntry });
  }
}

function main() {
  assertRequiredFilesPresent();
  const changedFiles = assertChangedFilesWithinBoundary();
  assertPackageWiring();
  assertGeneratedIndexes();
  assertDocMarkers();
  assertSReg14QueueStillEndsAtSReg22();

  const review = sReg22LoadCandidateRegistryBuildReview();
  const result = sReg22ValidateCandidateRegistryBuildReview();

  if (
    result.ok !== true ||
    result.batch_id !== S_REG_22_BATCH_ID ||
    result.registry_target !== S_REG_22_REGISTRY_TARGET ||
    result.runtime_status !== S_REG_22_RUNTIME_STATUS ||
    result.activation_ready !== false ||
    result.active_registry_activation !== false
  ) {
    fail("S-REG-22 validation result is invalid.", { result });
  }

  console.log(JSON.stringify({
    ok: true,
    guard: GUARD,
    token: TOKEN,
    slice_id: "S-REG-22",
    review_id: review.review_id,
    batch_id: result.batch_id,
    registry_target: result.registry_target,
    dependency_inputs: result.dependency_inputs,
    reviewed_candidate_batch_count: result.reviewed_candidate_batch_count,
    reviewed_candidate_record_count: result.reviewed_candidate_record_count,
    candidate_review_status: result.candidate_review_status,
    activation_ready: false,
    active_registry_activation: false,
    runtime_status: S_REG_22_RUNTIME_STATUS,
    activation_decision: result.activation_decision,
    later_activation_requirement: result.later_activation_requirement,
    changed_files: changedFiles
  }, null, 2));
}

try {
  main();
} catch (error) {
  fail("S-REG-22 guard crashed.", {
    error: error?.message ?? String(error),
    code: error?.code,
    reason: error?.reason,
    details: error?.details
  });
}
