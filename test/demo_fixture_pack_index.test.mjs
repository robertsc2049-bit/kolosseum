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

const indexPath = "docs/demo/V1_DEMO_FIXTURE_PACK_INDEX.md";
const registryPath = "docs/demo/V1_DEMO_FIXTURE_PACK_INDEX_REGISTRY.json";

const EXPECTED_GROUP_IDS = [
  "demo_fixture_pack_contract",
  "fixture_data",
  "fixture_proof_surfaces",
  "fixture_support_surfaces",
  "founder_demo_path_contract",
].sort();

const EXPECTED_ARTEFACTS = [
  "docs/commercial/V0_COACH_DEMO_ARTEFACT_INDEX.md",
  "docs/commercial/V0_COACH_DEMO_SURFACE_CLAIM_MATRIX.md",
  "docs/commercial/V0_FOUNDER_DEMO_SCRIPT_LOCK.md",
  "docs/commercial/V0_FIRST_SALE_DEMO_CHECKLIST.md",
  "docs/demo/DEMO_FIXTURE_PACK.md",
  "docs/demo/FOUNDER_DEMO_PATH.md",
  "docs/demo/V1_DEMO_FIXTURE_PACK_INDEX_REGISTRY.json",
  "test/coach_demo_artefact_index_lock.test.mjs",
  "test/coach_demo_surface_claim_matrix.test.mjs",
  "test/first_sale_demo_checklist.test.mjs",
  "test/founder_demo_script_lock.test.mjs",
].sort();

function flattenArtefacts(registry) {
  return registry.fixture_groups.flatMap((group) => group.artefacts);
}

test("demo fixture pack index registry is pinned exactly", () => {
  const registry = readJson(registryPath);
  assert.equal(registry.schema_version, "kolosseum.v1.demo_fixture_pack_index.v1.0.0");
  const groupIds = registry.fixture_groups.map((group) => group.group_id).sort();
  assert.deepEqual(groupIds, EXPECTED_GROUP_IDS);
});

test("all referenced fixtures exist", () => {
  const registry = readJson(registryPath);
  for (const relPath of flattenArtefacts(registry)) {
    assert.equal(fs.existsSync(path.join(repoRoot, relPath)), true, `missing fixture artefact: ${relPath}`);
  }
});

test("fixture references are duplicate-free and pinned exactly", () => {
  const registry = readJson(registryPath);
  const artefacts = flattenArtefacts(registry);
  const unique = [...new Set(artefacts)].sort();
  assert.equal(unique.length, artefacts.length, "duplicate fixture artefact reference detected");
  assert.deepEqual(unique, EXPECTED_ARTEFACTS);
});

test("fixture pack index markdown contains all required group headings", () => {
  const text = readText(indexPath);
  const headings = [...text.matchAll(/^###\s+([a-z_]+)$/gm)].map((match) => match[1]).sort();
  assert.deepEqual(headings, EXPECTED_GROUP_IDS);
});

test("fixture pack index markdown references every pinned fixture artefact path", () => {
  const text = readText(indexPath);
  for (const relPath of EXPECTED_ARTEFACTS) {
    assert.equal(text.includes(relPath), true, `fixture artefact path missing from markdown index: ${relPath}`);
  }
});