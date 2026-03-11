import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("API persistence contract: session_event_seq is initialized at 0 at the remaining blocks.handlers compile-session init site", () => {
  const src = fs.readFileSync("src/api/blocks.handlers.ts", "utf8");

  assert.doesNotMatch(
    src,
    /INSERT\s+INTO\s+session_event_seq[\s\S]*?VALUES\s*\(\$1,\s*1\)/g,
    "blocks.handlers.ts must not initialize session_event_seq.next_seq to 1 (it creates a seq gap)"
  );

  const init0 = src.match(
    /INSERT\s+INTO\s+session_event_seq[\s\S]*?VALUES\s*\(\$1,\s*0\)/g
  ) ?? [];

  assert.equal(
    init0.length,
    1,
    `blocks.handlers.ts must initialize session_event_seq.next_seq to 0 at the remaining compile-session call site (found ${init0.length})`
  );
});