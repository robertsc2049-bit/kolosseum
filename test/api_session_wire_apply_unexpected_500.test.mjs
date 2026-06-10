// test/api_session_wire_apply_unexpected_500.test.mjs
import test, { mock } from "node:test";
import assert from "node:assert/strict";

// Requires: node --test --experimental-test-module-mocks
// Mock by absolute dist URLs so Node can resolve modules deterministically.

const distPoolUrl = new URL("../dist/src/db/pool.js", import.meta.url).href;
const distHttpErrorsUrl = new URL("../dist/src/api/http_errors.js", import.meta.url).href;
const distHandlerUrl = new URL("../dist/src/api/sessions.handlers.js", import.meta.url).href;

let nextSeq = 0;

mock.module(distPoolUrl, {
  namedExports: {
    pool: {
      connect: async () => {
        const client = {
          query: async (sql, params) => {
            const s = String(sql);

            if (/BEGIN/i.test(s)) return { rowCount: 0, rows: [] };
            if (/COMMIT/i.test(s)) return { rowCount: 0, rows: [] };
            if (/ROLLBACK/i.test(s)) return { rowCount: 0, rows: [] };

            // loadSessionForUpdate() in appendRuntimeEvent()
            if (/SELECT session_id, status, planned_session, session_state_summary\s+FROM sessions\s+WHERE session_id = \$1\s+FOR UPDATE/i.test(s)) {
              return {
                rowCount: 1,
                rows: [
                  {
                    session_id: "s_test",
                    status: "in_progress",
                    planned_session: {
                      exercises: [{ exercise_id: "ex1", source: "program" }],
                      notes: []
                    },
                    session_state_summary: { started: true, runtime: { remaining_ids: ["ex1"] } }
                  }
                ]
              };
            }

            // allocNextSeq(): insert seed row
            if (/INSERT INTO session_event_seq\(session_id, next_seq\)/i.test(s)) {
              return { rowCount: 1, rows: [] };
            }

            // allocNextSeq(): update + return
            if (/UPDATE session_event_seq\s+SET next_seq = next_seq \+ 1/i.test(s)) {
              nextSeq += 1;
              return { rowCount: 1, rows: [{ next_seq: nextSeq }] };
            }

            // runtime_events insert
            if (/INSERT INTO runtime_events\(session_id, seq, event\)/i.test(s)) {
              return { rowCount: 1, rows: [] };
            }

            // summary update (won't be reached if applyWireEvent throws, but harmless)
            if (/UPDATE sessions\s+SET session_state_summary = \$2::jsonb/i.test(s)) {
              return { rowCount: 1, rows: [] };
            }

            // status update (auto-start path; not expected here)
            if (/UPDATE sessions\s+SET status = 'in_progress'/i.test(s)) {
              return { rowCount: 1, rows: [] };
            }

            return { rowCount: 0, rows: [] };
          },
          release: () => {}
        };
        return client;
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
    // No upgrade needed for this test; keep it simple
    normalizeSummary: (_planned, rawSummary) => ({ summary: rawSummary, needsUpgrade: false }),
    deriveTrace: () => ({ started: true, remaining_ids: [], completed_ids: [], dropped_ids: [] }),
    validateWireRuntimeEvent: (x) => x,
    applyWireEvent: () => {
      throw new Error("SOME_UNEXPECTED_ENGINE_BUG");
    }
  }
});

const { appendRuntimeEvent } = await import(distHandlerUrl);

test("POST /sessions/:id/events returns 500 when wire apply throws unexpected error (no 4xx misclassification)", async () => {
  const req = {
    params: { session_id: "s_test" },
    body: { event: { type: "COMPLETE_EXERCISE", exercise_id: "ex1" } }
  };

  const res = {
    _status: null,
    _json: null,
    status(code) { this._status = code; return this; },
    json(payload) { this._json = payload; return this; }
  };

  let err;
  try {
    await appendRuntimeEvent(req, res);
  } catch (e) {
    err = e;
  }

  assert.ok(err, "expected handler to throw");
  const status = err.status ?? err.statusCode;
  assert.equal(status, 500, `expected 500, got ${status}`);
});