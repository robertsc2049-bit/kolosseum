// @law: Repo Governance
// @severity: medium
// @scope: repo
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const TOKEN = "CI_V1_GDPR_EXPORT_HANDLING";

const requiredFiles = [
  "src/v1GdprExportHandling.mjs",
  "src/api/v1GdprExportHandlingApi.mjs",
  "test/s_v1_l_02_gdpr_export_handling.test.mjs",
  "ci/guards/s_v1_l_02_gdpr_export_handling_guard.mjs",
  "docs/v1/V1_GDPR_EXPORT_HANDLING.md",
  "copy/gdpr_export_copy.json"
];

const requiredSnippets = new Map([
  ["src/v1GdprExportHandling.mjs", [
    "S_V1_L_02_GDPR_EXPORT_HANDLING_VERSION",
    "GDPR_EXPORT_ALLOWED_REQUEST_TYPES",
    "subject_data_access_json",
    "own_user_data_only",
    "createGdprExportHandling",
    "serializeGdprExportHandling",
    "assertGdprExportHandling",
    "proof_layer_export: false",
    "organisation_export: false",
    "broad_analytics_export: false",
    "engine_truth_changed: false",
    "coaching_correctness_claim: false",
    "findBlockedPayloadKey",
    "assertRecordBelongsToSubject"
  ]],
  ["src/api/v1GdprExportHandlingApi.mjs", [
    "handleGdprExportHandlingApiRequest",
    "createGdprExportHandling",
    "engine_truth_changed: false"
  ]],
  ["test/s_v1_l_02_gdpr_export_handling.test.mjs", [
    "allowed path exports own user data only",
    "permission test blocks another target user",
    "permission test blocks records owned by another user",
    "blocks proof evidence organisation analytics and broad export scope",
    "deterministic probe is hashed and engine truth remains unchanged",
    "copy entries stay neutral"
  ]],
  ["docs/v1/V1_GDPR_EXPORT_HANDLING.md", [
    "S-V1-L-02",
    "own data",
    "Not included",
    "Standard proof sequence"
  ]],
  ["copy/gdpr_export_copy.json", [
    "gdpr_export.available",
    "gdpr_export.blocked",
    "gdpr_export.own_data_only",
    "gdpr_export.legal_data_access_only",
    "gdpr_export.neutral_notice"
  ]],
  ["package.json", [
    "test/s_v1_l_02_gdpr_export_handling.test.mjs",
    "ci/guards/s_v1_l_02_gdpr_export_handling_guard.mjs"
  ]]
]);

const errors = [];

function record(message) {
  errors.push(message);
}

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(repoRoot, file))) {
    record("Missing required S-V1-L-02 file: " + file);
  }
}

for (const [file, snippets] of requiredSnippets.entries()) {
  if (!fs.existsSync(path.join(repoRoot, file))) {
    continue;
  }

  const text = readText(file);
  for (const snippet of snippets) {
    if (!text.includes(snippet)) {
      record(file + " missing required snippet: " + snippet);
    }
  }
}

const source = readText("src/v1GdprExportHandling.mjs");
const api = readText("src/api/v1GdprExportHandlingApi.mjs");
const test = readText("test/s_v1_l_02_gdpr_export_handling.test.mjs");
const doc = readText("docs/v1/V1_GDPR_EXPORT_HANDLING.md");
const copy = readText("copy/gdpr_export_copy.json");

for (const [label, text] of [
  ["source", source],
  ["api", api]
]) {
  if (text.includes("from \"./engine") || text.includes("from \"../engine") || text.includes("from \"../../engine")) {
    record("S-V1-L-02 " + label + " must not import engine code.");
  }

  if (text.includes("from './engine") || text.includes("from '../engine") || text.includes("from '../../engine")) {
    record("S-V1-L-02 " + label + " must not import engine code.");
  }
}

for (const blocked of [
  "evidence_envelope_json",
  "proof_artefact_json",
  "bulk_data_export: true",
  "organisation_export: true",
  "organization_export: true",
  "broad_analytics_export: true",
  "engine_truth_changed: true"
]) {
  if (source.includes(blocked) || api.includes(blocked)) {
    record("S-V1-L-02 active source contains blocked boundary activation: " + blocked);
  }
}

for (const required of [
  "actor_user_id !== input.target_user_id",
  "gdpr_export_permission_denied",
  "gdpr_export_record_permission_denied",
  "gdpr_export_blocked_payload_key",
  "stableGdprExportJson"
]) {
  if (!source.includes(required)) {
    record("S-V1-L-02 source missing permission or determinism snippet: " + required);
  }
}

for (const forbiddenCopy of [
  /\brecommend/i,
  /\boptimise\b/i,
  /\boptimize\b/i,
  /\bready\b/i
]) {
  if (forbiddenCopy.test(copy)) {
    record("S-V1-L-02 copy contains forbidden neutral-copy term: " + forbiddenCopy);
  }
}

for (const requiredDocSnippet of [
  "GDPR export is legal data access only.",
  "Export is permission-scoped to the requesting user's own data.",
  "Export does not alter deterministic engine truth."
]) {
  if (!doc.includes(requiredDocSnippet)) {
    record("S-V1-L-02 doc missing required boundary sentence: " + requiredDocSnippet);
  }
}

if (!test.includes("assert.equal(result.boundary.proof_layer_export, false)") ||
    !test.includes("assert.equal(result.boundary.organisation_export, false)") ||
    !test.includes("assert.equal(result.boundary.broad_analytics_export, false)")) {
  record("S-V1-L-02 tests must assert excluded export surfaces remain false.");
}

if (errors.length > 0) {
  console.error(JSON.stringify({
    ok: false,
    token: TOKEN,
    errors
  }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    ok: true,
    token: TOKEN
  }, null, 2));
}
