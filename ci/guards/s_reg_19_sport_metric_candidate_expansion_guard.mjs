// @law: Registry Law
// @severity: high
// @scope: registry

/**
 * DEV NOTE: S-REG-19 guard.
 * Purpose: proves sport metric candidate expansion is inert, dependency-bound,
 * and limited to factual sport metric identity records.
 * Boundary: no active registry files, no engine/runtime files, no bundle writer,
 * no metric-exercise links, no threshold marker records, no marker evaluator,
 * no programme assignment, no substitution behaviour, no UI interpretation,
 * no marketplace, no facility, no organisation, no team runtime, and no
 * enterprise analytics.
 * Determinism: validates package wiring, generated index inclusion, active
 * registry surface unchanged, exact metric order, exact dependency inputs from
 * S-REG-14, S-REG-10 sport context FK closure, S-REG-11 seed dependency, and
 * S-REG-18 activity evidence.
 * Failure: emits CI_S_REG_19_SPORT_METRIC_CANDIDATE_EXPANSION.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import {
  S_REG_19_BATCH_ID,
  S_REG_19_EXPECTED_SPORT_METRIC_IDS,
  S_REG_19_FAILURE_TOKEN,
  S_REG_19_REGISTRY_ID,
  S_REG_19_SLICE_ID,
  sReg19LoadSportMetricCandidateExpansion,
  sReg19ValidateSportMetricCandidateExpansion
} from "../registry/s_reg_19_sport_metric_candidate_expansion.mjs";

const repoRoot = process.cwd();
const GUARD = "S-REG-19";
const TOKEN = S_REG_19_FAILURE_TOKEN;

const files = Object.freeze({
  module: "ci/registry/s_reg_19_sport_metric_candidate_expansion.mjs",
  batch: "ci/registry/s_reg_19_sport_metric_candidate_expansion.json",
  test: "test/s_reg_19_sport_metric_candidate_expansion.test.mjs",
  guard: "ci/guards/s_reg_19_sport_metric_candidate_expansion_guard.mjs",
  doc: "docs/roadmap/S_REG_19_SPORT_METRIC_CANDIDATE_EXPANSION.md",
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
    fail("Required S-REG-19 file is missing.", { path: relativePath });
  }

  return fs.readFileSync(fullPath, "utf8");
}

function readJson(relativePath) {
  try {
    return JSON.parse(readText(relativePath));
  } catch (error) {
    fail("Required S-REG-19 JSON file is invalid.", {
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

  if (!branchName.includes("s-reg-19-sport-metric-candidate-expansion")) {
    return collectChangedFiles();
  }

  const changedFiles = collectChangedFiles();
  const disallowed = changedFiles.filter((relativePath) => !allowedChangedFiles.has(relativePath));

  if (disallowed.length > 0) {
    fail("S-REG-19 touched files outside the sport metric candidate expansion boundary.", {
      changed_files: changedFiles,
      disallowed_files: disallowed,
      allowed_files: [...allowedChangedFiles].sort()
    });
  }

  for (const relativePath of changedFiles) {
    for (const prefix of forbiddenChangedPrefixes) {
      if (relativePath.startsWith(prefix)) {
        fail("S-REG-19 touched a forbidden active, runtime, source-candidate, or product surface.", {
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
  const document = sReg19LoadSportMetricCandidateExpansion();

  if (document.slice_id !== S_REG_19_SLICE_ID) {
    fail("S-REG-19 batch slice_id is invalid.", { actual: document.slice_id });
  }

  if (document.registry_id !== S_REG_19_REGISTRY_ID) {
    fail("S-REG-19 batch registry_id is invalid.", { actual: document.registry_id });
  }

  if (document.batch_id !== S_REG_19_BATCH_ID) {
    fail("S-REG-19 batch_id is invalid.", { actual: document.batch_id });
  }

  if (document.records.length !== S_REG_19_EXPECTED_SPORT_METRIC_IDS.length) {
    fail("S-REG-19 candidate sport metric record count changed.", {
      actual: document.records.length,
      expected: S_REG_19_EXPECTED_SPORT_METRIC_IDS.length
    });
  }

  const actualIds = document.records.map((record) => record.sport_metric_id);

  if (JSON.stringify(actualIds) !== JSON.stringify(S_REG_19_EXPECTED_SPORT_METRIC_IDS)) {
    fail("S-REG-19 candidate sport metric id order changed.", {
      actual: actualIds,
      expected: S_REG_19_EXPECTED_SPORT_METRIC_IDS
    });
  }
}

function assertPackageWiring() {
  const packageJson = readJson(files.packageJson);
  const proofScript = packageJson.scripts?.["proof:s-reg-19"] ?? "";
  const lintFast = packageJson.scripts?.["lint:fast"] ?? "";
  const lintFastInline = packageJson.scripts?.["lint:fast:inline"] ?? "";
  const testUnit = packageJson.scripts?.["test:unit"] ?? "";

  const expectedProof =
    "node --test test/s_reg_19_sport_metric_candidate_expansion.test.mjs && node ci/guards/s_reg_19_sport_metric_candidate_expansion_guard.mjs";

  if (proofScript !== expectedProof) {
    fail("S-REG-19 proof package script is missing or invalid.", {
      actual: proofScript,
      expected: expectedProof
    });
  }

  if (lintFast.includes("s_reg_19_sport_metric_candidate_expansion")) {
    fail("S-REG-19 must not append to the top-level lint:fast command.", {
      reason: "Wire S-REG-19 through lint:fast:inline to avoid Windows command length expansion."
    });
  }

  if (!lintFastInline.includes("s_reg_19_sport_metric_candidate_expansion")) {
    fail("S-REG-19 lint:fast:inline package wiring is missing.");
  }

  if (!testUnit.includes("s_reg_19_sport_metric_candidate_expansion_guard.mjs")) {
    fail("S-REG-19 test:unit package entrypoint wiring is missing.", {
      reason: "guards_entrypoint_coverage_guard declares test:unit."
    });
  }
}

function assertGuardIndexed() {
  const guardsIndex = readText("docs/GUARDS_INDEX.md");

  if (!guardsIndex.includes(files.guard)) {
    fail("S-REG-19 guard is missing from docs/GUARDS_INDEX.md.");
  }
}

function assertDocMarkers() {
  const doc = readText(files.doc);

  for (const marker of [
    "S-REG-19 is candidate sport metric expansion only.",
    "No active registry activation.",
    "No changes to registries/registry_index.json.",
    "No changes to registries/registry_bundle.json.",
    "No metric-exercise links.",
    "No threshold marker records.",
    "No marker evaluator behaviour.",
    "S-REG-20 receives this inert sport metric expansion as dependency input."
  ]) {
    if (!doc.includes(marker)) {
      fail("Required S-REG-19 documentation marker is missing.", {
        marker,
        path: files.doc
      });
    }
  }

  for (const forbiddenPhrase of [
    "sport metric coverage is complete",
    "canonical sport metrics are active",
    "metric-exercise links are active",
    "threshold marker records created",
    "marker evaluator active",
    "recommended metric",
    "outcome inference active"
  ]) {
    if (doc.toLowerCase().includes(forbiddenPhrase)) {
      fail("S-REG-19 documentation contains forbidden completion, runtime, recommendation, threshold, evaluator, or inference language.", {
        forbiddenPhrase
      });
    }
  }
}

const changedFiles = assertChangedFilesAllowed();
assertActiveRegistrySurface();
assertBatchBoundary();

const validation = sReg19ValidateSportMetricCandidateExpansion();

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
  sport_metric_ids: validation.sport_metric_ids,
  dependency_inputs: validation.dependency_inputs,
  foundation_inputs: validation.foundation_inputs,
  metric_kind: validation.metric_kind,
  context_scope: validation.context_scope,
  activation_ready: validation.activation_ready,
  runtime_status: validation.runtime_status,
  changed_files_checked: changedFiles.length,
  message: "S-REG-19 sport metric candidate expansion passed."
}, null, 2));