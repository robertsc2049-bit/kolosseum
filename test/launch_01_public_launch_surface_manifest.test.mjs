// DEV NOTE: LAUNCH-01 direct proof for the closed-world public launch surface.
// Tests mutate only temporary candidate files; repository product state is untouched.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = process.cwd();
const surfacePath = path.join(root, "docs", "releases", "PUBLIC_LAUNCH_SURFACE_MANIFEST.json");
const uiPath = path.join(root, "product", "ui", "function_manifest.json");
const launch00Path = path.join(root, "docs", "releases", "PUBLIC_LAUNCH_RELEASE_BOUNDARY.json");
const guardPath = path.join(root, "scripts", "launch_01_public_launch_surface_guard.mjs");
const fixtureDir = path.join(root, "ci", "fixtures", "launch_01_public_launch_surface_negative");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function findFunction(ui, functionId) {
  for (const area of ui.product_areas ?? []) {
    const fn = (area.functions ?? []).find((entry) => entry.function_id === functionId);
    if (fn) return { area, fn };
  }
  throw new Error(`function not found: ${functionId}`);
}

function applyMutation(surface, ui, mutation) {
  if (mutation.operation === "set_function_override") {
    surface.closed_world.function_overrides[mutation.function_id] = mutation.classification;
    return;
  }
  if (mutation.operation === "remove_route_action") {
    const { fn } = findFunction(ui, mutation.function_id);
    fn.route_id = null;
    fn.api_routes = [];
    return;
  }
  if (mutation.operation === "replace_function_actors") {
    const { fn } = findFunction(ui, mutation.function_id);
    fn.actors = [...mutation.actors];
    return;
  }
  if (mutation.operation === "move_area") {
    for (const category of surface.classification_categories) {
      surface.area_classifications[category] = surface.area_classifications[category].filter((id) => id !== mutation.area_id);
    }
    surface.area_classifications[mutation.classification].push(mutation.area_id);
    return;
  }
  if (mutation.operation === "append_unknown_function") {
    const area = ui.product_areas.find((entry) => entry.area_id === mutation.area_id);
    assert.ok(area, `missing target area ${mutation.area_id}`);
    area.functions.push({
      function_id: mutation.function_id,
      label: "LAUNCH-01 negative unknown function",
      actors: ["athlete"],
      route_id: "shared_account",
      api_routes: [],
      persistence: "navigation_cache",
      state: "implemented",
      governing_boundary: null,
      direct_test: "test/launch_01_public_launch_surface_manifest.test.mjs",
      integration_test: null,
      coverage: {
        loading: "not_applicable",
        empty: "not_applicable",
        error: "not_applicable",
        recovery: "not_applicable"
      }
    });
    return;
  }
  throw new Error(`unknown mutation operation: ${mutation.operation}`);
}

function runGuard({ surface = surfacePath, ui = uiPath, emit = null } = {}) {
  const args = [guardPath, "--surface-manifest", surface, "--ui-manifest", ui];
  if (emit) args.push("--emit", emit);
  return spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
}

test("LAUNCH-01 canonical public launch surface passes", () => {
  const result = runGuard();
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /PUBLIC_LAUNCH_SURFACE: PASS/u);
});

test("LAUNCH-01 materializes every current function with the required release record fields", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-launch-01-materialized-"));
  const emitted = path.join(tempDir, "materialized.json");
  try {
    const result = runGuard({ emit: emitted });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const payload = readJson(emitted);
    const surface = readJson(surfacePath);
    const launch00 = readJson(launch00Path);
    assert.equal(payload.records.length, 317);
    assert.equal(new Set(payload.records.map((record) => record.function_id)).size, 317);
    const activeAreas = new Set(surface.area_classifications.launch_active);
    const activeRecords = payload.records.filter((record) => record.launch_classification === "launch_active");
    assert.deepEqual(
      [...new Set(activeRecords.map((record) => record.product_area))].sort(),
      [...launch00.product_areas.public_launch_candidate].sort()
    );
    for (const record of payload.records) {
      assert.ok(surface.classification_categories.includes(record.launch_classification), record.function_id);
      assert.ok(record.owning_authority?.implementation_slice, `${record.function_id}: implementation authority missing`);
      assert.equal(record.owning_authority.release_boundary, "LAUNCH-00");
      assert.equal(record.owning_authority.launch_surface, "LAUNCH-01");
      assert.equal(record.engine_impact, "none_on_deterministic_engine_truth");
      if (record.launch_classification === "launch_active" || record.launch_classification === "launch_operator_only") {
        assert.ok(Array.isArray(record.actor) && record.actor.length > 0, `${record.function_id}: actor missing`);
        assert.ok(record.route_action, `${record.function_id}: route/action missing`);
        assert.ok(record.persistence, `${record.function_id}: persistence missing`);
        assert.ok(record.direct_test, `${record.function_id}: direct test missing`);
      }
      if (activeAreas.has(record.product_area) && record.product_area !== "coach_commercial") {
        assert.equal(record.commercial_entitlement, null, `${record.function_id}: unexpected commercial entitlement`);
      }
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

for (const fixtureName of [
  "excluded_function_becomes_reachable.json",
  "launch_function_loses_route.json",
  "actor_ownership_changes.json",
  "operator_only_function_becomes_public.json",
  "unknown_function_appears.json",
  "post_v1_surface_launch_active_without_authority.json"
]) {
  test(`LAUNCH-01 rejects ${fixtureName}`, () => {
    const fixture = readJson(path.join(fixtureDir, fixtureName));
    const surface = structuredClone(readJson(surfacePath));
    const ui = structuredClone(readJson(uiPath));
    applyMutation(surface, ui, fixture.mutation);

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-launch-01-negative-"));
    const candidateSurface = path.join(tempDir, "surface.json");
    const candidateUi = path.join(tempDir, "ui.json");
    fs.writeFileSync(candidateSurface, `${JSON.stringify(surface, null, 2)}\n`, "utf8");
    fs.writeFileSync(candidateUi, `${JSON.stringify(ui, null, 2)}\n`, "utf8");

    try {
      const result = runGuard({ surface: candidateSurface, ui: candidateUi });
      assert.notEqual(result.status, 0, "negative fixture unexpectedly passed");
      assert.match(`${result.stdout}\n${result.stderr}`, new RegExp(fixture.expected_token, "u"));
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
}
