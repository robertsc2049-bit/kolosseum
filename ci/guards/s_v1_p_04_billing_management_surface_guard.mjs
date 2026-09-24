// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-P-04 billing management surface guard.
 * Purpose: proves billing management creates factual billing views or provider portal request records only.
 * Boundary: no provider SDK, no engine import, no enterprise billing, no commercial account surfaces, no relationship mutation.
 * Determinism: reads committed repository files only and emits one stable failure token.
 * Failure: emits CI_V1_BILLING_MANAGEMENT_SURFACE when billing management scope widens.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GUARD = "S-V1-P-04";
const TOKEN = "CI_V1_BILLING_MANAGEMENT_SURFACE";

const FILES = Object.freeze({
  source: "src/v1BillingManagementSurface.mjs",
  api: "src/api/v1BillingManagementSurfaceApi.mjs",
  test: "test/s_v1_p_04_billing_management_surface.test.mjs",
  guard: "ci/guards/s_v1_p_04_billing_management_surface_guard.mjs",
  doc: "docs/v1/V1_BILLING_MANAGEMENT_SURFACE.md",
  copy: "copy/billing_management_copy.json",
  checkout: "src/v1ControlledLaunchCheckout.mjs",
  seat: "src/v1SeatEntitlementGuard.mjs",
  paymentBoundary: "src/v1PaymentBoundaryContract.mjs",
  packageJson: "package.json",
  guardsIndex: "docs/GUARDS_INDEX.md",
  failureTokenIndex: "docs/dev/FAILURE_TOKEN_INDEX.md"
});

const REQUIRED_SNIPPETS = Object.freeze({
  [FILES.source]: [
    "S_V1_P_04_BILLING_MANAGEMENT_SURFACE_VERSION",
    "BILLING_MANAGEMENT_PROVIDERS",
    "stripe_customer_portal",
    "equivalent_customer_portal",
    "BILLING_MANAGEMENT_SURFACES",
    "controlled_launch_billing_overview",
    "controlled_launch_customer_portal",
    "BILLING_MANAGEMENT_ACTIONS",
    "view_billing_overview",
    "open_customer_portal",
    "BILLING_MANAGEMENT_FORBIDDEN_SCOPES",
    "enterprise_billing",
    "commercial_account_surfaces",
    "multi_entity_billing",
    "revenue_share",
    "royalties",
    "RELATIONSHIP_TRUTH_KEYS",
    "coach_athlete_relationship_truth",
    "relationship_truth_mutation",
    "createBillingManagementSurface",
    "assertBillingManagementDoesNotMutateEngineOrRelationship",
    "provider_portal_session_request",
    "live_provider_call: \"not_performed_in_contract_slice\"",
    "provider_call_performed: false",
    "engine_decision: false",
    "engine_visible: false",
    "engine_legality: \"not_mutated\"",
    "compile_output: \"not_mutated\"",
    "substitution_selection: \"not_mutated\"",
    "replay_record: \"not_mutated\"",
    "proof_record: \"not_mutated\"",
    "factual_history_record: \"not_mutated\""
  ],
  [FILES.api]: [
    "handleV1BillingManagementSurfaceApiRequest",
    "createBillingManagementSurface",
    "transport only",
    "never become engine decisions"
  ],
  [FILES.test]: [
    "billing overview returns factual billing state only",
    "customer portal action creates provider portal request without live provider call",
    "API maps billing overview and portal request surfaces",
    "rejects enterprise billing commercial account and royalty scopes",
    "rejects coach-athlete relationship truth fields",
    "billing state cannot alter deterministic probe or engine output markers",
    "portal request requires completed provider session id",
    "billing management copy remains factual"
  ],
  [FILES.doc]: [
    "S-V1-P-04",
    "Billing state is separate from coach-athlete relationship truth.",
    "controlled-launch customer portal request shape",
    "enterprise billing",
    "commercial account surfaces",
    "multi-entity billing",
    "CI_V1_BILLING_MANAGEMENT_SURFACE"
  ],
  [FILES.copy]: [
    "billing_management.title",
    "billing_management.overview_created",
    "billing_management.portal_requested",
    "billing_management.action_required",
    "billing_management.no_engine_change",
    "billing_management.relationship_separate"
  ],
  [FILES.checkout]: [
    "controlled_launch_billing_access_record",
    "billing_access_state",
    "billing_status",
    "provider_session_id"
  ],
  [FILES.seat]: [
    "SEAT_ENTITLEMENT_REASON_CODES",
    "product_access_failure"
  ],
  [FILES.paymentBoundary]: [
    "buildPaymentNoCouplingProbe"
  ],
  [FILES.packageJson]: [
    "node --test test/s_v1_p_04_billing_management_surface.test.mjs",
    "node ci/guards/s_v1_p_04_billing_management_surface_guard.mjs"
  ],
  [FILES.guardsIndex]: [
    "s_v1_p_04_billing_management_surface_guard.mjs"
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
  "recommended",
  "recommendation",
  "readiness",
  "fatigue",
  "risk",
  "safe",
  "medical",
  "diagnosis",
  "rehab",
  "optimal",
  "better",
  "adherence",
  "cleared",
  "approved",
  "certified"
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

const copyText = read(FILES.copy).toLowerCase();
for (const term of FORBIDDEN_COPY_TERMS) {
  assertNotIncludes(copyText, term, FILES.copy);
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
    guard: "s_v1_p_04_billing_management_surface_guard",
    token: TOKEN,
    message: "Billing management surface passed."
  }, null, 2));
}