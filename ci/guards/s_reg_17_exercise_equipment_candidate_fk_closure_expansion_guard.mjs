// @law: Registry Law
// @severity: high
// @scope: registry

/**
 * DEV NOTE: S-REG-17 guard.
 * Purpose: proves candidate exercise-equipment FK closure expansion is inert,
 * dependency-bound, and limited to S-REG-15 to S-REG-16 FK relationship records.
 * Boundary: no active registry files, no engine/runtime files, no bundle writer,
 * no programme assignment, no substitution behaviour, no fallback logic, no
 * marker evaluator, no threshold marker records, no new exercise content, no
 * new equipment content, no UI, no marketplace, no facility, and no organisation
 * or team runtime.
 * Determinism: validates package wiring, generated index inclusion, active
 * registry surface unchanged, exact closure order, exact dependency inputs, and
 * FK closure against S-REG-15/S-REG-16 movement plus activity relationships.
 * Failure: emits CI_S_REG_17_EXERCISE_EQUIPMENT_CANDIDATE_FK_CLOSURE_EXPANSION.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import {
  S_REG_17_BATCH_ID,
  S_REG_17_EXPECTED_CLOSURE_IDS,
  S_REG_17_FAILURE_TOKEN,
  S_REG_17_REGISTRY_ID,
  S_REG_17_SLICE_ID,
  sReg17LoadExerciseEquipmentCandidateFkClosureExpansion,
  sReg17ValidateExerciseEquipmentCandidateFkClosureExpansion
} from "../registry/s_reg_17_exercise_equipment_candidate_fk_closure_expansion.mjs";

const repoRoot = process.cwd();
const GUARD = "S-REG-17";
const TOKEN = S_REG_17_FAILURE_TOKEN;

const files = Object.freeze({
  module: "ci/registry/s_reg_17_exercise_equipment_candidate_fk_closure_expansion.mjs",
  batch: "ci/registry/s_reg_17_exercise_equipment_candidate_fk_closure_expansion.json",
  test: "test/s_reg_17_exercise_equipment_candidate_fk_closure_expansion.test.mjs",
  guard: "ci/guards/s_reg_17_exercise_equipment_candidate_fk_closure_expansion_guard.mjs",
  doc: "docs/roadmap/S_REG_17_EXERCISE_EQUIPMENT_CANDIDATE_FK_CLOSURE_EXPANSION.md",
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
    fail("Required S-REG-17 file is missing.", { path: relativePath });
  }

  return fs.readFileSync(fullPath, "utf8");
}

function readJson(relativePath) {
  try {
    return JSON.parse(readText(relativePath));
  } catch (error) {
    fail("Required S-REG-17 JSON file is invalid.", {
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

  if (!branchName.includes("s-reg-17-exercise-equipment-fk-closure-expansion")) {
    return collectChangedFiles();
  }

  const changedFiles = collectChangedFiles();
  const disallowed = changedFiles.filter((relativePath) => !allowedChangedFiles.has(relativePath));

  if (disallowed.length > 0) {
    fail("S-REG-17 touched files outside the exercise-equipment candidate FK closure expansion boundary.", {
      changed_files: changedFiles,
      disallowed_files: disallowed,
      allowed_files: [...allowedChangedFiles].sort()
    });
  }

  for (const relativePath of changedFiles) {
    for (const prefix of forbiddenChangedPrefixes) {
      if (relativePath.startsWith(prefix)) {
        fail("S-REG-17 touched a forbidden active, runtime, or source-candidate surface.", {
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
  const document = sReg17LoadExerciseEquipmentCandidateFkClosureExpansion();

  if (document.slice_id !== S_REG_17_SLICE_ID) {
    fail("S-REG-17 batch slice_id is invalid.", { actual: document.slice_id });
  }

  if (document.registry_id !== S_REG_17_REGISTRY_ID) {
    fail("S-REG-17 batch registry_id is invalid.", { actual: document.registry_id });
  }

  if (document.batch_id !== S_REG_17_BATCH_ID) {
    fail("S-REG-17 batch_id is invalid.", { actual: document.batch_id });
  }

  if (document.records.length !== S_REG_17_EXPECTED_CLOSURE_IDS.length) {
    fail("S-REG-17 candidate FK closure record count changed.", {
      actual: document.records.length,
      expected: S_REG_17_EXPECTED_CLOSURE_IDS.length
    });
  }

  const actualIds = document.records.map((record) => record.closure_id);

  if (JSON.stringify(actualIds) !== JSON.stringify(S_REG_17_EXPECTED_CLOSURE_IDS)) {
    fail("S-REG-17 candidate FK closure id order changed.", {
      actual: actualIds,
      expected: S_REG_17_EXPECTED_CLOSURE_IDS
    });
  }
}

function assertPackageWiring() {
  const packageJson = readJson(files.packageJson);
  const proofScript = packageJson.scripts?.["proof:s-reg-17"] ?? "";
  const lintFast = packageJson.scripts?.["lint:fast"] ?? "";
  const lintFastInline = packageJson.scripts?.["lint:fast:inline"] ?? "";
  const testUnit = packageJson.scripts?.["test:unit"] ?? "";

  const expectedProof =
    "node --test test/s_reg_17_exercise_equipment_candidate_fk_closure_expansion.test.mjs && node ci/guards/s_reg_17_exercise_equipment_candidate_fk_closure_expansion_guard.mjs";

  if (proofScript !== expectedProof) {
    fail("S-REG-17 proof package script is missing or invalid.", {
      actual: proofScript,
      expected: expectedProof
    });
  }

  if (lintFast.includes("s_reg_17_exercise_equipment_candidate_fk_closure_expansion")) {
    fail("S-REG-17 must not append to the top-level lint:fast command.", {
      reason: "Wire S-REG-17 through lint:fast:inline to avoid Windows command length expansion."
    });
  }

  if (!lintFastInline.includes("s_reg_17_exercise_equipment_candidate_fk_closure_expansion")) {
    fail("S-REG-17 lint:fast:inline package wiring is missing.");
  }

  if (!testUnit.includes("s_reg_17_exercise_equipment_candidate_fk_closure_expansion_guard.mjs")) {
    fail("S-REG-17 test:unit package entrypoint wiring is missing.", {
      reason: "guards_entrypoint_coverage_guard declares test:unit."
    });
  }
}

function assertGuardIndexed() {
  const guardsIndex = readText("docs/GUARDS_INDEX.md");

  if (!guardsIndex.includes(files.guard)) {
    fail("S-REG-17 guard is missing from docs/GUARDS_INDEX.md.");
  }
}

function assertDocMarkers() {
  const doc = readText(files.doc);

  for (const marker of [
    "S-REG-17 is candidate exercise-equipment FK closure expansion only.",
    "No active registry activation.",
    "No changes to registries/registry_index.json.",
    "No changes to registries/registry_bundle.json.",
    "No new exercise content.",
    "No new equipment content.",
    "S-REG-18 receives this inert FK closure expansion as dependency input."
  ]) {
    if (!doc.includes(marker)) {
      fail("Required S-REG-17 documentation marker is missing.", {
        marker,
        path: files.doc
      });
    }
  }

  for (const forbiddenPhrase of [
    "exercise-equipment coverage is complete",
    "canonical fk closure is active",
    "recommended equipment",
    "equipment advice active",
    "substitution behaviour active",
    "fallback logic active",
    "programme assignment active",
    "marker evaluator active"
  ]) {
    if (doc.toLowerCase().includes(forbiddenPhrase)) {
      fail("S-REG-17 documentation contains forbidden completion, advice, runtime, or activation language.", {
        forbiddenPhrase
      });
    }
  }
}

const changedFiles = assertChangedFilesAllowed();
assertActiveRegistrySurface();
assertBatchBoundary();

const validation = sReg17ValidateExerciseEquipmentCandidateFkClosureExpansion();

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
  closure_ids: validation.closure_ids,
  dependency_inputs: validation.dependency_inputs,
  activation_ready: validation.activation_ready,
  runtime_status: validation.runtime_status,
  changed_files_checked: changedFiles.length,
  message: "S-REG-17 exercise-equipment candidate FK closure expansion passed."
}, null, 2));