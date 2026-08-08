// @law: Registry Law
// @severity: high
// @scope: registry
/**
 * DEV NOTE: S-REG-32 guard.
 * Purpose: proves the exercise registry's schema extension
 * (primary_activity_applicability/secondary_activity_applicability) is
 * genuinely correct for all 19 live entries against the pattern -> activity
 * derivation rule, and that this slice does not claim S-REG-23/24's
 * activation authority (no new registry domain becomes active).
 * Boundary: permits only the exact mutation surface this slice needs - the
 * extended exercise registry file (content only, not a new file), the 3
 * exercise schema files, the regenerated bundle, the seal snapshot hash,
 * this slice's own scaffolding, and package/generated-index wiring. It must
 * not permit any change under engine/, src/, server/, app/, web/,
 * shared/pilot-lifecycle/, or shared/v1-boundary/, nor any change to
 * registry_index.json's order[] or any candidate domain's activation.
 * Failure: emits CI_S_REG_32_EXERCISE_ACTIVITY_APPLICABILITY_SCHEMA_EXTENSION.
 */

import fs from "node:fs";
import { execFileSync } from "node:child_process";

import {
  S_REG_32_FAILURE_TOKEN,
  S_REG_32_RUNTIME_STATUS,
  sReg32LoadExerciseActivityApplicabilitySchemaExtension,
  sReg32ValidateExerciseActivityApplicabilitySchemaExtension
} from "../registry/s_reg_32_exercise_activity_applicability_schema_extension.mjs";

const repoRoot = process.cwd();
const GUARD = "S-REG-32";
const TOKEN = S_REG_32_FAILURE_TOKEN;

const allowedChangedFiles = new Set([
  "ci/registry/s_reg_32_exercise_activity_applicability_schema_extension.mjs",
  "ci/registry/s_reg_32_exercise_activity_applicability_schema_extension.json",
  "test/s_reg_32_exercise_activity_applicability_schema_extension.test.mjs",
  "ci/guards/s_reg_32_exercise_activity_applicability_schema_extension_guard.mjs",
  "docs/roadmap/S_REG_32_EXERCISE_ACTIVITY_APPLICABILITY_SCHEMA_EXTENSION.md",
  "registries/exercise/exercise.registry.json",
  "ci/schemas/exercise.registry.schema.json",
  "ci/schemas/exercise.registry.schema.v1.0.0.json",
  "ci/schemas/exercise_registry.schema.json",
  "registries/registry_bundle.json",
  "ci/evidence/registry_seal_lifecycle.v1.json",
  "ci/evidence/registry_seal_manifest.v1.json",
  "ci/evidence/registry_seal_live_surface.v1.json",
  "ci/evidence/registry_seal_snapshot.v1.json",
  "ci/evidence/evidence_envelope.v1.json",
  "ci/evidence/evidence_seal.v1.json",
  "package.json",
  "docs/GUARDS_INDEX.md",
  "docs/dev/FAILURE_TOKEN_INDEX.md",
  "docs/checksums.sha256"
]);

// This slice must never touch registry_index.json (no new domain activated)
// or any other candidate domain's active file.
const forbiddenChangedFiles = new Set([
  "registries/registry_index.json",
  "registries/registry_surface_classification.json",
  "registries/exercise_activity_applicability/exercise_activity_applicability.registry.json"
]);

const forbiddenChangedPrefixes = Object.freeze([
  "engine/",
  "src/",
  "server/",
  "app/",
  "web/",
  "supabase/",
  "shared/pilot-lifecycle/",
  "shared/v1-boundary/"
]);

const REQUIRED_PROOF_COMMANDS = Object.freeze([
  ["node", "ci/guards/registry_bundle_guard.mjs"],
  ["node", "ci/guards/registry_law_guard.mjs"],
  ["node", "ci/guards/registry_schema_presence_guard.mjs"],
  ["node", "ci/guards/s_v1_24_registry_load_order_fk_closure_guard.mjs"],
  ["node", "ci/guards/s_v1_21_exercise_registry_contract_guard.mjs"],
  ["node", "ci/guards/s_v1_22_equipment_registry_coverage_contract_guard.mjs"],
  ["node", "ci/scripts/run_registry_seal_gate.mjs"],
  ["node", "ci/scripts/run_failure_token_index_guard.mjs"],
  ["node", "ci/guards/guards_index_guard.mjs"],
  ["node", "ci/guards/guards_entrypoint_coverage_guard.mjs"]
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
  return `${repoRoot}/${relativePath}`;
}

function readText(relativePath) {
  return fs.readFileSync(repoPath(relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function runGit(args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function assertIncludes(text, marker, context) {
  if (!text.includes(marker)) {
    fail("Required S-REG-32 marker is missing.", { marker, context });
  }
}

function parsePorcelainPath(line) {
  const rawPath = line.length >= 4 && line[2] === " "
    ? line.slice(3).trim()
    : line.replace(/^[ MADRCU?!]{1,2}\s+/u, "").trim();

  if (!rawPath) {
    return "";
  }

  if (rawPath.includes(" -> ")) {
    return rawPath.split(" -> ").pop().trim().replace(/^"|"$/gu, "").replace(/\\/gu, "/");
  }

  return rawPath.replace(/^"|"$/gu, "").replace(/\\/gu, "/");
}

function collectChangedFiles() {
  const branchName = runGit(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (!branchName.includes("s-reg-32-exercise-applicability-schema-extension")) {
    return [];
  }

  const changed = new Set();
  const porcelain = runGit(["status", "--porcelain=v1"]);

  for (const line of porcelain.split(/\r?\n/u).filter(Boolean)) {
    const relPath = parsePorcelainPath(line);
    if (relPath) {
      changed.add(relPath);
    }
  }

  const mergeBase = runGit(["merge-base", "HEAD", "origin/main"]);
  const committed = runGit(["diff", "--name-only", `${mergeBase}..HEAD`]);

  for (const relPath of committed.split(/\r?\n/u).filter(Boolean)) {
    changed.add(relPath.replace(/\\/gu, "/"));
  }

  return [...changed].sort();
}

function assertChangedFilesWithinBoundary() {
  const changed = collectChangedFiles();
  const disallowed = changed.filter((relativePath) => !allowedChangedFiles.has(relativePath));

  if (disallowed.length > 0) {
    fail("S-REG-32 touched files outside the exercise schema extension boundary.", {
      changed_files: changed,
      disallowed_files: disallowed,
      allowed_files: [...allowedChangedFiles].sort()
    });
  }

  for (const relativePath of changed) {
    if (forbiddenChangedFiles.has(relativePath)) {
      fail("S-REG-32 touched a forbidden registry-surface file - this slice extends the exercise domain's schema only, it does not activate any domain.", { path: relativePath });
    }

    for (const prefix of forbiddenChangedPrefixes) {
      if (relativePath.startsWith(prefix)) {
        fail("S-REG-32 touched a forbidden engine/runtime surface.", {
          path: relativePath,
          forbidden_prefix: prefix
        });
      }
    }
  }

  return changed;
}

function assertRequiredFilesPresent() {
  for (const relativePath of [
    "ci/registry/s_reg_32_exercise_activity_applicability_schema_extension.mjs",
    "ci/registry/s_reg_32_exercise_activity_applicability_schema_extension.json",
    "test/s_reg_32_exercise_activity_applicability_schema_extension.test.mjs",
    "ci/guards/s_reg_32_exercise_activity_applicability_schema_extension_guard.mjs",
    "docs/roadmap/S_REG_32_EXERCISE_ACTIVITY_APPLICABILITY_SCHEMA_EXTENSION.md",
    "package.json"
  ]) {
    if (!fs.existsSync(repoPath(relativePath))) {
      fail("Required S-REG-32 file is missing.", { path: relativePath });
    }
  }
}

function assertPackageWiring() {
  const packageJson = readJson("package.json");
  const expected = "node --test test/s_reg_32_exercise_activity_applicability_schema_extension.test.mjs && node ci/guards/s_reg_32_exercise_activity_applicability_schema_extension_guard.mjs";

  if (packageJson.scripts?.["proof:s-reg-32"] !== expected) {
    fail("S-REG-32 package proof script is missing or incorrect.", {
      actual: packageJson.scripts?.["proof:s-reg-32"],
      expected
    });
  }

  if (packageJson.scripts?.["lint:fast"]?.includes("s_reg_32_exercise_activity_applicability_schema_extension")) {
    fail("S-REG-32 must not append to the top-level lint:fast command.");
  }

  if (!packageJson.scripts?.["lint:fast:inline"]?.includes("s_reg_32_exercise_activity_applicability_schema_extension")) {
    fail("S-REG-32 lint:fast:inline package wiring is missing.");
  }

  if (!packageJson.scripts?.["test:unit"]?.includes("s_reg_32_exercise_activity_applicability_schema_extension_guard.mjs")) {
    fail("S-REG-32 test:unit guard wiring is missing.");
  }
}

function assertGeneratedIndexes() {
  const guardsIndex = readText("docs/GUARDS_INDEX.md");
  const failureTokenIndex = readText("docs/dev/FAILURE_TOKEN_INDEX.md");

  assertIncludes(
    guardsIndex,
    "ci/guards/s_reg_32_exercise_activity_applicability_schema_extension_guard.mjs",
    "docs/GUARDS_INDEX.md"
  );

  assertIncludes(
    failureTokenIndex,
    "CI_S_REG_32_EXERCISE_ACTIVITY_APPLICABILITY_SCHEMA_EXTENSION",
    "docs/dev/FAILURE_TOKEN_INDEX.md"
  );
}

function assertDocMarkers() {
  const doc = readText("docs/roadmap/S_REG_32_EXERCISE_ACTIVITY_APPLICABILITY_SCHEMA_EXTENSION.md");

  for (const marker of [
    "S-REG-32",
    "exercise_activity_applicability_schema_extension",
    "primary_activity_applicability",
    "secondary_activity_applicability",
    "allowed_movement_ids",
    "S-REG-33",
    "non_runtime"
  ]) {
    assertIncludes(doc, marker, "docs/roadmap/S_REG_32_EXERCISE_ACTIVITY_APPLICABILITY_SCHEMA_EXTENSION.md");
  }
}

function assertRequiredProofCommandsPass() {
  for (const [command, ...args] of REQUIRED_PROOF_COMMANDS) {
    const result = execFileSync(command, args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    if (typeof result !== "string") {
      fail("S-REG-32 required proof command did not run.", { command, args });
    }
  }
}

function main() {
  assertRequiredFilesPresent();
  const changedFiles = assertChangedFilesWithinBoundary();
  assertPackageWiring();
  assertGeneratedIndexes();
  assertDocMarkers();
  assertRequiredProofCommandsPass();

  const extension = sReg32LoadExerciseActivityApplicabilitySchemaExtension();
  const result = sReg32ValidateExerciseActivityApplicabilitySchemaExtension();

  if (
    result.ok !== true ||
    result.extension_id !== "exercise_activity_applicability_schema_extension" ||
    result.decision_type !== "schema_extension" ||
    result.runtime_status !== S_REG_32_RUNTIME_STATUS ||
    result.extended_registry_id !== "exercise" ||
    result.extended_record_count !== 19
  ) {
    fail("S-REG-32 validation result is invalid.", { result });
  }

  console.log(JSON.stringify({
    ok: true,
    guard: GUARD,
    token: TOKEN,
    slice_id: "S-REG-32",
    extension_id: extension.extension_id,
    decision_type: result.decision_type,
    runtime_status: S_REG_32_RUNTIME_STATUS,
    extended_registry_id: result.extended_registry_id,
    extended_record_count: result.extended_record_count,
    extended_field_names: result.extended_field_names,
    changed_files: changedFiles
  }, null, 2));
}

try {
  main();
} catch (error) {
  fail("S-REG-32 guard crashed.", {
    error: error?.message ?? String(error),
    code: error?.code,
    reason: error?.reason,
    details: error?.details
  });
}
