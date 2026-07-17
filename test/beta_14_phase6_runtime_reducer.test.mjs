// DEV NOTE: BETA-14 deterministic Phase 6 factual runtime reducer proof.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  appendBeta13Phase6EventLog,
  materialiseBeta13Phase6Event
} from "../engine/dist/src/runtime/beta13_phase6_event_schema.js";

import {
  appendAndReduceBeta14Phase6RuntimeEvent,
  applyBeta14Phase6RuntimeEvent,
  beta14Phase6RuntimeReducerContract,
  initialiseBeta14Phase6RuntimeState,
  replayBeta14Phase6RuntimeEvents,
  stableBeta14Phase6RuntimeStateJson,
  tryReplayBeta14Phase6RuntimeEvents
} from "../engine/dist/src/runtime/beta14_phase6_runtime_reducer.js";

const here = path.dirname(
  fileURLToPath(import.meta.url)
);

const fixtureRoot = path.join(
  here,
  "fixtures",
  "beta_14_phase6_runtime_reducer"
);

function readJson(filePath) {
  return JSON.parse(
    fs.readFileSync(filePath, "utf8")
  );
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadScenario(name) {
  const scenario = readJson(
    path.join(fixtureRoot, `${name}.json`)
  );

  const session = readJson(
    path.resolve(
      fixtureRoot,
      scenario.session_fixture
    )
  );

  let events = [];

  for (const raw of scenario.raw_events) {
    events = appendBeta13Phase6EventLog(
      session,
      events,
      session.session_id,
      raw
    );
  }

  return {
    scenario,
    session,
    events
  };
}

function expectFailure(
  action,
  failureToken
) {
  assert.throws(
    action,
    (error) =>
      error?.failure_token === failureToken
  );
}

test(
  "BETA-14 exposes deterministic factual reducer law",
  () => {
    assert.equal(
      beta14Phase6RuntimeReducerContract.slice_id,
      "BETA-14"
    );

    assert.equal(
      beta14Phase6RuntimeReducerContract.append_policy,
      "append_only_exact_next_seq"
    );

    assert.equal(
      beta14Phase6RuntimeReducerContract.future_engine_effect,
      "none"
    );

    assert.deepEqual(
      beta14Phase6RuntimeReducerContract
        .terminal_classifications,
      [
        "completed",
        "partial",
        "terminated"
      ]
    );
  }
);

test(
  "BETA-14 happy path completed session",
  () => {
    const {
      session,
      events
    } = loadScenario("completed");

    const state =
      replayBeta14Phase6RuntimeEvents(
        session,
        events
      );

    assert.equal(state.status, "completed");
    assert.equal(
      state.classification,
      "completed"
    );

    assert.deepEqual(state.counts, {
      total: 2,
      pending: 0,
      active: 0,
      completed: 2,
      skipped: 0
    });
  }
);

test(
  "BETA-14 happy path partial completion",
  () => {
    const {
      session,
      events
    } = loadScenario("partial");

    const state =
      replayBeta14Phase6RuntimeEvents(
        session,
        events
      );

    assert.equal(state.status, "partial");
    assert.equal(
      state.classification,
      "partial"
    );

    assert.deepEqual(state.counts, {
      total: 2,
      pending: 1,
      active: 0,
      completed: 1,
      skipped: 0
    });
  }
);

test(
  "BETA-14 happy path split return continue",
  () => {
    const {
      session,
      events
    } = loadScenario("split_continue");

    const state =
      replayBeta14Phase6RuntimeEvents(
        session,
        events
      );

    assert.equal(state.status, "completed");
    assert.equal(state.split.active, false);

    assert.deepEqual(
      state.split.remaining_at_split_ids,
      []
    );
  }
);

test(
  "BETA-14 happy path split return skip",
  () => {
    const {
      session,
      events
    } = loadScenario("split_skip");

    const state =
      replayBeta14Phase6RuntimeEvents(
        session,
        events
      );

    assert.equal(state.status, "partial");
    assert.equal(
      state.classification,
      "partial"
    );

    assert.equal(
      state.work_items
        .beta13_item_powerlifting_1
        .status,
      "skipped"
    );

    assert.equal(
      state.work_items
        .beta13_item_powerlifting_1
        .terminal_source,
      "split_return_skip"
    );
  }
);

test(
  "BETA-14 terminated classification is factual",
  () => {
    const {
      session,
      events
    } = loadScenario("terminated");

    const state =
      replayBeta14Phase6RuntimeEvents(
        session,
        events
      );

    assert.equal(state.status, "terminated");
    assert.equal(
      state.classification,
      "terminated"
    );
  }
);

test(
  "BETA-14 replay is byte-stable and equals incremental reduction",
  () => {
    for (const name of [
      "completed",
      "partial",
      "split_continue",
      "split_skip",
      "terminated"
    ]) {
      const {
        session,
        events
      } = loadScenario(name);

      let incremental =
        initialiseBeta14Phase6RuntimeState(
          session
        );

      for (const event of events) {
        incremental =
          applyBeta14Phase6RuntimeEvent(
            session,
            incremental,
            event
          );
      }

      const first =
        replayBeta14Phase6RuntimeEvents(
          session,
          events
        );

      const second =
        replayBeta14Phase6RuntimeEvents(
          clone(session),
          clone(events)
        );

      assert.equal(
        stableBeta14Phase6RuntimeStateJson(
          first
        ),
        stableBeta14Phase6RuntimeStateJson(
          second
        ),
        name
      );

      assert.equal(
        stableBeta14Phase6RuntimeStateJson(
          first
        ),
        stableBeta14Phase6RuntimeStateJson(
          incremental
        ),
        name
      );
    }
  }
);

test(
  "BETA-14 append helper materialises and reduces one factual event",
  () => {
    const {
      session
    } = loadScenario("completed");

    const result =
      appendAndReduceBeta14Phase6RuntimeEvent(
        session,
        [],
        session.session_id,
        {
          event_type: "SESSION_START"
        }
      );

    assert.equal(result.event_log.length, 1);
    assert.equal(
      result.state.status,
      "in_progress"
    );

    assert.equal(
      Object.isFrozen(result),
      true
    );
  }
);

test(
  "BETA-14 rejects work completion before start without changing prior state",
  () => {
    const {
      session
    } = loadScenario("completed");

    const state =
      initialiseBeta14Phase6RuntimeState(
        session
      );

    const before =
      stableBeta14Phase6RuntimeStateJson(
        state
      );

    const invalidEvent =
      materialiseBeta13Phase6Event(
        session,
        session.session_id,
        {
          event_type: "WORK_ITEM_DONE",
          work_item_id:
            session.planned_items[0].item_id
        },
        1
      );

    expectFailure(
      () =>
        applyBeta14Phase6RuntimeEvent(
          session,
          state,
          invalidEvent
        ),
      "phase6_runtime_reducer_event_order_invalid"
    );

    assert.equal(
      stableBeta14Phase6RuntimeStateJson(
        state
      ),
      before
    );
  }
);

test(
  "BETA-14 rejects return decision without active split",
  () => {
    const {
      session
    } = loadScenario("split_continue");

    const start =
      materialiseBeta13Phase6Event(
        session,
        session.session_id,
        {
          event_type: "SESSION_START"
        },
        1
      );

    const state =
      applyBeta14Phase6RuntimeEvent(
        session,
        initialiseBeta14Phase6RuntimeState(
          session
        ),
        start
      );

    const invalidReturn =
      materialiseBeta13Phase6Event(
        session,
        session.session_id,
        {
          event_type:
            "SPLIT_RETURN_DECISION",
          decision: "continue"
        },
        2
      );

    expectFailure(
      () =>
        applyBeta14Phase6RuntimeEvent(
          session,
          state,
          invalidReturn
        ),
      "phase6_runtime_reducer_event_order_invalid"
    );
  }
);

test(
  "BETA-14 append-only truth rejects duplicate sequence",
  () => {
    const {
      session
    } = loadScenario("completed");

    const start =
      materialiseBeta13Phase6Event(
        session,
        session.session_id,
        {
          event_type: "SESSION_START"
        },
        1
      );

    const state =
      applyBeta14Phase6RuntimeEvent(
        session,
        initialiseBeta14Phase6RuntimeState(
          session
        ),
        start
      );

    const duplicateSeq =
      materialiseBeta13Phase6Event(
        session,
        session.session_id,
        {
          event_type: "WORK_ITEM_START",
          work_item_id:
            session.planned_items[0].item_id
        },
        1
      );

    expectFailure(
      () =>
        applyBeta14Phase6RuntimeEvent(
          session,
          state,
          duplicateSeq
        ),
      "phase6_runtime_reducer_append_only_violation"
    );
  }
);

test(
  "BETA-14 rejects post-hoc reducer state editing",
  () => {
    const {
      session
    } = loadScenario("completed");

    const start =
      materialiseBeta13Phase6Event(
        session,
        session.session_id,
        {
          event_type: "SESSION_START"
        },
        1
      );

    const state =
      applyBeta14Phase6RuntimeEvent(
        session,
        initialiseBeta14Phase6RuntimeState(
          session
        ),
        start
      );

    const tampered = clone(state);
    tampered.status = "completed";

    const next =
      materialiseBeta13Phase6Event(
        session,
        session.session_id,
        {
          event_type: "WORK_ITEM_START",
          work_item_id:
            session.planned_items[0].item_id
        },
        2
      );

    expectFailure(
      () =>
        applyBeta14Phase6RuntimeEvent(
          session,
          tampered,
          next
        ),
      "phase6_runtime_reducer_state_tampered"
    );
  }
);

test(
  "BETA-14 rejects post-hoc canonical event editing",
  () => {
    const {
      session,
      events
    } = loadScenario("completed");

    const tampered = clone(events);

    tampered[1].event_type =
      "WORK_ITEM_DONE";

    const result =
      tryReplayBeta14Phase6RuntimeEvents(
        session,
        tampered
      );

    assert.equal(result.ok, false);

    assert.equal(
      result.error.code,
      "phase6_event_schema_event_invalid"
    );
  }
);

test(
  "BETA-14 runtime deviations cannot mutate future engine input",
  () => {
    const {
      session,
      events
    } = loadScenario("split_skip");

    const beforeSession = clone(session);
    const beforeEvents = clone(events);

    const state =
      replayBeta14Phase6RuntimeEvents(
        session,
        events
      );

    assert.deepEqual(session, beforeSession);
    assert.deepEqual(events, beforeEvents);

    const serialised =
      stableBeta14Phase6RuntimeStateJson(
        state
      );

    for (const forbidden of [
      "coach_note",
      "payment_state",
      "billing_state",
      "engine_override",
      "next_exercise",
      "recommendation",
      "advice"
    ]) {
      assert.equal(
        serialised.includes(forbidden),
        false,
        forbidden
      );
    }
  }
);

test(
  "BETA-14 output is deeply frozen",
  () => {
    const {
      session,
      events
    } = loadScenario("completed");

    const state =
      replayBeta14Phase6RuntimeEvents(
        session,
        events
      );

    assert.equal(Object.isFrozen(state), true);
    assert.equal(
      Object.isFrozen(state.work_items),
      true
    );

    assert.equal(
      Object.isFrozen(
        state.work_items[
          session.planned_items[0].item_id
        ]
      ),
      true
    );
  }
);
