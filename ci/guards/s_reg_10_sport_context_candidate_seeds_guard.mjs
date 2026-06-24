// @law: Registry Law
// @severity: high
// @scope: registry

/**
 * DEV NOTE: S-REG-10 guard.
 * Purpose: proves inert sport subdivision and sport role candidate seeds exist,
 * FK-close against activity candidates, and remain outside active registry law.
 * Boundary: permits only S-REG-10 candidate sport context files, proof files,
 * documentation, package wiring, and generated indexes/checksums. It must not
 * permit active registry, registry law, bundle writer, engine runtime, sport
 * metric, threshold marker, programme template, substitution, marketplace,
 * organisation, unit, federation, or team scope.
 * Determinism: validates fixed candidate paths, fixed record counts, active
 * compact registry state, package entrypoints, guard index, and git state.
 * Failure: emits CI_S_REG_10_SPORT_CONTEXT_CANDIDATE_SEEDS.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const GUARD = "S-REG-10";
const TOKEN = "CI_S_REG_10_SPORT_CONTEXT_CANDIDATE_SEEDS";

const compactOrder = Object.freeze([
  "activity",
  "movement",
  "exercise",
  "program"
]);

const files = Object.freeze({
  module: "ci/registry/s_reg_10_sport_context_candidate_seeds.mjs",
  manifest: "ci/registry/s_reg_10_sport_context_candidate_manifest.json",
  test: "test/s_reg_10_sport_context_candidate_seeds.test.mjs",
  guard: "ci/guards/s_reg_10_sport_context_candidate_seeds_guard.mjs",
  doc: "docs/roadmap/S_REG_10_SPORT_CONTEXT_CANDIDATE_SEEDS.md",
  subdivisionCandidate: "ci/registry/candidates/sport_subdivision_registry_1a/sport_subdivision_registry_1a.candidate.registry.json",
  roleCandidate: "ci/registry/candidates/sport_role_registry_2/sport_role_registry_2.candidate.registry.json",
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
  files.subdivisionCandidate,
  files.roleCandidate,
  files.packageJson,
  "docs/GUARDS_INDEX.md",
  "docs/dev/FAILURE_TOKEN_INDEX.md",
  "docs/checksums.sha256"
]);

const forbiddenChangedFiles = new Set([
  "ci/registry/candidates/sport_metric_registry_1c/sport_metric_registry_1c.candidate.registry.json",
  "ci/registry/candidates/metric_exercise_link_registry_1c_a/metric_exercise_link_registry_1c_a.candidate.registry.json"
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
  "metric_id",
  "threshold_id",
  "selection_score",
  "ranking_score",
  "recommendation_score",
  "optimisation_score",
  "optimization_score",
  "capability_score",
  "readiness_score",
  "safety_rating",
  "performance_score",
  "return_to_play_status"
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
    fail("Required S-REG-10 file is missing.", { path: relativePath });
  }

  return fs.readFileSync(fullPath, "utf8");
}

function readJson(relativePath) {
  try {
    return JSON.parse(readText(relativePath));
  } catch (error) {
    fail("Required S-REG-10 JSON file is invalid.", {
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
    fail("Required S-REG-10 marker is missing.", {
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

  if (!branchName.includes("s-reg-10-sport-context-candidate-seeds")) {
    return;
  }

  const changed = currentChangedFiles();
  const disallowed = changed.filter((relativePath) => !allowedChangedFiles.has(relativePath));

  if (disallowed.length > 0) {
    fail("S-REG-10 touched files outside the sport context candidate seed boundary.", {
      changed_files: changed,
      disallowed_files: disallowed,
      allowed_files: [...allowedChangedFiles].sort()
    });
  }

  for (const relativePath of changed) {
    if (forbiddenChangedFiles.has(relativePath)) {
      fail("S-REG-10 touched a metric-adjacent candidate surface.", { path: relativePath });
    }

    for (const prefix of forbiddenChangedPrefixes) {
      if (relativePath.startsWith(prefix)) {
        fail("S-REG-10 touched a forbidden active or runtime surface.", {
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
    "sport_subdivision_registry_1a",
    "sport_role_registry_2",
    "sport_metric_registry_1c",
    "metric_exercise_link_registry_1c_a"
  ]) {
    if (fs.existsSync(repoPath(`registries/${registryId}`))) {
      fail("S-REG-10 must not create active canonical sport context or metric registry directories.", {
        registry_id: registryId
      });
    }
  }
}

function assertCandidateBoundary() {
  const subdivisionDocument = readJson(files.subdivisionCandidate);
  const roleDocument = readJson(files.roleCandidate);

  for (const document of [subdivisionDocument, roleDocument]) {
    for (const [field, expected] of Object.entries({
      slice_id: "S-REG-10",
      candidate_status: "candidate_content_draft",
      runtime_status: "non_runtime",
      active_registry_mutation: false,
      active_bundle_mutation: false,
      registry_law_mutation: false,
      engine_runtime_mutation: false,
      high_volume_content_added: false,
      activation_ready: false,
      complete_registry_claim: false,
      sport_context_seed_status: "candidate_fk_ready"
    })) {
      if (document[field] !== expected) {
        fail("S-REG-10 candidate boundary field mismatch.", {
          registry_id: document.registry_id ?? null,
          field,
          expected,
          actual: document[field]
        });
      }
    }
  }

  if (subdivisionDocument.records.length !== 4 || roleDocument.records.length !== 3) {
    fail("S-REG-10 candidate record counts must remain fixed.", {
      subdivision_count: subdivisionDocument.records.length,
      role_count: roleDocument.records.length
    });
  }
}

function assertNoForbiddenText() {
  // DEV NOTE: The validation module and tests intentionally contain forbidden
  // field names such as metric_id to prove rejection. This text scan is limited
  // to candidate data files, where those fields must never appear as records.
  const scannedFiles = [
    files.subdivisionCandidate,
    files.roleCandidate
  ];

  const combined = scannedFiles.map((file) => readText(file)).join("\n").toLowerCase();

  for (const term of forbiddenTextTerms) {
    if (combined.includes(term.toLowerCase())) {
      fail("S-REG-10 candidate data contains forbidden metric, threshold, claim, or decision text.", { term });
    }
  }
}

async function main() {
  assertChangedFilesAllowed();
  assertActiveRegistryStillCompact();
  assertCandidateBoundary();

  const moduleUrl = pathToFileURL(repoPath(files.module)).href;
  const module = await import(`${moduleUrl}?cacheBust=${Date.now()}`);
  const result = module.sReg10ValidateSportContextCandidateSeeds();

  if (!result.ok || result.subdivision_count !== 4 || result.role_count !== 3 || result.activity_count !== 3) {
    fail("S-REG-10 module validation failed.", { result });
  }

  if (result.activation_ready !== false || result.runtime_status !== "non_runtime") {
    fail("S-REG-10 result must remain non-runtime and not activation-ready.", { result });
  }

  const manifest = readJson(files.manifest);
  assertDeepEqual(
    Object.keys(manifest.candidate_paths),
    ["sport_subdivision_registry_1a", "sport_role_registry_2"],
    "S-REG-10 manifest candidate path order changed."
  );

  const packageText = readText(files.packageJson);
  const guardsIndexText = fs.existsSync(repoPath("docs/GUARDS_INDEX.md")) ? readText("docs/GUARDS_INDEX.md") : "";
  const docText = readText(files.doc);

  for (const marker of [
    "proof:s-reg-10",
    "node --test test/s_reg_10_sport_context_candidate_seeds.test.mjs",
    "node ci/guards/s_reg_10_sport_context_candidate_seeds_guard.mjs"
  ]) {
    assertIncludes(packageText, marker, "package.json");
  }

  assertIncludes(guardsIndexText, "s_reg_10_sport_context_candidate_seeds_guard", "docs/GUARDS_INDEX.md");

  for (const marker of [
    "sport_subdivision_registry_1a",
    "sport_role_registry_2",
    "candidate_fk_ready",
    "non_runtime",
    "S-REG-11",
    "sport_metric_registry_1c",
    "registries/registry_index.json",
    "registries/registry_bundle.json"
  ]) {
    assertIncludes(docText, marker, files.doc);
  }

  assertNoForbiddenText();

  console.log(JSON.stringify({
    ok: true,
    guard: GUARD,
    token: TOKEN,
    subdivision_count: result.subdivision_count,
    role_count: result.role_count,
    activity_count: result.activity_count,
    runtime_status: result.runtime_status,
    activation_ready: result.activation_ready,
    message: "S-REG-10 sport context candidate seeds passed."
  }, null, 2));
}

await main();