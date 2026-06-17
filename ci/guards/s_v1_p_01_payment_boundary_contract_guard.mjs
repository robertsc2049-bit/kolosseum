// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-P-01 payment boundary guard.
 * Purpose: proves controlled-launch commercial access state remains a product-layer boundary only.
 * Boundary: checks contract, docs, copy, package wiring, no engine imports, and generated index wiring.
 * Determinism: reads committed repository files only and emits one stable failure token.
 * Failure: emits CI_V1_PAYMENT_BOUNDARY_CONTRACT when payment scope widens or deterministic surfaces become mutable.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GUARD = "S-V1-P-01";
const TOKEN = "CI_V1_PAYMENT_BOUNDARY_CONTRACT";

const FILES = Object.freeze({
  source: "src/v1PaymentBoundaryContract.mjs",
  test: "test/s_v1_p_01_payment_boundary_contract.test.mjs",
  guard: "ci/guards/s_v1_p_01_payment_boundary_contract_guard.mjs",
  doc: "docs/v1/V1_PAYMENT_BOUNDARY_CONTRACT.md",
  copy: "copy/payment_boundary_copy.json",
  v1BoundaryGuards: "shared/v1-boundary/v1BoundaryGuards.mjs",
  packageJson: "package.json",
  guardsIndex: "docs/GUARDS_INDEX.md",
  failureTokenIndex: "docs/dev/FAILURE_TOKEN_INDEX.md",
  checksums: "docs/checksums.sha256"
});

const REQUIRED_SNIPPETS = Object.freeze({
  [FILES.source]: [
    "S_V1_P_01_PAYMENT_BOUNDARY_CONTRACT_VERSION",
    "PAYMENT_BOUNDARY_ALLOWED_CONTROLS",
    "PAYMENT_BOUNDARY_FORBIDDEN_EFFECTS",
    "access_state",
    "plan_visibility",
    "seat_limit",
    "billing_surface_visibility",
    "engine_legality",
    "compile_output",
    "substitution_selection",
    "replay_record",
    "proof_record",
    "factual_history_record",
    "mid_session_engine_access_rewrite",
    "enterprise_billing",
    "multi_entity_billing",
    "buildPaymentNoCouplingProbe",
    "createV1PaymentBoundary",
    "assertV1PaymentBoundary",
    "MID_SESSION_AUTOMATION_NOT_PERMITTED"
  ],
  [FILES.test]: [
    "exposes a closed commercial access boundary",
    "records access control without changing deterministic surfaces",
    "commercial access changes do not alter deterministic probe output",
    "refuses deterministic effect requests",
    "refuses automated mid-session upsell control",
    "payment copy remains neutral"
  ],
  [FILES.doc]: [
    "S-V1-P-01",
    "Payment state is commercial-access state only.",
    "The deterministic engine boundary remains outside this contract.",
    "Allowed controls",
    "Not included",
    "automated upsell control",
    "CI_V1_PAYMENT_BOUNDARY_CONTRACT"
  ],
  [FILES.copy]: [
    "payment_boundary.access_active",
    "payment_boundary.access_required",
    "payment_boundary.plan_visibility",
    "payment_boundary.seat_limit",
    "payment_boundary.neutral_notice"
  ],
  [FILES.v1BoundaryGuards]: [
    "assertNoBillingStateInEngineInput",
    "payment_state",
    "paymentState",
    "subscription_state"
  ],
  [FILES.packageJson]: [
    "node --test test/s_v1_p_01_payment_boundary_contract.test.mjs",
    "node ci/guards/s_v1_p_01_payment_boundary_contract_guard.mjs"
  ],
  [FILES.guardsIndex]: [
    "s_v1_p_01_payment_boundary_contract_guard.mjs"
  ],
  [FILES.failureTokenIndex]: [
    TOKEN
  ],
  [FILES.checksums]: []
});

const FORBIDDEN_SOURCE_IMPORTS = Object.freeze([
  "@kolosseum/engine",
  "from \"../engine",
  "from \"./engine",
  "from \"../../engine",
  "engine/src/"
]);

const FORBIDDEN_COPY_TERMS = Object.freeze([
  "recommended",
  "recommendation",
  "readiness",
  "fatigue",
  "medical",
  "diagnosis",
  "rehab",
  "optimal"
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

const source = read(FILES.source);
for (const forbiddenImport of FORBIDDEN_SOURCE_IMPORTS) {
  assertNotIncludes(source, forbiddenImport, FILES.source);
}

const copyText = read(FILES.copy).toLowerCase();
for (const term of FORBIDDEN_COPY_TERMS) {
  assertNotIncludes(copyText, term, FILES.copy);
}

const guardText = read(FILES.guard);
assertIncludes(guardText, `const TOKEN = "${TOKEN}";`, FILES.guard);
assertIncludes(guardText, "DEV NOTE:", FILES.guard);

const docText = read(FILES.doc);
for (const forbidden of [
  "Stripe Checkout implementation",
  "enterprise billing implementation",
  "multi-entity billing implementation",
  "marketplace billing implementation"
]) {
  assertNotIncludes(docText, forbidden, FILES.doc);
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
    guard: "s_v1_p_01_payment_boundary_contract_guard",
    token: TOKEN,
    message: "Payment boundary contract passed."
  }, null, 2));
}