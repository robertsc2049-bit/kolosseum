import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("API persistence contract: allocNextSeq must not silently default seq (ban ?? 1)", () => {
  const p = "src/api/sessions.handlers.ts";
  const s = fs.readFileSync(p, "utf8");

  // Ban the exact historical footgun: returning Number(... ?? 1)
  assert.ok(
    !/next_seq\s*\?\?\s*1/.test(s),
    "sessions.handlers.ts must not use next_seq ?? 1 (silent seq default is forbidden)"
  );

  // Require the hard invariant (rowCount must be 1)
  assert.ok(
    /rowCount\s*!==\s*1/.test(s) || /rowCount\s*!=\s*1/.test(s),
    "allocNextSeq must hard-fail when rowCount != 1 (invariant check missing)"
  );

  // Require nextSeq validation (finite and >= 1)
  assert.ok(
    /Number\.isFinite\s*\(\s*nextSeq\s*\)/.test(s),
    "allocNextSeq must validate nextSeq is finite"
  );
  assert.ok(
    /nextSeq\s*<\s*1/.test(s),
    "allocNextSeq must hard-fail when nextSeq < 1"
  );
});