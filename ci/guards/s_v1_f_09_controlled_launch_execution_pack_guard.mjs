// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * @file S-V1-F-09 controlled launch execution pack guard.
 * @desc Proves the controlled launch execution pack is operational evidence only.
 *
 * DEV NOTE: S-V1-F-09 guard. This guard verifies the operator-facing launch
 * checklist and evidence path after the controlled v1 tag and release evidence
 * snapshot exist. It does not permit launch by itself and does not create
 * product, engine, feature, commercial, organisation, gym, team, federation,
 * marketplace, messaging, or post-v1 authority.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const EXPECTED_TAG = "v1-controlled-launch";
const EXPECTED_TAG_COMMIT = "43510e4c4d791effda647e80dc74d8452dc61f1f";
const TOKEN = "CI_V1_CONTROLLED_LAUNCH_EXECUTION_PACK";

const REQUIRED_FILES = [
  "docs/releases/CONTROLLED_LAUNCH_EXECUTION_PACK.md",
  "docs/releases/CONTROLLED_LAUNCH_EXECUTION_PACK.json",
  "docs/releases/CONTROLLED_LAUNCH_READINESS_RECORD.md",
  "docs/releases/CONTROLLED_LAUNCH_READINESS_RECORD.json",
  "docs/releases/V1_FINAL_SHIP_DECISION.md",
  "docs/releases/V1_FINAL_SHIP_DECISION.json",
  "docs/releases/V1_RELEASE_EVIDENCE_SNAPSHOT.md",
  "docs/releases/V1_RELEASE_EVIDENCE_SNAPSHOT.json",
  "test/s_v1_f_09_controlled_launch_execution_pack.test.mjs",
  "ci/guards/s_v1_f_09_controlled_launch_execution_pack_guard.mjs"
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
  assert(fs.existsSync(path.join(ROOT, file)), "S-V1-F-09 required file missing.", { file });
}

const record = readJson("docs/releases/CONTROLLED_LAUNCH_EXECUTION_PACK.json");
const markdown = readText("docs/releases/CONTROLLED_LAUNCH_EXECUTION_PACK.md");
const pkg = readJson("package.json");

assert(record.slice_id === "S-V1-F-09", "slice_id mismatch.", { actual: record.slice_id });
assert(record.record_id === "controlled_launch_execution_pack", "record_id mismatch.", { actual: record.record_id });
assert(record.status === "prepared", "status mismatch.", { actual: record.status });
assert(record.scope === "controlled_launch_only", "scope mismatch.", { actual: record.scope });

assert(record.release_identity?.tag_name === EXPECTED_TAG, "tag name mismatch.", { actual: record.release_identity?.tag_name });
assert(record.release_identity?.tag_commit === EXPECTED_TAG_COMMIT, "tag commit mismatch.", { actual: record.release_identity?.tag_commit });
assert(record.release_identity?.release_evidence_snapshot === "docs/releases/V1_RELEASE_EVIDENCE_SNAPSHOT.json", "release evidence snapshot reference mismatch.");
assert(record.release_identity?.final_ship_decision === "docs/releases/V1_FINAL_SHIP_DECISION.json", "final ship decision reference mismatch.");
assert(record.release_identity?.controlled_launch_readiness_record === "docs/releases/CONTROLLED_LAUNCH_READINESS_RECORD.json", "controlled launch readiness record reference mismatch.");

assert(record.launch_start_rule?.this_pack_marks_v1_live === false, "pack must not mark v1 live.");
assert(record.launch_start_rule?.this_pack_changes_product_state === false, "pack must not change product state.");
for (const requirement of [
  "release_tag_exists_locally_and_remotely",
  "release_evidence_snapshot_exists",
  "final_ship_decision_records_ship",
  "controlled_launch_readiness_record_is_completed_by_operator"
]) {
  assert(record.launch_start_rule?.may_start_only_when?.includes(requirement), "missing launch start requirement.", { requirement });
}

for (const [key, expected] of Object.entries({
  operational_evidence_only: true,
  creates_product_code: false,
  changes_engine_behaviour: false,
  changes_feature_implementation: false,
  changes_onboarding_logic: false,
  changes_pricing_logic: false,
  creates_marketplace_scope: false,
  creates_organisation_scope: false,
  creates_gym_scope: false,
  creates_team_scope: false,
  creates_federation_scope: false,
  creates_enterprise_dashboard_scope: false,
  creates_messaging_scope: false,
  creates_commercial_claims: false
})) {
  assert(record.boundaries?.[key] === expected, "boundary mismatch.", { key, actual: record.boundaries?.[key], expected });
}

assert(Array.isArray(record.operator_checklist), "operator checklist must be an array.");
assert(record.operator_checklist.length >= 10, "operator checklist must contain launch day checks.");
assert(record.operator_checklist.some((entry) => entry.id === "CLX-001"), "operator checklist missing CLX-001.");
assert(record.operator_checklist.some((entry) => entry.id === "CLX-012"), "operator checklist missing CLX-012.");
assert(record.operator_checklist.every((entry) => typeof entry.evidence === "string" && entry.evidence.length > 0), "every operator checklist entry must name evidence.");

assert(Array.isArray(record.evidence_capture_path), "evidence capture path must be an array.");
for (const evidence of [
  "release_tag",
  "release_evidence_snapshot",
  "final_ship_decision",
  "controlled_launch_readiness_record",
  "founder_test_pack",
  "acceptance_runner",
  "claim_boundary_check",
  "support_and_defect_route"
]) {
  assert(record.evidence_capture_path.some((entry) => entry.evidence === evidence), "missing evidence path entry.", { evidence });
}

assert(record.launch_blocking_defect_path?.engine_mutation_allowed === false, "defect path must not allow engine mutation.");
assert(record.launch_blocking_defect_path?.scope_widening_allowed === false, "defect path must not allow scope widening.");
for (const field of [
  "defect_id",
  "detected_at_utc",
  "detected_by",
  "affected_path",
  "evidence_reference",
  "owner",
  "current_state",
  "closure_reference"
]) {
  assert(record.launch_blocking_defect_path?.required_record_fields?.includes(field), "missing required defect field.", { field });
}

for (const scope of [
  "product_code",
  "engine_behaviour",
  "feature_implementation",
  "onboarding_feature_logic",
  "pricing_logic",
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

for (const [key, value] of Object.entries(record.claim_boundary ?? {})) {
  assert(value === false, "claim boundary must remain false.", { key, value });
}

assert(markdown.includes("# Controlled Launch Execution Pack"), "markdown heading missing.");
assert(markdown.includes("Slice: S-V1-F-09"), "markdown slice marker missing.");
assert(markdown.includes("## Operator-facing checklist"), "operator checklist section missing.");
assert(markdown.includes("## Controlled launch evidence path"), "evidence path section missing.");
assert(markdown.includes("## Founding user account setup instructions"), "account setup section missing.");
assert(markdown.includes("## Founder test instructions"), "founder test section missing.");
assert(markdown.includes("## Support and defect route references"), "support and defect section missing.");
assert(markdown.includes("This pack does not mark v1 live by itself."), "must state pack does not mark live.");
assert(markdown.includes("v1-controlled-launch"), "tag reference missing.");
assert(markdown.includes("docs/releases/V1_RELEASE_EVIDENCE_SNAPSHOT.md"), "release evidence snapshot reference missing.");
assert(markdown.includes("docs/releases/V1_FINAL_SHIP_DECISION.md"), "final ship decision reference missing.");
assert(markdown.includes("docs/releases/CONTROLLED_LAUNCH_READINESS_RECORD.md"), "controlled launch readiness record reference missing.");
assert(!markdown.includes("partially complete"), "must not use incomplete completion wording.");
assert(!markdown.includes("partially-complete"), "must not use incomplete completion wording.");

for (const forbiddenPhrase of [
  "guaranteed outcome",
  "guarantees outcomes",
  "certified use",
  "athlete clearance",
  "coach clearance",
  "external approval",
  "return to play",
  "return-to-play",
  "return to run",
  "return-to-run",
  "fitness for duty",
  "fitness-for-duty"
]) {
  assert(!markdown.toLowerCase().includes(forbiddenPhrase), "forbidden claim phrase found.", { forbiddenPhrase });
}

assert(pkg.scripts?.["proof:s-v1-f-09"]?.includes("test/s_v1_f_09_controlled_launch_execution_pack.test.mjs"), "proof:s-v1-f-09 test wiring missing.");
assert(pkg.scripts?.["proof:s-v1-f-09"]?.includes("ci/guards/s_v1_f_09_controlled_launch_execution_pack_guard.mjs"), "proof:s-v1-f-09 guard wiring missing.");
assert(pkg.scripts?.["lint:fast"]?.includes("test/s_v1_f_09_controlled_launch_execution_pack.test.mjs"), "lint:fast test wiring missing.");
assert(pkg.scripts?.["lint:fast"]?.includes("ci/guards/s_v1_f_09_controlled_launch_execution_pack_guard.mjs"), "lint:fast guard wiring missing.");
assert(pkg.scripts?.["lint:fast:inline"]?.includes("test/s_v1_f_09_controlled_launch_execution_pack.test.mjs"), "lint:fast:inline test wiring missing.");
assert(pkg.scripts?.["lint:fast:inline"]?.includes("ci/guards/s_v1_f_09_controlled_launch_execution_pack_guard.mjs"), "lint:fast:inline guard wiring missing.");

console.log(JSON.stringify({
  ok: true,
  guard: "S-V1-F-09",
  token: TOKEN,
  tag: EXPECTED_TAG,
  tag_commit: EXPECTED_TAG_COMMIT,
  checklist_items: record.operator_checklist.length,
  evidence_items: record.evidence_capture_path.length,
  message: "Controlled launch execution pack passed."
}, null, 2));
