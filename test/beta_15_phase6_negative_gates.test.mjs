// DEV NOTE: BETA-15 closed Phase 6 invalid-runtime failure proof.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  appendBeta13Phase6EventLog,
  materialiseBeta13Phase6Event,
  stableBeta13Phase6EventJson,
  validateBeta13Phase6EventInput,
  validateBeta13Phase6EventLog
} from "../engine/dist/src/runtime/beta13_phase6_event_schema.js";

import {
  applyBeta14Phase6RuntimeEvent,
  assertBeta14Phase6RuntimeStateMatchesEventLog,
  replayBeta14Phase6RuntimeEvents,
  stableBeta14Phase6RuntimeStateJson
} from "../engine/dist/src/runtime/beta14_phase6_runtime_reducer.js";

const here = path.dirname(
  fileURLToPath(import.meta.url)
);

const root = path.resolve(
  here,
  ".."
);

function readJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(
      path.join(root, relativePath),
      "utf8"
    )
  );
}

function clone(value) {
  return JSON.parse(
    JSON.stringify(value)
  );
}

function extractTokens(source) {
  const tokens = new Set();
  const pattern =
    /["'](phase6_[a-z0-9_]+)["']/gu;

  for (const match of source.matchAll(pattern)) {
    tokens.add(match[1]);
  }

  return [...tokens].sort();
}

const sessionFixture = readJson(
  "test/fixtures/beta_13_phase6_event_schema/powerlifting.json"
);

const fixtureManifest = readJson(
  "test/fixtures/beta_15_phase6_negative_gates/manifest.json"
);

const tokenManifest = readJson(
  "engine/contracts/beta15_phase6_failure_tokens.json"
);

const validTokens = new Set(
  tokenManifest.valid_failure_tokens
);

const fixtureById = new Map(
  fixtureManifest.scenarios.map(
    (scenario) => [
      scenario.scenario_id,
      scenario
    ]
  )
);

function freshSession() {
  return clone(sessionFixture);
}

function append(
  session,
  log,
  raw,
  routeSessionId = session.session_id
) {
  return appendBeta13Phase6EventLog(
    session,
    log,
    routeSessionId,
    raw
  );
}

function captureFailure(action) {
  let thrown = null;

  try {
    action();
  }
  catch (error) {
    thrown = error;
  }

  assert.notEqual(
    thrown,
    null,
    "Expected deterministic Phase 6 failure."
  );

  assert.equal(
    typeof thrown.failure_token,
    "string",
    "Failure must expose failure_token."
  );

  assert.equal(
    validTokens.has(
      thrown.failure_token
    ),
    true,
    `Unregistered Phase 6 token: ${thrown.failure_token}`
  );

  return thrown.failure_token;
}

const operations = {
  invalid_event_order() {
    const session = freshSession();
    const item =
      session.planned_items[0].item_id;

    append(session, [], {
      event_type: "WORK_ITEM_DONE",
      work_item_id: item
    });
  },

  duplicate_illegal_event() {
    const session = freshSession();

    const log = append(session, [], {
      event_type: "SESSION_START"
    });

    validateBeta13Phase6EventLog(
      session,
      [
        log[0],
        log[0]
      ]
    );
  },

  unknown_event_type() {
    const session = freshSession();

    validateBeta13Phase6EventInput(
      session,
      session.session_id,
      {
        event_type: "UNKNOWN_EVENT"
      }
    );
  },

  unknown_work_item() {
    const session = freshSession();

    validateBeta13Phase6EventInput(
      session,
      session.session_id,
      {
        event_type: "WORK_ITEM_START",
        work_item_id: "unknown_work_item"
      }
    );
  },

  missing_return_decision() {
    const session = freshSession();

    let log = append(session, [], {
      event_type: "SESSION_START"
    });

    log = append(session, log, {
      event_type: "SPLIT_ENTER"
    });

    append(session, log, {
      event_type: "SESSION_END",
      end_code: "stopped"
    });
  },

  missing_pain_follow_up() {
    const session = freshSession();
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

    append(session, log, {
      event_type: "WORK_ITEM_DONE",
      work_item_id: item
    });
  },

  runtime_state_divergence() {
    const session = freshSession();
    const item =
      session.planned_items[0].item_id;

    let staleLog = append(
      session,
      [],
      {
        event_type: "SESSION_START"
      }
    );

    const staleState =
      replayBeta14Phase6RuntimeEvents(
        session,
        staleLog
      );

    const currentLog = append(
      session,
      staleLog,
      {
        event_type: "WORK_ITEM_START",
        work_item_id: item
      }
    );

    assertBeta14Phase6RuntimeStateMatchesEventLog(
      session,
      currentLog,
      staleState
    );
  },

  event_crossing_session_boundary() {
    const session = freshSession();

    append(
      session,
      [],
      {
        event_type: "SESSION_START"
      },
      "different_session"
    );
  },

  mutation_after_event_append() {
    const session = freshSession();
    const item =
      session.planned_items[0].item_id;

    let log = append(session, [], {
      event_type: "SESSION_START"
    });

    log = append(session, log, {
      event_type: "WORK_ITEM_START",
      work_item_id: item
    });

    assert.equal(
      Object.isFrozen(log),
      true
    );

    assert.equal(
      Object.isFrozen(log[1]),
      true
    );

    const original =
      stableBeta13Phase6EventJson(log);

    const edited = clone(log);

    edited[1].event_id =
      "edited_after_append";

    assert.equal(
      stableBeta13Phase6EventJson(log),
      original
    );

    validateBeta13Phase6EventLog(
      session,
      edited
    );
  }
};

test(
  "BETA-15 failure token manifest exactly matches Phase 6 source tokens",
  () => {
    const sourceFiles =
      tokenManifest.source_files;

    const actual = new Set();

    for (const relativePath of sourceFiles) {
      const source = fs.readFileSync(
        path.join(root, relativePath),
        "utf8"
      );

      for (const token of extractTokens(source)) {
        actual.add(token);
      }
    }

    assert.deepEqual(
      [...actual].sort(),
      [...tokenManifest.valid_failure_tokens].sort()
    );

    assert.equal(
      tokenManifest.token_surface,
      "closed"
    );
  }
);

test(
  "BETA-15 fixture manifest contains the exact required negative gates",
  () => {
    assert.deepEqual(
      fixtureManifest.scenarios
        .map((scenario) => scenario.scenario_id)
        .sort(),
      [
        "duplicate_illegal_event",
        "event_crossing_session_boundary",
        "invalid_event_order",
        "missing_pain_follow_up",
        "missing_return_decision",
        "mutation_after_event_append",
        "runtime_state_divergence",
        "unknown_event_type",
        "unknown_work_item"
      ]
    );
  }
);

for (const scenario of fixtureManifest.scenarios) {
  test(
    `BETA-15 ${scenario.scenario_id} emits only its registered deterministic token`,
    () => {
      const operation =
        operations[scenario.scenario_id];

      assert.equal(
        typeof operation,
        "function"
      );

      const first =
        captureFailure(operation);

      const second =
        captureFailure(operation);

      assert.equal(
        first,
        scenario.expected_failure_token
      );

      assert.equal(
        second,
        scenario.expected_failure_token
      );

      assert.equal(first, second);
    }
  );
}

test(
  "BETA-15 direct reducer requires return decision before session end",
  () => {
    const session = freshSession();

    let log = append(session, [], {
      event_type: "SESSION_START"
    });

    log = append(session, log, {
      event_type: "SPLIT_ENTER"
    });

    const state =
      replayBeta14Phase6RuntimeEvents(
        session,
        log
      );

    const endEvent =
      materialiseBeta13Phase6Event(
        session,
        session.session_id,
        {
          event_type: "SESSION_END",
          end_code: "stopped"
        },
        3
      );

    assert.equal(
      captureFailure(
        () =>
          applyBeta14Phase6RuntimeEvent(
            session,
            state,
            endEvent
          )
      ),
      "phase6_runtime_reducer_return_decision_required"
    );
  }
);

test(
  "BETA-15 direct reducer requires pain follow-up before work-item resolution",
  () => {
    const session = freshSession();
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

    const state =
      replayBeta14Phase6RuntimeEvents(
        session,
        log
      );

    const doneEvent =
      materialiseBeta13Phase6Event(
        session,
        session.session_id,
        {
          event_type: "WORK_ITEM_DONE",
          work_item_id: item
        },
        4
      );

    assert.equal(
      captureFailure(
        () =>
          applyBeta14Phase6RuntimeEvent(
            session,
            state,
            doneEvent
          )
      ),
      "phase6_runtime_reducer_pain_follow_up_required"
    );
  }
);

test(
  "BETA-15 rejected event append leaves prior event log and state unchanged",
  () => {
    const session = freshSession();

    let log = append(session, [], {
      event_type: "SESSION_START"
    });

    log = append(session, log, {
      event_type: "SPLIT_ENTER"
    });

    const state =
      replayBeta14Phase6RuntimeEvents(
        session,
        log
      );

    const beforeLog =
      stableBeta13Phase6EventJson(log);

    const beforeState =
      stableBeta14Phase6RuntimeStateJson(
        state
      );

    captureFailure(
      () =>
        append(session, log, {
          event_type: "SESSION_END",
          end_code: "stopped"
        })
    );

    assert.equal(
      stableBeta13Phase6EventJson(log),
      beforeLog
    );

    assert.equal(
      stableBeta14Phase6RuntimeStateJson(
        state
      ),
      beforeState
    );
  }
);
