// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-P-02 controlled-launch checkout guard.
 * Purpose: proves checkout and webhook surfaces create or update billing/access records only.
 * Boundary: no live SDK dependency, no engine import, no enterprise procurement, no multi-entity billing, no revenue share, no royalties.
 * Determinism: reads committed repository files only and emits one stable failure token.
 * Failure: emits CI_V1_STRIPE_CHECKOUT_CONTROLLED_LAUNCH when payment entry scope widens or deterministic surfaces become mutable.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GUARD = "S-V1-P-02";
const TOKEN = "CI_V1_STRIPE_CHECKOUT_CONTROLLED_LAUNCH";

const FILES = Object.freeze({
  source: "src/v1ControlledLaunchCheckout.mjs",
  checkoutApi: "src/api/v1ControlledLaunchCheckoutApi.mjs",
  webhookApi: "src/api/v1ControlledLaunchWebhookHandler.mjs",
  test: "test/s_v1_p_02_stripe_checkout_controlled_launch.test.mjs",
  guard: "ci/guards/s_v1_p_02_stripe_checkout_controlled_launch_guard.mjs",
  doc: "docs/v1/V1_STRIPE_CHECKOUT_CONTROLLED_LAUNCH.md",
  copy: "copy/controlled_launch_checkout_copy.json",
  paymentBoundary: "src/v1PaymentBoundaryContract.mjs",
  packageJson: "package.json",
  guardsIndex: "docs/GUARDS_INDEX.md",
  failureTokenIndex: "docs/dev/FAILURE_TOKEN_INDEX.md"
});

const REQUIRED_SNIPPETS = Object.freeze({
  [FILES.source]: [
    "S_V1_P_02_STRIPE_CHECKOUT_CONTROLLED_LAUNCH_VERSION",
    "CONTROLLED_LAUNCH_CHECKOUT_PROVIDERS",
    "stripe_checkout",
    "equivalent_checkout",
    "createControlledLaunchCheckoutSession",
    "handleControlledLaunchCheckoutWebhook",
    "assertControlledLaunchCheckoutNoEngineMutation",
    "controlled_launch_billing_access_record",
    "provider_session_request",
    "live_provider_call: \"not_performed_in_contract_slice\"",
    "checkout.session.completed",
    "checkout.session.expired",
    "payment_intent.payment_failed",
    "enterprise_procurement",
    "enterprise_billing",
    "multi_entity_billing",
    "revenue_share",
    "royalties",
    "engine_legality: \"not_mutated\"",
    "compile_output: \"not_mutated\"",
    "substitution_selection: \"not_mutated\"",
    "replay_record: \"not_mutated\"",
    "proof_record: \"not_mutated\"",
    "factual_history_record: \"not_mutated\""
  ],
  [FILES.checkoutApi]: [
    "handleV1ControlledLaunchCheckoutApiRequest",
    "createControlledLaunchCheckoutSession",
    "transport only",
    "no live provider call"
  ],
  [FILES.webhookApi]: [
    "handleV1ControlledLaunchWebhookRequest",
    "handleControlledLaunchCheckoutWebhook",
    "updates commercial access records only"
  ],
  [FILES.test]: [
    "checkout path creates billing and access record only",
    "checkout API maps contract output without live provider side effects",
    "webhook completion updates billing access record only",
    "payment cannot mutate deterministic probe or engine surfaces",
    "refuses enterprise procurement multi-entity revenue share and royalties",
    "checkout copy remains factual"
  ],
  [FILES.doc]: [
    "S-V1-P-02",
    "The checkout path creates a billing/access record only.",
    "Webhook handling records provider event state against the billing/access record only.",
    "live Stripe SDK dependency",
    "enterprise procurement",
    "multi-entity billing",
    "revenue share",
    "royalties",
    "CI_V1_STRIPE_CHECKOUT_CONTROLLED_LAUNCH"
  ],
  [FILES.copy]: [
    "controlled_launch_checkout.title",
    "controlled_launch_checkout.created",
    "controlled_launch_checkout.redirect_required",
    "controlled_launch_checkout.webhook_recorded",
    "controlled_launch_checkout.no_engine_change"
  ],
  [FILES.paymentBoundary]: [
    "createV1PaymentBoundary",
    "buildPaymentNoCouplingProbe",
    "assertV1PaymentBoundary"
  ],
  [FILES.packageJson]: [
    "node --test test/s_v1_p_02_stripe_checkout_controlled_launch.test.mjs",
    "node ci/guards/s_v1_p_02_stripe_checkout_controlled_launch_guard.mjs"
  ],
  [FILES.guardsIndex]: [
    "s_v1_p_02_stripe_checkout_controlled_launch_guard.mjs"
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

const checkoutApi = read(FILES.checkoutApi);
const webhookApi = read(FILES.webhookApi);
for (const apiText of [checkoutApi, webhookApi]) {
  for (const forbiddenImport of FORBIDDEN_SOURCE_IMPORTS) {
    if (apiText.includes(forbiddenImport)) {
      fail("API adapters must not import engine or live Stripe SDK", { forbiddenImport });
    }
  }
}

const copyText = read(FILES.copy).toLowerCase();
for (const term of FORBIDDEN_COPY_TERMS) {
  assertNotIncludes(copyText, term, FILES.copy);
}

const packageJson = JSON.parse(read(FILES.packageJson));
if (packageJson.dependencies?.stripe || packageJson.devDependencies?.stripe) {
  fail("S-V1-P-02 must not add live stripe dependency in this contract slice.");
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
    guard: "s_v1_p_02_stripe_checkout_controlled_launch_guard",
    token: TOKEN,
    message: "Controlled-launch checkout contract passed."
  }, null, 2));
}