import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("API persistence contract: session_event_seq is initialized at 0 in block_compile_write_service for compile-session creation", () => {
  const src = fs.readFileSync("src/api/block_compile_write_service.ts", "utf8");

  assert.doesNotMatch(
    src,
    /INSERT\s+INTO\s+session_event_seq[\s\S]*?VALUES\s*\(\$1,\s*1\)/g,
    "block_compile_write_service.ts must not initialize session_event_seq.next_seq to 1 (it creates a seq gap)"
  );

  const init0 = src.match(
    /INSERT\s+INTO\s+session_event_seq[\s\S]*?VALUES\s*\(\$1,\s*0\)/g
  ) ?? [];

  assert.equal(
    init0.length,
    1,
    `block_compile_write_service.ts must initialize session_event_seq.next_seq to 0 at the compile-session call site (found ${init0.length})`
  );
});