// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-P-03 seat entitlement guard.
 * Purpose: proves seat entitlement controls product access only during controlled launch.
 * Boundary: no engine import, no compile output, no substitution, no replay, no proof, no factual history mutation, and no expanded seat scope.
 * Determinism: reads committed repository files only and emits one stable failure token.
 * Failure: emits CI_V1_SEAT_ENTITLEMENT_GUARD when seat entitlement widens or deterministic surfaces become mutable.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GUARD = "S-V1-P-03";
const TOKEN = "CI_V1_SEAT_ENTITLEMENT_GUARD";

const FILES = Object.freeze({
  source: "src/v1SeatEntitlementGuard.mjs",
  api: "src/api/v1SeatEntitlementGuardApi.mjs",
  test: "test/s_v1_p_03_seat_entitlement_guard.test.mjs",
  guard: "ci/guards/s_v1_p_03_seat_entitlement_guard_guard.mjs",
  doc: "docs/v1/V1_SEAT_ENTITLEMENT_GUARD.md",
  copy: "copy/seat_entitlement_copy.json",
  checkout: "src/v1ControlledLaunchCheckout.mjs",
  paymentBoundary: "src/v1PaymentBoundaryContract.mjs",
  packageJson: "package.json",
  guardsIndex: "docs/GUARDS_INDEX.md",
  failureTokenIndex: "docs/dev/FAILURE_TOKEN_INDEX.md"
});

const REQUIRED_SNIPPETS = Object.freeze({
  [FILES.source]: [
    "S_V1_P_03_SEAT_ENTITLEMENT_GUARD_VERSION",
    "SEAT_ENTITLEMENT_ALLOWED_SCOPES",
    "controlled_launch_coach_seat",
    "controlled_launch_athlete_seat",
    "SEAT_ENTITLEMENT_ALLOWED_PRODUCT_SURFACES",
    "controlled_launch_coach_product_access",
    "controlled_launch_athlete_product_access",
    "SEAT_ENTITLEMENT_FORBIDDEN_SCOPES",
    "enterprise_seats",
    "organisation_seats",
    "team_seats",
    "multi_entity_seats",
    "marketplace_seats",
    "evaluateSeatEntitlement",
    "assertSeatEntitlementDoesNotMutateEngine",
    "controlled_launch_billing_access_record",
    "product_access_failure: true",
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
    "handleV1SeatEntitlementGuardApiRequest",
    "evaluateSeatEntitlement",
    "product access failure",
    "not an engine decision"
  ],
  [FILES.test]: [
    "allows product access when active billing access has seat capacity",
    "rejects product access when seat limit is exceeded",
    "rejects product access when billing access is not active",
    "rejects enterprise organisation and team seat scopes",
    "rejects actor mismatch as product access failure",
    "entitlement cannot alter deterministic probe or engine output markers",
    "API maps allow and reject verdicts without engine decision",
    "seat entitlement copy remains factual"
  ],
  [FILES.doc]: [
    "S-V1-P-03",
    "The guard returns product access allow or reject only.",
    "Access rejection is product-layer failure, not an engine decision.",
    "enterprise seats",
    "organisation seats",
    "team seats",
    "multi-entity seats",
    "CI_V1_SEAT_ENTITLEMENT_GUARD"
  ],
  [FILES.copy]: [
    "seat_entitlement.title",
    "seat_entitlement.allowed",
    "seat_entitlement.rejected",
    "seat_entitlement.limit_reached",
    "seat_entitlement.no_engine_change"
  ],
  [FILES.checkout]: [
    "controlled_launch_billing_access_record",
    "seat_limit",
    "billing_access_state",
    "billing_status"
  ],
  [FILES.paymentBoundary]: [
    "buildPaymentNoCouplingProbe"
  ],
  [FILES.packageJson]: [
    "node --test test/s_v1_p_03_seat_entitlement_guard.test.mjs",
    "node ci/guards/s_v1_p_03_seat_entitlement_guard_guard.mjs"
  ],
  [FILES.guardsIndex]: [
    "s_v1_p_03_seat_entitlement_guard_guard.mjs"
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
  "medical",
  "diagnosis",
  "rehab",
  "optimal",
  "cleared"
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
    guard: "s_v1_p_03_seat_entitlement_guard_guard",
    token: TOKEN,
    message: "Seat entitlement guard passed."
  }, null, 2));
}