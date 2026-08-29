// DEV NOTE: the commercial/billing panel moved to React (CommercialPanel.tsx
// + useCommercialAccount.ts, mounted at #account-commercial-root;
// commercial_ui.js is retired) - see
// public/app-src/__tests__/CommercialPanel.test.tsx for its behavioral
// proof. Backend routes, service and schema are untouched and still
// asserted directly below.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) =>
  fs.readFileSync(path, "utf8");

const html = read("public/app/index.html");
const css = read("public/app/styles.css");
const accountUi =
  read("public/app/account_ui.js");
const service =
  read("src/api/product_commercial_service.ts");
const routes =
  read("src/api/product_commercial.routes.ts");
const server = read("src/server.ts");
const schema = read("schema.sql");
const client = read("public/app-src/api/commercialClient.ts");
const hook = read("public/app-src/screens/account/useCommercialAccount.ts");
const panel = read("public/app-src/screens/account/CommercialPanel.tsx");
const reactAccountClient = read("public/app-src/api/client.ts");
const entryAuthClient = read("public/app-src/api/authClient.ts");

test("FULL-UI-08 mounts authenticated commercial account routes", () => {
  assert.match(
    server,
    /productCommercialRouter/u
  );
  assert.match(
    server,
    /app\.use\("\/account\/commercial", productCommercialRouter\);/u
  );

  for (const route of [
    'productCommercialRouter.get(\n  "/"',
    'productCommercialRouter.post(\n  "/checkout"',
    'productCommercialRouter.post(\n  "/payment-return"',
    'productCommercialRouter.post(\n  "/portal"'
  ]) {
    assert.ok(
      routes.includes(route),
      `Missing route ${route}`
    );
  }

  assert.match(
    routes,
    /PRODUCT_SESSION_COOKIE/u
  );
  assert.match(
    routes,
    /assertProductCsrf/u
  );
  assert.match(
    routes,
    /resolveProductSession/u
  );
});

test("FULL-UI-08 persists immutable commercial records", () => {
  assert.match(
    schema,
    /CREATE TABLE IF NOT EXISTS product_commercial_records/u
  );
  assert.match(
    schema,
    /UNIQUE \(user_id, request_id\)/u
  );

  for (const type of [
    "commercial_checkout_requested",
    "commercial_payment_return_recorded",
    "commercial_billing_access_updated",
    "commercial_portal_requested"
  ]) {
    assert.ok(schema.includes(type));
  }

  assert.match(
    service,
    /ON CONFLICT \(user_id, request_id\)\s+DO NOTHING/u
  );
  assert.match(
    service,
    /record_sha256/u
  );
});

test("FULL-UI-08 displays factual subscription and seat state", () => {
  assert.match(html, /id="account-commercial-root"/u);
  assert.doesNotMatch(html, /commercial_ui\.js/u);

  for (const needle of [
    "commercial.subscription_state",
    "commercial.product_access_state",
    "commercial.billing_status",
    "commercial.plan_id",
    "commercial.seat_limit",
    "commercial.occupied_seat_count",
    "commercial.available_seat_count"
  ]) {
    assert.ok(panel.includes(needle), `Expected panel to render ${needle}`);
  }

  assert.match(panel, /id="accountCommercialPanel"/u);
  assert.match(panel, /No live provider SDK call is performed by this product slice/u);
  assert.match(css, /\.commercial-fact-grid/u);
  assert.match(css, /min-height: 44px/u);
});

test("FULL-UI-08 uses persisted account APIs rather than browser-only state", () => {
  for (const path of [
    "/account/commercial",
    "/account/commercial/checkout",
    "/account/commercial/payment-return",
    "/account/commercial/portal"
  ]) {
    assert.ok(
      client.includes(path),
      `Missing account API ${path}`
    );
  }

  assert.doesNotMatch(
    hook,
    /localStorage|sessionStorage/u
  );
  assert.match(
    client,
    /export function loadCommercialAccount/u
  );
  assert.match(
    client,
    /export function requestCommercialCheckout/u
  );
  assert.match(
    client,
    /export function recordCommercialPaymentReturn/u
  );
  assert.match(
    client,
    /export function requestCommercialBillingPortal/u
  );
});

test("FULL-UI-08 checkout remains controlled-launch and provider-inert", () => {
  assert.match(
    service,
    /controlled_launch_checkout_requested/u
  );
  // NOTE: this specific service-side assertion is currently failing on
  // main independent of this migration (the service now performs a real
  // Stripe checkout.sessions.create() call, contradicting this string) -
  // flagged separately, left as-is here since it is a backend-only concern
  // this frontend migration does not touch.
  assert.match(
    service,
    /live_provider_call:\s*"not_performed_in_product_slice"/u
  );
  assert.match(
    service,
    /provider_call_performed:\s*false/u
  );
  assert.match(
    service,
    /trusted_provider_confirmation:\s*false/u
  );
  assert.match(
    hook,
    /No live provider call was performed/u
  );
});

test("FULL-UI-08 exposes factual entitlement failure and portal gating", () => {
  for (const code of [
    "commercial_configuration_missing",
    "commercial_checkout_pending",
    "commercial_provider_confirmation_pending",
    "commercial_portal_unavailable"
  ]) {
    assert.ok(
      `${service}\n${hook}`.includes(code),
      `Missing factual state ${code}`
    );
  }

  assert.match(
    service,
    /billing_access_state[\s\S]*access_active/u
  );
  assert.match(
    service,
    /billing_status[\s\S]*payment_confirmed/u
  );
  assert.match(
    service,
    /provider_session_present/u
  );
});

test("FULL-UI-08 commercial state cannot alter engine or relationship truth", () => {
  assert.doesNotMatch(
    service,
    /from\s+["'][^"']*engine[^"']*["']/u
  );
  assert.doesNotMatch(
    routes,
    /from\s+["'][^"']*engine[^"']*["']/u
  );

  for (const marker of [
    'calls_engine: false',
    'engine_visible: false',
    'engine_decision: false',
    'engine_legality: "not_mutated"',
    'compile_output: "not_mutated"',
    'substitution_selection: "not_mutated"',
    'replay_record: "not_mutated"',
    'proof_record: "not_mutated"',
    'factual_history_record: "not_mutated"',
    '"not_read_not_written_not_inferred"',
    '"not_performed"'
  ]) {
    assert.ok(
      service.includes(marker),
      `Missing isolation marker ${marker}`
    );
  }
});

test("FULL-UI-08 keeps commercial scope individual and controlled", () => {
  assert.match(
    service,
    /controlled_launch_coach/u
  );
  assert.match(
    service,
    /commercial_coach_account_required/u
  );
  assert.doesNotMatch(
    `${hook}\n${panel}`,
    /organisation|organization|team|gym|unit|federation|enterprise/iu
  );
});

test("FULL-UI-08 preserves existing account controls", () => {
  // DEV NOTE: this test used to check `accountUi.includes(token)` for all
  // seven of these - a plain substring check that kept passing for the
  // WRONG reason once each function moved to React and account_ui.js's own
  // DEV NOTE comments started mentioning them by name (found via a post-
  // migration audit sweep: every one of these tokens' only remaining
  // occurrence in account_ui.js was inside a comment, not a real
  // definition). Now checks each function's actual current location.
  for (const token of ["restoreAccountSession", "loadAccountDetail"]) {
    assert.match(
      accountUi,
      new RegExp(`export function ${token}\\b`, "u"),
      `Existing account control missing: ${token}`
    );
  }

  for (const token of ["registerAccount", "signInAccount", "requestPasswordReset"]) {
    assert.match(
      entryAuthClient,
      new RegExp(`export function ${token}\\b`, "u"),
      `Existing account control missing: ${token}`
    );
  }

  for (const token of ["updateAccountProfile", "changeAccountPassword", "requestEmailVerification", "requestAccountClosure"]) {
    assert.match(
      reactAccountClient,
      new RegExp(`export function ${token}\\b`, "u"),
      `Existing account control missing: ${token}`
    );
  }
});

test("FULL-UI-08 direct payment contracts remain present", () => {
  for (const path of [
    "src/v1PaymentBoundaryContract.mjs",
    "src/v1ControlledLaunchCheckout.mjs",
    "src/v1SeatEntitlementGuard.mjs",
    "src/v1BillingManagementSurface.mjs",
    "test/s_v1_p_01_payment_boundary_contract.test.mjs",
    "test/s_v1_p_02_stripe_checkout_controlled_launch.test.mjs",
    "test/s_v1_p_03_seat_entitlement_guard.test.mjs",
    "test/s_v1_p_04_billing_management_surface.test.mjs"
  ]) {
    assert.equal(
      fs.existsSync(path),
      true,
      `Missing governed commercial contract: ${path}`
    );
  }
});
