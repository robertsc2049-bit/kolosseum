// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * @file S-V1-F-08 release evidence snapshot guard.
 * @desc Proves the controlled v1 release evidence snapshot is factual, post-tag,
 * and bounded to release evidence only.
 *
 * DEV NOTE: S-V1-F-08 guard. This guard verifies the evidence snapshot created
 * after the controlled v1 tag exists. It does not verify live GitHub state in CI;
 * live tag checks are part of the local release execution proof. The guard only
 * proves that committed evidence records the exact tag, commit, ship decision,
 * proof commands, and non-authoritative release boundaries.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const EXPECTED_TAG = "v1-controlled-launch";
const EXPECTED_COMMIT = "43510e4c4d791effda647e80dc74d8452dc61f1f";
const TOKEN = "CI_V1_RELEASE_EVIDENCE_SNAPSHOT";

const REQUIRED_FILES = [
  "docs/releases/V1_RELEASE_EVIDENCE_SNAPSHOT.md",
  "docs/releases/V1_RELEASE_EVIDENCE_SNAPSHOT.json",
  "docs/releases/V1_FINAL_SHIP_DECISION.md",
  "docs/releases/V1_FINAL_SHIP_DECISION.json",
  "docs/releases/V1_RELEASE_TAG_PREPARATION.md",
  "docs/releases/V1_RELEASE_TAG_PREPARATION.json",
  "docs/v1/V1_ACCEPTANCE_GATE_MANIFEST.json",
  "test/s_v1_f_08_release_evidence_snapshot.test.mjs",
  "ci/guards/s_v1_f_08_release_evidence_snapshot_guard.mjs"
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
  assert(fs.existsSync(path.join(ROOT, file)), "S-V1-F-08 required file missing.", { file });
}

const record = readJson("docs/releases/V1_RELEASE_EVIDENCE_SNAPSHOT.json");
const markdown = readText("docs/releases/V1_RELEASE_EVIDENCE_SNAPSHOT.md");
const pkg = readJson("package.json");

assert(record.slice_id === "S-V1-F-08", "slice_id mismatch.", { actual: record.slice_id });
assert(record.record_id === "controlled_v1_release_evidence_snapshot", "record_id mismatch.", { actual: record.record_id });
assert(record.status === "recorded", "status mismatch.", { actual: record.status });
assert(record.evidence_type === "post_tag_release_state", "evidence_type mismatch.", { actual: record.evidence_type });

assert(record.release?.tag_name === EXPECTED_TAG, "tag_name mismatch.", { actual: record.release?.tag_name });
assert(record.release?.tag_object_type === "tag", "tag_object_type mismatch.", { actual: record.release?.tag_object_type });
assert(/^[0-9a-f]{40}$/.test(record.release?.tag_object_sha ?? ""), "tag_object_sha must be a 40-character SHA.");
assert(record.release?.verified_main_commit === EXPECTED_COMMIT, "verified_main_commit mismatch.", { actual: record.release?.verified_main_commit });
assert(record.release?.main_head_at_snapshot === EXPECTED_COMMIT, "main_head_at_snapshot mismatch.", { actual: record.release?.main_head_at_snapshot });
assert(record.release?.origin_main_at_snapshot === EXPECTED_COMMIT, "origin_main_at_snapshot mismatch.", { actual: record.release?.origin_main_at_snapshot });
assert(record.release?.local_tag_commit === EXPECTED_COMMIT, "local_tag_commit mismatch.", { actual: record.release?.local_tag_commit });
assert(record.release?.remote_tag_commit === EXPECTED_COMMIT, "remote_tag_commit mismatch.", { actual: record.release?.remote_tag_commit });
assert(record.release?.tag_points_to_verified_main_commit === true, "tag must point to verified main commit.");
assert(record.release?.tag_ref_summary?.includes(EXPECTED_TAG), "tag_ref_summary must include tag.");
assert(record.release?.tag_ref_summary?.includes(EXPECTED_COMMIT), "tag_ref_summary must include verified commit.");

assert(record.ship_decision?.slice_id === "S-V1-F-05", "ship decision slice mismatch.");
assert(record.ship_decision?.decision === "SHIP", "ship decision mismatch.");
assert(record.ship_decision?.proof_command === "npm.cmd run proof:s-v1-f-05", "ship decision proof command mismatch.");
assert(record.ship_decision?.success_marker === "S-V1-F-05 V1_FINAL_SHIP_DECISION_CHECK_PASS", "ship decision success marker mismatch.");

const commands = new Set(record.proof_commands.map((entry) => entry.command));
for (const command of [
  "npm.cmd run proof:s-v1-f-05",
  "node ci/guards/postv1_packaging_surface_registry_guard.mjs",
  "git rev-list -n 1 v1-controlled-launch",
  "git ls-remote --tags origin refs/tags/v1-controlled-launch refs/tags/v1-controlled-launch^{}",
  "npm.cmd run lint:fast"
]) {
  assert(commands.has(command), "required proof command missing.", { command });
}

assert(record.release_boundaries?.factual_only === true, "snapshot must be factual only.");
assert(record.release_boundaries?.creates_product_code === false, "snapshot must not create product code.");
assert(record.release_boundaries?.changes_engine_behaviour === false, "snapshot must not change engine behaviour.");
assert(record.release_boundaries?.changes_feature_implementation === false, "snapshot must not change feature implementation.");
assert(record.release_boundaries?.changes_acceptance_gate_law === false, "snapshot must not change acceptance law.");
assert(record.release_boundaries?.changes_release_tag === false, "snapshot must not change release tag.");
assert(record.release_boundaries?.creates_commercial_claims === false, "snapshot must not create commercial claims.");

assert(markdown.includes("# v1 release evidence snapshot"), "markdown heading missing.");
assert(markdown.includes("Slice: S-V1-F-08"), "markdown slice marker missing.");
assert(markdown.includes(`Tag: ${EXPECTED_TAG}`), "markdown tag missing.");
assert(markdown.includes(`Verified main commit: ${EXPECTED_COMMIT}`), "markdown commit missing.");
assert(markdown.includes("Ship decision slice: S-V1-F-05"), "markdown ship decision reference missing.");
assert(!markdown.includes("partially complete"), "snapshot must not say v1 is partially complete.");
assert(!markdown.includes("partially-complete"), "snapshot must not say v1 is partially-complete.");

assert(pkg.scripts?.["proof:s-v1-f-08"]?.includes("test/s_v1_f_08_release_evidence_snapshot.test.mjs"), "proof:s-v1-f-08 test wiring missing.");
assert(pkg.scripts?.["proof:s-v1-f-08"]?.includes("ci/guards/s_v1_f_08_release_evidence_snapshot_guard.mjs"), "proof:s-v1-f-08 guard wiring missing.");
assert(pkg.scripts?.["lint:fast"]?.includes("test/s_v1_f_08_release_evidence_snapshot.test.mjs"), "lint:fast test wiring missing.");
assert(pkg.scripts?.["lint:fast"]?.includes("ci/guards/s_v1_f_08_release_evidence_snapshot_guard.mjs"), "lint:fast guard wiring missing.");

console.log(JSON.stringify({
  ok: true,
  guard: "S-V1-F-08",
  token: TOKEN,
  tag: EXPECTED_TAG,
  commit: EXPECTED_COMMIT,
  message: "Release evidence snapshot passed."
}, null, 2));
