// @law: Registry Law
// @severity: high
// @scope: registry

/**
 * DEV NOTE: S-REG-11 guard.
 * Purpose: proves inert sport metric candidate seeds exist, FK-close against
 * activity and sport subdivision candidates, and remain outside active registry
 * law.
 * Boundary: permits only S-REG-11 metric candidate files, proof files,
 * documentation, package wiring, and generated indexes/checksums. It must not
 * permit active registry, registry law, bundle writer, engine runtime,
 * metric-exercise-link, threshold marker, marker evaluator, programme template,
 * substitution, marketplace, organisation, unit, federation, team, or tactical
 * runtime scope.
 * Determinism: validates fixed candidate paths, fixed record counts, active
 * compact registry state, package entrypoints, guard index, and git state.
 * Failure: emits CI_S_REG_11_SPORT_METRIC_CANDIDATE_SEEDS.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const GUARD = "S-REG-11";
const TOKEN = "CI_S_REG_11_SPORT_METRIC_CANDIDATE_SEEDS";

const compactOrder = Object.freeze([
  "activity",
  "movement",
  "exercise",
  "program"
]);

const files = Object.freeze({
  module: "ci/registry/s_reg_11_sport_metric_candidate_seeds.mjs",
  manifest: "ci/registry/s_reg_11_sport_metric_candidate_manifest.json",
  test: "test/s_reg_11_sport_metric_candidate_seeds.test.mjs",
  guard: "ci/guards/s_reg_11_sport_metric_candidate_seeds_guard.mjs",
  doc: "docs/roadmap/S_REG_11_SPORT_METRIC_CANDIDATE_SEEDS.md",
  metricCandidate: "ci/registry/candidates/sport_metric_registry_1c/sport_metric_registry_1c.candidate.registry.json",
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
  files.metricCandidate,
  files.packageJson,
  "docs/GUARDS_INDEX.md",
  "docs/dev/FAILURE_TOKEN_INDEX.md",
  "docs/checksums.sha256"
]);

const forbiddenChangedFiles = new Set([
  "ci/registry/candidates/metric_exercise_link_registry_1c_a/metric_exercise_link_registry_1c_a.candidate.registry.json",
  "ci/registry/candidates/threshold_marker_registry/threshold_marker_registry.candidate.registry.json"
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

const forbiddenCandidateTextTerms = Object.freeze([
  "exercise_id",
  "exercise_ids",
  "threshold_id",
  "threshold_marker_id",
  "marker_status",
  "marker_evaluator",
  "selection_score",
  "ranking_score",
  "recommendation_score",
  "optimisation_score",
  "optimization_score",
  "capability_score",
  "readiness_score",
  "safety_rating",
  "suitability_rating",
  "return_to_play_status",
  "tactical_status",
  "outcome_score"
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
    fail("Required S-REG-11 file is missing.", { path: relativePath });
  }

  return fs.readFileSync(fullPath, "utf8");
}

function readJson(relativePath) {
  try {
    return JSON.parse(readText(relativePath));
  } catch (error) {
    fail("Required S-REG-11 JSON file is invalid.", {
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
    fail("Required S-REG-11 marker is missing.", {
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

  if (!branchName.includes("s-reg-11-sport-metric-candidate-seeds")) {
    return;
  }

  const changed = currentChangedFiles();
  const disallowed = changed.filter((relativePath) => !allowedChangedFiles.has(relativePath));

  if (disallowed.length > 0) {
    fail("S-REG-11 touched files outside the sport metric candidate seed boundary.", {
      changed_files: changed,
      disallowed_files: disallowed,
      allowed_files: [...allowedChangedFiles].sort()
    });
  }

  for (const relativePath of changed) {
    if (forbiddenChangedFiles.has(relativePath)) {
      fail("S-REG-11 touched a metric-link or threshold-marker candidate surface.", { path: relativePath });
    }

    for (const prefix of forbiddenChangedPrefixes) {
      if (relativePath.startsWith(prefix)) {
        fail("S-REG-11 touched a forbidden active or runtime surface.", {
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
    "sport_metric_registry_1c",
    "metric_exercise_link_registry_1c_a",
    "threshold_marker_registry",
    "sport_subdivision_registry_1a",
    "sport_role_registry_2"
  ]) {
    if (fs.existsSync(repoPath(`registries/${registryId}`))) {
      fail("S-REG-11 must not create active canonical sport metric, metric-link, threshold-marker, or sport context registry directories.", {
        registry_id: registryId
      });
    }
  }
}

function assertCandidateBoundary() {
  const document = readJson(files.metricCandidate);

  for (const [field, expected] of Object.entries({
    slice_id: "S-REG-11",
    registry_id: "sport_metric_registry_1c",
    candidate_status: "candidate_content_draft",
    runtime_status: "non_runtime",
    active_registry_mutation: false,
    active_bundle_mutation: false,
    registry_law_mutation: false,
    engine_runtime_mutation: false,
    high_volume_content_added: false,
    activation_ready: false,
    complete_registry_claim: false,
    sport_metric_seed_status: "candidate_fk_ready"
  })) {
    if (document[field] !== expected) {
      fail("S-REG-11 candidate boundary field mismatch.", {
        field,
        expected,
        actual: document[field]
      });
    }
  }

  if (document.records.length !== 6) {
    fail("S-REG-11 candidate record count must remain fixed.", {
      sport_metric_count: document.records.length
    });
  }
}

function assertNoForbiddenCandidateText() {
  const combined = readText(files.metricCandidate).toLowerCase();

  for (const term of forbiddenCandidateTextTerms) {
    if (combined.includes(term.toLowerCase())) {
      fail("S-REG-11 candidate data contains forbidden link, threshold, marker, claim, or decision text.", { term });
    }
  }
}

async function main() {
  assertChangedFilesAllowed();
  assertActiveRegistryStillCompact();
  assertCandidateBoundary();

  const moduleUrl = pathToFileURL(repoPath(files.module)).href;
  const module = await import(`${moduleUrl}?cacheBust=${Date.now()}`);
  const result = module.sReg11ValidateSportMetricCandidateSeeds();

  if (!result.ok || result.sport_metric_count !== 6 || result.activity_count !== 3 || result.subdivision_count !== 4) {
    fail("S-REG-11 module validation failed.", { result });
  }

  if (result.activation_ready !== false || result.runtime_status !== "non_runtime") {
    fail("S-REG-11 result must remain non-runtime and not activation-ready.", { result });
  }

  const manifest = readJson(files.manifest);
  assertDeepEqual(
    Object.keys(manifest.candidate_paths),
    ["sport_metric_registry_1c"],
    "S-REG-11 manifest candidate path order changed."
  );

  const packageText = readText(files.packageJson);
  const guardsIndexText = fs.existsSync(repoPath("docs/GUARDS_INDEX.md")) ? readText("docs/GUARDS_INDEX.md") : "";
  const docText = readText(files.doc);

  for (const marker of [
    "proof:s-reg-11",
    "node --test test/s_reg_11_sport_metric_candidate_seeds.test.mjs",
    "node ci/guards/s_reg_11_sport_metric_candidate_seeds_guard.mjs"
  ]) {
    assertIncludes(packageText, marker, "package.json");
  }

  assertIncludes(guardsIndexText, "s_reg_11_sport_metric_candidate_seeds_guard", "docs/GUARDS_INDEX.md");

  for (const marker of [
    "sport_metric_registry_1c",
    "candidate_fk_ready",
    "non_runtime",
    "S-REG-12",
    "metric_exercise_link_registry_1c_a",
    "threshold_marker_registry",
    "registries/registry_index.json",
    "registries/registry_bundle.json"
  ]) {
    assertIncludes(docText, marker, files.doc);
  }

  assertNoForbiddenCandidateText();

  console.log(JSON.stringify({
    ok: true,
    guard: GUARD,
    token: TOKEN,
    sport_metric_count: result.sport_metric_count,
    activity_count: result.activity_count,
    subdivision_count: result.subdivision_count,
    runtime_status: result.runtime_status,
    activation_ready: result.activation_ready,
    message: "S-REG-11 sport metric candidate seeds passed."
  }, null, 2));
}

await main();