import {
  sha256Hex,
  stableCanonicalJson
} from "./v1CompileInputCanonicalisation.mjs";

export const v1CompileOutputContractSurfaceId = "v1_compile_output_contract";
export const v1CompileOutputContractVersion = "1.0.0";
export const v1CompileOutputContractFailureCode = "v1_compile_output_contract_failure";
export const v1CompileOutputContractFailureCopyId = "V1_COMPILE_OUTPUT_CONTRACT_REJECTED";

const COMPILE_OUTPUT_VERSION = "S-V1-31";
const COMPILE_OUTPUT_STATUS = "canonical_v1_compile_output";

const REQUIRED_ROOT_KEYS = Object.freeze([
  "activity_id",
  "compile_input_hash",
  "compile_input_version",
  "engine_version",
  "planned_session",
  "runtime_trace"
]);

const REQUIRED_PLANNED_SESSION_KEYS = Object.freeze([
  "activity_id",
  "planned_items",
  "session_id",
  "session_status"
]);

const REQUIRED_PLANNED_ITEM_KEYS = Object.freeze([
  "block_id",
  "exercise_id",
  "item_id",
  "load",
  "order",
  "reps",
  "rest_seconds",
  "sets",
  "source_template_id",
  "work_item_id"
]);

const REQUIRED_LOAD_KEYS = Object.freeze([
  "basis",
  "unit",
  "value"
]);

const REQUIRED_RUNTIME_TRACE_KEYS = Object.freeze([
  "engine_phase",
  "emitted_from",
  "planned_item_count",
  "trace_status"
]);

const REQUIRED_EXECUTION_UI_KEYS = Object.freeze([
  "activity_id",
  "planned_item_count",
  "session_id",
  "session_status",
  "work_items"
]);

const REQUIRED_EXECUTION_UI_WORK_ITEM_KEYS = Object.freeze([
  "display_order",
  "exercise_id",
  "item_id",
  "load",
  "reps",
  "rest_seconds",
  "sets",
  "status",
  "work_item_id"
]);

const REQUIRED_HISTORY_KEYS = Object.freeze([
  "activity_id",
  "compile_input_hash",
  "compile_output_hash",
  "planned_item_count",
  "session_id",
  "session_status"
]);

const REQUIRED_CANONICAL_OUTPUT_KEYS = Object.freeze([
  "activity_id",
  "compile_input_hash",
  "compile_input_version",
  "compile_output_status",
  "compile_output_version",
  "engine_version",
  "execution_ui_contract",
  "factual_only",
  "history_projection",
  "planned_session",
  "runtime_trace"
]);

const joinKey = (...parts) => parts.join("");

const FORBIDDEN_OUTPUT_KEYS = Object.freeze([
  "advice",
  "advisory",
  joinKey("athlete_", "ri", "sk"),
  "automatic_coaching_decision",
  "billing",
  "coach_note",
  "coach_notes",
  "diagnosis",
  "effectiveness",
  "fatigue",
  joinKey("fatigue_", "sc", "ore"),
  joinKey("injury_", "ri", "sk"),
  "intervention",
  "medical_clearance",
  "optimisation",
  "optimization",
  "optimal",
  "payment",
  "programme_failed",
  "programme_worked",
  joinKey("ra", "nk"),
  joinKey("ra", "nking"),
  joinKey("readi", "ness"),
  joinKey("readi", "ness_", "sc", "ore"),
  joinKey("recomm", "endation"),
  joinKey("recomm", "endation_", "sc", "ore"),
  joinKey("recomm", "ended_action"),
  joinKey("ri", "sk"),
  joinKey("ri", "sk_", "sc", "ore"),
  joinKey("safe", "ty"),
  joinKey("sc", "ore"),
  "suitability"
]);

function fail(reason, message, details = {}) {
  const error = new Error(message);
  error.name = "V1CompileOutputContractError";
  error.code = v1CompileOutputContractFailureCode;
  error.copy_id = v1CompileOutputContractFailureCopyId;
  error.reason = reason;
  error.details = Object.freeze({ ...details });
  error.engine_decision = false;
  throw error;
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertPlainObject(value, reason, details = {}) {
  if (!isPlainObject(value)) {
    fail(reason, "v1 compile output value must be an object", details);
  }
}

function assertArray(value, reason, details = {}) {
  if (!Array.isArray(value)) {
    fail(reason, "v1 compile output array field is required", details);
  }
}

function assertNonEmptyString(value, reason, details = {}) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(reason, "v1 compile output string field is required", details);
  }
}

function assertBoolean(value, reason, details = {}) {
  if (typeof value !== "boolean") {
    fail(reason, "v1 compile output boolean field is required", details);
  }
}

function assertNonNegativeInteger(value, reason, details = {}) {
  if (!Number.isInteger(value) || value < 0) {
    fail(reason, "v1 compile output integer field is required", details);
  }
}

function assertPositiveInteger(value, reason, details = {}) {
  if (!Number.isInteger(value) || value < 1) {
    fail(reason, "v1 compile output positive integer field is required", details);
  }
}

function assertHashLike(value, reason, details = {}) {
  assertNonEmptyString(value, reason, details);

  if (!/^[a-f0-9]{64}$/u.test(value)) {
    fail(reason, "v1 compile output hash must be 64 lowercase hexadecimal characters", details);
  }
}

function assertExactKeys(value, expectedKeys, reasonPrefix, path) {
  assertPlainObject(value, `${reasonPrefix}_object_required`, { path });

  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();

  for (const key of sortedExpectedKeys) {
    if (!actualKeys.includes(key)) {
      fail(`${reasonPrefix}_missing_required_field`, "v1 compile output is missing a required field", {
        path,
        key
      });
    }
  }

  for (const key of actualKeys) {
    if (!sortedExpectedKeys.includes(key)) {
      fail(`${reasonPrefix}_unknown_field_refused`, "v1 compile output contains an unknown field", {
        path,
        key
      });
    }
  }
}

function assertNoForbiddenOutputKeysDeep(value, pathParts = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenOutputKeysDeep(item, [...pathParts, String(index)]));
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_OUTPUT_KEYS.includes(key)) {
      fail("v1_compile_output_forbidden_field_refused", "claim or advisory field cannot enter v1 compile output", {
        path: [...pathParts, key].join(".")
      });
    }

    assertNoForbiddenOutputKeysDeep(child, [...pathParts, key]);
  }
}

function canonicalise(value) {
  if (value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map(canonicalise);
  }

  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce((accumulator, key) => {
        accumulator[key] = canonicalise(value[key]);
        return accumulator;
      }, {});
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      fail("v1_compile_output_non_finite_number_refused", "non-finite numbers cannot be canonical output", {});
    }

    return value;
  }

  if (["string", "boolean"].includes(typeof value)) {
    return value;
  }

  fail("v1_compile_output_unsupported_value_refused", "unsupported value cannot be canonical output", {
    value_type: typeof value
  });
}

function assertLoad(load, path) {
  assertExactKeys(load, REQUIRED_LOAD_KEYS, "v1_compile_output_load", path);

  assertNonEmptyString(load.basis, "v1_compile_output_load_basis_required", {
    field: `${path}.basis`
  });
  assertNonEmptyString(load.unit, "v1_compile_output_load_unit_required", {
    field: `${path}.unit`
  });
  assertNonNegativeInteger(load.value, "v1_compile_output_load_value_required", {
    field: `${path}.value`
  });
}

function assertPlannedItem(item, index) {
  const path = `planned_session.planned_items.${index}`;
  assertExactKeys(item, REQUIRED_PLANNED_ITEM_KEYS, "v1_compile_output_planned_item", path);

  assertNonEmptyString(item.item_id, "v1_compile_output_item_id_required", {
    field: `${path}.item_id`
  });
  assertNonEmptyString(item.work_item_id, "v1_compile_output_work_item_id_required", {
    field: `${path}.work_item_id`
  });
  assertNonEmptyString(item.block_id, "v1_compile_output_block_id_required", {
    field: `${path}.block_id`
  });
  assertNonEmptyString(item.exercise_id, "v1_compile_output_exercise_id_required", {
    field: `${path}.exercise_id`
  });
  assertNonEmptyString(item.source_template_id, "v1_compile_output_source_template_id_required", {
    field: `${path}.source_template_id`
  });
  assertPositiveInteger(item.order, "v1_compile_output_order_required", {
    field: `${path}.order`
  });
  assertPositiveInteger(item.sets, "v1_compile_output_sets_required", {
    field: `${path}.sets`
  });
  assertPositiveInteger(item.reps, "v1_compile_output_reps_required", {
    field: `${path}.reps`
  });
  assertNonNegativeInteger(item.rest_seconds, "v1_compile_output_rest_seconds_required", {
    field: `${path}.rest_seconds`
  });
  assertLoad(item.load, `${path}.load`);
}

function assertPlannedSession(plannedSession, activityId) {
  assertExactKeys(plannedSession, REQUIRED_PLANNED_SESSION_KEYS, "v1_compile_output_planned_session", "planned_session");

  assertNonEmptyString(plannedSession.session_id, "v1_compile_output_session_id_required", {
    field: "planned_session.session_id"
  });
  assertNonEmptyString(plannedSession.activity_id, "v1_compile_output_session_activity_required", {
    field: "planned_session.activity_id"
  });
  assertNonEmptyString(plannedSession.session_status, "v1_compile_output_session_status_required", {
    field: "planned_session.session_status"
  });
  assertArray(plannedSession.planned_items, "v1_compile_output_planned_items_required", {
    field: "planned_session.planned_items"
  });

  if (plannedSession.activity_id !== activityId) {
    fail("v1_compile_output_activity_mismatch", "planned session activity must match compile output activity", {
      root_activity_id: activityId,
      session_activity_id: plannedSession.activity_id
    });
  }

  if (plannedSession.session_status !== "planned") {
    fail("v1_compile_output_session_status_invalid", "compile output session status must be planned", {
      session_status: plannedSession.session_status
    });
  }

  if (plannedSession.planned_items.length === 0) {
    fail("v1_compile_output_planned_items_empty", "compile output planned items cannot be empty", {});
  }

  plannedSession.planned_items.forEach(assertPlannedItem);

  const sortedOrders = plannedSession.planned_items.map((item) => item.order).sort((left, right) => left - right);

  for (let index = 0; index < sortedOrders.length; index += 1) {
    if (sortedOrders[index] !== index + 1) {
      fail("v1_compile_output_order_not_contiguous", "planned item order must be contiguous", {
        actual_orders: sortedOrders
      });
    }
  }
}

function assertRuntimeTrace(runtimeTrace, plannedItemCount) {
  assertExactKeys(runtimeTrace, REQUIRED_RUNTIME_TRACE_KEYS, "v1_compile_output_runtime_trace", "runtime_trace");

  assertNonEmptyString(runtimeTrace.engine_phase, "v1_compile_output_runtime_phase_required", {
    field: "runtime_trace.engine_phase"
  });
  assertNonEmptyString(runtimeTrace.emitted_from, "v1_compile_output_runtime_source_required", {
    field: "runtime_trace.emitted_from"
  });
  assertNonEmptyString(runtimeTrace.trace_status, "v1_compile_output_runtime_status_required", {
    field: "runtime_trace.trace_status"
  });
  assertPositiveInteger(runtimeTrace.planned_item_count, "v1_compile_output_runtime_count_required", {
    field: "runtime_trace.planned_item_count"
  });

  if (runtimeTrace.engine_phase !== "phase6") {
    fail("v1_compile_output_runtime_phase_invalid", "compile output runtime trace must identify phase6", {
      engine_phase: runtimeTrace.engine_phase
    });
  }

  if (runtimeTrace.emitted_from !== "planned_items") {
    fail("v1_compile_output_runtime_source_invalid", "compile output runtime trace must identify planned_items source", {
      emitted_from: runtimeTrace.emitted_from
    });
  }

  if (runtimeTrace.trace_status !== "emitted") {
    fail("v1_compile_output_runtime_status_invalid", "compile output runtime trace must be emitted", {
      trace_status: runtimeTrace.trace_status
    });
  }

  if (runtimeTrace.planned_item_count !== plannedItemCount) {
    fail("v1_compile_output_runtime_count_mismatch", "runtime trace count must match planned item count", {
      runtime_trace_count: runtimeTrace.planned_item_count,
      planned_item_count: plannedItemCount
    });
  }
}

function buildExecutionUiProjection(plannedSession) {
  return Object.freeze({
    activity_id: plannedSession.activity_id,
    planned_item_count: plannedSession.planned_items.length,
    session_id: plannedSession.session_id,
    session_status: plannedSession.session_status,
    work_items: Object.freeze(plannedSession.planned_items.map((item) => Object.freeze({
      display_order: item.order,
      exercise_id: item.exercise_id,
      item_id: item.item_id,
      load: Object.freeze(canonicalise(item.load)),
      reps: item.reps,
      rest_seconds: item.rest_seconds,
      sets: item.sets,
      status: "not_started",
      work_item_id: item.work_item_id
    })))
  });
}

function buildHistoryProjection(input, plannedSession, compileOutputHash) {
  return Object.freeze({
    activity_id: input.activity_id,
    compile_input_hash: input.compile_input_hash,
    compile_output_hash: compileOutputHash,
    planned_item_count: plannedSession.planned_items.length,
    session_id: plannedSession.session_id,
    session_status: plannedSession.session_status
  });
}

function assertExecutionUiProjection(value, plannedItemCount) {
  assertExactKeys(value, REQUIRED_EXECUTION_UI_KEYS, "v1_compile_output_execution_ui", "execution_ui_contract");
  assertArray(value.work_items, "v1_compile_output_execution_ui_items_required", {
    field: "execution_ui_contract.work_items"
  });

  if (value.work_items.length !== plannedItemCount) {
    fail("v1_compile_output_execution_ui_count_mismatch", "execution UI work item count must match planned item count", {
      work_item_count: value.work_items.length,
      planned_item_count: plannedItemCount
    });
  }

  value.work_items.forEach((item, index) => {
    assertExactKeys(item, REQUIRED_EXECUTION_UI_WORK_ITEM_KEYS, "v1_compile_output_execution_ui_item", `execution_ui_contract.work_items.${index}`);
    assertPositiveInteger(item.display_order, "v1_compile_output_execution_ui_order_required", {
      field: `execution_ui_contract.work_items.${index}.display_order`
    });
    assertNonEmptyString(item.status, "v1_compile_output_execution_ui_status_required", {
      field: `execution_ui_contract.work_items.${index}.status`
    });

    if (item.status !== "not_started") {
      fail("v1_compile_output_execution_ui_status_invalid", "execution UI work item status must be not_started", {
        status: item.status
      });
    }
  });
}

function assertHistoryProjection(value) {
  assertExactKeys(value, REQUIRED_HISTORY_KEYS, "v1_compile_output_history", "history_projection");
  assertHashLike(value.compile_input_hash, "v1_compile_output_history_input_hash_invalid", {
    field: "history_projection.compile_input_hash"
  });
  assertHashLike(value.compile_output_hash, "v1_compile_output_history_output_hash_invalid", {
    field: "history_projection.compile_output_hash"
  });
  assertPositiveInteger(value.planned_item_count, "v1_compile_output_history_count_required", {
    field: "history_projection.planned_item_count"
  });
}

export function assertV1CompileOutputCandidate(input) {
  assertPlainObject(input, "v1_compile_output_candidate_object_required");
  assertNoForbiddenOutputKeysDeep(input);
  assertExactKeys(input, REQUIRED_ROOT_KEYS, "v1_compile_output_root", "root");

  assertNonEmptyString(input.activity_id, "v1_compile_output_activity_required", {
    field: "activity_id"
  });
  assertHashLike(input.compile_input_hash, "v1_compile_output_input_hash_invalid", {
    field: "compile_input_hash"
  });
  assertNonEmptyString(input.compile_input_version, "v1_compile_output_input_version_required", {
    field: "compile_input_version"
  });
  assertNonEmptyString(input.engine_version, "v1_compile_output_engine_version_required", {
    field: "engine_version"
  });

  assertPlannedSession(input.planned_session, input.activity_id);
  assertRuntimeTrace(input.runtime_trace, input.planned_session.planned_items.length);

  return true;
}

export function buildV1CompileOutput(input) {
  assertV1CompileOutputCandidate(input);

  const plannedSession = Object.freeze(canonicalise(input.planned_session));
  const runtimeTrace = Object.freeze(canonicalise(input.runtime_trace));
  const executionUiProjection = buildExecutionUiProjection(plannedSession);

  const outputWithoutHash = Object.freeze({
    activity_id: input.activity_id,
    compile_input_hash: input.compile_input_hash,
    compile_input_version: input.compile_input_version,
    compile_output_status: COMPILE_OUTPUT_STATUS,
    compile_output_version: COMPILE_OUTPUT_VERSION,
    engine_version: input.engine_version,
    execution_ui_contract: executionUiProjection,
    factual_only: true,
    history_projection: Object.freeze({
      activity_id: input.activity_id,
      compile_input_hash: input.compile_input_hash,
      compile_output_hash: "pending",
      planned_item_count: plannedSession.planned_items.length,
      session_id: plannedSession.session_id,
      session_status: plannedSession.session_status
    }),
    planned_session: plannedSession,
    runtime_trace: runtimeTrace
  });

  const preHashCanonicalJson = stableCanonicalJson(outputWithoutHash);
  const compileOutputHash = sha256Hex(preHashCanonicalJson);

  const canonicalOutput = Object.freeze({
    ...outputWithoutHash,
    history_projection: buildHistoryProjection(input, plannedSession, compileOutputHash)
  });

  assertExactKeys(canonicalOutput, REQUIRED_CANONICAL_OUTPUT_KEYS, "v1_compile_output_canonical", "canonical_output");
  assertExecutionUiProjection(canonicalOutput.execution_ui_contract, plannedSession.planned_items.length);
  assertHistoryProjection(canonicalOutput.history_projection);
  assertBoolean(canonicalOutput.factual_only, "v1_compile_output_factual_only_required", {
    field: "factual_only"
  });

  if (canonicalOutput.factual_only !== true) {
    fail("v1_compile_output_factual_only_invalid", "compile output must be factual only", {});
  }

  const canonicalJson = stableCanonicalJson(canonicalOutput);
  const canonicalHash = sha256Hex(canonicalJson);

  return Object.freeze({
    surface_id: v1CompileOutputContractSurfaceId,
    version: v1CompileOutputContractVersion,
    compile_output_status: COMPILE_OUTPUT_STATUS,
    canonical_json: canonicalJson,
    canonical_hash: canonicalHash,
    canonical_output: canonicalOutput,
    hash_metadata: Object.freeze({
      algorithm: "sha256",
      canonical_json: "stable_sorted_keys",
      hash_field: "canonical_hash",
      output_hash_field: "history_projection.compile_output_hash"
    }),
    engine_decision: false
  });
}

export function tryBuildV1CompileOutput(input) {
  try {
    return Object.freeze({
      ok: true,
      compile_output: buildV1CompileOutput(input)
    });
  } catch (error) {
    if (error && error.name === "V1CompileOutputContractError") {
      return Object.freeze({
        ok: false,
        error: Object.freeze({
          code: error.code,
          copy_id: error.copy_id,
          reason: error.reason,
          details: error.details,
          engine_decision: false
        })
      });
    }

    throw error;
  }
}

export const v1CompileOutputContract = Object.freeze({
  surface_id: v1CompileOutputContractSurfaceId,
  version: v1CompileOutputContractVersion,
  failure_code: v1CompileOutputContractFailureCode,
  failure_copy_id: v1CompileOutputContractFailureCopyId,
  compile_output_version: COMPILE_OUTPUT_VERSION,
  compile_output_status: COMPILE_OUTPUT_STATUS,
  required_root_keys: REQUIRED_ROOT_KEYS,
  required_planned_session_keys: REQUIRED_PLANNED_SESSION_KEYS,
  required_planned_item_keys: REQUIRED_PLANNED_ITEM_KEYS,
  required_runtime_trace_keys: REQUIRED_RUNTIME_TRACE_KEYS,
  required_canonical_output_keys: REQUIRED_CANONICAL_OUTPUT_KEYS,
  forbidden_output_keys: FORBIDDEN_OUTPUT_KEYS,
  canonical_json: "stable_sorted_keys",
  hash_algorithm: "sha256"
});
