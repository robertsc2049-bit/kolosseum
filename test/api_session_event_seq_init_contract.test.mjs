import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("API persistence contract: session_event_seq is initialized at 0 (first allocated seq == 1)", () => {
  const p = "src/api/blocks.handlers.ts";
  const s = fs.readFileSync(p, "utf8");

  // Allow: session_event_seq, public.session_event_seq, "session_event_seq", public."session_event_seq"
  const tbl = String.raw`(?:(?:[a-zA-Z_][a-zA-Z0-9_]*\s*\.\s*)?"?session_event_seq"?)`;

  // Require the canonical column list (this avoids accidental matches elsewhere)
  const cols = String.raw`\(\s*session_id\s*,\s*next_seq\s*\)`;

  // Allow $1 with optional parentheses and optional cast (e.g., $1::uuid)
  const arg1 = String.raw`\(?\s*\$1(?:\s*::\s*[a-zA-Z_][a-zA-Z0-9_]*)?\s*\)?`;

  // Allow 0/1 with optional cast (e.g., 0::int)
  const v0 = String.raw`0(?:\s*::\s*[a-zA-Z_][a-zA-Z0-9_]*)?`;
  const v1 = String.raw`1(?:\s*::\s*[a-zA-Z_][a-zA-Z0-9_]*)?`;

  // Match the full init statement shape, tolerant of newlines/indentation
  const reInit0 = new RegExp(
    String.raw`INSERT\s+INTO\s+${tbl}\s*${cols}[\s\S]*?VALUES\s*\(\s*${arg1}\s*,\s*${v0}\s*\)`,
    "gmi"
  );

  const reInit1 = new RegExp(
    String.raw`INSERT\s+INTO\s+${tbl}\s*${cols}[\s\S]*?VALUES\s*\(\s*${arg1}\s*,\s*${v1}\s*\)`,
    "gmi"
  );

  const init0 = s.match(reInit0) ?? [];
  const init1 = s.match(reInit1) ?? [];

  assert.equal(
    init1.length,
    0,
    "blocks.handlers.ts must not initialize session_event_seq.next_seq to 1 (it creates a seq gap)"
  );

  // Two call sites expected (you showed two previously).
  assert.equal(
    init0.length,
    2,
    `blocks.handlers.ts must initialize session_event_seq.next_seq to 0 at both call sites (found ${init0.length})`
  );
});