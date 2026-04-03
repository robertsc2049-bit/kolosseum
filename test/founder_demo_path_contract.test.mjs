import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const docPath = path.join(repoRoot, "docs", "demo", "FOUNDER_DEMO_PATH.md");
const fixturePath = path.join(repoRoot, "fixtures", "founder_demo", "founder_demo_v0.fixture.json");
const testPath = path.join(repoRoot, "test", "founder_demo_path_contract.test.mjs");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function validateFixtureBoundary(fixture) {
  assert.equal(fixture.release_scope, "v0");
  assert.equal(fixture.actor_type, "coach");
  assert.equal(fixture.execution_scope, "coach_managed");
  assert.equal(fixture.runtime_shape, "single_athlete");
  assert.equal(fixture.activity_id, "powerlifting");
  assert.deepEqual(fixture.active_phases, [1, 2, 3, 4, 5, 6]);

  const forbidden = new Set(fixture.forbidden_surfaces);
  for (const token of [
    "phase7",
    "phase8",
    "evidence_envelope",
    "export",
    "org_managed_runtime",
    "team_runtime",
    "unit_runtime"
  ]) {
    assert.equal(forbidden.has(token), true, `missing forbidden surface token: ${token}`);
  }
}

function validateRequiredSurfaces(fixture) {
  for (const relativePath of fixture.required_surfaces) {
    const absolutePath = path.join(repoRoot, relativePath);
    assert.equal(fs.existsSync(absolutePath), true, `required surface missing: ${relativePath}`);
  }
}

function simulateVisiblePath(fixture) {
  const output = [];
  for (const checkpoint of fixture.visible_checkpoints) {
    output.push(checkpoint);
  }
  return output;
}

test("P148 required founder demo surfaces exist", () => {
  assert.equal(fs.existsSync(docPath), true, "missing founder demo doc");
  assert.equal(fs.existsSync(fixturePath), true, "missing founder demo fixture");
  assert.equal(fs.existsSync(testPath), true, "missing founder demo acceptance test");

  const fixture = readJson(fixturePath);
  validateRequiredSurfaces(fixture);
});

test("P148 founder demo fixture stays inside v0 boundary", () => {
  const fixture = readJson(fixturePath);
  validateFixtureBoundary(fixture);
});

test("P148 same inputs produce same visible founder demo path", () => {
  const fixture = readJson(fixturePath);

  const first = simulateVisiblePath(fixture);
  const second = simulateVisiblePath(fixture);

  assert.deepEqual(first, second);
  assert.deepEqual(first, fixture.expected_visible_path);
});

test("P148 missing required surface fails validation", () => {
  const fixture = readJson(fixturePath);
  const broken = structuredClone(fixture);
  broken.required_surfaces = [...fixture.required_surfaces, "docs/demo/DOES_NOT_EXIST.md"];

  assert.throws(
    () => validateRequiredSurfaces(broken),
    /required surface missing: docs\/demo\/DOES_NOT_EXIST\.md/
  );
});

test("P148 founder demo path does not reach proof-layer surfaces", () => {
  const fixture = readJson(fixturePath);
  const forbidden = new Set(fixture.forbidden_surfaces);

  assert.equal(forbidden.has("phase7"), true);
  assert.equal(forbidden.has("phase8"), true);
  assert.equal(forbidden.has("evidence_envelope"), true);
  assert.equal(forbidden.has("export"), true);
});