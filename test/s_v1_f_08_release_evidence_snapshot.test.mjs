import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SNAPSHOT_JSON_PATH = path.join(ROOT, "docs/releases/V1_RELEASE_EVIDENCE_SNAPSHOT.json");
const SNAPSHOT_MD_PATH = path.join(ROOT, "docs/releases/V1_RELEASE_EVIDENCE_SNAPSHOT.md");
const PACKAGE_JSON_PATH = path.join(ROOT, "package.json");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

const EXPECTED_TAG = "v1-controlled-launch";
const EXPECTED_COMMIT = "43510e4c4d791effda647e80dc74d8452dc61f1f";

test("S-V1-F-08 release evidence snapshot files exist", () => {
  assert.equal(fs.existsSync(SNAPSHOT_JSON_PATH), true);
  assert.equal(fs.existsSync(SNAPSHOT_MD_PATH), true);
});

test("S-V1-F-08 records exact controlled release tag and commit", () => {
  const record = readJson("docs/releases/V1_RELEASE_EVIDENCE_SNAPSHOT.json");

  assert.equal(record.slice_id, "S-V1-F-08");
  assert.equal(record.record_id, "controlled_v1_release_evidence_snapshot");
  assert.equal(record.status, "recorded");
  assert.equal(record.release.tag_name, EXPECTED_TAG);
  assert.equal(record.release.verified_main_commit, EXPECTED_COMMIT);
  assert.equal(record.release.main_head_at_snapshot, EXPECTED_COMMIT);
  assert.equal(record.release.origin_main_at_snapshot, EXPECTED_COMMIT);
  assert.equal(record.release.local_tag_commit, EXPECTED_COMMIT);
  assert.equal(record.release.remote_tag_commit, EXPECTED_COMMIT);
  assert.equal(record.release.tag_points_to_verified_main_commit, true);
  assert.equal(record.release.tag_object_type, "tag");
  assert.match(record.release.tag_object_sha, /^[0-9a-f]{40}$/);
});

test("S-V1-F-08 references the final ship decision and required proof", () => {
  const record = readJson("docs/releases/V1_RELEASE_EVIDENCE_SNAPSHOT.json");
  const commands = record.proof_commands.map((entry) => entry.command);

  assert.equal(record.ship_decision.slice_id, "S-V1-F-05");
  assert.equal(record.ship_decision.decision, "SHIP");
  assert.equal(record.ship_decision.markdown_path, "docs/releases/V1_FINAL_SHIP_DECISION.md");
  assert.equal(record.ship_decision.json_path, "docs/releases/V1_FINAL_SHIP_DECISION.json");
  assert.equal(record.ship_decision.proof_command, "npm.cmd run proof:s-v1-f-05");
  assert.equal(record.ship_decision.success_marker, "S-V1-F-05 V1_FINAL_SHIP_DECISION_CHECK_PASS");

  assert.ok(commands.includes("npm.cmd run proof:s-v1-f-05"));
  assert.ok(commands.includes("node ci/guards/postv1_packaging_surface_registry_guard.mjs"));
  assert.ok(commands.includes("git rev-list -n 1 v1-controlled-launch"));
  assert.ok(commands.includes("git ls-remote --tags origin refs/tags/v1-controlled-launch refs/tags/v1-controlled-launch^{}"));
  assert.ok(commands.includes("npm.cmd run lint:fast"));
});

test("S-V1-F-08 release evidence remains factual and non-authoritative", () => {
  const record = readJson("docs/releases/V1_RELEASE_EVIDENCE_SNAPSHOT.json");

  assert.equal(record.release_boundaries.factual_only, true);
  assert.equal(record.release_boundaries.creates_product_code, false);
  assert.equal(record.release_boundaries.changes_engine_behaviour, false);
  assert.equal(record.release_boundaries.changes_feature_implementation, false);
  assert.equal(record.release_boundaries.changes_acceptance_gate_law, false);
  assert.equal(record.release_boundaries.changes_release_tag, false);
  assert.equal(record.release_boundaries.creates_commercial_claims, false);

  const unsupportedClaims = record.release_boundaries.unsupported_claims.join("\n");
  assert.match(unsupportedClaims, /No athlete condition claim is made\./);
  assert.match(unsupportedClaims, /No programme effect claim is made\./);
  assert.match(unsupportedClaims, /No automated selection claim is made\./);
  assert.match(unsupportedClaims, /No ranking or recommendation claim is made\./);
  assert.match(unsupportedClaims, /No training advice claim is made\./);
});

test("S-V1-F-08 markdown mirrors release identity without incomplete wording", () => {
  const markdown = readText("docs/releases/V1_RELEASE_EVIDENCE_SNAPSHOT.md");

  assert.ok(markdown.includes("# v1 release evidence snapshot"));
  assert.ok(markdown.includes("Slice: S-V1-F-08"));
  assert.ok(markdown.includes(`Tag: ${EXPECTED_TAG}`));
  assert.ok(markdown.includes(`Verified main commit: ${EXPECTED_COMMIT}`));
  assert.ok(markdown.includes("Ship decision slice: S-V1-F-05"));
  assert.ok(markdown.includes("Ship decision: SHIP"));
  assert.ok(markdown.includes("This evidence is factual only."));

  assert.equal(markdown.includes("partially complete"), false);
  assert.equal(markdown.includes("partially-complete"), false);
});

test("S-V1-F-08 package proof script is wired", () => {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8"));

  assert.ok(pkg.scripts["proof:s-v1-f-08"].includes("test/s_v1_f_08_release_evidence_snapshot.test.mjs"));
  assert.ok(pkg.scripts["proof:s-v1-f-08"].includes("ci/guards/s_v1_f_08_release_evidence_snapshot_guard.mjs"));
  assert.ok(pkg.scripts["lint:fast"].includes("test/s_v1_f_08_release_evidence_snapshot.test.mjs"));
  assert.ok(pkg.scripts["lint:fast"].includes("ci/guards/s_v1_f_08_release_evidence_snapshot_guard.mjs"));
});
