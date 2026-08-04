import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  createControlledLaunchCheckoutSession,
  handleControlledLaunchCheckoutWebhook
} from "../src/v1ControlledLaunchCheckout.mjs";

import {
  SEAT_ENTITLEMENT_REASON_CODES,
  assertSeatEntitlementDoesNotMutateEngine,
  evaluateSeatEntitlement
} from "../src/v1SeatEntitlementGuard.mjs";

import {
  handleV1SeatEntitlementGuardApiRequest
} from "../src/api/v1SeatEntitlementGuardApi.mjs";

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

function activeBillingAccessRecord(overrides = {}) {
  const checkout = createControlledLaunchCheckoutSession(checkoutRequest(overrides.checkout ?? {}));
  assert.equal(checkout.ok, true);

  const webhook = handleControlledLaunchCheckoutWebhook({
    provider: "stripe_checkout",
    event_id: overrides.event_id ?? "evt_checkout_completed_001",
    event_type: "checkout.session.completed",
    provider_session_id: overrides.provider_session_id ?? "cs_test_001",
    idempotency_key: overrides.webhook_idempotency_key ?? "idem_webhook_001",
    received_at: "2026-06-17T10:05:00.000Z",
    billing_access_record: checkout.billing_access_record,
    deterministic_probe: deterministicProbe
  });

  assert.equal(webhook.ok, true);
  return webhook.billing_access_record;
}

function entitlementRequest(overrides = {}) {
  return {
    billing_access_record: activeBillingAccessRecord(),
    requested_product_surface: "controlled_launch_athlete_product_access",
    requesting_actor_id: "coach_001",
    requested_subject_id: "athlete_001",
    current_occupied_seat_count: 5,
    requested_seat_count: 1,
    requested_seat_scope: "controlled_launch_athlete_seat",
    requested_at: "2026-06-17T10:10:00.000Z",
    deterministic_probe: deterministicProbe,
    ...overrides
  };
}

test("S-V1-P-03 allows product access when active billing access has seat capacity", () => {
  const result = evaluateSeatEntitlement(entitlementRequest());

  assert.equal(result.ok, true);
  assert.equal(result.status, "seat_entitlement_allowed");
  assert.equal(result.reason_code, SEAT_ENTITLEMENT_REASON_CODES.ALLOWED);
  assert.equal(result.product_access_state, "allowed");
  assert.equal(result.product_access_failure, false);
  assert.equal(result.engine_decision, false);
  assert.equal(result.engine_visible, false);
  assert.equal(result.available_seat_count_after_request, 0);
  assert.equal(result.engine_legality, "not_mutated");
  assert.equal(result.compile_output, "not_mutated");
  assert.equal(result.substitution_selection, "not_mutated");
  assert.equal(result.replay_record, "not_mutated");
  assert.equal(result.proof_record, "not_mutated");
  assert.equal(result.factual_history_record, "not_mutated");

  const assertion = assertSeatEntitlementDoesNotMutateEngine(result);
  assert.equal(assertion.ok, true);
});

test("S-V1-P-03 rejects product access when seat limit is exceeded", () => {
  const result = evaluateSeatEntitlement(entitlementRequest({
    current_occupied_seat_count: 6,
    requested_seat_count: 1
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, "seat_entitlement_rejected");
  assert.equal(result.reason_code, SEAT_ENTITLEMENT_REASON_CODES.SEAT_LIMIT_EXCEEDED);
  assert.equal(result.product_access_state, "rejected");
  assert.equal(result.product_access_failure, true);
  assert.equal(result.engine_decision, false);
  assert.equal(result.engine_visible, false);
  assert.equal(result.engine_legality, "not_mutated");
  assert.equal(result.compile_output, "not_mutated");
});

test("S-V1-P-03 rejects product access when billing access is not active", () => {
  const checkout = createControlledLaunchCheckoutSession(checkoutRequest());
  assert.equal(checkout.ok, true);

  const result = evaluateSeatEntitlement(entitlementRequest({
    billing_access_record: checkout.billing_access_record,
    current_occupied_seat_count: 0,
    requested_seat_count: 1
  }));

  assert.equal(result.ok, false);
  assert.equal(result.reason_code, SEAT_ENTITLEMENT_REASON_CODES.BILLING_ACCESS_NOT_ACTIVE);
  assert.equal(result.product_access_failure, true);
  assert.equal(result.engine_decision, false);
});

test("S-V1-P-03 rejects enterprise organisation and team seat scopes", () => {
  for (const requestedSeatScope of [
    "enterprise_seats",
    "organisation_seats",
    "team_seats",
    "multi_entity_seats"
  ]) {
    const result = evaluateSeatEntitlement(entitlementRequest({
      requested_seat_scope: requestedSeatScope
    }));

    assert.equal(result.ok, false);
    assert.equal(result.reason_code, SEAT_ENTITLEMENT_REASON_CODES.SEAT_SCOPE_NOT_PERMITTED);
    assert.equal(result.details.requested_seat_scope, requestedSeatScope);
    assert.equal(result.product_access_failure, true);
    assert.equal(result.engine_decision, false);
  }
});

test("S-V1-P-03 allows org billing to roll up seat consumption across member coaches", () => {
  // A single shared org billing_access_record; current_occupied_seat_count
  // represents the SUM of active coach memberships across the whole org,
  // not one coach's own count - the caller (org_billing_service.ts) is
  // responsible for computing that aggregate before calling this pure
  // evaluator, which itself has no knowledge of coaches or orgs.
  const orgBillingAccessRecord = activeBillingAccessRecord({
    checkout: {
      actor_id: "org_owner_001",
      subject_id: "org_owner_001",
      seat_limit: 3,
      idempotency_key: "idem_checkout_org_001"
    },
    event_id: "evt_checkout_completed_org_001",
    provider_session_id: "cs_test_org_001",
    webhook_idempotency_key: "idem_webhook_org_001"
  });

  const allowed = evaluateSeatEntitlement({
    billing_access_record: orgBillingAccessRecord,
    requested_product_surface: "controlled_launch_org_coach_product_access",
    requesting_actor_id: "org_owner_001",
    requested_subject_id: "coach_003",
    current_occupied_seat_count: 2,
    requested_seat_count: 1,
    requested_seat_scope: "controlled_launch_org_coach_seat",
    requested_at: "2026-06-17T10:10:00.000Z",
    deterministic_probe: deterministicProbe
  });

  assert.equal(allowed.ok, true);
  assert.equal(allowed.reason_code, SEAT_ENTITLEMENT_REASON_CODES.ALLOWED);
  assert.equal(allowed.available_seat_count_after_request, 0);
  assert.equal(allowed.engine_decision, false);
  assert.equal(allowed.engine_visible, false);

  const rejected = evaluateSeatEntitlement({
    billing_access_record: orgBillingAccessRecord,
    requested_product_surface: "controlled_launch_org_coach_product_access",
    requesting_actor_id: "org_owner_001",
    requested_subject_id: "coach_004",
    current_occupied_seat_count: 3,
    requested_seat_count: 1,
    requested_seat_scope: "controlled_launch_org_coach_seat",
    requested_at: "2026-06-17T10:10:00.000Z",
    deterministic_probe: deterministicProbe
  });

  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason_code, SEAT_ENTITLEMENT_REASON_CODES.SEAT_LIMIT_EXCEEDED);
  assert.equal(rejected.product_access_failure, true);
  assert.equal(rejected.engine_decision, false);
});

test("S-V1-P-03 rejects actor mismatch as product access failure", () => {
  const result = evaluateSeatEntitlement(entitlementRequest({
    requesting_actor_id: "coach_999"
  }));

  assert.equal(result.ok, false);
  assert.equal(result.reason_code, SEAT_ENTITLEMENT_REASON_CODES.ACTOR_MISMATCH);
  assert.equal(result.product_access_failure, true);
  assert.equal(result.engine_decision, false);
  assert.equal(result.engine_visible, false);
});

test("S-V1-P-03 entitlement cannot alter deterministic probe or engine output markers", () => {
  const first = evaluateSeatEntitlement(entitlementRequest({
    current_occupied_seat_count: 1,
    requested_subject_id: "athlete_001"
  }));

  const second = evaluateSeatEntitlement(entitlementRequest({
    current_occupied_seat_count: 5,
    requested_subject_id: "athlete_002"
  }));

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.deterministic_probe_hash, second.deterministic_probe_hash);

  for (const result of [first, second]) {
    assert.equal(result.engine_legality, "not_mutated");
    assert.equal(result.compile_output, "not_mutated");
    assert.equal(result.substitution_selection, "not_mutated");
    assert.equal(result.replay_record, "not_mutated");
    assert.equal(result.proof_record, "not_mutated");
    assert.equal(result.factual_history_record, "not_mutated");
    assert.equal(result.engine_decision, false);
    assert.equal(result.engine_visible, false);
  }
});

test("S-V1-P-03 API maps allow and reject verdicts without engine decision", () => {
  const allowedResponse = handleV1SeatEntitlementGuardApiRequest({
    body: entitlementRequest()
  });

  assert.equal(allowedResponse.statusCode, 200);

  const allowedBody = JSON.parse(allowedResponse.body);
  assert.equal(allowedBody.ok, true);
  assert.equal(allowedBody.engine_decision, false);

  const rejectedResponse = handleV1SeatEntitlementGuardApiRequest({
    body: entitlementRequest({
      current_occupied_seat_count: 6,
      requested_seat_count: 1
    })
  });

  assert.equal(rejectedResponse.statusCode, 403);

  const rejectedBody = JSON.parse(rejectedResponse.body);
  assert.equal(rejectedBody.ok, false);
  assert.equal(rejectedBody.product_access_failure, true);
  assert.equal(rejectedBody.engine_decision, false);
});

test("S-V1-P-03 seat entitlement copy remains factual", () => {
  const copy = JSON.parse(fs.readFileSync("copy/seat_entitlement_copy.json", "utf8"));
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
    "optimal",
    "cleared"
  ]) {
    assert.equal(text.includes(blocked), false, `copy must not include ${blocked}`);
  }
});