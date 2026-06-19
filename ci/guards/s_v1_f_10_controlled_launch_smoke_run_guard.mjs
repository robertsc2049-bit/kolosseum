// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * @file S-V1-F-10 controlled launch smoke run guard.
 * @desc Proves the final controlled-launch smoke run is factual evidence only.
 *
 * DEV NOTE: S-V1-F-10 guard. This guard verifies the post-tag smoke evidence
 * record and its minimum coach-athlete launch path coverage. It does not
 * authorise product code, engine code, registry content, acceptance law,
 * release-tag mutation, or post-v1 scope.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const TOKEN = "CI_V1_CONTROLLED_LAUNCH_SMOKE_RUN";
const EXPECTED_TAG = "v1-controlled-launch";
const EXPECTED_TAG_COMMIT = "43510e4c4d791effda647e80dc74d8452dc61f1f";

const REQUIRED_FILES = [
  "docs/releases/CONTROLLED_LAUNCH_SMOKE_RUN.md",
  "docs/releases/CONTROLLED_LAUNCH_SMOKE_RUN.json",
  "docs/releases/V1_RELEASE_EVIDENCE_SNAPSHOT.md",
  "docs/releases/V1_RELEASE_EVIDENCE_SNAPSHOT.json",
  "docs/releases/V1_FINAL_SHIP_DECISION.md",
  "docs/releases/V1_FINAL_SHIP_DECISION.json",
  "docs/releases/CONTROLLED_LAUNCH_EXECUTION_PACK.md",
  "docs/releases/CONTROLLED_LAUNCH_EXECUTION_PACK.json",
  "docs/releases/CONTROLLED_LAUNCH_READINESS_RECORD.md",
  "docs/releases/CONTROLLED_LAUNCH_READINESS_RECORD.json",
  "test/s_v1_f_10_controlled_launch_smoke_run.test.mjs",
  "ci/guards/s_v1_f_10_controlled_launch_smoke_run_guard.mjs"
];

const REQUIRED_COMMANDS = [
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
];

const REQUIRED_PATHS = [
  "release_identity",
  "coach_account_path",
  "athlete_account_path",
  "coach_athlete_relationship_path",
  "assignment_session_and_factual_execution_path",
  "legal_surface_path",
  "payment_access_surface_path",
  "status_and_support_path",
  "launch_blocker_path"
];

function fail(message, detail = {}) {
  const error = new Error(message);
  error.detail = detail;
  throw error;
}

function assert(condition, message, detail = {}) {
  if (!condition) {
    fail(message, detail);
  }
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

for (const file of REQUIRED_FILES) {
  assert(fs.existsSync(path.join(ROOT, file)), "S-V1-F-10 required file missing.", { file });
}

const record = readJson("docs/releases/CONTROLLED_LAUNCH_SMOKE_RUN.json");
const markdown = readText("docs/releases/CONTROLLED_LAUNCH_SMOKE_RUN.md");
const pkg = readJson("package.json");
const registry = readJson("docs/releases/V1_PACKAGING_SURFACE_REGISTRY.json");
const surfaces = Array.isArray(registry) ? registry : registry.surfaces;

assert(record.slice_id === "S-V1-F-10", "slice_id mismatch.", { actual: record.slice_id });
assert(record.record_id === "controlled_launch_smoke_run", "record_id mismatch.", { actual: record.record_id });
assert(record.status === "pass", "smoke status must be pass.", { actual: record.status });
assert(record.scope === "controlled_launch_only", "scope mismatch.", { actual: record.scope });
assert(record.release_state_used?.mode === "release_ready_main_after_tag", "release state mode mismatch.");
assert(record.release_state_used?.tag_name === EXPECTED_TAG, "tag name mismatch.", { actual: record.release_state_used?.tag_name });
assert(record.release_state_used?.tag_commit === EXPECTED_TAG_COMMIT, "tag commit mismatch.", { actual: record.release_state_used?.tag_commit });
assert(record.release_state_used?.local_tag_verified === true, "local tag verification missing.");
assert(record.release_state_used?.remote_tag_verified === true, "remote tag verification missing.");
assert(typeof record.release_state_used?.main_head === "string" && record.release_state_used.main_head.length === 40, "main head must be recorded.");
assert(typeof record.release_state_used?.origin_main === "string" && record.release_state_used.origin_main.length === 40, "origin main must be recorded.");

assert(record.smoke_summary?.result === "pass", "summary result must be pass.");
assert(record.smoke_summary?.failed_required_command_count === 0, "failed command count must be zero.");
assert(record.smoke_summary?.launch_blocker_recorded === false, "smoke record must not record a launch blocker.");
assert(record.smoke_summary?.product_code_changed_by_smoke === false, "smoke must not change product code.");
assert(record.smoke_summary?.release_tag_changed_by_smoke === false, "smoke must not change release tag.");

assert(Array.isArray(record.smoke_commands), "smoke_commands must be an array.");
assert(record.smoke_commands.length >= REQUIRED_COMMANDS.length, "smoke command count too small.");
const commandSet = new Set(record.smoke_commands.map((entry) => entry.command));
for (const command of REQUIRED_COMMANDS) {
  assert(commandSet.has(command), "missing required smoke command.", { command });
}
for (const entry of record.smoke_commands) {
  assert(entry.required === true, "smoke command must be required.", { entry });
  assert(entry.result === "pass", "smoke command must pass.", { entry });
  assert(typeof entry.evidence_area === "string" && entry.evidence_area.length > 0, "smoke command must name evidence area.", { entry });
}

assert(Array.isArray(record.smoke_path_items), "smoke_path_items must be an array.");
const pathSet = new Set(record.smoke_path_items.map((entry) => entry.path));
for (const pathName of REQUIRED_PATHS) {
  assert(pathSet.has(pathName), "missing required smoke path item.", { pathName });
}
for (const item of record.smoke_path_items) {
  assert(item.status === "pass", "smoke path item must pass.", { item });
  assert(Array.isArray(item.evidence) && item.evidence.length > 0, "smoke path item must reference evidence.", { item });
  assert(typeof item.note === "string" && item.note.length > 0, "smoke path item must have factual note.", { item });
}

for (const [key, expected] of Object.entries({
  smoke_evidence_only: true,
  touches_product_code: false,
  touches_engine_code: false,
  changes_acceptance_gate_law: false,
  changes_registry_content: false,
  changes_release_tag: false,
  activates_post_v1_scope: false,
  creates_feature_implementation: false,
  creates_live_user_data: false,
  stores_named_founder_users: false,
  creates_commercial_claims: false
})) {
  assert(record.boundaries?.[key] === expected, "boundary mismatch.", { key, actual: record.boundaries?.[key], expected });
}

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
  assert(record.forbidden_scope?.includes(scope), "missing forbidden scope.", { scope });
}

assert(record.blocker_policy?.any_required_smoke_failure_blocks_launch === true, "required smoke failure must block launch.");
assert(record.blocker_policy?.fix_inside_smoke_slice_allowed === false, "smoke slice must not fix blockers.");
assert(record.blocker_policy?.scope_widening_allowed === false, "blocker policy must not allow scope widening.");
assert(record.blocker_policy?.release_tag_mutation_allowed === false, "blocker policy must not allow release tag mutation.");
assert(record.blocker_policy?.product_or_engine_mutation_allowed === false, "blocker policy must not allow product or engine mutation.");

for (const [key, value] of Object.entries(record.claim_boundary ?? {})) {
  assert(value === false, "claim boundary value must remain false.", { key, value });
}

assert(markdown.includes("# Controlled Launch Smoke Run"), "markdown title missing.");
assert(markdown.includes("Slice: S-V1-F-10"), "markdown slice marker missing.");
assert(markdown.includes("Overall result: pass"), "markdown result missing.");
assert(markdown.includes("Release tag: v1-controlled-launch"), "markdown tag missing.");
assert(markdown.includes("## Smoke commands"), "markdown smoke command section missing.");
assert(markdown.includes("## Minimum controlled-launch path evidence"), "markdown path evidence section missing.");
assert(markdown.includes("## Blocker rule"), "markdown blocker section missing.");
assert(markdown.includes("separate fix slice"), "markdown must require separate fix slice for blockers.");

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
  assert(!markdown.toLowerCase().includes(forbiddenPhrase), "forbidden phrase found.", { forbiddenPhrase });
}

assert(pkg.scripts?.["proof:s-v1-f-10"]?.includes("test/s_v1_f_10_controlled_launch_smoke_run.test.mjs"), "proof:s-v1-f-10 test wiring missing.");
assert(pkg.scripts?.["proof:s-v1-f-10"]?.includes("ci/guards/s_v1_f_10_controlled_launch_smoke_run_guard.mjs"), "proof:s-v1-f-10 guard wiring missing.");
assert(pkg.scripts?.["lint:fast"]?.includes("test/s_v1_f_10_controlled_launch_smoke_run.test.mjs"), "lint:fast test wiring missing.");
assert(pkg.scripts?.["lint:fast"]?.includes("ci/guards/s_v1_f_10_controlled_launch_smoke_run_guard.mjs"), "lint:fast guard wiring missing.");
assert(pkg.scripts?.["lint:fast:inline"]?.includes("test/s_v1_f_10_controlled_launch_smoke_run.test.mjs"), "lint:fast:inline test wiring missing.");
assert(pkg.scripts?.["lint:fast:inline"]?.includes("ci/guards/s_v1_f_10_controlled_launch_smoke_run_guard.mjs"), "lint:fast:inline guard wiring missing.");

assert(Array.isArray(surfaces), "packaging registry surfaces must be an array.");
assert(!surfaces.includes("docs/releases/CONTROLLED_LAUNCH_SMOKE_RUN.json"), "controlled launch smoke JSON must not be in v1 packaging registry.");
assert(!surfaces.includes("docs/releases/CONTROLLED_LAUNCH_SMOKE_RUN.md"), "controlled launch smoke markdown must not be in v1 packaging registry.");

console.log(JSON.stringify({
  ok: true,
  guard: "S-V1-F-10",
  token: TOKEN,
  tag: EXPECTED_TAG,
  tag_commit: EXPECTED_TAG_COMMIT,
  smoke_command_count: record.smoke_commands.length,
  smoke_path_count: record.smoke_path_items.length,
  message: "Controlled launch smoke run passed."
}, null, 2));
