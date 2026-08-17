// Minimal in-process fixture standing in for api.stripe.com so persistent
// integration tests can exercise the real Stripe SDK call path
// (product_commercial_service.ts's stripeClient()) without any real network
// access or a real Stripe account. Only implements the two endpoints that
// code actually calls: creating a Checkout Session and a Billing Portal
// Session. Not a general-purpose Stripe API mock.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

export async function startStripeFixtureServer() {
  const requestLog = [];

  const server = createServer((request, response) => {
    const chunks = [];

    request.on("data", (chunk) => {
      chunks.push(chunk);
    });

    request.on("end", () => {
      const rawBody = Buffer.concat(chunks).toString("utf8");
      const params = new URLSearchParams(rawBody);

      requestLog.push({
        method: request.method,
        url: request.url,
        idempotency_key:
          request.headers["idempotency-key"] || null,
        params: Object.fromEntries(params.entries())
      });

      response.setHeader(
        "Content-Type",
        "application/json"
      );

      if (
        request.method === "POST" &&
        request.url === "/v1/checkout/sessions"
      ) {
        const sessionId =
          `cs_test_${randomUUID().replace(/-/gu, "")}`;
        const customerId =
          `cus_test_${randomUUID().replace(/-/gu, "")}`;

        response.statusCode = 200;
        response.end(
          JSON.stringify({
            id: sessionId,
            object: "checkout.session",
            mode: params.get("mode") || "subscription",
            url:
              `http://${request.headers.host}/fixture-checkout/${sessionId}`,
            customer: customerId,
            client_reference_id:
              params.get("client_reference_id") || null,
            success_url:
              params.get("success_url") || null,
            cancel_url:
              params.get("cancel_url") || null
          })
        );
        return;
      }

      if (
        request.method === "POST" &&
        request.url === "/v1/billing_portal/sessions"
      ) {
        const portalSessionId =
          `bps_test_${randomUUID().replace(/-/gu, "")}`;

        response.statusCode = 200;
        response.end(
          JSON.stringify({
            id: portalSessionId,
            object: "billing_portal.session",
            url:
              `http://${request.headers.host}/fixture-portal/${portalSessionId}`,
            customer: params.get("customer") || null,
            return_url:
              params.get("return_url") || null
          })
        );
        return;
      }

      response.statusCode = 404;
      response.end(
        JSON.stringify({
          error: {
            type: "invalid_request_error",
            message: `stripe fixture: no route for ${request.method} ${request.url}`
          }
        })
      );
    });
  });

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;

  return {
    url,
    requestLog,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
      })
  };
}
