import crypto from "node:crypto";

export const MOBILE_SESSION_EXECUTION_COPY_IDS = Object.freeze({
  title: "MOBILE_SESSION_EXECUTION_TITLE",
  statusLabel: "MOBILE_SESSION_EXECUTION_STATUS_LABEL",
  workItemsLabel: "MOBILE_SESSION_EXECUTION_WORK_ITEMS_LABEL",
  currentItemLabel: "MOBILE_SESSION_EXECUTION_CURRENT_ITEM_LABEL",
  setsLabel: "MOBILE_SESSION_EXECUTION_SETS_LABEL",
  repsLabel: "MOBILE_SESSION_EXECUTION_REPS_LABEL",
  loadLabel: "MOBILE_SESSION_EXECUTION_LOAD_LABEL",
  completeAction: "MOBILE_SESSION_EXECUTION_COMPLETE_ACTION",
  skipAction: "MOBILE_SESSION_EXECUTION_SKIP_ACTION",
  splitAction: "MOBILE_SESSION_EXECUTION_SPLIT_ACTION",
  returnContinueAction: "MOBILE_SESSION_EXECUTION_RETURN_CONTINUE_ACTION",
  returnSkipAction: "MOBILE_SESSION_EXECUTION_RETURN_SKIP_ACTION",
  readOnlyNotice: "MOBILE_SESSION_EXECUTION_READ_ONLY_NOTICE",
  noWorkItems: "MOBILE_SESSION_EXECUTION_NO_WORK_ITEMS"
});

const STANDARD_ACTIONS = Object.freeze([
  Object.freeze({ copy_id: MOBILE_SESSION_EXECUTION_COPY_IDS.completeAction, runtime_event_type: "COMPLETE_WORK_ITEM" }),
  Object.freeze({ copy_id: MOBILE_SESSION_EXECUTION_COPY_IDS.skipAction, runtime_event_type: "SKIP_WORK_ITEM" }),
  Object.freeze({ copy_id: MOBILE_SESSION_EXECUTION_COPY_IDS.splitAction, runtime_event_type: "SPLIT_SESSION" })
]);

const RETURN_ACTIONS = Object.freeze([
  Object.freeze({ copy_id: MOBILE_SESSION_EXECUTION_COPY_IDS.returnContinueAction, runtime_event_type: "RETURN_CONTINUE" }),
  Object.freeze({ copy_id: MOBILE_SESSION_EXECUTION_COPY_IDS.returnSkipAction, runtime_event_type: "RETURN_SKIP" })
]);

const TERMINAL_STATUSES = new Set(["completed", "partially_completed", "partial", "stopped"]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stableStringify(value) {
  if (value === null) return "null";

  const valueType = typeof value;
  if (valueType === "string" || valueType === "number" || valueType === "boolean") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }

  return JSON.stringify(null);
}

function fingerprint(value) {
  return crypto.createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

function asString(value) {
  if (value === null || typeof value === "undefined") return null;
  return String(value);
}

function firstStringValue(source, keys) {
  if (!isRecord(source)) return null;

  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}

function toStringSet(value) {
  if (!Array.isArray(value)) return new Set();
  return new Set(value.map((item) => String(item)));
}

function readWorkItems(engineOutput) {
  if (Array.isArray(engineOutput?.work_items)) return engineOutput.work_items;
  if (Array.isArray(engineOutput?.workItems)) return engineOutput.workItems;
  if (Array.isArray(engineOutput?.exercises)) return engineOutput.exercises;
  return [];
}

function readRuntimeSets(runtimeState) {
  return {
    completed: toStringSet(runtimeState?.completed_ids ?? runtimeState?.completedIds),
    skipped: toStringSet(runtimeState?.skipped_ids ?? runtimeState?.skippedIds),
    dropped: toStringSet(runtimeState?.dropped_ids ?? runtimeState?.droppedIds),
    remaining: toStringSet(runtimeState?.remaining_ids ?? runtimeState?.remainingIds)
  };
}

function readItemId(item, index) {
  return firstStringValue(item, ["work_item_id", "workItemId", "exercise_id", "exerciseId", "id"]) ?? `item_${index + 1}`;
}

function readItemState(item, id, runtimeSets) {
  if (runtimeSets.completed.has(id)) return "completed";
  if (runtimeSets.skipped.has(id) || runtimeSets.dropped.has(id)) return "skipped";

  const raw = firstStringValue(item, ["status", "state"]);
  if (raw) return raw;

  if (runtimeSets.remaining.has(id)) return "pending";
  return "pending";
}

function readPrescribedSets(item) {
  const sets = Array.isArray(item?.sets) ? item.sets : [];
  return sets.map((set, index) => Object.freeze({
    set_id: firstStringValue(set, ["set_id", "setId", "id"]) ?? `set_${index + 1}`,
    reps: set?.reps ?? set?.target_reps ?? set?.targetReps ?? null,
    load: set?.load ?? set?.target_load ?? set?.targetLoad ?? null,
    source_index: index
  }));
}

function renderWorkItem(item, index, runtimeSets) {
  const id = readItemId(item, index);
  return Object.freeze({
    work_item_id: id,
    source_index: index,
    display_name: firstStringValue(item, ["display_name", "displayName", "name", "exercise_name", "exerciseName"]) ?? id,
    state_value: readItemState(item, id, runtimeSets),
    prescribed_sets: Object.freeze(readPrescribedSets(item)),
    source_shape: Array.isArray(item?.sets) ? "sets" : "item"
  });
}

function pickCurrentWorkItem(workItems) {
  return workItems.find((item) => !TERMINAL_STATUSES.has(item.state_value)) ?? workItems[workItems.length - 1] ?? null;
}

function readReturnDecisionRequired(engineOutput, runtimeState) {
  return engineOutput?.runtime_trace?.return_decision_required === true ||
    engineOutput?.return_decision_required === true ||
    runtimeState?.return_decision_required === true ||
    runtimeState?.returnDecisionRequired === true;
}

function renderActions(args) {
  const actions = readReturnDecisionRequired(args.engineOutput, args.runtimeState) ? RETURN_ACTIONS : STANDARD_ACTIONS;
  return actions.map((action) => Object.freeze({ ...action }));
}

function renderLayout(presentation) {
  const lowInput = presentation?.low_input_mode === true || presentation?.lowInputMode === true || presentation?.nd_mode === true;
  return Object.freeze({
    density: lowInput ? "minimal" : "standard",
    max_visible_primary_actions: lowInput ? 2 : 3,
    tap_path: lowInput ? "reduced" : "standard"
  });
}

/**
 * DEV NOTE: This renderer is presentation-only. It consumes already materialised
 * session output and runtime values supplied by app code. It must not import
 * engine modules, emit runtime events, persist data, or create execution truth.
 */
export function renderMobileSessionExecutionShell(args) {
  if (!isRecord(args)) {
    throw new TypeError("S-V1-34 input object required.");
  }

  const { engineOutput, runtimeState = {}, presentation = {} } = args;

  if (!isRecord(engineOutput)) {
    throw new TypeError("S-V1-34 engine output object required.");
  }

  const runtimeSets = readRuntimeSets(runtimeState);
  const workItems = Object.freeze(readWorkItems(engineOutput).map((item, index) => renderWorkItem(item, index, runtimeSets)));
  const currentWorkItem = pickCurrentWorkItem(workItems);

  return Object.freeze({
    shell_id: "s_v1_34_mobile_session_execution_shell",
    copy_ids: MOBILE_SESSION_EXECUTION_COPY_IDS,
    source: Object.freeze({
      engine_output_sha256: fingerprint(engineOutput),
      runtime_state_sha256: fingerprint(runtimeState),
      session_id: asString(engineOutput.session_id ?? engineOutput.sessionId),
      engine_status_value: asString(engineOutput.status ?? engineOutput.execution_status ?? engineOutput.executionStatus)
    }),
    layout: renderLayout(presentation),
    display: Object.freeze({
      title_copy_id: MOBILE_SESSION_EXECUTION_COPY_IDS.title,
      status_label_copy_id: MOBILE_SESSION_EXECUTION_COPY_IDS.statusLabel,
      work_items_label_copy_id: MOBILE_SESSION_EXECUTION_COPY_IDS.workItemsLabel,
      current_item_label_copy_id: MOBILE_SESSION_EXECUTION_COPY_IDS.currentItemLabel,
      read_only_notice_copy_id: MOBILE_SESSION_EXECUTION_COPY_IDS.readOnlyNotice,
      no_work_items_copy_id: MOBILE_SESSION_EXECUTION_COPY_IDS.noWorkItems,
      current_work_item_id: currentWorkItem?.work_item_id ?? null,
      work_items: workItems
    }),
    action_intents: Object.freeze(renderActions({ engineOutput, runtimeState })),
    mutation_contract: Object.freeze({
      emits_runtime_event: false,
      writes_storage: false,
      imports_engine_module: false,
      changes_engine_output: false
    })
  });
}
