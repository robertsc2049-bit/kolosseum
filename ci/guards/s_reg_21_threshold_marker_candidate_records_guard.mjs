// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-REG-21 guard.
 * Purpose: proves threshold marker candidate records are inert, queue-aligned,
 * dependency-bound, and limited to explicit declared threshold record shape.
 * Boundary: permits only S-REG-21 candidate record files, proof, documentation,
 * package wiring, and generated indexes/checksums. It must not permit active
 * registry mutation, marker evaluator behaviour, real comparison results,
 * recorded value inputs, advice, outcome inference, programme assignment,
 * substitution runtime, UI behaviour, or coach interpretation.
 * Determinism: validates fixed marker IDs, S-REG-13 field vocabulary, S-REG-19
 * metric FKs, S-REG-20 link foundation, S-REG-14 queue alignment, package
 * entrypoints, guard index, and changed-file boundaries.
 * Failure: emits CI_S_REG_21_THRESHOLD_MARKER_CANDIDATE_RECORDS.
 */

import fs from "node:fs";
import { execFileSync } from "node:child_process";

import {
  S_REG_21_BATCH_ID,
  S_REG_21_EXPECTED_THRESHOLD_MARKER_IDS,
  S_REG_21_FAILURE_TOKEN,
  S_REG_21_REGISTRY_ID,
  S_REG_21_RUNTIME_STATUS,
  sReg21LoadThresholdMarkerCandidateRecords,
  sReg21ValidateThresholdMarkerCandidateRecords
} from "../registry/s_reg_21_threshold_marker_candidate_records.mjs";

const repoRoot = process.cwd();
const GUARD = "S-REG-21";
const TOKEN = S_REG_21_FAILURE_TOKEN;

const compactOrder = Object.freeze([
  "activity",
  "movement",
  "exercise",
  "program"
]);

const files = Object.freeze({
  module: "ci/registry/s_reg_21_threshold_marker_candidate_records.mjs",
  json: "ci/registry/s_reg_21_threshold_marker_candidate_records.json",
  test: "test/s_reg_21_threshold_marker_candidate_records.test.mjs",
  guard: "ci/guards/s_reg_21_threshold_marker_candidate_records_guard.mjs",
  doc: "docs/roadmap/S_REG_21_THRESHOLD_MARKER_CANDIDATE_RECORDS.md",
  packageJson: "package.json",
  registryIndex: "registries/registry_index.json",
  registryBundle: "registries/registry_bundle.json"
});

const allowedChangedFiles = new Set([
  files.module,
  files.json,
  files.test,
  files.guard,
  files.doc,
  files.packageJson,
  "ci/guards/_entrypoints.json",
  "ci/guards/s_reg_20_metric_exercise_link_candidate_expansion_guard.mjs",
  "docs/GUARDS_INDEX.md",
  "docs/dev/FAILURE_TOKEN_INDEX.md",
  "docs/checksums.sha256"
]);

const forbiddenChangedFiles = new Set([
  "registries/threshold_marker_registry",
  "registries/threshold_marker_registry.json",
  "registries/registry_index.json",
  "registries/registry_bundle.json",
  "ci/registry/candidates/threshold_marker_registry/threshold_marker_registry.candidate.registry.json",
  "ci/registry/s_reg_13_threshold_marker_candidate_boundary_contract.mjs",
  "ci/registry/s_reg_13_threshold_marker_candidate_boundary_contract_manifest.json",
  "ci/registry/s_reg_19_sport_metric_candidate_expansion.mjs",
  "ci/registry/s_reg_19_sport_metric_candidate_expansion.json",
  "ci/registry/s_reg_20_metric_exercise_link_candidate_expansion.mjs",
  "ci/registry/s_reg_20_metric_exercise_link_candidate_expansion.json"
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

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(repoPath(relativePath), "utf8"));
}

function readText(relativePath) {
  return fs.readFileSync(repoPath(relativePath), "utf8");
}

function runGit(args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function assertDeepEqual(actual, expected, message, details = {}) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(message, {
      ...details,
      actual,
      expected
    });
  }
}

function assertIncludes(text, marker, context) {
  if (!text.includes(marker)) {
    fail("Required S-REG-21 marker is missing.", {
      context,
      marker
    });
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
  const changed = new Set();
  const branchName = runGit(["rev-parse", "--abbrev-ref", "HEAD"]);
  const porcelain = runGit(["status", "--porcelain=v1"]);

  for (const line of porcelain.split(/\r?\n/u).filter(Boolean)) {
    const relPath = parsePorcelainPath(line);
    if (relPath) {
      changed.add(relPath);
    }
  }

  if (branchName.includes("s-reg-21-threshold-marker-candidate-records")) {
    const mergeBase = runGit(["merge-base", "HEAD", "origin/main"]);
    const committed = runGit(["diff", "--name-only", `${mergeBase}..HEAD`]);
    for (const relPath of committed.split(/\r?\n/u).filter(Boolean)) {
      changed.add(relPath.replace(/\\/gu, "/"));
    }
  }

  return [...changed].sort();
}

function assertChangedFilesWithinBoundary() {
  const branchName = runGit(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (!branchName.includes("s-reg-21-threshold-marker-candidate-records")) {
    return [];
  }

  const changed = collectChangedFiles();
  const disallowed = changed.filter((relativePath) => !allowedChangedFiles.has(relativePath));

  if (disallowed.length > 0) {
    fail("S-REG-21 touched files outside the threshold marker candidate records boundary.", {
      changed_files: changed,
      disallowed_files: disallowed,
      allowed_files: [...allowedChangedFiles].sort()
    });
  }

  for (const relativePath of changed) {
    if (forbiddenChangedFiles.has(relativePath)) {
      fail("S-REG-21 touched a forbidden active or dependency surface.", { path: relativePath });
    }

    if (allowedChangedFiles.has(relativePath)) {
      continue;
    }

    for (const prefix of forbiddenChangedPrefixes) {
      if (relativePath.startsWith(prefix)) {
        fail("S-REG-21 touched a forbidden active or runtime surface.", {
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
    files.module,
    files.json,
    files.test,
    files.guard,
    files.doc,
    files.packageJson
  ]) {
    if (!fs.existsSync(repoPath(relativePath))) {
      fail("Required S-REG-21 file is missing.", { path: relativePath });
    }
  }
}

function assertActiveRegistryStillCompact() {
  const registryIndex = readJson(files.registryIndex);
  const registryBundle = readJson(files.registryBundle);

  assertDeepEqual(
    registryIndex.order,
    compactOrder,
    "S-REG-21 requires active registry_index order to remain compact."
  );

  assertDeepEqual(
    Object.keys(registryBundle.registries),
    compactOrder,
    "S-REG-21 requires active registry_bundle keys to remain compact."
  );

  for (const relativePath of [
    "registries/threshold_marker_registry",
    "registries/threshold_marker_registry.json",
    "ci/registry/candidates/threshold_marker_registry/threshold_marker_registry.candidate.registry.json"
  ]) {
    if (fs.existsSync(repoPath(relativePath))) {
      fail("S-REG-21 must not create threshold marker active registry or canonical candidate registry file.", {
        path: relativePath
      });
    }
  }
}

function assertPackageWiring() {
  const packageJson = readJson(files.packageJson);
  const expected = "node --test test/s_reg_21_threshold_marker_candidate_records.test.mjs && node ci/guards/s_reg_21_threshold_marker_candidate_records_guard.mjs";

  if (packageJson.scripts?.["proof:s-reg-21"] !== expected) {
    fail("S-REG-21 package proof script is missing or incorrect.", {
      actual: packageJson.scripts?.["proof:s-reg-21"],
      expected
    });
  }

  if (packageJson.scripts?.["lint:fast"]?.includes("s_reg_21_threshold_marker_candidate_records")) {
    fail("S-REG-21 must not append to the top-level lint:fast command.", {
      reason: "Windows command length is already near the limit. Wire S-REG-21 through lint:fast:inline instead."
    });
  }

  if (!packageJson.scripts?.["lint:fast:inline"]?.includes("s_reg_21_threshold_marker_candidate_records")) {
    fail("S-REG-21 lint:fast:inline package wiring is missing.");
  }

  if (!packageJson.scripts?.["test:unit"]?.includes("s_reg_21_threshold_marker_candidate_records_guard.mjs")) {
    fail("S-REG-21 test:unit guard wiring is missing.");
  }
}

function assertGeneratedIndexes() {
  const guardsIndex = readText("docs/GUARDS_INDEX.md");
  const failureTokenIndex = readText("docs/dev/FAILURE_TOKEN_INDEX.md");

  assertIncludes(
    guardsIndex,
    "ci/guards/s_reg_21_threshold_marker_candidate_records_guard.mjs",
    "docs/GUARDS_INDEX.md"
  );

  assertIncludes(
    failureTokenIndex,
    "CI_S_REG_21_THRESHOLD_MARKER_CANDIDATE_RECORDS",
    "docs/dev/FAILURE_TOKEN_INDEX.md"
  );
}

function assertDocMarkers() {
  const doc = readText(files.doc);

  for (const marker of [
    "S-REG-21",
    "threshold_marker_registry",
    "candidate_threshold_marker_records_batch_1",
    "No active registry activation",
    "No marker evaluator behaviour",
    "No real comparison",
    "No advice",
    "No outcome inference",
    "S-REG-22 receives this inert threshold marker candidate record batch as dependency input"
  ]) {
    assertIncludes(doc, marker, files.doc);
  }
}

function main() {
  assertRequiredFilesPresent();
  const changedFiles = assertChangedFilesWithinBoundary();
  assertActiveRegistryStillCompact();
  assertPackageWiring();
  assertGeneratedIndexes();
  assertDocMarkers();

  const document = sReg21LoadThresholdMarkerCandidateRecords();
  const result = sReg21ValidateThresholdMarkerCandidateRecords();

  if (
    result.ok !== true ||
    result.registry_id !== S_REG_21_REGISTRY_ID ||
    result.batch_id !== S_REG_21_BATCH_ID ||
    result.runtime_status !== S_REG_21_RUNTIME_STATUS ||
    result.activation_ready !== false
  ) {
    fail("S-REG-21 validation result is invalid.", { result });
  }

  assertDeepEqual(
    result.threshold_marker_ids,
    S_REG_21_EXPECTED_THRESHOLD_MARKER_IDS,
    "S-REG-21 threshold marker ID order drifted."
  );

  console.log(JSON.stringify({
    ok: true,
    guard: GUARD,
    token: TOKEN,
    slice_id: "S-REG-21",
    registry_id: S_REG_21_REGISTRY_ID,
    batch_id: S_REG_21_BATCH_ID,
    record_count: document.records.length,
    threshold_marker_ids: result.threshold_marker_ids,
    dependency_inputs: result.dependency_inputs,
    foundation_inputs: result.foundation_inputs,
    threshold_source_values: result.threshold_source_values,
    marker_status_allowed_values: result.marker_status_allowed_values,
    activation_ready: false,
    runtime_status: S_REG_21_RUNTIME_STATUS,
    changed_files: changedFiles
  }, null, 2));
}

try {
  main();
} catch (error) {
  fail("S-REG-21 guard crashed.", {
    error: error?.message ?? String(error),
    code: error?.code,
    reason: error?.reason,
    details: error?.details
  });
}
