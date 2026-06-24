// @law: Registry Law
// @severity: high
// @scope: registry

/**
 * DEV NOTE: S-REG-06 guard.
 * Purpose: proves the first canonical candidate seed records are inert, small,
 * ordered, FK-declared, and outside active registry law.
 * Boundary: this guard permits only candidate seed, S-REG-06 proof, generated
 * index, and package wiring changes. It must not permit active registry,
 * registry law, bundle writer, engine runtime, equipment content, template, or
 * substitution drift.
 * Determinism: validates fixed candidate paths, fixed seed counts, fixed FK
 * closure, active compact registry state, package entrypoints, and git state.
 * Failure: emits
 * CI_S_REG_06_CANONICAL_ACTIVITY_MOVEMENT_EXERCISE_CANDIDATE_SEEDS.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const GUARD = "S-REG-06";
const TOKEN = "CI_S_REG_06_CANONICAL_ACTIVITY_MOVEMENT_EXERCISE_CANDIDATE_SEEDS";

const compactOrder = Object.freeze([
  "activity",
  "movement",
  "exercise",
  "program"
]);

const targetRegistryIds = Object.freeze([
  "activity_registry_1",
  "movement_registry_3",
  "exercise_token_registry_3b",
  "exercise_registry_3a"
]);

const candidatePaths = Object.freeze({
  activity_registry_1: "ci/registry/candidates/activity_registry_1/activity_registry_1.candidate.registry.json",
  movement_registry_3: "ci/registry/candidates/movement_registry_3/movement_registry_3.candidate.registry.json",
  exercise_token_registry_3b: "ci/registry/candidates/exercise_token_registry_3b/exercise_token_registry_3b.candidate.registry.json",
  exercise_registry_3a: "ci/registry/candidates/exercise_registry_3a/exercise_registry_3a.candidate.registry.json"
});

const files = Object.freeze({
  module: "ci/registry/s_reg_06_candidate_seed_records.mjs",
  manifest: "ci/registry/s_reg_06_candidate_seed_manifest.json",
  test: "test/s_reg_06_canonical_activity_movement_exercise_candidate_seeds.test.mjs",
  guard: "ci/guards/s_reg_06_canonical_activity_movement_exercise_candidate_seeds_guard.mjs",
  doc: "docs/roadmap/S_REG_06_CANONICAL_ACTIVITY_MOVEMENT_EXERCISE_CANDIDATE_SEEDS.md",
  sReg05Guard: "ci/guards/s_reg_05_canonical_registry_contract_candidate_surface_guard.mjs",
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
  files.sReg05Guard,
  files.packageJson,
  "ci/registry/candidates/activity_registry_1/activity_registry_1.candidate.registry.json",
  "ci/registry/candidates/movement_registry_3/movement_registry_3.candidate.registry.json",
  "ci/registry/candidates/exercise_token_registry_3b/exercise_token_registry_3b.candidate.registry.json",
  "ci/registry/candidates/exercise_registry_3a/exercise_registry_3a.candidate.registry.json",
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
  ["organisation", "runtime"].join(" ")
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
    fail("Required S-REG-06 file is missing.", { path: relativePath });
  }

  return fs.readFileSync(fullPath, "utf8");
}

function readJson(relativePath) {
  try {
    return JSON.parse(readText(relativePath));
  } catch (error) {
    fail("Required S-REG-06 JSON file is invalid.", {
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
    fail("Required S-REG-06 marker is missing.", {
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

  if (!branchName.includes("s-reg-06-canonical-activity-movement-exercise-candidate-seeds")) {
    return;
  }

  const changed = currentChangedFiles();
  const disallowed = changed.filter((relativePath) => !allowedChangedFiles.has(relativePath));

  if (disallowed.length > 0) {
    fail("S-REG-06 touched files outside the candidate seed boundary.", {
      changed_files: changed,
      disallowed_files: disallowed,
      allowed_files: [...allowedChangedFiles].sort()
    });
  }

  for (const relativePath of changed) {
    for (const prefix of forbiddenChangedPrefixes) {
      if (relativePath.startsWith(prefix)) {
        fail("S-REG-06 touched a forbidden active or runtime surface.", {
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

  for (const registryId of targetRegistryIds) {
    if (fs.existsSync(repoPath(path.join("registries", registryId)))) {
      fail("S-REG-06 must not create active canonical registry directories.", {
        registry_id: registryId,
        path: `registries/${registryId}`
      });
    }
  }
}

function assertCandidateFilesExistOnlyUnderCandidateSurface() {
  for (const [registryId, candidatePath] of Object.entries(candidatePaths)) {
    if (!fs.existsSync(repoPath(candidatePath))) {
      fail("S-REG-06 candidate seed file is missing.", {
        registry_id: registryId,
        path: candidatePath
      });
    }

    if (candidatePath !== `ci/registry/candidates/${registryId}/${registryId}.candidate.registry.json`) {
      fail("S-REG-06 candidate path does not match S-REG-05 convention.", {
        registry_id: registryId,
        path: candidatePath
      });
    }
  }
}

function assertSeedDocumentBoundary(document, registryId) {
  for (const [field, expected] of Object.entries({
    slice_id: "S-REG-06",
    registry_id: registryId,
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
      fail("S-REG-06 candidate boundary field mismatch.", {
        registry_id: registryId,
        field,
        expected,
        actual: document[field]
      });
    }
  }

  if (!Array.isArray(document.records) || document.records.length === 0) {
    fail("S-REG-06 candidate records must be a non-empty small seed array.", {
      registry_id: registryId
    });
  }
}

function assertNoForbiddenText() {
  const scannedFiles = [
    files.module,
    files.manifest,
    files.test,
    files.doc,
    ...Object.values(candidatePaths)
  ];

  const combined = scannedFiles.map((file) => readText(file)).join("\n").toLowerCase();

  for (const term of forbiddenTextTerms) {
    if (combined.includes(term.toLowerCase())) {
      fail("S-REG-06 contains forbidden claim or scope text.", { term });
    }
  }
}

async function main() {
  assertChangedFilesAllowed();
  assertActiveRegistryStillCompact();
  assertCandidateFilesExistOnlyUnderCandidateSurface();

  const manifest = readJson(files.manifest);
  assertDeepEqual(Object.keys(manifest.candidate_paths), targetRegistryIds, "S-REG-06 manifest candidate path order changed.");

  for (const registryId of targetRegistryIds) {
    const document = readJson(candidatePaths[registryId]);
    assertSeedDocumentBoundary(document, registryId);
  }

  const moduleUrl = pathToFileURL(repoPath(files.module)).href;
  const module = await import(`${moduleUrl}?cacheBust=${Date.now()}`);
  const surface = module.sReg06LoadCandidateSeedFiles();
  const result = module.sReg06ValidateCandidateSeedSurface(surface);

  if (!result.ok || result.target_registry_count !== targetRegistryIds.length) {
    fail("S-REG-06 module candidate seed validation failed.", { result });
  }

  if (result.equipment_dependency_status !== "deferred_to_s_reg_07") {
    fail("S-REG-06 equipment dependency must remain deferred to S-REG-07.", { result });
  }

  const packageText = readText(files.packageJson);
  const guardsIndexText = fs.existsSync(repoPath("docs/GUARDS_INDEX.md")) ? readText("docs/GUARDS_INDEX.md") : "";
  const docText = readText(files.doc);

  for (const marker of [
    "proof:s-reg-06",
    "node --test test/s_reg_06_canonical_activity_movement_exercise_candidate_seeds.test.mjs",
    "node ci/guards/s_reg_06_canonical_activity_movement_exercise_candidate_seeds_guard.mjs"
  ]) {
    assertIncludes(packageText, marker, "package.json");
  }

  assertIncludes(guardsIndexText, "s_reg_06_canonical_activity_movement_exercise_candidate_seeds_guard", "docs/GUARDS_INDEX.md");

  for (const marker of [
    "candidate_content_draft",
    "non_runtime",
    "deferred_to_s_reg_07",
    "S-REG-07",
    "registries/registry_index.json",
    "registries/registry_bundle.json",
    "ci/registry/candidates/<registry_id>/<registry_id>.candidate.registry.json"
  ]) {
    assertIncludes(docText, marker, files.doc);
  }

  assertNoForbiddenText();

  console.log(JSON.stringify({
    ok: true,
    guard: GUARD,
    token: TOKEN,
    activity_count: result.activity_count,
    movement_count: result.movement_count,
    exercise_token_count: result.exercise_token_count,
    exercise_count: result.exercise_count,
    equipment_dependency_status: result.equipment_dependency_status,
    message: "S-REG-06 canonical activity movement exercise candidate seeds passed."
  }, null, 2));
}

await main();