// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-L-04 cookie consent surface guard.
 * Purpose: proves the cookie/consent surface is legal/presentation state only.
 * Boundary: render and state-record model only; no engine import, no training
 * flow mutation, no declaration truth mutation, no provider call, and no
 * external script activation.
 * Determinism: reads committed files and required snippets only.
 * Failure: emits CI_V1_COOKIE_CONSENT_SURFACE when the surface widens scope.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GUARD = "S-V1-L-04";
const TOKEN = "CI_V1_COOKIE_CONSENT_SURFACE";

const FILES = Object.freeze({
  source: "src/v1CookieConsentSurface.mjs",
  api: "src/api/v1CookieConsentSurfaceApi.mjs",
  test: "test/s_v1_l_04_cookie_consent_surface.test.mjs",
  guard: "ci/guards/s_v1_l_04_cookie_consent_surface_guard.mjs",
  doc: "docs/v1/V1_COOKIE_CONSENT_SURFACE.md",
  copy: "copy/cookie_consent_surface_copy.json",
  packageJson: "package.json",
  guardsIndex: "docs/GUARDS_INDEX.md",
  failureTokenIndex: "docs/dev/FAILURE_TOKEN_INDEX.md"
});

const REQUIRED_SNIPPETS = Object.freeze({
  [FILES.source]: [
    "S_V1_L_04_COOKIE_CONSENT_SURFACE_VERSION",
    "COOKIE_CONSENT_SURFACE_ID",
    "COOKIE_CONSENT_BOUNDARY",
    "renderCookieConsentSurface",
    "createCookieConsentState",
    "assertCookieConsentDoesNotAlterEngine",
    "findBlockedCookieConsentPayloadKey",
    "legal_presentation_state_only: true",
    "consent_state_recorded: true",
    "engine_visible: false",
    "engine_truth_changed: false",
    "compile_output_changed: false",
    "training_flow_changed: false",
    "declaration_truth_changed: false",
    "phase1_declaration_changed: false",
    "external_script_activation: false",
    "provider_call_performed: false"
  ],
  [FILES.api]: [
    "handleCookieConsentSurfaceApiRequest",
    "renderCookieConsentSurface",
    "createCookieConsentState",
    "GET",
    "POST",
    "engine_truth_changed: false",
    "training_flow_changed: false",
    "declaration_truth_changed: false"
  ],
  [FILES.test]: [
    "consent render test returns controlled-launch cookie view model",
    "consent state test records necessary-only state without changing engine output",
    "consent state test records preference storage only when explicitly selected",
    "no-coupling test blocks engine training and declaration mutation fields",
    "API renders and records cookie consent state",
    "factual copy stays neutral",
    "boundary object is explicit and closed to engine training and declaration truth"
  ],
  [FILES.doc]: [
    "S-V1-L-04",
    "Cookie consent is presentation/legal state only.",
    "It cannot alter engine output.",
    "Copy is factual.",
    "CI_V1_COOKIE_CONSENT_SURFACE"
  ],
  [FILES.copy]: [
    "cookie_consent.title",
    "cookie_consent.notice",
    "cookie_consent.necessary_only",
    "cookie_consent.preferences",
    "cookie_consent.no_engine_change",
    "cookie_consent.saved"
  ],
  [FILES.packageJson]: [
    "test/s_v1_l_04_cookie_consent_surface.test.mjs",
    "ci/guards/s_v1_l_04_cookie_consent_surface_guard.mjs"
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
  "engine_visible: true",
  "engine_truth_changed: true",
  "compile_output_changed: true",
  "training_flow_changed: true",
  "declaration_truth_changed: true",
  "phase1_declaration_changed: true",
  "external_script_activation: true",
  "provider_call_performed: true",
  "compile(",
  "runEngine",
  "createPhase1DeclarationRecord",
  "assertPhase1DeclarationCompileGate"
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

  for (const blocked of FORBIDDEN_ACTIVATION_SNIPPETS) {
    assertNotIncludes(text, blocked, file);
  }
}

const copyText = read(FILES.copy).toLowerCase();
for (const term of FORBIDDEN_COPY_TERMS) {
  if (copyText.includes(term)) {
    fail("S-V1-L-04 copy contains blocked claim term.", { term });
  }
}

const source = read(FILES.source);
if (!source.includes("legal_presentation_state_only: true") ||
    !source.includes("engine_truth_changed: false") ||
    !source.includes("training_flow_changed: false") ||
    !source.includes("declaration_truth_changed: false") ||
    !source.includes("phase1_declaration_changed: false")) {
  fail("S-V1-L-04 source must keep explicit presentation/legal and no-coupling flags.");
}

const testText = read(FILES.test);
if (!testText.includes("assert.equal(result.engine_truth_changed, false)") ||
    !testText.includes("assert.equal(result.training_flow_changed, false)") ||
    !testText.includes("assert.equal(result.declaration_truth_changed, false)") ||
    !testText.includes("assert.equal(result.phase1_declaration_changed, false)")) {
  fail("S-V1-L-04 tests must assert engine, training, and declaration state are unchanged.");
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
    guard: "s_v1_l_04_cookie_consent_surface_guard",
    token: TOKEN,
    message: "Cookie consent surface passed."
  }, null, 2));
}