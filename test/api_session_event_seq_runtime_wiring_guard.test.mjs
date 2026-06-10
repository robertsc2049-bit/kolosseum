import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const targetPath = path.join(repoRoot, "src", "api", "sessions.handlers.ts");
const raw = fs.readFileSync(targetPath, "utf8");

test("runtime session event seq wiring: sessions.handlers imports and validates allocNextSeq", () => {
  assert.match(
    raw,
    /import\s+\{\s*assertNextSessionEventSequence\s*\}\s+from\s+"\.\.\/domain\/session_event_sequence\.js";/,
    "sessions.handlers.ts must import assertNextSessionEventSequence from the domain helper"
  );

  assert.match(
    raw,
    /const nextSeq = Number\(r\.rows\?\.\[0\]\?\.next_seq\);[\s\S]*?if \(!Number\.isFinite\(nextSeq\) \|\| nextSeq < 1\) \{[\s\S]*?\}[\s\S]*?assertNextSessionEventSequence\(nextSeq - 1, nextSeq\);[\s\S]*?return nextSeq;/,
    "allocNextSeq must validate the returned next_seq before returning it"
  );

  assert.match(
    raw,
    /INSERT INTO runtime_events\(session_id, seq, event\)/,
    "sessions.handlers.ts must remain the runtime event append seam"
  );
});