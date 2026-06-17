import { createHash } from "node:crypto";

// DEV NOTE: S-V1-O-02 initialises a factual error-reporting contract only.
// It creates deterministic local configuration and sanitised event envelopes.
// It must not import provider SDKs, call a network transport, import engine code,
// mutate engine output, mutate training flow, or store sensitive payload fields.

export const S_V1_O_02_ERROR_REPORTING_INITIALISATION_VERSION = "1.0.0";
export const ERROR_REPORTING_SURFACE_ID = "error_reporting_initialisation";

export const ERROR_REPORTING_ALLOWED_INPUT_KEYS = Object.freeze([
  "request_id",
  "requested_at",
  "environment",
  "release",
  "enabled",
  "sample_rate",
  "transport",
  "deterministic_probe"
]);

export const ERROR_REPORTING_ALLOWED_EVENT_KEYS = Object.freeze([
  "error_id",
  "occurred_at",
  "event_type",
  "severity",
  "product_surface",
  "message",
  "details",
  "deterministic_probe"
]);

export const ERROR_REPORTING_ALLOWED_ENVIRONMENTS = Object.freeze([
  "local",
  "development",
  "preview",
  "production",
  "test"
]);

export const ERROR_REPORTING_ALLOWED_TRANSPORTS = Object.freeze([
  "disabled",
  "local_stub"
]);

export const ERROR_REPORTING_ALLOWED_EVENT_TYPES = Object.freeze([
  "api_handler_error",
  "ui_render_error",
  "product_runtime_error",
  "product_config_error"
]);

export const ERROR_REPORTING_ALLOWED_SEVERITIES = Object.freeze([
  "info",
  "warning",
  "error",
  "fatal"
]);

export const ERROR_REPORTING_BOUNDARY = Object.freeze({
  observes_product_runtime_errors_only: true,
  configuration_only: true,
  sanitised_event_envelope: true,
  external_provider_enabled: false,
  network_transport_enabled: false,
  provider_call_performed: false,
  error_report_sent: false,
  raw_stack_storage_enabled: false,
  raw_request_body_storage_enabled: false,
  sensitive_payload_storage_enabled: false,
  engine_visible: false,
  engine_truth_changed: false,
  engine_output_mutated: false,
  compile_output_changed: false,
  training_flow_changed: false,
  declaration_truth_changed: false,
  phase1_declaration_changed: false,
  user_facing_claim_language_changed: false
});

const allowedInputKeySet = new Set(ERROR_REPORTING_ALLOWED_INPUT_KEYS);
const allowedEventKeySet = new Set(ERROR_REPORTING_ALLOWED_EVENT_KEYS);
const allowedEnvironmentSet = new Set(ERROR_REPORTING_ALLOWED_ENVIRONMENTS);
const allowedTransportSet = new Set(ERROR_REPORTING_ALLOWED_TRANSPORTS);
const allowedEventTypeSet = new Set(ERROR_REPORTING_ALLOWED_EVENT_TYPES);
const allowedSeveritySet = new Set(ERROR_REPORTING_ALLOWED_SEVERITIES);

const blockedPayloadKeySet = new Set([
  "compile_output",
  "compile_output_changed",
  "declaration_truth",
  "declaration_truth_changed",
  "engine_decision",
  "engine_input",
  "engine_output",
  "engine_output_mutated",
  "engine_truth",
  "engine_truth_changed",
  "phase1_declaration",
  "phase1_declaration_changed",
  "session_event",
  "session_plan",
  "substitution_selection",
  "training_flow",
  "training_flow_changed"
]);

const sensitiveKeySet = new Set([
  "access_token",
  "address",
  "api_key",
  "apikey",
  "authorization",
  "card",
  "cookie",
  "date_of_birth",
  "diagnosis",
  "dob",
  "email",
  "health",
  "injury",
  "jwt",
  "medical",
  "password",
  "payment",
  "phone",
  "refresh_token",
  "secret",
  "session",
  "session_cookie",
  "stripe",
  "token"
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stableValue(item));
  }

  if (isPlainObject(value)) {
    const output = {};
    for (const key of Object.keys(value).sort()) {
      output[key] = stableValue(value[key]);
    }
    return output;
  }

  return value;
}

export function stableErrorReportingJson(value) {
  return JSON.stringify(stableValue(value));
}

export function hashErrorReportingValue(value) {
  return createHash("sha256")
    .update(stableErrorReportingJson(value))
    .digest("hex");
}

function errorResult(code, details = {}) {
  return stableValue({
    ok: false,
    surface_id: ERROR_REPORTING_SURFACE_ID,
    version: S_V1_O_02_ERROR_REPORTING_INITIALISATION_VERSION,
    code,
    details,
    observes_product_runtime_errors_only: true,
    configuration_only: true,
    external_provider_enabled: false,
    network_transport_enabled: false,
    provider_call_performed: false,
    error_report_sent: false,
    raw_stack_storage_enabled: false,
    raw_request_body_storage_enabled: false,
    sensitive_payload_storage_enabled: false,
    engine_visible: false,
    engine_truth_changed: false,
    engine_output_mutated: false,
    compile_output_changed: false,
    training_flow_changed: false,
    declaration_truth_changed: false,
    phase1_declaration_changed: false,
    user_facing_claim_language_changed: false
  });
}

function assertStringField(input, field) {
  if (typeof input[field] !== "string" || input[field].trim() === "") {
    return errorResult("error_reporting_required_string_missing", { field });
  }

  return null;
}

function findUnknownKey(input, allowedKeys) {
  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) {
      return key;
    }
  }

  return null;
}

export function findBlockedErrorReportingPayloadKey(value, path = "$") {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nested = findBlockedErrorReportingPayloadKey(value[index], path + "[" + index + "]");
      if (nested !== null) {
        return nested;
      }
    }

    return null;
  }

  if (!isPlainObject(value)) {
    return null;
  }

  for (const key of Object.keys(value)) {
    if (blockedPayloadKeySet.has(key)) {
      return { key, path: path + "." + key };
    }

    const nested = findBlockedErrorReportingPayloadKey(value[key], path + "." + key);
    if (nested !== null) {
      return nested;
    }
  }

  return null;
}

function redactSensitiveFields(value) {
  if (Array.isArray(value)) {
    let changed = false;
    const items = value.map((item) => {
      const redacted = redactSensitiveFields(item);
      changed = changed || redacted.changed;
      return redacted.value;
    });

    return {
      value: items,
      changed
    };
  }

  if (!isPlainObject(value)) {
    return {
      value,
      changed: false
    };
  }

  let changed = false;
  const output = {};

  for (const key of Object.keys(value).sort()) {
    const normalisedKey = key.toLowerCase().replace(/[^a-z0-9_]/g, "_");

    if (sensitiveKeySet.has(normalisedKey)) {
      output[key] = "[redacted]";
      changed = true;
      continue;
    }

    const redacted = redactSensitiveFields(value[key]);
    output[key] = redacted.value;
    changed = changed || redacted.changed;
  }

  return {
    value: output,
    changed
  };
}

function buildBoundaryPayload(deterministicProbe) {
  return stableValue({
    boundary: ERROR_REPORTING_BOUNDARY,
    deterministic_probe_hash:
      deterministicProbe === undefined ? null : hashErrorReportingValue(deterministicProbe),
    observes_product_runtime_errors_only: true,
    configuration_only: true,
    external_provider_enabled: false,
    network_transport_enabled: false,
    provider_call_performed: false,
    error_report_sent: false,
    raw_stack_storage_enabled: false,
    raw_request_body_storage_enabled: false,
    sensitive_payload_storage_enabled: false,
    engine_visible: false,
    engine_truth_changed: false,
    engine_output_mutated: false,
    compile_output_changed: false,
    training_flow_changed: false,
    declaration_truth_changed: false,
    phase1_declaration_changed: false,
    user_facing_claim_language_changed: false
  });
}

export function initialiseErrorReporting(input = {}) {
  if (!isPlainObject(input)) {
    return errorResult("error_reporting_input_object_required");
  }

  const blocked = findBlockedErrorReportingPayloadKey(input);
  if (blocked !== null) {
    return errorResult("error_reporting_blocked_payload_key", blocked);
  }

  const unknownKey = findUnknownKey(input, allowedInputKeySet);
  if (unknownKey !== null) {
    return errorResult("error_reporting_unknown_input_key", { key: unknownKey });
  }

  for (const field of ["request_id", "requested_at", "environment", "release"]) {
    const missing = assertStringField(input, field);
    if (missing !== null) {
      return missing;
    }
  }

  if (!allowedEnvironmentSet.has(input.environment)) {
    return errorResult("error_reporting_environment_not_allowed", {
      environment: input.environment
    });
  }

  const enabled = input.enabled === undefined ? true : input.enabled;
  if (typeof enabled !== "boolean") {
    return errorResult("error_reporting_enabled_boolean_required");
  }

  const sampleRate = input.sample_rate === undefined ? 1 : input.sample_rate;
  if (typeof sampleRate !== "number" || Number.isNaN(sampleRate) || sampleRate < 0 || sampleRate > 1) {
    return errorResult("error_reporting_sample_rate_invalid", {
      sample_rate: input.sample_rate
    });
  }

  const transport = input.transport ?? "local_stub";
  if (!allowedTransportSet.has(transport)) {
    return errorResult("error_reporting_transport_not_allowed", {
      transport
    });
  }

  const configPayload = stableValue({
    surface_id: ERROR_REPORTING_SURFACE_ID,
    version: S_V1_O_02_ERROR_REPORTING_INITIALISATION_VERSION,
    request: {
      request_id: input.request_id,
      requested_at: input.requested_at
    },
    environment: input.environment,
    release: input.release,
    enabled,
    sample_rate: sampleRate,
    transport,
    event_types: ERROR_REPORTING_ALLOWED_EVENT_TYPES,
    severities: ERROR_REPORTING_ALLOWED_SEVERITIES,
    sensitive_data_policy: {
      redact_known_sensitive_fields: true,
      reject_engine_payload_fields: true,
      store_raw_stack: false,
      store_raw_request_body: false
    },
    ...buildBoundaryPayload(input.deterministic_probe)
  });

  const configHash = hashErrorReportingValue(configPayload);

  return stableValue({
    ok: true,
    error_reporting_config_id: "error_reporting_" + configHash.slice(0, 16),
    config_hash: configHash,
    ...configPayload
  });
}

export function createErrorReportEvent(event = {}) {
  if (!isPlainObject(event)) {
    return errorResult("error_reporting_event_object_required");
  }

  const blocked = findBlockedErrorReportingPayloadKey(event);
  if (blocked !== null) {
    return errorResult("error_reporting_blocked_payload_key", blocked);
  }

  const unknownKey = findUnknownKey(event, allowedEventKeySet);
  if (unknownKey !== null) {
    return errorResult("error_reporting_unknown_event_key", { key: unknownKey });
  }

  for (const field of ["error_id", "occurred_at", "event_type", "severity", "product_surface", "message"]) {
    const missing = assertStringField(event, field);
    if (missing !== null) {
      return missing;
    }
  }

  if (!allowedEventTypeSet.has(event.event_type)) {
    return errorResult("error_reporting_event_type_not_allowed", {
      event_type: event.event_type
    });
  }

  if (!allowedSeveritySet.has(event.severity)) {
    return errorResult("error_reporting_severity_not_allowed", {
      severity: event.severity
    });
  }

  const details = event.details === undefined ? {} : event.details;
  if (!isPlainObject(details)) {
    return errorResult("error_reporting_details_object_required");
  }

  const redacted = redactSensitiveFields(details);

  const eventPayload = stableValue({
    surface_id: ERROR_REPORTING_SURFACE_ID,
    version: S_V1_O_02_ERROR_REPORTING_INITIALISATION_VERSION,
    event: {
      error_id: event.error_id,
      occurred_at: event.occurred_at,
      event_type: event.event_type,
      severity: event.severity,
      product_surface: event.product_surface,
      message: event.message,
      details: redacted.value,
      sensitive_fields_redacted: redacted.changed
    },
    ...buildBoundaryPayload(event.deterministic_probe)
  });

  const eventHash = hashErrorReportingValue(eventPayload);

  return stableValue({
    ok: true,
    error_report_event_id: "error_event_" + eventHash.slice(0, 16),
    event_hash: eventHash,
    ...eventPayload
  });
}

export function assertErrorReportingDoesNotMutateEngine(result) {
  if (!isPlainObject(result)) {
    return {
      ok: false,
      code: "error_reporting_result_object_required"
    };
  }

  const checks = {
    observes_product_runtime_errors_only: result.observes_product_runtime_errors_only === true,
    external_provider_enabled: result.external_provider_enabled === false,
    network_transport_enabled: result.network_transport_enabled === false,
    provider_call_performed: result.provider_call_performed === false,
    error_report_sent: result.error_report_sent === false,
    raw_stack_storage_enabled: result.raw_stack_storage_enabled === false,
    raw_request_body_storage_enabled: result.raw_request_body_storage_enabled === false,
    sensitive_payload_storage_enabled: result.sensitive_payload_storage_enabled === false,
    engine_visible: result.engine_visible === false,
    engine_truth_changed: result.engine_truth_changed === false,
    engine_output_mutated: result.engine_output_mutated === false,
    compile_output_changed: result.compile_output_changed === false,
    training_flow_changed: result.training_flow_changed === false,
    declaration_truth_changed: result.declaration_truth_changed === false,
    phase1_declaration_changed: result.phase1_declaration_changed === false,
    user_facing_claim_language_changed: result.user_facing_claim_language_changed === false
  };

  return stableValue({
    ok: Object.values(checks).every(Boolean),
    checks
  });
}

export function serializeErrorReportingInitialisation(value) {
  return stableErrorReportingJson(value);
}