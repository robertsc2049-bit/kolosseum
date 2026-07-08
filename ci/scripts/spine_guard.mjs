
// DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
// deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
// failure output readable for PowerShell and CI users.

import fs from "node:fs";
import path from "node:path";

// DEV NOTE: Spine document presence guard boundary.
// Purpose: ensure docs/SPINE.md still points at committed authority documents.
// Boundary: this guard checks listed document presence only; authority ordering
// remains in the spine document and canonical release docs.
// Determinism: bold document references are parsed with one fixed expression and
// checked relative to docs/.
// Failure: missing spine, empty spine references, or missing listed files emit
// stable CI_SPINE_* messages and set a non-zero process status.
const spinePath = path.resolve("docs/SPINE.md");
if (!fs.existsSync(spinePath)) {
  console.error("CI_SPINE_MISSING_DOC: docs/SPINE.md not found");
  process.exit(1);
}

const spine = fs.readFileSync(spinePath, "utf8");

// Extract filenames in bold: **FILE**
const matches = [...spine.matchAll(/\*\*([^*]+\.(?:md|docx))\*\*/g)].map(m => m[1]);

if (matches.length === 0) {
  console.error("CI_SPINE_AUTHORITY_CONFLICT: no documents detected in SPINE.md");
  process.exit(1);
}

let failed = false;
for (const file of matches) {
  const p = path.resolve("docs", file);
  if (!fs.existsSync(p)) {
    console.error(`CI_SPINE_MISSING_DOC: ${file} listed in SPINE.md but missing at docs/${file}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("spine_guard: OK");
