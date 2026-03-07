import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const targetPath = path.join(repoRoot, "src\\db\\schema.sql");
const raw = fs.readFileSync(targetPath, "utf8");

test("API session event seq wiring: append seam imports and calls assertNextSessionEventSequence", () => {
  assert.match(
    raw,
    /import\s+\{\s*assertNextSessionEventSequence\s*\}\s+from\s+[""'][^""']+session_event_sequence\.js[""'];/,
    "target file must import assertNextSessionEventSequence from the domain helper"
  );

  assert.match(
    raw,
    /assertNextSessionEventSequence\(\s*\w+\.session_event_seq\s*,\s*\w+\s*\);/,
    "target file must validate allocated next seq against persisted session_event_seq"
  );

  assert.match(
    raw,
    /session_event_seq/,
    "target file must still own/read the persisted session_event_seq seam"
  );
});