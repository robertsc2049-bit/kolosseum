// @law: Registry Law
// @severity: high
// @scope: registry

/**
 * DEV NOTE: S-REG-18 guard.
 * Purpose: proves candidate exercise activity applicability expansion is inert,
 * dependency-bound, and limited to S-REG-15 exercises, locked activity IDs, and
 * S-REG-17 FK closure evidence.
 * Boundary: no active registry files, no engine/runtime files, no bundle writer,
 * no programme assignment, no substitution behaviour, no marker evaluator, no
 * threshold marker records, no new exercise content, no new equipment content,
 * no new FK closure content, no UI, no marketplace, no facility, and no
 * organisation or team runtime.
 * Determinism: validates package wiring, generated index inclusion, active
 * registry surface unchanged, exact applicability order, exact dependency
 * inputs from S-REG-14, and applicability FK closure against S-REG-06,
 * S-REG-09, S-REG-15, and S-REG-17.
 * Failure: emits CI_S_REG_18_EXERCISE_ACTIVITY_APPLICABILITY_CANDIDATE_EXPANSION.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import {
  S_REG_18_BATCH_ID,
  S_REG_18_EXPECTED_APPLICABILITY_IDS,
  S_REG_18_FAILURE_TOKEN,
  S_REG_18_REGISTRY_ID,
  S_REG_18_SLICE_ID,
  sReg18LoadExerciseActivityApplicabilityCandidateExpansion,
  sReg18ValidateExerciseActivityApplicabilityCandidateExpansion
} from "../registry/s_reg_18_exercise_activity_applicability_candidate_expansion.mjs";

const repoRoot = process.cwd();
const GUARD = "S-REG-18";
const TOKEN = S_REG_18_FAILURE_TOKEN;

const files = Object.freeze({
  module: "ci/registry/s_reg_18_exercise_activity_applicability_candidate_expansion.mjs",
  batch: "ci/registry/s_reg_18_exercise_activity_applicability_candidate_expansion.json",
  test: "test/s_reg_18_exercise_activity_applicability_candidate_expansion.test.mjs",
  guard: "ci/guards/s_reg_18_exercise_activity_applicability_candidate_expansion_guard.mjs",
  doc: "docs/roadmap/S_REG_18_EXERCISE_ACTIVITY_APPLICABILITY_CANDIDATE_EXPANSION.md",
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

const forbiddenChangedPrefixes = Object.freeze([
  "engine/",
  "src/",
  "server/",
  "app/",
  "pages/",
  "public/",
  "registries/",
  "ci/registry/candidates/"
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
    fail("Required S-REG-18 file is missing.", { path: relativePath });
  }

  return fs.readFileSync(fullPath, "utf8");
}

function readJson(relativePath) {
  try {
    return JSON.parse(readText(relativePath));
  } catch (error) {
    fail("Required S-REG-18 JSON file is invalid.", {
      path: relativePath,
      error: error?.message ?? String(error)
    });
  }
}

function sha256(relativePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(repoPath(relativePath))).digest("hex");
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

function currentBranchName() {
  return process.env.GITHUB_HEAD_REF || runGit(["rev-parse", "--abbrev-ref", "HEAD"]);
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
  const branchName = currentBranchName();

  if (!branchName.includes("s-reg-18-exercise-activity-applicability-expansion")) {
    return collectChangedFiles();
  }

  const changedFiles = collectChangedFiles();
  const disallowed = changedFiles.filter((relativePath) => !allowedChangedFiles.has(relativePath));

  if (disallowed.length > 0) {
    fail("S-REG-18 touched files outside the exercise activity applicability candidate expansion boundary.", {
      changed_files: changedFiles,
      disallowed_files: disallowed,
      allowed_files: [...allowedChangedFiles].sort()
    });
  }

  for (const relativePath of changedFiles) {
    for (const prefix of forbiddenChangedPrefixes) {
      if (relativePath.startsWith(prefix)) {
        fail("S-REG-18 touched a forbidden active, runtime, source-candidate, or product surface.", {
          path: relativePath,
          forbidden_prefix: prefix
        });
      }
    }
  }

  return changedFiles;
}

function assertActiveRegistrySurface() {
  const registryIndex = readJson(files.registryIndex);
  const registryBundle = readJson(files.registryBundle);
  const expected = ["activity", "movement", "exercise", "program"];

  if (JSON.stringify(registryIndex.order.slice(0, expected.length)) !== JSON.stringify(expected)) {
    fail("Active registry index order changed.", {
      actual: registryIndex.order,
      expected
    });
  }

  if (JSON.stringify(Object.keys(registryBundle.registries ?? {}).slice(0, expected.length)) !== JSON.stringify(expected)) {
    fail("Active registry bundle changed.", {
      actual: Object.keys(registryBundle.registries ?? {}),
      expected
    });
  }
}

function assertBatchBoundary() {
  const document = sReg18LoadExerciseActivityApplicabilityCandidateExpansion();

  if (document.slice_id !== S_REG_18_SLICE_ID) {
    fail("S-REG-18 batch slice_id is invalid.", { actual: document.slice_id });
  }

  if (document.registry_id !== S_REG_18_REGISTRY_ID) {
    fail("S-REG-18 batch registry_id is invalid.", { actual: document.registry_id });
  }

  if (document.batch_id !== S_REG_18_BATCH_ID) {
    fail("S-REG-18 batch_id is invalid.", { actual: document.batch_id });
  }

  if (document.records.length !== S_REG_18_EXPECTED_APPLICABILITY_IDS.length) {
    fail("S-REG-18 candidate applicability record count changed.", {
      actual: document.records.length,
      expected: S_REG_18_EXPECTED_APPLICABILITY_IDS.length
    });
  }

  const actualIds = document.records.map((record) => record.applicability_id);

  if (JSON.stringify(actualIds) !== JSON.stringify(S_REG_18_EXPECTED_APPLICABILITY_IDS)) {
    fail("S-REG-18 candidate applicability id order changed.", {
      actual: actualIds,
      expected: S_REG_18_EXPECTED_APPLICABILITY_IDS
    });
  }
}

function assertPackageWiring() {
  const packageJson = readJson(files.packageJson);
  const proofScript = packageJson.scripts?.["proof:s-reg-18"] ?? "";
  const lintFast = packageJson.scripts?.["lint:fast"] ?? "";
  const lintFastInline = packageJson.scripts?.["lint:fast:inline"] ?? "";
  const testUnit = packageJson.scripts?.["test:unit"] ?? "";

  const expectedProof =
    "node --test test/s_reg_18_exercise_activity_applicability_candidate_expansion.test.mjs && node ci/guards/s_reg_18_exercise_activity_applicability_candidate_expansion_guard.mjs";

  if (proofScript !== expectedProof) {
    fail("S-REG-18 proof package script is missing or invalid.", {
      actual: proofScript,
      expected: expectedProof
    });
  }

  if (lintFast.includes("s_reg_18_exercise_activity_applicability_candidate_expansion")) {
    fail("S-REG-18 must not append to the top-level lint:fast command.", {
      reason: "Wire S-REG-18 through lint:fast:inline to avoid Windows command length expansion."
    });
  }

  if (!lintFastInline.includes("s_reg_18_exercise_activity_applicability_candidate_expansion")) {
    fail("S-REG-18 lint:fast:inline package wiring is missing.");
  }

  if (!testUnit.includes("s_reg_18_exercise_activity_applicability_candidate_expansion_guard.mjs")) {
    fail("S-REG-18 test:unit package entrypoint wiring is missing.", {
      reason: "guards_entrypoint_coverage_guard declares test:unit."
    });
  }
}

function assertGuardIndexed() {
  const guardsIndex = readText("docs/GUARDS_INDEX.md");

  if (!guardsIndex.includes(files.guard)) {
    fail("S-REG-18 guard is missing from docs/GUARDS_INDEX.md.");
  }
}

function assertDocMarkers() {
  const doc = readText(files.doc);

  for (const marker of [
    "S-REG-18 is candidate exercise activity applicability expansion only.",
    "No active registry activation.",
    "No changes to registries/registry_index.json.",
    "No changes to registries/registry_bundle.json.",
    "No new exercise content.",
    "No new equipment content.",
    "No new exercise-equipment FK closure content.",
    "S-REG-19 receives this inert applicability expansion as dependency input."
  ]) {
    if (!doc.includes(marker)) {
      fail("Required S-REG-18 documentation marker is missing.", {
        marker,
        path: files.doc
      });
    }
  }

  for (const forbiddenPhrase of [
    "exercise activity applicability coverage is complete",
    "canonical applicability is active",
    "recommended exercise",
    "recommended activity",
    "substitution behaviour active",
    "programme assignment active",
    "marker evaluator active",
    "tactical interpretation active"
  ]) {
    if (doc.toLowerCase().includes(forbiddenPhrase)) {
      fail("S-REG-18 documentation contains forbidden completion, recommendation, runtime, or activation language.", {
        forbiddenPhrase
      });
    }
  }
}

const changedFiles = assertChangedFilesAllowed();
assertActiveRegistrySurface();
assertBatchBoundary();

const validation = sReg18ValidateExerciseActivityApplicabilityCandidateExpansion();

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
  applicability_ids: validation.applicability_ids,
  dependency_inputs: validation.dependency_inputs,
  foundation_inputs: validation.foundation_inputs,
  activity_context: validation.activity_context,
  activation_ready: validation.activation_ready,
  runtime_status: validation.runtime_status,
  changed_files_checked: changedFiles.length,
  message: "S-REG-18 exercise activity applicability candidate expansion passed."
}, null, 2));