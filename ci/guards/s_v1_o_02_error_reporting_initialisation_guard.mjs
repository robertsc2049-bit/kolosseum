// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-O-02 error-reporting initialisation guard.
 * Purpose: proves the slice adds only local factual error-reporting setup.
 * Boundary: configuration and sanitised event envelope only; no provider SDK,
 * no network transport, no engine import, no engine output mutation, and no
 * sensitive payload storage.
 * Determinism: reads committed files and required snippets only.
 * Failure: emits CI_V1_ERROR_REPORTING_INITIALISATION when scope widens.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GUARD = "S-V1-O-02";
const TOKEN = "CI_V1_ERROR_REPORTING_INITIALISATION";

const FILES = Object.freeze({
  source: "src/v1ErrorReportingInitialisation.mjs",
  test: "test/s_v1_o_02_error_reporting_initialisation.test.mjs",
  guard: "ci/guards/s_v1_o_02_error_reporting_initialisation_guard.mjs",
  doc: "docs/v1/V1_ERROR_REPORTING_INITIALISATION.md",
  packageJson: "package.json",
  guardsIndex: "docs/GUARDS_INDEX.md",
  failureTokenIndex: "docs/dev/FAILURE_TOKEN_INDEX.md"
});

const REQUIRED_SNIPPETS = Object.freeze({
  [FILES.source]: [
    "S_V1_O_02_ERROR_REPORTING_INITIALISATION_VERSION",
    "ERROR_REPORTING_SURFACE_ID",
    "ERROR_REPORTING_BOUNDARY",
    "initialiseErrorReporting",
    "createErrorReportEvent",
    "assertErrorReportingDoesNotMutateEngine",
    "findBlockedErrorReportingPayloadKey",
    "redactSensitiveFields",
    "observes_product_runtime_errors_only: true",
    "external_provider_enabled: false",
    "network_transport_enabled: false",
    "provider_call_performed: false",
    "error_report_sent: false",
    "raw_stack_storage_enabled: false",
    "raw_request_body_storage_enabled: false",
    "sensitive_payload_storage_enabled: false",
    "engine_visible: false",
    "engine_truth_changed: false",
    "engine_output_mutated: false",
    "compile_output_changed: false",
    "training_flow_changed: false",
    "declaration_truth_changed: false",
    "phase1_declaration_changed: false",
    "user_facing_claim_language_changed: false"
  ],
  [FILES.test]: [
    "config test initialises local factual error reporting only",
    "event test records sanitised product runtime error envelope only",
    "no-coupling test rejects engine output training flow and declaration payloads",
    "config validation rejects provider and out-of-range sampling",
    "event validation accepts only declared product runtime event classes",
    "docs document sensitive data boundary and no mutation boundary",
    "boundary object is explicit and closed to provider calls and engine mutation"
  ],
  [FILES.doc]: [
    "S-V1-O-02",
    "Error reporting observes product/runtime errors only.",
    "No engine output mutation.",
    "Sensitive data boundaries are documented.",
    "CI_V1_ERROR_REPORTING_INITIALISATION"
  ],
  [FILES.packageJson]: [
    "test/s_v1_o_02_error_reporting_initialisation.test.mjs",
    "ci/guards/s_v1_o_02_error_reporting_initialisation_guard.mjs"
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
  "from \"@sentry",
  "from '@sentry",
  "from \"rollbar\"",
  "from 'rollbar'",
  "from \"bugsnag\"",
  "from 'bugsnag'",
  "from \"datadog",
  "from 'datadog",
  "from \"newrelic\"",
  "from 'newrelic'",
  "from \"@opentelemetry",
  "from '@opentelemetry"
]);

const FORBIDDEN_SOURCE_SNIPPETS = Object.freeze([
  "captureException",
  "captureMessage",
  "Sentry.",
  "Rollbar.",
  "Bugsnag.",
  "fetch(",
  "XMLHttpRequest",
  "http.request",
  "https.request",
  "external_provider_enabled: true",
  "network_transport_enabled: true",
  "provider_call_performed: true",
  "error_report_sent: true",
  "raw_stack_storage_enabled: true",
  "raw_request_body_storage_enabled: true",
  "sensitive_payload_storage_enabled: true",
  "engine_visible: true",
  "engine_truth_changed: true",
  "engine_output_mutated: true",
  "compile_output_changed: true",
  "training_flow_changed: true",
  "declaration_truth_changed: true",
  "phase1_declaration_changed: true",
  "user_facing_claim_language_changed: true",
  "compile(",
  "runEngine",
  "createPhase1DeclarationRecord",
  "assertPhase1DeclarationCompileGate"
]);

const FORBIDDEN_PACKAGE_TERMS = Object.freeze([
  "@sentry",
  "rollbar",
  "bugsnag",
  "newrelic",
  "@opentelemetry"
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

const sourceText = read(FILES.source);
for (const forbiddenImport of FORBIDDEN_SOURCE_IMPORTS) {
  assertNotIncludes(sourceText, forbiddenImport, FILES.source);
}

for (const blocked of FORBIDDEN_SOURCE_SNIPPETS) {
  assertNotIncludes(sourceText, blocked, FILES.source);
}

const packageText = read(FILES.packageJson).toLowerCase();
for (const term of FORBIDDEN_PACKAGE_TERMS) {
  if (packageText.includes(term)) {
    fail("S-V1-O-02 must not add provider dependency in package.json.", { term });
  }
}

const testText = read(FILES.test);
if (!testText.includes("assert.equal(result.engine_output_mutated, false)") ||
    !testText.includes("assert.equal(result.training_flow_changed, false)") ||
    !testText.includes("assert.equal(result.declaration_truth_changed, false)") ||
    !testText.includes("assert.equal(result.sensitive_payload_storage_enabled, false)") ||
    !testText.includes("assert.equal(result.provider_call_performed, false)")) {
  fail("S-V1-O-02 tests must assert no engine mutation, no sensitive payload storage, and no provider call.");
}

const docText = read(FILES.doc);
if (docText.includes("provider SDK is configured") ||
    docText.includes("external provider is enabled") ||
    docText.includes("error reports are sent")) {
  fail("S-V1-O-02 docs must not claim provider activation.");
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
    guard: "s_v1_o_02_error_reporting_initialisation_guard",
    token: TOKEN,
    message: "Error reporting initialisation passed."
  }, null, 2));
}