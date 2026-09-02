// DEV NOTE: LAUNCH-04 DB-backed billing lifecycle proof.
// This test exercises the compiled product service against PostgreSQL and the
// real Stripe SDK HTTP call path using a local fixture. No real Stripe account,
// network call, engine input, or deterministic engine mutation is involved.

import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function startStripeFixture() {
  const requests = [];
  const subscriptions = new Map();
  let sequence = 0;

  const subscriptionJson = (subscription) => ({
    id: subscription.id,
    object: "subscription",
    status: subscription.status,
    cancel_at_period_end: subscription.cancel_at_period_end,
    customer: subscription.customer,
    metadata: { ...subscription.metadata },
    items: {
      object: "list",
      data: [
        {
          id: subscription.item_id,
          object: "subscription_item",
          price: { id: subscription.price_id, object: "price" }
        }
      ],
      has_more: false,
      url: `/v1/subscription_items?subscription=${subscription.id}`
    }
  });

  const server = createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const rawBody = Buffer.concat(chunks).toString("utf8");
      const params = new URLSearchParams(rawBody);
      requests.push({
        method: request.method,
        url: request.url,
        params: Object.fromEntries(params.entries())
      });
      response.setHeader("Content-Type", "application/json");

      if (request.method === "POST" && request.url === "/v1/checkout/sessions") {
        sequence += 1;
        const id = `cs_test_launch04_${sequence}`;
        response.statusCode = 200;
        response.end(JSON.stringify({
          id,
          object: "checkout.session",
          mode: "subscription",
          url: `http://127.0.0.1/fixture-checkout/${id}`,
          customer: `cus_test_launch04_${sequence}`,
          client_reference_id: params.get("client_reference_id"),
          success_url: params.get("success_url"),
          cancel_url: params.get("cancel_url")
        }));
        return;
      }

      if (request.method === "POST" && request.url === "/v1/billing_portal/sessions") {
        sequence += 1;
        response.statusCode = 200;
        response.end(JSON.stringify({
          id: `bps_test_launch04_${sequence}`,
          object: "billing_portal.session",
          url: `http://127.0.0.1/fixture-portal/${sequence}`,
          customer: params.get("customer"),
          return_url: params.get("return_url")
        }));
        return;
      }

      const subscriptionMatch = request.url?.match(/^\/v1\/subscriptions\/([^/?]+)$/u);
      if (subscriptionMatch && request.method === "GET") {
        const subscription = subscriptions.get(subscriptionMatch[1]);
        if (!subscription) {
          response.statusCode = 404;
          response.end(JSON.stringify({ error: { type: "invalid_request_error", message: "subscription not found" } }));
          return;
        }
        response.statusCode = 200;
        response.end(JSON.stringify(subscriptionJson(subscription)));
        return;
      }

      if (subscriptionMatch && request.method === "POST") {
        const subscription = subscriptions.get(subscriptionMatch[1]);
        if (!subscription) {
          response.statusCode = 404;
          response.end(JSON.stringify({ error: { type: "invalid_request_error", message: "subscription not found" } }));
          return;
        }
        const priceId = params.get("items[0][price]");
        if (priceId) subscription.price_id = priceId;
        if (params.get("cancel_at_period_end") === "true") subscription.cancel_at_period_end = true;
        response.statusCode = 200;
        response.end(JSON.stringify(subscriptionJson(subscription)));
        return;
      }

      response.statusCode = 404;
      response.end(JSON.stringify({ error: { type: "invalid_request_error", message: `fixture has no route for ${request.method} ${request.url}` } }));
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    requests,
    subscriptions,
    createSubscription({ id, customer, actorId, priceId, status = "trialing" }) {
      subscriptions.set(id, {
        id,
        customer,
        metadata: { slice: "LAUNCH-04", actor_id: actorId },
        price_id: priceId,
        item_id: `si_${id}`,
        status,
        cancel_at_period_end: false
      });
    },
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

function event(id, type, created, object) {
  return {
    id,
    object: "event",
    api_version: "2025-08-27.basil",
    created,
    livemode: false,
    pending_webhooks: 0,
    request: null,
    type,
    data: { object }
  };
}

test("LAUNCH-04 persists and reconciles the complete public billing lifecycle", async (t) => {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required for LAUNCH-04 persistent proof");

  const stripe = await startStripeFixture();
  const coachUserId = `coach_launch04_${randomUUID().replaceAll("-", "")}`;
  const athleteUserId = `athlete_launch04_${randomUUID().replaceAll("-", "")}`;

  process.env.NODE_ENV = "test";
  process.env.KOLOSSEUM_PUBLIC_LAUNCH_BILLING_ENABLED = "1";
  process.env.KOLOSSEUM_PUBLIC_LAUNCH_BILLING_MODE = "test";
  process.env.STRIPE_SECRET_KEY = "sk_test_launch04_fixture";
  process.env.STRIPE_TEST_API_BASE_URL = stripe.url;
  process.env.KOLOSSEUM_PUBLIC_APP_URL = "http://127.0.0.1:4173/app";
  process.env.KOLOSSEUM_PUBLIC_LAUNCH_ATHLETE_STANDARD_PRICE_ID = "price_launch04_athlete_standard";
  for (const [tier, standard, intro] of [
    ["6", "price_launch04_coach6_standard", "price_launch04_coach6_intro"],
    ["16", "price_launch04_coach16_standard", "price_launch04_coach16_intro"],
    ["32", "price_launch04_coach32_standard", "price_launch04_coach32_intro"],
    ["64", "price_launch04_coach64_standard", "price_launch04_coach64_intro"],
    ["120", "price_launch04_coach120_standard", "price_launch04_coach120_intro"],
    ["250", "price_launch04_coach250_standard", "price_launch04_coach250_intro"]
  ]) {
    process.env[`KOLOSSEUM_PUBLIC_LAUNCH_COACH_${tier}_STANDARD_PRICE_ID`] = standard;
    process.env[`KOLOSSEUM_PUBLIC_LAUNCH_COACH_${tier}_INTRO_PRICE_ID`] = intro;
  }

  const { pool } = await import("../dist/src/db/pool.js");
  const billing = await import("../dist/src/api/public_launch_billing_service.js");
  const aux = await import("../dist/src/api/public_launch_billing_aux_service.js");

  const cleanup = async () => {
    await pool.query("DELETE FROM product_commercial_records WHERE user_id = ANY($1::text[])", [[coachUserId, athleteUserId]]).catch(() => {});
    await pool.query("DELETE FROM beta_product_records WHERE actor_user_id = $1 AND record_type = 'beta17_coach_relationship'", [coachUserId]).catch(() => {});
    await pool.query("DELETE FROM product_accounts WHERE user_id = ANY($1::text[])", [[coachUserId, athleteUserId]]).catch(() => {});
  };

  t.after(async () => {
    await cleanup();
    await pool.end();
    await stripe.close();
  });

  await cleanup();
  for (const [userId, actorType] of [[coachUserId, "coach"], [athleteUserId, "athlete"]]) {
    await pool.query(
      `INSERT INTO product_accounts (
         user_id,email_canonical,display_name,actor_type,account_state,
         password_salt,password_hash,accepted_terms_version,accepted_consent_version
       ) VALUES ($1,$2,$3,$4,'active','fixture_salt','fixture_hash','v1','v1')`,
      [userId, `${userId}@example.test`, `${actorType} launch04 fixture`, actorType]
    );
  }

  const athleteCheckout = await billing.createPublicLaunchCheckout(
    athleteUserId,
    "athlete",
    { request_id: "athlete_checkout", tier: "athlete_monthly" }
  );
  assert.equal(athleteCheckout.ok, true);
  assert.equal(athleteCheckout.provider_call_performed, true);
  assert.equal(athleteCheckout.overview.entitlement.account_role, "athlete");
  assert.equal(athleteCheckout.overview.entitlement.tier, "athlete_monthly");
  assert.equal(athleteCheckout.overview.entitlement.athlete_capacity, null);

  const trial = await billing.startPublicLaunchCoachTrial(
    coachUserId,
    "coach",
    { request_id: "coach_trial", tier: "coach_6" }
  );
  assert.equal(trial.ok, true);
  assert.equal(trial.founding_offer_applied, true);
  assert.equal(trial.overview.entitlement.trial_state, "active");
  assert.equal(trial.overview.entitlement.intro_price_state, "scheduled");
  const originalTrialStart = trial.overview.entitlement.trial_start_at;
  const originalTrialEnd = trial.overview.entitlement.trial_end_at;
  const originalIntroStart = trial.overview.entitlement.intro_period_start_at;
  const originalIntroEnd = trial.overview.entitlement.intro_period_end_at;

  const preCheckoutUpgrade = await billing.changePublicLaunchCoachTier(
    coachUserId,
    "coach",
    { request_id: "coach_upgrade_16", tier: "coach_16" }
  );
  assert.equal(preCheckoutUpgrade.provider_call_performed, false);
  assert.equal(preCheckoutUpgrade.overview.entitlement.tier, "coach_16");
  assert.equal(preCheckoutUpgrade.overview.entitlement.athlete_capacity, 16);
  assert.equal(preCheckoutUpgrade.overview.entitlement.trial_start_at, originalTrialStart);
  assert.equal(preCheckoutUpgrade.overview.entitlement.trial_end_at, originalTrialEnd);
  assert.equal(preCheckoutUpgrade.overview.entitlement.intro_period_start_at, originalIntroStart);
  assert.equal(preCheckoutUpgrade.overview.entitlement.intro_period_end_at, originalIntroEnd);

  const coachCheckout = await billing.createPublicLaunchCheckout(
    coachUserId,
    "coach",
    { request_id: "coach_checkout", tier: "coach_16" }
  );
  assert.equal(coachCheckout.provider_call_performed, true);
  assert.match(coachCheckout.checkout_url, /fixture-checkout/u);
  const checkoutRequest = stripe.requests.find((entry) => entry.url === "/v1/checkout/sessions" && entry.params.client_reference_id === coachUserId);
  assert.ok(checkoutRequest, "expected Stripe SDK checkout call for coach");
  assert.equal(checkoutRequest.params["line_items[0][price]"], "price_launch04_coach16_intro");

  const browserReturn = await aux.recordPublicLaunchPaymentReturn(
    coachUserId,
    "coach",
    { request_id: "browser_return", outcome: "success", provider_session_id: coachCheckout.overview.entitlement.billing_provider_ids.checkout_session_id }
  );
  assert.equal(browserReturn.trusted_provider_confirmation, false);
  let overview = await billing.getPublicLaunchCommercialOverview(coachUserId, "coach");
  assert.equal(overview.entitlement.billing_provider_ids.subscription_id, null, "browser return must not create provider subscription truth");

  const customerId = overview.entitlement.billing_provider_ids.customer_id;
  const subscriptionId = "sub_launch04_coach";
  stripe.createSubscription({
    id: subscriptionId,
    customer: customerId,
    actorId: coachUserId,
    priceId: "price_launch04_coach16_intro",
    status: "trialing"
  });

  const baseCreated = Math.floor(Date.now() / 1000);
  const checkoutEvent = event(
    "evt_launch04_checkout",
    "checkout.session.completed",
    baseCreated,
    {
      id: coachCheckout.overview.entitlement.billing_provider_ids.checkout_session_id,
      object: "checkout.session",
      client_reference_id: coachUserId,
      customer: customerId,
      subscription: subscriptionId,
      metadata: { slice: "LAUNCH-04", actor_id: coachUserId }
    }
  );
  const completed = await billing.recordPublicLaunchBillingWebhookEvent(checkoutEvent);
  assert.equal(completed.handled, true);
  assert.equal(completed.result.action, "webhook_recorded");
  const replay = await billing.recordPublicLaunchBillingWebhookEvent(checkoutEvent);
  assert.equal(replay.result.action, "webhook_idempotent_replay");

  const stale = await billing.recordPublicLaunchBillingWebhookEvent(event(
    "evt_launch04_stale_failure",
    "invoice.payment_failed",
    baseCreated - 1,
    {
      id: "in_launch04_stale",
      object: "invoice",
      customer: customerId,
      subscription: subscriptionId,
      metadata: { slice: "LAUNCH-04", actor_id: coachUserId }
    }
  ));
  assert.equal(stale.result.action, "webhook_stale_ignored");

  const failed = await billing.recordPublicLaunchBillingWebhookEvent(event(
    "evt_launch04_payment_failed",
    "invoice.payment_failed",
    baseCreated + 1,
    {
      id: "in_launch04_failed",
      object: "invoice",
      customer: customerId,
      subscription: subscriptionId,
      metadata: { slice: "LAUNCH-04", actor_id: coachUserId }
    }
  ));
  assert.equal(failed.result.action, "webhook_recorded");
  overview = await billing.getPublicLaunchCommercialOverview(coachUserId, "coach");
  assert.equal(overview.entitlement.billing_state, "past_due");
  assert.equal(overview.entitlement.access_state, "restricted");

  const paid = await billing.recordPublicLaunchBillingWebhookEvent(event(
    "evt_launch04_paid",
    "invoice.paid",
    baseCreated + 2,
    {
      id: "in_launch04_paid",
      object: "invoice",
      amount_paid: 3999,
      customer: customerId,
      subscription: subscriptionId,
      metadata: { slice: "LAUNCH-04", actor_id: coachUserId }
    }
  ));
  assert.equal(paid.result.action, "webhook_recorded");
  overview = await billing.getPublicLaunchCommercialOverview(coachUserId, "coach");
  assert.equal(overview.entitlement.billing_state, "active_paid");
  assert.equal(overview.entitlement.access_state, "active");
  assert.equal(overview.entitlement.entitlement_metadata.intro_paid_cycles, 1);

  const providerUpgrade = await billing.changePublicLaunchCoachTier(
    coachUserId,
    "coach",
    { request_id: "coach_upgrade_32", tier: "coach_32" }
  );
  assert.equal(providerUpgrade.provider_call_performed, true);
  assert.equal(providerUpgrade.overview.entitlement.tier, "coach_32");
  assert.equal(providerUpgrade.overview.entitlement.trial_start_at, originalTrialStart);
  assert.equal(providerUpgrade.overview.entitlement.trial_end_at, originalTrialEnd);
  assert.equal(providerUpgrade.overview.entitlement.intro_period_start_at, originalIntroStart);
  assert.equal(providerUpgrade.overview.entitlement.intro_period_end_at, originalIntroEnd);
  assert.equal(stripe.subscriptions.get(subscriptionId).price_id, "price_launch04_coach32_intro");

  for (let index = 0; index < 17; index += 1) {
    const subject = `athlete_capacity_${index}`;
    const recordId = `rel_launch04_${index}_${randomUUID().replaceAll("-", "")}`;
    await pool.query(
      `INSERT INTO beta_product_records (
         record_type,record_id,subject_user_id,actor_user_id,effective_at,record_sha256,record_payload
       ) VALUES ('beta17_coach_relationship',$1,$2,$3,now(),$4,$5::jsonb)`,
      [recordId, subject, coachUserId, sha256(recordId), JSON.stringify({ relationship_state: "accepted" })]
    );
  }

  await billing.assertPublicLaunchCoachCapacity(coachUserId);
  await assert.rejects(
    billing.changePublicLaunchCoachTier(coachUserId, "coach", { request_id: "invalid_downgrade", tier: "coach_16" }),
    (error) => error?.code === "public_launch_downgrade_over_capacity"
  );

  const reconciled = await billing.reconcilePublicLaunchBilling(
    coachUserId,
    "coach",
    { request_id: "coach_reconcile" }
  );
  assert.equal(reconciled.provider_call_performed, true);
  assert.equal(reconciled.overview.entitlement.tier, "coach_32");
  assert.equal(reconciled.overview.entitlement.billing_state, "active_paid");

  const portal = await aux.createPublicLaunchBillingPortal(
    coachUserId,
    "coach",
    { request_id: "coach_portal" }
  );
  assert.equal(portal.provider_call_performed, true);
  assert.match(portal.portal_url, /fixture-portal/u);

  const cancelled = await billing.cancelPublicLaunchBilling(
    coachUserId,
    "coach",
    { request_id: "coach_cancel" }
  );
  assert.equal(cancelled.provider_call_performed, true);
  assert.equal(cancelled.overview.entitlement.billing_state, "cancelled");
  assert.equal(cancelled.overview.entitlement.access_state, "active");
  assert.equal(stripe.subscriptions.get(subscriptionId).cancel_at_period_end, true);

  stripe.subscriptions.get(subscriptionId).status = "canceled";
  const ended = await billing.recordPublicLaunchBillingWebhookEvent(event(
    "evt_launch04_deleted",
    "customer.subscription.deleted",
    baseCreated + 3,
    {
      ...(() => {
        const subscription = stripe.subscriptions.get(subscriptionId);
        return {
          id: subscription.id,
          object: "subscription",
          status: subscription.status,
          cancel_at_period_end: subscription.cancel_at_period_end,
          customer: subscription.customer,
          metadata: subscription.metadata,
          items: { data: [{ id: subscription.item_id, price: { id: subscription.price_id } }] }
        };
      })()
    }
  ));
  assert.equal(ended.result.action, "webhook_recorded");
  overview = await billing.getPublicLaunchCommercialOverview(coachUserId, "coach");
  assert.equal(overview.entitlement.billing_state, "ended");
  assert.equal(overview.entitlement.access_state, "inactive");

  const rows = await pool.query(
    `SELECT user_id, record_payload
     FROM product_commercial_records
     WHERE user_id = ANY($1::text[])
     ORDER BY created_at`,
    [[coachUserId, athleteUserId]]
  );
  assert.ok(rows.rowCount >= 10, "expected persisted lifecycle history");
  for (const row of rows.rows) {
    assert.equal(row.record_payload.calls_engine, false);
    assert.equal(row.record_payload.engine_visible, false);
    assert.equal(row.record_payload.engine_decision, false);
    assert.equal(row.record_payload.relationship_truth_mutation, "not_performed");
  }

  const athleteOverview = await billing.getPublicLaunchCommercialOverview(athleteUserId, "athlete");
  assert.equal(athleteOverview.entitlement.product, "athlete_individual");
  assert.equal(athleteOverview.entitlement.account_role, "athlete");
  assert.notEqual(athleteOverview.entitlement.billing_provider_ids.checkout_session_id, overview.entitlement.billing_provider_ids.checkout_session_id);
});
