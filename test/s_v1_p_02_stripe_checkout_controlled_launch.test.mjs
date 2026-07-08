import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES,
  assertControlledLaunchCheckoutNoEngineMutation,
  createControlledLaunchCheckoutSession,
  handleControlledLaunchCheckoutWebhook
} from "../src/v1ControlledLaunchCheckout.mjs";

import {
  handleV1ControlledLaunchCheckoutApiRequest
} from "../src/api/v1ControlledLaunchCheckoutApi.mjs";

import {
  handleV1ControlledLaunchWebhookRequest
} from "../src/api/v1ControlledLaunchWebhookHandler.mjs";

const deterministicProbe = Object.freeze({
  canonical_input_hash: "a".repeat(64),
  compile_output_hash: "b".repeat(64),
  substitution_output_hash: "c".repeat(64),
  replay_record_hash: "d".repeat(64),
  proof_record_hash: "e".repeat(64),
  factual_history_hash: "f".repeat(64)
});

function checkoutRequest(overrides = {}) {
  return {
    provider: "stripe_checkout",
    checkout_mode: "subscription",
    provider_price_id: "price_controlled_launch_001",
    plan_id: "controlled_launch_coach",
    seat_limit: 6,
    actor_id: "coach_001",
    subject_id: "coach_001",
    success_url: "https://kolosseum.test/checkout/success",
    cancel_url: "https://kolosseum.test/checkout/cancel",
    idempotency_key: "idem_checkout_001",
    requested_at: "2026-06-17T10:00:00.000Z",
    requested_commercial_scopes: [],
    deterministic_probe: deterministicProbe,
    ...overrides
  };
}

test("S-V1-P-02 checkout path creates billing and access record only", () => {
  const result = createControlledLaunchCheckoutSession(checkoutRequest());

  assert.equal(result.ok, true);
  assert.equal(result.status, "controlled_launch_checkout_created");
  assert.equal(result.reason_code, CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.ALLOWED);
  assert.equal(result.provider_session_request.provider, "stripe_checkout");
  assert.equal(result.provider_session_request.live_provider_call, "not_performed_in_contract_slice");
  assert.equal(result.billing_access_record.record_type, "controlled_launch_billing_access_record");
  assert.equal(result.billing_access_record.billing_access_state, "checkout_created");
  assert.equal(result.billing_access_record.billing_status, "provider_checkout_created");
  assert.equal(result.billing_access_record.engine_legality, "not_mutated");
  assert.equal(result.billing_access_record.compile_output, "not_mutated");
  assert.equal(result.billing_access_record.substitution_selection, "not_mutated");
  assert.equal(result.billing_access_record.replay_record, "not_mutated");
  assert.equal(result.billing_access_record.proof_record, "not_mutated");
  assert.equal(result.billing_access_record.factual_history_record, "not_mutated");

  const assertion = assertControlledLaunchCheckoutNoEngineMutation(result);
  assert.equal(assertion.ok, true);
});

test("S-V1-P-02 checkout API maps contract output without live provider side effects", () => {
  const response = handleV1ControlledLaunchCheckoutApiRequest({
    body: checkoutRequest()
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.headers["content-type"], "application/json");

  const body = JSON.parse(response.body);
  assert.equal(body.ok, true);
  assert.equal(body.provider_session_request.live_provider_call, "not_performed_in_contract_slice");
});

test("S-V1-P-02 webhook completion updates billing access record only", () => {
  const checkout = createControlledLaunchCheckoutSession(checkoutRequest());
  assert.equal(checkout.ok, true);

  const webhook = handleControlledLaunchCheckoutWebhook({
    provider: "stripe_checkout",
    event_id: "evt_checkout_completed_001",
    event_type: "checkout.session.completed",
    provider_session_id: "cs_test_001",
    idempotency_key: "idem_webhook_001",
    received_at: "2026-06-17T10:05:00.000Z",
    billing_access_record: checkout.billing_access_record,
    deterministic_probe: deterministicProbe
  });

  assert.equal(webhook.ok, true);
  assert.equal(webhook.status, "controlled_launch_webhook_recorded");
  assert.equal(webhook.billing_access_record.billing_access_state, "access_active");
  assert.equal(webhook.billing_access_record.billing_status, "payment_confirmed");
  assert.equal(webhook.billing_access_record.provider_session_id, "cs_test_001");
  assert.equal(webhook.engine_legality, "not_mutated");
  assert.equal(webhook.compile_output, "not_mutated");
  assert.equal(webhook.substitution_selection, "not_mutated");
  assert.equal(webhook.replay_record, "not_mutated");
  assert.equal(webhook.proof_record, "not_mutated");
  assert.equal(webhook.factual_history_record, "not_mutated");

  const assertion = assertControlledLaunchCheckoutNoEngineMutation(webhook);
  assert.equal(assertion.ok, true);
});

test("S-V1-P-02 webhook API maps unsupported events to factual failure", () => {
  const checkout = createControlledLaunchCheckoutSession(checkoutRequest());
  assert.equal(checkout.ok, true);

  const response = handleV1ControlledLaunchWebhookRequest({
    body: {
      provider: "stripe_checkout",
      event_id: "evt_unknown_001",
      event_type: "customer.subscription.updated",
      provider_session_id: "cs_test_002",
      idempotency_key: "idem_webhook_002",
      received_at: "2026-06-17T10:05:00.000Z",
      billing_access_record: checkout.billing_access_record,
      deterministic_probe: deterministicProbe
    }
  });

  assert.equal(response.statusCode, 400);

  const body = JSON.parse(response.body);
  assert.equal(body.ok, false);
  assert.equal(body.reason_code, CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.WEBHOOK_EVENT_NOT_SUPPORTED);
});

test("S-V1-P-02 payment cannot mutate deterministic probe or engine surfaces", () => {
  const first = createControlledLaunchCheckoutSession(checkoutRequest({
    idempotency_key: "idem_checkout_a"
  }));

  const second = createControlledLaunchCheckoutSession(checkoutRequest({
    idempotency_key: "idem_checkout_b",
    seat_limit: 12
  }));

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.deterministic_probe_hash, second.deterministic_probe_hash);
  assert.equal(first.engine_legality, "not_mutated");
  assert.equal(second.engine_legality, "not_mutated");
  assert.notEqual(first.billing_access_record.record_hash, second.billing_access_record.record_hash);
});

test("S-V1-P-02 refuses enterprise procurement multi-entity revenue share and royalties", () => {
  for (const requestedScope of [
    "enterprise_procurement",
    "enterprise_billing",
    "multi_entity_billing",
    "revenue_share",
    "royalties"
  ]) {
    const result = createControlledLaunchCheckoutSession(checkoutRequest({
      requested_commercial_scopes: [requestedScope]
    }));

    assert.equal(result.ok, false);
    assert.equal(result.reason_code, CONTROLLED_LAUNCH_CHECKOUT_REASON_CODES.SCOPE_NOT_PERMITTED);
    assert.equal(result.details.requested_scope, requestedScope);
  }
});

test("S-V1-P-02 checkout copy remains factual", () => {
  const copy = JSON.parse(fs.readFileSync("copy/controlled_launch_checkout_copy.json", "utf8"));
  const text = JSON.stringify(copy).toLowerCase();

  for (const blocked of [
    "recommended",
    "recommendation",
    "readiness",
    "fatigue",
    "risk",
    "medical",
    "diagnosis",
    "rehab",
    "optimal"
  ]) {
    assert.equal(text.includes(blocked), false, `copy must not include ${blocked}`);
  }
});