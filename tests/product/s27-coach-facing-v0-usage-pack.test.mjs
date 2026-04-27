import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const docPath = "docs/product/S27_COACH_FACING_V0_USAGE_PACK.md";
const doc = fs.readFileSync(docPath, "utf8");

test("S27 contains the required proof artefacts", () => {
  assert.match(doc, /## 1\. Coach quickstart/);
  assert.match(doc, /## 2\. Allowed \/ not allowed sheet/);
  assert.match(doc, /## 3\. Example workflow/);
});

test("S27 locks coach behaviour to assign, view, and note", () => {
  assert.match(doc, /Coach behaviour stays inside assign, view, and note boundaries\./);
  assert.match(doc, /Coaches may comment, never decide\./);
  assert.match(doc, /- assign/);
  assert.match(doc, /- view/);
  assert.match(doc, /- note/);
});

test("S27 covers required coach actions", () => {
  assert.match(doc, /Assign session/);
  assert.match(doc, /View artefact/);
  assert.match(doc, /Add note/);
  assert.match(doc, /Coach notes are:/);
  assert.match(doc, /not read by the engine/);
});

test("S27 states what the coach cannot declare or decide", () => {
  assert.match(doc, /## 4\. Coach cannot declare or decide/);
  assert.match(doc, /A coach cannot declare:/);
  assert.match(doc, /A coach cannot decide:/);
  assert.match(doc, /athlete Phase 1 inputs/);
  assert.match(doc, /engine legality/);
});

test("S27 keeps v0 inside Phase 1 through Phase 6 only", () => {
  assert.match(doc, /Phase 1 through Phase 6 only/);
  assert.match(doc, /Phase 7 truth projection/);
  assert.match(doc, /Phase 8 evidence sealing/);
  assert.match(doc, /evidence export/);
});

test("S27 UI allowed labels do not include authority labels", () => {
  const start = doc.indexOf("Coach-facing v0 UI should use only these action labels:");
  const end = doc.indexOf("Coach-facing v0 UI must not use labels");
  assert.ok(start >= 0);
  assert.ok(end > start);

  const allowedSection = doc.slice(start, end);
  const forbidden = [
    "Decide",
    "Approve",
    "Clear",
    "Recommend",
    "Prescribe",
    "Progress",
    "Override"
  ];

  for (const word of forbidden) {
    assert.equal(allowedSection.includes(word), false, `${word} appeared in allowed UI labels`);
  }
});