import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ERROR_REPORTING_BOUNDARY,
  assertErrorReportingDoesNotMutateEngine,
  createErrorReportEvent,
  hashErrorReportingValue,
  initialiseErrorReporting,
  serializeErrorReportingInitialisation
} from "../src/v1ErrorReportingInitialisation.mjs";

const deterministicProbe = Object.freeze({
  canonical_input_hash: "a".repeat(64),
  compile_output_hash: "b".repeat(64),
  declaration_record_hash: "c".repeat(64)
});

function validConfig(overrides = {}) {
  return {
    request_id: "error_reporting_req_001",
    requested_at: "2026-06-17T16:00:00.000Z",
    environment: "preview",
    release: "v1-controlled-launch",
    enabled: true,
    sample_rate: 1,
    transport: "local_stub",
    deterministic_probe: deterministicProbe,
    ...overrides
  };
}

function validEvent(overrides = {}) {
  return {
    error_id: "error_001",
    occurred_at: "2026-06-17T16:01:00.000Z",
    event_type: "api_handler_error",
    severity: "error",
    product_surface: "controlled_launch_api",
    message: "API handler returned an unexpected status.",
    details: {
      route: "/status",
      status_code: 500,
      email: "athlete@example.test",
      nested: {
        token: "secret-token",
        component: "status"
      }
    },
    deterministic_probe: deterministicProbe,
    ...overrides
  };
}

function assertNoEngineMutation(result) {
  assert.equal(result.observes_product_runtime_errors_only, true);
  assert.equal(result.external_provider_enabled, false);
  assert.equal(result.network_transport_enabled, false);
  assert.equal(result.provider_call_performed, false);
  assert.equal(result.error_report_sent, false);
  assert.equal(result.raw_stack_storage_enabled, false);
  assert.equal(result.raw_request_body_storage_enabled, false);
  assert.equal(result.sensitive_payload_storage_enabled, false);
  assert.equal(result.engine_visible, false);
  assert.equal(result.engine_truth_changed, false);
  assert.equal(result.engine_output_mutated, false);
  assert.equal(result.compile_output_changed, false);
  assert.equal(result.training_flow_changed, false);
  assert.equal(result.declaration_truth_changed, false);
  assert.equal(result.phase1_declaration_changed, false);
  assert.equal(result.user_facing_claim_language_changed, false);

  const isolation = assertErrorReportingDoesNotMutateEngine(result);
  assert.equal(isolation.ok, true);
}

test("S-V1-O-02 config test initialises local factual error reporting only", () => {
  const result = initialiseErrorReporting(validConfig());

  assert.equal(result.ok, true);
  assert.equal(result.surface_id, "error_reporting_initialisation");
  assert.equal(result.environment, "preview");
  assert.equal(result.release, "v1-controlled-launch");
  assert.equal(result.enabled, true);
  assert.equal(result.transport, "local_stub");
  assert.equal(result.sample_rate, 1);
  assert.equal(result.sensitive_data_policy.redact_known_sensitive_fields, true);
  assert.equal(result.sensitive_data_policy.reject_engine_payload_fields, true);
  assert.equal(result.sensitive_data_policy.store_raw_stack, false);
  assert.equal(result.sensitive_data_policy.store_raw_request_body, false);
  assert.equal(result.deterministic_probe_hash, hashErrorReportingValue(deterministicProbe));
  assert.match(result.error_reporting_config_id, /^error_reporting_[a-f0-9]{16}$/);
  assert.match(result.config_hash, /^[a-f0-9]{64}$/);

  assertNoEngineMutation(result);
});

test("S-V1-O-02 event test records sanitised product runtime error envelope only", () => {
  const result = createErrorReportEvent(validEvent());

  assert.equal(result.ok, true);
  assert.equal(result.surface_id, "error_reporting_initialisation");
  assert.equal(result.event.error_id, "error_001");
  assert.equal(result.event.event_type, "api_handler_error");
  assert.equal(result.event.severity, "error");
  assert.equal(result.event.product_surface, "controlled_launch_api");
  assert.equal(result.event.details.route, "/status");
  assert.equal(result.event.details.status_code, 500);
  assert.equal(result.event.details.email, "[redacted]");
  assert.equal(result.event.details.nested.token, "[redacted]");
  assert.equal(result.event.details.nested.component, "status");
  assert.equal(result.event.sensitive_fields_redacted, true);
  assert.match(result.error_report_event_id, /^error_event_[a-f0-9]{16}$/);
  assert.match(result.event_hash, /^[a-f0-9]{64}$/);

  assertNoEngineMutation(result);
});

test("S-V1-O-02 no-coupling test rejects engine output training flow and declaration payloads", () => {
  const blockedConfig = initialiseErrorReporting(validConfig({
    deterministic_probe: {
      canonical_input_hash: "a".repeat(64),
      engine_output_mutated: true
    }
  }));

  assert.equal(blockedConfig.ok, false);
  assert.equal(blockedConfig.code, "error_reporting_blocked_payload_key");
  assert.equal(blockedConfig.details.key, "engine_output_mutated");
  assertNoEngineMutation(blockedConfig);

  const blockedEvent = createErrorReportEvent(validEvent({
    details: {
      route: "/sessions",
      engine_output: {
        changed: true
      }
    }
  }));

  assert.equal(blockedEvent.ok, false);
  assert.equal(blockedEvent.code, "error_reporting_blocked_payload_key");
  assert.equal(blockedEvent.details.key, "engine_output");
  assertNoEngineMutation(blockedEvent);

  const blockedDeclaration = createErrorReportEvent(validEvent({
    details: {
      declaration_truth: {
        changed: true
      }
    }
  }));

  assert.equal(blockedDeclaration.ok, false);
  assert.equal(blockedDeclaration.code, "error_reporting_blocked_payload_key");
  assert.equal(blockedDeclaration.details.key, "declaration_truth");
  assertNoEngineMutation(blockedDeclaration);
});

test("S-V1-O-02 config validation rejects provider and out-of-range sampling", () => {
  const provider = initialiseErrorReporting(validConfig({
    transport: "provider_sdk"
  }));

  assert.equal(provider.ok, false);
  assert.equal(provider.code, "error_reporting_transport_not_allowed");
  assertNoEngineMutation(provider);

  const sample = initialiseErrorReporting(validConfig({
    sample_rate: 1.5
  }));

  assert.equal(sample.ok, false);
  assert.equal(sample.code, "error_reporting_sample_rate_invalid");
  assertNoEngineMutation(sample);
});

test("S-V1-O-02 event validation accepts only declared product runtime event classes", () => {
  const eventType = createErrorReportEvent(validEvent({
    event_type: "engine_output_error"
  }));

  assert.equal(eventType.ok, false);
  assert.equal(eventType.code, "error_reporting_event_type_not_allowed");
  assertNoEngineMutation(eventType);

  const severity = createErrorReportEvent(validEvent({
    severity: "critical"
  }));

  assert.equal(severity.ok, false);
  assert.equal(severity.code, "error_reporting_severity_not_allowed");
  assertNoEngineMutation(severity);
});

test("S-V1-O-02 serialisation is stable", () => {
  const result = createErrorReportEvent(validEvent());
  const serialised = serializeErrorReportingInitialisation(result);
  const parsed = JSON.parse(serialised);

  assert.equal(parsed.event_hash, result.event_hash);
  assert.deepEqual(parsed.event.details, result.event.details);
});

test("S-V1-O-02 docs document sensitive data boundary and no mutation boundary", () => {
  const doc = readFileSync("docs/v1/V1_ERROR_REPORTING_INITIALISATION.md", "utf8");

  assert.ok(doc.includes("S-V1-O-02"));
  assert.ok(doc.includes("Error reporting observes product/runtime errors only."));
  assert.ok(doc.includes("No engine output mutation."));
  assert.ok(doc.includes("Sensitive data boundaries are documented."));
  assert.ok(doc.includes("CI_V1_ERROR_REPORTING_INITIALISATION"));
});

test("S-V1-O-02 boundary object is explicit and closed to provider calls and engine mutation", () => {
  assert.equal(ERROR_REPORTING_BOUNDARY.observes_product_runtime_errors_only, true);
  assert.equal(ERROR_REPORTING_BOUNDARY.configuration_only, true);
  assert.equal(ERROR_REPORTING_BOUNDARY.sanitised_event_envelope, true);
  assert.equal(ERROR_REPORTING_BOUNDARY.external_provider_enabled, false);
  assert.equal(ERROR_REPORTING_BOUNDARY.network_transport_enabled, false);
  assert.equal(ERROR_REPORTING_BOUNDARY.provider_call_performed, false);
  assert.equal(ERROR_REPORTING_BOUNDARY.error_report_sent, false);
  assert.equal(ERROR_REPORTING_BOUNDARY.raw_stack_storage_enabled, false);
  assert.equal(ERROR_REPORTING_BOUNDARY.raw_request_body_storage_enabled, false);
  assert.equal(ERROR_REPORTING_BOUNDARY.sensitive_payload_storage_enabled, false);
  assert.equal(ERROR_REPORTING_BOUNDARY.engine_visible, false);
  assert.equal(ERROR_REPORTING_BOUNDARY.engine_truth_changed, false);
  assert.equal(ERROR_REPORTING_BOUNDARY.engine_output_mutated, false);
  assert.equal(ERROR_REPORTING_BOUNDARY.compile_output_changed, false);
  assert.equal(ERROR_REPORTING_BOUNDARY.training_flow_changed, false);
  assert.equal(ERROR_REPORTING_BOUNDARY.declaration_truth_changed, false);
  assert.equal(ERROR_REPORTING_BOUNDARY.phase1_declaration_changed, false);
  assert.equal(ERROR_REPORTING_BOUNDARY.user_facing_claim_language_changed, false);
});