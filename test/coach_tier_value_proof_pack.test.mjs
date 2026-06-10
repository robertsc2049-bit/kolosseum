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

const packPath = "docs/commercial/V0_COACH_TIER_VALUE_PROOF_PACK.md";
const registryPath = "docs/commercial/V0_COACH_TIER_VALUE_CLAIM_REGISTRY.json";

const EXPECTED_CLAIM_IDS = [
  "assignment",
  "execution_view",
  "history_counts",
  "notes_boundary",
].sort();

const EXPECTED_SURFACE_MAP = {
  assignment: [
    "coach.assignment.read",
    "coach.assignment.write",
  ].sort(),
  execution_view: [
    "coach.execution.state.read",
    "coach.execution.summary.read",
  ].sort(),
  notes_boundary: [
    "coach.notes.boundary.read",
    "coach.notes.non_binding",
  ].sort(),
  history_counts: [
    "coach.history.counts.read",
  ].sort(),
};

const BANNED_CLAIM_REGEXES = [
  /\bcompliance\b/i,
  /\baccountability\b/i,
  /\breadiness\b/i,
  /\bperformance improvement\b/i,
  /\bevidence export\b/i,
  /\bproof replay\b/i,
  /\boverride authority\b/i,
  /\bsafety assurance\b/i,
  /\bautomatic coaching decisions\b/i,
  /\banalytics dashboard\b/i,
  /\btrend scoring\b/i,
];

function assertNoBannedClaimText(label, value) {
  for (const rx of BANNED_CLAIM_REGEXES) {
    assert.equal(rx.test(value), false, `banned claim wording in ${label}: ${value}`);
  }
}

function extractClaimSections(packText) {
  const sections = new Map();
  const matches = [...packText.matchAll(/^###\s+([a-z_]+)\n([\s\S]*?)(?=^###\s+|^##\s+|\Z)/gm)];
  for (const match of matches) {
    sections.set(match[1], match[2].trim());
  }
  return sections;
}

test("coach tier value claim registry is pinned exactly", () => {
  const registry = readJson(registryPath);
  assert.equal(registry.schema_version, "kolosseum.v0.coach_tier_value_claim_registry.v1.0.0");
  const claimIds = registry.claims.map((claim) => claim.claim_id).sort();
  assert.deepEqual(claimIds, EXPECTED_CLAIM_IDS);
});

test("every coach tier claim maps to pinned implemented surface ids only", () => {
  const registry = readJson(registryPath);
  for (const claim of registry.claims) {
    assert.equal(claim.implemented_now, true, `claim not implemented_now: ${claim.claim_id}`);
    const expectedSurfaces = EXPECTED_SURFACE_MAP[claim.claim_id];
    assert.ok(expectedSurfaces, `missing expected surface map for ${claim.claim_id}`);
    assert.deepEqual([...claim.surface_ids].sort(), expectedSurfaces);
  }
});

test("coach tier pack contains exactly the pinned claims and no extra claim sections", () => {
  const pack = readText(packPath);
  const headings = [...pack.matchAll(/^###\s+([a-z_]+)$/gm)].map((match) => match[1]).sort();
  assert.deepEqual(headings, EXPECTED_CLAIM_IDS);
});

test("pack claim sections are factual and do not contain banned commercial drift as claims", () => {
  const pack = readText(packPath);
  const sections = extractClaimSections(pack);
  for (const claimId of EXPECTED_CLAIM_IDS) {
    const section = sections.get(claimId);
    assert.ok(section, `missing section for ${claimId}`);
    assertNoBannedClaimText(`pack.${claimId}`, section);
  }
});

test("every claim text and prohibited implication list is factual and non-bloated", () => {
  const registry = readJson(registryPath);
  for (const claim of registry.claims) {
    assertNoBannedClaimText(`${claim.claim_id}.claim_text`, claim.claim_text);
    for (const item of claim.prohibited_implications) {
      assert.equal(typeof item, "string");
      assert.ok(item.length > 0);
    }
  }
});

test("unbacked claim ids fail by contract", () => {
  const registry = readJson(registryPath);
  const registryIds = new Set(registry.claims.map((claim) => claim.claim_id));
  for (const expectedId of EXPECTED_CLAIM_IDS) {
    assert.equal(registryIds.has(expectedId), true, `missing claim id ${expectedId}`);
  }
  assert.equal(registry.claims.length, EXPECTED_CLAIM_IDS.length);
});