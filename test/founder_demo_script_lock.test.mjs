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

const scriptPath = "docs/commercial/V0_FOUNDER_DEMO_SCRIPT_LOCK.md";
const registryPath = "docs/commercial/V0_FOUNDER_DEMO_SCRIPT_LOCK_REGISTRY.json";
const claimRegistryPath = "docs/commercial/V0_COACH_DEMO_SURFACE_CLAIM_MATRIX_REGISTRY.json";

const EXPECTED_SECTION_IDS = [
  "assignment",
  "close",
  "execution_view",
  "history_counts",
  "notes_boundary",
  "opening",
].sort();

const EXPECTED_CLAIM_IDS = [
  "assignment",
  "execution_view",
  "history_counts",
  "notes_boundary",
].sort();

const BANNED_TERM_REGEXES = [
  /\bcompliance monitoring\b/i,
  /\bathlete accountability enforcement\b/i,
  /\breadiness scoring\b/i,
  /\bperformance improvement claims\b/i,
  /\bevidence export\b/i,
  /\bproof replay\b/i,
  /\boverride authority\b/i,
  /\blegal or safety assurance\b/i,
  /\bautomatic coaching decisions\b/i,
  /\banalytics dashboard\b/i,
  /\btrend scoring\b/i,
];

function extractSections(text) {
  const sections = new Map();
  const matches = [...text.matchAll(/^###\s+([a-z_]+)\n([\s\S]*?)(?=^###\s+|^##\s+|\Z)/gm)];
  for (const match of matches) {
    sections.set(match[1], match[2].trim());
  }
  return sections;
}

function assertNoBannedDrift(label, value) {
  for (const rx of BANNED_TERM_REGEXES) {
    assert.equal(rx.test(value), false, `banned commercial drift in ${label}: ${value}`);
  }
}

test("founder demo script lock registry is pinned exactly", () => {
  const registry = readJson(registryPath);
  assert.equal(registry.schema_version, "kolosseum.v0.founder_demo_script_lock.v1.0.0");
  assert.equal(registry.source_claim_registry, claimRegistryPath);
  const sectionIds = registry.spoken_sections.map((section) => section.section_id).sort();
  assert.deepEqual(sectionIds, EXPECTED_SECTION_IDS);
});

test("all claim-bearing script sections map only to pinned claim registry ids", () => {
  const scriptRegistry = readJson(registryPath);
  const claimRegistry = readJson(claimRegistryPath);
  const claimIds = new Set(claimRegistry.claims.map((claim) => claim.claim_id));
  assert.deepEqual([...claimIds].sort(), EXPECTED_CLAIM_IDS);
  for (const section of scriptRegistry.spoken_sections) {
    for (const claimId of section.allowed_claim_ids) {
      assert.equal(claimIds.has(claimId), true, `orphan claim id in spoken section ${section.section_id}: ${claimId}`);
    }
  }
});

test("spoken claim sections contain only allowed claim text and no banned drift", () => {
  const scriptRegistry = readJson(registryPath);
  const claimRegistry = readJson(claimRegistryPath);
  const claimMap = new Map(claimRegistry.claims.map((claim) => [claim.claim_id, claim.claim_text]));
  for (const section of scriptRegistry.spoken_sections) {
    const joined = section.script_lines.join(" ");
    if (section.allowed_claim_ids.length > 0) {
      for (const claimId of section.allowed_claim_ids) {
        assert.equal(joined.includes(claimMap.get(claimId)), true, `missing mapped claim text ${claimId} in section ${section.section_id}`);
      }
      assertNoBannedDrift(section.section_id, joined);
    }
  }
});

test("script markdown contains exactly the pinned spoken sections", () => {
  const text = readText(scriptPath);
  const headings = [...text.matchAll(/^###\s+([a-z_]+)$/gm)].map((match) => match[1]).sort();
  assert.deepEqual(headings, EXPECTED_SECTION_IDS);
});

test("registry script lines are rendered in markdown for every spoken section", () => {
  const registry = readJson(registryPath);
  const text = readText(scriptPath);
  const sections = extractSections(text);
  for (const spokenSection of registry.spoken_sections) {
    const markdownSection = sections.get(spokenSection.section_id);
    assert.ok(markdownSection, `missing markdown section for ${spokenSection.section_id}`);
    for (const line of spokenSection.script_lines) {
      assert.equal(markdownSection.includes(line), true, `missing script line in ${spokenSection.section_id}: ${line}`);
    }
  }
});

test("banned drift reference section exists in markdown without polluting spoken claim checks", () => {
  const text = readText(scriptPath);
  assert.equal(text.includes("## Banned commercial drift reference"), true);
  for (const term of readJson(registryPath).banned_drift_terms) {
    assert.equal(text.includes(term), true, `missing banned drift reference term: ${term}`);
  }
});