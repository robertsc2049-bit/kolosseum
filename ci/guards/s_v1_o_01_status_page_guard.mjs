// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-O-01 public status page guard.
 * Purpose: proves the status page reports service-state facts only.
 * Boundary: public status view model and API adapter only; no engine import,
 * no engine mutation, no user safety/readiness/training-effect claims, no
 * provider call, and no external monitoring call.
 * Determinism: reads committed files and required snippets only.
 * Failure: emits CI_V1_STATUS_PAGE when the surface widens scope.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GUARD = "S-V1-O-01";
const TOKEN = "CI_V1_STATUS_PAGE";

const FILES = Object.freeze({
  source: "src/v1StatusPage.mjs",
  api: "src/api/v1StatusPageApi.mjs",
  test: "test/s_v1_o_01_status_page.test.mjs",
  guard: "ci/guards/s_v1_o_01_status_page_guard.mjs",
  doc: "docs/v1/V1_STATUS_PAGE.md",
  copy: "copy/status_page_copy.json",
  packageJson: "package.json",
  guardsIndex: "docs/GUARDS_INDEX.md",
  failureTokenIndex: "docs/dev/FAILURE_TOKEN_INDEX.md"
});

const REQUIRED_SNIPPETS = Object.freeze({
  [FILES.source]: [
    "S_V1_O_01_STATUS_PAGE_VERSION",
    "STATUS_PAGE_SURFACE_ID",
    "STATUS_PAGE_ROUTE",
    "STATUS_PAGE_BOUNDARY",
    "renderStatusPage",
    "assertStatusPageDoesNotAlterEngine",
    "findBlockedStatusPagePayloadKey",
    "service_state_only: true",
    "uptime_indicator: true",
    "engine_visible: false",
    "engine_truth_changed: false",
    "compile_output_changed: false",
    "training_flow_changed: false",
    "declaration_truth_changed: false",
    "user_safety_claim: false",
    "user_readiness_claim: false",
    "training_effectiveness_claim: false",
    "service_readiness_claim: false",
    "service_reliability_guarantee: false",
    "provider_call_performed: false",
    "external_monitoring_call_performed: false"
  ],
  [FILES.api]: [
    "handleStatusPageApiRequest",
    "renderStatusPage",
    "GET",
    "status_page_method_not_allowed",
    "engine_truth_changed: false",
    "training_flow_changed: false",
    "declaration_truth_changed: false"
  ],
  [FILES.test]: [
    "status render test returns factual public status view model",
    "uptime indicator reports component counts and incidents only",
    "status page rejects route and state outside declared status boundary",
    "no-coupling test blocks engine training and declaration mutation fields",
    "copy lint blocks safety readiness and training-effect claims in input text",
    "API renders status route and rejects non-GET methods",
    "public copy stays factual",
    "boundary object is explicit and closed to claims and engine mutation"
  ],
  [FILES.doc]: [
    "S-V1-O-01",
    "Status page reports service state only.",
    "No claims about user safety, readiness, or training effectiveness.",
    "No engine mutation.",
    "CI_V1_STATUS_PAGE"
  ],
  [FILES.copy]: [
    "status_page.title",
    "status_page.notice",
    "status_page.service_state",
    "status_page.uptime_indicator",
    "status_page.incidents",
    "status_page.no_engine_change"
  ],
  [FILES.packageJson]: [
    "test/s_v1_o_01_status_page.test.mjs",
    "ci/guards/s_v1_o_01_status_page_guard.mjs"
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
  "user_safety_claim: true",
  "user_readiness_claim: true",
  "training_effectiveness_claim: true",
  "service_readiness_claim: true",
  "service_reliability_guarantee: true",
  "provider_call_performed: true",
  "external_monitoring_call_performed: true",
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
  "readiness",
  "safe",
  "safety",
  "effective",
  "effectiveness",
  "suitable",
  "approved",
  "cleared",
  "guarantee",
  "guaranteed",
  "reliable",
  "certified",
  "risk score",
  "fit for duty",
  "return to play"
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
    fail("S-V1-O-01 copy contains blocked claim term.", { term });
  }
}

const source = read(FILES.source);
if (!source.includes("service_state_only: true") ||
    !source.includes("uptime_indicator: true") ||
    !source.includes("engine_truth_changed: false") ||
    !source.includes("training_flow_changed: false") ||
    !source.includes("declaration_truth_changed: false") ||
    !source.includes("user_safety_claim: false") ||
    !source.includes("user_readiness_claim: false") ||
    !source.includes("training_effectiveness_claim: false")) {
  fail("S-V1-O-01 source must keep explicit service-state and no-claim boundary flags.");
}

const testText = read(FILES.test);
if (!testText.includes("assert.equal(result.service_state_only, true)") ||
    !testText.includes("assert.equal(result.engine_truth_changed, false)") ||
    !testText.includes("assert.equal(result.training_flow_changed, false)") ||
    !testText.includes("assert.equal(result.declaration_truth_changed, false)") ||
    !testText.includes("assert.equal(result.user_safety_claim, false)") ||
    !testText.includes("assert.equal(result.training_effectiveness_claim, false)")) {
  fail("S-V1-O-01 tests must assert service-state-only and no engine/claim mutation.");
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
    guard: "s_v1_o_01_status_page_guard",
    token: TOKEN,
    message: "Status page passed."
  }, null, 2));
}