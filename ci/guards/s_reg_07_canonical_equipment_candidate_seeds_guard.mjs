// @law: Registry Law
// @severity: high
// @scope: registry

/**
 * DEV NOTE: S-REG-07 guard.
 * Purpose: proves the first canonical equipment candidate seed records are
 * inert, small, FK-declared, and outside active registry law.
 * Boundary: this guard permits only S-REG-07 equipment candidate seed, proof,
 * documentation, generated index, checksum, and package wiring changes. It must
 * not permit active registry, registry law, bundle writer, engine runtime,
 * programme template, substitution, or S-REG-06 exercise mutation drift.
 * Determinism: validates fixed candidate path, fixed record count, FK closure
 * against S-REG-06 candidates, package entrypoints, active compact registry
 * state, and git state.
 * Failure: emits CI_S_REG_07_CANONICAL_EQUIPMENT_CANDIDATE_SEEDS.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const GUARD = "S-REG-07";
const TOKEN = "CI_S_REG_07_CANONICAL_EQUIPMENT_CANDIDATE_SEEDS";

const compactOrder = Object.freeze([
  "activity",
  "movement",
  "exercise",
  "program"
]);

const candidatePath = "ci/registry/candidates/equipment_registry/equipment_registry.candidate.registry.json";

const files = Object.freeze({
  module: "ci/registry/s_reg_07_equipment_candidate_seed_records.mjs",
  manifest: "ci/registry/s_reg_07_equipment_candidate_seed_manifest.json",
  test: "test/s_reg_07_canonical_equipment_candidate_seeds.test.mjs",
  guard: "ci/guards/s_reg_07_canonical_equipment_candidate_seeds_guard.mjs",
  doc: "docs/roadmap/S_REG_07_CANONICAL_EQUIPMENT_CANDIDATE_SEEDS.md",
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
  candidatePath,
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
    fail("Required S-REG-07 file is missing.", { path: relativePath });
  }

  return fs.readFileSync(fullPath, "utf8");
}

function readJson(relativePath) {
  try {
    return JSON.parse(readText(relativePath));
  } catch (error) {
    fail("Required S-REG-07 JSON file is invalid.", {
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
    fail("Required S-REG-07 marker is missing.", {
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

  if (!branchName.includes("s-reg-07-canonical-equipment-candidate-seeds")) {
    return;
  }

  const changed = currentChangedFiles();
  const disallowed = changed.filter((relativePath) => !allowedChangedFiles.has(relativePath));

  if (disallowed.length > 0) {
    fail("S-REG-07 touched files outside the equipment candidate seed boundary.", {
      changed_files: changed,
      disallowed_files: disallowed,
      allowed_files: [...allowedChangedFiles].sort()
    });
  }

  for (const relativePath of changed) {
    for (const prefix of forbiddenChangedPrefixes) {
      if (relativePath.startsWith(prefix)) {
        fail("S-REG-07 touched a forbidden active or runtime surface.", {
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
    compactOrder, "Active registry index order changed.");

  if (!registryBundle.registries || typeof registryBundle.registries !== "object" || Array.isArray(registryBundle.registries)) {
    fail("Active registry bundle must expose a registries object.");
  }

  assertDeepEqual(
    Object.keys(registryBundle.registries).slice(0, compactOrder.length),
    compactOrder, "Active registry bundle keys changed.");

  if (fs.existsSync(repoPath("registries/equipment_registry"))) {
    fail("S-REG-07 must not create an active canonical equipment registry directory.");
  }
}

function assertCandidateFileExistsOnlyUnderCandidateSurface() {
  if (!fs.existsSync(repoPath(candidatePath))) {
    fail("S-REG-07 equipment candidate seed file is missing.", {
      path: candidatePath
    });
  }
}

function assertEquipmentDocumentBoundary(document) {
  for (const [field, expected] of Object.entries({
    slice_id: "S-REG-07",
    registry_id: "equipment_registry",
    candidate_status: "candidate_content_draft",
    runtime_status: "non_runtime",
    active_registry_mutation: false,
    active_bundle_mutation: false,
    registry_law_mutation: false,
    engine_runtime_mutation: false,
    high_volume_content_added: false,
    activation_ready: false,
    complete_registry_claim: false
  })) {
    if (document[field] !== expected) {
      fail("S-REG-07 equipment candidate boundary field mismatch.", {
        field,
        expected,
        actual: document[field]
      });
    }
  }

  assertDeepEqual(document.depends_on, ["activity_registry_1", "movement_registry_3"], "S-REG-07 equipment candidate dependency order changed.");

  if (!Array.isArray(document.records) || document.records.length === 0) {
    fail("S-REG-07 equipment candidate records must be a non-empty small seed array.");
  }

  if (document.records.length > 6) {
    fail("S-REG-07 equipment candidate seed set exceeded the allowed small seed count.", {
      actual: document.records.length,
      maximum: 6
    });
  }
}

function assertNoForbiddenText() {
  const scannedFiles = [
    files.module,
    files.manifest,
    files.test,
    files.doc,
    candidatePath
  ];

  const combined = scannedFiles.map((file) => readText(file)).join("\n").toLowerCase();

  for (const term of forbiddenTextTerms) {
    if (combined.includes(term.toLowerCase())) {
      fail("S-REG-07 contains forbidden claim or scope text.", { term });
    }
  }
}

async function main() {
  assertChangedFilesAllowed();
  assertActiveRegistryStillCompact();
  assertCandidateFileExistsOnlyUnderCandidateSurface();

  const manifest = readJson(files.manifest);
  assertDeepEqual(Object.keys(manifest.candidate_paths), ["equipment_registry"], "S-REG-07 manifest candidate path order changed.");

  const equipmentDocument = readJson(candidatePath);
  assertEquipmentDocumentBoundary(equipmentDocument);

  const moduleUrl = pathToFileURL(repoPath(files.module)).href;
  const module = await import(`${moduleUrl}?cacheBust=${Date.now()}`);
  const result = module.sReg07ValidateEquipmentCandidateSeedSurface({ equipmentDocument });

  if (!result.ok || result.registry_id !== "equipment_registry") {
    fail("S-REG-07 module equipment candidate seed validation failed.", { result });
  }

  if (result.equipment_count !== 6) {
    fail("S-REG-07 expected exactly 6 equipment seed records.", { result });
  }

  if (!["deferred_to_s_reg_07", "candidate_equipment_fk_closed"].includes(result.s_reg_06_exercise_dependency_status)) {
    fail("S-REG-07 saw an unsupported S-REG-06 exercise dependency status.", { result });
  }

  if (result.s_reg_08_dependency !== "exercise_equipment_fk_closure") {
    fail("S-REG-07 must declare S-REG-08 as the exercise-equipment FK closure dependency.", { result });
  }

  const packageText = readText(files.packageJson);
  const guardsIndexText = fs.existsSync(repoPath("docs/GUARDS_INDEX.md")) ? readText("docs/GUARDS_INDEX.md") : "";
  const docText = readText(files.doc);

  for (const marker of [
    "proof:s-reg-07",
    "node --test test/s_reg_07_canonical_equipment_candidate_seeds.test.mjs",
    "node ci/guards/s_reg_07_canonical_equipment_candidate_seeds_guard.mjs"
  ]) {
    assertIncludes(packageText, marker, "package.json");
  }

  assertIncludes(guardsIndexText, "s_reg_07_canonical_equipment_candidate_seeds_guard", "docs/GUARDS_INDEX.md");

  for (const marker of [
    "candidate_content_draft",
    "non_runtime",
    "S-REG-08",
    "exercise_equipment_fk_closure",
    "registries/registry_index.json",
    "registries/registry_bundle.json",
    "ci/registry/candidates/equipment_registry/equipment_registry.candidate.registry.json"
  ]) {
    assertIncludes(docText, marker, files.doc);
  }

  assertNoForbiddenText();

  console.log(JSON.stringify({
    ok: true,
    guard: GUARD,
    token: TOKEN,
    equipment_count: result.equipment_count,
    required_seed_equipment_count: result.required_seed_equipment_count,
    upstream_activity_count: result.upstream_activity_count,
    upstream_movement_count: result.upstream_movement_count,
    s_reg_06_exercise_dependency_status: result.s_reg_06_exercise_dependency_status,
    s_reg_08_dependency: result.s_reg_08_dependency,
    message: "S-REG-07 canonical equipment candidate seeds passed."
  }, null, 2));
}

await main();