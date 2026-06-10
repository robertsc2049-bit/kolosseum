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

      if (/SELECT session_id, status, planned_session, session_state_summary\s+FROM sessions\s+WHERE session_id = \$1\s+FOR UPDATE/i.test(s)) {
        if (!currentSessionRow) return { rowCount: 0, rows: [] };
        return { rowCount: 1, rows: [currentSessionRow] };
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