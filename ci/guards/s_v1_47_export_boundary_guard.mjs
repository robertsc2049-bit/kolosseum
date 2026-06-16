// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-47 export boundary guard.
 * This guard protects the proof export boundary as a permission-scoped,
 * immutable, single-artefact surface. It verifies contract, API, copy, docs,
 * package wiring, and failure-token index wiring without granting any broad
 * data export or entity surface.
 */
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const TOKEN = "CI_V1_EXPORT_BOUNDARY";

const requiredFiles = [
  "src/v1ExportBoundaryContract.mjs",
  "src/api/v1ExportBoundaryApi.mjs",
  "test/s_v1_47_export_boundary.test.mjs",
  "ci/guards/s_v1_47_export_boundary_guard.mjs",
  "docs/v1/V1_EXPORT_BOUNDARY.md",
  "copy/export_boundary_copy.json"
];

const requiredSnippets = new Map([
  ["src/v1ExportBoundaryContract.mjs", [
    "S_V1_47_EXPORT_BOUNDARY_VERSION",
    "EXPORT_ALLOWED_TYPES",
    "proof_artefact_json",
    "evidence_envelope_json",
    "single_proof_artefact",
    "createV1ExportBoundary",
    "serializeV1Export",
    "assertV1ExportBoundary",
    "bulk_data_export",
    "entity_export",
    "coach_notes_export",
    "raw_runtime_events_export",
    "sourceIsImmutable",
    "copy_notice_id",
    "coach_notes_surface",
    "runtime_events_surface"
  ]],
  ["src/api/v1ExportBoundaryApi.mjs", [
    "handleV1ExportBoundaryApiRequest",
    "createV1ExportBoundary",
    "serializeV1Export"
  ]],
  ["test/s_v1_47_export_boundary.test.mjs", [
    "allowed path",
    "forbidden path blocks broad export scope",
    "forbidden path blocks broad export type",
    "forbidden path blocks mutable source envelope",
    "copy entries stay neutral"
  ]],
  ["docs/v1/V1_EXPORT_BOUNDARY.md", [
    "S-V1-47",
    "single proof artefact",
    "immutable",
    "Not included",
    "Standard proof sequence"
  ]],
  ["copy/export_boundary_copy.json", [
    "export_boundary.available",
    "export_boundary.blocked",
    "export_boundary.single_artefact_only",
    "export_boundary.neutral_notice"
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
    record("Missing required S-V1-47 file: " + file);
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

const source = readText("src/v1ExportBoundaryContract.mjs");
if (source.includes("from \"../engine") || source.includes("from \"./engine") || source.includes("from \"../../engine")) {
  record("S-V1-47 export contract must not import engine code.");
}

if (/\bcoach_notes:\s*"not_included"/.test(source)) {
  record("S-V1-47 boundary metadata must not use blocked key coach_notes.");
}

if (/\braw_runtime_events:\s*"not_included"/.test(source)) {
  record("S-V1-47 boundary metadata must not use blocked key raw_runtime_events.");
}

const copyText = readText("copy/export_boundary_copy.json").toLowerCase();
const blockedCopyTerms = [
  "recommended",
  "optim",
  "readiness",
  "injur",
  "medical",
  "diagnos",
  "rehab"
];

for (const term of blockedCopyTerms) {
  if (copyText.includes(term)) {
    record("Export copy contains blocked neutral-copy term fragment: " + term);
  }
}

const packageJson = readText("package.json");
if (!packageJson.includes("node --test test/s_v1_47_export_boundary.test.mjs")) {
  record("package.json lint:fast does not run S-V1-47 test.");
}
if (!packageJson.includes("node ci/guards/s_v1_47_export_boundary_guard.mjs")) {
  record("package.json lint:fast does not run S-V1-47 guard.");
}

const failureIndex = readText("docs/dev/FAILURE_TOKEN_INDEX.md");
if (!failureIndex.includes(TOKEN)) {
  record("TOKEN_INDEX.md does not index S-V1-47 guard token.");
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
    guard: "s_v1_47_export_boundary_guard",
    token: TOKEN
  }, null, 2));
}
