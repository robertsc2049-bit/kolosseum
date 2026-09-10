
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import test, { mock } from "node:test";
import assert from "node:assert/strict";

const distPoolUrl = new URL("../dist/src/db/pool.js", import.meta.url).href;
const distHttpErrorsUrl = new URL("../dist/src/api/http_errors.js", import.meta.url).href;
const distWriteServiceUrl = new URL("../dist/src/api/session_state_write_service.js", import.meta.url).href;
const distReadModelUrl = new URL("../dist/src/api/session_state_read_model.js", import.meta.url).href;

let connectCalls = 0;
let beginCalls = 0;
let commitCalls = 0;
let rollbackCalls = 0;
let releaseCalls = 0;
let seqValue = 0;
let invalidatedSessionIds = [];
let insertedEvents = [];
let sessionUpdates = [];
let currentSessionRow = null;
let priorLoadRows = [];
let validateWireRuntimeEventImpl = (x) => x;
let applyWireEventImpl = (summary, ev) => ({ ...summary, runtime: { ...(summary?.runtime ?? {}) } });

function resetState() {
  connectCalls = 0;
  beginCalls = 0;
  commitCalls = 0;
  rollbackCalls = 0;
  releaseCalls = 0;
  seqValue = 0;
  invalidatedSessionIds = [];
  insertedEvents = [];
  sessionUpdates = [];
  currentSessionRow = null;
  priorLoadRows = [];
  validateWireRuntimeEventImpl = (x) => x;
  applyWireEventImpl = (summary, ev) => ({ ...summary, runtime: { ...(summary?.runtime ?? {}) } });
}

function makeClient() {
  return {
    query: async (sql, params) => {
      const s = String(sql);

      if (/BEGIN/i.test(s)) {
        beginCalls += 1;
        return { rowCount: 0, rows: [] };
      }

      if (/COMMIT/i.test(s)) {
        commitCalls += 1;
        return { rowCount: 0, rows: [] };
      }

      if (/ROLLBACK/i.test(s)) {
        rollbackCalls += 1;
        return { rowCount: 0, rows: [] };
      }

      if (/SELECT session_id, status, planned_session, session_state_summary, beta_subject_user_id\s+FROM sessions\s+WHERE session_id = \$1\s+FOR UPDATE/i.test(s)) {
        if (!currentSessionRow) return { rowCount: 0, rows: [] };
        return { rowCount: 1, rows: [currentSessionRow] };
      }

      if (/SELECT re\.event->>'load_value' AS load_value, re\.event->>'load_unit' AS load_unit\s+FROM runtime_events re\s+JOIN sessions s ON s\.session_id = re\.session_id\s+WHERE s\.beta_subject_user_id = \$1/i.test(s)) {
        const [athleteUserId, exerciseId] = params ?? [];
        const rows = priorLoadRows.filter(
          (row) => row.athlete_user_id === athleteUserId && row.exercise_id === exerciseId
        );
        return { rowCount: rows.length, rows: rows.map((row) => ({ load_value: String(row.load_value), load_unit: row.load_unit })) };
      }

      if (/INSERT INTO session_event_seq\(session_id, next_seq\)/i.test(s)) {
        return { rowCount: 1, rows: [] };
      }

      if (/UPDATE session_event_seq\s+SET next_seq = next_seq \+ 1/i.test(s)) {
        seqValue += 1;
        return { rowCount: 1, rows: [{ next_seq: seqValue }] };
      }

      if (/INSERT INTO runtime_events\(session_id, seq, event\)/i.test(s)) {
        insertedEvents.push({
          session_id: params?.[0],
          seq: params?.[1],
          event: JSON.parse(params?.[2])
        });
        return { rowCount: 1, rows: [] };
      }

      if (/UPDATE sessions\s+SET status = 'in_progress'/i.test(s)) {
        sessionUpdates.push({
          kind: "status",
          session_id: params?.[0],
          payload: JSON.parse(params?.[1])
        });
        return { rowCount: 1, rows: [] };
      }

      if (/UPDATE sessions\s+SET session_state_summary = \$2::jsonb/i.test(s)) {
        sessionUpdates.push({
          kind: "summary",
          session_id: params?.[0],
          payload: JSON.parse(params?.[1])
        });
        return { rowCount: 1, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    },
    release: () => {
      releaseCalls += 1;
    }
  };
}

mock.module(distPoolUrl, {
  namedExports: {
    pool: {
      connect: async () => {
        connectCalls += 1;
        return makeClient();
      }
    }
  }
});

mock.module(distHttpErrorsUrl, {
  namedExports: {
    badRequest: (msg, meta) => Object.assign(new Error(msg), { status: 400, meta }),
    notFound: (msg, meta) => Object.assign(new Error(msg), { status: 404, meta }),
    conflict: (msg, meta) => Object.assign(new Error(msg), { status: 409, meta }),
    upstreamBadGateway: (msg, meta) => Object.assign(new Error(msg), { status: 502, meta }),
    internalError: (msg, meta) => Object.assign(new Error(msg), { status: 500, meta })
  }
});

mock.module(distReadModelUrl, {
  namedExports: {
    deriveExecutionStatus: (remainingIds, completedIds, droppedIds, started) => {
      const doneCount = completedIds.length;
      const droppedCount = droppedIds.length;
      const remainingCount = remainingIds.length;
      const total = doneCount + droppedCount + remainingCount;

      if (!started) return "ready";
      if (remainingCount > 0) return "in_progress";
      if (total > 0 && droppedCount === 0 && doneCount === total) return "completed";
      return "partial";
    },
    uniqStable: (xs) => {
      const out = [];
      const seen = new Set();
      for (const x of Array.isArray(xs) ? xs : []) {
        if (!seen.has(x)) {
          seen.add(x);
          out.push(x);
        }
      }
      return out;
    },
    invalidateSessionStateCache: (session_id) => {
      invalidatedSessionIds.push(session_id);
    },
    ensureReturnDecisionContract: (summary, deriveTrace) => {
      const rt = summary?.runtime ?? {};
      const explicitRequired = rt.return_decision_required === true;
      const explicitOptions = Array.isArray(rt.return_decision_options) ? rt.return_decision_options : null;
      if (explicitRequired && explicitOptions) return { summary, changed: false };

      const trace = deriveTrace(summary);
      const inferredRequired = rt.split_active === true || trace?.return_decision_required === true;
      if (!inferredRequired) {
        return {
          summary: {
            ...summary,
            runtime: {
              ...rt,
              return_decision_required: false,
              return_decision_options: []
            }
          },
          changed: explicitRequired !== false || !Array.isArray(explicitOptions)
        };
      }

      return {
        summary: {
          ...summary,
          runtime: {
            ...rt,
            return_decision_required: true,
            return_decision_options: ["RETURN_CONTINUE", "RETURN_SKIP"]
          }
        },
        changed: true
      };
    }
  }
});

mock.module("@kolosseum/engine/runtime/session_summary.js", {
  namedExports: {
    normalizeSummary: (_planned, rawSummary) => ({ summary: rawSummary, needsUpgrade: false }),
    deriveTrace: (summary) => {
      const rt = summary?.runtime ?? {};
      return {
        started: summary?.started === true,
        remaining_ids: Array.isArray(rt.remaining_ids) ? rt.remaining_ids : [],
        completed_ids: Array.isArray(rt.completed_ids) ? rt.completed_ids : [],
        dropped_ids: Array.isArray(rt.dropped_ids)
          ? rt.dropped_ids
          : Array.isArray(rt.skipped_ids)
            ? rt.skipped_ids
            : [],
        return_decision_required: rt.return_decision_required === true,
        return_decision_options: Array.isArray(rt.return_decision_options) ? rt.return_decision_options : []
      };
    },
    validateWireRuntimeEvent: (x) => validateWireRuntimeEventImpl(x),
    applyWireEvent: (summary, ev, planned) => applyWireEventImpl(summary, ev, planned)
  }
});

const { startSessionMutation, appendRuntimeEventMutation } = await import(distWriteServiceUrl);

test("startSessionMutation inserts START_SESSION, updates status, commits, and invalidates cache", async () => {
  resetState();

  currentSessionRow = {
    session_id: "s_start",
    status: "planned",
    planned_session: {
      exercises: [{ exercise_id: "ex1", source: "program" }],
      notes: []
    },
    session_state_summary: {
      started: false,
      runtime: {
        remaining_ids: ["ex1"],
        completed_ids: [],
        dropped_ids: [],
        return_decision_required: false,
        return_decision_options: []
      }
    }
  };

  applyWireEventImpl = (summary, ev) => {
    assert.equal(ev.type, "START_SESSION");
    return {
      ...summary,
      started: true,
      runtime: {
        ...(summary?.runtime ?? {}),
        remaining_ids: ["ex1"],
        completed_ids: [],
        dropped_ids: [],
        return_decision_required: false,
        return_decision_options: []
      }
    };
  };

  const out = await startSessionMutation("s_start");

  assert.deepEqual(out, { ok: true, session_id: "s_start", started: true, seq: 1 });
  assert.equal(connectCalls, 1);
  assert.equal(beginCalls, 1);
  assert.equal(commitCalls, 1);
  assert.equal(rollbackCalls, 0);
  assert.equal(releaseCalls, 1);

  assert.equal(insertedEvents.length, 1);
  assert.deepEqual(insertedEvents[0], {
    session_id: "s_start",
    seq: 1,
    event: { type: "START_SESSION" }
  });

  assert.equal(sessionUpdates.length, 1);
  assert.equal(sessionUpdates[0].kind, "status");
  assert.equal(sessionUpdates[0].payload.started, true);

  assert.deepEqual(invalidatedSessionIds, ["s_start"]);
});

test("startSessionMutation is idempotent for already-started sessions", async () => {
  resetState();

  currentSessionRow = {
    session_id: "s_started",
    status: "in_progress",
    planned_session: {
      exercises: [{ exercise_id: "ex1", source: "program" }],
      notes: []
    },
    session_state_summary: {
      started: true,
      runtime: {
        remaining_ids: ["ex1"],
        completed_ids: [],
        dropped_ids: [],
        return_decision_required: false,
        return_decision_options: []
      }
    }
  };

  const out = await startSessionMutation("s_started");

  assert.deepEqual(out, { ok: true, session_id: "s_started", started: true });
  assert.equal(insertedEvents.length, 0, "must not append START_SESSION twice");
  assert.equal(sessionUpdates.length, 1, "should still normalize persisted in_progress state");
  assert.equal(sessionUpdates[0].kind, "status");
  assert.equal(commitCalls, 1);
  assert.deepEqual(invalidatedSessionIds, ["s_started"]);
});

test("appendRuntimeEventMutation auto-starts not-yet-started session before appending requested event", async () => {
  resetState();

  currentSessionRow = {
    session_id: "s_append_autostart",
    status: "planned",
    planned_session: {
      exercises: [{ exercise_id: "ex1", source: "program" }],
      notes: []
    },
    session_state_summary: {
      started: false,
      runtime: {
        remaining_ids: ["ex1"],
        completed_ids: [],
        dropped_ids: [],
        return_decision_required: false,
        return_decision_options: []
      }
    }
  };

  applyWireEventImpl = (summary, ev) => {
    const rt = summary?.runtime ?? {};
    if (ev.type === "START_SESSION") {
      return {
        ...summary,
        started: true,
        runtime: {
          ...rt,
          remaining_ids: ["ex1"],
          completed_ids: [],
          dropped_ids: [],
          return_decision_required: false,
          return_decision_options: []
        }
      };
    }

    if (ev.type === "COMPLETE_EXERCISE") {
      return {
        ...summary,
        started: true,
        runtime: {
          ...rt,
          remaining_ids: [],
          completed_ids: ["ex1"],
          dropped_ids: [],
          return_decision_required: false,
          return_decision_options: []
        }
      };
    }

    return summary;
  };

  const out = await appendRuntimeEventMutation("s_append_autostart", {
    type: "COMPLETE_EXERCISE",
    exercise_id: "ex1"
  });

  assert.deepEqual(out, { ok: true, session_id: "s_append_autostart", seq: 2 });
  assert.equal(insertedEvents.length, 2);
  assert.deepEqual(insertedEvents.map((x) => x.event.type), ["START_SESSION", "COMPLETE_EXERCISE"]);
  assert.equal(sessionUpdates.length, 2, "auto-start path should persist started summary then final summary");
  assert.deepEqual(invalidatedSessionIds, ["s_append_autostart"]);
});

test("appendRuntimeEventMutation accepts EXTRA_SET_REPORT for a completed exercise even after the session is fully terminal", async () => {
  resetState();

  currentSessionRow = {
    session_id: "s_extra_set_terminal",
    status: "completed",
    planned_session: {
      exercises: [{ exercise_id: "ex1", source: "program" }],
      notes: []
    },
    session_state_summary: {
      started: true,
      runtime: {
        remaining_ids: [],
        completed_ids: ["ex1"],
        dropped_ids: [],
        return_decision_required: false,
        return_decision_options: []
      }
    }
  };

  const out = await appendRuntimeEventMutation("s_extra_set_terminal", {
    type: "EXTRA_SET_REPORT",
    exercise_id: "ex1",
    reps: 8,
    load_value: 100,
    load_unit: "kg"
  });

  assert.deepEqual(out, { ok: true, session_id: "s_extra_set_terminal", seq: 1, is_pr: false });
  assert.equal(insertedEvents.length, 1);
  assert.equal(insertedEvents[0].event.type, "EXTRA_SET_REPORT");
  assert.equal(insertedEvents[0].event.exercise_id, "ex1");
  assert.equal(insertedEvents[0].event.reps, 8);
  assert.equal(insertedEvents[0].event.load_value, 100);
  assert.equal(insertedEvents[0].event.load_unit, "kg");
  assert.equal(commitCalls, 1);
  assert.equal(rollbackCalls, 0);
});

test("appendRuntimeEventMutation accepts EXTRA_SET_REPORT with a negative load_value (assisted exercise)", async () => {
  resetState();

  currentSessionRow = {
    session_id: "s_extra_set_assisted",
    status: "completed",
    planned_session: {
      exercises: [{ exercise_id: "ex1", source: "program" }],
      notes: []
    },
    session_state_summary: {
      started: true,
      runtime: {
        remaining_ids: [],
        completed_ids: ["ex1"],
        dropped_ids: [],
        return_decision_required: false,
        return_decision_options: []
      }
    }
  };

  const out = await appendRuntimeEventMutation("s_extra_set_assisted", {
    type: "EXTRA_SET_REPORT",
    exercise_id: "ex1",
    reps: 8,
    load_value: -20,
    load_unit: "kg"
  });

  assert.deepEqual(out, { ok: true, session_id: "s_extra_set_assisted", seq: 1, is_pr: false });
  assert.equal(insertedEvents.length, 1);
  assert.equal(insertedEvents[0].event.load_value, -20);
  assert.equal(insertedEvents[0].event.load_unit, "kg");
  assert.equal(commitCalls, 1);
  assert.equal(rollbackCalls, 0);
});

test("appendRuntimeEventMutation accepts EXTRA_SET_REPORT without load for a dropped exercise mid-session", async () => {
  resetState();

  currentSessionRow = {
    session_id: "s_extra_set_midsession",
    status: "in_progress",
    planned_session: {
      exercises: [{ exercise_id: "ex1", source: "program" }, { exercise_id: "ex2", source: "program" }],
      notes: []
    },
    session_state_summary: {
      started: true,
      runtime: {
        remaining_ids: ["ex2"],
        completed_ids: [],
        dropped_ids: ["ex1"],
        return_decision_required: false,
        return_decision_options: []
      }
    }
  };

  const out = await appendRuntimeEventMutation("s_extra_set_midsession", {
    type: "EXTRA_SET_REPORT",
    exercise_id: "ex1",
    reps: 5
  });

  assert.equal(out.ok, true);
  assert.equal(insertedEvents[0].event.reps, 5);
  assert.equal("load_value" in insertedEvents[0].event, false);
  assert.equal("is_pr" in insertedEvents[0].event, false);
  assert.equal("is_pr" in out, false);
});

function terminalSessionRow(sessionId, athleteUserId, exerciseId) {
  return {
    session_id: sessionId,
    status: "completed",
    beta_subject_user_id: athleteUserId,
    planned_session: {
      exercises: [{ exercise_id: exerciseId, source: "program" }],
      notes: []
    },
    session_state_summary: {
      started: true,
      runtime: {
        remaining_ids: [],
        completed_ids: [exerciseId],
        dropped_ids: [],
        return_decision_required: false,
        return_decision_options: []
      }
    }
  };
}

test("appendRuntimeEventMutation: a first-ever logged weight for an exercise is not a personal record", async () => {
  resetState();
  currentSessionRow = terminalSessionRow("s_pr_first", "athlete_pr_1", "ex1");

  const out = await appendRuntimeEventMutation("s_pr_first", {
    type: "EXTRA_SET_REPORT",
    exercise_id: "ex1",
    reps: 5,
    load_value: 100,
    load_unit: "kg"
  });

  assert.equal(out.is_pr, false);
  assert.equal(insertedEvents[0].event.is_pr, false);
});

test("appendRuntimeEventMutation: a heavier logged weight than any prior is a personal record", async () => {
  resetState();
  currentSessionRow = terminalSessionRow("s_pr_higher", "athlete_pr_2", "ex1");
  priorLoadRows = [{ athlete_user_id: "athlete_pr_2", exercise_id: "ex1", load_value: 90, load_unit: "kg" }];

  const out = await appendRuntimeEventMutation("s_pr_higher", {
    type: "EXTRA_SET_REPORT",
    exercise_id: "ex1",
    reps: 5,
    load_value: 100,
    load_unit: "kg"
  });

  assert.equal(out.is_pr, true);
  assert.equal(insertedEvents[0].event.is_pr, true);
});

test("appendRuntimeEventMutation: a lower or equal logged weight than a prior best is not a personal record", async () => {
  resetState();
  currentSessionRow = terminalSessionRow("s_pr_lower", "athlete_pr_3", "ex1");
  priorLoadRows = [{ athlete_user_id: "athlete_pr_3", exercise_id: "ex1", load_value: 100, load_unit: "kg" }];

  const lower = await appendRuntimeEventMutation("s_pr_lower", {
    type: "EXTRA_SET_REPORT",
    exercise_id: "ex1",
    reps: 5,
    load_value: 90,
    load_unit: "kg"
  });
  assert.equal(lower.is_pr, false);

  const equal = await appendRuntimeEventMutation("s_pr_lower", {
    type: "EXTRA_SET_REPORT",
    exercise_id: "ex1",
    reps: 5,
    load_value: 100,
    load_unit: "kg"
  });
  assert.equal(equal.is_pr, false);
});

test("appendRuntimeEventMutation: personal-record comparison normalises across kg/lb before comparing", async () => {
  resetState();
  currentSessionRow = terminalSessionRow("s_pr_units", "athlete_pr_4", "ex1");
  priorLoadRows = [{ athlete_user_id: "athlete_pr_4", exercise_id: "ex1", load_value: 100, load_unit: "kg" }];

  // 200lb is roughly 90.7kg - lighter than the prior 100kg best, so not a PR.
  const out = await appendRuntimeEventMutation("s_pr_units", {
    type: "EXTRA_SET_REPORT",
    exercise_id: "ex1",
    reps: 5,
    load_value: 200,
    load_unit: "lb"
  });

  assert.equal(out.is_pr, false);
});

test("appendRuntimeEventMutation: EXTRA_SET_REPORT and EXTRA_EXERCISE_REPORT share one personal-record pool per exercise", async () => {
  resetState();
  currentSessionRow = terminalSessionRow("s_pr_pooled", "athlete_pr_5", "back_squat");
  priorLoadRows = [{ athlete_user_id: "athlete_pr_5", exercise_id: "front_squat", load_value: 80, load_unit: "kg" }];

  const out = await appendRuntimeEventMutation("s_pr_pooled", {
    type: "EXTRA_EXERCISE_REPORT",
    exercise_id: "front_squat",
    reps: 5,
    load_value: 90,
    load_unit: "kg"
  });

  assert.equal(out.is_pr, true);
});

test("appendRuntimeEventMutation rejects EXTRA_SET_REPORT for an exercise that is still remaining", async () => {
  resetState();

  currentSessionRow = {
    session_id: "s_extra_set_remaining",
    status: "in_progress",
    planned_session: {
      exercises: [{ exercise_id: "ex1", source: "program" }],
      notes: []
    },
    session_state_summary: {
      started: true,
      runtime: {
        remaining_ids: ["ex1"],
        completed_ids: [],
        dropped_ids: [],
        return_decision_required: false,
        return_decision_options: []
      }
    }
  };

  let err;
  try {
    await appendRuntimeEventMutation("s_extra_set_remaining", { type: "EXTRA_SET_REPORT", exercise_id: "ex1", reps: 5 });
  } catch (e) {
    err = e;
  }

  assert.ok(err);
  assert.equal(err.status ?? err.statusCode, 400);
  assert.equal(err.meta?.failure_token, "phase6_runtime_extra_set_report_unknown_exercise");
  assert.equal(insertedEvents.length, 0);
});

test("appendRuntimeEventMutation rejects EXTRA_SET_REPORT with a non-positive-integer reps value", async () => {
  resetState();

  currentSessionRow = {
    session_id: "s_extra_set_bad_reps",
    status: "completed",
    planned_session: {
      exercises: [{ exercise_id: "ex1", source: "program" }],
      notes: []
    },
    session_state_summary: {
      started: true,
      runtime: {
        remaining_ids: [],
        completed_ids: ["ex1"],
        dropped_ids: [],
        return_decision_required: false,
        return_decision_options: []
      }
    }
  };

  let err;
  try {
    await appendRuntimeEventMutation("s_extra_set_bad_reps", { type: "EXTRA_SET_REPORT", exercise_id: "ex1", reps: 0 });
  } catch (e) {
    err = e;
  }

  assert.ok(err);
  assert.equal(err.status ?? err.statusCode, 400);
  assert.equal(err.meta?.failure_token, "phase6_runtime_extra_set_report_invalid_shape");
});

test("appendRuntimeEventMutation rejects EXTRA_SET_REPORT with load_value but no load_unit", async () => {
  resetState();

  currentSessionRow = {
    session_id: "s_extra_set_bad_load",
    status: "completed",
    planned_session: {
      exercises: [{ exercise_id: "ex1", source: "program" }],
      notes: []
    },
    session_state_summary: {
      started: true,
      runtime: {
        remaining_ids: [],
        completed_ids: ["ex1"],
        dropped_ids: [],
        return_decision_required: false,
        return_decision_options: []
      }
    }
  };

  let err;
  try {
    await appendRuntimeEventMutation("s_extra_set_bad_load", { type: "EXTRA_SET_REPORT", exercise_id: "ex1", reps: 5, load_value: 100 });
  } catch (e) {
    err = e;
  }

  assert.ok(err);
  assert.equal(err.status ?? err.statusCode, 400);
  assert.equal(err.meta?.failure_token, "phase6_runtime_extra_set_report_invalid_shape");
});

test("appendRuntimeEventMutation rejects EXTRA_SET_REPORT with a zero load_value", async () => {
  resetState();

  currentSessionRow = {
    session_id: "s_extra_set_zero_load",
    status: "completed",
    planned_session: {
      exercises: [{ exercise_id: "ex1", source: "program" }],
      notes: []
    },
    session_state_summary: {
      started: true,
      runtime: {
        remaining_ids: [],
        completed_ids: ["ex1"],
        dropped_ids: [],
        return_decision_required: false,
        return_decision_options: []
      }
    }
  };

  let err;
  try {
    await appendRuntimeEventMutation("s_extra_set_zero_load", { type: "EXTRA_SET_REPORT", exercise_id: "ex1", reps: 5, load_value: 0, load_unit: "kg" });
  } catch (e) {
    err = e;
  }

  assert.ok(err);
  assert.equal(err.status ?? err.statusCode, 400);
  assert.equal(err.meta?.failure_token, "phase6_runtime_extra_set_report_invalid_shape");
});

test("appendRuntimeEventMutation accepts EXTRA_EXERCISE_REPORT for a catalog exercise not on the plan, even after the session is fully terminal", async () => {
  resetState();

  currentSessionRow = {
    session_id: "s_extra_exercise_terminal",
    status: "completed",
    planned_session: {
      exercises: [{ exercise_id: "back_squat", source: "program" }],
      notes: []
    },
    session_state_summary: {
      started: true,
      runtime: {
        remaining_ids: [],
        completed_ids: ["back_squat"],
        dropped_ids: [],
        return_decision_required: false,
        return_decision_options: []
      }
    }
  };

  const out = await appendRuntimeEventMutation("s_extra_exercise_terminal", {
    type: "EXTRA_EXERCISE_REPORT",
    exercise_id: "front_squat",
    reps: 8,
    load_value: 100,
    load_unit: "kg"
  });

  assert.deepEqual(out, { ok: true, session_id: "s_extra_exercise_terminal", seq: 1, is_pr: false });
  assert.equal(insertedEvents.length, 1);
  assert.equal(insertedEvents[0].event.type, "EXTRA_EXERCISE_REPORT");
  assert.equal(insertedEvents[0].event.exercise_id, "front_squat");
  assert.equal(insertedEvents[0].event.reps, 8);
  assert.equal(insertedEvents[0].event.load_value, 100);
  assert.equal(insertedEvents[0].event.load_unit, "kg");
  assert.equal(commitCalls, 1);
  assert.equal(rollbackCalls, 0);
});

test("appendRuntimeEventMutation accepts EXTRA_EXERCISE_REPORT with a negative load_value (assisted exercise)", async () => {
  resetState();

  currentSessionRow = {
    session_id: "s_extra_exercise_assisted",
    status: "completed",
    planned_session: {
      exercises: [{ exercise_id: "back_squat", source: "program" }],
      notes: []
    },
    session_state_summary: {
      started: true,
      runtime: {
        remaining_ids: [],
        completed_ids: ["back_squat"],
        dropped_ids: [],
        return_decision_required: false,
        return_decision_options: []
      }
    }
  };

  const out = await appendRuntimeEventMutation("s_extra_exercise_assisted", {
    type: "EXTRA_EXERCISE_REPORT",
    exercise_id: "front_squat",
    reps: 8,
    load_value: -15,
    load_unit: "kg"
  });

  assert.deepEqual(out, { ok: true, session_id: "s_extra_exercise_assisted", seq: 1, is_pr: false });
  assert.equal(insertedEvents.length, 1);
  assert.equal(insertedEvents[0].event.load_value, -15);
  assert.equal(insertedEvents[0].event.load_unit, "kg");
  assert.equal(commitCalls, 1);
  assert.equal(rollbackCalls, 0);
});

test("appendRuntimeEventMutation accepts EXTRA_EXERCISE_REPORT without load, mid-session", async () => {
  resetState();

  currentSessionRow = {
    session_id: "s_extra_exercise_midsession",
    status: "in_progress",
    planned_session: {
      exercises: [{ exercise_id: "back_squat", source: "program" }],
      notes: []
    },
    session_state_summary: {
      started: true,
      runtime: {
        remaining_ids: ["back_squat"],
        completed_ids: [],
        dropped_ids: [],
        return_decision_required: false,
        return_decision_options: []
      }
    }
  };

  const out = await appendRuntimeEventMutation("s_extra_exercise_midsession", {
    type: "EXTRA_EXERCISE_REPORT",
    exercise_id: "front_squat",
    reps: 5
  });

  assert.equal(out.ok, true);
  assert.equal(insertedEvents[0].event.reps, 5);
  assert.equal("load_value" in insertedEvents[0].event, false);
  assert.equal("is_pr" in insertedEvents[0].event, false);
  assert.equal("is_pr" in out, false);
});

test("appendRuntimeEventMutation rejects EXTRA_EXERCISE_REPORT for an exercise already on this session's prescribed plan", async () => {
  resetState();

  currentSessionRow = {
    session_id: "s_extra_exercise_prescribed",
    status: "in_progress",
    planned_session: {
      exercises: [{ exercise_id: "back_squat", source: "program" }],
      notes: []
    },
    session_state_summary: {
      started: true,
      runtime: {
        remaining_ids: ["back_squat"],
        completed_ids: [],
        dropped_ids: [],
        return_decision_required: false,
        return_decision_options: []
      }
    }
  };

  let err;
  try {
    await appendRuntimeEventMutation("s_extra_exercise_prescribed", { type: "EXTRA_EXERCISE_REPORT", exercise_id: "back_squat", reps: 5 });
  } catch (e) {
    err = e;
  }

  assert.ok(err);
  assert.equal(err.status ?? err.statusCode, 400);
  assert.equal(err.meta?.failure_token, "phase6_runtime_extra_exercise_report_already_prescribed");
  assert.equal(insertedEvents.length, 0);
});

test("appendRuntimeEventMutation rejects EXTRA_EXERCISE_REPORT for an exercise_id that isn't a recognized catalog exercise", async () => {
  resetState();

  currentSessionRow = {
    session_id: "s_extra_exercise_unknown",
    status: "in_progress",
    planned_session: {
      exercises: [{ exercise_id: "back_squat", source: "program" }],
      notes: []
    },
    session_state_summary: {
      started: true,
      runtime: {
        remaining_ids: ["back_squat"],
        completed_ids: [],
        dropped_ids: [],
        return_decision_required: false,
        return_decision_options: []
      }
    }
  };

  let err;
  try {
    await appendRuntimeEventMutation("s_extra_exercise_unknown", { type: "EXTRA_EXERCISE_REPORT", exercise_id: "not_a_real_exercise_zzz", reps: 5 });
  } catch (e) {
    err = e;
  }

  assert.ok(err);
  assert.equal(err.status ?? err.statusCode, 400);
  assert.equal(err.meta?.failure_token, "phase6_runtime_extra_exercise_report_unknown_exercise");
  assert.equal(insertedEvents.length, 0);
});

test("appendRuntimeEventMutation rejects EXTRA_EXERCISE_REPORT with a non-positive-integer reps value", async () => {
  resetState();

  currentSessionRow = {
    session_id: "s_extra_exercise_bad_reps",
    status: "in_progress",
    planned_session: {
      exercises: [{ exercise_id: "back_squat", source: "program" }],
      notes: []
    },
    session_state_summary: {
      started: true,
      runtime: {
        remaining_ids: ["back_squat"],
        completed_ids: [],
        dropped_ids: [],
        return_decision_required: false,
        return_decision_options: []
      }
    }
  };

  let err;
  try {
    await appendRuntimeEventMutation("s_extra_exercise_bad_reps", { type: "EXTRA_EXERCISE_REPORT", exercise_id: "front_squat", reps: 0 });
  } catch (e) {
    err = e;
  }

  assert.ok(err);
  assert.equal(err.status ?? err.statusCode, 400);
  assert.equal(err.meta?.failure_token, "phase6_runtime_extra_exercise_report_invalid_shape");
});

test("appendRuntimeEventMutation rejects EXTRA_EXERCISE_REPORT with load_value but no load_unit", async () => {
  resetState();

  currentSessionRow = {
    session_id: "s_extra_exercise_bad_load",
    status: "in_progress",
    planned_session: {
      exercises: [{ exercise_id: "back_squat", source: "program" }],
      notes: []
    },
    session_state_summary: {
      started: true,
      runtime: {
        remaining_ids: ["back_squat"],
        completed_ids: [],
        dropped_ids: [],
        return_decision_required: false,
        return_decision_options: []
      }
    }
  };

  let err;
  try {
    await appendRuntimeEventMutation("s_extra_exercise_bad_load", { type: "EXTRA_EXERCISE_REPORT", exercise_id: "front_squat", reps: 5, load_value: 100 });
  } catch (e) {
    err = e;
  }

  assert.ok(err);
  assert.equal(err.status ?? err.statusCode, 400);
  assert.equal(err.meta?.failure_token, "phase6_runtime_extra_exercise_report_invalid_shape");
});

test("appendRuntimeEventMutation accepts COMPLETE_GROUP for a complex and folds every remaining member through COMPLETE_EXERCISE, with exactly one runtime_events row", async () => {
  resetState();

  currentSessionRow = {
    session_id: "s_complete_group",
    status: "in_progress",
    planned_session: {
      exercises: [
        { exercise_id: "power_clean", source: "program", group_id: "complex1", group_type: "complex" },
        { exercise_id: "push_jerk", source: "program", group_id: "complex1", group_type: "complex" },
        { exercise_id: "thruster", source: "program", group_id: "complex1", group_type: "complex" }
      ],
      notes: []
    },
    session_state_summary: {
      started: true,
      runtime: {
        remaining_ids: ["power_clean", "push_jerk", "thruster"],
        completed_ids: [],
        dropped_ids: [],
        return_decision_required: false,
        return_decision_options: []
      }
    }
  };

  const foldedEvents = [];
  applyWireEventImpl = (summary, ev) => {
    foldedEvents.push(ev);
    const rt = summary?.runtime ?? {};
    const remaining = rt.remaining_ids.filter((id) => id !== ev.exercise_id);
    return {
      ...summary,
      started: true,
      runtime: {
        ...rt,
        remaining_ids: remaining,
        completed_ids: [...rt.completed_ids, ev.exercise_id]
      }
    };
  };

  const out = await appendRuntimeEventMutation("s_complete_group", { type: "COMPLETE_GROUP", group_id: "complex1" });

  assert.deepEqual(out, { ok: true, session_id: "s_complete_group", seq: 1 });

  assert.equal(insertedEvents.length, 1, "COMPLETE_GROUP must insert exactly one runtime_events row, not one per member");
  assert.deepEqual(insertedEvents[0].event, { type: "COMPLETE_GROUP", group_id: "complex1" });

  assert.deepEqual(
    foldedEvents,
    [
      { type: "COMPLETE_EXERCISE", exercise_id: "power_clean" },
      { type: "COMPLETE_EXERCISE", exercise_id: "push_jerk" },
      { type: "COMPLETE_EXERCISE", exercise_id: "thruster" }
    ],
    "every remaining group member must be folded through COMPLETE_EXERCISE"
  );
});

test("appendRuntimeEventMutation rejects COMPLETE_GROUP for an unknown group_id", async () => {
  resetState();

  currentSessionRow = {
    session_id: "s_complete_group_unknown",
    status: "in_progress",
    planned_session: {
      exercises: [
        { exercise_id: "power_clean", source: "program", group_id: "complex1", group_type: "complex" },
        { exercise_id: "push_jerk", source: "program", group_id: "complex1", group_type: "complex" }
      ],
      notes: []
    },
    session_state_summary: {
      started: true,
      runtime: {
        remaining_ids: ["power_clean", "push_jerk"],
        completed_ids: [],
        dropped_ids: [],
        return_decision_required: false,
        return_decision_options: []
      }
    }
  };

  let err;
  try {
    await appendRuntimeEventMutation("s_complete_group_unknown", { type: "COMPLETE_GROUP", group_id: "not_a_real_group" });
  } catch (e) {
    err = e;
  }

  assert.ok(err);
  assert.equal(err.status ?? err.statusCode, 400);
  assert.equal(err.meta?.failure_token, "phase6_runtime_group_result_report_unknown_group");
});

test("appendRuntimeEventMutation rejects a group result report carrying an unlisted key", async () => {
  resetState();

  currentSessionRow = {
    session_id: "s_complete_group_bad_shape",
    status: "in_progress",
    planned_session: {
      exercises: [
        { exercise_id: "power_clean", source: "program", group_id: "complex1", group_type: "complex" },
        { exercise_id: "push_jerk", source: "program", group_id: "complex1", group_type: "complex" }
      ],
      notes: []
    },
    session_state_summary: {
      started: true,
      runtime: {
        remaining_ids: ["power_clean", "push_jerk"],
        completed_ids: [],
        dropped_ids: [],
        return_decision_required: false,
        return_decision_options: []
      }
    }
  };

  let err;
  try {
    await appendRuntimeEventMutation("s_complete_group_bad_shape", {
      type: "COMPLETE_GROUP",
      group_id: "complex1",
      notes: "felt heavy"
    });
  } catch (e) {
    err = e;
  }

  assert.ok(err);
  assert.equal(err.status ?? err.statusCode, 400);
  assert.equal(err.meta?.failure_token, "phase6_runtime_group_result_report_invalid_shape");
});

test("appendRuntimeEventMutation accepts AMRAP_RESULT_REPORT and folds every remaining member through COMPLETE_EXERCISE, with exactly one runtime_events row", async () => {
  resetState();

  currentSessionRow = {
    session_id: "s_amrap_result",
    status: "in_progress",
    planned_session: {
      exercises: [
        { exercise_id: "toes_to_bar", source: "program", group_id: "amrapA", group_type: "amrap", group_time_cap_seconds: 720 },
        { exercise_id: "pull_up", source: "program", group_id: "amrapA", group_type: "amrap", group_time_cap_seconds: 720 }
      ],
      notes: []
    },
    session_state_summary: {
      started: true,
      runtime: {
        remaining_ids: ["toes_to_bar", "pull_up"],
        completed_ids: [],
        dropped_ids: [],
        return_decision_required: false,
        return_decision_options: []
      }
    }
  };

  const foldedEvents = [];
  applyWireEventImpl = (summary, ev) => {
    foldedEvents.push(ev);
    const rt = summary?.runtime ?? {};
    return {
      ...summary,
      started: true,
      runtime: {
        ...rt,
        remaining_ids: rt.remaining_ids.filter((id) => id !== ev.exercise_id),
        completed_ids: [...rt.completed_ids, ev.exercise_id]
      }
    };
  };

  const out = await appendRuntimeEventMutation("s_amrap_result", {
    type: "AMRAP_RESULT_REPORT",
    group_id: "amrapA",
    rounds_completed: 6,
    extra_reps: 4
  });

  assert.deepEqual(out, { ok: true, session_id: "s_amrap_result", seq: 1 });
  assert.equal(insertedEvents.length, 1, "AMRAP_RESULT_REPORT must insert exactly one runtime_events row, not one per member");
  assert.deepEqual(insertedEvents[0].event, {
    type: "AMRAP_RESULT_REPORT",
    group_id: "amrapA",
    rounds_completed: 6,
    extra_reps: 4
  });
  assert.deepEqual(
    foldedEvents,
    [
      { type: "COMPLETE_EXERCISE", exercise_id: "toes_to_bar" },
      { type: "COMPLETE_EXERCISE", exercise_id: "pull_up" }
    ]
  );
});

test("appendRuntimeEventMutation rejects AMRAP_RESULT_REPORT with a negative rounds_completed", async () => {
  resetState();

  currentSessionRow = {
    session_id: "s_amrap_bad_rounds",
    status: "in_progress",
    planned_session: {
      exercises: [
        { exercise_id: "toes_to_bar", source: "program", group_id: "amrapA", group_type: "amrap", group_time_cap_seconds: 720 },
        { exercise_id: "pull_up", source: "program", group_id: "amrapA", group_type: "amrap", group_time_cap_seconds: 720 }
      ],
      notes: []
    },
    session_state_summary: {
      started: true,
      runtime: {
        remaining_ids: ["toes_to_bar", "pull_up"],
        completed_ids: [],
        dropped_ids: [],
        return_decision_required: false,
        return_decision_options: []
      }
    }
  };

  let err;
  try {
    await appendRuntimeEventMutation("s_amrap_bad_rounds", {
      type: "AMRAP_RESULT_REPORT",
      group_id: "amrapA",
      rounds_completed: -1,
      extra_reps: 0
    });
  } catch (e) {
    err = e;
  }

  assert.ok(err);
  assert.equal(err.status ?? err.statusCode, 400);
  assert.equal(err.meta?.failure_token, "phase6_runtime_group_result_report_invalid_shape");
});

test("appendRuntimeEventMutation accepts EMOM_RESULT_REPORT and folds every remaining member through COMPLETE_EXERCISE, with exactly one runtime_events row", async () => {
  resetState();

  currentSessionRow = {
    session_id: "s_emom_result",
    status: "in_progress",
    planned_session: {
      exercises: [
        { exercise_id: "kettlebell_deadlift", source: "program", group_id: "emom1", group_type: "emom", group_round_seconds: 60, group_total_rounds: 10 },
        { exercise_id: "goblet_squat", source: "program", group_id: "emom1", group_type: "emom", group_round_seconds: 60, group_total_rounds: 10 }
      ],
      notes: []
    },
    session_state_summary: {
      started: true,
      runtime: {
        remaining_ids: ["kettlebell_deadlift", "goblet_squat"],
        completed_ids: [],
        dropped_ids: [],
        return_decision_required: false,
        return_decision_options: []
      }
    }
  };

  const foldedEvents = [];
  applyWireEventImpl = (summary, ev) => {
    foldedEvents.push(ev);
    const rt = summary?.runtime ?? {};
    return {
      ...summary,
      started: true,
      runtime: {
        ...rt,
        remaining_ids: rt.remaining_ids.filter((id) => id !== ev.exercise_id),
        completed_ids: [...rt.completed_ids, ev.exercise_id]
      }
    };
  };

  const out = await appendRuntimeEventMutation("s_emom_result", {
    type: "EMOM_RESULT_REPORT",
    group_id: "emom1",
    rounds_completed: 9,
    rounds_missed: 1
  });

  assert.deepEqual(out, { ok: true, session_id: "s_emom_result", seq: 1 });
  assert.equal(insertedEvents.length, 1, "EMOM_RESULT_REPORT must insert exactly one runtime_events row, not one per member");
  assert.deepEqual(insertedEvents[0].event, {
    type: "EMOM_RESULT_REPORT",
    group_id: "emom1",
    rounds_completed: 9,
    rounds_missed: 1
  });
  assert.deepEqual(
    foldedEvents,
    [
      { type: "COMPLETE_EXERCISE", exercise_id: "kettlebell_deadlift" },
      { type: "COMPLETE_EXERCISE", exercise_id: "goblet_squat" }
    ]
  );
});

test("appendRuntimeEventMutation accepts FOR_TIME_RESULT_REPORT and folds every remaining member through COMPLETE_EXERCISE, with exactly one runtime_events row", async () => {
  resetState();

  currentSessionRow = {
    session_id: "s_for_time_result",
    status: "in_progress",
    planned_session: {
      exercises: [
        { exercise_id: "toes_to_bar", source: "program", group_id: "fortime1", group_type: "for_time", group_time_cap_seconds: 600 },
        { exercise_id: "pull_up", source: "program", group_id: "fortime1", group_type: "for_time", group_time_cap_seconds: 600 }
      ],
      notes: []
    },
    session_state_summary: {
      started: true,
      runtime: {
        remaining_ids: ["toes_to_bar", "pull_up"],
        completed_ids: [],
        dropped_ids: [],
        return_decision_required: false,
        return_decision_options: []
      }
    }
  };

  const foldedEvents = [];
  applyWireEventImpl = (summary, ev) => {
    foldedEvents.push(ev);
    const rt = summary?.runtime ?? {};
    return {
      ...summary,
      started: true,
      runtime: {
        ...rt,
        remaining_ids: rt.remaining_ids.filter((id) => id !== ev.exercise_id),
        completed_ids: [...rt.completed_ids, ev.exercise_id]
      }
    };
  };

  const out = await appendRuntimeEventMutation("s_for_time_result", {
    type: "FOR_TIME_RESULT_REPORT",
    group_id: "fortime1",
    elapsed_seconds: 480,
    hit_time_cap: false
  });

  assert.deepEqual(out, { ok: true, session_id: "s_for_time_result", seq: 1 });
  assert.equal(insertedEvents.length, 1, "FOR_TIME_RESULT_REPORT must insert exactly one runtime_events row, not one per member");
  assert.deepEqual(insertedEvents[0].event, {
    type: "FOR_TIME_RESULT_REPORT",
    group_id: "fortime1",
    elapsed_seconds: 480,
    hit_time_cap: false
  });
  assert.deepEqual(
    foldedEvents,
    [
      { type: "COMPLETE_EXERCISE", exercise_id: "toes_to_bar" },
      { type: "COMPLETE_EXERCISE", exercise_id: "pull_up" }
    ]
  );
});

test("appendRuntimeEventMutation rejects FOR_TIME_RESULT_REPORT whose elapsed_seconds equals the time cap but hit_time_cap is false", async () => {
  resetState();

  currentSessionRow = {
    session_id: "s_for_time_cap_mismatch",
    status: "in_progress",
    planned_session: {
      exercises: [
        { exercise_id: "toes_to_bar", source: "program", group_id: "fortime1", group_type: "for_time", group_time_cap_seconds: 600 },
        { exercise_id: "pull_up", source: "program", group_id: "fortime1", group_type: "for_time", group_time_cap_seconds: 600 }
      ],
      notes: []
    },
    session_state_summary: {
      started: true,
      runtime: {
        remaining_ids: ["toes_to_bar", "pull_up"],
        completed_ids: [],
        dropped_ids: [],
        return_decision_required: false,
        return_decision_options: []
      }
    }
  };

  let err;
  try {
    await appendRuntimeEventMutation("s_for_time_cap_mismatch", {
      type: "FOR_TIME_RESULT_REPORT",
      group_id: "fortime1",
      elapsed_seconds: 600,
      hit_time_cap: false
    });
  } catch (e) {
    err = e;
  }

  assert.ok(err);
  assert.equal(err.status ?? err.statusCode, 400);
  assert.equal(err.meta?.failure_token, "phase6_runtime_group_result_report_invalid_shape");
});

test("appendRuntimeEventMutation maps COMPLETE_STEP to COMPLETE_EXERCISE for first remaining id", async () => {
  resetState();

  currentSessionRow = {
    session_id: "s_complete_step",
    status: "in_progress",
    planned_session: {
      exercises: [
        { exercise_id: "ex1", source: "program" },
        { exercise_id: "ex2", source: "program" }
      ],
      notes: []
    },
    session_state_summary: {
      started: true,
      runtime: {
        remaining_ids: ["ex1", "ex2", "ex2"],
        completed_ids: [],
        dropped_ids: [],
        return_decision_required: false,
        return_decision_options: []
      }
    }
  };

  applyWireEventImpl = (summary, ev) => {
    assert.deepEqual(ev, { type: "COMPLETE_EXERCISE", exercise_id: "ex1" });
    return {
      ...summary,
      started: true,
      runtime: {
        remaining_ids: ["ex2"],
        completed_ids: ["ex1"],
        dropped_ids: [],
        return_decision_required: false,
        return_decision_options: []
      }
    };
  };

  const out = await appendRuntimeEventMutation("s_complete_step", { type: "COMPLETE_STEP" });

  assert.deepEqual(out, { ok: true, session_id: "s_complete_step", seq: 1 });
  assert.equal(insertedEvents.length, 1);
  assert.deepEqual(insertedEvents[0].event, { type: "COMPLETE_EXERCISE", exercise_id: "ex1" });
  assert.deepEqual(invalidatedSessionIds, ["s_complete_step"]);
});

test("appendRuntimeEventMutation rejects START_SESSION on append path", async () => {
  resetState();

  let err;
  try {
    await appendRuntimeEventMutation("s_reject_start", { type: "START_SESSION" });
  } catch (e) {
    err = e;
  }

  assert.ok(err);
  assert.equal(err.status ?? err.statusCode, 400);
  assert.equal(connectCalls, 0, "must reject before DB connect");
});

test("appendRuntimeEventMutation maps await-return-decision engine error to 400 token", async () => {
  resetState();

  currentSessionRow = {
    session_id: "s_gate",
    status: "in_progress",
    planned_session: {
      exercises: [{ exercise_id: "ex1", source: "program" }],
      notes: []
    },
    session_state_summary: {
      started: true,
      runtime: {
        remaining_ids: ["ex1"],
        completed_ids: [],
        dropped_ids: [],
        return_decision_required: true,
        return_decision_options: ["RETURN_CONTINUE", "RETURN_SKIP"]
      }
    }
  };

  applyWireEventImpl = () => {
    throw new Error("PHASE6_RUNTIME_AWAIT_RETURN_DECISION: gate still active");
  };

  let err;
  try {
    await appendRuntimeEventMutation("s_gate", { type: "COMPLETE_EXERCISE", exercise_id: "ex1" });
  } catch (e) {
    err = e;
  }

  assert.ok(err);
  assert.equal(err.status ?? err.statusCode, 400);
  assert.equal(err.meta?.failure_token, "phase6_runtime_await_return_decision");
  assert.equal(commitCalls, 0);
  assert.equal(rollbackCalls, 1);
  assert.deepEqual(invalidatedSessionIds, []);
});

test("appendRuntimeEventMutation maps unknown engine event error to 400 token", async () => {
  resetState();

  currentSessionRow = {
    session_id: "s_unknown",
    status: "in_progress",
    planned_session: {
      exercises: [{ exercise_id: "ex1", source: "program" }],
      notes: []
    },
    session_state_summary: {
      started: true,
      runtime: {
        remaining_ids: ["ex1"],
        completed_ids: [],
        dropped_ids: [],
        return_decision_required: false,
        return_decision_options: []
      }
    }
  };

  applyWireEventImpl = () => {
    throw new Error("PHASE6_RUNTIME_UNKNOWN_EVENT: nope");
  };

  let err;
  try {
    await appendRuntimeEventMutation("s_unknown", { type: "COMPLETE_EXERCISE", exercise_id: "ex1" });
  } catch (e) {
    err = e;
  }

  assert.ok(err);
  assert.equal(err.status ?? err.statusCode, 400);
  assert.equal(err.meta?.failure_token, "phase6_runtime_unknown_event");
});

test("appendRuntimeEventMutation maps invalid event error to 400 token", async () => {
  resetState();

  currentSessionRow = {
    session_id: "s_invalid",
    status: "in_progress",
    planned_session: {
      exercises: [{ exercise_id: "ex1", source: "program" }],
      notes: []
    },
    session_state_summary: {
      started: true,
      runtime: {
        remaining_ids: ["ex1"],
        completed_ids: [],
        dropped_ids: [],
        return_decision_required: false,
        return_decision_options: []
      }
    }
  };

  applyWireEventImpl = () => {
    throw new Error("PHASE6_RUNTIME_INVALID_EVENT: bad shape");
  };

  let err;
  try {
    await appendRuntimeEventMutation("s_invalid", { type: "COMPLETE_EXERCISE", exercise_id: "ex1" });
  } catch (e) {
    err = e;
  }

  assert.ok(err);
  assert.equal(err.status ?? err.statusCode, 400);
  assert.equal(err.meta?.failure_token, "phase6_runtime_invalid_event");
});

test("appendRuntimeEventMutation maps unexpected engine error to 500", async () => {
  resetState();

  currentSessionRow = {
    session_id: "s_bug",
    status: "in_progress",
    planned_session: {
      exercises: [{ exercise_id: "ex1", source: "program" }],
      notes: []
    },
    session_state_summary: {
      started: true,
      runtime: {
        remaining_ids: ["ex1"],
        completed_ids: [],
        dropped_ids: [],
        return_decision_required: false,
        return_decision_options: []
      }
    }
  };

  applyWireEventImpl = () => {
    throw new Error("SOME_UNEXPECTED_ENGINE_BUG");
  };

  let err;
  try {
    await appendRuntimeEventMutation("s_bug", { type: "COMPLETE_EXERCISE", exercise_id: "ex1" });
  } catch (e) {
    err = e;
  }

  assert.ok(err);
  assert.equal(err.status ?? err.statusCode, 500);
  assert.equal(commitCalls, 0);
  assert.equal(rollbackCalls, 1);
  assert.deepEqual(invalidatedSessionIds, []);
});

test("S-V0-14 source contract: resolved return-decision replay token remains stable", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile("src/api/session_state_write_service.ts", "utf8");

  assert.match(
    source,
    /function ensureResolvedReturnDecisionReplayRejected\(summary: any, raw: unknown\): void \{[\s\S]*?if \(!isReturnDecisionEventType\(t\)\) return;[\s\S]*?if \(isReturnDecisionGateOpen\(summary\)\) return;[\s\S]*?throw conflict\("Runtime event rejected \(resolved return decision replay\)", \{[\s\S]*?failure_token: "phase6_runtime_resolved_return_decision_replay",[\s\S]*?cause: `PHASE6_RUNTIME_RESOLVED_RETURN_DECISION_REPLAY: \$\{t\}`[\s\S]*?\}\);[\s\S]*?\}/,
    "resolved return-decision replay must keep the v0 failure token and cause stable"
  );
});

test("S-V0-14 source contract: return-decision gate token remains stable", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile("src/api/session_state_write_service.ts", "utf8");

  assert.match(
    source,
    /if \(msg\.startsWith\("PHASE6_RUNTIME_AWAIT_RETURN_DECISION"\)\) \{[\s\S]*?throw badRequest\("Runtime event rejected \(await return decision\)", \{[\s\S]*?failure_token: "phase6_runtime_await_return_decision",[\s\S]*?cause: msg[\s\S]*?\}\);[\s\S]*?\}/,
    "await-return-decision mapping must keep the v0 failure token stable"
  );
});
