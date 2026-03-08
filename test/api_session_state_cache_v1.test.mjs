// test/api_session_state_cache_v1.test.mjs
import test, { mock } from "node:test";
import assert from "node:assert/strict";

// Requires: node --test --experimental-test-module-mocks

const distPoolUrl = new URL("../dist/src/db/pool.js", import.meta.url).href;
const distHandlerUrl = new URL("../dist/src/api/sessions.handlers.js", import.meta.url).href;
const distHttpErrorsUrl = new URL("../dist/src/api/http_errors.js", import.meta.url).href;

// We do NOT mock session_state_cache; we want the real cache behavior.

let connectCalls = 0;
let loadStateSelectCalls = 0;
let nextSeq = 0;

function makeDbClient() {
  return {
    query: async (sql, _params) => {
      const s = String(sql);

      if (/BEGIN/i.test(s)) return { rowCount: 0, rows: [] };
      if (/COMMIT/i.test(s)) return { rowCount: 0, rows: [] };
      if (/ROLLBACK/i.test(s)) return { rowCount: 0, rows: [] };

      // loadSession() in getSessionState()
      if (/SELECT session_id, planned_session, session_state_summary\s+FROM sessions\s+WHERE session_id = \$1/i.test(s)) {
        loadStateSelectCalls += 1;
        return {
          rowCount: 1,
          rows: [
            {
              session_id: "s_cache",
              planned_session: {
                exercises: [{ exercise_id: "ex1", source: "program" }],
                notes: []
              },
              session_state_summary: {
                started: true,
                runtime: {
                  remaining_ids: ["ex1"],
                  return_decision_required: false,
                  return_decision_options: []
                }
              }
            }
          ]
        };
      }

      // loadSessionForUpdate() in appendRuntimeEvent()
      if (/SELECT session_id, status, planned_session, session_state_summary\s+FROM sessions\s+WHERE session_id = \$1\s+FOR UPDATE/i.test(s)) {
        return {
          rowCount: 1,
          rows: [
            {
              session_id: "s_cache",
              status: "in_progress",
              planned_session: {
                exercises: [{ exercise_id: "ex1", source: "program" }],
                notes: []
              },
              session_state_summary: {
                started: true,
                runtime: {
                  remaining_ids: ["ex1"],
                  return_decision_required: false,
                  return_decision_options: []
                }
              }
            }
          ]
        };
      }

      // allocNextSeq(): seed
      if (/INSERT INTO session_event_seq\(session_id, next_seq\)/i.test(s)) {
        return { rowCount: 1, rows: [] };
      }

      // allocNextSeq(): bump
      if (/UPDATE session_event_seq\s+SET next_seq = next_seq \+ 1/i.test(s)) {
        nextSeq += 1;
        return { rowCount: 1, rows: [{ next_seq: nextSeq }] };
      }

      // runtime_events insert
      if (/INSERT INTO runtime_events\(session_id, seq, event\)/i.test(s)) {
        return { rowCount: 1, rows: [] };
      }

      // session summary update
      if (/UPDATE sessions\s+SET session_state_summary = \$2::jsonb/i.test(s)) {
        return { rowCount: 1, rows: [] };
      }

      // status update (auto-start path)
      if (/UPDATE sessions\s+SET status = 'in_progress'/i.test(s)) {
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
        return makeDbClient();
      },
      query: async () => ({ rowCount: 0, rows: [] })
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
        remaining_ids: rt.remaining_ids ?? [],
        completed_ids: rt.completed_ids ?? [],
        dropped_ids: rt.dropped_ids ?? []
      };
    },
    validateWireRuntimeEvent: (x) => x,
    applyWireEvent: (summary, ev) => {
      // minimal reducer: if COMPLETE_EXERCISE, move ex1 from remaining -> completed
      if (ev?.type === "COMPLETE_EXERCISE") {
        const rt = summary.runtime ?? {};
        const remaining = Array.isArray(rt.remaining_ids) ? rt.remaining_ids : [];
        const completed = Array.isArray(rt.completed_ids) ? rt.completed_ids : [];
        const exId = ev.exercise_id;

        return {
          ...summary,
          runtime: {
            ...rt,
            remaining_ids: remaining.filter((x) => x !== exId),
            completed_ids: completed.concat([exId]),
            return_decision_required: rt.return_decision_required ?? false,
            return_decision_options: rt.return_decision_options ?? []
          }
        };
      }
      return summary;
    }
  }
});

const { getSessionState, appendRuntimeEvent } = await import(distHandlerUrl);

function makeRes() {
  return {
    _status: null,
    _json: null,
    status(code) { this._status = code; return this; },
    json(payload) { this._json = payload; return this; }
  };
}

test("GET /sessions/:id/state is cached (second call avoids DB connect/select)", async () => {
  connectCalls = 0;
  loadStateSelectCalls = 0;

  const req = { params: { session_id: "s_cache" } };
  const res1 = makeRes();
  await getSessionState(req, res1);

  const res2 = makeRes();
  await getSessionState(req, res2);

  assert.equal(connectCalls, 1, "expected only one DB connect due to cache hit");
  assert.equal(loadStateSelectCalls, 1, "expected only one loadSession SELECT due to cache hit");
  assert.equal(res1._json.session_id, "s_cache");
  assert.equal(res2._json.session_id, "s_cache");

  assert.equal(res1._json.trace.return_decision_required, false);
  assert.deepEqual(res1._json.trace.return_decision_options, []);
  assert.equal(Object.prototype.hasOwnProperty.call(res1._json.trace, "split_active"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(res1._json.trace, "remaining_at_split_ids"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(res1._json.trace, "return_gate_required"), false);

  assert.equal(res2._json.trace.return_decision_required, false);
  assert.deepEqual(res2._json.trace.return_decision_options, []);
  assert.equal(Object.prototype.hasOwnProperty.call(res2._json.trace, "split_active"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(res2._json.trace, "remaining_at_split_ids"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(res2._json.trace, "return_gate_required"), false);
});

test("appendRuntimeEvent invalidates session state cache (next state call hits DB again)", async () => {
  connectCalls = 0;
  loadStateSelectCalls = 0;
  nextSeq = 0;

  // prime cache
  const reqState = { params: { session_id: "s_cache" } };
  const resPrime = makeRes();
  await getSessionState(reqState, resPrime);

  assert.equal(connectCalls, 1);
  assert.equal(loadStateSelectCalls, 1);

  // apply event -> should invalidate cache on commit
  const reqEv = {
    params: { session_id: "s_cache" },
    body: { event: { type: "COMPLETE_EXERCISE", exercise_id: "ex1" } }
  };
  const resEv = makeRes();
  await appendRuntimeEvent(reqEv, resEv);

  // next state call should re-hit DB (cache invalidated)
  const resAfter = makeRes();
  await getSessionState(reqState, resAfter);

  assert.equal(connectCalls, 2, "expected second DB connect after invalidation");
  assert.equal(loadStateSelectCalls, 2, "expected second loadSession SELECT after invalidation");

  assert.equal(resPrime._json.trace.return_decision_required, false);
  assert.deepEqual(resPrime._json.trace.return_decision_options, []);
  assert.equal(Object.prototype.hasOwnProperty.call(resPrime._json.trace, "split_active"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(resPrime._json.trace, "remaining_at_split_ids"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(resPrime._json.trace, "return_gate_required"), false);

  assert.equal(resAfter._json.trace.return_decision_required, false);
  assert.deepEqual(resAfter._json.trace.return_decision_options, []);
  assert.equal(Object.prototype.hasOwnProperty.call(resAfter._json.trace, "split_active"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(resAfter._json.trace, "remaining_at_split_ids"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(resAfter._json.trace, "return_gate_required"), false);
});