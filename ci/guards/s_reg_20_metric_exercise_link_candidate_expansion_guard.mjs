// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-REG-20 guard.
 * Purpose: proves metric-exercise link candidate expansion is inert,
 * dependency-bound, queue-aligned, and limited to factual FK relationship
 * records.
 * Boundary: no active registry activation, no active bundle change, no engine
 * runtime change, no Phase 1 runtime schema change, no threshold marker records,
 * no marker evaluator, no comparison result, no advice, no coach
 * interpretation, no programme assignment, no substitution behaviour, no UI
 * behaviour, no marketplace, no facility, no organisation, no team runtime, and
 * no complete registry coverage claim.
 */

import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

import {
  S_REG_20_BATCH_ID,
  S_REG_20_EXPECTED_LINK_IDS,
  S_REG_20_FAILURE_TOKEN,
  S_REG_20_REGISTRY_ID,
  S_REG_20_SLICE_ID,
  sReg20LoadMetricExerciseLinkCandidateExpansion,
  sReg20ValidateMetricExerciseLinkCandidateExpansion
} from "../registry/s_reg_20_metric_exercise_link_candidate_expansion.mjs";

const GUARD = "S-REG-20";
const TOKEN = S_REG_20_FAILURE_TOKEN;

const files = Object.freeze({
  module: "ci/registry/s_reg_20_metric_exercise_link_candidate_expansion.mjs",
  json: "ci/registry/s_reg_20_metric_exercise_link_candidate_expansion.json",
  test: "test/s_reg_20_metric_exercise_link_candidate_expansion.test.mjs",
  guard: "ci/guards/s_reg_20_metric_exercise_link_candidate_expansion_guard.mjs",
  doc: "docs/roadmap/S_REG_20_METRIC_EXERCISE_LINK_CANDIDATE_EXPANSION.md",
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
  "docs/GUARDS_INDEX.md",
  "docs/dev/FAILURE_TOKEN_INDEX.md",
  "docs/checksums.sha256"
]);

const forbiddenChangedPrefixes = Object.freeze([
  "engine/",
  "src/",
  "app/",
  "web/",
  "server/",
  "shared/",
  "registries/",
  "ci/registry/candidates/",
  "replay/",
  "docs/canonical/",
  "docs/product/",
  "docs/registries/"
]);

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
    details
  }, null, 2));

  process.exit(1);
}

function readText(relativePath) {
  return fs.readFileSync(relativePath, "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function sha256(relativePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(relativePath)).digest("hex");
}

function runGit(args) {
  try {
    return execFileSync("git", args, {
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
    ["diff", "--name-only", "--cached"]
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

  return Array.from(filesChanged).sort();
}

function assertChangedFilesAllowed() {
  const branch = currentBranchName();

  if (branch === "main") {
    return [];
  }

  const changedFiles = collectChangedFiles();

  for (const relativePath of changedFiles) {
    if (allowedChangedFiles.has(relativePath)) {
      continue;
    }

    for (const prefix of forbiddenChangedPrefixes) {
      if (relativePath.startsWith(prefix)) {
        fail("S-REG-20 touched a forbidden active, runtime, source-candidate, or product surface.", {
          path: relativePath,
          forbidden_prefix: prefix
        });
      }
    }

    fail("S-REG-20 changed an unapproved file.", {
      path: relativePath,
      allowedChangedFiles: Array.from(allowedChangedFiles)
    });
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
  const document = sReg20LoadMetricExerciseLinkCandidateExpansion();

  if (document.slice_id !== S_REG_20_SLICE_ID) {
    fail("S-REG-20 document slice id changed.", {
      actual: document.slice_id,
      expected: S_REG_20_SLICE_ID
    });
  }

  if (document.registry_id !== S_REG_20_REGISTRY_ID) {
    fail("S-REG-20 document registry id changed.", {
      actual: document.registry_id,
      expected: S_REG_20_REGISTRY_ID
    });
  }

  if (document.batch_id !== S_REG_20_BATCH_ID) {
    fail("S-REG-20 document batch id changed.", {
      actual: document.batch_id,
      expected: S_REG_20_BATCH_ID
    });
  }

  if (document.records.length !== S_REG_20_EXPECTED_LINK_IDS.length) {
    fail("S-REG-20 candidate metric-exercise link record count changed.", {
      actual: document.records.length,
      expected: S_REG_20_EXPECTED_LINK_IDS.length
    });
  }

  const actualIds = document.records.map((record) => record.metric_exercise_link_id);
  if (JSON.stringify(actualIds) !== JSON.stringify(S_REG_20_EXPECTED_LINK_IDS)) {
    fail("S-REG-20 candidate metric-exercise link id order changed.", {
      actual: actualIds,
      expected: S_REG_20_EXPECTED_LINK_IDS
    });
  }
}

function assertPackageWiring() {
  const packageJson = readJson(files.packageJson);
  const proofScript = packageJson.scripts?.["proof:s-reg-20"] ?? "";
  const lintFast = packageJson.scripts?.["lint:fast"] ?? "";
  const lintFastInline = packageJson.scripts?.["lint:fast:inline"] ?? "";
  const testUnit = packageJson.scripts?.["test:unit"] ?? "";

  const expectedProof =
    "node --test test/s_reg_20_metric_exercise_link_candidate_expansion.test.mjs && node ci/guards/s_reg_20_metric_exercise_link_candidate_expansion_guard.mjs";

  if (proofScript !== expectedProof) {
    fail("S-REG-20 proof package script is missing or invalid.", {
      actual: proofScript,
      expected: expectedProof
    });
  }

  if (lintFast.includes("s_reg_20_metric_exercise_link_candidate_expansion")) {
    fail("S-REG-20 must not append to the top-level lint:fast command.", {
      reason: "Wire S-REG-20 through lint:fast:inline to avoid Windows command length expansion."
    });
  }

  if (!lintFastInline.includes("s_reg_20_metric_exercise_link_candidate_expansion")) {
    fail("S-REG-20 lint:fast:inline package wiring is missing.");
  }

  if (!testUnit.includes("s_reg_20_metric_exercise_link_candidate_expansion_guard.mjs")) {
    fail("S-REG-20 test:unit package entrypoint wiring is missing.", {
      reason: "guards_entrypoint_coverage_guard declares test:unit."
    });
  }
}

function assertGuardIndexed() {
  const guardsIndex = readText("docs/GUARDS_INDEX.md");

  if (!guardsIndex.includes(files.guard)) {
    fail("S-REG-20 guard is missing from docs/GUARDS_INDEX.md.");
  }
}

function assertDocMarkers() {
  const doc = readText(files.doc);

  for (const marker of [
    "S-REG-20 is candidate metric-exercise link expansion only.",
    "No active registry activation.",
    "No changes to registries/registry_index.json.",
    "No changes to registries/registry_bundle.json.",
    "No Phase 1 runtime schema change.",
    "No threshold marker records.",
    "No marker evaluator behaviour.",
    "No comparison result.",
    "No coach interpretation.",
    "S-REG-21 receives this inert metric-exercise link expansion as dependency input."
  ]) {
    if (!doc.includes(marker)) {
      fail("Required S-REG-20 documentation marker is missing.", {
        marker,
        path: files.doc
      });
    }
  }

  for (const forbiddenPhrase of [
    "metric-exercise links are active",
    "metric-exercise link coverage is complete",
    "canonical metric-exercise links are active",
    "threshold marker records created",
    "marker evaluator active",
    "comparison result active",
    "recommended link",
    "outcome inference active"
  ]) {
    if (doc.toLowerCase().includes(forbiddenPhrase)) {
      fail("S-REG-20 documentation contains forbidden completion, runtime, recommendation, threshold, evaluator, comparison, or inference language.", {
        forbiddenPhrase
      });
    }
  }
}

const changedFiles = assertChangedFilesAllowed();
assertActiveRegistrySurface();
assertBatchBoundary();

const validation = sReg20ValidateMetricExerciseLinkCandidateExpansion();

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
  metric_exercise_link_ids: validation.metric_exercise_link_ids,
  dependency_inputs: validation.dependency_inputs,
  foundation_inputs: validation.foundation_inputs,
  link_kind: validation.link_kind,
  context_scope: validation.context_scope,
  value_context: validation.value_context,
  activation_ready: validation.activation_ready,
  runtime_status: validation.runtime_status,
  changed_files: changedFiles
}, null, 2));
