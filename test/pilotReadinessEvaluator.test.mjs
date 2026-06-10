#!/usr/bin/env node


// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { stripTypeScriptTypes } from "node:module";

const repoRoot = process.cwd();
const evaluatorPath = path.join(repoRoot, "src", "pilotReadinessEvaluator.ts");
const registryPath = path.join(repoRoot, "docs", "pilot-blocked-reasons", "pilot_blocked_reason_registry.json");

async function loadEvaluator() {
  const source = fs.readFileSync(evaluatorPath, "utf8");
  const stripped = stripTypeScriptTypes(source);
  const encoded = encodeURIComponent(stripped);
  return import(`data:text/javascript;charset=utf-8,${encoded}`);
}

function stable(value) {
  return JSON.stringify(value);
}

function makeFixture(evaluator) {
  const sourceArtefactRefs = [];
  const sourceIds = new Set();

  function ensureSource(id) {
    const refId = `artefact_${id}`;
    if (!sourceIds.has(refId)) {
      sourceIds.add(refId);
      sourceArtefactRefs.push({ artefact_ref_id: refId });
    }
    return refId;
  }

  const readinessItemResults = evaluator.REQUIRED_READINESS_IDS.map((id) => ({
    item_id: id,
    passed: true,
    source_artefact_ref_ids: [ensureSource(id)]
  }));

  const negativeBoundaryResults = evaluator.REQUIRED_NEGATIVE_BOUNDARY_IDS.map((id) => ({
    boundary_id: id,
    passed: true,
    source_artefact_ref_ids: [ensureSource(id)]
  }));

  return {
    readiness_item_results: readinessItemResults,
    negative_boundary_results: negativeBoundaryResults,
    source_artefact_refs: sourceArtefactRefs
  };
}

function assertBlocked(result, reasonId) {
  assert.equal(result.final_status, "blocked");
  assert.ok(result.blocked_reasons.includes(reasonId), `Expected blocked reason '${reasonId}' in ${JSON.stringify(result.blocked_reasons)}`);
}

function assertOutputShape(result) {
  assert.deepEqual(Object.keys(result), [
    "final_status",
    "blocked_reasons",
    "missing_readiness_ids",
    "failed_readiness_ids",
    "missing_negative_boundary_ids",
    "failed_negative_boundary_ids",
    "missing_source_artefact_ids"
  ]);
}

function assertNoRuntimeDependencies() {
  const source = fs.readFileSync(evaluatorPath, "utf8");

  const forbiddenPatterns = [
    /\bDate\s*\(/,
    /\bDate\.now\b/,
    /\bnew\s+Date\b/,
    /\bMath\.random\b/,
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
    /\baxios\b/,
    /\bhttp\b/,
    /\bhttps\b/,
    /\bfs\b/,
    /\bprisma\b/,
    /\bsequelize\b/,
    /\bsql\b/,
    /\bpostgres\b/,
    /\bmysql\b/,
    /\bsqlite\b/
  ];

  for (const pattern of forbiddenPatterns) {
    assert.equal(pattern.test(source), false, `Forbidden runtime dependency matched: ${pattern}`);
  }
}

function assertReasonsAreInS47Registry(evaluator) {
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const known = new Set(registry.blocked_reasons.map((entry) => entry.blocked_reason_id));

  for (const reasons of Object.values(evaluator.READINESS_BLOCKED_REASON_MAP)) {
    for (const reasonId of reasons) {
      assert.equal(known.has(reasonId), true, `Evaluator reason missing from S47 registry: ${reasonId}`);
    }
  }

  assert.equal(known.has(evaluator.NEGATIVE_BOUNDARY_BLOCKED_REASON), true);
  assert.equal(known.has(evaluator.SOURCE_ARTEFACT_BLOCKED_REASON), true);
}

async function run() {
  const evaluator = await loadEvaluator();

  assertNoRuntimeDependencies();
  assertReasonsAreInS47Registry(evaluator);

  {
    const input = makeFixture(evaluator);
    const before = stable(input);
    const result = evaluator.evaluatePilotReadiness(input);

    assertOutputShape(result);
    assert.equal(result.final_status, "coach_ready");
    assert.deepEqual(result.blocked_reasons, []);
    assert.deepEqual(result.missing_readiness_ids, []);
    assert.deepEqual(result.failed_readiness_ids, []);
    assert.deepEqual(result.missing_negative_boundary_ids, []);
    assert.deepEqual(result.failed_negative_boundary_ids, []);
    assert.deepEqual(result.missing_source_artefact_ids, []);
    assert.equal(stable(input), before, "Evaluator must not mutate input.");
  }

  {
    const input = makeFixture(evaluator);
    input.readiness_item_results = input.readiness_item_results.filter((item) => item.item_id !== "payment_confirmed");

    const result = evaluator.evaluatePilotReadiness(input);

    assertBlocked(result, "payment_missing");
    assert.deepEqual(result.missing_readiness_ids, ["payment_confirmed"]);
  }

  {
    const input = makeFixture(evaluator);
    input.readiness_item_results.find((item) => item.item_id === "coach_active").passed = false;

    const result = evaluator.evaluatePilotReadiness(input);

    assertBlocked(result, "coach_account_inactive");
    assert.deepEqual(result.failed_readiness_ids, ["coach_active"]);
  }

  {
    const input = makeFixture(evaluator);
    input.negative_boundary_results = input.negative_boundary_results.filter((item) => item.boundary_id !== "no_phase7_surface");

    const result = evaluator.evaluatePilotReadiness(input);

    assertBlocked(result, "forbidden_surface_exposed");
    assert.deepEqual(result.missing_negative_boundary_ids, ["no_phase7_surface"]);
  }

  {
    const input = makeFixture(evaluator);
    input.negative_boundary_results.find((item) => item.boundary_id === "no_claim_surface").passed = false;

    const result = evaluator.evaluatePilotReadiness(input);

    assertBlocked(result, "forbidden_surface_exposed");
    assert.deepEqual(result.failed_negative_boundary_ids, ["no_claim_surface"]);
  }

  {
    const input = makeFixture(evaluator);
    const first = input.readiness_item_results[0];
    first.source_artefact_ref_ids = ["artefact_missing_ref"];

    const result = evaluator.evaluatePilotReadiness(input);

    assertBlocked(result, "source_artefact_missing");
    assert.deepEqual(result.missing_source_artefact_ids, ["artefact_missing_ref"]);
  }

  {
    const input = makeFixture(evaluator);
    input.source_artefact_refs = [];

    const result = evaluator.evaluatePilotReadiness(input);

    assertBlocked(result, "source_artefact_missing");
    assert.ok(result.missing_source_artefact_ids.length > 0);
  }

  {
    const input = makeFixture(evaluator);
    input.readiness_item_results.push({
      item_id: "unknown_readiness_probe",
      passed: true,
      source_artefact_ref_ids: [input.source_artefact_refs[0].artefact_ref_id]
    });

    const result = evaluator.evaluatePilotReadiness(input);

    assertBlocked(result, "forbidden_surface_exposed");
    assert.deepEqual(result.failed_readiness_ids, ["unknown_readiness_probe"]);
  }

  {
    const input = makeFixture(evaluator);
    input.negative_boundary_results.push({
      boundary_id: "unknown_boundary_probe",
      passed: true,
      source_artefact_ref_ids: [input.source_artefact_refs[0].artefact_ref_id]
    });

    const result = evaluator.evaluatePilotReadiness(input);

    assertBlocked(result, "forbidden_surface_exposed");
    assert.deepEqual(result.failed_negative_boundary_ids, ["unknown_boundary_probe"]);
  }

  {
    const input = makeFixture(evaluator);
    const first = input.readiness_item_results[0];
    first.source_artefact_ref_ids = [];

    const result = evaluator.evaluatePilotReadiness(input);

    assertBlocked(result, "source_artefact_missing");
    assert.deepEqual(result.missing_source_artefact_ids, [`${first.item_id}:source_artefact_ref_ids`]);
  }

  process.stdout.write(JSON.stringify({
    ok: true,
    test_suite_id: "pilot_readiness_evaluator_tests",
    test_suite_version: "1.0.0",
    checked_files: [
      path.relative(repoRoot, evaluatorPath),
      path.relative(repoRoot, registryPath)
    ],
    assertions: [
      "all_pass_returns_coach_ready",
      "missing_required_readiness_item_returns_blocked",
      "failed_readiness_item_returns_blocked",
      "missing_negative_boundary_item_returns_blocked",
      "failed_negative_boundary_item_returns_blocked",
      "missing_source_artefact_returns_blocked",
      "unknown_readiness_item_returns_blocked",
      "unknown_negative_boundary_item_returns_blocked",
      "input_not_mutated",
      "no_runtime_side_effect_dependencies",
      "blocked_reasons_exist_in_s47_registry",
      "typescript_strict_compile_passes"
    ]
  }, null, 2) + "\n");
}

run().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message ?? String(error)}\n`);
  process.exit(1);
});
