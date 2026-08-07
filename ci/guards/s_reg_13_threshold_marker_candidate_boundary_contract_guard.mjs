// @law: Registry Law
// @severity: high
// @scope: registry

/**
 * DEV NOTE: S-REG-13 guard.
 * Purpose: proves the threshold_marker_registry candidate boundary contract is
 * inert, contract-only, and outside active registry law.
 * Boundary: permits only S-REG-13 contract, proof, documentation, package
 * wiring, and generated indexes/checksums. It must not permit seed records,
 * active registry files, registry law, bundle writer runtime behaviour, engine
 * runtime, marker evaluator, real comparisons, programme templates,
 * substitution, marketplace, coach-to-coach sharing, organisation, unit,
 * federation, team, tactical runtime, coach dashboard interpretation, or athlete
 * UI interpretation.
 * Determinism: validates fixed allowed fields, fixed factual status vocabulary,
 * active compact registry state, package entrypoints, guard index, and git state.
 * Failure: emits CI_S_REG_13_THRESHOLD_MARKER_CANDIDATE_BOUNDARY_CONTRACT.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import {
  S_REG_13_ALLOWED_FIELDS,
  S_REG_13_ALLOWED_MARKER_STATUS_VALUES,
  S_REG_13_ALLOWED_THRESHOLD_OPERATORS,
  S_REG_13_ALLOWED_THRESHOLD_SOURCE_VALUES,
  S_REG_13_CANDIDATE_STATUS,
  S_REG_13_CONTRACT_STATUS,
  S_REG_13_FAILURE_TOKEN,
  S_REG_13_FORBIDDEN_FIELDS,
  S_REG_13_REGISTRY_ID,
  S_REG_13_RUNTIME_STATUS,
  sReg13BuildValidFutureThresholdMarkerCandidateRecord,
  sReg13ValidateFutureThresholdMarkerCandidateRecord,
  sReg13ValidateThresholdMarkerCandidateBoundaryContract
} from "../registry/s_reg_13_threshold_marker_candidate_boundary_contract.mjs";

const repoRoot = process.cwd();
const GUARD = "S-REG-13";
const TOKEN = S_REG_13_FAILURE_TOKEN;

const compactOrder = Object.freeze([
  "activity",
  "movement",
  "exercise",
  "program"
]);

const files = Object.freeze({
  module: "ci/registry/s_reg_13_threshold_marker_candidate_boundary_contract.mjs",
  manifest: "ci/registry/s_reg_13_threshold_marker_candidate_boundary_contract_manifest.json",
  test: "test/s_reg_13_threshold_marker_candidate_boundary_contract.test.mjs",
  guard: "ci/guards/s_reg_13_threshold_marker_candidate_boundary_contract_guard.mjs",
  doc: "docs/roadmap/S_REG_13_THRESHOLD_MARKER_CANDIDATE_BOUNDARY_CONTRACT.md",
  packageJson: "package.json",
  registryIndex: "registries/registry_index.json",
  registryBundle: "registries/registry_bundle.json"
});

const allowedChangedFiles = new Set([
  files.module,
  files.manifest,
  files.test,
  files.guard,
  files.doc,
  files.packageJson,
  "ci/guards/_entrypoints.json",
  "docs/GUARDS_INDEX.md",
  "docs/dev/FAILURE_TOKEN_INDEX.md",
  "docs/checksums.sha256"
]);

const forbiddenChangedFiles = new Set([
  "ci/registry/candidates/threshold_marker_registry/threshold_marker_registry.candidate.registry.json",
  "registries/threshold_marker_registry",
  "registries/threshold_marker_registry.json",
  "registries/registry_index.json",
  "registries/registry_bundle.json"
]);

const forbiddenChangedPrefixes = Object.freeze([
  "engine/",
  "src/",
  "server/",
  "app/",
  "pages/",
  "public/",
  "registries/"
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
  return path.join(repoRoot, relativePath);
}

function readText(relativePath) {
  const fullPath = repoPath(relativePath);

  if (!fs.existsSync(fullPath)) {
    fail("Required S-REG-13 file is missing.", { path: relativePath });
  }

  return fs.readFileSync(fullPath, "utf8");
}

function readJson(relativePath) {
  try {
    return JSON.parse(readText(relativePath));
  } catch (error) {
    fail("Required S-REG-13 JSON file is invalid.", {
      path: relativePath,
      error: error?.message ?? String(error)
    });
  }
}

function assertDeepEqual(actual, expected, message, details = {}) {
  const actualText = JSON.stringify(actual);
  const expectedText = JSON.stringify(expected);

  if (actualText !== expectedText) {
    fail(message, {
      ...details,
      actual,
      expected
    });
  }
}

function assertIncludes(text, marker, context) {
  if (!text.includes(marker)) {
    fail("Required S-REG-13 marker is missing.", {
      context,
      marker
    });
  }
}

function gitOutput(args) {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
  } catch {
    return "";
  }
}

function parsePorcelainPath(line) {
  if (!line) {
    return "";
  }

  let relPath = "";

  if (line.length >= 3 && line[2] === " ") {
    relPath = line.slice(3);
  } else if (line.length >= 2) {
    relPath = line.slice(2).trimStart();
  } else {
    relPath = line.trim();
  }

  if (relPath.includes(" -> ")) {
    relPath = relPath.split(" -> ").pop().trim();
  }

  return relPath.replace(/^"|"$/gu, "").replace(/\\/gu, "/");
}

function currentChangedFiles() {
  const changed = new Set();

  const porcelain = gitOutput(["status", "--porcelain=v1", "-uall"]);
  for (const line of porcelain.split(/\r?\n/u).filter(Boolean)) {
    const relPath = parsePorcelainPath(line);
    if (relPath) {
      changed.add(relPath);
    }
  }

  const base = gitOutput(["merge-base", "HEAD", "origin/main"]);
  if (base) {
    const committed = gitOutput(["diff", "--name-only", `${base}..HEAD`]);
    for (const relPath of committed.split(/\r?\n/u).filter(Boolean)) {
      changed.add(relPath.replace(/\\/gu, "/"));
    }
  }

  return [...changed].sort();
}

function currentBranchName() {
  return process.env.GITHUB_HEAD_REF || gitOutput(["rev-parse", "--abbrev-ref", "HEAD"]);
}

function assertChangedFilesAllowed() {
  const branchName = currentBranchName();

  if (!branchName.includes("s-reg-13-threshold-marker-candidate-boundary-contract")) {
    return;
  }

  const changed = currentChangedFiles();
  const disallowed = changed.filter((relativePath) => !allowedChangedFiles.has(relativePath));

  if (disallowed.length > 0) {
    fail("S-REG-13 touched files outside the threshold marker candidate boundary contract.", {
      changed_files: changed,
      disallowed_files: disallowed,
      allowed_files: [...allowedChangedFiles].sort()
    });
  }

  for (const relativePath of changed) {
    if (forbiddenChangedFiles.has(relativePath)) {
      fail("S-REG-13 touched a forbidden active or candidate seed surface.", { path: relativePath });
    }

    for (const prefix of forbiddenChangedPrefixes) {
      if (relativePath.startsWith(prefix)) {
        fail("S-REG-13 touched a forbidden active or runtime surface.", {
          path: relativePath,
          forbidden_prefix: prefix
        });
      }
    }
  }
}

function assertActiveRegistryStillCompact() {
  const registryIndex = readJson(files.registryIndex);
  const registryBundle = readJson(files.registryBundle);

  assertDeepEqual(
    registryIndex.order.slice(0, compactOrder.length),
    compactOrder,
    "S-REG-13 requires the active registry_index order to remain compact."
  );

  assertDeepEqual(
    Object.keys(registryBundle.registries).slice(0, compactOrder.length),
    compactOrder,
    "S-REG-13 requires the active registry_bundle keys to remain compact."
  );

  for (const relativePath of [
    "registries/threshold_marker_registry",
    "registries/threshold_marker_registry.json",
    "ci/registry/candidates/threshold_marker_registry/threshold_marker_registry.candidate.registry.json"
  ]) {
    if (fs.existsSync(repoPath(relativePath))) {
      fail("S-REG-13 must not create threshold marker active registry or seed content.", {
        path: relativePath
      });
    }
  }
}

function assertContractManifest() {
  const manifest = readJson(files.manifest);

  assertDeepEqual(manifest.allowed_fields, S_REG_13_ALLOWED_FIELDS, "Allowed threshold marker fields drifted.");
  assertDeepEqual(
    manifest.allowed_marker_status_values,
    S_REG_13_ALLOWED_MARKER_STATUS_VALUES,
    "Allowed threshold marker factual status values drifted."
  );
  assertDeepEqual(
    manifest.allowed_threshold_operators,
    S_REG_13_ALLOWED_THRESHOLD_OPERATORS,
    "Allowed threshold marker operators drifted."
  );
  assertDeepEqual(
    manifest.allowed_threshold_source_values,
    S_REG_13_ALLOWED_THRESHOLD_SOURCE_VALUES,
    "Allowed threshold marker source values drifted."
  );
  assertDeepEqual(manifest.forbidden_fields, S_REG_13_FORBIDDEN_FIELDS, "Forbidden threshold marker fields drifted.");

  if (manifest.registry_id !== S_REG_13_REGISTRY_ID) {
    fail("S-REG-13 manifest registry_id drifted.", { actual: manifest.registry_id });
  }

  if (manifest.contract_status !== S_REG_13_CONTRACT_STATUS) {
    fail("S-REG-13 manifest contract_status drifted.", { actual: manifest.contract_status });
  }

  if (manifest.candidate_status !== S_REG_13_CANDIDATE_STATUS) {
    fail("S-REG-13 manifest candidate_status drifted.", { actual: manifest.candidate_status });
  }

  if (manifest.runtime_status !== S_REG_13_RUNTIME_STATUS) {
    fail("S-REG-13 manifest runtime_status drifted.", { actual: manifest.runtime_status });
  }

  if (manifest.activation_ready !== false) {
    fail("S-REG-13 manifest activation_ready must remain false.");
  }

  if (Object.hasOwn(manifest, "records")) {
    fail("S-REG-13 manifest must not contain seed records.");
  }
}

function assertPackageScriptWired() {
  const packageJson = readJson(files.packageJson);
  const expected = "node --test test/s_reg_13_threshold_marker_candidate_boundary_contract.test.mjs && node ci/guards/s_reg_13_threshold_marker_candidate_boundary_contract_guard.mjs";

  if (packageJson.scripts?.["proof:s-reg-13"] !== expected) {
    fail("S-REG-13 package proof script is missing or incorrect.", {
      actual: packageJson.scripts?.["proof:s-reg-13"],
      expected
    });
  }

  if (packageJson.scripts?.["lint:fast"]?.includes("s_reg_13_threshold_marker_candidate_boundary_contract")) {
    fail("S-REG-13 must not append to the top-level lint:fast command.", {
      reason: "Windows command length is already near the limit. Wire S-REG-13 through lint:fast:inline instead."
    });
  }

  if (!packageJson.scripts?.["lint:fast:inline"]?.includes("s_reg_13_threshold_marker_candidate_boundary_contract")) {
    fail("S-REG-13 lint:fast:inline package wiring is missing.");
  }

  if (!packageJson.scripts?.["test:unit"]?.includes("s_reg_13_threshold_marker_candidate_boundary_contract_guard.mjs")) {
    fail("S-REG-13 test:unit guard wiring is missing.");
  }
}

function assertGeneratedIndexes() {
  const guardsIndex = readText("docs/GUARDS_INDEX.md");
  const failureTokenIndex = readText("docs/dev/FAILURE_TOKEN_INDEX.md");

  assertIncludes(
    guardsIndex,
    "ci/guards/s_reg_13_threshold_marker_candidate_boundary_contract_guard.mjs",
    "docs/GUARDS_INDEX.md"
  );

  assertIncludes(
    failureTokenIndex,
    "CI_S_REG_13_THRESHOLD_MARKER_CANDIDATE_BOUNDARY_CONTRACT",
    "docs/dev/FAILURE_TOKEN_INDEX.md"
  );
}

function assertValidationHelpers() {
  const result = sReg13ValidateThresholdMarkerCandidateBoundaryContract();

  if (
    result.ok !== true ||
    result.registry_id !== S_REG_13_REGISTRY_ID ||
    result.runtime_status !== S_REG_13_RUNTIME_STATUS ||
    result.activation_ready !== false ||
    result.seed_content_status !== "not_created"
  ) {
    fail("S-REG-13 contract validation result is invalid.", { result });
  }

  const record = sReg13BuildValidFutureThresholdMarkerCandidateRecord();
  const recordResult = sReg13ValidateFutureThresholdMarkerCandidateRecord(record);

  if (recordResult.ok !== true || recordResult.activation_ready !== false) {
    fail("S-REG-13 future record shape validation result is invalid.", { recordResult });
  }
}

function assertDocumentation() {
  const doc = readText(files.doc);

  for (const marker of [
    "S-REG-13",
    "threshold_marker_registry",
    "candidate boundary contract",
    "recorded_met",
    "recorded_not_met",
    "not_recorded",
    "invalid_source",
    "insufficient_recorded_data",
    "No marker evaluator behaviour",
    "No active registry activation",
    "Future dependency"
  ]) {
    assertIncludes(doc, marker, files.doc);
  }
}

async function main() {
  assertChangedFilesAllowed();
  assertActiveRegistryStillCompact();
  assertContractManifest();
  assertValidationHelpers();
  assertPackageScriptWired();
  assertGeneratedIndexes();
  assertDocumentation();

  console.log(JSON.stringify({
    ok: true,
    guard: GUARD,
    token: TOKEN,
    registry_id: S_REG_13_REGISTRY_ID,
    contract_status: S_REG_13_CONTRACT_STATUS,
    runtime_status: S_REG_13_RUNTIME_STATUS,
    activation_ready: false,
    allowed_field_count: S_REG_13_ALLOWED_FIELDS.length,
    allowed_marker_status_values: S_REG_13_ALLOWED_MARKER_STATUS_VALUES,
    message: "S-REG-13 threshold marker candidate boundary contract passed."
  }, null, 2));
}

main().catch((error) => {
  fail("S-REG-13 guard crashed.", {
    error: error?.message ?? String(error),
    code: error?.code,
    reason: error?.reason,
    details: error?.details
  });
});