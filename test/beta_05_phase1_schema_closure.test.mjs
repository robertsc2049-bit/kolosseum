// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repo = process.cwd();
const scriptPath = path.join(repo, "scripts", "ci-enforce-phase1.mjs");

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(repo, relPath), "utf8"));
}

function runFixture(name, extraEnv = {}) {
  const fixturePath = path.join(repo, "test", "fixtures", name);

  assert.equal(fs.existsSync(scriptPath), true, "expected phase1 enforcer to exist");
  assert.equal(fs.existsSync(fixturePath), true, `expected fixture ${name} to exist`);

  return spawnSync(process.execPath, [scriptPath], {
    cwd: repo,
    encoding: "utf8",
    env: {
      ...process.env,
      PHASE1_INPUT_PATH: fixturePath,
      ...extraEnv
    }
  });
}

function extractHash(stdout) {
  const match = /^CI_OK::phase1_valid::sha256=([a-f0-9]{64})::truth=ci\/contracts\/phase1_v0_truth_surface\.json\r?\n?$/.exec(stdout);
  assert.ok(match, `expected phase1 success hash line, got ${stdout}`);
  return match[1];
}

test("BETA-05 Phase 1 schema, truth surface, and validator share the same closed world", () => {
  const schema = readJson("docs/v0/phase1_declaration_surface.schema.json");
  const truth = readJson("ci/contracts/phase1_v0_truth_surface.json");

  assert.equal(schema.additionalProperties, false, "root schema must be closed");
  assert.equal(schema.$defs.baseline_metric.additionalProperties, false, "baseline metric schema must be closed");
  assert.equal(schema.$defs.personal_kit.additionalProperties, false, "personal kit schema must be closed");
  assert.equal(schema.$defs.capability_constraint.additionalProperties, false, "capability constraint schema must be closed");
  assert.equal(schema.$defs.ui_preferences.additionalProperties, false, "UI preference schema must be closed");

  assert.deepEqual(schema.required, truth.required_top_level_fields, "schema required fields must match repo truth surface");
  assert.deepEqual(Object.keys(schema.properties), truth.top_level_allowed_fields, "schema allowed fields must match repo truth surface");

  assert.equal(schema.properties.engine_version.const, truth.version_pins.engine_version);
  assert.equal(schema.properties.enum_bundle_version.const, truth.version_pins.enum_bundle_version);
  assert.equal(schema.properties.phase1_schema_version.const, truth.version_pins.phase1_schema_version);

  assert.deepEqual(schema.properties.actor_type.enum, truth.allowed_actor_types);
  assert.deepEqual(schema.properties.execution_scope.enum, truth.allowed_execution_scopes);
  assert.deepEqual(schema.properties.activity_id.enum, truth.allowed_activities);
  assert.deepEqual(schema.properties.location_type.enum, truth.allowed_location_types);
  assert.deepEqual(schema.properties.instruction_density.enum, truth.allowed_instruction_density);
  assert.deepEqual(schema.properties.exposure_prompt_density.enum, truth.allowed_exposure_prompt_density);
  assert.deepEqual(schema.properties.bias_mode.enum, truth.allowed_bias_mode);
});

test("BETA-05 positive Phase 1 fixtures pass for each beta activity", () => {
  for (const fixture of [
    "phase1.valid.powerlifting.json",
    "phase1.valid.rugby_union.json",
    "phase1.valid.general_strength.json"
  ]) {
    const run = runFixture(fixture);

    assert.equal(run.status, 0, `${fixture} expected PASS\nSTDERR:\n${run.stderr}`);
    extractHash(run.stdout);
    assert.equal(run.stderr, "", `${fixture} should not emit stderr`);
  }
});

test("BETA-05 negative Phase 1 fixtures fail closed at the declaration boundary", () => {
  const cases = [
    ["phase1.invalid-unknown-top-level.json", "unknown_field"],
    ["phase1.invalid-missing-consent.json", "missing_required_field"],
    ["phase1.invalid-bad-version.json", "version_mismatch"],
    ["phase1.invalid-activity.json", "invalid_activity_id"],
    ["phase1.invalid-scope.json", "invalid_execution_scope"],
    ["phase1.invalid-presentation-flag.json", "invalid_presentation_flag"]
  ];

  for (const [fixture, token] of cases) {
    const run = runFixture(fixture);

    assert.equal(run.status, 1, `${fixture} expected FAIL`);
    assert.match(run.stderr, new RegExp(`^CI_FAIL::${token}::`), `${fixture} expected ${token}, got ${run.stderr}`);
    assert.equal(run.stdout, "", `${fixture} should not emit stdout`);
  }
});

test("BETA-05 accepted Phase 1 input can be emitted verbatim without enrichment", () => {
  const rel = "test/fixtures/phase1.valid.general_strength.json";
  const expected = fs.readFileSync(path.join(repo, rel), "utf8");
  const run = runFixture("phase1.valid.general_strength.json", { PHASE1_ECHO_ACCEPTED_INPUT: "1" });

  assert.equal(run.status, 0, `verbatim echo expected PASS\nSTDERR:\n${run.stderr}`);
  assert.equal(run.stdout, expected, "accepted Phase 1 output must equal input bytes");
  assert.equal(run.stderr, "", "verbatim echo should not emit stderr");
});

test("BETA-05 top-level presentation flags are engine-inert for Phase 1 hash", () => {
  const source = readJson("test/fixtures/phase1.valid.general_strength.json");
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "beta-05-phase1-"));
  const changedPath = path.join(tempDir, "phase1.presentation.changed.json");

  const changed = {
    ...source,
    nd_mode: !source.nd_mode,
    instruction_density: "detailed",
    exposure_prompt_density: "detailed",
    bias_mode: "variety"
  };

  fs.writeFileSync(changedPath, `${JSON.stringify(changed, null, 2)}\n`, "utf8");

  const baseline = runFixture("phase1.valid.general_strength.json");
  const changedRun = spawnSync(process.execPath, [scriptPath], {
    cwd: repo,
    encoding: "utf8",
    env: {
      ...process.env,
      PHASE1_INPUT_PATH: changedPath
    }
  });

  assert.equal(baseline.status, 0, `baseline expected PASS\nSTDERR:\n${baseline.stderr}`);
  assert.equal(changedRun.status, 0, `presentation changed expected PASS\nSTDERR:\n${changedRun.stderr}`);
  assert.equal(extractHash(changedRun.stdout), extractHash(baseline.stdout), "presentation-only flag changes must not change engine-visible hash");
});
