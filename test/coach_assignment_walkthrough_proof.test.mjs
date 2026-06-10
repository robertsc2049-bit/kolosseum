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

const docPath = "docs/commercial/V0_COACH_ASSIGNMENT_WALKTHROUGH_PROOF.md";
const registryPath = "docs/commercial/V0_COACH_ASSIGNMENT_WALKTHROUGH_PROOF_REGISTRY.json";

const EXPECTED_STEP_IDS = [
  "step_01_open_boundary",
  "step_02_assign_work",
  "step_03_view_execution",
  "step_04_confirm_boundary",
];

const EXPECTED_STEP_ORDERS = [1, 2, 3, 4];

const EXPECTED_SURFACE_MAP = {
  step_01_open_boundary: ["coach.assignment.read", "coach.assignment.write"].sort(),
  step_02_assign_work: ["coach.assignment.write"].sort(),
  step_03_view_execution: ["coach.execution.state.read", "coach.execution.summary.read"].sort(),
  step_04_confirm_boundary: ["coach.execution.summary.read", "coach.notes.non_binding"].sort(),
};

const EXPECTED_ACTIONS = {
  step_01_open_boundary: "Open the active v0 coach demo boundary before touching assignment.",
  step_02_assign_work: "Demonstrate the coach assignment step using the active v0 assignment claim only.",
  step_03_view_execution: "Show the factual execution view that follows the assignment step.",
  step_04_confirm_boundary: "Confirm the loop closes with factual confirmation only, not scoring, override, or automation.",
};

function extractSections(text) {
  const sections = new Map();
  const matches = [...text.matchAll(/^###\s+([a-z0-9_]+)\n([\s\S]*?)(?=^###\s+|^##\s+|\Z)/gm)];
  for (const match of matches) {
    sections.set(match[1], match[2].trim());
  }
  return sections;
}

test("coach assignment walkthrough registry is pinned exactly", () => {
  const registry = readJson(registryPath);
  assert.equal(registry.schema_version, "kolosseum.v0.coach_assignment_walkthrough_proof.v1.0.0");
  assert.deepEqual(registry.required_step_ids, EXPECTED_STEP_IDS);
  const stepIds = registry.walkthrough_steps.map((step) => step.step_id);
  assert.deepEqual(stepIds, EXPECTED_STEP_IDS);
  const stepOrders = registry.walkthrough_steps.map((step) => step.step_order);
  assert.deepEqual(stepOrders, EXPECTED_STEP_ORDERS);
});

test("each walkthrough step maps to tested surfaces", () => {
  const registry = readJson(registryPath);
  for (const step of registry.walkthrough_steps) {
    assert.equal(step.action, EXPECTED_ACTIONS[step.step_id]);
    assert.deepEqual([...step.surface_ids].sort(), EXPECTED_SURFACE_MAP[step.step_id]);
    assert.ok(step.doc_surfaces.length > 0, `missing doc surfaces for ${step.step_id}`);
    assert.ok(step.proof_ids.length > 0, `missing proof ids for ${step.step_id}`);
    for (const relPath of [...step.doc_surfaces, ...step.proof_ids]) {
      assert.equal(fs.existsSync(path.join(repoRoot, relPath)), true, `missing proof/doc surface: ${relPath}`);
    }
  }
});

test("skipped step or unproven jump fails by ordered closed-loop lock", () => {
  const registry = readJson(registryPath);
  assert.equal(registry.walkthrough_steps.length, EXPECTED_STEP_IDS.length);
  for (let i = 0; i < registry.walkthrough_steps.length; i += 1) {
    const step = registry.walkthrough_steps[i];
    assert.equal(step.step_order, i + 1, `unexpected step order for ${step.step_id}`);
    assert.equal(step.step_id, EXPECTED_STEP_IDS[i], `unexpected step id at position ${i + 1}`);
  }
});

test("walkthrough markdown contains exactly the pinned ordered steps", () => {
  const text = readText(docPath);
  const headings = [...text.matchAll(/^###\s+([a-z0-9_]+)$/gm)].map((match) => match[1]);
  assert.deepEqual(headings, EXPECTED_STEP_IDS);
});

test("walkthrough markdown renders action, surface ids, and proof ids for every step", () => {
  const text = readText(docPath);
  const sections = extractSections(text);
  const registry = readJson(registryPath);
  for (const step of registry.walkthrough_steps) {
    const section = sections.get(step.step_id);
    assert.ok(section, `missing markdown section for ${step.step_id}`);
    assert.equal(section.includes(step.action), true, `missing action text for ${step.step_id}`);
    for (const surfaceId of step.surface_ids) {
      assert.equal(section.includes(surfaceId), true, `missing surface id ${surfaceId} for ${step.step_id}`);
    }
    for (const relPath of step.doc_surfaces) {
      assert.equal(section.includes(relPath), true, `missing doc surface ${relPath} for ${step.step_id}`);
    }
    for (const proofId of step.proof_ids) {
      assert.equal(section.includes(proofId), true, `missing proof id ${proofId} for ${step.step_id}`);
    }
  }
});