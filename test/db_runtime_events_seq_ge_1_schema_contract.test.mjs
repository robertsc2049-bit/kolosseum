
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

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

test("S-V0-13 DB schema contract: runtime event ordering tables preserve sequence integrity", async () => {
  const fs = await import("node:fs/promises");
  const schema = await fs.readFile("src/db/schema.sql", "utf8");

  assert.match(
    schema,
    /CREATE TABLE IF NOT EXISTS session_event_seq\s*\([\s\S]*?session_id[\s\S]*?PRIMARY KEY[\s\S]*?next_seq[\s\S]*?\)/i,
    "session_event_seq must have one authoritative row per session"
  );

  assert.match(
    schema,
    /CREATE TABLE IF NOT EXISTS runtime_events\s*\([\s\S]*?session_id[\s\S]*?seq[\s\S]*?event[\s\S]*?\)/i,
    "runtime_events table must contain session_id, seq, and event"
  );

  assert.match(
    schema,
    /CREATE INDEX IF NOT EXISTS runtime_events_session_id_seq_idx\s+ON runtime_events\s*\(\s*session_id\s*,\s*seq\s*\)/i,
    "runtime_events must keep the session_id, seq read path indexed"
  );

  assert.match(
    schema,
    /ADD CONSTRAINT runtime_events_seq_ge_1 CHECK\s*\(\s*seq\s*>=\s*1\s*\)/i,
    "runtime_events seq must be constrained to positive values"
  );
});
