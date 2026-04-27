import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const docPath = "docs/product/S28_ATHLETE_FACING_V0_USAGE_PACK.md";
const doc = fs.readFileSync(docPath, "utf8");

test("S28 contains the required proof artefacts", () => {
  assert.match(doc, /## 1\. Athlete quickstart/);
  assert.match(doc, /## 2\. Session execution guide/);
  assert.match(doc, /## 3\. Split \/ return guide/);
  assert.match(doc, /## 4\. What this system does not do yet/);
});

test("S28 lets athlete complete the live path without unsupported features", () => {
  assert.match(doc, /Phase 1 declaration/);
  assert.match(doc, /Open available session/);
  assert.match(doc, /Execute session/);
  assert.match(doc, /Use split and return/);
  assert.match(doc, /Finish or leave partial/);
  assert.match(doc, /View own history/);
});

test("S28 includes required blocked-state messages", () => {
  assert.match(doc, /Phase 1 declaration is required before execution can start\./);
  assert.match(doc, /No executable session is available\./);
  assert.match(doc, /Coach-assigned execution requires an accepted coach-managed link\./);
  assert.match(doc, /No return state is available for this session\./);
  assert.match(doc, /This session is not available to this athlete\./);
});

test("S28 keeps v0 inside Phase 1 through Phase 6 only", () => {
  assert.match(doc, /Phase 7 truth projection/);
  assert.match(doc, /Phase 8 evidence sealing/);
  assert.match(doc, /evidence export/);
});

test("S28 final lock is athlete-only and factual", () => {
  assert.match(doc, /- declare/);
  assert.match(doc, /- execute/);
  assert.match(doc, /- record/);
  assert.match(doc, /- split/);
  assert.match(doc, /- return/);
  assert.match(doc, /- view own factual history/);
});

test("S28 does not introduce unsupported UI expectations", () => {
  const forbidden = [
    "chat",
    "leaderboard",
    "team dashboard",
    "export proof",
    "seal evidence"
  ];

  const lower = doc.toLowerCase();
  for (const word of forbidden) {
    assert.equal(lower.includes(word), false, `${word} appeared in S28`);
  }
});