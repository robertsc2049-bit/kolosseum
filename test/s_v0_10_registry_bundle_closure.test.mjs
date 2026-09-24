import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  stageTempRepoRoot,
  cleanupTempRepoRoot,
  readJson,
  writeJsonUtf8Lf,
  runRegistryLawGuard
} from "../test_support/registry_law_guard_harness.mjs";

const ACTIVE_V0_REGISTRIES = ["activity", "movement", "exercise", "program"];
const ACTIVE_V0_ACTIVITIES = ["general_strength", "powerlifting", "rugby_union"];

function repoRoot() {
  return path.resolve(".");
}

function runNode(cwd, args) {
  return spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
    stdio: "pipe"
  });
}

function combined(result) {
  return `${result.stdout || ""}\n${result.stderr || ""}`.trim();
}

function objectKeys(value) {
  return Object.keys(value || {}).sort();
}

function readRepoJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot(), relativePath), "utf8"));
}

function registryEntryIds(registryDoc, idFieldCandidates) {
  const entries = registryDoc?.entries;

  if (entries && typeof entries === "object" && !Array.isArray(entries)) {
    return Object.keys(entries).sort();
  }

  if (Array.isArray(entries)) {
    return entries
      .map((entry) => {
        for (const field of idFieldCandidates) {
          if (typeof entry?.[field] === "string" && entry[field].length > 0) {
            return entry[field];
          }
        }

        return "";
      })
      .filter(Boolean)
      .sort();
  }

  return [];
}

function registryEntryFieldValues(registryDoc, fieldName) {
  const entries = registryDoc?.entries;

  if (entries && typeof entries === "object" && !Array.isArray(entries)) {
    return Object.values(entries)
      .map((entry) => typeof entry?.[fieldName] === "string" ? entry[fieldName] : "")
      .filter(Boolean)
      .sort();
  }

  if (Array.isArray(entries)) {
    return entries
      .map((entry) => typeof entry?.[fieldName] === "string" ? entry[fieldName] : "")
      .filter(Boolean)
      .sort();
  }

  return [];
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function programEntryActivityTokens(registryDoc) {
  const ids = registryEntryIds(registryDoc, ["template_id"]);

  return ids
    .map((id) => {
      const match = /^PROGRAM_(.+)_V\d+$/i.exec(id);
      return match ? match[1].toLowerCase() : "";
    })
    .filter(Boolean)
    .sort();
}

// DEV NOTE: S-V0-10 registry closure proof.
// These tests deliberately use temp repo copies for negative registry cases.
// They must prove active v0 registry closure without changing committed
// registry content. Positive assertions read the committed bundle and index;
// negative assertions mutate only temporary copies and check the same CI guard
// entrypoints that lint runs.
test("S-V0-10 active v0 registry index and bundle are present and closed to active domains", () => {
  const index = readRepoJson("registries/registry_index.json");
  const bundle = readRepoJson("registries/registry_bundle.json");

  assert.deepEqual(
    index.order,
    ACTIVE_V0_REGISTRIES,
    "registry_index.order must contain only active v0 registry domains"
  );

  assert.equal(bundle.version, index.version, "registry bundle version must match registry index version");
  assert.equal(typeof bundle.registries, "object", "registry bundle must expose registries object");

  assert.deepEqual(
    objectKeys(bundle.registries),
    [...ACTIVE_V0_REGISTRIES].sort(),
    "registry bundle must contain exactly the active v0 registry domains"
  );

  for (const registryId of ACTIVE_V0_REGISTRIES) {
    const registryPath = `registries/${registryId}/${registryId}.registry.json`;
    const schemaPath = `ci/schemas/${registryId}.registry.schema.json`;

    assert.equal(fs.existsSync(registryPath), true, `${registryPath} must exist`);
    assert.equal(fs.existsSync(schemaPath), true, `${schemaPath} must exist`);
    assert.deepEqual(
      bundle.registries[registryId],
      readRepoJson(registryPath),
      `${registryId} registry bundle payload must match committed registry file`
    );
  }

  const activityIds = registryEntryIds(bundle.registries.activity, ["activity_id", "id"]);
  const programActivityTokens = programEntryActivityTokens(bundle.registries.program);

  assert.deepEqual(activityIds, [...ACTIVE_V0_ACTIVITIES].sort(), "activity registry must stay inside active v0 activity set");
  assert.deepEqual(
    programActivityTokens,
    [...ACTIVE_V0_ACTIVITIES].sort(),
    "program registry IDs must resolve back to active v0 activity tokens"
  );

  const serializedBundle = JSON.stringify(bundle).toLowerCase();
  for (const inactiveMarker of ["v1_only", "post_v0_active", "postv1_active", "future_active"]) {
    assert.equal(
      serializedBundle.includes(inactiveMarker),
      false,
      `registry bundle must not contain active future-scope marker '${inactiveMarker}'`
    );
  }
});

test("S-V0-10 registry guards are wired into lint CI path", () => {
  const packageJson = readRepoJson("package.json");
  const lintFast = String(packageJson.scripts?.["lint:fast"] || "");

  assert.match(lintFast, /ci\/guards\/registry_schema_presence_guard\.mjs/, "lint:fast must enforce registry schema presence");
  assert.match(lintFast, /ci\/guards\/registry_bundle_guard\.mjs/, "lint:fast must enforce generated registry bundle closure");
  assert.match(lintFast, /ci\/guards\/registry_law_guard\.mjs/, "lint:fast must enforce registry FK law");
});

test("S-V0-10 schema and bundle guards hard-fail when registry_index references a missing active registry", () => {
  const tempRoot = stageTempRepoRoot();

  try {
    const indexPath = path.join(tempRoot, "registries", "registry_index.json");
    const index = readJson(indexPath);

    index.order = [...index.order, "__missing_active_registry__"];
    writeJsonUtf8Lf(indexPath, index);

    const schemaGuard = runNode(tempRoot, ["ci/guards/registry_schema_presence_guard.mjs"]);
    assert.notEqual(schemaGuard.status, 0, "schema presence guard must fail on index entry with missing schema");
    assert.match(combined(schemaGuard), /registry_schema_presence_guard/i);
    assert.match(combined(schemaGuard), /__missing_active_registry__\.registry\.schema\.json/i);

    const bundleGuard = runNode(tempRoot, ["ci/guards/registry_bundle_guard.mjs"]);
    assert.notEqual(bundleGuard.status, 0, "bundle guard must fail on index entry with missing registry file");
    assert.match(combined(bundleGuard), /registry_bundle_guard/i);
    assert.match(combined(bundleGuard), /missing registry file/i);
    assert.match(combined(bundleGuard), /__missing_active_registry__/i);
  } finally {
    cleanupTempRepoRoot(tempRoot);
  }
});

test("S-V0-10 registry law hard-fails when an exercise pattern target is removed from movement registry", () => {
  const tempRoot = stageTempRepoRoot();

  try {
    const exercisePath = path.join(tempRoot, "registries", "exercise", "exercise.registry.json");
    const movementPath = path.join(tempRoot, "registries", "movement", "movement.registry.json");

    const exercise = readJson(exercisePath);
    const movement = readJson(movementPath);

    const exerciseEntry = Object.values(exercise.entries || {}).find((entry) => entry && typeof entry.movement_pattern_id === "string");
    assert.ok(exerciseEntry, "expected at least one exercise with pattern target");

    const targetPattern = exerciseEntry.movement_pattern_id;
    assert.equal(typeof movement.entries?.[targetPattern], "object", "expected movement FK target to exist before mutation");

    delete movement.entries[targetPattern];
    writeJsonUtf8Lf(movementPath, movement);

    const result = runRegistryLawGuard(tempRoot);
    assert.notEqual(result.status, 0, "registry law guard must fail when movement FK target is missing");

    const output = combined(result);
    assert.match(output, /registry_law_guard:\s*FAIL/i);
    assert.match(output, /FK fail movement_pattern_id/i);
    assert.match(output, new RegExp(escapeRegExp(targetPattern)));
  } finally {
    cleanupTempRepoRoot(tempRoot);
  }
});

test("S-V0-10 registry law hard-fails when an exercise references a missing activity stimulus target", () => {
  const tempRoot = stageTempRepoRoot();

  try {
    const exercisePath = path.join(tempRoot, "registries", "exercise", "exercise.registry.json");

    const exercise = readJson(exercisePath);
    const exerciseEntry = Object.values(exercise.entries || {}).find((entry) => entry && typeof entry.stimulus_intent === "string");
    assert.ok(exerciseEntry, "expected at least one exercise with stimulus_intent target");

    exerciseEntry.stimulus_intent = "__s_v0_10_missing_activity_stimulus__";
    writeJsonUtf8Lf(exercisePath, exercise);

    const result = runRegistryLawGuard(tempRoot);
    assert.notEqual(result.status, 0, "registry law guard must fail when exercise references missing activity stimulus target");

    const output = combined(result);
    assert.match(output, /registry_law_guard:\s*FAIL/i);
    assert.match(output, /FK fail stimulus_intent/i);
    assert.match(output, /__s_v0_10_missing_activity_stimulus__/i);
  } finally {
    cleanupTempRepoRoot(tempRoot);
  }
});

test("S-V0-10 existing registry guard entrypoints pass on committed repo", () => {
  const checks = [
    ["registry_schema_presence_guard", ["ci/guards/registry_schema_presence_guard.mjs"]],
    ["registry_bundle_guard", ["ci/guards/registry_bundle_guard.mjs"]],
    ["registry_law_guard", ["ci/guards/registry_law_guard.mjs"]]
  ];

  for (const [name, args] of checks) {
    const result = runNode(repoRoot(), args);
    assert.equal(
      result.status,
      0,
      `${name} must pass on committed repo. Output:\n${combined(result)}`
    );
  }
});
