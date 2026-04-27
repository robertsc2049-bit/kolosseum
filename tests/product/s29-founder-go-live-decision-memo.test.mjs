import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const docPath = "docs/product/S29_FOUNDER_GO_LIVE_DECISION_MEMO.md";
const doc = fs.readFileSync(docPath, "utf8");

test("S29 declares explicit decision", () => {
  assert.match(doc, /GO-LIVE STATUS: SHIP/);
});

test("S29 cites required slices", () => {
  assert.match(doc, /S1/);
  assert.match(doc, /S6/);
  assert.match(doc, /S7/);
  assert.match(doc, /S24/);
  assert.match(doc, /S25/);
  assert.match(doc, /S26/);
  assert.match(doc, /S27/);
  assert.match(doc, /S28/);
});

test("S29 includes required proofs", () => {
  assert.match(doc, /lint:fast passes/);
  assert.match(doc, /engine contract guard passes/);
  assert.match(doc, /golden outputs guard passes/);
  assert.match(doc, /registry law guard passes/);
  assert.match(doc, /CI runs on main show green status/);
});

test("S29 includes known limitations", () => {
  assert.match(doc, /no messaging/);
  assert.match(doc, /no dashboards/);
  assert.match(doc, /no evidence export/);
});

test("S29 includes pilot cap", () => {
  assert.match(doc, /Maximum pilot size/);
});

test("S29 defines hold conditions", () => {
  assert.match(doc, /must be held/);
  assert.match(doc, /lint:fast fails/);
  assert.match(doc, /CI on main is not green/);
});