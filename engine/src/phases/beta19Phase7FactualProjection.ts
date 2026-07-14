// DEV NOTE: BETA-19 factual Phase 7 projection.
// Every rendered value is echoed or mechanically counted from validated
// BETA-18 Phase 6 truth. No copy, narrative, product, or coach state is read.

import {
  Beta18Phase7SchemaError,
  validateBeta18Phase7Input
} from "./beta18Phase7SchemaBinding.js";

import type {
  Beta18ExecutionStatus,
  Beta18Phase7FailureToken,
  Beta18Phase7Result,
  Phase7Input,
  Phase7Output
} from "./beta18Phase7SchemaBinding.js";

import {
  betaCanonicalHash,
  betaCanonicalJson
} from "./betaCanonical.js";

type JsonRecord =
  Record<string, unknown>;

type WorkItemStatus =
  | "pending"
  | "active"
  | "completed"
  | "skipped";

type ExecutionCounts = Readonly<{
  total: number;
  pending: number;
  active: number;
  completed: number;
  skipped: number;
}>;

type Phase6WorkItem = Readonly<{
  work_item_id: string;
  block_id: string;
  exercise_id: string;
  status: WorkItemStatus;
  started_event_id:
    string | null;
  terminal_event_id:
    string | null;
  terminal_source:
    string | null;
}>;

type Phase6PainRecord = Readonly<{
  work_item_id: string;
  follow_up_pending: boolean;
  flag_event_ids:
    readonly string[];
  follow_up_event_ids:
    readonly string[];
  latest_response_code:
    string | null;
}>;

type Phase6ExecutionState =
  Readonly<{
    reducer_contract_id: string;
    reducer_version: string;
    session_id: string;
    activity_id:
      string | null;
    status:
      Beta18ExecutionStatus;
    classification:
      | "completed"
      | "partial"
      | "terminated"
      | null;
    session_ended: boolean;
    end_code:
      | "completed"
      | "stopped"
      | null;
    ended_by_event_id:
      string | null;
    last_seq: number;
    accepted_event_ids:
      readonly string[];
    event_type_counts:
      Readonly<
        Record<string, number>
      >;
    split: Readonly<{
      active: boolean;
      entered_event_id:
        string | null;
      remaining_at_split_ids:
        readonly string[];
    }>;
    work_item_order:
      readonly string[];
    work_items:
      Readonly<
        Record<
          string,
          Phase6WorkItem
        >
      >;
    pain_follow_up:
      Readonly<
        Record<
          string,
          Phase6PainRecord
        >
      >;
    counts:
      ExecutionCounts;
    reducer_state_hash: string;
  }>;

export type Beta19ProjectionMetadata =
  Readonly<{
    canonical_input_hash: string;
    selection_hash: string;
    execution_status:
      Beta18ExecutionStatus;
    reducer_contract_id: string;
    reducer_version: string;
    reducer_state_hash: string;
  }>;

export type Beta19ProgramSummary =
  Readonly<{
    activity_id:
      string | null;
    session_count: number;
    block_count: number;
    work_item_count: number;
    pending_work_item_count:
      number;
    active_work_item_count:
      number;
    completed_work_item_count:
      number;
    skipped_work_item_count:
      number;
    pain_flag_count: number;
    pain_follow_up_count:
      number;
    accepted_event_count:
      number;
  }>;

export type Beta19BlockSummary =
  Readonly<{
    block_id: string;
    work_item_count: number;
    pending_work_item_count:
      number;
    active_work_item_count:
      number;
    completed_work_item_count:
      number;
    skipped_work_item_count:
      number;
    work_item_ids:
      readonly string[];
    exercise_ids:
      readonly string[];
  }>;

export type Beta19SessionSummary =
  Readonly<{
    session_id: string;
    activity_id:
      string | null;
    execution_status:
      Beta18ExecutionStatus;
    classification:
      | "completed"
      | "partial"
      | "terminated"
      | null;
    session_ended: boolean;
    end_code:
      | "completed"
      | "stopped"
      | null;
    ended_by_event_id:
      string | null;
    accepted_event_count:
      number;
    work_item_count: number;
    pending_work_item_count:
      number;
    active_work_item_count:
      number;
    completed_work_item_count:
      number;
    skipped_work_item_count:
      number;
    pain_flag_count: number;
    pain_follow_up_count:
      number;
    split_active: boolean;
    split_entered_event_id:
      string | null;
    split_remaining_work_item_ids:
      readonly string[];
  }>;

export type Beta19EventDigest =
  Readonly<{
    accepted_event_count:
      number;
    accepted_event_ids:
      readonly string[];
    event_type_counts:
      Readonly<
        Record<string, number>
      >;
    pain_flag_count: number;
    pain_follow_up_count:
      number;
    split_enter_count: number;
    split_return_decision_count:
      number;
    split_continue_count:
      number;
    split_skip_count: number;
    split_skipped_work_item_count:
      number;
  }>;

export type Beta19RenderedProjection =
  Readonly<{
    projection_metadata:
      Beta19ProjectionMetadata;
    program_summary:
      Beta19ProgramSummary;
    block_summary?:
      readonly Beta19BlockSummary[];
    session_list:
      readonly Beta19SessionSummary[];
    event_digest:
      Beta19EventDigest;
  }>;

export const beta19Phase7FactualProjectionContract =
  Object.freeze({
    projection_id:
      "beta19_phase7_factual_projection",
    slice_id: "BETA-19",
    version: "1.0.0",
    input_source:
      "validated_phase6_output_only",
    required_sections:
      Object.freeze([
        "projection_metadata",
        "program_summary",
        "session_list",
        "event_digest"
      ]),
    conditional_sections:
      Object.freeze({
        block_summary:
          "present_only_when_phase6_work_items_contain_block_ids"
      }),
    value_policy:
      "phase6_echo_or_mechanical_count_only",
    natural_language_narrative:
      false,
    copy_registry_usage:
      false,
    product_state_allowed:
      false
  });

const PHASE7_OUTPUT_KEYS =
  Object.freeze([
    "phase7_projection_id",
    "canonical_input_hash",
    "selection_hash",
    "execution_status",
    "execution_state",
    "content_format",
    "rendered_output",
    "projection_hash"
  ] as const);

type MutableBlockSummary = {
  block_id: string;
  work_item_count: number;
  pending_work_item_count:
    number;
  active_work_item_count:
    number;
  completed_work_item_count:
    number;
  skipped_work_item_count:
    number;
  work_item_ids: string[];
  exercise_ids: string[];
};

function isRecord(
  value: unknown
): value is JsonRecord {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function hasOwn(
  value: JsonRecord,
  key: string
): boolean {
  return Object.prototype
    .hasOwnProperty.call(
      value,
      key
    );
}

function cloneJson<T>(
  value: T
): T {
  return JSON.parse(
    JSON.stringify(value)
  ) as T;
}

function deepFreeze<T>(
  value: T
): T {
  if (
    value === null ||
    (
      typeof value !== "object" &&
      typeof value !== "function"
    )
  ) {
    return value;
  }

  if (Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(
    value as object
  );

  if (Array.isArray(value)) {
    for (const child of value) {
      deepFreeze(child);
    }
  }
  else {
    for (
      const child
      of Object.values(
        value as JsonRecord
      )
    ) {
      deepFreeze(child);
    }
  }

  return value;
}

function fail(
  failureToken:
    Beta18Phase7FailureToken,
  message: string,
  details: JsonRecord = {}
): never {
  throw new Beta18Phase7SchemaError(
    failureToken,
    message,
    details
  );
}

function assertRecord(
  value: unknown,
  objectName: string
): asserts value is JsonRecord {
  if (!isRecord(value)) {
    fail(
      "phase7_output_invalid",
      `${objectName} must be an object.`,
      {
        object: objectName
      }
    );
  }
}

function assertExactKeys(
  value: JsonRecord,
  expectedKeys:
    readonly string[],
  objectName: string
): void {
  const expected =
    new Set(expectedKeys);

  for (
    const key
    of Object.keys(value)
  ) {
    if (!expected.has(key)) {
      fail(
        "phase7_output_invalid",
        `${objectName} contains an unknown field.`,
        {
          object: objectName,
          field: key
        }
      );
    }
  }

  for (const key of expectedKeys) {
    if (!hasOwn(value, key)) {
      fail(
        "phase7_output_invalid",
        `${objectName} is missing a required field.`,
        {
          object: objectName,
          field: key
        }
      );
    }
  }
}

function executionState(
  input: Phase7Input
): Phase6ExecutionState {
  return input
    .phase6_output
    .execution_state as
      unknown as
      Phase6ExecutionState;
}

function countPainFlags(
  state:
    Phase6ExecutionState
): number {
  return Object
    .values(
      state.pain_follow_up
    )
    .reduce(
      (
        total,
        record
      ) =>
        total +
        record
          .flag_event_ids
          .length,
      0
    );
}

function countPainFollowUps(
  state:
    Phase6ExecutionState
): number {
  return Object
    .values(
      state.pain_follow_up
    )
    .reduce(
      (
        total,
        record
      ) =>
        total +
        record
          .follow_up_event_ids
          .length,
      0
    );
}

function incrementStatus(
  summary:
    MutableBlockSummary,
  status:
    WorkItemStatus
): void {
  if (status === "pending") {
    summary
      .pending_work_item_count +=
      1;
  }

  if (status === "active") {
    summary
      .active_work_item_count +=
      1;
  }

  if (status === "completed") {
    summary
      .completed_work_item_count +=
      1;
  }

  if (status === "skipped") {
    summary
      .skipped_work_item_count +=
      1;
  }
}

function buildBlockSummary(
  state:
    Phase6ExecutionState
): readonly Beta19BlockSummary[] {
  const blockMap =
    new Map<
      string,
      MutableBlockSummary
    >();

  for (
    const workItemId
    of state.work_item_order
  ) {
    const item =
      state.work_items[
        workItemId
      ];

    if (!item) {
      fail(
        "phase7_binding_mismatch",
        "Phase 6 work-item order references a missing work item.",
        {
          work_item_id:
            workItemId
        }
      );
    }

    let summary =
      blockMap.get(
        item.block_id
      );

    if (!summary) {
      summary = {
        block_id:
          item.block_id,
        work_item_count: 0,
        pending_work_item_count:
          0,
        active_work_item_count:
          0,
        completed_work_item_count:
          0,
        skipped_work_item_count:
          0,
        work_item_ids: [],
        exercise_ids: []
      };

      blockMap.set(
        item.block_id,
        summary
      );
    }

    summary.work_item_count +=
      1;

    summary.work_item_ids.push(
      item.work_item_id
    );

    summary.exercise_ids.push(
      item.exercise_id
    );

    incrementStatus(
      summary,
      item.status
    );
  }

  return Array.from(
    blockMap.values()
  ).map(
    (summary) => ({
      block_id:
        summary.block_id,
      work_item_count:
        summary.work_item_count,
      pending_work_item_count:
        summary
          .pending_work_item_count,
      active_work_item_count:
        summary
          .active_work_item_count,
      completed_work_item_count:
        summary
          .completed_work_item_count,
      skipped_work_item_count:
        summary
          .skipped_work_item_count,
      work_item_ids: [
        ...summary
          .work_item_ids
      ],
      exercise_ids: [
        ...summary
          .exercise_ids
      ]
    })
  );
}

function sortedEventCounts(
  state:
    Phase6ExecutionState
): Readonly<
  Record<string, number>
> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(
        state.event_type_counts
      ).sort(
        ([left], [right]) =>
          left.localeCompare(
            right
          )
      )
    )
  );
}

function buildSplitDigest(
  state:
    Phase6ExecutionState
): Readonly<{
  split_enter_count: number;
  split_return_decision_count:
    number;
  split_continue_count:
    number;
  split_skip_count: number;
  split_skipped_work_item_count:
    number;
}> {
  const splitEnterCount =
    state.event_type_counts[
      "SPLIT_ENTER"
    ] ?? 0;

  const splitReturnCount =
    state.event_type_counts[
      "SPLIT_RETURN_DECISION"
    ] ?? 0;

  const skipEventIds =
    new Set<string>();

  let skippedWorkItemCount =
    0;

  for (
    const item
    of Object.values(
      state.work_items
    )
  ) {
    if (
      item.terminal_source ===
        "split_return_skip"
    ) {
      skippedWorkItemCount +=
        1;

      if (
        item.terminal_event_id !==
        null
      ) {
        skipEventIds.add(
          item.terminal_event_id
        );
      }
    }
  }

  const splitSkipCount =
    skipEventIds.size;

  if (
    splitSkipCount >
    splitReturnCount
  ) {
    fail(
      "phase7_binding_mismatch",
      "Split-skip event count exceeds Phase 6 split-return event count.",
      {
        split_skip_count:
          splitSkipCount,
        split_return_decision_count:
          splitReturnCount
      }
    );
  }

  return Object.freeze({
    split_enter_count:
      splitEnterCount,
    split_return_decision_count:
      splitReturnCount,
    split_continue_count:
      splitReturnCount -
      splitSkipCount,
    split_skip_count:
      splitSkipCount,
    split_skipped_work_item_count:
      skippedWorkItemCount
  });
}

function buildRenderedFromValidated(
  input:
    Phase7Input
): Beta19RenderedProjection {
  const state =
    executionState(input);

  const blockSummary =
    buildBlockSummary(
      state
    );

  const painFlagCount =
    countPainFlags(
      state
    );

  const painFollowUpCount =
    countPainFollowUps(
      state
    );

  const splitDigest =
    buildSplitDigest(
      state
    );

  const acceptedEventCount =
    state.accepted_event_ids
      .length;

  const base:
    Omit<
      Beta19RenderedProjection,
      "block_summary"
    > = {
      projection_metadata: {
        canonical_input_hash:
          input.phase6_output
            .canonical_input_hash,
        selection_hash:
          input.phase6_output
            .selection_hash,
        execution_status:
          input.phase6_output
            .execution_status,
        reducer_contract_id:
          state
            .reducer_contract_id,
        reducer_version:
          state.reducer_version,
        reducer_state_hash:
          state
            .reducer_state_hash
      },
      program_summary: {
        activity_id:
          state.activity_id,
        session_count: 1,
        block_count:
          blockSummary.length,
        work_item_count:
          state.counts.total,
        pending_work_item_count:
          state.counts.pending,
        active_work_item_count:
          state.counts.active,
        completed_work_item_count:
          state.counts.completed,
        skipped_work_item_count:
          state.counts.skipped,
        pain_flag_count:
          painFlagCount,
        pain_follow_up_count:
          painFollowUpCount,
        accepted_event_count:
          acceptedEventCount
      },
      session_list: [
        {
          session_id:
            state.session_id,
          activity_id:
            state.activity_id,
          execution_status:
            input.phase6_output
              .execution_status,
          classification:
            state.classification,
          session_ended:
            state.session_ended,
          end_code:
            state.end_code,
          ended_by_event_id:
            state
              .ended_by_event_id,
          accepted_event_count:
            acceptedEventCount,
          work_item_count:
            state.counts.total,
          pending_work_item_count:
            state.counts.pending,
          active_work_item_count:
            state.counts.active,
          completed_work_item_count:
            state.counts.completed,
          skipped_work_item_count:
            state.counts.skipped,
          pain_flag_count:
            painFlagCount,
          pain_follow_up_count:
            painFollowUpCount,
          split_active:
            state.split.active,
          split_entered_event_id:
            state.split
              .entered_event_id,
          split_remaining_work_item_ids:
            [
              ...state.split
                .remaining_at_split_ids
            ]
        }
      ],
      event_digest: {
        accepted_event_count:
          acceptedEventCount,
        accepted_event_ids: [
          ...state
            .accepted_event_ids
        ],
        event_type_counts:
          sortedEventCounts(
            state
          ),
        pain_flag_count:
          painFlagCount,
        pain_follow_up_count:
          painFollowUpCount,
        ...splitDigest
      }
    };

  if (blockSummary.length === 0) {
    return deepFreeze(base);
  }

  return deepFreeze({
    ...base,
    block_summary:
      blockSummary
  });
}

export function buildBeta19Phase7RenderedProjection(
  value: unknown
): Beta19RenderedProjection {
  const input =
    validateBeta18Phase7Input(
      value
    );

  return buildRenderedFromValidated(
    input
  );
}

function outputWithoutHash(
  output:
    Omit<
      Phase7Output,
      "projection_hash"
    >
): JsonRecord {
  return {
    phase7_projection_id:
      output
        .phase7_projection_id,
    canonical_input_hash:
      output
        .canonical_input_hash,
    selection_hash:
      output.selection_hash,
    execution_status:
      output.execution_status,
    execution_state:
      output.execution_state,
    content_format:
      output.content_format,
    rendered_output:
      output.rendered_output
  };
}

export function projectBeta19Phase7(
  value: unknown
): Phase7Output {
  const input =
    validateBeta18Phase7Input(
      value
    );

  const renderedProjection =
    buildRenderedFromValidated(
      input
    );

  const candidate:
    Omit<
      Phase7Output,
      "projection_hash"
    > = {
      phase7_projection_id:
        input.phase7_projection_id,
      canonical_input_hash:
        input.phase6_output
          .canonical_input_hash,
      selection_hash:
        input.phase6_output
          .selection_hash,
      execution_status:
        input.phase6_output
          .execution_status,
      execution_state:
        cloneJson(
          input.phase6_output
            .execution_state
        ),
      content_format:
        input.content_format,
      rendered_output:
        betaCanonicalJson(
          renderedProjection
        )
    };

  return deepFreeze({
    ...candidate,
    projection_hash:
      betaCanonicalHash(
        outputWithoutHash(
          candidate
        )
      )
  });
}

export function validateBeta19Phase7Output(
  inputValue: unknown,
  outputValue: unknown
): Phase7Output {
  const input =
    validateBeta18Phase7Input(
      inputValue
    );

  assertRecord(
    outputValue,
    "phase7_output"
  );

  assertExactKeys(
    outputValue,
    PHASE7_OUTPUT_KEYS,
    "phase7_output"
  );

  if (
    outputValue
      .phase7_projection_id !==
    input.phase7_projection_id
  ) {
    fail(
      "phase7_binding_mismatch",
      "Projection ID does not match the admitted Phase 7 input."
    );
  }

  if (
    outputValue
      .canonical_input_hash !==
    input.phase6_output
      .canonical_input_hash
  ) {
    fail(
      "phase7_binding_mismatch",
      "Canonical input hash echo mismatch."
    );
  }

  if (
    outputValue.selection_hash !==
    input.phase6_output
      .selection_hash
  ) {
    fail(
      "phase7_binding_mismatch",
      "Selection hash echo mismatch."
    );
  }

  if (
    outputValue.execution_status !==
    input.phase6_output
      .execution_status
  ) {
    fail(
      "phase7_binding_mismatch",
      "Execution status echo mismatch."
    );
  }

  if (
    betaCanonicalJson(
      outputValue.execution_state
    ) !==
    betaCanonicalJson(
      input.phase6_output
        .execution_state
    )
  ) {
    fail(
      "phase7_binding_mismatch",
      "Execution state echo mismatch."
    );
  }

  if (
    outputValue.content_format !==
    input.content_format
  ) {
    fail(
      "phase7_output_invalid",
      "Content format does not match the admitted Phase 7 input."
    );
  }

  const expectedRenderedOutput =
    betaCanonicalJson(
      buildRenderedFromValidated(
        input
      )
    );

  if (
    typeof outputValue
      .rendered_output !==
      "string" ||
    outputValue.rendered_output !==
      expectedRenderedOutput
  ) {
    fail(
      "phase7_output_invalid",
      "Rendered output is not the exact factual Phase 6 projection."
    );
  }

  if (
    typeof outputValue
      .projection_hash !==
      "string" ||
    !/^[a-f0-9]{64}$/u.test(
      outputValue
        .projection_hash
    )
  ) {
    fail(
      "phase7_output_invalid",
      "Projection hash must be a lowercase SHA-256 hash."
    );
  }

  const expectedProjectionHash =
    betaCanonicalHash({
      phase7_projection_id:
        outputValue
          .phase7_projection_id,
      canonical_input_hash:
        outputValue
          .canonical_input_hash,
      selection_hash:
        outputValue
          .selection_hash,
      execution_status:
        outputValue
          .execution_status,
      execution_state:
        outputValue
          .execution_state,
      content_format:
        outputValue
          .content_format,
      rendered_output:
        outputValue
          .rendered_output
    });

  if (
    outputValue.projection_hash !==
      expectedProjectionHash
  ) {
    fail(
      "phase7_projection_hash_mismatch",
      "Phase 7 output does not match its projection hash.",
      {
        expected:
          expectedProjectionHash,
        actual:
          outputValue
            .projection_hash
      }
    );
  }

  return deepFreeze(
    cloneJson(
      outputValue
    ) as unknown as
      Phase7Output
  );
}

export function tryProjectBeta19Phase7(
  value: unknown
): Beta18Phase7Result {
  try {
    return deepFreeze({
      ok: true,
      phase7:
        projectBeta19Phase7(
          value
        )
    });
  }
  catch (error) {
    if (
      error instanceof
        Beta18Phase7SchemaError
    ) {
      return deepFreeze({
        ok: false,
        failure_token:
          error.failure_token,
        details:
          error.details
      });
    }

    return deepFreeze({
      ok: false,
      failure_token:
        "phase7_input_invalid",
      details: {
        reason:
          error instanceof Error
            ? error.message
            : String(error)
      }
    });
  }
}
