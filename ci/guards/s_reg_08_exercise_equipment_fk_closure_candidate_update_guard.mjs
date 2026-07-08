// @law: Registry Law
// @severity: high
// @scope: registry

/**
 * DEV NOTE: S-REG-08 guard.
 * Purpose: proves the inert exercise candidate seed records reference only
 * declared S-REG-07 equipment candidate records.
 * Boundary: this guard permits only S-REG-08 candidate FK closure, compatible
 * S-REG-06/S-REG-07 validation updates, documentation, generated index,
 * checksum, and package wiring changes. It must not permit active registry,
 * registry law, bundle writer, engine runtime, programme template, substitution,
 * or broad registry content drift.
 * Determinism: validates fixed exercise-equipment map, fixed candidate paths,
 * active compact registry state, package entrypoints, and git state.
 * Failure: emits CI_S_REG_08_EXERCISE_EQUIPMENT_FK_CLOSURE_CANDIDATE_UPDATE.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const GUARD = "S-REG-08";
const TOKEN = "CI_S_REG_08_EXERCISE_EQUIPMENT_FK_CLOSURE_CANDIDATE_UPDATE";

const compactOrder = Object.freeze([
  "activity",
  "movement",
  "exercise",
  "program"
]);

const files = Object.freeze({
  module: "ci/registry/s_reg_08_exercise_equipment_fk_closure_candidate_update.mjs",
  manifest: "ci/registry/s_reg_08_exercise_equipment_fk_closure_candidate_manifest.json",
  test: "test/s_reg_08_exercise_equipment_fk_closure_candidate_update.test.mjs",
  guard: "ci/guards/s_reg_08_exercise_equipment_fk_closure_candidate_update_guard.mjs",
  doc: "docs/roadmap/S_REG_08_EXERCISE_EQUIPMENT_FK_CLOSURE_CANDIDATE_UPDATE.md",
  exerciseCandidate: "ci/registry/candidates/exercise_registry_3a/exercise_registry_3a.candidate.registry.json",
  equipmentCandidate: "ci/registry/candidates/equipment_registry/equipment_registry.candidate.registry.json",
  sReg06Module: "ci/registry/s_reg_06_candidate_seed_records.mjs",
  sReg06Test: "test/s_reg_06_canonical_activity_movement_exercise_candidate_seeds.test.mjs",
  sReg06Guard: "ci/guards/s_reg_06_canonical_activity_movement_exercise_candidate_seeds_guard.mjs",
  sReg06Doc: "docs/roadmap/S_REG_06_CANONICAL_ACTIVITY_MOVEMENT_EXERCISE_CANDIDATE_SEEDS.md",
  sReg07Module: "ci/registry/s_reg_07_equipment_candidate_seed_records.mjs",
  sReg07Test: "test/s_reg_07_canonical_equipment_candidate_seeds.test.mjs",
  sReg07Guard: "ci/guards/s_reg_07_canonical_equipment_candidate_seeds_guard.mjs",
  sReg07Doc: "docs/roadmap/S_REG_07_CANONICAL_EQUIPMENT_CANDIDATE_SEEDS.md",
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
  files.exerciseCandidate,
  files.sReg06Module,
  files.sReg06Test,
  files.sReg06Guard,
  files.sReg06Doc,
  files.sReg07Module,
  files.sReg07Test,
  files.sReg07Guard,
  files.sReg07Doc,
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
  "registries/"
]);

const forbiddenTextTerms = Object.freeze([
  ["readiness", "score"].join(" "),
  ["safe", "to"].join(" "),
  ["recommendation", "engine"].join(" "),
  ["optimisation", "engine"].join(" "),
  ["protected", "formula", "visible"].join(" "),
  ["programme", "formula"].join(" "),
  ["marketplace", "runtime"].join(" "),
  ["team", "dashboard"].join("_"),
  ["gym", "access"].join("_"),
  ["federation", "runtime"].join(" "),
  ["organisation", "runtime"].join(" "),
  ["return", "to", "play"].join(" "),
  ["performance", "guarantee"].join("-")
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
    fail("Required S-REG-08 file is missing.", { path: relativePath });
  }

  return fs.readFileSync(fullPath, "utf8");
}

function readJson(relativePath) {
  try {
    return JSON.parse(readText(relativePath));
  } catch (error) {
    fail("Required S-REG-08 JSON file is invalid.", {
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
    fail("Required S-REG-08 marker is missing.", {
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

  if (!branchName.includes("s-reg-08-exercise-equipment-fk-closure-candidate-update")) {
    return;
  }

  const changed = currentChangedFiles();
  const disallowed = changed.filter((relativePath) => !allowedChangedFiles.has(relativePath));

  if (disallowed.length > 0) {
    fail("S-REG-08 touched files outside the exercise-equipment candidate FK closure boundary.", {
      changed_files: changed,
      disallowed_files: disallowed,
      allowed_files: [...allowedChangedFiles].sort()
    });
  }

  for (const relativePath of changed) {
    for (const prefix of forbiddenChangedPrefixes) {
      if (relativePath.startsWith(prefix)) {
        fail("S-REG-08 touched a forbidden active or runtime surface.", {
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

  assertDeepEqual(registryIndex.order, compactOrder, "Active registry index order changed.");

  if (!registryBundle.registries || typeof registryBundle.registries !== "object" || Array.isArray(registryBundle.registries)) {
    fail("Active registry bundle must expose a registries object.");
  }

  assertDeepEqual(Object.keys(registryBundle.registries), compactOrder, "Active registry bundle keys changed.");

  for (const registryId of [
    "exercise_registry_3a",
    "equipment_registry"
  ]) {
    if (fs.existsSync(repoPath(`registries/${registryId}`))) {
      fail("S-REG-08 must not create active canonical registry directories.", {
        registry_id: registryId
      });
    }
  }
}

function assertCandidateBoundary() {
  const exerciseDocument = readJson(files.exerciseCandidate);
  const equipmentDocument = readJson(files.equipmentCandidate);

  if (exerciseDocument.equipment_dependency_status !== "candidate_equipment_fk_closed") {
    fail("Exercise candidate document must have candidate_equipment_fk_closed status.", {
      actual: exerciseDocument.equipment_dependency_status
    });
  }

  if (exerciseDocument.activation_ready !== false || equipmentDocument.activation_ready !== false) {
    fail("Candidate documents must remain activation_ready false.");
  }

  if (exerciseDocument.runtime_status !== "non_runtime" || equipmentDocument.runtime_status !== "non_runtime") {
    fail("Candidate documents must remain non_runtime.");
  }
}

function assertNoForbiddenText() {
  const scannedFiles = [
    files.module,
    files.manifest,
    files.test,
    files.doc,
    files.exerciseCandidate
  ];

  const combined = scannedFiles.map((file) => readText(file)).join("\n").toLowerCase();

  for (const term of forbiddenTextTerms) {
    if (combined.includes(term.toLowerCase())) {
      fail("S-REG-08 contains forbidden claim or scope text.", { term });
    }
  }
}

async function main() {
  assertChangedFilesAllowed();
  assertActiveRegistryStillCompact();
  assertCandidateBoundary();

  const moduleUrl = pathToFileURL(repoPath(files.module)).href;
  const module = await import(`${moduleUrl}?cacheBust=${Date.now()}`);
  const result = module.sReg08ValidateExerciseEquipmentFkClosureCandidateUpdate();

  if (!result.ok || result.equipment_dependency_status !== "candidate_equipment_fk_closed") {
    fail("S-REG-08 module validation failed.", { result });
  }

  if (result.activation_ready !== false || result.runtime_status !== "non_runtime") {
    fail("S-REG-08 result must remain non-runtime and not activation-ready.", { result });
  }

  const manifest = readJson(files.manifest);
  assertDeepEqual(Object.keys(manifest.candidate_paths), ["exercise_registry_3a", "equipment_registry"], "S-REG-08 manifest candidate path order changed.");

  const packageText = readText(files.packageJson);
  const guardsIndexText = fs.existsSync(repoPath("docs/GUARDS_INDEX.md")) ? readText("docs/GUARDS_INDEX.md") : "";
  const docText = readText(files.doc);

  for (const marker of [
    "proof:s-reg-08",
    "node --test test/s_reg_08_exercise_equipment_fk_closure_candidate_update.test.mjs",
    "node ci/guards/s_reg_08_exercise_equipment_fk_closure_candidate_update_guard.mjs"
  ]) {
    assertIncludes(packageText, marker, "package.json");
  }

  assertIncludes(guardsIndexText, "s_reg_08_exercise_equipment_fk_closure_candidate_update_guard", "docs/GUARDS_INDEX.md");

  for (const marker of [
    "candidate_equipment_fk_closed",
    "non_runtime",
    "S-REG-09",
    "exercise_activity_applicability_registry",
    "registries/registry_index.json",
    "registries/registry_bundle.json",
    "ci/registry/candidates/exercise_registry_3a/exercise_registry_3a.candidate.registry.json",
    "ci/registry/candidates/equipment_registry/equipment_registry.candidate.registry.json"
  ]) {
    assertIncludes(docText, marker, files.doc);
  }

  assertNoForbiddenText();

  console.log(JSON.stringify({
    ok: true,
    guard: GUARD,
    token: TOKEN,
    exercise_count: result.exercise_count,
    equipment_count: result.equipment_count,
    equipment_dependency_status: result.equipment_dependency_status,
    activation_ready: result.activation_ready,
    runtime_status: result.runtime_status,
    message: "S-REG-08 exercise-equipment candidate FK closure passed."
  }, null, 2));
}

await main();