// @law: Registry Law
// @severity: high
// @scope: registry

/**
 * DEV NOTE: S-REG-05 guard.
 * Purpose: proves canonical registry contract and candidate-surface planning
 * exists without activating canonical registries or disturbing compact launch
 * registry proof.
 * Boundary: this guard must not allow active registry_index, registry_bundle,
 * registry law, engine runtime, high-volume content, or template formula drift.
 * Determinism: validates fixed manifests, module exports, package entrypoints,
 * active compact registry state, and git changed files.
 * Failure: emits CI_S_REG_05_CANONICAL_REGISTRY_CONTRACT_CANDIDATE_SURFACE.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const GUARD = "S-REG-05";
const TOKEN = "CI_S_REG_05_CANONICAL_REGISTRY_CONTRACT_CANDIDATE_SURFACE";

const compactOrder = Object.freeze([
  "activity",
  "movement",
  "exercise",
  "program"
]);

const canonicalRegistryIds = Object.freeze([
  "activity_registry_1",
  "sport_subdivision_registry_1a",
  "sport_metric_registry_1c",
  "metric_exercise_link_registry_1c_a",
  "sport_role_registry_2",
  "movement_registry_3",
  "exercise_token_registry_3b",
  "exercise_registry_3a",
  "equipment_registry",
  "exercise_activity_applicability_registry",
  "sport_program_profile_registry_5d",
  "sport_event_model_registry_5e",
  "sport_program_template_registry_5f",
  "substitution_registry"
]);

const dependencyOrder = Object.freeze([
  "activity_registry_1",
  "sport_subdivision_registry_1a",
  "sport_metric_registry_1c",
  "sport_role_registry_2",
  "movement_registry_3",
  "equipment_registry",
  "exercise_token_registry_3b",
  "exercise_registry_3a",
  "metric_exercise_link_registry_1c_a",
  "exercise_activity_applicability_registry",
  "sport_program_profile_registry_5d",
  "sport_event_model_registry_5e",
  "sport_program_template_registry_5f",
  "substitution_registry"
]);

const files = Object.freeze({
  module: "ci/registry/s_reg_05_canonical_registry_contract.mjs",
  contractManifest: "ci/registry/s_reg_05_canonical_registry_contract_manifest.json",
  dependencyManifest: "ci/registry/s_reg_05_canonical_registry_dependency_manifest.json",
  test: "test/s_reg_05_canonical_registry_contract_candidate_surface.test.mjs",
  guard: "ci/guards/s_reg_05_canonical_registry_contract_candidate_surface_guard.mjs",
  sReg04Guard: "ci/guards/s_reg_04_legacy_to_canonical_registry_loader_bridge_guard.mjs",
  doc: "docs/roadmap/S_REG_05_CANONICAL_REGISTRY_CONTRACT_CANDIDATE_SURFACE_PLAN.md",
  packageJson: "package.json",
  registryIndex: "registries/registry_index.json",
  registryBundle: "registries/registry_bundle.json"
});

const allowedChangedFiles = new Set([
  files.module,
  files.contractManifest,
  files.dependencyManifest,
  files.test,
  files.guard,
  files.sReg04Guard,
  files.doc,
  files.packageJson,
  "docs/GUARDS_INDEX.md",
  "docs/dev/FAILURE_TOKEN_INDEX.md",
  "docs/checksums.sha256"
]);

const forbiddenRuntimePrefixes = Object.freeze([
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
    fail("Required S-REG-05 file is missing.", { path: relativePath });
  }

  return fs.readFileSync(fullPath, "utf8");
}

function readJson(relativePath) {
  try {
    return JSON.parse(readText(relativePath));
  } catch (error) {
    fail("Required S-REG-05 JSON file is invalid.", {
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
    fail("Required S-REG-05 marker is missing.", {
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

function assertChangedFilesAllowed() {
  const changed = currentChangedFiles();
  const disallowed = changed.filter((relativePath) => !allowedChangedFiles.has(relativePath));

  if (disallowed.length > 0) {
    fail("S-REG-05 touched files outside the contract/candidate-surface boundary.", {
      changed_files: changed,
      disallowed_files: disallowed,
      allowed_files: [...allowedChangedFiles].sort()
    });
  }

  for (const relativePath of changed) {
    for (const prefix of forbiddenRuntimePrefixes) {
      if (relativePath.startsWith(prefix)) {
        fail("S-REG-05 touched a forbidden active/runtime surface.", {
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

  for (const canonicalRegistryId of canonicalRegistryIds) {
    if (fs.existsSync(repoPath(path.join("registries", canonicalRegistryId)))) {
      fail("S-REG-05 must not create active canonical registry directories.", {
        canonical_registry_id: canonicalRegistryId,
        path: `registries/${canonicalRegistryId}`
      });
    }
  }
}

function assertManifestShape(manifest, expectedManifestId) {
  if (manifest.slice_id !== "S-REG-05") {
    fail("S-REG-05 manifest slice_id mismatch.", { expected: "S-REG-05", actual: manifest.slice_id });
  }

  if (manifest.manifest_id !== expectedManifestId) {
    fail("S-REG-05 manifest_id mismatch.", { expected: expectedManifestId, actual: manifest.manifest_id });
  }

  if (manifest.surface_status !== "candidate_contract_only") {
    fail("S-REG-05 manifest must remain candidate_contract_only.", { actual: manifest.surface_status });
  }

  if (manifest.runtime_status !== "non_runtime") {
    fail("S-REG-05 manifest must remain non_runtime.", { actual: manifest.runtime_status });
  }
}

function assertNoForbiddenText() {
  const combined = [
    readText(files.module),
    readText(files.contractManifest),
    readText(files.dependencyManifest),
    readText(files.test),
    readText(files.guard),
    readText(files.doc)
  ].join("\n").toLowerCase();

  for (const term of forbiddenTextTerms) {
    if (combined.includes(term.toLowerCase())) {
      fail("S-REG-05 contains forbidden claim or scope text.", { term });
    }
  }
}

async function main() {
  assertChangedFilesAllowed();
  assertActiveRegistryStillCompact();

  const contractManifest = readJson(files.contractManifest);
  const dependencyManifest = readJson(files.dependencyManifest);
  const docText = readText(files.doc);
  const packageText = readText(files.packageJson);
  const guardsIndexText = fs.existsSync(repoPath("docs/GUARDS_INDEX.md")) ? readText("docs/GUARDS_INDEX.md") : "";

  assertManifestShape(contractManifest, "s_reg_05_canonical_registry_contract_manifest");
  assertManifestShape(dependencyManifest, "s_reg_05_canonical_registry_dependency_manifest");

  assertDeepEqual(contractManifest.active_compact_registry_ids, compactOrder, "S-REG-05 compact registry declaration changed.");
  assertDeepEqual(contractManifest.canonical_registry_ids, canonicalRegistryIds, "S-REG-05 canonical registry id list changed.");
  assertDeepEqual(dependencyManifest.dependency_order, dependencyOrder, "S-REG-05 dependency order changed.");

  for (const registryId of canonicalRegistryIds) {
    assertIncludes(docText, registryId, files.doc);
    assertIncludes(readText(files.module), registryId, files.module);
  }

  for (const marker of [
    "candidate_contract_only",
    "non_runtime",
    "active_registry_mutation: false",
    "active_bundle_mutation: false",
    "registry_law_mutation: false",
    "engine_runtime_mutation: false",
    "high_volume_content_added: false",
    "ci/registry/candidates",
    "registries/<registry_id>/<registry_id>.registry.json",
    "Do not add full registry content.",
    "Do not activate canonical registries."
  ]) {
    assertIncludes(docText, marker, files.doc);
  }

  assertIncludes(packageText, "proof:s-reg-05", "package.json");
  assertIncludes(packageText, "node --test test/s_reg_05_canonical_registry_contract_candidate_surface.test.mjs", "package.json");
  assertIncludes(packageText, "node ci/guards/s_reg_05_canonical_registry_contract_candidate_surface_guard.mjs", "package.json");
  assertIncludes(guardsIndexText, "s_reg_05_canonical_registry_contract_candidate_surface_guard", "docs/GUARDS_INDEX.md");

  const moduleUrl = pathToFileURL(repoPath(files.module)).href;
  const module = await import(`${moduleUrl}?cacheBust=${Date.now()}`);
  const contract = module.sReg05CanonicalRegistryContract();
  const validation = module.sReg05ValidateCandidateContract(contract);

  if (!validation.ok || validation.canonical_registry_count !== canonicalRegistryIds.length) {
    fail("S-REG-05 module contract validation failed.", { validation });
  }

  assertNoForbiddenText();

  console.log(JSON.stringify({
    ok: true,
    guard: GUARD,
    token: TOKEN,
    canonical_registry_count: canonicalRegistryIds.length,
    dependency_count: dependencyOrder.length,
    message: "S-REG-05 canonical registry contract candidate surface passed."
  }, null, 2));
}

await main();