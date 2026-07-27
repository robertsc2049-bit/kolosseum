import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) =>
  fs.readFileSync(path, "utf8");

const html = read("public/app/index.html");
const css = read("public/app/styles.css");
const accountUi =
  read("public/app/account_ui.js");
const commercialUi =
  read("public/app/commercial_ui.js");
const service =
  read("src/api/product_commercial_service.ts");
const routes =
  read("src/api/product_commercial.routes.ts");
const server = read("src/server.ts");
const schema = read("schema.sql");

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
  for (const id of [
    "accountCommercialPanel",
    "commercialSubscriptionState",
    "commercialAccessState",
    "commercialBillingStatus",
    "commercialPlan",
    "commercialSeatAllowance",
    "commercialSeatUsage",
    "commercialSeatAvailable",
    "commercialCheckoutButton",
    "commercialPortalButton",
    "commercialEntitlementError",
    "commercialHistory"
  ]) {
    assert.match(
      html,
      new RegExp(`id="${id}"`, "u")
    );
  }

  assert.match(
    html,
    /No live provider SDK call is performed/u
  );
  assert.match(
    html,
    /commercial_ui\.js/u
  );
  assert.match(
    css,
    /\.commercial-fact-grid/u
  );
  assert.match(
    css,
    /min-height: 44px/u
  );
});

test("FULL-UI-08 uses persisted account APIs rather than browser-only state", () => {
  for (const path of [
    "/account/commercial",
    "/account/commercial/checkout",
    "/account/commercial/payment-return",
    "/account/commercial/portal"
  ]) {
    assert.ok(
      accountUi.includes(path),
      `Missing account API ${path}`
    );
  }

  assert.doesNotMatch(
    commercialUi,
    /localStorage|sessionStorage/u
  );
  assert.match(
    commercialUi,
    /loadCommercialAccount/u
  );
  assert.match(
    commercialUi,
    /requestCommercialCheckout/u
  );
  assert.match(
    commercialUi,
    /recordCommercialPaymentReturn/u
  );
  assert.match(
    commercialUi,
    /requestCommercialBillingPortal/u
  );
});

test("FULL-UI-08 checkout remains controlled-launch and provider-inert", () => {
  assert.match(
    service,
    /controlled_launch_checkout_requested/u
  );
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
    commercialUi,
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
      `${service}\n${commercialUi}`.includes(code),
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
    commercialUi,
    /organisation|organization|team|gym|unit|federation|enterprise/iu
  );
});

test("FULL-UI-08 preserves existing account controls", () => {
  for (const token of [
    "registerAccount",
    "signInAccount",
    "updateAccountProfile",
    "changeAccountPassword",
    "requestPasswordReset",
    "requestEmailVerification",
    "requestAccountClosure"
  ]) {
    assert.ok(
      accountUi.includes(token),
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
