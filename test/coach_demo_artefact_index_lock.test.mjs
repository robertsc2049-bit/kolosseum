import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function readText(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

function readJson(relPath) {
  return JSON.parse(readText(relPath));
}

const indexPath = "docs/commercial/V0_COACH_DEMO_ARTEFACT_INDEX.md";
const registryPath = "docs/commercial/V0_COACH_DEMO_ARTEFACT_INDEX_REGISTRY.json";

const EXPECTED_GROUP_IDS = [
  "coach_demo_execution_support",
  "coach_value_pack",
  "declaration_error_boundary",
  "export_nothing_boundary",
  "first_sale_demo_checklist",
  "founder_demo_boundary",
].sort();

const EXPECTED_ARTEFACTS = [
  "ci/locks/v0_export_nothing_scope.json",
  "docs/commercial/V0_COACH_TIER_VALUE_CLAIM_REGISTRY.json",
  "docs/commercial/V0_COACH_TIER_VALUE_PROOF_PACK.md",
  "docs/commercial/V0_FIRST_SALE_DEMO_CHECKLIST.md",
  "docs/commercial/V0_FIRST_SALE_DEMO_CHECKLIST_REGISTRY.json",
  "docs/v1/V1_DECLARATION_ERROR_UX_CONTRACT.md",
  "docs/v1/V1_EXPORT_NOTHING_V0_GUARD.md",
  "docs/v1/V1_FOUNDER_DEMO_UI_COPY_LOCK.md",
  "src/ui/copy/declaration_error_copy.ts",
  "src/ui/copy/founder_demo_copy.ts",
  "test/coach_tier_value_proof_pack.test.mjs",
  "test/declaration_error_ux_contract.test.mjs",
  "test/first_sale_demo_checklist.test.mjs",
  "test/founder_demo_ui_copy_lock.test.mjs",
  "test/v0_export_nothing_guard.test.mjs",
].sort();

function flattenArtefacts(registry) {
  return registry.artefact_groups.flatMap((group) => group.artefacts);
}

test("coach demo artefact index registry is pinned exactly", () => {
  const registry = readJson(registryPath);
  assert.equal(registry.schema_version, "kolosseum.v0.coach_demo_artefact_index.v1.0.0");
  const groupIds = registry.artefact_groups.map((group) => group.group_id).sort();
  assert.deepEqual(groupIds, EXPECTED_GROUP_IDS);
});

test("every indexed artefact exists", () => {
  const registry = readJson(registryPath);
  for (const relPath of flattenArtefacts(registry)) {
    assert.equal(fs.existsSync(path.join(repoRoot, relPath)), true, `missing indexed artefact: ${relPath}`);
  }
});

test("indexed artefacts are duplicate-free and pinned exactly", () => {
  const registry = readJson(registryPath);
  const artefacts = flattenArtefacts(registry);
  const unique = [...new Set(artefacts)].sort();
  assert.equal(unique.length, artefacts.length, "duplicate artefact reference detected in coach demo artefact index");
  assert.deepEqual(unique, EXPECTED_ARTEFACTS);
});

test("artefact index markdown contains all required group headings", () => {
  const text = readText(indexPath);
  const headings = [...text.matchAll(/^###\s+([a-z_]+)$/gm)].map((match) => match[1]).sort();
  assert.deepEqual(headings, EXPECTED_GROUP_IDS);
});

test("artefact index markdown references every pinned artefact path", () => {
  const text = readText(indexPath);
  for (const relPath of EXPECTED_ARTEFACTS) {
    assert.equal(text.includes(relPath), true, `artefact path missing from markdown index: ${relPath}`);
  }
});