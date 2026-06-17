import { createHash } from "node:crypto";

// DEV NOTE: S-V1-O-01 creates a public service-status view model only.
// It reports declared service-state facts and an uptime indicator from explicit
// input. It must not import engine code, mutate engine truth, make user safety
// claims, make training-effect claims, or imply service readiness.

export const S_V1_O_01_STATUS_PAGE_VERSION = "1.0.0";
export const STATUS_PAGE_SURFACE_ID = "public_status_page";

export const STATUS_PAGE_ROUTE = "/status";

export const STATUS_PAGE_ALLOWED_INPUT_KEYS = Object.freeze([
  "request_id",
  "requested_at",
  "route",
  "service_state",
  "uptime_window_minutes",
  "component_states",
  "incident_records",
  "deterministic_probe"
]);

export const STATUS_PAGE_ALLOWED_SERVICE_STATES = Object.freeze([
  "nominal",
  "degraded",
  "maintenance",
  "interruption",
  "unknown"
]);

export const STATUS_PAGE_ALLOWED_COMPONENT_IDS = Object.freeze([
  "web",
  "api",
  "auth",
  "database",
  "billing",
  "export",
  "session_execution"
]);

export const STATUS_PAGE_ALLOWED_COMPONENT_STATES = Object.freeze([
  "nominal",
  "degraded",
  "maintenance",
  "interruption",
  "unknown"
]);

export const STATUS_PAGE_ALLOWED_INCIDENT_STATES = Object.freeze([
  "investigating",
  "identified",
  "watching",
  "closed"
]);

export const STATUS_PAGE_COPY_IDS = Object.freeze([
  "status_page.title",
  "status_page.notice",
  "status_page.service_state",
  "status_page.uptime_indicator",
  "status_page.incidents",
  "status_page.no_engine_change"
]);

export const STATUS_PAGE_BOUNDARY = Object.freeze({
  service_state_only: true,
  public_status_surface: true,
  uptime_indicator: true,
  engine_visible: false,
  engine_truth_changed: false,
  compile_output_changed: false,
  training_flow_changed: false,
  declaration_truth_changed: false,
  user_safety_claim: false,
  user_readiness_claim: false,
  training_effectiveness_claim: false,
  service_readiness_claim: false,
  service_reliability_guarantee: false,
  provider_call_performed: false,
  external_monitoring_call_performed: false
});

const allowedInputKeySet = new Set(STATUS_PAGE_ALLOWED_INPUT_KEYS);
const allowedServiceStateSet = new Set(STATUS_PAGE_ALLOWED_SERVICE_STATES);
const allowedComponentIdSet = new Set(STATUS_PAGE_ALLOWED_COMPONENT_IDS);
const allowedComponentStateSet = new Set(STATUS_PAGE_ALLOWED_COMPONENT_STATES);
const allowedIncidentStateSet = new Set(STATUS_PAGE_ALLOWED_INCIDENT_STATES);

const blockedPayloadKeySet = new Set([
  "compile_output",
  "compile_output_changed",
  "declaration_truth",
  "declaration_truth_changed",
  "engine_decision",
  "engine_input",
  "engine_output",
  "engine_truth",
  "engine_truth_changed",
  "fitness_for_duty",
  "readiness",
  "readiness_claim",
  "safety_claim",
  "session_plan",
  "service_readiness_claim",
  "substitution_selection",
  "training_effectiveness_claim",
  "training_flow",
  "training_flow_changed",
  "user_readiness_claim",
  "user_safety_claim"
]);

const forbiddenTextTerms = Object.freeze([
  "safe",
  "safety",
  "readiness",
  "ready",
  "effective",
  "effectiveness",
  "guarantee",
  "guaranteed",
  "reliable",
  "certified",
  "approved",
  "cleared",
  "fit for duty",
  "return to play"
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

export function stableStatusPageJson(value) {
  return JSON.stringify(stableValue(value));
}

export function hashStatusPageValue(value) {
  return createHash("sha256")
    .update(stableStatusPageJson(value))
    .digest("hex");
}

function errorResult(code, details = {}) {
  return stableValue({
    ok: false,
    surface_id: STATUS_PAGE_SURFACE_ID,
    version: S_V1_O_01_STATUS_PAGE_VERSION,
    code,
    details,
    copy_id: "status_page.notice",
    renderable: false,
    service_state_only: true,
    engine_visible: false,
    engine_truth_changed: false,
    compile_output_changed: false,
    training_flow_changed: false,
    declaration_truth_changed: false,
    user_safety_claim: false,
    user_readiness_claim: false,
    training_effectiveness_claim: false,
    service_readiness_claim: false,
    service_reliability_guarantee: false,
    provider_call_performed: false,
    external_monitoring_call_performed: false
  });
}

function assertStringField(input, field) {
  if (typeof input[field] !== "string" || input[field].trim() === "") {
    return errorResult("status_page_required_string_missing", { field });
  }

  return null;
}

function findUnknownInputKey(input) {
  for (const key of Object.keys(input)) {
    if (!allowedInputKeySet.has(key)) {
      return key;
    }
  }

  return null;
}

export function findBlockedStatusPagePayloadKey(value, path = "$") {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nested = findBlockedStatusPagePayloadKey(value[index], path + "[" + index + "]");
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

    const nested = findBlockedStatusPagePayloadKey(value[key], path + "." + key);
    if (nested !== null) {
      return nested;
    }
  }

  return null;
}

function findForbiddenClaimText(value, path = "$") {
  if (typeof value === "string") {
    const lower = value.toLowerCase();

    for (const term of forbiddenTextTerms) {
      if (lower.includes(term)) {
        return { term, path };
      }
    }

    return null;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nested = findForbiddenClaimText(value[index], path + "[" + index + "]");
      if (nested !== null) {
        return nested;
      }
    }

    return null;
  }

  if (isPlainObject(value)) {
    for (const key of Object.keys(value)) {
      const nested = findForbiddenClaimText(value[key], path + "." + key);
      if (nested !== null) {
        return nested;
      }
    }
  }

  return null;
}

function normaliseUptimeWindowMinutes(value) {
  if (value === undefined || value === null) {
    return 60;
  }

  if (!Number.isInteger(value) || value <= 0 || value > 43200) {
    return null;
  }

  return value;
}

function normaliseComponentStates(componentStates) {
  if (componentStates === undefined) {
    return {
      ok: true,
      records: STATUS_PAGE_ALLOWED_COMPONENT_IDS.map((component_id) => stableValue({
        component_id,
        component_state: "unknown",
        state_source: "not_reported"
      }))
    };
  }

  if (!Array.isArray(componentStates)) {
    return errorResult("status_page_component_states_array_required");
  }

  const seen = new Set();
  const records = [];

  for (let index = 0; index < componentStates.length; index += 1) {
    const record = componentStates[index];

    if (!isPlainObject(record)) {
      return errorResult("status_page_component_record_invalid", { index });
    }

    const blocked = findBlockedStatusPagePayloadKey(record, "$.component_states[" + index + "]");
    if (blocked !== null) {
      return errorResult("status_page_blocked_payload_key", blocked);
    }

    const claimText = findForbiddenClaimText(record, "$.component_states[" + index + "]");
    if (claimText !== null) {
      return errorResult("status_page_forbidden_claim_text", claimText);
    }

    if (typeof record.component_id !== "string" || !allowedComponentIdSet.has(record.component_id)) {
      return errorResult("status_page_component_id_not_allowed", {
        index,
        component_id: record.component_id
      });
    }

    if (seen.has(record.component_id)) {
      return errorResult("status_page_duplicate_component_id", {
        component_id: record.component_id
      });
    }

    seen.add(record.component_id);

    if (typeof record.component_state !== "string" || !allowedComponentStateSet.has(record.component_state)) {
      return errorResult("status_page_component_state_not_allowed", {
        index,
        component_state: record.component_state
      });
    }

    records.push(stableValue({
      component_id: record.component_id,
      component_state: record.component_state,
      state_source: "declared_status_input"
    }));
  }

  records.sort((left, right) => left.component_id.localeCompare(right.component_id));

  return { ok: true, records };
}

function normaliseIncidentRecords(incidentRecords) {
  if (incidentRecords === undefined) {
    return { ok: true, records: [] };
  }

  if (!Array.isArray(incidentRecords)) {
    return errorResult("status_page_incident_records_array_required");
  }

  const records = [];

  for (let index = 0; index < incidentRecords.length; index += 1) {
    const incident = incidentRecords[index];

    if (!isPlainObject(incident)) {
      return errorResult("status_page_incident_record_invalid", { index });
    }

    const blocked = findBlockedStatusPagePayloadKey(incident, "$.incident_records[" + index + "]");
    if (blocked !== null) {
      return errorResult("status_page_blocked_payload_key", blocked);
    }

    const claimText = findForbiddenClaimText(incident, "$.incident_records[" + index + "]");
    if (claimText !== null) {
      return errorResult("status_page_forbidden_claim_text", claimText);
    }

    for (const field of ["incident_id", "incident_state", "message", "updated_at"]) {
      if (typeof incident[field] !== "string" || incident[field].trim() === "") {
        return errorResult("status_page_incident_required_string_missing", {
          index,
          field
        });
      }
    }

    if (!allowedIncidentStateSet.has(incident.incident_state)) {
      return errorResult("status_page_incident_state_not_allowed", {
        index,
        incident_state: incident.incident_state
      });
    }

    records.push(stableValue({
      incident_id: incident.incident_id,
      incident_state: incident.incident_state,
      message: incident.message,
      updated_at: incident.updated_at
    }));
  }

  records.sort((left, right) => {
    const byUpdated = left.updated_at.localeCompare(right.updated_at);
    if (byUpdated !== 0) {
      return byUpdated;
    }

    return left.incident_id.localeCompare(right.incident_id);
  });

  return { ok: true, records };
}

function buildUptimeIndicator(serviceState, uptimeWindowMinutes, componentRecords, incidentRecords) {
  const componentCounts = Object.freeze({
    nominal: componentRecords.filter((record) => record.component_state === "nominal").length,
    degraded: componentRecords.filter((record) => record.component_state === "degraded").length,
    maintenance: componentRecords.filter((record) => record.component_state === "maintenance").length,
    interruption: componentRecords.filter((record) => record.component_state === "interruption").length,
    unknown: componentRecords.filter((record) => record.component_state === "unknown").length
  });

  return stableValue({
    indicator_kind: "service_state_indicator",
    service_state: serviceState,
    observed_window_minutes: uptimeWindowMinutes,
    component_count: componentRecords.length,
    component_counts: componentCounts,
    open_incident_count: incidentRecords.filter((incident) => incident.incident_state !== "closed").length,
    claim_boundary: "service_state_only"
  });
}

function buildBoundaryPayload(deterministicProbe) {
  return stableValue({
    boundary: STATUS_PAGE_BOUNDARY,
    deterministic_probe_hash:
      deterministicProbe === undefined ? null : hashStatusPageValue(deterministicProbe),
    service_state_only: true,
    engine_visible: false,
    engine_truth_changed: false,
    compile_output_changed: false,
    training_flow_changed: false,
    declaration_truth_changed: false,
    user_safety_claim: false,
    user_readiness_claim: false,
    training_effectiveness_claim: false,
    service_readiness_claim: false,
    service_reliability_guarantee: false,
    provider_call_performed: false,
    external_monitoring_call_performed: false
  });
}

export function renderStatusPage(input = {}) {
  if (!isPlainObject(input)) {
    return errorResult("status_page_input_object_required");
  }

  const blocked = findBlockedStatusPagePayloadKey(input);
  if (blocked !== null) {
    return errorResult("status_page_blocked_payload_key", blocked);
  }

  const unknownKey = findUnknownInputKey(input);
  if (unknownKey !== null) {
    return errorResult("status_page_unknown_input_key", { key: unknownKey });
  }

  const route = input.route ?? STATUS_PAGE_ROUTE;
  if (route !== STATUS_PAGE_ROUTE) {
    return errorResult("status_page_route_not_allowed", { route });
  }

  for (const field of ["request_id", "requested_at", "service_state"]) {
    const missing = assertStringField(input, field);
    if (missing !== null) {
      return missing;
    }
  }

  if (!allowedServiceStateSet.has(input.service_state)) {
    return errorResult("status_page_service_state_not_allowed", {
      service_state: input.service_state
    });
  }

  const uptimeWindowMinutes = normaliseUptimeWindowMinutes(input.uptime_window_minutes);
  if (uptimeWindowMinutes === null) {
    return errorResult("status_page_uptime_window_invalid", {
      uptime_window_minutes: input.uptime_window_minutes
    });
  }

  const components = normaliseComponentStates(input.component_states);
  if (components.ok !== true) {
    return components;
  }

  const incidents = normaliseIncidentRecords(input.incident_records);
  if (incidents.ok !== true) {
    return incidents;
  }

  const boundaryPayload = buildBoundaryPayload(input.deterministic_probe);
  const pagePayload = stableValue({
    surface_id: STATUS_PAGE_SURFACE_ID,
    version: S_V1_O_01_STATUS_PAGE_VERSION,
    route,
    renderable: true,
    document_class: "public_status",
    request: {
      request_id: input.request_id,
      requested_at: input.requested_at
    },
    title_copy_id: "status_page.title",
    notice_copy_id: "status_page.notice",
    service_state_copy_id: "status_page.service_state",
    uptime_indicator_copy_id: "status_page.uptime_indicator",
    incidents_copy_id: "status_page.incidents",
    copy_notice_id: "status_page.no_engine_change",
    service_state: input.service_state,
    uptime_indicator: buildUptimeIndicator(
      input.service_state,
      uptimeWindowMinutes,
      components.records,
      incidents.records
    ),
    component_states: components.records,
    incident_records: incidents.records,
    copy_ids: STATUS_PAGE_COPY_IDS,
    ...boundaryPayload
  });

  const pageHash = hashStatusPageValue(pagePayload);

  return stableValue({
    ok: true,
    status_page_hash: pageHash,
    ...pagePayload
  });
}

export function assertStatusPageDoesNotAlterEngine(result) {
  if (!isPlainObject(result)) {
    return {
      ok: false,
      code: "status_page_result_object_required"
    };
  }

  const checks = {
    service_state_only: result.service_state_only === true,
    engine_visible: result.engine_visible === false,
    engine_truth_changed: result.engine_truth_changed === false,
    compile_output_changed: result.compile_output_changed === false,
    training_flow_changed: result.training_flow_changed === false,
    declaration_truth_changed: result.declaration_truth_changed === false,
    user_safety_claim: result.user_safety_claim === false,
    user_readiness_claim: result.user_readiness_claim === false,
    training_effectiveness_claim: result.training_effectiveness_claim === false,
    service_readiness_claim: result.service_readiness_claim === false,
    service_reliability_guarantee: result.service_reliability_guarantee === false
  };

  return stableValue({
    ok: Object.values(checks).every(Boolean),
    checks
  });
}

export function serializeStatusPage(value) {
  return stableStatusPageJson(value);
}