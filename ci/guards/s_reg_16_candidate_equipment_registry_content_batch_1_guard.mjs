// @law: Registry Law
// @severity: high
// @scope: registry

/**
 * DEV NOTE: S-REG-16 guard.
 * Purpose: proves candidate equipment registry content batch 1 is inert,
 * dependency-bound, and limited to equipment_registry candidate identity records
 * only.
 * Boundary: no active registry files, no engine/runtime files, no bundle writer,
 * no programme templates, no substitution behaviour, no exercise-equipment FK
 * closure expansion, no marker evaluator, no threshold marker records, no UI,
 * no marketplace, no facility, and no organisation/team runtime.
 * Determinism: validates package wiring, generated index inclusion, active
 * registry surface unchanged, exact batch order, exact dependency inputs, and
 * candidate equipment FK closure against existing activity/movement seeds.
 * Failure: emits CI_S_REG_16_CANDIDATE_EQUIPMENT_REGISTRY_CONTENT_BATCH_1.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import {
  S_REG_16_BATCH_ID,
  S_REG_16_EXPECTED_RECORD_IDS,
  S_REG_16_FAILURE_TOKEN,
  S_REG_16_REGISTRY_ID,
  S_REG_16_SLICE_ID,
  sReg16LoadCandidateEquipmentContentBatch1,
  sReg16ValidateCandidateEquipmentRegistryContentBatch1
} from "../registry/s_reg_16_candidate_equipment_registry_content_batch_1.mjs";

const repoRoot = process.cwd();
const GUARD = "S-REG-16";
const TOKEN = S_REG_16_FAILURE_TOKEN;

const files = Object.freeze({
  module: "ci/registry/s_reg_16_candidate_equipment_registry_content_batch_1.mjs",
  batch: "ci/registry/s_reg_16_candidate_equipment_registry_content_batch_1.json",
  test: "test/s_reg_16_candidate_equipment_registry_content_batch_1.test.mjs",
  guard: "ci/guards/s_reg_16_candidate_equipment_registry_content_batch_1_guard.mjs",
  doc: "docs/roadmap/S_REG_16_CANDIDATE_EQUIPMENT_REGISTRY_CONTENT_BATCH_1.md",
  packageJson: "package.json",
  registryIndex: "registries/registry_index.json",
  registryBundle: "registries/registry_bundle.json"
});

const expectedActiveRegistryHashes = Object.freeze({
  "registries/registry_index.json": "c31139079df4ed7b0a4c58808a2fd1c8e399cb7c1c4d4499fc625ed2c7586d37",
  "registries/registry_bundle.json": "3ae38479b85aad2bbf03ec1ea9613d17d9ee97997b529bacbfdd9d41773e61df"
});

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
    fail("Required S-REG-16 file is missing.", { path: relativePath });
  }

  return fs.readFileSync(fullPath, "utf8");
}

function readJson(relativePath) {
  try {
    return JSON.parse(readText(relativePath));
  } catch (error) {
    fail("Required S-REG-16 JSON file is invalid.", {
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

function assertNoActiveRegistryFileChanged() {
  const changedFiles = collectChangedFiles();

  for (const activePath of Object.keys(expectedActiveRegistryHashes)) {
    if (changedFiles.includes(activePath)) {
      fail("S-REG-16 changed a forbidden active registry file.", { activePath });
    }
  }

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

  for (const [relativePath, expectedHash] of Object.entries(expectedActiveRegistryHashes)) {
    const actualHash = sha256(relativePath);
    if (actualHash !== expectedHash) {
      fail("Active registry hash changed before activation gate.", {
        relativePath,
        expectedHash,
        actualHash
      });
    }
  }
}

function assertBatchBoundary() {
  const document = sReg16LoadCandidateEquipmentContentBatch1();

  if (document.slice_id !== S_REG_16_SLICE_ID) {
    fail("S-REG-16 batch slice_id is invalid.", { actual: document.slice_id });
  }

  if (document.registry_id !== S_REG_16_REGISTRY_ID) {
    fail("S-REG-16 batch registry_id is invalid.", { actual: document.registry_id });
  }

  if (document.batch_id !== S_REG_16_BATCH_ID) {
    fail("S-REG-16 batch_id is invalid.", { actual: document.batch_id });
  }

  if (document.records.length !== S_REG_16_EXPECTED_RECORD_IDS.length) {
    fail("S-REG-16 candidate batch record count changed.", {
      actual: document.records.length,
      expected: S_REG_16_EXPECTED_RECORD_IDS.length
    });
  }

  const actualIds = document.records.map((record) => record.equipment_id);

  if (JSON.stringify(actualIds) !== JSON.stringify(S_REG_16_EXPECTED_RECORD_IDS)) {
    fail("S-REG-16 candidate batch equipment id order changed.", {
      actual: actualIds,
      expected: S_REG_16_EXPECTED_RECORD_IDS
    });
  }
}

function assertPackageWiring() {
  const packageJson = readJson(files.packageJson);
  const proofScript = packageJson.scripts?.["proof:s-reg-16"] ?? "";
  const lintFast = packageJson.scripts?.["lint:fast"] ?? "";
  const lintFastInline = packageJson.scripts?.["lint:fast:inline"] ?? "";
  const testUnit = packageJson.scripts?.["test:unit"] ?? "";

  const expectedProof =
    "node --test test/s_reg_16_candidate_equipment_registry_content_batch_1.test.mjs && node ci/guards/s_reg_16_candidate_equipment_registry_content_batch_1_guard.mjs";

  if (proofScript !== expectedProof) {
    fail("S-REG-16 proof package script is missing or invalid.", {
      actual: proofScript,
      expected: expectedProof
    });
  }

  if (lintFast.includes("s_reg_16_candidate_equipment_registry_content_batch_1")) {
    fail("S-REG-16 must not append to the top-level lint:fast command.", {
      reason: "Wire S-REG-16 through lint:fast:inline to avoid Windows command length expansion."
    });
  }

  if (!lintFastInline.includes("s_reg_16_candidate_equipment_registry_content_batch_1")) {
    fail("S-REG-16 lint:fast:inline package wiring is missing.");
  }

  if (!testUnit.includes("s_reg_16_candidate_equipment_registry_content_batch_1_guard.mjs")) {
    fail("S-REG-16 test:unit package entrypoint wiring is missing.", {
      reason: "guards_entrypoint_coverage_guard declares test:unit."
    });
  }
}

function assertGuardIndexed() {
  const guardsIndex = readText("docs/GUARDS_INDEX.md");

  if (!guardsIndex.includes(files.guard)) {
    fail("S-REG-16 guard is missing from docs/GUARDS_INDEX.md.");
  }
}

function assertDocMarkers() {
  const doc = readText(files.doc);

  for (const marker of [
    "S-REG-16 is candidate equipment registry content only.",
    "No active registry activation.",
    "No changes to registries/registry_index.json.",
    "No changes to registries/registry_bundle.json.",
    "No exercise-equipment FK closure expansion.",
    "S-REG-17 receives this inert candidate equipment batch as dependency input."
  ]) {
    if (!doc.includes(marker)) {
      fail("Required S-REG-16 documentation marker is missing.", {
        marker,
        path: files.doc
      });
    }
  }

  for (const forbiddenPhrase of [
    "equipment registry is complete",
    "canonical equipment registry is active",
    "recommended equipment",
    "assigned equipment to exercise",
    "marketplace equipment logic active",
    "facility runtime active"
  ]) {
    if (doc.toLowerCase().includes(forbiddenPhrase)) {
      fail("S-REG-16 documentation contains forbidden completion, assignment, runtime, or claim language.", {
        forbiddenPhrase
      });
    }
  }
}

const changedFiles = assertNoActiveRegistryFileChanged();
assertActiveRegistrySurface();
assertBatchBoundary();

const validation = sReg16ValidateCandidateEquipmentRegistryContentBatch1();

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
  equipment_ids: validation.equipment_ids,
  dependency_inputs: validation.dependency_inputs,
  activation_ready: validation.activation_ready,
  runtime_status: validation.runtime_status,
  exercise_equipment_fk_closure_mutation: validation.exercise_equipment_fk_closure_mutation,
  changed_files_checked: changedFiles.length,
  message: "S-REG-16 candidate equipment registry content batch 1 passed."
}, null, 2));