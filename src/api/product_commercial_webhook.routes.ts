// DEV NOTE: FULL-UI-08 Stripe webhook - the trusted-confirmation counterpart
// to product_commercial.routes.ts's session-authenticated routes. This
// route is unauthenticated by session (Stripe has no product session
// cookie) and instead trusts only a verified Stripe signature. Mounted
// with a raw (non-JSON-parsed) body in src/server.ts, since signature
// verification requires the exact bytes Stripe signed.

import Stripe from "stripe";

import {
  Router,
  type NextFunction,
  type Request,
  type Response
} from "express";

import {
  recordProductCommercialWebhookEvent
} from "./product_commercial_service.js";

export const productCommercialWebhookRouter = Router();

type AsyncHandler = (
  request: Request,
  response: Response,
  next: NextFunction
) => Promise<unknown>;

function asyncHandler(handler: AsyncHandler) {
  return (
    request: Request,
    response: Response,
    next: NextFunction
  ): void => {
    void handler(request, response, next).catch(next);
  };
}

productCommercialWebhookRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const webhookSecret = String(
      process.env.STRIPE_WEBHOOK_SECRET ?? ""
    ).trim();

    const secretKey = String(
      process.env.STRIPE_SECRET_KEY ?? ""
    ).trim();

    if (!webhookSecret || !secretKey) {
      return response.status(503).json({
        error: "commercial_configuration_missing",
        missing_configuration: [
          ...(webhookSecret
            ? []
            : ["STRIPE_WEBHOOK_SECRET"]),
          ...(secretKey
            ? []
            : ["STRIPE_SECRET_KEY"])
        ]
      });
    }

    const signature =
      request.headers["stripe-signature"];

    if (typeof signature !== "string" || !signature) {
      return response.status(400).json({
        error:
          "commercial_webhook_signature_invalid"
      });
    }

    // express.raw() (mounted for this path in server.ts, ahead of the
    // global express.json()) leaves request.body as a Buffer of the exact
    // bytes Stripe signed - required for constructEvent's HMAC check.
    const rawBody = request.body;

    if (!Buffer.isBuffer(rawBody)) {
      return response.status(400).json({
        error:
          "commercial_webhook_signature_invalid"
      });
    }

    let event: Stripe.Event;

    try {
      event = new Stripe(secretKey).webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret
      );
    }
    catch {
      return response.status(400).json({
        error:
          "commercial_webhook_signature_invalid"
      });
    }

    const result =
      await recordProductCommercialWebhookEvent(
        event
      );

    return response.status(200).json(result);
  })
);
