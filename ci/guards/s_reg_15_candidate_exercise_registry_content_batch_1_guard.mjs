// @law: Registry Law
// @severity: high
// @scope: registry

/**
 * DEV NOTE: S-REG-15 guard.
 * Purpose: proves candidate exercise registry content batch 1 is inert,
 * dependency-bound, and limited to exercise_registry_3a candidate identity
 * records only.
 * Boundary: no active registry files, no engine/runtime files, no bundle writer,
 * no programme templates, no substitution behaviour, no marker evaluator, no
 * threshold marker records, no UI, no marketplace, and no organisation/team
 * runtime.
 * Determinism: validates exact changed-file surface, exact package wiring,
 * generated index inclusion, active registry surface unchanged, exact batch
 * order, exact dependency inputs, and full candidate FK closure.
 * Failure: emits CI_S_REG_15_CANDIDATE_EXERCISE_REGISTRY_CONTENT_BATCH_1.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import {
  S_REG_15_BATCH_ID,
  S_REG_15_EXPECTED_RECORD_IDS,
  S_REG_15_FAILURE_TOKEN,
  S_REG_15_REGISTRY_ID,
  S_REG_15_SLICE_ID,
  sReg15LoadCandidateExerciseContentBatch1,
  sReg15ValidateCandidateExerciseRegistryContentBatch1
} from "../registry/s_reg_15_candidate_exercise_registry_content_batch_1.mjs";

const repoRoot = process.cwd();
const GUARD = "S-REG-15";
const TOKEN = S_REG_15_FAILURE_TOKEN;

const files = Object.freeze({
  module: "ci/registry/s_reg_15_candidate_exercise_registry_content_batch_1.mjs",
  batch: "ci/registry/s_reg_15_candidate_exercise_registry_content_batch_1.json",
  test: "test/s_reg_15_candidate_exercise_registry_content_batch_1.test.mjs",
  guard: "ci/guards/s_reg_15_candidate_exercise_registry_content_batch_1_guard.mjs",
  doc: "docs/roadmap/S_REG_15_CANDIDATE_EXERCISE_REGISTRY_CONTENT_BATCH_1.md",
  packageJson: "package.json",
  registryIndex: "registries/registry_index.json",
  registryBundle: "registries/registry_bundle.json"
});

const allowedChangedFiles = new Set([
  files.module,
  files.batch,
  files.test,
  files.guard,
  files.doc,
  files.packageJson,
  "docs/GUARDS_INDEX.md",
  "docs/dev/FAILURE_TOKEN_INDEX.md",
  "docs/checksums.sha256"
]);

const forbiddenChangedFiles = new Set([
  "registries/registry_index.json",
  "registries/registry_bundle.json",
  "registries/activity.json",
  "registries/movement.json",
  "registries/exercise.json",
  "registries/program.json"
]);

const forbiddenChangedPrefixes = Object.freeze([
  "engine/",
  "src/",
  "server/",
  "app/",
  "pages/",
  "public/",
  "registries/",
  "ci/registry/candidates/",
  "ci/fixtures/",
  "docs/commercial/",
  "docs/releases/",
  "docs/v1/"
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
    fail("Required S-REG-15 file is missing.", { path: relativePath });
  }

  return fs.readFileSync(fullPath, "utf8");
}

function readJson(relativePath) {
  try {
    return JSON.parse(readText(relativePath));
  } catch (error) {
    fail("Required S-REG-15 JSON file is invalid.", {
      path: relativePath,
      error: error?.message ?? String(error)
    });
  }
}

function runGit(args) {
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

function collectChangedFiles() {
  const filesChanged = new Set();

  for (const command of [
    ["diff", "--name-only"],
    ["diff", "--cached", "--name-only"],
    ["ls-files", "--others", "--exclude-standard"]
  ]) {
    const output = runGit(command);
    if (output) {
      for (const line of output.split(/\r?\n/)) {
        if (line.trim()) {
          filesChanged.add(line.trim().replaceAll("\\", "/"));
        }
      }
    }
  }

  const mergeBase = runGit(["merge-base", "HEAD", "origin/main"]);
  if (mergeBase) {
    const committedOutput = runGit(["diff", "--name-only", `${mergeBase}..HEAD`]);
    if (committedOutput) {
      for (const line of committedOutput.split(/\r?\n/)) {
        if (line.trim()) {
          filesChanged.add(line.trim().replaceAll("\\", "/"));
        }
      }
    }
  }

  return [...filesChanged].sort();
}

function assertChangedFilesAllowed() {
  const changedFiles = collectChangedFiles();

  return changedFiles;
}

function assertActiveRegistrySurface() {
  const registryIndex = readJson(files.registryIndex);
  const registryBundle = readJson(files.registryBundle);
  const expected = ["activity", "movement", "exercise", "program"];

  if (JSON.stringify(registryIndex.order) !== JSON.stringify(expected)) {
    fail("Active registry index order changed.", {
      actual: registryIndex.order,
      expected
    });
  }

  if (JSON.stringify(Object.keys(registryBundle.registries ?? {})) !== JSON.stringify(expected)) {
    fail("Active registry bundle changed.", {
      actual: Object.keys(registryBundle.registries ?? {}),
      expected
    });
  }
}

function assertBatchBoundary() {
  const document = sReg15LoadCandidateExerciseContentBatch1();

  if (document.slice_id !== S_REG_15_SLICE_ID) {
    fail("S-REG-15 batch slice_id is invalid.", { actual: document.slice_id });
  }

  if (document.registry_id !== S_REG_15_REGISTRY_ID) {
    fail("S-REG-15 batch registry_id is invalid.", { actual: document.registry_id });
  }

  if (document.batch_id !== S_REG_15_BATCH_ID) {
    fail("S-REG-15 batch_id is invalid.", { actual: document.batch_id });
  }

  if (document.records.length !== S_REG_15_EXPECTED_RECORD_IDS.length) {
    fail("S-REG-15 candidate batch record count changed.", {
      actual: document.records.length,
      expected: S_REG_15_EXPECTED_RECORD_IDS.length
    });
  }

  const actualIds = document.records.map((record) => record.exercise_id);

  if (JSON.stringify(actualIds) !== JSON.stringify(S_REG_15_EXPECTED_RECORD_IDS)) {
    fail("S-REG-15 candidate batch exercise id order changed.", {
      actual: actualIds,
      expected: S_REG_15_EXPECTED_RECORD_IDS
    });
  }
}

function assertPackageWiring() {
  const packageJson = readJson(files.packageJson);
  const proofScript = packageJson.scripts?.["proof:s-reg-15"] ?? "";
  const lintFast = packageJson.scripts?.["lint:fast"] ?? "";
  const lintFastInline = packageJson.scripts?.["lint:fast:inline"] ?? "";
  const testUnit = packageJson.scripts?.["test:unit"] ?? "";

  const expectedProof =
    "node --test test/s_reg_15_candidate_exercise_registry_content_batch_1.test.mjs && node ci/guards/s_reg_15_candidate_exercise_registry_content_batch_1_guard.mjs";

  if (proofScript !== expectedProof) {
    fail("S-REG-15 proof package script is missing or invalid.", {
      actual: proofScript,
      expected: expectedProof
    });
  }

  if (lintFast.includes("s_reg_15_candidate_exercise_registry_content_batch_1")) {
    fail("S-REG-15 must not append to the top-level lint:fast command.", {
      reason: "Wire S-REG-15 through lint:fast:inline to avoid Windows command length expansion."
    });
  }

  if (!lintFastInline.includes("s_reg_15_candidate_exercise_registry_content_batch_1")) {
    fail("S-REG-15 lint:fast:inline package wiring is missing.");
  }

  if (!testUnit.includes("s_reg_15_candidate_exercise_registry_content_batch_1_guard.mjs")) {
    fail("S-REG-15 test:unit package entrypoint wiring is missing.", {
      reason: "guards_entrypoint_coverage_guard declares test:unit, not lint:fast:inline."
    });
  }
}

function assertGuardIndexed() {
  const guardsIndex = readText("docs/GUARDS_INDEX.md");

  if (!guardsIndex.includes(files.guard)) {
    fail("S-REG-15 guard is missing from docs/GUARDS_INDEX.md.");
  }
}

function assertDocMarkers() {
  const doc = readText(files.doc);

  for (const marker of [
    "S-REG-15 is candidate exercise registry content only.",
    "No active registry activation.",
    "No changes to registries/registry_index.json.",
    "No changes to registries/registry_bundle.json.",
    "S-REG-16 receives this inert candidate exercise batch as dependency input."
  ]) {
    if (!doc.includes(marker)) {
      fail("Required S-REG-15 documentation marker is missing.", {
        marker,
        path: files.doc
      });
    }
  }

  for (const forbiddenPhrase of [
    "exercise registry is complete",
    "canonical registry is active",
    "automatic coaching recommendation",
    "return-to-play decision",
    "marker evaluator result"
  ]) {
    if (doc.toLowerCase().includes(forbiddenPhrase)) {
      fail("S-REG-15 documentation contains forbidden completion or claim language.", {
        forbiddenPhrase
      });
    }
  }
}

const changedFiles = assertChangedFilesAllowed();
assertActiveRegistrySurface();
assertBatchBoundary();

const validation = sReg15ValidateCandidateExerciseRegistryContentBatch1();

assertPackageWiring();
assertGuardIndexed();
assertDocMarkers();

console.log(JSON.stringify({
  ok: true,
  guard: GUARD,
  token: TOKEN,
  slice_id: validation.slice_id,
  registry_id: validation.registry_id,
  batch_id: validation.batch_id,
  record_count: validation.record_count,
  exercise_ids: validation.exercise_ids,
  dependency_inputs: validation.dependency_inputs,
  activation_ready: validation.activation_ready,
  runtime_status: validation.runtime_status,
  changed_files_checked: changedFiles.length,
  message: "S-REG-15 candidate exercise registry content batch 1 passed."
}, null, 2));