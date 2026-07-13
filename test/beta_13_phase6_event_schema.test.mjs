// DEV NOTE: BETA-13 positive and negative Phase 6 event schema proof.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  admitBeta13Phase6EventBeforeReducer,
  appendBeta13Phase6EventLog,
  beta13Phase6EventSchemaContract,
  materialiseBeta13Phase6Event,
  stableBeta13Phase6EventJson,
  validateBeta13Phase6CanonicalEvent,
  validateBeta13Phase6EventInput,
  validateBeta13Phase6EventLog,
  validateBeta13Phase6Session
} from "../engine/dist/src/runtime/beta13_phase6_event_schema.js";

const here = path.dirname(
  fileURLToPath(import.meta.url)
);

const fixtureRoot = path.join(
  here,
  "fixtures",
  "beta_13_phase6_event_schema"
);

function fixture(name) {
  return JSON.parse(
    fs.readFileSync(
      path.join(fixtureRoot, name),
      "utf8"
    )
  );
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

function append(
  session,
  log,
  raw
) {
  return appendBeta13Phase6EventLog(
    session,
    log,
    session.session_id,
    raw
  );
}

function fullEventSequence(session) {
  const item0 =
    session.planned_items[0].item_id;

  const item1 =
    session.planned_items[1].item_id;

  let log = [];

  log = append(session, log, {
    event_type: "SESSION_START"
  });

  log = append(session, log, {
    event_type: "WORK_ITEM_START",
    work_item_id: item0
  });

  log = append(session, log, {
    event_type: "WORK_ITEM_DONE",
    work_item_id: item0
  });

  log = append(session, log, {
    event_type: "SPLIT_ENTER"
  });

  log = append(session, log, {
    event_type: "SPLIT_RETURN_DECISION",
    decision: "continue"
  });

  log = append(session, log, {
    event_type: "WORK_ITEM_START",
    work_item_id: item1
  });

  log = append(session, log, {
    event_type: "PAIN_FLAG",
    work_item_id: item1,
    follow_up_required: true
  });

  log = append(session, log, {
    event_type: "PAIN_FOLLOW_UP",
    work_item_id: item1,
    response_code: "continue"
  });

  log = append(session, log, {
    event_type: "WORK_ITEM_SKIP",
    work_item_id: item1
  });

  log = append(session, log, {
    event_type: "SESSION_END",
    end_code: "completed"
  });

  return log;
}

test(
  "BETA-13 event type set is exact and closed-world",
  () => {
    assert.deepEqual(
      beta13Phase6EventSchemaContract.event_types,
      [
        "SESSION_START",
        "WORK_ITEM_START",
        "WORK_ITEM_DONE",
        "WORK_ITEM_SKIP",
        "SPLIT_ENTER",
        "SPLIT_RETURN_DECISION",
        "PAIN_FLAG",
        "PAIN_FOLLOW_UP",
        "SESSION_END"
      ]
    );
  }
);

for (const fixtureName of [
  "general_strength.json",
  "powerlifting.json",
  "rugby_union.json"
]) {
  test(
    `BETA-13 positive full event sequence: ${fixtureName}`,
    () => {
      const session = fixture(fixtureName);
      const log = fullEventSequence(session);

      assert.equal(log.length, 10);

      assert.deepEqual(
        log.map((event) => event.seq),
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      );

      assert.doesNotThrow(
        () =>
          validateBeta13Phase6EventLog(
            session,
            log
          )
      );
    }
  );

  test(
    `BETA-13 identical event input is byte-stable: ${fixtureName}`,
    () => {
      const session = fixture(fixtureName);

      const first =
        fullEventSequence(session);

      const second =
        fullEventSequence(session);

      assert.equal(
        stableBeta13Phase6EventJson(first),
        stableBeta13Phase6EventJson(second)
      );
    }
  );
}

test(
  "BETA-13 unknown event type fails",
  () => {
    const session =
      fixture("powerlifting.json");

    expectFailure(
      () =>
        validateBeta13Phase6EventInput(
          session,
          session.session_id,
          {
            event_type: "UNKNOWN_EVENT"
          }
        ),
      "phase6_event_schema_unknown_event_type"
    );
  }
);

test(
  "BETA-13 unknown work item fails",
  () => {
    const session =
      fixture("general_strength.json");

    expectFailure(
      () =>
        validateBeta13Phase6EventInput(
          session,
          session.session_id,
          {
            event_type: "WORK_ITEM_START",
            work_item_id: "unknown_item"
          }
        ),
      "phase6_event_schema_unknown_work_item"
    );
  }
);

test(
  "BETA-13 unknown route session fails",
  () => {
    const session =
      fixture("rugby_union.json");

    expectFailure(
      () =>
        validateBeta13Phase6EventInput(
          session,
          "unknown_session",
          {
            event_type: "SESSION_START"
          }
        ),
      "phase6_event_schema_unknown_session"
    );
  }
);

test(
  "BETA-13 user-entered block ID is forbidden",
  () => {
    const session =
      fixture("powerlifting.json");

    expectFailure(
      () =>
        validateBeta13Phase6EventInput(
          session,
          session.session_id,
          {
            event_type: "WORK_ITEM_START",
            work_item_id:
              session.planned_items[0].item_id,
            block_id:
              session.planned_items[0].block_id
          }
        ),
      "phase6_event_schema_user_block_id_forbidden"
    );
  }
);

test(
  "BETA-13 free-text runtime truth is forbidden",
  () => {
    const session =
      fixture("general_strength.json");

    expectFailure(
      () =>
        validateBeta13Phase6EventInput(
          session,
          session.session_id,
          {
            event_type: "SESSION_END",
            end_code: "stopped",
            note: "User-entered explanation"
          }
        ),
      "phase6_event_schema_free_text_forbidden"
    );
  }
);

test(
  "BETA-13 unknown event fields fail",
  () => {
    const session =
      fixture("general_strength.json");

    expectFailure(
      () =>
        validateBeta13Phase6EventInput(
          session,
          session.session_id,
          {
            event_type: "SESSION_START",
            extra_field: true
          }
        ),
      "phase6_event_schema_event_invalid"
    );
  }
);

test(
  "BETA-13 canonical event rejects unknown session ID",
  () => {
    const session =
      fixture("powerlifting.json");

    const event =
      materialiseBeta13Phase6Event(
        session,
        session.session_id,
        {
          event_type: "SESSION_START"
        },
        1
      );

    const tampered = {
      ...clone(event),
      session_id: "unknown_session"
    };

    expectFailure(
      () =>
        validateBeta13Phase6CanonicalEvent(
          session,
          tampered
        ),
      "phase6_event_schema_unknown_session"
    );
  }
);

test(
  "BETA-13 canonical event rejects unknown block ID",
  () => {
    const session =
      fixture("powerlifting.json");

    const event =
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

    const tampered = {
      ...clone(event),
      block_id: "unknown_block"
    };

    expectFailure(
      () =>
        validateBeta13Phase6CanonicalEvent(
          session,
          tampered
        ),
      "phase6_event_schema_unknown_block"
    );
  }
);

test(
  "BETA-13 materialised session rejects unknown block binding",
  () => {
    const session =
      fixture("rugby_union.json");

    session.planned_items[0].block_id =
      "unknown_block";

    expectFailure(
      () =>
        validateBeta13Phase6Session(session),
      "phase6_event_schema_unknown_block"
    );
  }
);

test(
  "BETA-13 append-only sequence tamper fails",
  () => {
    const session =
      fixture("general_strength.json");

    let log = append(session, [], {
      event_type: "SESSION_START"
    });

    log = append(session, log, {
      event_type: "WORK_ITEM_START",
      work_item_id:
        session.planned_items[0].item_id
    });

    const tampered = clone(log);
    tampered[1].seq = 4;

    expectFailure(
      () =>
        validateBeta13Phase6EventLog(
          session,
          tampered
        ),
      "phase6_event_schema_append_only_violation"
    );
  }
);

test(
  "BETA-13 pain follow-up is required before work item resolution",
  () => {
    const session =
      fixture("powerlifting.json");

    const item =
      session.planned_items[0].item_id;

    let log = append(session, [], {
      event_type: "SESSION_START"
    });

    log = append(session, log, {
      event_type: "WORK_ITEM_START",
      work_item_id: item
    });

    log = append(session, log, {
      event_type: "PAIN_FLAG",
      work_item_id: item,
      follow_up_required: true
    });

    expectFailure(
      () =>
        append(session, log, {
          event_type: "WORK_ITEM_DONE",
          work_item_id: item
        }),
      "phase6_event_schema_pain_follow_up_required"
    );

    log = append(session, log, {
      event_type: "PAIN_FOLLOW_UP",
      work_item_id: item,
      response_code: "continue"
    });

    assert.doesNotThrow(
      () =>
        append(session, log, {
          event_type: "WORK_ITEM_DONE",
          work_item_id: item
        })
    );
  }
);

test(
  "BETA-13 invalid payload fails before reducer state changes",
  () => {
    const session =
      fixture("powerlifting.json");

    const originalState = {
      calls: 0,
      accepted: []
    };

    let reducerCalls = 0;

    const reducer = (state, event) => {
      reducerCalls += 1;
      state.calls += 1;
      state.accepted.push(event.event_id);
      return state;
    };

    expectFailure(
      () =>
        admitBeta13Phase6EventBeforeReducer(
          session,
          [],
          session.session_id,
          {
            event_type: "UNKNOWN_EVENT"
          },
          originalState,
          reducer
        ),
      "phase6_event_schema_unknown_event_type"
    );

    assert.equal(reducerCalls, 0);

    assert.deepEqual(
      originalState,
      {
        calls: 0,
        accepted: []
      }
    );
  }
);

test(
  "BETA-13 valid payload reaches reducer only after admission",
  () => {
    const session =
      fixture("rugby_union.json");

    const originalState = {
      calls: 0,
      accepted: []
    };

    const result =
      admitBeta13Phase6EventBeforeReducer(
        session,
        [],
        session.session_id,
        {
          event_type: "SESSION_START"
        },
        originalState,
        (state, event) => {
          state.calls += 1;
          state.accepted.push(event.event_id);
          return state;
        }
      );

    assert.equal(
      result.reducer_state.calls,
      1
    );

    assert.equal(
      result.event_log.length,
      1
    );

    assert.deepEqual(
      originalState,
      {
        calls: 0,
        accepted: []
      }
    );
  }
);

test(
  "BETA-13 canonical events and logs are frozen",
  () => {
    const session =
      fixture("general_strength.json");

    const log = fullEventSequence(session);

    assert.equal(
      Object.isFrozen(log),
      true
    );

    for (const event of log) {
      assert.equal(
        Object.isFrozen(event),
        true
      );

      if (event.payload) {
        assert.equal(
          Object.isFrozen(event.payload),
          true
        );
      }
    }
  }
);
