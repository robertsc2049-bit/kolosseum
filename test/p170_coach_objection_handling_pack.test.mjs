import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const docPath = path.join(repoRoot, "docs", "demo", "P170_COACH_OBJECTION_HANDLING_PACK.md");
const contractPath = path.join(repoRoot, "docs", "demo", "P170_COACH_OBJECTION_HANDLING_PACK.contract.json");

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function getDocBodyBeforeForbiddenOverreach(doc) {
  const marker = "## Forbidden Overreach";
  const idx = doc.indexOf(marker);
  assert.notEqual(idx, -1, "Forbidden Overreach section missing");
  return doc.slice(0, idx);
}

test("P170 proof pack files exist", () => {
  assert.equal(fs.existsSync(docPath), true, "P170 markdown pack must exist");
  assert.equal(fs.existsSync(contractPath), true, "P170 contract json must exist");
});

test("P170 contract allows only lawful mapping types", () => {
  const contract = JSON.parse(readUtf8(contractPath));

  assert.equal(contract.pack_id, "p170_first_coach_objection_handling_pack");
  assert.equal(contract.engine_compatibility, "EB2-1.0.0");
  assert.equal(contract.scope, "current_v0_only");

  assert.deepEqual(
    contract.mapping_types_allowed,
    ["proven_surface", "explicit_boundary"],
    "Only lawful mapping types are allowed"
  );

  assert.equal(Array.isArray(contract.items), true, "items must be an array");
  assert.equal(contract.items.length, 10, "Exactly 10 objections are required");

  for (const item of contract.items) {
    assert.match(item.id, /^coach_objection_\d{2}$/);
    assert.equal(typeof item.objection, "string");
    assert.ok(item.objection.length > 0, "objection text required");
    assert.ok(
      contract.mapping_types_allowed.includes(item.mapping_type),
      `Illegal mapping type detected: ${item.mapping_type}`
    );
    assert.equal(Array.isArray(item.anchors), true, "anchors must be an array");
    assert.ok(item.anchors.length > 0, `anchors required for ${item.id}`);
    for (const anchor of item.anchors) {
      assert.equal(typeof anchor, "string");
      assert.ok(anchor.length > 0, `anchor must be non-empty for ${item.id}`);
    }
  }
});

test("P170 contract rejects speculative mapping types by closed set", () => {
  const contract = JSON.parse(readUtf8(contractPath));
  const forbiddenMappingTypes = [
    "speculative_answer",
    "inferred_surface",
    "assumed_capability",
    "future_scope",
    "marketing_claim"
  ];

  for (const forbidden of forbiddenMappingTypes) {
    assert.equal(
      contract.mapping_types_allowed.includes(forbidden),
      false,
      `Forbidden mapping type must not be allowed: ${forbidden}`
    );
  }
});

test("P170 markdown pack contains all 10 objection headings", () => {
  const doc = readUtf8(docPath);

  const requiredHeadings = [
    `### 1) "This handcuffs me. I need to actually coach."`,
    `### 2) "If I can't override the engine, what's the point of me?"`,
    `### 3) "Can I edit what the athlete declared if they got it wrong?"`,
    `### 4) "So coach notes are useless then?"`,
    `### 5) "Can I see what my athlete actually did, or just what was planned?"`,
    `### 6) "Can I compare athletes and run broader team oversight from this?"`,
    `### 7) "Will it give me readiness scores or tell me who is progressing?"`,
    `### 8) "Will it explain why it chose something or why it substituted something?"`,
    `### 9) "Can I use this for my club, school, team, military unit, or gym right now?"`,
    `### 10) "Can I export proof, replay evidence, or audit packs for clients now?"`
  ];

  for (const heading of requiredHeadings) {
    assert.ok(doc.includes(heading), `Missing heading: ${heading}`);
  }
});

test("P170 markdown pack contains required proof language", () => {
  const doc = readUtf8(docPath);

  assert.ok(doc.includes("## Target"), "Target section missing");
  assert.ok(doc.includes("## Invariant"), "Invariant section missing");
  assert.ok(doc.includes("## Proof Statement"), "Proof Statement section missing");
  assert.ok(
    doc.includes("This pack is valid only if every objection answer maps to a proven surface or an explicit boundary and no answer implies capability outside the current v0 scope."),
    "Proof statement must be present"
  );
});

test("P170 answer body contains no forbidden overreach claims", () => {
  const doc = readUtf8(docPath);
  const answerBody = getDocBodyBeforeForbiddenOverreach(doc);

  const bannedPatterns = [
    /\bcoach can override engine decisions\b/i,
    /\bcoach can alter legality\b/i,
    /\bcoach can influence selection\b/i,
    /\bcoach can edit phase-1 truth after acceptance\b/i,
    /\breadiness scoring exists in current v0\b/i,
    /\banalytics dashboards exists in current v0\b/i,
    /\banalytics dashboards exist in current v0\b/i,
    /\borganisation, team, unit, or gym runtime exists in current v0\b/i,
    /\bevidence envelopes exist in current v0\b/i,
    /\bexportable proof artefacts exist in current v0\b/i,
    /\bmedical advice\b/i,
    /\bsafety advice\b/i,
    /\bsuitability advice\b/i,
    /\boptimisation advice\b/i
  ];

  for (const pattern of bannedPatterns) {
    assert.equal(pattern.test(answerBody), false, `Forbidden overreach matched in answer body: ${pattern}`);
  }
});

test("P170 objection mapping markers appear exactly 10 times", () => {
  const doc = readUtf8(docPath);
  const matches = doc.match(/\*\*Mapping\*\*/g) ?? [];
  assert.equal(matches.length, 10, "Each objection must declare exactly one mapping");
});