/**
 * DEV NOTE: S-V1-U-05 session execution polish boundary.
 * Purpose: build a mobile execution presentation surface with low-input and ND presentation metadata.
 * Boundary: this module renders presentation data only; it does not import engine code, run compile logic, or mutate runtime events.
 * Determinism: identical session state and presentation inputs produce identical surface truth fields.
 * Failure: invalid surface input is rejected without manufacturing session truth.
 */

const SLICE_ID = "S-V1-U-05";
const SURFACE_ID = "session_execution_polish";
const MIN_TOUCH_TARGET_PX = 44;

const COPY_IDS = Object.freeze({
  title: "SESSION_POLISH_TITLE",
  progressLabel: "SESSION_POLISH_PROGRESS_LABEL",
  currentItemLabel: "SESSION_POLISH_CURRENT_ITEM_LABEL",
  quantityLabel: "SESSION_POLISH_QUANTITY_LABEL",
  recordedStatusLabel: "SESSION_POLISH_RECORDED_STATUS_LABEL",
  actionComplete: "SESSION_POLISH_ACTION_COMPLETE_RECORDED",
  actionPartial: "SESSION_POLISH_ACTION_PARTIAL_RECORDED",
  actionSkip: "SESSION_POLISH_ACTION_SKIP_RECORDED",
  actionStop: "SESSION_POLISH_ACTION_STOP_RECORDED",
  actionSplit: "SESSION_POLISH_ACTION_SPLIT_RECORDED",
  actionReturnContinue: "SESSION_POLISH_ACTION_RETURN_CONTINUE_RECORDED",
  actionReturnSkip: "SESSION_POLISH_ACTION_RETURN_SKIP_RECORDED",
  ariaMain: "SESSION_POLISH_MAIN_ARIA_LABEL",
  ariaProgress: "SESSION_POLISH_PROGRESS_ARIA_LABEL",
  ariaCurrentItem: "SESSION_POLISH_CURRENT_ITEM_ARIA_LABEL",
  ariaActions: "SESSION_POLISH_ACTIONS_ARIA_LABEL",
  copyBoundary: "SESSION_POLISH_FACTUAL_COPY_BOUNDARY"
});

const ACTIONS = Object.freeze([
  {
    action_id: "complete_current",
    event_type: "WORK_ITEM_COMPLETED",
    copy_id: COPY_IDS.actionComplete,
    aria_label_copy_id: COPY_IDS.actionComplete,
    requires_work_item_id: true,
    presentation_rank: 1,
    low_input_visible: true
  },
  {
    action_id: "record_partial",
    event_type: "WORK_ITEM_PARTIAL",
    copy_id: COPY_IDS.actionPartial,
    aria_label_copy_id: COPY_IDS.actionPartial,
    requires_work_item_id: true,
    presentation_rank: 2,
    low_input_visible: true
  },
  {
    action_id: "skip_current",
    event_type: "WORK_ITEM_SKIPPED",
    copy_id: COPY_IDS.actionSkip,
    aria_label_copy_id: COPY_IDS.actionSkip,
    requires_work_item_id: true,
    presentation_rank: 3,
    low_input_visible: false
  },
  {
    action_id: "stop_session",
    event_type: "SESSION_STOPPED",
    copy_id: COPY_IDS.actionStop,
    aria_label_copy_id: COPY_IDS.actionStop,
    requires_work_item_id: false,
    presentation_rank: 4,
    low_input_visible: false
  }
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneStable(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function normaliseBoolean(value) {
  return value === true;
}

function normaliseInstructionDensity(value) {
  if (value === "minimal" || value === "standard" || value === "detailed") return value;
  return "standard";
}

function readWorkItems(sessionState) {
  if (Array.isArray(sessionState?.work_items)) return sessionState.work_items;
  if (Array.isArray(sessionState?.planned_session?.work_items)) return sessionState.planned_session.work_items;
  if (Array.isArray(sessionState?.session?.work_items)) return sessionState.session.work_items;
  if (Array.isArray(sessionState?.items)) return sessionState.items;
  return [];
}

function readRecordedSet(sessionState, key) {
  const source = sessionState?.[key];
  return new Set(Array.isArray(source) ? source.map(String) : []);
}

function readRuntimeEvents(sessionState) {
  if (Array.isArray(sessionState?.runtime_events)) return sessionState.runtime_events;
  if (Array.isArray(sessionState?.events)) return sessionState.events;
  return [];
}

function getWorkItemId(item) {
  return String(item?.work_item_id ?? item?.id ?? "");
}

function getDisplayOrder(item, index) {
  const declared = Number(item?.display_order ?? item?.order);
  return Number.isFinite(declared) ? declared : index + 1;
}

function getDisplayToken(item) {
  const candidate = item?.display_label ?? item?.exercise_token_id ?? item?.exercise_id ?? item?.work_item_id ?? item?.id;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : "undeclared_work_item";
}

function getQuantity(item) {
  if (isPlainObject(item?.planned_quantity)) return cloneStable(item.planned_quantity);
  if (isPlainObject(item?.quantity)) return cloneStable(item.quantity);

  const quantity = {};
  for (const key of ["sets", "reps", "load_value", "load_unit", "duration_seconds", "distance_meters"]) {
    if (Object.prototype.hasOwnProperty.call(item ?? {}, key)) quantity[key] = item[key];
  }
  return quantity;
}

function isRecorded(itemId, completedIds, skippedIds, partialIds) {
  return completedIds.has(itemId) || skippedIds.has(itemId) || partialIds.has(itemId);
}

function buildCurrentWorkItem(workItems, completedIds, skippedIds, partialIds) {
  const ordered = workItems
    .map((item, index) => ({ item, index, itemId: getWorkItemId(item), displayOrder: getDisplayOrder(item, index) }))
    .filter((entry) => entry.itemId.length > 0)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.itemId.localeCompare(b.itemId));

  const selected = ordered.find((entry) => !isRecorded(entry.itemId, completedIds, skippedIds, partialIds)) ?? ordered[ordered.length - 1] ?? null;
  if (!selected) return null;

  return {
    work_item_id: selected.itemId,
    display_order: selected.displayOrder,
    display_token: getDisplayToken(selected.item),
    quantity: getQuantity(selected.item),
    copy_id: COPY_IDS.currentItemLabel,
    quantity_copy_id: COPY_IDS.quantityLabel,
    aria_label_copy_id: COPY_IDS.ariaCurrentItem
  };
}

function buildActionList({ lowInput, currentWorkItem, returnDecisionRequired }) {
  const baseActions = ACTIONS
    .filter((action) => !lowInput || action.low_input_visible)
    .map((action) => ({
      action_id: action.action_id,
      event_type: action.event_type,
      copy_id: action.copy_id,
      aria_label_copy_id: action.aria_label_copy_id,
      requires_work_item_id: action.requires_work_item_id,
      work_item_id: action.requires_work_item_id ? currentWorkItem?.work_item_id ?? null : null,
      presentation_rank: action.presentation_rank,
      presentation_only: true
    }));

  if (returnDecisionRequired) {
    baseActions.push(
      {
        action_id: "return_continue",
        event_type: "RETURN_CONTINUE",
        copy_id: COPY_IDS.actionReturnContinue,
        aria_label_copy_id: COPY_IDS.actionReturnContinue,
        requires_work_item_id: false,
        work_item_id: null,
        presentation_rank: 5,
        presentation_only: true
      },
      {
        action_id: "return_skip",
        event_type: "RETURN_SKIP",
        copy_id: COPY_IDS.actionReturnSkip,
        aria_label_copy_id: COPY_IDS.actionReturnSkip,
        requires_work_item_id: false,
        work_item_id: null,
        presentation_rank: 6,
        presentation_only: true
      }
    );
  }

  return baseActions.sort((a, b) => a.presentation_rank - b.presentation_rank || a.action_id.localeCompare(b.action_id));
}

function buildProgress({ workItemCount, completedIds, skippedIds, partialIds }) {
  return {
    copy_id: COPY_IDS.progressLabel,
    work_item_count: workItemCount,
    completed_count: completedIds.size,
    skipped_count: skippedIds.size,
    partial_count: partialIds.size,
    recorded_count: completedIds.size + skippedIds.size + partialIds.size
  };
}

function buildAccessibilityContract(actions) {
  return {
    landmark_role: "main",
    status_region_role: "status",
    live_region: "polite",
    action_group_role: "group",
    minimum_touch_target_px: MIN_TOUCH_TARGET_PX,
    keyboard_action_order: actions.map((action) => action.action_id),
    visible_focus_required: true,
    main_aria_label_copy_id: COPY_IDS.ariaMain,
    progress_aria_label_copy_id: COPY_IDS.ariaProgress,
    actions_aria_label_copy_id: COPY_IDS.ariaActions
  };
}

function buildSessionTruth({ sessionState, workItems, runtimeEvents, completedIds, skippedIds, partialIds, currentWorkItem }) {
  return {
    session_id: String(sessionState?.session_id ?? sessionState?.id ?? "unknown_session"),
    status: String(sessionState?.status ?? "unknown"),
    work_item_count: workItems.length,
    runtime_event_count: runtimeEvents.length,
    completed_ids: Array.from(completedIds).sort(),
    skipped_ids: Array.from(skippedIds).sort(),
    partial_ids: Array.from(partialIds).sort(),
    current_work_item_id: currentWorkItem?.work_item_id ?? null,
    return_decision_required: sessionState?.return_decision_required === true
  };
}

export function getSessionExecutionPolishCopyIds() {
  return Object.values(COPY_IDS).sort();
}

export function lintSessionExecutionPolishCopySurface(surface) {
  const copyIds = [
    ...(Array.isArray(surface?.copy_ids) ? surface.copy_ids : []),
    ...(Array.isArray(surface?.minimal_input_actions) ? surface.minimal_input_actions.flatMap((action) => [action.copy_id, action.aria_label_copy_id]) : [])
  ];

  for (const copyId of copyIds) {
    if (typeof copyId !== "string" || !/^SESSION_POLISH_[A-Z0-9_]+$/u.test(copyId)) {
      return {
        ok: false,
        token: "S_V1_U_05_COPY_ID_INVALID",
        copy_id: copyId
      };
    }
  }

  return {
    ok: true,
    checked_copy_id_count: copyIds.length
  };
}

export function renderV1SessionExecutionPolish(input) {
  if (!isPlainObject(input)) {
    throw new TypeError("S-V1-U-05 input must be an object.");
  }

  const sessionState = isPlainObject(input.session_state) ? input.session_state : input;
  const presentation = isPlainObject(input.presentation) ? input.presentation : {};

  const ndMode = normaliseBoolean(presentation.nd_mode);
  const instructionDensity = normaliseInstructionDensity(presentation.instruction_density);
  const lowInput = presentation.low_input_mode === true || ndMode || instructionDensity === "minimal";

  const workItems = readWorkItems(sessionState);
  const runtimeEvents = readRuntimeEvents(sessionState);
  const completedIds = readRecordedSet(sessionState, "completed_ids");
  const skippedIds = readRecordedSet(sessionState, "skipped_ids");
  const partialIds = readRecordedSet(sessionState, "partial_ids");
  const currentWorkItem = buildCurrentWorkItem(workItems, completedIds, skippedIds, partialIds);
  const returnDecisionRequired = sessionState?.return_decision_required === true;

  const minimalInputActions = buildActionList({
    lowInput,
    currentWorkItem,
    returnDecisionRequired
  });

  const sessionTruth = buildSessionTruth({
    sessionState,
    workItems,
    runtimeEvents,
    completedIds,
    skippedIds,
    partialIds,
    currentWorkItem
  });

  return Object.freeze({
    slice_id: SLICE_ID,
    surface_id: SURFACE_ID,
    presentation_only: true,
    engine_visible: false,
    engine_mutation_permitted: false,
    source_session_id: sessionTruth.session_id,
    copy_ids: getSessionExecutionPolishCopyIds(),
    session_truth: sessionTruth,
    progress: buildProgress({
      workItemCount: workItems.length,
      completedIds,
      skippedIds,
      partialIds
    }),
    current_work_item: currentWorkItem,
    minimal_input_actions: minimalInputActions,
    accessibility_contract: buildAccessibilityContract(minimalInputActions),
    nd_presentation: {
      nd_mode: ndMode,
      instruction_density: instructionDensity,
      low_input_mode: lowInput,
      tap_path: lowInput ? "reduced" : "standard",
      visible_action_count: minimalInputActions.length,
      grouped_secondary_actions: lowInput
    },
    copy_lint: {
      copy_id_only: true,
      factual_boundary_copy_id: COPY_IDS.copyBoundary
    }
  });
}

export function extractSessionExecutionTruth(surface) {
  return cloneStable(surface?.session_truth ?? null);
}