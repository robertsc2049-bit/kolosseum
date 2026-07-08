import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const DOC_PATH = "docs/releases/V1_RELEASE_TAG_PREPARATION.md";
const JSON_PATH = "docs/releases/V1_RELEASE_TAG_PREPARATION.json";
const PACKAGE_PATH = "package.json";
const GUARD_PATH = "ci/guards/s_v1_f_04_v1_release_tag_preparation_guard.mjs";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

test("S-V1-F-04 release tag preparation record exists and does not create a tag", () => {
  const record = readJson(JSON_PATH);

  assert.equal(record.slice_id, "S-V1-F-04");
  assert.equal(record.record_state, "preparation_only_not_tagged");
  assert.equal(record.candidate_tag, "v1-controlled-launch");

  assert.equal(record.authority_boundary.creates_git_tag, false);
  assert.equal(record.authority_boundary.pushes_git_tag, false);
  assert.equal(record.authority_boundary.changes_package_version, false);
  assert.equal(record.authority_boundary.implements_feature, false);
  assert.equal(record.authority_boundary.changes_engine_behaviour, false);
  assert.equal(record.authority_boundary.changes_acceptance_manifest, false);
  assert.equal(record.authority_boundary.activates_post_v1_scope, false);
});

test("S-V1-F-04 blocks tag creation unless acceptance and full fast gates are recorded", () => {
  const record = readJson(JSON_PATH);

  assert.deepEqual(record.required_pre_tag_order, [
    "clean_repository_state_checked",
    "v1_acceptance_check_passed",
    "release_notes_and_version_docs_checked",
    "full_fast_gate_passed",
    "current_commit_confirmed_on_main",
    "operator_confirms_candidate_tag_name"
  ]);

  assert.ok(record.tag_block_conditions.includes("acceptance_check_not_passed"));
  assert.ok(record.tag_block_conditions.includes("full_fast_gate_not_passed"));
  assert.ok(record.tag_block_conditions.includes("dirty_working_tree"));
  assert.ok(record.tag_block_conditions.includes("candidate_tag_already_exists"));
});

test("S-V1-F-04 release tag preparation uses factual non-claim boundaries", () => {
  const docText = fs.readFileSync(DOC_PATH, "utf8");
  const record = readJson(JSON_PATH);

  for (const deniedClaim of [
    "safety",
    "suitability",
    "effectiveness",
    "external approval",
    "certification",
    "athlete clearance",
    "coach clearance",
    "training approval",
    "outcome guarantee"
  ]) {
    assert.ok(
      record.unsupported_claims_must_not_state_or_imply.includes(deniedClaim),
      `missing denied claim: ${deniedClaim}`
    );
  }

  assert.match(docText, /This slice must not create a git tag/);
  assert.match(docText, /does not release the product by itself/);
  assert.match(docText, /The tag command remains blocked/);
});

test("S-V1-F-04 package entrypoints are wired without replacing release scripts", () => {
  const pkg = readJson(PACKAGE_PATH);

  assert.equal(typeof pkg.scripts["release:prepare"], "string");
  assert.equal(typeof pkg.scripts["release:tag"], "string");
  assert.equal(typeof pkg.scripts["acceptance:v1:check"], "string");

  const f04Proof = "node --test test/s_v1_f_04_v1_release_tag_preparation.test.mjs && node ci/guards/s_v1_f_04_v1_release_tag_preparation_guard.mjs";

  assert.equal(pkg.scripts["proof:s-v1-f-04"], `npm run acceptance:v1:check && ${f04Proof}`);
  assert.ok(pkg.scripts["lint:fast"].includes(f04Proof));
  assert.ok(pkg.scripts["lint:fast:inline"].includes(f04Proof));
});

test("S-V1-F-04 guard passes", () => {
  const result = spawnSync(process.execPath, [GUARD_PATH], {
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});
