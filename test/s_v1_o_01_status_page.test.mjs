import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  STATUS_PAGE_BOUNDARY,
  assertStatusPageDoesNotAlterEngine,
  hashStatusPageValue,
  renderStatusPage,
  serializeStatusPage
} from "../src/v1StatusPage.mjs";
import {
  handleStatusPageApiRequest
} from "../src/api/v1StatusPageApi.mjs";

const deterministicProbe = Object.freeze({
  canonical_input_hash: "a".repeat(64),
  compile_output_hash: "b".repeat(64),
  declaration_record_hash: "c".repeat(64)
});

function validStatusPage(overrides = {}) {
  return {
    request_id: "status_page_req_001",
    requested_at: "2026-06-17T15:00:00.000Z",
    route: "/status",
    service_state: "nominal",
    uptime_window_minutes: 60,
    component_states: [
      {
        component_id: "web",
        component_state: "nominal"
      },
      {
        component_id: "api",
        component_state: "nominal"
      },
      {
        component_id: "database",
        component_state: "nominal"
      }
    ],
    incident_records: [],
    deterministic_probe: deterministicProbe,
    ...overrides
  };
}

function assertNoEngineChange(result) {
  assert.equal(result.service_state_only, true);
  assert.equal(result.engine_visible, false);
  assert.equal(result.engine_truth_changed, false);
  assert.equal(result.compile_output_changed, false);
  assert.equal(result.training_flow_changed, false);
  assert.equal(result.declaration_truth_changed, false);
  assert.equal(result.user_safety_claim, false);
  assert.equal(result.user_readiness_claim, false);
  assert.equal(result.training_effectiveness_claim, false);
  assert.equal(result.service_readiness_claim, false);
  assert.equal(result.service_reliability_guarantee, false);

  const isolation = assertStatusPageDoesNotAlterEngine(result);
  assert.equal(isolation.ok, true);
}

test("S-V1-O-01 status render test returns factual public status view model", () => {
  const result = renderStatusPage(validStatusPage());

  assert.equal(result.ok, true);
  assert.equal(result.surface_id, "public_status_page");
  assert.equal(result.route, "/status");
  assert.equal(result.renderable, true);
  assert.equal(result.document_class, "public_status");
  assert.equal(result.service_state, "nominal");
  assert.equal(result.uptime_indicator.indicator_kind, "service_state_indicator");
  assert.equal(result.uptime_indicator.service_state, "nominal");
  assert.equal(result.uptime_indicator.observed_window_minutes, 60);
  assert.equal(result.uptime_indicator.component_count, 3);
  assert.equal(result.uptime_indicator.open_incident_count, 0);
  assert.equal(result.uptime_indicator.claim_boundary, "service_state_only");
  assert.equal(result.deterministic_probe_hash, hashStatusPageValue(deterministicProbe));
  assert.match(result.status_page_hash, /^[a-f0-9]{64}$/);

  assertNoEngineChange(result);
});

test("S-V1-O-01 uptime indicator reports component counts and incidents only", () => {
  const result = renderStatusPage(validStatusPage({
    service_state: "degraded",
    uptime_window_minutes: 1440,
    component_states: [
      {
        component_id: "web",
        component_state: "nominal"
      },
      {
        component_id: "api",
        component_state: "degraded"
      },
      {
        component_id: "database",
        component_state: "unknown"
      }
    ],
    incident_records: [
      {
        incident_id: "incident_001",
        incident_state: "identified",
        message: "API response times are above the current baseline.",
        updated_at: "2026-06-17T15:05:00.000Z"
      },
      {
        incident_id: "incident_002",
        incident_state: "closed",
        message: "Billing page response restored to the prior baseline.",
        updated_at: "2026-06-17T14:05:00.000Z"
      }
    ]
  }));

  assert.equal(result.ok, true);
  assert.equal(result.service_state, "degraded");
  assert.equal(result.uptime_indicator.observed_window_minutes, 1440);
  assert.equal(result.uptime_indicator.component_counts.nominal, 1);
  assert.equal(result.uptime_indicator.component_counts.degraded, 1);
  assert.equal(result.uptime_indicator.component_counts.unknown, 1);
  assert.equal(result.uptime_indicator.open_incident_count, 1);

  assertNoEngineChange(result);
});

test("S-V1-O-01 status page rejects route and state outside declared status boundary", () => {
  const badRoute = renderStatusPage(validStatusPage({
    route: "/health"
  }));

  assert.equal(badRoute.ok, false);
  assert.equal(badRoute.code, "status_page_route_not_allowed");
  assert.equal(badRoute.renderable, false);
  assertNoEngineChange(badRoute);

  const badState = renderStatusPage(validStatusPage({
    service_state: "launch_ready"
  }));

  assert.equal(badState.ok, false);
  assert.equal(badState.code, "status_page_service_state_not_allowed");
  assertNoEngineChange(badState);
});

test("S-V1-O-01 no-coupling test blocks engine training and declaration mutation fields", () => {
  const blockedProbe = renderStatusPage(validStatusPage({
    deterministic_probe: {
      canonical_input_hash: "a".repeat(64),
      engine_truth_changed: true
    }
  }));

  assert.equal(blockedProbe.ok, false);
  assert.equal(blockedProbe.code, "status_page_blocked_payload_key");
  assert.equal(blockedProbe.details.key, "engine_truth_changed");
  assertNoEngineChange(blockedProbe);

  const blockedTopLevel = renderStatusPage({
    ...validStatusPage(),
    training_flow_changed: true
  });

  assert.equal(blockedTopLevel.ok, false);
  assert.equal(blockedTopLevel.code, "status_page_blocked_payload_key");
  assert.equal(blockedTopLevel.details.key, "training_flow_changed");
  assertNoEngineChange(blockedTopLevel);
});

test("S-V1-O-01 copy lint blocks safety readiness and training-effect claims in input text", () => {
  const safetyClaim = renderStatusPage(validStatusPage({
    incident_records: [
      {
        incident_id: "incident_claim_001",
        incident_state: "identified",
        message: "The service is safe for athlete use.",
        updated_at: "2026-06-17T15:05:00.000Z"
      }
    ]
  }));

  assert.equal(safetyClaim.ok, false);
  assert.equal(safetyClaim.code, "status_page_forbidden_claim_text");
  assert.equal(safetyClaim.details.term, "safe");
  assertNoEngineChange(safetyClaim);

  const effectClaim = renderStatusPage(validStatusPage({
    incident_records: [
      {
        incident_id: "incident_claim_002",
        incident_state: "identified",
        message: "Training effectiveness is improved.",
        updated_at: "2026-06-17T15:05:00.000Z"
      }
    ]
  }));

  assert.equal(effectClaim.ok, false);
  assert.equal(effectClaim.code, "status_page_forbidden_claim_text");
  assert.equal(effectClaim.details.term, "effective");
  assertNoEngineChange(effectClaim);
});

test("S-V1-O-01 API renders status route and rejects non-GET methods", () => {
  const response = handleStatusPageApiRequest({
    method: "GET",
    path: "/status",
    request_id: "status_api_req_001",
    requested_at: "2026-06-17T15:00:00.000Z",
    service_state: "maintenance",
    uptime_window_minutes: 120,
    component_states: [
      {
        component_id: "web",
        component_state: "maintenance"
      }
    ],
    deterministic_probe: deterministicProbe
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.api_surface_id, "public_status_page_api");
  assert.equal(response.body.ok, true);
  assert.equal(response.body.service_state, "maintenance");
  assert.equal(response.body.uptime_indicator.observed_window_minutes, 120);
  assertNoEngineChange(response.body);

  const blocked = handleStatusPageApiRequest({
    method: "POST"
  });

  assert.equal(blocked.status, 405);
  assert.equal(blocked.body.ok, false);
  assert.equal(blocked.body.renderable, false);
  assertNoEngineChange(blocked.body);
});

test("S-V1-O-01 serialisation is stable and public copy stays factual", () => {
  const result = renderStatusPage(validStatusPage());
  const serialised = serializeStatusPage(result);
  const parsed = JSON.parse(serialised);

  assert.equal(parsed.status_page_hash, result.status_page_hash);

  const copy = JSON.parse(readFileSync("copy/status_page_copy.json", "utf8"));
  const copyText = JSON.stringify(copy).toLowerCase();

  assert.equal(copy.surface_id, "public_status_page");
  assert.equal(copy.entries["status_page.title"], "Service status");
  assert.equal(copy.entries["status_page.no_engine_change"], "Status information does not change training output.");

  for (const blocked of [
    "recommend",
    "recommended",
    "optimise",
    "optimize",
    "ready",
    "readiness",
    "safe",
    "safety",
    "effective",
    "effectiveness",
    "suitable",
    "approved",
    "cleared",
    "guarantee",
    "guaranteed",
    "reliable",
    "risk score",
    "fit for duty"
  ]) {
    assert.equal(copyText.includes(blocked), false, "copy must not include " + blocked);
  }
});

test("S-V1-O-01 boundary object is explicit and closed to claims and engine mutation", () => {
  assert.equal(STATUS_PAGE_BOUNDARY.service_state_only, true);
  assert.equal(STATUS_PAGE_BOUNDARY.public_status_surface, true);
  assert.equal(STATUS_PAGE_BOUNDARY.uptime_indicator, true);
  assert.equal(STATUS_PAGE_BOUNDARY.engine_visible, false);
  assert.equal(STATUS_PAGE_BOUNDARY.engine_truth_changed, false);
  assert.equal(STATUS_PAGE_BOUNDARY.compile_output_changed, false);
  assert.equal(STATUS_PAGE_BOUNDARY.training_flow_changed, false);
  assert.equal(STATUS_PAGE_BOUNDARY.declaration_truth_changed, false);
  assert.equal(STATUS_PAGE_BOUNDARY.user_safety_claim, false);
  assert.equal(STATUS_PAGE_BOUNDARY.user_readiness_claim, false);
  assert.equal(STATUS_PAGE_BOUNDARY.training_effectiveness_claim, false);
  assert.equal(STATUS_PAGE_BOUNDARY.service_readiness_claim, false);
  assert.equal(STATUS_PAGE_BOUNDARY.service_reliability_guarantee, false);
  assert.equal(STATUS_PAGE_BOUNDARY.provider_call_performed, false);
  assert.equal(STATUS_PAGE_BOUNDARY.external_monitoring_call_performed, false);
});