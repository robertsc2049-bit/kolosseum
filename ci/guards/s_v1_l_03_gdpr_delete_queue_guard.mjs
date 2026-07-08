// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-L-03 GDPR delete queue guard.
 * Purpose: proves the GDPR deletion surface records a queue request only and
 * keeps retention, audit/proof, and engine-truth boundaries explicit.
 * Boundary: legal/product request queue only; no provider calls, no hard delete,
 * no runtime-history mutation, no engine import, and no coaching claims.
 * Determinism: reads committed files and required snippets only.
 * Failure: emits CI_V1_GDPR_DELETE_QUEUE when queue boundaries drift.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GUARD = "S-V1-L-03";
const TOKEN = "CI_V1_GDPR_DELETE_QUEUE";

const FILES = Object.freeze({
  source: "src/v1GdprDeleteQueue.mjs",
  api: "src/api/v1GdprDeleteQueueApi.mjs",
  test: "test/s_v1_l_03_gdpr_delete_queue.test.mjs",
  guard: "ci/guards/s_v1_l_03_gdpr_delete_queue_guard.mjs",
  doc: "docs/v1/V1_GDPR_DELETE_QUEUE.md",
  copy: "copy/gdpr_delete_queue_copy.json",
  packageJson: "package.json",
  guardsIndex: "docs/GUARDS_INDEX.md",
  failureTokenIndex: "docs/dev/FAILURE_TOKEN_INDEX.md"
});

const REQUIRED_SNIPPETS = Object.freeze({
  [FILES.source]: [
    "S_V1_L_03_GDPR_DELETE_QUEUE_VERSION",
    "GDPR_DELETE_QUEUE_SURFACE_ID",
    "GDPR_DELETE_QUEUE_BOUNDARY",
    "subject_erasure_request",
    "own_user_data",
    "createGdprDeleteQueueRequest",
    "serializeGdprDeleteQueueRequest",
    "assertGdprDeleteQueueRequest",
    "request_recorded: true",
    "retention_review_required: true",
    "hard_delete_performed: false",
    "proof_or_audit_records_hard_deleted: false",
    "engine_truth_changed: false",
    "retroactive_engine_mutation: false",
    "findBlockedDeletePayloadKey"
  ],
  [FILES.api]: [
    "handleGdprDeleteQueueApiRequest",
    "createGdprDeleteQueueRequest",
    "status: result.ok === true ? 202 : 403",
    "hard_delete_performed: false",
    "engine_truth_changed: false"
  ],
  [FILES.test]: [
    "delete request queued test records own-data request without hard deletion",
    "retention boundary test keeps proof audit and engine truth records review-only",
    "permission test blocks another target user",
    "permission test blocks retention records owned by another user",
    "deterministic queue hash is stable and engine truth remains unchanged",
    "copy entries stay neutral",
    "boundary object is explicit and closed for hard deletion"
  ],
  [FILES.doc]: [
    "S-V1-L-03",
    "Delete request is recorded.",
    "Audit/legal retention boundaries are explicit.",
    "Engine truth is not retroactively mutated.",
    "CI_V1_GDPR_DELETE_QUEUE"
  ],
  [FILES.copy]: [
    "gdpr_delete_queue.request_queued",
    "gdpr_delete_queue.blocked",
    "gdpr_delete_queue.own_data_only",
    "gdpr_delete_queue.retention_review_required",
    "gdpr_delete_queue.no_engine_change"
  ],
  [FILES.packageJson]: [
    "test/s_v1_l_03_gdpr_delete_queue.test.mjs",
    "ci/guards/s_v1_l_03_gdpr_delete_queue_guard.mjs"
  ],
  [FILES.guard]: [
    `const TOKEN = "${TOKEN}";`,
    "DEV NOTE:",
    "token: TOKEN"
  ]
});

const FORBIDDEN_SOURCE_IMPORTS = Object.freeze([
  "@kolosseum/engine",
  "from \"../engine",
  "from \"./engine",
  "from \"../../engine",
  "engine/src/",
  "from \"stripe\"",
  "from 'stripe'",
  "require(\"stripe\")",
  "require('stripe')"
]);

const FORBIDDEN_ACTIVATION_SNIPPETS = Object.freeze([
  "hard_delete_performed: true",
  "proof_or_audit_records_hard_deleted: true",
  "engine_truth_changed: true",
  "retroactive_engine_mutation: true",
  "provider_call_performed: true",
  "deleteRuntimeEvent",
  "deleteProofRecord",
  "deleteAuditRecord"
]);

const FORBIDDEN_COPY_TERMS = Object.freeze([
  "recommend",
  "recommended",
  "optimise",
  "optimize",
  "ready",
  "safe",
  "safety",
  "suitable",
  "approved",
  "cleared",
  "guarantee",
  "risk score",
  "fit for duty"
]);

const errors = [];

function fail(message, details = {}) {
  errors.push({ message, details });
}

function read(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  if (!fs.existsSync(fullPath)) {
    fail("Missing required file.", { path: relativePath });
    return "";
  }

  return fs.readFileSync(fullPath, "utf8").replace(/\r\n/g, "\n");
}

function assertIncludes(text, needle, file) {
  if (!text.includes(needle)) {
    fail(file + " must include required snippet.", { snippet: needle });
  }
}

function assertNotIncludes(text, needle, file) {
  if (text.includes(needle)) {
    fail(file + " must not include blocked snippet.", { snippet: needle });
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

for (const file of [FILES.source, FILES.api]) {
  const text = read(file);
  for (const forbiddenImport of FORBIDDEN_SOURCE_IMPORTS) {
    assertNotIncludes(text, forbiddenImport, file);
  }
}

for (const file of [FILES.source, FILES.api]) {
  const text = read(file);
  for (const blocked of FORBIDDEN_ACTIVATION_SNIPPETS) {
    assertNotIncludes(text, blocked, file);
  }
}

const copyText = read(FILES.copy).toLowerCase();
for (const term of FORBIDDEN_COPY_TERMS) {
  if (copyText.includes(term)) {
    fail("S-V1-L-03 copy contains blocked claim term.", { term });
  }
}

const source = read(FILES.source);
if (!source.includes("legal_request_queue_only: true") ||
    !source.includes("request_recorded: true") ||
    !source.includes("retention_review_required: true") ||
    !source.includes("hard_delete_performed: false") ||
    !source.includes("proof_or_audit_records_hard_deleted: false") ||
    !source.includes("retroactive_engine_mutation: false")) {
  fail("S-V1-L-03 source must keep explicit queue and retention boundary flags.");
}

const testText = read(FILES.test);
if (!testText.includes("assert.equal(result.request_recorded, true)") ||
    !testText.includes("assert.equal(result.boundary.hard_delete_performed, false)") ||
    !testText.includes("assert.equal(result.boundary.proof_or_audit_records_hard_deleted, false)") ||
    !testText.includes("assert.equal(result.boundary.retroactive_engine_mutation, false)")) {
  fail("S-V1-L-03 tests must prove queue recording and retention boundary flags.");
}

if (errors.length > 0) {
  console.error(JSON.stringify({
    ok: false,
    guard: GUARD,
    token: TOKEN,
    failures: errors
  }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    ok: true,
    guard: "s_v1_l_03_gdpr_delete_queue_guard",
    token: TOKEN,
    message: "GDPR delete queue passed."
  }, null, 2));
}