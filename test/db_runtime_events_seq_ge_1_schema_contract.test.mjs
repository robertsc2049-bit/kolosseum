import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("DB schema contract: runtime_events_seq_ge_1 CHECK (seq >= 1) must exist in schema.sql", () => {
  const p = "src/db/schema.sql";
  const s = fs.readFileSync(p, "utf8");

  // 1) Constraint name must exist (pin the canonical name)
  assert.ok(
    /\bruntime_events_seq_ge_1\b/i.test(s),
    "schema.sql must define constraint runtime_events_seq_ge_1"
  );

  // 2) Expression must be exactly seq >= 1 (pin the invariant)
  // Accept whitespace variance, but not logic drift.
  assert.ok(
    /ADD\s+CONSTRAINT\s+runtime_events_seq_ge_1\s+CHECK\s*\(\s*seq\s*>=\s*1\s*\)\s*;/i.test(s),
    "schema.sql must include: ADD CONSTRAINT runtime_events_seq_ge_1 CHECK (seq >= 1);"
  );

  // 3) Optional: ensure it targets runtime_events (avoid constraint name reuse elsewhere)
  assert.ok(
    /ALTER\s+TABLE\s+runtime_events[\s\S]{0,250}ADD\s+CONSTRAINT\s+runtime_events_seq_ge_1/i.test(s),
    "schema.sql must attach runtime_events_seq_ge_1 to ALTER TABLE runtime_events"
  );
});