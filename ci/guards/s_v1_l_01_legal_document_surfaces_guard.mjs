// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-L-01 legal document surfaces guard.
 * Purpose: proves controlled-launch legal document routes render without creating product claims or engine coupling.
 * Boundary: Terms, Privacy, DPA, and legal index only; no GDPR workflow, no enterprise legal workflow, no provider calls, and no engine mutation.
 * Determinism: reads committed repository files only and emits one stable failure token.
 * Failure: emits CI_V1_LEGAL_DOCUMENT_SURFACES when legal document rendering widens scope or creates blocked claims.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GUARD = "S-V1-L-01";
const TOKEN = "CI_V1_LEGAL_DOCUMENT_SURFACES";

const FILES = Object.freeze({
  source: "src/v1LegalDocumentSurfaces.mjs",
  api: "src/api/v1LegalDocumentSurfacesApi.mjs",
  test: "test/s_v1_l_01_legal_document_surfaces.test.mjs",
  guard: "ci/guards/s_v1_l_01_legal_document_surfaces_guard.mjs",
  doc: "docs/v1/V1_LEGAL_DOCUMENT_SURFACES.md",
  copy: "copy/legal_document_surfaces_copy.json",
  paymentBoundary: "src/v1PaymentBoundaryContract.mjs",
  packageJson: "package.json",
  guardsIndex: "docs/GUARDS_INDEX.md",
  failureTokenIndex: "docs/dev/FAILURE_TOKEN_INDEX.md"
});

const REQUIRED_SNIPPETS = Object.freeze({
  [FILES.source]: [
    "S_V1_L_01_LEGAL_DOCUMENT_SURFACES_VERSION",
    "LEGAL_DOCUMENT_KEYS",
    "controlled_launch_legal_index",
    "controlled_launch_terms",
    "controlled_launch_privacy",
    "controlled_launch_dpa",
    "LEGAL_DOCUMENT_ROUTES",
    "\"/legal\"",
    "\"/legal/terms\"",
    "\"/legal/privacy\"",
    "\"/legal/dpa\"",
    "createLegalDocumentSurface",
    "listLegalDocumentSurfaces",
    "assertLegalDocumentSurfaceDoesNotMutateEngine",
    "buildPaymentNoCouplingProbe",
    "provider_call_performed: false",
    "engine_decision: false",
    "engine_visible: false",
    "engine_legality: \"not_mutated\"",
    "compile_output: \"not_mutated\"",
    "substitution_selection: \"not_mutated\"",
    "replay_record: \"not_mutated\"",
    "proof_record: \"not_mutated\"",
    "factual_history_record: \"not_mutated\"",
    "billing_state: \"not_read_not_written_not_inferred\"",
    "coach_athlete_relationship_truth: \"not_read_not_written_not_inferred\""
  ],
  [FILES.api]: [
    "handleV1LegalDocumentSurfacesApiRequest",
    "LEGAL_DOCUMENT_ROUTES",
    "createLegalDocumentSurface",
    "GET",
    "legal_document_surface_method_not_allowed"
  ],
  [FILES.test]: [
    "legal index route renders linked controlled-launch documents",
    "terms route renders without changing engine truth",
    "privacy route renders without billing or relationship truth dependency",
    "DPA route renders without data-request workflow activation",
    "API renders legal routes and rejects unknown routes",
    "route and document mismatch fails closed",
    "legal documents share the same deterministic probe hash without mutating engine surfaces",
    "legal copy remains factual and claim-neutral"
  ],
  [FILES.doc]: [
    "S-V1-L-01",
    "Terms",
    "Privacy",
    "DPA",
    "Legal index",
    "CI_V1_LEGAL_DOCUMENT_SURFACES",
    "Final public wording still requires formal review before live public launch."
  ],
  [FILES.copy]: [
    "legal_documents.title",
    "legal_documents.index",
    "legal_documents.terms",
    "legal_documents.privacy",
    "legal_documents.dpa",
    "legal_documents.no_engine_change",
    "legal_documents.review_notice"
  ],
  [FILES.paymentBoundary]: [
    "buildPaymentNoCouplingProbe"
  ],
  [FILES.packageJson]: [
    "node --test test/s_v1_l_01_legal_document_surfaces.test.mjs",
    "node ci/guards/s_v1_l_01_legal_document_surfaces_guard.mjs"
  ],
  [FILES.guardsIndex]: [
    "s_v1_l_01_legal_document_surfaces_guard.mjs"
  ],
  [FILES.failureTokenIndex]: [
    TOKEN
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

const FORBIDDEN_COPY_TERMS = Object.freeze([
  "medical",
  "diagnosis",
  "clinical",
  "treatment",
  "rehab",
  "rehabilitation",
  "injury prevention",
  "prevent injury",
  "safe",
  "safety",
  "suitable",
  "suitability",
  "guarantee",
  "guaranteed",
  "results guaranteed",
  "certified",
  "approved",
  "cleared",
  "readiness",
  "fatigue",
  "risk score",
  "recommended",
  "recommendation",
  "optimal",
  "better",
  "return to play",
  "return-to-play",
  "fit for duty"
]);

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

for (const file of [FILES.source, FILES.api]) {
  const text = read(file);
  for (const forbiddenImport of FORBIDDEN_SOURCE_IMPORTS) {
    assertNotIncludes(text, forbiddenImport, file);
  }
}

for (const file of [FILES.copy, FILES.source]) {
  const text = read(file).toLowerCase();
  for (const term of FORBIDDEN_COPY_TERMS) {
    assertNotIncludes(text, term, file);
  }
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
} else {
  console.log(JSON.stringify({
    ok: true,
    guard: "s_v1_l_01_legal_document_surfaces_guard",
    token: TOKEN,
    message: "Legal document surfaces passed."
  }, null, 2));
}