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

const matrixPath = "docs/commercial/V0_COACH_DEMO_SURFACE_CLAIM_MATRIX.md";
const registryPath = "docs/commercial/V0_COACH_DEMO_SURFACE_CLAIM_MATRIX_REGISTRY.json";

const EXPECTED_CLAIM_IDS = [
  "assignment",
  "execution_view",
  "history_counts",
  "notes_boundary",
].sort();

const EXPECTED_CLAIM_TEXT = {
  assignment: "Coach can assign work within the active v0 coach path.",
  execution_view: "Coach can view factual execution artefacts and summaries only.",
  notes_boundary: "Coach notes are non-binding and do not alter engine legality or execution authority.",
  history_counts: "Coach can view factual history counts only where the v0 surface exposes counts.",
};

const EXPECTED_SURFACE_MAP = {
  assignment: ["coach.assignment.read", "coach.assignment.write"].sort(),
  execution_view: ["coach.execution.state.read", "coach.execution.summary.read"].sort(),
  notes_boundary: ["coach.notes.boundary.read", "coach.notes.non_binding"].sort(),
  history_counts: ["coach.history.counts.read"].sort(),
};

const EXPECTED_DOC_SURFACES = [
  "docs/commercial/V0_COACH_TIER_VALUE_PROOF_PACK.md",
  "docs/commercial/V0_FIRST_SALE_DEMO_CHECKLIST.md",
  "docs/commercial/V0_COACH_DEMO_ARTEFACT_INDEX.md",
].sort();

const EXPECTED_PROOF_IDS = [
  "test/coach_demo_artefact_index_lock.test.mjs",
  "test/coach_tier_value_proof_pack.test.mjs",
  "test/first_sale_demo_checklist.test.mjs",
].sort();

function extractClaimSections(text) {
  const sections = new Map();
  const matches = [...text.matchAll(/^###\s+([a-z_]+)\n([\s\S]*?)(?=^###\s+|^##\s+|\Z)/gm)];
  for (const match of matches) {
    sections.set(match[1], match[2].trim());
  }
  return sections;
}

test("coach demo surface-to-claim matrix registry is pinned exactly", () => {
  const registry = readJson(registryPath);
  assert.equal(registry.schema_version, "kolosseum.v0.coach_demo_surface_claim_matrix.v1.0.0");
  const claimIds = registry.claims.map((claim) => claim.claim_id).sort();
  assert.deepEqual(claimIds, EXPECTED_CLAIM_IDS);
});

test("every claim has surface ids and proof ids", () => {
  const registry = readJson(registryPath);
  for (const claim of registry.claims) {
    assert.equal(claim.claim_text, EXPECTED_CLAIM_TEXT[claim.claim_id]);
    assert.deepEqual([...claim.surface_ids].sort(), EXPECTED_SURFACE_MAP[claim.claim_id]);
    assert.deepEqual([...claim.doc_surfaces].sort(), EXPECTED_DOC_SURFACES);
    assert.deepEqual([...claim.proof_ids].sort(), EXPECTED_PROOF_IDS);
    for (const relPath of [...claim.doc_surfaces, ...claim.proof_ids]) {
      assert.equal(fs.existsSync(path.join(repoRoot, relPath)), true, `missing referenced proof/doc surface: ${relPath}`);
    }
  }
});

test("orphan claims fail by count and identity lock", () => {
  const registry = readJson(registryPath);
  assert.equal(registry.claims.length, EXPECTED_CLAIM_IDS.length);
  const ids = new Set(registry.claims.map((claim) => claim.claim_id));
  for (const claimId of EXPECTED_CLAIM_IDS) {
    assert.equal(ids.has(claimId), true, `missing claim id: ${claimId}`);
  }
});

test("matrix markdown contains exactly the pinned claim sections", () => {
  const text = readText(matrixPath);
  const headings = [...text.matchAll(/^###\s+([a-z_]+)$/gm)].map((match) => match[1]).sort();
  assert.deepEqual(headings, EXPECTED_CLAIM_IDS);
});

test("matrix markdown claim sections contain claim text, surface ids, and proof ids", () => {
  const text = readText(matrixPath);
  const sections = extractClaimSections(text);
  for (const claimId of EXPECTED_CLAIM_IDS) {
    const section = sections.get(claimId);
    assert.ok(section, `missing markdown section for ${claimId}`);
    assert.equal(section.includes(EXPECTED_CLAIM_TEXT[claimId]), true, `missing claim text for ${claimId}`);
    for (const surfaceId of EXPECTED_SURFACE_MAP[claimId]) {
      assert.equal(section.includes(surfaceId), true, `missing surface id ${surfaceId} for ${claimId}`);
    }
    for (const relPath of EXPECTED_DOC_SURFACES) {
      assert.equal(section.includes(relPath), true, `missing doc surface ${relPath} for ${claimId}`);
    }
    for (const proofId of EXPECTED_PROOF_IDS) {
      assert.equal(section.includes(proofId), true, `missing proof id ${proofId} for ${claimId}`);
    }
  }
});