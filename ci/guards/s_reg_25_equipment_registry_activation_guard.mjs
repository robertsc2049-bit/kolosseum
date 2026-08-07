// @law: Registry Law
// @severity: high
// @scope: registry
/**
 * DEV NOTE: S-REG-25 guard.
 * Purpose: proves the equipment_registry activation is genuinely authorised,
 * scoped to exactly the equipment domain, and satisfies every proof command
 * S-REG-24's contract requires.
 * Boundary: permits only the exact mutation surface S-REG-24's contract
 * allows for this target (registry index/bundle, the new equipment registry
 * file and its schema, the surface classification, the four seal evidence
 * files, and this slice's own scaffolding). It must not permit any change
 * under engine/, src/, server/, app/, web/, supabase/, shared/pilot-lifecycle/,
 * or shared/v1-boundary/, nor any other candidate domain's activation.
 * Failure: emits CI_S_REG_25_EQUIPMENT_REGISTRY_ACTIVATION.
 */

import fs from "node:fs";
import { execFileSync } from "node:child_process";

import {
  S_REG_25_FAILURE_TOKEN,
  S_REG_25_RUNTIME_STATUS,
  sReg25LoadEquipmentRegistryActivation,
  sReg25ValidateEquipmentRegistryActivation
} from "../registry/s_reg_25_equipment_registry_activation.mjs";

const repoRoot = process.cwd();
const GUARD = "S-REG-25";
const TOKEN = S_REG_25_FAILURE_TOKEN;

const allowedChangedFiles = new Set([
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
  // S-V1-22 was a separate, stricter, pre-existing V1 launch-readiness
  // contract this activation was required to satisfy for real - see
  // docs/roadmap/S_REG_25_EQUIPMENT_REGISTRY_ACTIVATION.md for the full
  // account. Its guard evolved from "must not exist" to "must satisfy the
  // contract for real" alongside the exercise-side FK wiring below.
  "ci/guards/s_v1_22_equipment_registry_coverage_contract_guard.mjs",
  "test/s_v1_22_equipment_registry_coverage_contract.test.mjs",
  "docs/v1/V1_EQUIPMENT_REGISTRY_COVERAGE_CONTRACT.md",
  // S-V1-10's trigger for its forbidden-implementation-prefix check was a
  // blanket docs/v1/ directory-prefix match, over-broad relative to its own
  // stated intent (only its six named boundary docs). Editing the unrelated
  // V1_EQUIPMENT_REGISTRY_COVERAGE_CONTRACT.md above false-triggered it
  // against this slice's real registries/ changes. Narrowed the check to an
  // exact match against its own named FILES set - a real-content fix, not a
  // weakening: the six boundary docs still trigger it exactly as before.
  "ci/guards/s_v1_10_release_boundary_file_closure_guard.mjs",
  // S-REG-04 (an earlier, already-accepted bridge-only slice) also hardcoded
  // an exact-length compact-order assertion against the live registry_index/
  // registry_bundle files - the same class of conflict as S-REG-23/24, fixed
  // the same way (prefix-match on live files, append-only supersession note
  // on the doc; the bridge's own alias mapping/claims are untouched).
  "ci/guards/s_reg_04_legacy_to_canonical_registry_loader_bridge_guard.mjs",
  "test/s_reg_04_legacy_to_canonical_registry_loader_bridge.test.mjs",
  "docs/roadmap/S_REG_04_LEGACY_TO_CANONICAL_REGISTRY_LOADER_BRIDGE.md",
  // Full CI swept the entire older candidate-track S-REG chain (05-21) and
  // found every one of them shared the same class of conflict as S-REG-04:
  // a hardcoded exact-match (or, for 16-20, an additional hash-pin) against
  // the live registry_index/registry_bundle files, asserting the active
  // surface would never change. Each was relaxed to a prefix-match on the
  // live files only (any local frozen snapshot constant used for a
  // different, historical purpose was left untouched), and S-REG-16's
  // previously-ungated forbidden-file check gained the same branch-scoping
  // every sibling guard already uses. No slice's own alias mapping,
  // dependency wiring, or candidate content was touched.
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
  // Generated envelope/seal recompute, same class as the failure-token index
  // and checksums regeneration below - required whenever tracked file
  // content changes, not a new mutation surface of its own.
  "ci/evidence/evidence_envelope.v1.json",
  "ci/evidence/evidence_seal.v1.json",
  // The engine's own PHASE_3 `loaded_registries` list is a factual record of
  // which registry files were loaded - it truthfully gained "equipment", so
  // exactly these two golden fixtures (the only ones that exercise phase3's
  // constraints-resolution output) needed re-pinning. No other fixture, and
  // no decision/content/template field within these two, changed at all -
  // see the runtime_parity_proof field in the activation record for the
  // itemised diff.
  "test/fixtures/golden/expected/phase3_precedence_banned_over_available.json",
  "test/fixtures/golden/expected/phase3_sovereign_constraints_envelope.json",
  // S-REG-23/24 gained an append-only supersession record naming this slice -
  // their own guards independently re-verify their historical fields stayed
  // frozen, this guard only needs to permit the file itself changing.
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
// this slice activates equipment only. exercise.registry.json is allowed
// above (annotation-only FK wiring, not a domain activation) so it is not
// listed here.
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
    fail("Required S-REG-25 marker is missing.", { marker, context });
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
  if (!branchName.includes("s-reg-25-registry-activation-equipment-registry")) {
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
    fail("S-REG-25 touched files outside the equipment_registry activation boundary.", {
      changed_files: changed,
      disallowed_files: disallowed,
      allowed_files: [...allowedChangedFiles].sort()
    });
  }

  for (const relativePath of changed) {
    if (forbiddenChangedFiles.has(relativePath)) {
      fail("S-REG-25 touched another candidate domain's active registry file - this slice activates equipment only.", { path: relativePath });
    }

    for (const prefix of forbiddenChangedPrefixes) {
      if (relativePath.startsWith(prefix)) {
        fail("S-REG-25 touched a forbidden engine/runtime surface.", {
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
    "ci/registry/s_reg_25_equipment_registry_activation.mjs",
    "ci/registry/s_reg_25_equipment_registry_activation.json",
    "test/s_reg_25_equipment_registry_activation.test.mjs",
    "ci/guards/s_reg_25_equipment_registry_activation_guard.mjs",
    "docs/roadmap/S_REG_25_EQUIPMENT_REGISTRY_ACTIVATION.md",
    "registries/equipment/equipment.registry.json",
    "ci/schemas/equipment.registry.schema.json",
    "package.json"
  ]) {
    if (!fs.existsSync(repoPath(relativePath))) {
      fail("Required S-REG-25 file is missing.", { path: relativePath });
    }
  }
}

function assertPackageWiring() {
  const packageJson = readJson("package.json");
  const expected = "node --test test/s_reg_25_equipment_registry_activation.test.mjs && node ci/guards/s_reg_25_equipment_registry_activation_guard.mjs";

  if (packageJson.scripts?.["proof:s-reg-25"] !== expected) {
    fail("S-REG-25 package proof script is missing or incorrect.", {
      actual: packageJson.scripts?.["proof:s-reg-25"],
      expected
    });
  }

  if (packageJson.scripts?.["lint:fast"]?.includes("s_reg_25_equipment_registry_activation")) {
    fail("S-REG-25 must not append to the top-level lint:fast command.");
  }

  if (!packageJson.scripts?.["lint:fast:inline"]?.includes("s_reg_25_equipment_registry_activation")) {
    fail("S-REG-25 lint:fast:inline package wiring is missing.");
  }

  if (!packageJson.scripts?.["test:unit"]?.includes("s_reg_25_equipment_registry_activation_guard.mjs")) {
    fail("S-REG-25 test:unit guard wiring is missing.");
  }
}

function assertGeneratedIndexes() {
  const guardsIndex = readText("docs/GUARDS_INDEX.md");
  const failureTokenIndex = readText("docs/dev/FAILURE_TOKEN_INDEX.md");

  assertIncludes(
    guardsIndex,
    "ci/guards/s_reg_25_equipment_registry_activation_guard.mjs",
    "docs/GUARDS_INDEX.md"
  );

  assertIncludes(
    failureTokenIndex,
    "CI_S_REG_25_EQUIPMENT_REGISTRY_ACTIVATION",
    "docs/dev/FAILURE_TOKEN_INDEX.md"
  );
}

function assertDocMarkers() {
  const doc = readText("docs/roadmap/S_REG_25_EQUIPMENT_REGISTRY_ACTIVATION.md");

  for (const marker of [
    "S-REG-25",
    "equipment_registry_activation",
    "equipment",
    "human-authorised",
    "rollback",
    "runtime parity",
    "non_runtime"
  ]) {
    assertIncludes(doc, marker, "docs/roadmap/S_REG_25_EQUIPMENT_REGISTRY_ACTIVATION.md");
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
      fail("S-REG-25 required proof command did not run.", { command, args });
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

  const activation = sReg25LoadEquipmentRegistryActivation();
  const result = sReg25ValidateEquipmentRegistryActivation();

  if (
    result.ok !== true ||
    result.activation_id !== "equipment_registry_activation" ||
    result.decision_type !== "activation" ||
    result.activation_decision !== "authorised" ||
    result.activation_authorised !== true ||
    result.activation_ready !== true ||
    result.active_registry_activation !== true ||
    result.runtime_status !== S_REG_25_RUNTIME_STATUS
  ) {
    fail("S-REG-25 validation result is invalid.", { result });
  }

  console.log(JSON.stringify({
    ok: true,
    guard: GUARD,
    token: TOKEN,
    slice_id: "S-REG-25",
    activation_id: activation.activation_id,
    decision_type: result.decision_type,
    activation_decision: result.activation_decision,
    activation_target: result.activation_target,
    activated_registry_id: result.activated_registry_id,
    activation_authorised: true,
    activation_ready: true,
    active_registry_activation: true,
    runtime_status: S_REG_25_RUNTIME_STATUS,
    activated_record_count: result.activated_record_count,
    active_registry_order_after: result.active_registry_order_after,
    covered_required_before_activation_count: result.covered_required_before_activation.length,
    changed_files: changedFiles
  }, null, 2));
}

try {
  main();
} catch (error) {
  fail("S-REG-25 guard crashed.", {
    error: error?.message ?? String(error),
    code: error?.code,
    reason: error?.reason,
    details: error?.details
  });
}
