// @law: Registry Law
// @severity: high
// @scope: registry

/**
 * DEV NOTE: S-REG-09 guard.
 * Purpose: proves inert exercise-activity applicability candidate seeds exist,
 * FK-close against S-REG-06 exercise/activity candidates, and remain outside
 * active registry law.
 * Boundary: permits only S-REG-09 candidate applicability files, proof files,
 * documentation, package wiring, and generated indexes/checksums. It must not
 * permit active registry, registry law, bundle writer, engine runtime,
 * programme template, substitution, marketplace, organisation, or team scope.
 * Determinism: validates fixed candidate path, fixed record count, active
 * compact registry state, package entrypoints, guard index, and git state.
 * Failure: emits
 * CI_S_REG_09_EXERCISE_ACTIVITY_APPLICABILITY_CANDIDATE_SEEDS.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const GUARD = "S-REG-09";
const TOKEN = "CI_S_REG_09_EXERCISE_ACTIVITY_APPLICABILITY_CANDIDATE_SEEDS";

const compactOrder = Object.freeze([
  "activity",
  "movement",
  "exercise",
  "program"
]);

const files = Object.freeze({
  module: "ci/registry/s_reg_09_exercise_activity_applicability_candidate_seeds.mjs",
  manifest: "ci/registry/s_reg_09_exercise_activity_applicability_candidate_manifest.json",
  test: "test/s_reg_09_exercise_activity_applicability_candidate_seeds.test.mjs",
  guard: "ci/guards/s_reg_09_exercise_activity_applicability_candidate_seeds_guard.mjs",
  doc: "docs/roadmap/S_REG_09_EXERCISE_ACTIVITY_APPLICABILITY_CANDIDATE_SEEDS.md",
  applicabilityCandidate: "ci/registry/candidates/exercise_activity_applicability_registry/exercise_activity_applicability_registry.candidate.registry.json",
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
  files.applicabilityCandidate,
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
  ["optimization", "engine"].join(" "),
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
    fail("Required S-REG-09 file is missing.", { path: relativePath });
  }

  return fs.readFileSync(fullPath, "utf8");
}

function readJson(relativePath) {
  try {
    return JSON.parse(readText(relativePath));
  } catch (error) {
    fail("Required S-REG-09 JSON file is invalid.", {
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
    fail("Required S-REG-09 marker is missing.", {
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

  if (!branchName.includes("s-reg-09-exercise-activity-applicability-candidate-seeds")) {
    return;
  }

  const changed = currentChangedFiles();
  const disallowed = changed.filter((relativePath) => !allowedChangedFiles.has(relativePath));

  if (disallowed.length > 0) {
    fail("S-REG-09 touched files outside the exercise activity applicability candidate seed boundary.", {
      changed_files: changed,
      disallowed_files: disallowed,
      allowed_files: [...allowedChangedFiles].sort()
    });
  }

  for (const relativePath of changed) {
    for (const prefix of forbiddenChangedPrefixes) {
      if (relativePath.startsWith(prefix)) {
        fail("S-REG-09 touched a forbidden active or runtime surface.", {
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

  if (fs.existsSync(repoPath("registries/exercise_activity_applicability_registry"))) {
    fail("S-REG-09 must not create active canonical applicability registry directories.");
  }
}

function assertCandidateBoundary() {
  const document = readJson(files.applicabilityCandidate);

  for (const [field, expected] of Object.entries({
    slice_id: "S-REG-09",
    registry_id: "exercise_activity_applicability_registry",
    candidate_status: "candidate_content_draft",
    runtime_status: "non_runtime",
    active_registry_mutation: false,
    active_bundle_mutation: false,
    registry_law_mutation: false,
    engine_runtime_mutation: false,
    high_volume_content_added: false,
    activation_ready: false,
    complete_registry_claim: false,
    applicability_seed_status: "candidate_fk_ready"
  })) {
    if (document[field] !== expected) {
      fail("S-REG-09 applicability candidate boundary field mismatch.", {
        field,
        expected,
        actual: document[field]
      });
    }
  }

  if (!Array.isArray(document.records) || document.records.length !== 12) {
    fail("S-REG-09 applicability candidate records must be the fixed 12-record seed set.", {
      actual: Array.isArray(document.records) ? document.records.length : null
    });
  }
}

function assertNoForbiddenText() {
  const scannedFiles = [
    files.module,
    files.manifest,
    files.test,
    files.doc,
    files.applicabilityCandidate
  ];

  const combined = scannedFiles.map((file) => readText(file)).join("\n").toLowerCase();

  for (const term of forbiddenTextTerms) {
    if (combined.includes(term.toLowerCase())) {
      fail("S-REG-09 contains forbidden claim or scope text.", { term });
    }
  }
}

async function main() {
  assertChangedFilesAllowed();
  assertActiveRegistryStillCompact();
  assertCandidateBoundary();

  const moduleUrl = pathToFileURL(repoPath(files.module)).href;
  const module = await import(`${moduleUrl}?cacheBust=${Date.now()}`);
  const result = module.sReg09ValidateExerciseActivityApplicabilityCandidateSeeds();

  if (!result.ok || result.registry_id !== "exercise_activity_applicability_registry") {
    fail("S-REG-09 module validation failed.", { result });
  }

  if (result.applicability_count !== 12 || result.exercise_count !== 4 || result.activity_count !== 3) {
    fail("S-REG-09 result count mismatch.", { result });
  }

  if (result.activation_ready !== false || result.runtime_status !== "non_runtime") {
    fail("S-REG-09 result must remain non-runtime and not activation-ready.", { result });
  }

  const manifest = readJson(files.manifest);
  assertDeepEqual(
    Object.keys(manifest.candidate_paths),
    ["exercise_activity_applicability_registry"],
    "S-REG-09 manifest candidate path order changed."
  );

  const packageText = readText(files.packageJson);
  const guardsIndexText = fs.existsSync(repoPath("docs/GUARDS_INDEX.md")) ? readText("docs/GUARDS_INDEX.md") : "";
  const docText = readText(files.doc);

  for (const marker of [
    "proof:s-reg-09",
    "node --test test/s_reg_09_exercise_activity_applicability_candidate_seeds.test.mjs",
    "node ci/guards/s_reg_09_exercise_activity_applicability_candidate_seeds_guard.mjs"
  ]) {
    assertIncludes(packageText, marker, "package.json");
  }

  assertIncludes(guardsIndexText, "s_reg_09_exercise_activity_applicability_candidate_seeds_guard", "docs/GUARDS_INDEX.md");

  for (const marker of [
    "exercise_activity_applicability_registry",
    "candidate_fk_ready",
    "non_runtime",
    "S-REG-10",
    "sport_subdivision_registry_1a",
    "registries/registry_index.json",
    "registries/registry_bundle.json",
    "ci/registry/candidates/exercise_activity_applicability_registry/exercise_activity_applicability_registry.candidate.registry.json"
  ]) {
    assertIncludes(docText, marker, files.doc);
  }

  assertNoForbiddenText();

  console.log(JSON.stringify({
    ok: true,
    guard: GUARD,
    token: TOKEN,
    applicability_count: result.applicability_count,
    exercise_count: result.exercise_count,
    activity_count: result.activity_count,
    activity_context: result.activity_context,
    runtime_status: result.runtime_status,
    activation_ready: result.activation_ready,
    message: "S-REG-09 exercise activity applicability candidate seeds passed."
  }, null, 2));
}

await main();