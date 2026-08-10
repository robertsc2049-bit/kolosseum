// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-P-05 device sync boundary guard.
 * Purpose: proves the device/wearable sync boundary is declared before any device sync code exists.
 * Boundary: checks the boundary doc, its cross-referenced non-scope block, and generated index wiring.
 * Determinism: reads committed repository files only and emits one stable failure token.
 * Failure: emits CI_V1_DEVICE_SYNC_BOUNDARY_CONTRACT when the boundary doc or its cross-referenced
 * non-scope block drifts. A later S-V1-P-06 ingestion slice enforces its own prerequisite check that
 * this boundary doc exists before its code may ship - this guard does not assert code absence, since
 * that assertion would break permanently once S-V1-P-06 legitimately ships the files it names.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GUARD = "S-V1-P-05";
const TOKEN = "CI_V1_DEVICE_SYNC_BOUNDARY_CONTRACT";

const FILES = Object.freeze({
  doc: "docs/v1/V1_DEVICE_SYNC_BOUNDARY_CONTRACT.md",
  notInScope: "docs/v1/V1_NOT_IN_SCOPE.md",
  guard: "ci/guards/s_v1_p_05_device_sync_boundary_contract_guard.mjs",
  guardsIndex: "docs/GUARDS_INDEX.md",
  failureTokenIndex: "docs/dev/FAILURE_TOKEN_INDEX.md",
  checksums: "docs/checksums.sha256"
});

const NON_SCOPE_START = "<!-- S-V1-P-05:DEVICE-SYNC-BOUNDARY-NON-SCOPE:START -->";
const NON_SCOPE_END = "<!-- S-V1-P-05:DEVICE-SYNC-BOUNDARY-NON-SCOPE:END -->";

const REQUIRED_SNIPPETS = Object.freeze({
  [FILES.doc]: [
    "S-V1-P-05",
    "Device sync state is factual reported-metric state only.",
    "The deterministic engine boundary remains outside this contract.",
    "Allowed controls",
    "Not included",
    "provider-computed",
    "rejected at ingestion",
    "no device sync implementation code exists in this doc-only step",
    TOKEN
  ],
  [FILES.notInScope]: [
    NON_SCOPE_START,
    NON_SCOPE_END,
    "S-V1-P-05 Device Sync Boundary Non-Scope",
    "V1_DEVICE_SYNC_BOUNDARY_CONTRACT.md"
  ],
  [FILES.guardsIndex]: [
    "s_v1_p_05_device_sync_boundary_contract_guard.mjs"
  ],
  [FILES.failureTokenIndex]: [
    TOKEN
  ],
  [FILES.checksums]: []
});

const errors = [];

function fail(message, details = {}) {
  errors.push({ message, details });
}

function read(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  if (!fs.existsSync(fullPath)) {
    fail(`Missing required file: ${relativePath}`);
    return "";
  }

  return fs.readFileSync(fullPath, "utf8").replace(/\r\n/g, "\n");
}

function assertIncludes(text, needle, file) {
  if (!text.includes(needle)) {
    fail(`${file} must include ${needle}`);
  }
}

function assertNotIncludes(text, needle, file) {
  if (text.includes(needle)) {
    fail(`${file} must not include ${needle}`);
  }
}

for (const file of Object.values(FILES)) {
  read(file);
}

for (const [file, snippets] of Object.entries(REQUIRED_SNIPPETS)) {
  const text = read(file);
  for (const snippet of snippets) {
    assertIncludes(text, snippet, file);
  }
}

const notInScopeText = read(FILES.notInScope);
const startIndex = notInScopeText.indexOf(NON_SCOPE_START);
const endIndex = notInScopeText.indexOf(NON_SCOPE_END);
if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
  fail(`${FILES.notInScope} must contain a well-formed S-V1-P-05 anchored non-scope block`);
}

const docText = read(FILES.doc);
for (const forbidden of [
  "S-V1-P-05 implements",
  "OAuth implementation",
  "live provider integration"
]) {
  assertNotIncludes(docText, forbidden, FILES.doc);
}


const guardText = read(FILES.guard);
assertIncludes(guardText, `const TOKEN = "${TOKEN}";`, FILES.guard);
assertIncludes(guardText, "DEV NOTE:", FILES.guard);

if (errors.length > 0) {
  console.error(JSON.stringify({
    ok: false,
    guard: GUARD,
    token: TOKEN,
    failures: errors
  }, null, 2));
  process.exitCode = 1;
}
else {
  console.log(JSON.stringify({
    ok: true,
    guard: "s_v1_p_05_device_sync_boundary_contract_guard",
    token: TOKEN,
    message: "Device sync boundary contract passed."
  }, null, 2));
}
