// DEV NOTE: S-V1-O-01 status page route - a thin Express transport wrapper
// around v1StatusPageApi.mjs's pure request/response adapter. Public,
// unauthenticated, GET-only. Declares only self-evident facts (this
// handler is executing, so web/api are nominal) - no DB probe, no
// external monitoring call, matching the module's own
// external_monitoring_call_performed: false invariant.

import { Router } from "express";
import crypto from "node:crypto";

import { handleStatusPageApiJson } from "./v1StatusPageApi.mjs";

export const v1StatusPageRouter = Router();

v1StatusPageRouter.get("/status", (_request, response) => {
  const result = handleStatusPageApiJson({
    method: "GET",
    request_id: crypto.randomUUID(),
    requested_at: new Date().toISOString(),
    route: "/status",
    service_state: "nominal",
    component_states: [
      { component_id: "web", component_state: "nominal" },
      { component_id: "api", component_state: "nominal" }
    ]
  });

  response.status(result.status).type("application/json").send(result.body_json);
});
