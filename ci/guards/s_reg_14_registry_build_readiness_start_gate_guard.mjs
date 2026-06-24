// @law: Registry Law
// @severity: high
// @scope: registry

/**
 * DEV NOTE: S-REG-14 guard.
 * Purpose: proves the registry build-readiness start gate is a non-runtime
 * readiness record only and that actual candidate content production has not
 * started in this slice.
 * Boundary: allows only S-REG-14 manifest/module/test/guard/doc, package
 * wiring, and generated indexes/checksums. It blocks active registry changes,
 * candidate content rows, engine/runtime changes, bundle writer changes, marker
 * evaluator behaviour, substitution changes, programme template formulas, and
 * UI/organisation/team/tactical interpretation surfaces.
 * Determinism: validates fixed build queue order, dependency closure map,
 * compact active registry surface, package entrypoints, guard index, and changed
 * file boundaries.
 * Failure: emits CI_S_REG_14_REGISTRY_BUILD_READINESS_START_GATE.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import {
  S_REG_14_BUILD_QUEUE,
  S_REG_14_COMPACT_ACTIVE_REGISTRY_ORDER,
  S_REG_14_FAILURE_TOKEN,
  S_REG_14_READY_TO_BUILD_NOW,
  sReg14BuildDependencyClosureMap,
  sReg14ValidateBuildQueueOrder,
  sReg14ValidateRegistryBuildReadinessStartGate
} from "../registry/s_reg_14_registry_build_readiness_start_gate.mjs";

const repoRoot = process.cwd();
const GUARD = "S-REG-14";
const TOKEN = S_REG_14_FAILURE_TOKEN;

const files = Object.freeze({
  module: "ci/registry/s_reg_14_registry_build_readiness_start_gate.mjs",
  manifest: "ci/registry/s_reg_14_registry_build_readiness_start_gate_manifest.json",
  test: "test/s_reg_14_registry_build_readiness_start_gate.test.mjs",
  guard: "ci/guards/s_reg_14_registry_build_readiness_start_gate_guard.mjs",
  doc: "docs/roadmap/S_REG_14_REGISTRY_BUILD_READINESS_START_GATE.md",
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
    fail("Required S-REG-14 file is missing.", { path: relativePath });
  }

  return fs.readFileSync(fullPath, "utf8");
}

function readJson(relativePath) {
  try {
    return JSON.parse(readText(relativePath));
  } catch (error) {
    fail("Required S-REG-14 JSON file is invalid.", {
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

  const order = registryIndex.order;
  const bundleKeys = Object.keys(registryBundle.registries ?? {});

  if (JSON.stringify(order) !== JSON.stringify(S_REG_14_COMPACT_ACTIVE_REGISTRY_ORDER)) {
    fail("Active registry index order changed.", {
      actual: order,
      expected: S_REG_14_COMPACT_ACTIVE_REGISTRY_ORDER
    });
  }

  if (JSON.stringify(bundleKeys) !== JSON.stringify(S_REG_14_COMPACT_ACTIVE_REGISTRY_ORDER)) {
    fail("Active registry bundle changed.", {
      actual: bundleKeys,
      expected: S_REG_14_COMPACT_ACTIVE_REGISTRY_ORDER
    });
  }
}

function assertDocMarkers() {
  const doc = readText(files.doc);

  for (const marker of [
    "No active registry activation.",
    "No broad content production in S-REG-14.",
    "Candidate registries remain inert.",
    "Build order is dependency-safe.",
    "S-REG-15 starts candidate exercise registry content expansion."
  ]) {
    if (!doc.includes(marker)) {
      fail("Required S-REG-14 documentation marker is missing.", {
        marker,
        path: files.doc
      });
    }
  }

  for (const forbiddenPhrase of [
    "registry content is complete",
    "active registries are complete",
    "threshold marker evaluator is ready",
    "automatic coaching recommendation",
    "return-to-play decision"
  ]) {
    if (doc.toLowerCase().includes(forbiddenPhrase)) {
      fail("S-REG-14 documentation contains forbidden completion or claim language.", {
        forbiddenPhrase
      });
    }
  }
}

function assertPackageWiring() {
  const packageJson = readJson(files.packageJson);
  const proofScript = packageJson.scripts?.["proof:s-reg-14"];
  const lintFast = packageJson.scripts?.["lint:fast"] ?? "";
  const lintFastInline = packageJson.scripts?.["lint:fast:inline"] ?? "";
  const testUnit = packageJson.scripts?.["test:unit"] ?? "";

  if (
    proofScript !==
    "node --test test/s_reg_14_registry_build_readiness_start_gate.test.mjs && node ci/guards/s_reg_14_registry_build_readiness_start_gate_guard.mjs"
  ) {
    fail("S-REG-14 proof package script is missing or invalid.", {
      actual: proofScript
    });
  }

  if (lintFast.includes("s_reg_14_registry_build_readiness_start_gate")) {
    fail("S-REG-14 must not append to the top-level lint:fast command.", {
      reason: "Wire S-REG-14 through lint:fast:inline to avoid Windows command length expansion."
    });
  }

  if (!lintFastInline.includes("s_reg_14_registry_build_readiness_start_gate")) {
    fail("S-REG-14 lint:fast:inline package wiring is missing.");
  }

  if (!testUnit.includes("s_reg_14_registry_build_readiness_start_gate_guard.mjs")) {
    fail("S-REG-14 test:unit package entrypoint wiring is missing.", {
      reason: "guards_entrypoint_coverage_guard declares test:unit, not lint:fast:inline."
    });
  }
}

function assertGuardIndexed() {
  const guardsIndex = readText("docs/GUARDS_INDEX.md");
  const entrypoints = readJson("ci/guards/_entrypoints.json");

  if (!guardsIndex.includes(files.guard)) {
    fail("S-REG-14 guard is missing from docs/GUARDS_INDEX.md.");
  }

  if (!Array.isArray(entrypoints.package_json_scripts)) {
    fail("ci/guards/_entrypoints.json package_json_scripts structure is invalid.");
  }

  if (!entrypoints.package_json_scripts.includes("lint:fast")) {
    fail("ci/guards/_entrypoints.json does not list lint:fast package entrypoint.");
  }

  if (!Array.isArray(entrypoints.workflow_files)) {
    fail("ci/guards/_entrypoints.json workflow_files structure is invalid.");
  }
}

function assertForbiddenContentKeysAbsent(value, context = "manifest") {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      assertForbiddenContentKeysAbsent(item, `${context}[${index}]`);
    });
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (key === "forbidden_fields") {
      continue;
    }

    for (const forbiddenKey of [
      "records",
      "seed_records",
      "candidate_records_created",
      "active_registry_activation",
      "engine_runtime_change",
      "marker_evaluator",
      "substitution_runtime_change"
    ]) {
      if (key === forbiddenKey) {
        fail("S-REG-14 manifest contains a forbidden content or runtime field.", {
          forbiddenKey,
          context
        });
      }
    }

    assertForbiddenContentKeysAbsent(nestedValue, `${context}.${key}`);
  }
}

function assertManifestDoesNotCreateContent() {
  const manifest = readJson(files.manifest);

  assertForbiddenContentKeysAbsent(manifest);

  if (manifest.content_production_status !== "not_started") {
    fail("S-REG-14 content production status must remain not_started.", {
      actual: manifest.content_production_status
    });
  }

  if (manifest.activation_ready !== false) {
    fail("S-REG-14 activation_ready must remain false.", {
      actual: manifest.activation_ready
    });
  }
}

const changedFiles = assertChangedFilesAllowed();
assertActiveRegistrySurface();
assertManifestDoesNotCreateContent();

const validation = sReg14ValidateRegistryBuildReadinessStartGate();
const queue = sReg14ValidateBuildQueueOrder();
const dependencyMap = sReg14BuildDependencyClosureMap();

assertDocMarkers();
assertPackageWiring();
assertGuardIndexed();

console.log(JSON.stringify({
  ok: true,
  guard: GUARD,
  token: TOKEN,
  gate_status: validation.gate_status,
  runtime_status: validation.runtime_status,
  activation_ready: validation.activation_ready,
  content_production_status: validation.content_production_status,
  active_registry_order: S_REG_14_COMPACT_ACTIVE_REGISTRY_ORDER,
  ready_to_build_count: S_REG_14_READY_TO_BUILD_NOW.length,
  build_queue_length: S_REG_14_BUILD_QUEUE.length,
  first_content_slice: queue.first_content_slice,
  final_review_slice: queue.final_review_slice,
  activation_gate_blocked_until: dependencyMap.activation_gate_blocked_until,
  changed_files_checked: changedFiles.length,
  message: "S-REG-14 registry build-readiness start gate passed."
}, null, 2));