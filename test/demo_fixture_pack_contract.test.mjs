import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const docPath = path.join(repoRoot, "docs", "demo", "DEMO_FIXTURE_PACK.md");
const registryPath = path.join(repoRoot, "fixtures", "demo_pack", "DEMO_FIXTURE_PACK_REGISTRY.json");
const fixturePaths = [
  path.join(repoRoot, "fixtures", "demo_pack", "powerlifting.demo.fixture.json"),
  path.join(repoRoot, "fixtures", "demo_pack", "rugby_union.demo.fixture.json"),
  path.join(repoRoot, "fixtures", "demo_pack", "general_strength.demo.fixture.json")
];

const V0_SUPPORTED = ["powerlifting", "rugby_union", "general_strength"];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function validateFixture(fixture) {
  assert.equal(fixture.engine_compatibility, "EB2-1.0.0");
  assert.equal(fixture.release_scope, "v0");
  assert.deepEqual(fixture.active_phases, [1, 2, 3, 4, 5, 6]);
  assert.equal(fixture.actor_type, "athlete");
  assert.equal(fixture.execution_scope, "individual");
  assert.equal(V0_SUPPORTED.includes(fixture.activity_id), true, `unsupported activity in fixture: ${fixture.activity_id}`);
}

function validateRegistry(registry) {
  assert.equal(registry.engine_compatibility, "EB2-1.0.0");
  assert.equal(registry.release_scope, "v0");
  assert.deepEqual(registry.supported_activities, V0_SUPPORTED);

  const seen = new Set();
  for (const entry of registry.fixtures) {
    assert.equal(V0_SUPPORTED.includes(entry.activity_id), true, `unsupported activity entered pack: ${entry.activity_id}`);
    assert.equal(seen.has(entry.activity_id), false, `duplicate activity in pack: ${entry.activity_id}`);
    seen.add(entry.activity_id);

    const abs = path.join(repoRoot, entry.path);
    assert.equal(fs.existsSync(abs), true, `missing fixture file: ${entry.path}`);
  }

  assert.equal(registry.fixtures.length, 3, "fixture pack must contain exactly 3 fixtures");
  assert.deepEqual([...seen].sort(), [...V0_SUPPORTED].sort());
}

test("P149 fixture registry is explicit and present", () => {
  assert.equal(fs.existsSync(docPath), true, "missing demo fixture pack doc");
  assert.equal(fs.existsSync(registryPath), true, "missing demo fixture pack registry");

  const registry = readJson(registryPath);
  validateRegistry(registry);
});

test("P149 every v0 supported activity has one known-good pack member", () => {
  const registry = readJson(registryPath);
  const activities = registry.fixtures.map(x => x.activity_id).sort();
  assert.deepEqual(activities, [...V0_SUPPORTED].sort());
});

test("P149 all three fixtures stay inside v0 boundary", () => {
  for (const p of fixturePaths) {
    assert.equal(fs.existsSync(p), true, `missing fixture: ${p}`);
    validateFixture(readJson(p));
  }
});

test("P149 unsupported activity cannot enter pack", () => {
  const registry = readJson(registryPath);
  const broken = structuredClone(registry);

  broken.fixtures.push({
    activity_id: "submission_wrestling",
    fixture_id: "submission_wrestling_demo_v0",
    path: "fixtures/demo_pack/submission_wrestling.demo.fixture.json"
  });

  assert.throws(
    () => validateRegistry(broken),
    /unsupported activity entered pack: submission_wrestling/
  );
});

test("P149 no extra fixture may enter pack", () => {
  const registry = readJson(registryPath);
  const broken = structuredClone(registry);
  broken.fixtures.push({
    activity_id: "powerlifting",
    fixture_id: "powerlifting_demo_v0_extra",
    path: "fixtures/demo_pack/powerlifting.demo.fixture.json"
  });

  assert.throws(
    () => validateRegistry(broken),
    /duplicate activity in pack: powerlifting/
  );
});