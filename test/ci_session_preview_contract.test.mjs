import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

test("session preview prints a visible human-readable preview for a known valid fixture", () => {
  const out = execFileSync(
    process.execPath,
    ["ci/scripts/session_preview.mjs", "test/fixtures/phase1_to_phase6.valid.general_strength.individual.json"],
    { encoding: "utf8" }
  );

  assert.match(out, /== SESSION PREVIEW ==/);
  assert.match(out, /Status: OK/);
  assert.match(out, /== NOTES ==/);
  assert.match(out, /== SESSION ==/);
  assert.match(out, /\(no visible session lines found\)|1\.\s/);
  assert.match(out, /== RAW RESULT KEYS ==/);
});
