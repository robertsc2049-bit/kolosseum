import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const recordPath = path.join(ROOT, "docs/releases/CONTROLLED_LAUNCH_SMOKE_RUN.json");
const markdownPath = path.join(ROOT, "docs/releases/CONTROLLED_LAUNCH_SMOKE_RUN.md");
const packagePath = path.join(ROOT, "package.json");
const packagingRegistryPath = path.join(ROOT, "docs/releases/V1_PACKAGING_SURFACE_REGISTRY.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("S-V1-F-10 smoke run files exist", () => {
  assert.ok(fs.existsSync(recordPath));
  assert.ok(fs.existsSync(markdownPath));
});

test("S-V1-F-10 records the tagged or release-ready state used for smoke", () => {
  const record = readJson(recordPath);

  assert.equal(record.slice_id, "S-V1-F-10");
  assert.equal(record.record_id, "controlled_launch_smoke_run");
  assert.equal(record.status, "pass");
  assert.equal(record.scope, "controlled_launch_only");
  assert.equal(record.release_state_used.mode, "release_ready_main_after_tag");
  assert.equal(record.release_state_used.tag_name, "v1-controlled-launch");
  assert.equal(record.release_state_used.tag_commit, "43510e4c4d791effda647e80dc74d8452dc61f1f");
  assert.equal(record.release_state_used.local_tag_verified, true);
  assert.equal(record.release_state_used.remote_tag_verified, true);
  assert.equal(record.release_state_used.release_evidence_snapshot, "docs/releases/V1_RELEASE_EVIDENCE_SNAPSHOT.json");
  assert.equal(record.release_state_used.final_ship_decision, "docs/releases/V1_FINAL_SHIP_DECISION.json");
  assert.equal(record.release_state_used.controlled_launch_execution_pack, "docs/releases/CONTROLLED_LAUNCH_EXECUTION_PACK.json");
});

test("S-V1-F-10 records all required smoke commands as passed", () => {
  const record = readJson(recordPath);

  assert.equal(record.smoke_summary.result, "pass");
  assert.equal(record.smoke_summary.failed_required_command_count, 0);
  assert.equal(record.smoke_summary.launch_blocker_recorded, false);
  assert.equal(record.smoke_summary.product_code_changed_by_smoke, false);
  assert.equal(record.smoke_summary.release_tag_changed_by_smoke, false);

  assert.ok(Array.isArray(record.smoke_commands));
  assert.equal(record.smoke_commands.length, record.smoke_summary.required_command_count);
  assert.ok(record.smoke_commands.length >= 12);
  assert.ok(record.smoke_commands.every((entry) => entry.required === true));
  assert.ok(record.smoke_commands.every((entry) => entry.result === "pass"));

  const commandSet = new Set(record.smoke_commands.map((entry) => entry.command));
  for (const command of [
    "npm.cmd run proof:s-v1-f-05",
    "npm.cmd run proof:s-v1-f-08",
    "npm.cmd run proof:s-v1-f-09",
    "npm.cmd run proof:s-v1-f-01",
    "npm.cmd run acceptance:v1:check",
    "node --test test/s_v1_l_01_legal_document_surfaces.test.mjs",
    "node ci/guards/s_v1_l_01_legal_document_surfaces_guard.mjs",
    "node --test test/s_v1_p_02_stripe_checkout_controlled_launch.test.mjs",
    "node ci/guards/s_v1_p_02_stripe_checkout_controlled_launch_guard.mjs",
    "node --test test/s_v1_o_01_status_page.test.mjs",
    "node ci/guards/s_v1_o_01_status_page_guard.mjs",
    "npm.cmd run proof:s-v1-o-04"
  ]) {
    assert.ok(commandSet.has(command), `missing smoke command: ${command}`);
  }
});

test("S-V1-F-10 covers the minimum coach-athlete controlled launch path", () => {
  const record = readJson(recordPath);
  const paths = new Set(record.smoke_path_items.map((entry) => entry.path));

  for (const pathName of [
    "release_identity",
    "coach_account_path",
    "athlete_account_path",
    "coach_athlete_relationship_path",
    "assignment_session_and_factual_execution_path",
    "legal_surface_path",
    "payment_access_surface_path",
    "status_and_support_path",
    "launch_blocker_path"
  ]) {
    assert.ok(paths.has(pathName), `missing smoke path: ${pathName}`);
  }

  assert.ok(record.smoke_path_items.every((entry) => entry.status === "pass"));
  assert.ok(record.smoke_path_items.every((entry) => Array.isArray(entry.evidence) && entry.evidence.length > 0));
});

test("S-V1-F-10 remains smoke evidence only", () => {
  const record = readJson(recordPath);

  assert.equal(record.boundaries.smoke_evidence_only, true);
  assert.equal(record.boundaries.touches_product_code, false);
  assert.equal(record.boundaries.touches_engine_code, false);
  assert.equal(record.boundaries.changes_acceptance_gate_law, false);
  assert.equal(record.boundaries.changes_registry_content, false);
  assert.equal(record.boundaries.changes_release_tag, false);
  assert.equal(record.boundaries.activates_post_v1_scope, false);
  assert.equal(record.boundaries.creates_feature_implementation, false);
  assert.equal(record.boundaries.creates_live_user_data, false);
  assert.equal(record.boundaries.stores_named_founder_users, false);
  assert.equal(record.boundaries.creates_commercial_claims, false);

  for (const scope of [
    "product_code",
    "engine_code",
    "acceptance_gate_law",
    "registry_content",
    "release_tag",
    "marketplace",
    "organisations",
    "gyms",
    "teams",
    "federations",
    "enterprise_dashboards",
    "messaging",
    "post_v1_scope"
  ]) {
    assert.ok(record.forbidden_scope.includes(scope));
  }
});

test("S-V1-F-10 has a separate blocker policy", () => {
  const record = readJson(recordPath);

  assert.equal(record.blocker_policy.any_required_smoke_failure_blocks_launch, true);
  assert.equal(record.blocker_policy.fix_inside_smoke_slice_allowed, false);
  assert.equal(record.blocker_policy.scope_widening_allowed, false);
  assert.equal(record.blocker_policy.release_tag_mutation_allowed, false);
  assert.equal(record.blocker_policy.product_or_engine_mutation_allowed, false);
  assert.match(record.blocker_policy.blocker_action, /separate fix slice/);
});

test("S-V1-F-10 markdown mirrors factual smoke evidence without completion or claim drift", () => {
  const markdown = readText(markdownPath);

  assert.ok(markdown.includes("# Controlled Launch Smoke Run"));
  assert.ok(markdown.includes("Slice: S-V1-F-10"));
  assert.ok(markdown.includes("Overall result: pass"));
  assert.ok(markdown.includes("Main HEAD:"));
  assert.ok(markdown.includes("Release tag: v1-controlled-launch"));
  assert.ok(markdown.includes("## Smoke commands"));
  assert.ok(markdown.includes("## Minimum controlled-launch path evidence"));
  assert.ok(markdown.includes("## Blocker rule"));
  assert.ok(markdown.includes("separate fix slice"));
  assert.ok(markdown.includes("npm.cmd run proof:s-v1-f-10"));
  assert.ok(markdown.includes("npm.cmd run acceptance:v1:check"));

  for (const forbiddenPhrase of [
    "partially complete",
    "partially-complete",
    "guaranteed outcome",
    "guarantees outcomes",
    "athlete clearance",
    "coach clearance",
    "external approval",
    "return to play",
    "return-to-play",
    "return to run",
    "return-to-run",
    "fitness for duty",
    "fitness-for-duty",
    "recommended programme",
    "optimal programme"
  ]) {
    assert.equal(markdown.toLowerCase().includes(forbiddenPhrase), false, forbiddenPhrase);
  }
});

test("S-V1-F-10 claim boundary remains false", () => {
  const record = readJson(recordPath);

  for (const [key, value] of Object.entries(record.claim_boundary)) {
    assert.equal(value, false, key);
  }
});

test("S-V1-F-10 package proof script is wired and release smoke is not a packaging registry surface", () => {
  const pkg = readJson(packagePath);
  const registry = readJson(packagingRegistryPath);
  const surfaces = Array.isArray(registry) ? registry : registry.surfaces;

  assert.ok(pkg.scripts["proof:s-v1-f-10"].includes("test/s_v1_f_10_controlled_launch_smoke_run.test.mjs"));
  assert.ok(pkg.scripts["proof:s-v1-f-10"].includes("ci/guards/s_v1_f_10_controlled_launch_smoke_run_guard.mjs"));
  assert.ok(pkg.scripts["lint:fast"].includes("test/s_v1_f_10_controlled_launch_smoke_run.test.mjs"));
  assert.ok(pkg.scripts["lint:fast"].includes("ci/guards/s_v1_f_10_controlled_launch_smoke_run_guard.mjs"));
  assert.ok(pkg.scripts["lint:fast:inline"].includes("test/s_v1_f_10_controlled_launch_smoke_run.test.mjs"));
  assert.ok(pkg.scripts["lint:fast:inline"].includes("ci/guards/s_v1_f_10_controlled_launch_smoke_run_guard.mjs"));

  assert.ok(Array.isArray(surfaces));
  assert.equal(surfaces.includes("docs/releases/CONTROLLED_LAUNCH_SMOKE_RUN.json"), false);
  assert.equal(surfaces.includes("docs/releases/CONTROLLED_LAUNCH_SMOKE_RUN.md"), false);
});
