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

const checklistPath = "docs/commercial/V0_FIRST_SALE_DEMO_CHECKLIST.md";
const registryPath = "docs/commercial/V0_FIRST_SALE_DEMO_CHECKLIST_REGISTRY.json";

const EXPECTED_ARTIFACTS = [
  "docs/commercial/V0_COACH_TIER_VALUE_CLAIM_REGISTRY.json",
  "docs/commercial/V0_COACH_TIER_VALUE_PROOF_PACK.md",
  "docs/v1/V1_DECLARATION_ERROR_UX_CONTRACT.md",
  "docs/v1/V1_EXPORT_NOTHING_V0_GUARD.md",
  "docs/v1/V1_FOUNDER_DEMO_UI_COPY_LOCK.md",
].sort();

const EXPECTED_STEP_IDS = [
  "assignment_surface",
  "declaration_error_boundary",
  "execution_view_surface",
  "history_counts_surface",
  "no_export_boundary",
  "notes_boundary_surface",
  "proof_pack_gate",
].sort();

const EXPECTED_STEP_ORDER = [
  "proof_pack_gate",
  "assignment_surface",
  "execution_view_surface",
  "notes_boundary_surface",
  "history_counts_surface",
  "declaration_error_boundary",
  "no_export_boundary",
];

const EXPECTED_ALLOWED_CLAIMS = [
  "Coach can assign work within the active v0 coach path.",
  "Coach can view factual execution artefacts and summaries only.",
  "Coach can view factual history counts only where the v0 surface exposes counts.",
  "Coach notes are non-binding and do not alter engine legality or execution authority.",
].sort();

const EXPECTED_BANNED_CLAIMS = [
  "automatic coaching decisions",
  "athlete accountability enforcement",
  "compliance monitoring",
  "evidence export",
  "legal or safety assurance",
  "override authority",
  "performance improvement claims",
  "proof replay",
  "readiness scoring",
].sort();

test("first-sale demo checklist registry is pinned exactly", () => {
  const registry = readJson(registryPath);
  assert.equal(registry.schema_version, "kolosseum.v0.first_sale_demo_checklist_registry.v1.0.0");
  assert.deepEqual([...registry.required_artifacts].sort(), EXPECTED_ARTIFACTS);
  assert.deepEqual(registry.demo_steps.map((step) => step.step_id).sort(), EXPECTED_STEP_IDS);
});

test("all referenced demo artefacts exist", () => {
  const registry = readJson(registryPath);
  for (const relPath of registry.required_artifacts) {
    assert.equal(fs.existsSync(path.join(repoRoot, relPath)), true, `missing artefact: ${relPath}`);
  }
});

test("demo checklist step order is deterministic and pinned", () => {
  const registry = readJson(registryPath);
  const ordered = [...registry.demo_steps].sort((a, b) => a.order - b.order).map((step) => step.step_id);
  assert.deepEqual(ordered, EXPECTED_STEP_ORDER);
});

test("every checklist step references at least one pinned live surface id", () => {
  const registry = readJson(registryPath);
  for (const step of registry.demo_steps) {
    assert.ok(Array.isArray(step.surface_ids), `surface_ids missing for ${step.step_id}`);
    assert.ok(step.surface_ids.length > 0, `surface_ids empty for ${step.step_id}`);
    for (const surfaceId of step.surface_ids) {
      assert.equal(typeof surfaceId, "string");
      assert.ok(surfaceId.length > 0);
    }
  }
});

test("allowed and banned claims are pinned exactly", () => {
  const registry = readJson(registryPath);
  assert.deepEqual([...registry.allowed_claims].sort(), EXPECTED_ALLOWED_CLAIMS);
  assert.deepEqual([...registry.banned_claims].sort(), EXPECTED_BANNED_CLAIMS);
});

test("checklist markdown contains exact ordered steps and no missing sections", () => {
  const text = readText(checklistPath);
  const requiredMarkers = [
    "## Pre-demo proof checks",
    "## Demo artefacts required",
    "## Exact demo path order",
    "## Allowed coach demo claims",
    "## Banned coach demo claims",
    "## Failure handling",
  ];
  for (const marker of requiredMarkers) {
    assert.equal(text.includes(marker), true, `missing markdown marker: ${marker}`);
  }
  const orderAnchors = [
    "1. Confirm coach tier value proof pack claims only.",
    "2. Show assignment surface.",
    "3. Show factual execution view surface.",
    "4. Show non-binding coach notes boundary.",
    "5. Show factual history counts surface.",
    "6. State declaration error UX boundary if asked about failures.",
    "7. Do not show export, evidence, proof, replay, or compliance surfaces.",
  ];
  let lastIndex = -1;
  for (const anchor of orderAnchors) {
    const idx = text.indexOf(anchor);
    assert.ok(idx >= 0, `missing step anchor: ${anchor}`);
    assert.ok(idx > lastIndex, `out-of-order step anchor: ${anchor}`);
    lastIndex = idx;
  }
});