// DEV NOTE: BETA-19 factual Phase 7 projection tests.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  beta19Phase7FactualProjectionContract,
  projectBeta19Phase7,
  tryProjectBeta19Phase7,
  validateBeta19Phase7Output
} from "../engine/dist/src/phases/beta19Phase7FactualProjection.js";

import {
  betaCanonicalHash,
  betaCanonicalJson
} from "../engine/dist/src/phases/betaCanonical.js";

import {
  materialiseBeta12Phase5
} from "../engine/dist/src/phases/beta12Phase5Materialisation.js";

import {
  appendBeta13Phase6EventLog
} from "../engine/dist/src/runtime/beta13_phase6_event_schema.js";

import {
  replayBeta14Phase6RuntimeEvents
} from "../engine/dist/src/runtime/beta14_phase6_runtime_reducer.js";

function readJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(
      relativePath,
      "utf8"
    )
  );
}

function clone(value) {
  return JSON.parse(
    JSON.stringify(value)
  );
}

function sha256(content) {
  return crypto
    .createHash("sha256")
    .update(content, "utf8")
    .digest("hex");
}

function expectToken(
  action,
  expectedToken
) {
  assert.throws(
    action,
    (error) =>
      error?.failure_token ===
      expectedToken
  );
}

function appendRaw(
  session,
  events,
  raw
) {
  return appendBeta13Phase6EventLog(
    session,
    events,
    session.session_id,
    raw
  );
}

function completeWorkItem(
  session,
  events,
  workItemId
) {
  let next = appendRaw(
    session,
    events,
    {
      event_type:
        "WORK_ITEM_START",
      work_item_id:
        workItemId
    }
  );

  next = appendRaw(
    session,
    next,
    {
      event_type:
        "WORK_ITEM_DONE",
      work_item_id:
        workItemId
    }
  );

  return next;
}

const scenarios = readJson(
  "test/fixtures/beta_19_phase7_factual_projection/scenarios.json"
);

function scenarioRecord(
  scenarioId
) {
  const record =
    scenarios.scenarios.find(
      (candidate) =>
        candidate.scenario_id ===
        scenarioId
    );

  assert.ok(
    record,
    `Missing scenario ${scenarioId}`
  );

  return record;
}

function materialisedSession() {
  const phase4 = readJson(
    scenarios.source_fixture
  );

  const phase5 =
    materialiseBeta12Phase5(
      phase4
    );

  assert.equal(
    phase5.ok,
    true
  );

  const baseSession =
    phase5.phase5
      .executable_session;

  assert.equal(
    baseSession
      .planned_items
      .length,
    1
  );

  const firstItem =
    clone(
      baseSession
        .planned_items[0]
    );

  const firstBlock =
    clone(
      baseSession
        .blocks[0]
    );

  const secondCandidate =
    phase4
      .enumerated_solution_space
      .find(
        (candidate) =>
          candidate
            .exercise_ids[0] !==
          firstItem.exercise_id
      );

  assert.ok(
    secondCandidate
  );

  const secondItemId =
    `${firstItem.item_id}_beta19_1`;

  const session = {
    ...clone(
      baseSession
    ),
    blocks: [
      {
        ...firstBlock,
        item_ids: [
          ...firstBlock
            .item_ids,
          secondItemId
        ]
      }
    ],
    planned_items: [
      firstItem,
      {
        ...firstItem,
        item_id:
          secondItemId,
        exercise_id:
          secondCandidate
            .exercise_ids[0]
      }
    ]
  };

  assert.equal(
    session
      .planned_items
      .length,
    2
  );

  assert.deepEqual(
    session
      .blocks[0]
      .item_ids,
    session
      .planned_items
      .map(
        (item) =>
          item.item_id
      )
  );

  return {
    phase5:
      phase5.phase5,
    session
  };
}

function buildScenarioInput(
  scenarioId
) {
  const expected =
    scenarioRecord(
      scenarioId
    );

  const {
    phase5,
    session
  } = materialisedSession();

  const workItemIds =
    session.planned_items.map(
      (item) =>
        item.item_id
    );

  let events = [];

  events = appendRaw(
    session,
    events,
    {
      event_type:
        "SESSION_START"
    }
  );

  if (
    scenarioId ===
      "completed_session"
  ) {
    for (
      const workItemId
      of workItemIds
    ) {
      events =
        completeWorkItem(
          session,
          events,
          workItemId
        );
    }

    events = appendRaw(
      session,
      events,
      {
        event_type:
          "SESSION_END",
        end_code:
          "completed"
      }
    );
  }

  if (
    scenarioId ===
      "partial_session"
  ) {
    events =
      completeWorkItem(
        session,
        events,
        workItemIds[0]
      );

    events = appendRaw(
      session,
      events,
      {
        event_type:
          "SESSION_END",
        end_code:
          "stopped"
      }
    );
  }

  if (
    scenarioId ===
      "split_continue"
  ) {
    events = appendRaw(
      session,
      events,
      {
        event_type:
          "SPLIT_ENTER"
      }
    );

    events = appendRaw(
      session,
      events,
      {
        event_type:
          "SPLIT_RETURN_DECISION",
        decision:
          "continue"
      }
    );

    for (
      const workItemId
      of workItemIds
    ) {
      events =
        completeWorkItem(
          session,
          events,
          workItemId
        );
    }

    events = appendRaw(
      session,
      events,
      {
        event_type:
          "SESSION_END",
        end_code:
          "completed"
      }
    );
  }

  if (
    scenarioId ===
      "split_skip"
  ) {
    events =
      completeWorkItem(
        session,
        events,
        workItemIds[0]
      );

    events = appendRaw(
      session,
      events,
      {
        event_type:
          "SPLIT_ENTER"
      }
    );

    events = appendRaw(
      session,
      events,
      {
        event_type:
          "SPLIT_RETURN_DECISION",
        decision:
          "skip_remaining"
      }
    );

    events = appendRaw(
      session,
      events,
      {
        event_type:
          "SESSION_END",
        end_code:
          "stopped"
      }
    );
  }

  if (
    scenarioId ===
      "pain_flag"
  ) {
    events = appendRaw(
      session,
      events,
      {
        event_type:
          "WORK_ITEM_START",
        work_item_id:
          workItemIds[0]
      }
    );

    events = appendRaw(
      session,
      events,
      {
        event_type:
          "PAIN_FLAG",
        work_item_id:
          workItemIds[0],
        follow_up_required:
          true
      }
    );

    events = appendRaw(
      session,
      events,
      {
        event_type:
          "PAIN_FOLLOW_UP",
        work_item_id:
          workItemIds[0],
        response_code:
          "continue"
      }
    );

    events = appendRaw(
      session,
      events,
      {
        event_type:
          "WORK_ITEM_DONE",
        work_item_id:
          workItemIds[0]
      }
    );

    events = appendRaw(
      session,
      events,
      {
        event_type:
          "SESSION_END",
        end_code:
          "stopped"
      }
    );
  }

  const state =
    replayBeta14Phase6RuntimeEvents(
      session,
      events
    );

  assert.equal(
    state.status,
    expected.expected_status
  );

  return {
    phase5,
    session,
    state,
    input: {
      phase7_projection_id:
        `beta19_${scenarioId}`,
      content_format:
        "application/json",
      phase6_output: {
        canonical_input_hash:
          phase5
            .canonical_input_hash,
        selection_hash:
          phase5.selection_hash,
        execution_status:
          state.status,
        execution_state:
          state
      }
    }
  };
}

function buildEmptySessionInput() {
  const {
    phase5
  } = materialisedSession();

  const session = {
    session_id:
      "beta19_empty_session",
    activity_id:
      "powerlifting",
    blocks: [],
    planned_items: []
  };

  let events = [];

  events = appendRaw(
    session,
    events,
    {
      event_type:
        "SESSION_START"
    }
  );

  events = appendRaw(
    session,
    events,
    {
      event_type:
        "SESSION_END",
      end_code:
        "stopped"
    }
  );

  const state =
    replayBeta14Phase6RuntimeEvents(
      session,
      events
    );

  assert.equal(
    state.status,
    "terminated"
  );

  return {
    phase7_projection_id:
      "beta19_empty_projection",
    content_format:
      "application/json",
    phase6_output: {
      canonical_input_hash:
        phase5
          .canonical_input_hash,
      selection_hash:
        phase5.selection_hash,
      execution_status:
        state.status,
      execution_state:
        state
    }
  };
}

function parsedProjection(
  output
) {
  return JSON.parse(
    output.rendered_output
  );
}

function rehashOutput(
  output
) {
  const payload =
    clone(output);

  delete payload
    .projection_hash;

  output.projection_hash =
    betaCanonicalHash(
      payload
    );

  return output;
}

test(
  "BETA-19 exposes the exact factual projection section contract",
  () => {
    assert.equal(
      beta19Phase7FactualProjectionContract
        .slice_id,
      "BETA-19"
    );

    assert.equal(
      beta19Phase7FactualProjectionContract
        .input_source,
      "validated_phase6_output_only"
    );

    assert.deepEqual(
      beta19Phase7FactualProjectionContract
        .required_sections,
      [
        "projection_metadata",
        "program_summary",
        "session_list",
        "event_digest"
      ]
    );

    assert.equal(
      beta19Phase7FactualProjectionContract
        .natural_language_narrative,
      false
    );

    assert.equal(
      beta19Phase7FactualProjectionContract
        .copy_registry_usage,
      false
    );
  }
);

test(
  "BETA-19 completed session projection contains factual sections only",
  () => {
    const {
      input,
      state
    } = buildScenarioInput(
      "completed_session"
    );

    const output =
      projectBeta19Phase7(
        input
      );

    const projection =
      parsedProjection(
        output
      );

    assert.deepEqual(
      Object.keys(
        projection
      ).sort(),
      [
        "block_summary",
        "event_digest",
        "program_summary",
        "projection_metadata",
        "session_list"
      ]
    );

    assert.equal(
      projection
        .projection_metadata
        .canonical_input_hash,
      input.phase6_output
        .canonical_input_hash
    );

    assert.equal(
      projection
        .program_summary
        .session_count,
      1
    );

    assert.equal(
      projection
        .program_summary
        .work_item_count,
      state.counts.total
    );

    assert.equal(
      projection
        .program_summary
        .completed_work_item_count,
      state.counts.completed
    );

    assert.equal(
      projection
        .session_list
        .length,
      1
    );

    assert.equal(
      projection
        .session_list[0]
        .session_id,
      state.session_id
    );

    assert.equal(
      projection
        .event_digest
        .accepted_event_count,
      state.last_seq
    );

    assert.deepEqual(
      validateBeta19Phase7Output(
        input,
        output
      ),
      output
    );
  }
);

test(
  "BETA-19 partial session projection echoes partial factual counts",
  () => {
    const {
      input,
      state
    } = buildScenarioInput(
      "partial_session"
    );

    const projection =
      parsedProjection(
        projectBeta19Phase7(
          input
        )
      );

    assert.equal(
      projection
        .session_list[0]
        .execution_status,
      "partial"
    );

    assert.equal(
      projection
        .program_summary
        .completed_work_item_count,
      1
    );

    assert.equal(
      projection
        .program_summary
        .pending_work_item_count,
      state.counts.pending
    );

    assert.equal(
      projection
        .program_summary
        .skipped_work_item_count,
      state.counts.skipped
    );
  }
);

test(
  "BETA-19 split continue projection mechanically counts continue decision",
  () => {
    const {
      input
    } = buildScenarioInput(
      "split_continue"
    );

    const projection =
      parsedProjection(
        projectBeta19Phase7(
          input
        )
      );

    assert.equal(
      projection
        .event_digest
        .split_enter_count,
      1
    );

    assert.equal(
      projection
        .event_digest
        .split_return_decision_count,
      1
    );

    assert.equal(
      projection
        .event_digest
        .split_continue_count,
      1
    );

    assert.equal(
      projection
        .event_digest
        .split_skip_count,
      0
    );

    assert.equal(
      projection
        .event_digest
        .split_skipped_work_item_count,
      0
    );
  }
);

test(
  "BETA-19 split skip projection mechanically counts skipped work items",
  () => {
    const {
      input,
      state
    } = buildScenarioInput(
      "split_skip"
    );

    const projection =
      parsedProjection(
        projectBeta19Phase7(
          input
        )
      );

    assert.equal(
      projection
        .event_digest
        .split_continue_count,
      0
    );

    assert.equal(
      projection
        .event_digest
        .split_skip_count,
      1
    );

    assert.equal(
      projection
        .event_digest
        .split_skipped_work_item_count,
      state.counts.skipped
    );

    assert.equal(
      projection
        .program_summary
        .skipped_work_item_count,
      state.counts.skipped
    );
  }
);

test(
  "BETA-19 pain flag projection is a factual event count",
  () => {
    const {
      input,
      state
    } = buildScenarioInput(
      "pain_flag"
    );

    const projection =
      parsedProjection(
        projectBeta19Phase7(
          input
        )
      );

    assert.equal(
      projection
        .event_digest
        .pain_flag_count,
      1
    );

    assert.equal(
      projection
        .event_digest
        .pain_follow_up_count,
      1
    );

    assert.equal(
      projection
        .event_digest
        .event_type_counts
        .PAIN_FLAG,
      state
        .event_type_counts
        .PAIN_FLAG
    );

    assert.equal(
      projection
        .session_list[0]
        .pain_flag_count,
      1
    );
  }
);

test(
  "BETA-19 omits block summary when Phase 6 contains no block facts",
  () => {
    const input =
      buildEmptySessionInput();

    const projection =
      parsedProjection(
        projectBeta19Phase7(
          input
        )
      );

    assert.equal(
      Object.prototype
        .hasOwnProperty.call(
          projection,
          "block_summary"
        ),
      false
    );

    assert.equal(
      projection
        .program_summary
        .block_count,
      0
    );

    assert.equal(
      projection
        .program_summary
        .work_item_count,
      0
    );
  }
);

test(
  "BETA-19 projection cannot invent block facts",
  () => {
    const {
      input
    } = buildScenarioInput(
      "completed_session"
    );

    const output =
      clone(
        projectBeta19Phase7(
          input
        )
      );

    const projection =
      parsedProjection(
        output
      );

    projection
      .block_summary
      .push({
        block_id:
          "invented_block",
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
      });

    output.rendered_output =
      betaCanonicalJson(
        projection
      );

    rehashOutput(output);

    expectToken(
      () =>
        validateBeta19Phase7Output(
          input,
          output
        ),
      "phase7_output_invalid"
    );
  }
);

test(
  "BETA-19 projection cannot invent session facts",
  () => {
    const {
      input
    } = buildScenarioInput(
      "completed_session"
    );

    const output =
      clone(
        projectBeta19Phase7(
          input
        )
      );

    const projection =
      parsedProjection(
        output
      );

    projection
      .session_list
      .push({
        ...projection
          .session_list[0],
        session_id:
          "invented_session"
      });

    output.rendered_output =
      betaCanonicalJson(
        projection
      );

    rehashOutput(output);

    expectToken(
      () =>
        validateBeta19Phase7Output(
          input,
          output
        ),
      "phase7_output_invalid"
    );
  }
);

test(
  "BETA-19 projection cannot include coach note",
  () => {
    const {
      input
    } = buildScenarioInput(
      "completed_session"
    );

    const contaminatedInput =
      clone(input);

    contaminatedInput
      .phase6_output
      .coach_note =
      "not engine truth";

    const result =
      tryProjectBeta19Phase7(
        contaminatedInput
      );

    assert.equal(
      result.ok,
      false
    );

    assert.equal(
      result.failure_token,
      "phase7_forbidden_input"
    );

    const output =
      clone(
        projectBeta19Phase7(
          input
        )
      );

    const projection =
      parsedProjection(
        output
      );

    projection.coach_note =
      "not allowed";

    output.rendered_output =
      betaCanonicalJson(
        projection
      );

    rehashOutput(output);

    expectToken(
      () =>
        validateBeta19Phase7Output(
          input,
          output
        ),
      "phase7_output_invalid"
    );
  }
);

test(
  "BETA-19 rendered output contains no narrative or judgement fields",
  () => {
    const {
      input
    } = buildScenarioInput(
      "completed_session"
    );

    const rendered =
      projectBeta19Phase7(
        input
      ).rendered_output
        .toLowerCase();

    for (const forbidden of [
      "advice",
      "interpretation",
      "coaching",
      "recommendation",
      "safety",
      "suitability",
      "readiness",
      "performance_judgement",
      "optimal"
    ]) {
      assert.equal(
        rendered.includes(
          forbidden
        ),
        false,
        forbidden
      );
    }
  }
);

test(
  "BETA-19 rendered output is deterministic and does not mutate Phase 6",
  () => {
    const {
      input
    } = buildScenarioInput(
      "completed_session"
    );

    const before =
      betaCanonicalJson(
        input
      );

    const first =
      projectBeta19Phase7(
        input
      );

    const second =
      projectBeta19Phase7(
        clone(input)
      );

    assert.equal(
      betaCanonicalJson(first),
      betaCanonicalJson(second)
    );

    assert.equal(
      betaCanonicalJson(input),
      before
    );
  }
);

test(
  "BETA-19 rendered output schema is closed-world",
  () => {
    const schema = readJson(
      "schema/beta19_phase7_rendered_output.schema.json"
    );

    assert.equal(
      schema.additionalProperties,
      false
    );

    assert.deepEqual(
      schema.required,
      [
        "projection_metadata",
        "program_summary",
        "session_list",
        "event_digest"
      ]
    );

    assert.equal(
      schema.properties
        .projection_metadata
        .additionalProperties,
      false
    );

    assert.equal(
      schema.properties
        .program_summary
        .additionalProperties,
      false
    );

    assert.equal(
      schema.properties
        .block_summary
        .items
        .additionalProperties,
      false
    );

    assert.equal(
      schema.properties
        .session_list
        .items
        .additionalProperties,
      false
    );

    assert.equal(
      schema.properties
        .event_digest
        .additionalProperties,
      false
    );
  }
);

test(
  "BETA-19 fixture manifest is current and complete",
  () => {
    const root = path.join(
      "test",
      "fixtures",
      "beta_19_phase7_factual_projection"
    );

    const manifest = readJson(
      path.join(
        root,
        "manifest.json"
      )
    );

    assert.deepEqual(
      manifest.scenario_ids,
      [
        "completed_session",
        "partial_session",
        "split_continue",
        "split_skip",
        "pain_flag"
      ]
    );

    const entry =
      manifest.fixtures[0];

    const content =
      fs.readFileSync(
        path.join(
          root,
          entry.file
        ),
        "utf8"
      );

    assert.equal(
      sha256(content),
      entry.sha256
    );
  }
);

test(
  "BETA-19 v0 compatibility uses one exact Phase 7 module exclusion",
  () => {
    const source =
      fs.readFileSync(
        "ci/scripts/kolosseum_v0_test_suite_core.mjs",
        "utf8"
      );

    const exactPath =
      "engine/src/phases/beta19Phase7FactualProjection.ts";

    assert.equal(
      source.split(
        `"${exactPath}"`
      ).length - 1,
      1
    );

    assert.equal(
      source.includes(
        '"engine/src/phases"'
      ),
      false
    );
  }
);

test(
  "BETA-19 source has no Copy Registry product or coach dependency",
  () => {
    const source =
      fs.readFileSync(
        "engine/src/phases/beta19Phase7FactualProjection.ts",
        "utf8"
      );

    for (const forbiddenImport of [
      'from "copy/',
      'from "../copy',
      'from "../../copy',
      'from "public/',
      'from "server/',
      'from "src/api',
      "coachNotes",
      "billing",
      "stripe"
    ]) {
      assert.equal(
        source.includes(
          forbiddenImport
        ),
        false,
        forbiddenImport
      );
    }

    assert.equal(
      source.includes(
        'from "./beta18Phase7SchemaBinding.js"'
      ),
      true
    );
  }
);
