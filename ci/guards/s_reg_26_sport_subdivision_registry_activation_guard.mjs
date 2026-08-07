// @law: Registry Law
// @severity: high
// @scope: registry
/**
 * DEV NOTE: S-REG-26 guard.
 * Purpose: proves the sport_subdivision_registry activation is genuinely
 * authorised, scoped to exactly the sport_subdivision domain, and satisfies
 * every proof command S-REG-24's contract requires.
 * Boundary: permits only the exact mutation surface S-REG-24's contract
 * allows for this target (registry index/bundle, the new sport_subdivision
 * registry file and its schema, the surface classification, the four seal
 * evidence files, and this slice's own scaffolding), plus every file already
 * on this branch from the still-unmerged S-REG-25 activation it was branched
 * from (this branch's diff against origin/main includes both slices' changes
 * until PR #843 merges - not a widened boundary, a reflection of the current
 * branch topology). It must not permit any change under engine/, src/,
 * server/, app/, web/, supabase/, shared/pilot-lifecycle/, or
 * shared/v1-boundary/, nor any other candidate domain's activation.
 * Failure: emits CI_S_REG_26_SPORT_SUBDIVISION_REGISTRY_ACTIVATION.
 */

import fs from "node:fs";
import { execFileSync } from "node:child_process";

import {
  S_REG_26_FAILURE_TOKEN,
  S_REG_26_RUNTIME_STATUS,
  sReg26LoadSportSubdivisionRegistryActivation,
  sReg26ValidateSportSubdivisionRegistryActivation
} from "../registry/s_reg_26_sport_subdivision_registry_activation.mjs";

const repoRoot = process.cwd();
const GUARD = "S-REG-26";
const TOKEN = S_REG_26_FAILURE_TOKEN;

const allowedChangedFiles = new Set([
  // S-REG-26's own scaffolding.
  "ci/registry/s_reg_26_sport_subdivision_registry_activation.mjs",
  "ci/registry/s_reg_26_sport_subdivision_registry_activation.json",
  "test/s_reg_26_sport_subdivision_registry_activation.test.mjs",
  "ci/guards/s_reg_26_sport_subdivision_registry_activation_guard.mjs",
  "docs/roadmap/S_REG_26_SPORT_SUBDIVISION_REGISTRY_ACTIVATION.md",
  "registries/sport_subdivision/",
  "registries/sport_subdivision/sport_subdivision.registry.json",
  "ci/schemas/sport_subdivision.registry.schema.json",

  // Everything below this line was already committed on this branch by the
  // still-unmerged S-REG-25 activation this branch was created on top of -
  // see the DEV NOTE above. Copied verbatim from
  // ci/guards/s_reg_25_equipment_registry_activation_guard.mjs's own
  // allowedChangedFiles set.
  "ci/registry/s_reg_25_equipment_registry_activation.mjs",
  "ci/registry/s_reg_25_equipment_registry_activation.json",
  "test/s_reg_25_equipment_registry_activation.test.mjs",
  "ci/guards/s_reg_25_equipment_registry_activation_guard.mjs",
  "docs/roadmap/S_REG_25_EQUIPMENT_REGISTRY_ACTIVATION.md",
  "registries/registry_index.json",
  "registries/registry_bundle.json",
  "registries/registry_surface_classification.json",
  "registries/equipment/",
  "registries/equipment/equipment.registry.json",
  "registries/exercise/exercise.registry.json",
  "ci/schemas/equipment.registry.schema.json",
  "ci/schemas/exercise_registry.schema.json",
  "ci/schemas/exercise.registry.schema.json",
  "ci/schemas/exercise.registry.schema.v1.0.0.json",
  "ci/guards/s_v1_22_equipment_registry_coverage_contract_guard.mjs",
  "test/s_v1_22_equipment_registry_coverage_contract.test.mjs",
  "docs/v1/V1_EQUIPMENT_REGISTRY_COVERAGE_CONTRACT.md",
  "ci/guards/s_v1_10_release_boundary_file_closure_guard.mjs",
  "ci/guards/s_reg_04_legacy_to_canonical_registry_loader_bridge_guard.mjs",
  "test/s_reg_04_legacy_to_canonical_registry_loader_bridge.test.mjs",
  "docs/roadmap/S_REG_04_LEGACY_TO_CANONICAL_REGISTRY_LOADER_BRIDGE.md",
  "ci/registry/s_reg_04_legacy_to_canonical_registry_bridge.mjs",
  "test/beta_07_registry_loader_core.test.mjs",
  "ci/guards/s_reg_05_canonical_registry_contract_candidate_surface_guard.mjs",
  "test/s_reg_05_canonical_registry_contract_candidate_surface.test.mjs",
  "ci/registry/s_reg_22_candidate_registry_build_review.mjs",
  "test/s_reg_22_candidate_registry_build_review.test.mjs",
  "ci/guards/s_reg_06_canonical_activity_movement_exercise_candidate_seeds_guard.mjs",
  "ci/guards/s_reg_07_canonical_equipment_candidate_seeds_guard.mjs",
  "ci/guards/s_reg_08_exercise_equipment_fk_closure_candidate_update_guard.mjs",
  "ci/guards/s_reg_09_exercise_activity_applicability_candidate_seeds_guard.mjs",
  "ci/guards/s_reg_10_sport_context_candidate_seeds_guard.mjs",
  "ci/guards/s_reg_11_sport_metric_candidate_seeds_guard.mjs",
  "ci/guards/s_reg_12_metric_exercise_link_candidate_seeds_guard.mjs",
  "ci/guards/s_reg_13_threshold_marker_candidate_boundary_contract_guard.mjs",
  "ci/guards/s_reg_14_registry_build_readiness_start_gate_guard.mjs",
  "ci/guards/s_reg_15_candidate_exercise_registry_content_batch_1_guard.mjs",
  "ci/guards/s_reg_16_candidate_equipment_registry_content_batch_1_guard.mjs",
  "ci/guards/s_reg_17_exercise_equipment_candidate_fk_closure_expansion_guard.mjs",
  "ci/guards/s_reg_18_exercise_activity_applicability_candidate_expansion_guard.mjs",
  "ci/guards/s_reg_19_sport_metric_candidate_expansion_guard.mjs",
  "ci/guards/s_reg_20_metric_exercise_link_candidate_expansion_guard.mjs",
  "ci/guards/s_reg_21_threshold_marker_candidate_records_guard.mjs",
  "ci/registry/s_reg_14_registry_build_readiness_start_gate.mjs",
  "ci/registry/s_reg_15_candidate_exercise_registry_content_batch_1.mjs",
  "ci/registry/s_reg_16_candidate_equipment_registry_content_batch_1.mjs",
  "ci/registry/s_reg_17_exercise_equipment_candidate_fk_closure_expansion.mjs",
  "ci/registry/s_reg_18_exercise_activity_applicability_candidate_expansion.mjs",
  "ci/registry/s_reg_19_sport_metric_candidate_expansion.mjs",
  "ci/registry/s_reg_20_metric_exercise_link_candidate_expansion.mjs",
  "test/s_reg_06_canonical_activity_movement_exercise_candidate_seeds.test.mjs",
  "test/s_reg_07_canonical_equipment_candidate_seeds.test.mjs",
  "test/s_reg_08_exercise_equipment_fk_closure_candidate_update.test.mjs",
  "test/s_reg_09_exercise_activity_applicability_candidate_seeds.test.mjs",
  "test/s_reg_10_sport_context_candidate_seeds.test.mjs",
  "test/s_reg_11_sport_metric_candidate_seeds.test.mjs",
  "test/s_reg_12_metric_exercise_link_candidate_seeds.test.mjs",
  "test/s_reg_13_threshold_marker_candidate_boundary_contract.test.mjs",
  "test/s_reg_14_registry_build_readiness_start_gate.test.mjs",
  "test/s_reg_21_threshold_marker_candidate_records.test.mjs",
  "ci/evidence/registry_seal_lifecycle.v1.json",
  "ci/evidence/registry_seal_manifest.v1.json",
  "ci/evidence/registry_seal_live_surface.v1.json",
  "ci/evidence/registry_seal_snapshot.v1.json",
  "ci/evidence/evidence_envelope.v1.json",
  "ci/evidence/evidence_seal.v1.json",
  "test/fixtures/golden/expected/phase3_precedence_banned_over_available.json",
  "test/fixtures/golden/expected/phase3_sovereign_constraints_envelope.json",
  "replay/suite/beta_phase1_7/vectors.json",
  "replay/suite/beta_phase1_7/manifest.json",
  "replay/suite/beta_phase1_7/verify_inputs.json",
  "replay/suite/beta_phase1_7/expected_outputs.json",
  "replay/suite/beta_phase1_7/verify_manifest.json",
  "replay/suite/beta_phase1_8/production_beta_rehearsal_manifest.json",
  "replay/suite/beta_phase1_7/runner_verdict_manifest.json",
  "replay/suite/beta_phase1_8/evidence_schema_manifest.json",
  "replay/suite/beta_phase1_8/evidence_immutability_manifest.json",
  "ci/registry/s_reg_23_registry_activation_hold_decision.mjs",
  "ci/registry/s_reg_23_registry_activation_hold_decision.json",
  "test/s_reg_23_registry_activation_hold_decision.test.mjs",
  "docs/roadmap/S_REG_23_REGISTRY_ACTIVATION_HOLD_DECISION.md",
  "ci/registry/s_reg_24_registry_activation_contract_design.mjs",
  "ci/registry/s_reg_24_registry_activation_contract_design.json",
  "test/s_reg_24_registry_activation_contract_design.test.mjs",
  "docs/roadmap/S_REG_24_REGISTRY_ACTIVATION_CONTRACT_DESIGN.md",
  "package.json",
  "ci/guards/_entrypoints.json",
  "docs/GUARDS_INDEX.md",
  "docs/dev/FAILURE_TOKEN_INDEX.md",
  "docs/checksums.sha256"
]);

// No other candidate domain's active-file counterpart may ever appear here -
// this slice activates sport_subdivision only (equipment is already active
// from the still-unmerged S-REG-25 this branch was built on).
const forbiddenChangedFiles = new Set([
  "registries/movement/movement.registry.json",
  "registries/activity/activity.registry.json",
  "registries/program/program.registry.json"
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

// S-REG-24's own 9 required proof commands (docs/roadmap/S_REG_24_REGISTRY_ACTIVATION_CONTRACT_DESIGN.md,
// "Future proof commands") - run for real, not merely asserted present.
const REQUIRED_PROOF_COMMANDS = Object.freeze([
  ["node", "ci/guards/registry_bundle_guard.mjs"],
  ["node", "ci/guards/registry_law_guard.mjs"],
  ["node", "ci/guards/registry_schema_presence_guard.mjs"],
  ["node", "ci/guards/s_v1_24_registry_load_order_fk_closure_guard.mjs"],
  ["node", "ci/scripts/run_registry_seal_gate.mjs"],
  ["node", "ci/scripts/run_failure_token_index_guard.mjs"],
  ["node", "ci/guards/guards_index_guard.mjs"],
  ["node", "ci/guards/guards_entrypoint_coverage_guard.mjs"]
  // npm.cmd run lint:fast is the outer chain this guard is itself invoked
  // from - not re-invoked here to avoid unbounded recursion.
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
    fail("Required S-REG-26 marker is missing.", { marker, context });
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
  if (!branchName.includes("s-reg-26-registry-activation-sport-subdivision")) {
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
    fail("S-REG-26 touched files outside the sport_subdivision_registry activation boundary.", {
      changed_files: changed,
      disallowed_files: disallowed,
      allowed_files: [...allowedChangedFiles].sort()
    });
  }

  for (const relativePath of changed) {
    if (forbiddenChangedFiles.has(relativePath)) {
      fail("S-REG-26 touched another candidate domain's active registry file - this slice activates sport_subdivision only.", { path: relativePath });
    }

    for (const prefix of forbiddenChangedPrefixes) {
      if (relativePath.startsWith(prefix)) {
        fail("S-REG-26 touched a forbidden engine/runtime surface.", {
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
    "ci/registry/s_reg_26_sport_subdivision_registry_activation.mjs",
    "ci/registry/s_reg_26_sport_subdivision_registry_activation.json",
    "test/s_reg_26_sport_subdivision_registry_activation.test.mjs",
    "ci/guards/s_reg_26_sport_subdivision_registry_activation_guard.mjs",
    "docs/roadmap/S_REG_26_SPORT_SUBDIVISION_REGISTRY_ACTIVATION.md",
    "registries/sport_subdivision/sport_subdivision.registry.json",
    "ci/schemas/sport_subdivision.registry.schema.json",
    "package.json"
  ]) {
    if (!fs.existsSync(repoPath(relativePath))) {
      fail("Required S-REG-26 file is missing.", { path: relativePath });
    }
  }
}

function assertPackageWiring() {
  const packageJson = readJson("package.json");
  const expected = "node --test test/s_reg_26_sport_subdivision_registry_activation.test.mjs && node ci/guards/s_reg_26_sport_subdivision_registry_activation_guard.mjs";

  if (packageJson.scripts?.["proof:s-reg-26"] !== expected) {
    fail("S-REG-26 package proof script is missing or incorrect.", {
      actual: packageJson.scripts?.["proof:s-reg-26"],
      expected
    });
  }

  if (packageJson.scripts?.["lint:fast"]?.includes("s_reg_26_sport_subdivision_registry_activation")) {
    fail("S-REG-26 must not append to the top-level lint:fast command.");
  }

  if (!packageJson.scripts?.["lint:fast:inline"]?.includes("s_reg_26_sport_subdivision_registry_activation")) {
    fail("S-REG-26 lint:fast:inline package wiring is missing.");
  }

  if (!packageJson.scripts?.["test:unit"]?.includes("s_reg_26_sport_subdivision_registry_activation_guard.mjs")) {
    fail("S-REG-26 test:unit guard wiring is missing.");
  }
}

function assertGeneratedIndexes() {
  const guardsIndex = readText("docs/GUARDS_INDEX.md");
  const failureTokenIndex = readText("docs/dev/FAILURE_TOKEN_INDEX.md");

  assertIncludes(
    guardsIndex,
    "ci/guards/s_reg_26_sport_subdivision_registry_activation_guard.mjs",
    "docs/GUARDS_INDEX.md"
  );

  assertIncludes(
    failureTokenIndex,
    "CI_S_REG_26_SPORT_SUBDIVISION_REGISTRY_ACTIVATION",
    "docs/dev/FAILURE_TOKEN_INDEX.md"
  );
}

function assertDocMarkers() {
  const doc = readText("docs/roadmap/S_REG_26_SPORT_SUBDIVISION_REGISTRY_ACTIVATION.md");

  for (const marker of [
    "S-REG-26",
    "sport_subdivision_registry_activation",
    "sport_subdivision",
    "human-authorised",
    "rollback",
    "runtime parity",
    "non_runtime"
  ]) {
    assertIncludes(doc, marker, "docs/roadmap/S_REG_26_SPORT_SUBDIVISION_REGISTRY_ACTIVATION.md");
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
      fail("S-REG-26 required proof command did not run.", { command, args });
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

  const activation = sReg26LoadSportSubdivisionRegistryActivation();
  const result = sReg26ValidateSportSubdivisionRegistryActivation();

  if (
    result.ok !== true ||
    result.activation_id !== "sport_subdivision_registry_activation" ||
    result.decision_type !== "activation" ||
    result.activation_decision !== "authorised" ||
    result.activation_authorised !== true ||
    result.activation_ready !== true ||
    result.active_registry_activation !== true ||
    result.runtime_status !== S_REG_26_RUNTIME_STATUS
  ) {
    fail("S-REG-26 validation result is invalid.", { result });
  }

  console.log(JSON.stringify({
    ok: true,
    guard: GUARD,
    token: TOKEN,
    slice_id: "S-REG-26",
    activation_id: activation.activation_id,
    decision_type: result.decision_type,
    activation_decision: result.activation_decision,
    activation_target: result.activation_target,
    activated_registry_id: result.activated_registry_id,
    activation_authorised: true,
    activation_ready: true,
    active_registry_activation: true,
    runtime_status: S_REG_26_RUNTIME_STATUS,
    activated_record_count: result.activated_record_count,
    active_registry_order_after: result.active_registry_order_after,
    covered_required_before_activation_count: result.covered_required_before_activation.length,
    changed_files: changedFiles
  }, null, 2));
}

try {
  main();
} catch (error) {
  fail("S-REG-26 guard crashed.", {
    error: error?.message ?? String(error),
    code: error?.code,
    reason: error?.reason,
    details: error?.details
  });
}
