import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";

import {
  REG_FULL_08_SOURCE_SPECS,
  REG_FULL_08_PROJECT_OWNED_POLICY,
  REG_FULL_08_PATHS,
  loadRegFull08Sources,
  buildRegFull08Registry,
  exactCopyControlsForRecord,
  canonicalize
} from "../scripts/reg_full_08_materialize_copy_provenance.mjs";
import {
  TOKEN,
  REG_FULL_08_GUARD_SOURCE_SPECS,
  validateRegFull08Closure
} from "../ci/registry/reg_full_08_copy_instructions_provenance_closure.mjs";

const ROOT = process.cwd();
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

function loadGeneratedRegistry() {
  return JSON.parse(fs.readFileSync(REG_FULL_08_PATHS.canonicalCopy, "utf8"));
}

function findSource(loaded, key) {
  const source = loaded.find((item) => item.spec.source_key === key);
  assert.ok(source, `missing source ${key}`);
  return source;
}

test("REG-FULL-08 source inventory is explicit and independently duplicated by the guard", () => {
  assert.equal(REG_FULL_08_SOURCE_SPECS.length, 18);
  assert.equal(REG_FULL_08_GUARD_SOURCE_SPECS.length, 18);
  assert.deepEqual(
    REG_FULL_08_SOURCE_SPECS.map((item) => item.source_file).sort(),
    REG_FULL_08_GUARD_SOURCE_SPECS.map((item) => item.file).sort()
  );
  assert.equal(new Set(REG_FULL_08_SOURCE_SPECS.map((item) => item.source_file)).size, 18);
});

test("REG-FULL-08 canonical copy schema requires the full provenance contract", () => {
  const schema = JSON.parse(fs.readFileSync(REG_FULL_08_PATHS.copySchema, "utf8"));
  const row = schema.properties.entries.additionalProperties;
  for (const field of [
    "source_registry_id", "source_record_id", "source_file", "source_authority", "source", "source_reference",
    "source_git_blob_sha", "source_file_sha256", "license_status", "commercial_use_status", "manual_review_status",
    "legal_review_status", "record_sha256", "exact_copy_policy", "exact_copy_controls"
  ]) assert.ok(row.required.includes(field), field);
  assert.deepEqual(row.properties.source.enum, ["founder_original", "licensed_source", "canonical_project_document"]);
});

test("REG-FULL-08 materializer creates exactly one provenance record per active source record", () => {
  const loaded = loadRegFull08Sources(ROOT);
  const registry = buildRegFull08Registry(loaded);
  const sourceRows = loaded.reduce((sum, item) => sum + item.rows.length, 0);
  assert.equal(Object.keys(registry.entries).length, sourceRows);
  assert.ok(sourceRows > 0);
});

test("REG-FULL-08 project-owned current-content policy is explicit and commercial-use permitted", () => {
  assert.deepEqual(REG_FULL_08_PROJECT_OWNED_POLICY, {
    source: "canonical_project_document",
    license_status: "project_owned",
    commercial_use_status: "permitted",
    manual_review_status: "approved",
    legal_review_status: "project_owned_clear",
    exact_copy_policy: "sha256_exact_utf8"
  });
});

test("exercise instructions and labels receive exact UTF-8 copy hashes", () => {
  const loaded = loadRegFull08Sources(ROOT);
  const exercise = findSource(loaded, "exercise").rows.find((item) => item.row_id === "back_squat");
  assert.ok(exercise);
  const controls = exactCopyControlsForRecord(exercise.row);
  const paths = new Set(controls.map((item) => item.field_path));
  assert.ok(paths.has("display_label"));
  assert.ok(paths.has("instruction_short_text"));
  assert.ok(paths.has("instruction_detail_text[0]"));
  const short = controls.find((item) => item.field_path === "instruction_short_text");
  assert.equal(short.text_sha256, sha256(Buffer.from(exercise.row.instruction_short_text, "utf8")));
});

test("active beta copy text is included in exact-copy control coverage", () => {
  const loaded = loadRegFull08Sources(ROOT);
  const beta = findSource(loaded, "beta_copy_root").rows.find((item) => item.row_id === "beta.onboarding.title");
  assert.ok(beta);
  const controls = exactCopyControlsForRecord(beta.row);
  assert.deepEqual(controls, [{ field_path: "text", text_sha256: sha256(Buffer.from(beta.row.text, "utf8")) }]);
});

test("record canonicalization is key-order stable but content-sensitive", () => {
  const a = { z: 1, a: { y: "Instruction", x: 2 } };
  const b = { a: { x: 2, y: "Instruction" }, z: 1 };
  const c = { a: { x: 2, y: "Changed instruction" }, z: 1 };
  assert.deepEqual(canonicalize(a), canonicalize(b));
  assert.notDeepEqual(canonicalize(a), canonicalize(c));
});

test("materialized provenance never silently infers licensed content", () => {
  const loaded = loadRegFull08Sources(ROOT);
  const registry = buildRegFull08Registry(loaded);
  for (const row of Object.values(registry.entries)) {
    assert.equal(row.source, "canonical_project_document");
    assert.equal(row.license_status, "project_owned");
    assert.equal(row.commercial_use_status, "permitted");
    assert.equal(row.manual_review_status, "approved");
    assert.equal(row.legal_review_status, "project_owned_clear");
  }
});

test("REG-FULL-08 independent closure passes the committed generated authority", () => {
  const result = validateRegFull08Closure({ repoRoot: ROOT });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.token, TOKEN);
  assert.equal(result.summary.source_files, 18);
  assert.equal(result.summary.source_records, result.summary.provenance_records);
});

test("REG-FULL-08 closure rejects silent provenance record removal", () => {
  const registry = structuredClone(loadGeneratedRegistry());
  const first = Object.keys(registry.entries).sort()[0];
  delete registry.entries[first];
  const result = validateRegFull08Closure({ repoRoot: ROOT, registryOverride: registry });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.code === "PROVENANCE_COVERAGE_SET"));
});

test("REG-FULL-08 closure rejects commercial-use or review-status downgrades", () => {
  const registry = structuredClone(loadGeneratedRegistry());
  const first = Object.keys(registry.entries).sort()[0];
  registry.entries[first].commercial_use_status = "restricted";
  registry.entries[first].manual_review_status = "pending";
  const result = validateRegFull08Closure({ repoRoot: ROOT, registryOverride: registry });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.code === "PROVENANCE_RECORD_DRIFT" || item.code === "ACTIVE_CONTENT_REVIEW_STATUS"));
});
