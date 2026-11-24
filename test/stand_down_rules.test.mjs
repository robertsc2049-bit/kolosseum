// When a medical stand-down is still in force: after a head injury only
// clearance ends it; another medical reason runs to its date.
import assert from "node:assert/strict";
import test from "node:test";

import { standDownInForce } from "../dist/src/api/stand_down_rules.js";

const concussion = { reason: "head_injury", from_date: "2026-11-01", until_date: "2026-11-21", schema_version: "stand_down_v2" };

test("a head injury's date passing is not clearance: still stood down the day after, and months later", () => {
  assert.equal(standDownInForce(concussion, "2026-11-10"), true);
  assert.equal(standDownInForce(concussion, "2026-11-22"), true);
  assert.equal(standDownInForce(concussion, "2027-03-01"), true);
  assert.equal(standDownInForce(concussion, "2026-10-31"), false, "not before it was recorded");
});

test("another medical reason ends on its date", () => {
  const medical = { ...concussion, reason: "medical" };
  assert.equal(standDownInForce(medical, "2026-11-21"), true);
  assert.equal(standDownInForce(medical, "2026-11-22"), false);
});

test("recorded under the old date rule: an athlete already back training isn't locked out again, one who isn't still needs clearance", () => {
  const old = { ...concussion, schema_version: "stand_down_v1" };
  assert.equal(standDownInForce(old, "2026-12-01", "2026-11-25"), false, "has had a session since the date");
  assert.equal(standDownInForce(old, "2026-12-01", "2026-10-20"), true, "nothing since");
  assert.equal(standDownInForce(old, "2026-12-01", null), true);
  assert.equal(standDownInForce(old, "2026-11-21", "2026-11-25"), true, "never before its date");
  assert.equal(standDownInForce(concussion, "2026-12-01", "2026-11-25"), true, "a new one always needs clearance");
});
