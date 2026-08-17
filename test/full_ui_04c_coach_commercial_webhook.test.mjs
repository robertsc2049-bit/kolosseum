// DEV NOTE: FULL-UI-04C Stripe webhook signature-verification contract.
// Transport-level only - no database, no real Stripe network access.
// Positive-path proof (a real signed checkout.session.completed flipping
// an account to factual_state: "active", plus replay-dedup against a real
// row) lives in test/full_ui_04c_coach_commercial_persistent_http.integration.test.mjs,
// where a real account/checkout record already exists to attach it to.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import express from "express";
import Stripe from "stripe";

import { productCommercialWebhookRouter } from "../dist/src/api/product_commercial_webhook.routes.js";

const WEBHOOK_SECRET = "whsec_test_full_ui_04c";
const SECRET_KEY = "sk_test_full_ui_04c";

async function withWebhookServer(run) {
  const app = express();
  app.use(
    "/webhooks/stripe",
    express.raw({ type: "application/json" }),
    productCommercialWebhookRouter
  );

  const server = createServer(app);

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  }
  finally {
    await new Promise((resolve) => {
      server.close(() => resolve());
    });
  }
}

function payloadFor(eventType) {
  return JSON.stringify({
    id: `evt_test_${eventType.replaceAll(".", "_")}`,
    object: "event",
    type: eventType,
    data: {
      object: {
        id: "cs_test_unused",
        object: "checkout.session",
        client_reference_id: null,
        customer: null
      }
    }
  });
}

test(
  "FULL-UI-04C webhook: missing signature header is rejected without touching the database",
  async () => {
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.STRIPE_SECRET_KEY = SECRET_KEY;

    await withWebhookServer(async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/webhooks/stripe`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payloadFor("checkout.session.completed")
        }
      );

      assert.equal(response.status, 400);
      const json = await response.json();
      assert.equal(
        json.error,
        "commercial_webhook_signature_invalid"
      );
    });
  }
);

test(
  "FULL-UI-04C webhook: a signature computed with the wrong secret is rejected",
  async () => {
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.STRIPE_SECRET_KEY = SECRET_KEY;

    await withWebhookServer(async (baseUrl) => {
      const payload = payloadFor(
        "checkout.session.completed"
      );
      const wrongSignature =
        Stripe.webhooks.generateTestHeaderString({
          payload,
          secret: "whsec_totally_different_secret"
        });

      const response = await fetch(
        `${baseUrl}/webhooks/stripe`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "stripe-signature": wrongSignature
          },
          body: payload
        }
      );

      assert.equal(response.status, 400);
      const json = await response.json();
      assert.equal(
        json.error,
        "commercial_webhook_signature_invalid"
      );
    });
  }
);

test(
  "FULL-UI-04C webhook: a validly-signed but unhandled event type is acknowledged, never rejected (avoids Stripe retry storms)",
  async () => {
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.STRIPE_SECRET_KEY = SECRET_KEY;

    await withWebhookServer(async (baseUrl) => {
      const payload = payloadFor(
        "payment_intent.succeeded"
      );
      const signature =
        Stripe.webhooks.generateTestHeaderString({
          payload,
          secret: WEBHOOK_SECRET
        });

      const response = await fetch(
        `${baseUrl}/webhooks/stripe`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "stripe-signature": signature
          },
          body: payload
        }
      );

      assert.equal(response.status, 200);
      const json = await response.json();
      assert.equal(json.ok, true);
      assert.equal(json.action, "webhook_ignored");
      assert.equal(
        json.reason_code,
        "unhandled_event_type"
      );
    });
  }
);

test(
  "FULL-UI-04C webhook: a validly-signed event whose client_reference_id resolves to no existing account is acknowledged, not rejected",
  async () => {
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.STRIPE_SECRET_KEY = SECRET_KEY;

    await withWebhookServer(async (baseUrl) => {
      const payload = JSON.stringify({
        id: "evt_test_no_account",
        object: "event",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_no_account",
            object: "checkout.session",
            client_reference_id:
              "coach_this_user_id_has_no_records",
            customer: "cus_test_unused"
          }
        }
      });
      const signature =
        Stripe.webhooks.generateTestHeaderString({
          payload,
          secret: WEBHOOK_SECRET
        });

      const response = await fetch(
        `${baseUrl}/webhooks/stripe`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "stripe-signature": signature
          },
          body: payload
        }
      );

      assert.equal(response.status, 200);
      const json = await response.json();
      assert.equal(json.ok, true);
      assert.equal(json.action, "webhook_ignored");
      assert.equal(
        json.reason_code,
        "commercial_webhook_actor_unresolved"
      );
    });
  }
);

test(
  "FULL-UI-04C webhook: a missing STRIPE_WEBHOOK_SECRET/STRIPE_SECRET_KEY configuration fails closed with 503, not a silent 200",
  async () => {
    const previousWebhookSecret =
      process.env.STRIPE_WEBHOOK_SECRET;
    const previousSecretKey =
      process.env.STRIPE_SECRET_KEY;

    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_SECRET_KEY;

    try {
      await withWebhookServer(async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/webhooks/stripe`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: payloadFor(
              "checkout.session.completed"
            )
          }
        );

        assert.equal(response.status, 503);
        const json = await response.json();
        assert.equal(
          json.error,
          "commercial_configuration_missing"
        );
        assert.ok(
          json.missing_configuration.includes(
            "STRIPE_WEBHOOK_SECRET"
          )
        );
        assert.ok(
          json.missing_configuration.includes(
            "STRIPE_SECRET_KEY"
          )
        );
      });
    }
    finally {
      if (previousWebhookSecret === undefined) {
        delete process.env.STRIPE_WEBHOOK_SECRET;
      }
      else {
        process.env.STRIPE_WEBHOOK_SECRET =
          previousWebhookSecret;
      }

      if (previousSecretKey === undefined) {
        delete process.env.STRIPE_SECRET_KEY;
      }
      else {
        process.env.STRIPE_SECRET_KEY =
          previousSecretKey;
      }
    }
  }
);
