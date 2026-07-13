// @law: Repo Governance
// @severity: medium
// @scope: repo
// DEV NOTE: BETA-11 static, fixture-integrity, and compiled-runtime contract guard.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
let failed = false;

function fail(message) {
  failed = true;
  console.error(`CI_BETA_11_PHASE4_ENUMERATION::FAIL::${message}`);
}

function read(relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    fail(`missing::${relativePath}`);
    return "";
  }
  return fs.readFileSync(filePath, "utf8");
}

function fileHash(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

const source = read("engine/src/phases/beta11Phase4Enumeration.ts");
const phase3Source = read("engine/src/phases/phase3.ts");
const phase4Source = read("engine/src/phases/phase4.ts");
const testSource = read("test/beta_11_phase4_enumeration.test.mjs");
const runnerSource = read("ci/scripts/run_beta_11_phase4_enumeration_tests.mjs");
const packageSource = read("package.json");

if (!packageSource.includes("node ci/scripts/run_beta_11_phase4_enumeration_tests.mjs")) {
  fail("clean_checkout_test_runner_not_wired");
}

for (const token of [
  '["run", "build"]',
  '["--test", "test/beta_11_phase4_enumeration.test.mjs"]'
]) {
  if (!runnerSource.includes(token)) {
    fail(`clean_checkout_runner_token_missing::${token}`);
  }
}

for (const token of [
  "canonical_input_hash",
  "constraint_hash",
  "enumeration_hash",
  "enumerated_solution_space",
  "phase4_binding_mismatch",
  "empty_solution_space",
  "unknown_enum_value",
  "nondeterminism_detected"
]) {
  if (!source.includes(token)) fail(`source_token_missing::${token}`);
}

for (const forbidden of [
  "canonicalInput",
  "loadRegistry",
  "selectTemplate",
  "loadRegistryBundle",
  "beta10_constraint_prune",
  "phase3.constraints"
]) {
  if (source.includes(forbidden)) fail(`phase3_only_violation::${forbidden}`);
}

if (!phase3Source.includes("allowed_solution_space_descriptor: allowedSolutionSpaceDescriptor")) {
  fail("phase3_descriptor_missing");
}
if (!phase3Source.includes("constraint_hash: betaCanonicalHash(allowedSolutionSpaceDescriptor)")) {
  fail("phase3_constraint_hash_missing");
}

const enumerationCall = phase4Source.indexOf("assembleBeta11Phase4Program(betaPhase3)");
const registryRead = phase4Source.indexOf("const registry = loadRegistry(opts)");
if (enumerationCall < 0 || registryRead < 0 || enumerationCall > registryRead) {
  fail("enumeration_must_precede_registry_access");
}

for (const token of [
  "byte-stable enumeration",
  "empty enumeration fails deterministically",
  "unsupported enum fails deterministically",
  "canonical ordering is input-order independent",
  "enumeration hash covers the complete ordered list",
  "legacy Phase 4 call is not intercepted by BETA-11 binding fields"
]) {
  if (!testSource.includes(token)) fail(`test_missing::${token}`);
}

const fixtureRoot = path.join(root, "test", "fixtures", "beta_11_phase4");
const manifestPath = path.join(fixtureRoot, "manifest.json");

if (!fs.existsSync(manifestPath)) {
  fail("fixture_manifest_missing");
}
else {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const names = manifest.fixtures.map((entry) => entry.file).sort();
  const expected = ["general_strength.json", "powerlifting.json", "rugby_union.json"];

  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    fail("fixture_activity_set_invalid");
  }

  for (const entry of manifest.fixtures) {
    const fixturePath = path.join(fixtureRoot, entry.file);
    if (!fs.existsSync(fixturePath)) {
      fail(`fixture_missing::${entry.file}`);
      continue;
    }
    const content = fs.readFileSync(fixturePath, "utf8");
    if (fileHash(content) !== entry.sha256) {
      fail(`fixture_hash_mismatch::${entry.file}`);
    }
  }
}

if (!failed) {
  const modulePath = path.join(
    root,
    "engine",
    "dist",
    "src",
    "phases",
    "beta11Phase4Enumeration.js"
  );
  const canonicalPath = path.join(
    root,
    "engine",
    "dist",
    "src",
    "phases",
    "betaCanonical.js"
  );

  if (!fs.existsSync(modulePath) || !fs.existsSync(canonicalPath)) {
    fail("compiled_runtime_missing");
  }
  else {
    const runtime = await import(pathToFileURL(modulePath).href);
    const canonical = await import(pathToFileURL(canonicalPath).href);

    for (const fixtureName of [
      "general_strength.json",
      "powerlifting.json",
      "rugby_union.json"
    ]) {
      const phase3 = JSON.parse(fs.readFileSync(path.join(fixtureRoot, fixtureName), "utf8"));
      const first = runtime.enumerateBeta11Phase4(phase3);
      const second = runtime.enumerateBeta11Phase4(phase3);

      if (canonical.betaCanonicalJson(first) !== canonical.betaCanonicalJson(second)) {
        fail(`runtime_byte_instability::${fixtureName}`);
        continue;
      }

      if (
        first.ok !== true ||
        JSON.stringify(Object.keys(first.phase4)) !== JSON.stringify([
          "canonical_input_hash",
          "constraint_hash",
          "enumeration_hash",
          "enumerated_solution_space"
        ]) ||
        first.phase4.enumeration_hash !==
          canonical.betaCanonicalHash(first.phase4.enumerated_solution_space)
      ) {
        fail(`runtime_output_invalid::${fixtureName}`);
      }
    }

    const empty = JSON.parse(fs.readFileSync(path.join(fixtureRoot, "powerlifting.json"), "utf8"));
    empty.allowed_solution_space_descriptor.exercise_ids = [];
    empty.constraint_hash = canonical.betaCanonicalHash(empty.allowed_solution_space_descriptor);
    const emptyResult = runtime.enumerateBeta11Phase4(empty);

    if (
      JSON.stringify(emptyResult) !==
      JSON.stringify({ ok: false, failure_token: "empty_solution_space" })
    ) {
      fail("empty_solution_space_not_deterministic");
    }
  }
}

if (failed) {
  process.exitCode = 1;
}
else {
  console.log(JSON.stringify({
    ok: true,
    guard: "BETA-11",
    token: "CI_BETA_11_PHASE4_ENUMERATION",
    message: "Phase 4 enumeration contract passed."
  }));
}
