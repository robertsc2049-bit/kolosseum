import test, { mock } from "node:test";
import assert from "node:assert/strict";

const distPoolUrl = new URL("../dist/src/db/pool.js", import.meta.url).href;
const distHttpErrorsUrl = new URL("../dist/src/api/http_errors.js", import.meta.url).href;
const distQueryServiceUrl = new URL("../dist/src/api/session_state_query_service.js", import.meta.url).href;
const distSessionStateCacheUrl = new URL("../dist/src/api/session_state_cache.js", import.meta.url).href;

let connectCalls = 0;
let selectCalls = 0;
let updateCalls = [];
let currentRow = null;

function makeClient() {
  return {
    query: async (sql, params) => {
      const s = String(sql);

      if (/SELECT session_id, planned_session, session_state_summary\s+FROM sessions\s+WHERE session_id = \$1/i.test(s)) {
        selectCalls += 1;
        if (!currentRow) return { rowCount: 0, rows: [] };
        return { rowCount: 1, rows: [currentRow] };
      }

      if (/UPDATE sessions\s+SET session_state_summary = \$2::jsonb/i.test(s)) {
        updateCalls.push({ sql: s, params });
        return { rowCount: 1, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    },
    release: () => {}
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
    upstreamBadGateway: (msg, meta) => Object.assign(new Error(msg), { status: 502, meta }),
    internalError: (msg, meta) => Object.assign(new Error(msg), { status: 500, meta })
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
            : []
      };
    },
    validateWireRuntimeEvent: (x) => x,
    applyWireEvent: () => {
      throw new Error("not used");
    }
  }
});

const { getSessionStateQuery } = await import(distQueryServiceUrl);
const { sessionStateCache } = await import(distSessionStateCacheUrl);

function resetState() {
  connectCalls = 0;
  selectCalls = 0;
  updateCalls = [];
  currentRow = null;
  sessionStateCache.clear();
}

test("getSessionStateQuery caches projected payload after first successful load", async () => {
  resetState();

  currentRow = {
    session_id: "s_query_cache",
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

  const first = await getSessionStateQuery("s_query_cache");
  const second = await getSessionStateQuery("s_query_cache");

  assert.equal(connectCalls, 1, "expected second call to hit cache before DB connect");
  assert.equal(selectCalls, 1, "expected exactly one SELECT before cache hit");

  assert.equal(first.session_id, "s_query_cache");
  assert.equal(second.session_id, "s_query_cache");
  assert.deepEqual(second, first, "expected cached payload to preserve projected contract");

  assert.equal(first.trace.return_decision_required, false);
  assert.deepEqual(first.trace.return_decision_options, []);
  assert.equal(Object.prototype.hasOwnProperty.call(first.trace, "split_active"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(first.trace, "remaining_at_split_ids"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(first.trace, "return_gate_required"), false);
});

test("getSessionStateQuery throws 404 when session does not exist", async () => {
  resetState();

  let err;
  try {
    await getSessionStateQuery("missing_session");
  } catch (e) {
    err = e;
  }

  assert.ok(err, "expected query service to throw");
  assert.equal(err.status ?? err.statusCode, 404);
  assert.equal(connectCalls, 1, "expected one DB connect for missing session");
  assert.equal(selectCalls, 1, "expected one SELECT for missing session");
});

test("getSessionStateQuery persists legacy return-decision upgrade and exposes only public trace fields", async () => {
  resetState();

  currentRow = {
    session_id: "s_query_upgrade",
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
        split_active: true,
        remaining_ids: ["ex2"],
        completed_ids: ["ex1"],
        skipped_ids: []
      }
    }
  };

  const payload = await getSessionStateQuery("s_query_upgrade");

  assert.equal(connectCalls, 1);
  assert.equal(selectCalls, 1);
  assert.equal(updateCalls.length, 1, "expected upgraded summary to be persisted once");

  assert.equal(payload.session_id, "s_query_upgrade");
  assert.equal(payload.trace.return_decision_required, true);
  assert.deepEqual(payload.trace.return_decision_options, ["RETURN_CONTINUE", "RETURN_SKIP"]);

  assert.equal(
    Object.prototype.hasOwnProperty.call(payload.trace, "split_active"),
    false,
    "trace must not expose split_active"
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(payload.trace, "remaining_at_split_ids"),
    false,
    "trace must not expose remaining_at_split_ids"
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(payload.trace, "return_gate_required"),
    false,
    "trace must not expose return_gate_required"
  );

  const persistedJson = updateCalls[0]?.params?.[1];
  assert.equal(typeof persistedJson, "string", "expected persisted upgraded summary JSON payload");

  const persisted = JSON.parse(persistedJson);
  assert.equal(persisted.runtime.return_decision_required, true);
  assert.deepEqual(persisted.runtime.return_decision_options, ["RETURN_CONTINUE", "RETURN_SKIP"]);

  const cached = await getSessionStateQuery("s_query_upgrade");
  assert.equal(connectCalls, 1, "expected second upgraded read to hit cache");
  assert.deepEqual(cached, payload);
});

test("getSessionStateQuery preserves deterministic replay projection across uncached reloads", async () => {
  resetState();

  currentRow = {
    session_id: "s_query_replay_invariants",
    planned_session: {
      exercises: [
        { exercise_id: "ex1", source: "program" },
        { exercise_id: "ex2", source: "program" },
        { exercise_id: "ex3", source: "program" },
        { exercise_id: "ex4", source: "program" }
      ],
      notes: []
    },
    session_state_summary: {
      started: true,
      runtime: {
        remaining_ids: ["ex3", "ex2", "ex3"],
        completed_ids: ["ex1", "ex1"],
        dropped_ids: ["ex4", "ex2", "ex4"],
        return_decision_required: false,
        return_decision_options: []
      }
    }
  };

  const first = await getSessionStateQuery("s_query_replay_invariants");

  assert.equal(connectCalls, 1, "expected first read to hit DB once");
  assert.equal(selectCalls, 1, "expected first read to SELECT once");
  assert.equal(updateCalls.length, 0, "did not expect any upgrade write for already-explicit summary");

  assert.deepEqual(
    first.remaining_exercises.map((x) => x.exercise_id),
    ["ex3", "ex2"],
    "remaining_exercises must preserve first-seen stable order"
  );
  assert.deepEqual(
    first.completed_exercises.map((x) => x.exercise_id),
    ["ex1"],
    "completed_exercises must collapse duplicates deterministically"
  );
  assert.deepEqual(
    first.dropped_exercises.map((x) => x.exercise_id),
    ["ex4", "ex2"],
    "dropped_exercises must preserve first-seen stable order"
  );
  assert.equal(first.trace.return_decision_required, false);
  assert.deepEqual(first.trace.return_decision_options, []);
  assert.equal(Object.prototype.hasOwnProperty.call(first.trace, "split_active"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(first.trace, "remaining_at_split_ids"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(first.trace, "return_gate_required"), false);

  sessionStateCache.clear();

  const second = await getSessionStateQuery("s_query_replay_invariants");

  assert.equal(connectCalls, 2, "expected uncached reload to reconnect");
  assert.equal(selectCalls, 2, "expected uncached reload to reselect");
  assert.deepEqual(
    second,
    first,
    "uncached reload must reproduce the exact same public payload"
  );
});