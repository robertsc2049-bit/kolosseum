// DEV NOTE: FULL-UI-08 + LAUNCH-04 Stripe webhook - trusted provider
// confirmation. This route is unauthenticated by product session and trusts
// only the exact raw request body after Stripe signature verification.

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

import {
  publicLaunchBillingEnabled,
  recordPublicLaunchBillingWebhookEvent
} from "./public_launch_billing_service.js";

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

    const signature = request.headers["stripe-signature"];

    if (typeof signature !== "string" || !signature) {
      return response.status(400).json({
        error: "commercial_webhook_signature_invalid"
      });
    }

    const rawBody = request.body;

    if (!Buffer.isBuffer(rawBody)) {
      return response.status(400).json({
        error: "commercial_webhook_signature_invalid"
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
        error: "commercial_webhook_signature_invalid"
      });
    }

    if (publicLaunchBillingEnabled()) {
      const publicResult = await recordPublicLaunchBillingWebhookEvent(event);

      if (publicResult.handled) {
        return response.status(200).json(publicResult.result);
      }
    }

    const result = await recordProductCommercialWebhookEvent(event);

    return response.status(200).json(result);
  })
);
