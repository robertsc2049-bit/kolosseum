import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("API canonical_hash wiring: blocks.handlers uses selectCanonicalHash (no client trust)", () => {
  const srcTs = fs.readFileSync("src/api/blocks.handlers.ts", "utf8");
  assert.ok(
    srcTs.includes('selectCanonicalHash'),
    "src/api/blocks.handlers.ts must reference selectCanonicalHash"
  );
  assert.ok(
    !srcTs.includes("asString(body.canonical_hash) ?? p2.phase2.phase2_hash"),
    "blocks.handlers must not default to trusting caller canonical_hash"
  );
});