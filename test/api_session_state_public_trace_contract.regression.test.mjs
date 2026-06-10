import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

function makeReq(sessionId) {
  return {
    params: { session_id: sessionId }
  };
}

function makeRes() {
  return {
    statusCode: 200,
    _json: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this._json = payload;
      return this;
    }
  };
}

test("GET /sessions/:id/state exposes only explicit public return decision trace fields", async () => {
  const repo = process.cwd();
  const distHandlerUrl = pathToFileURL(path.join(repo, "dist", "src", "api", "sessions.handlers.js")).href;
  const dbUrl = pathToFileURL(path.join(repo, "dist", "src", "db", "index.js")).href;

  const db = await import(dbUrl);
  const originalQuery = db.query;

  db.query = async (sql, params) => {
    const text = String(sql);

    if (text.includes("from sessions") || text.includes("FROM sessions")) {
      return {
        rows: [
          {
            id: params?.[0] ?? "sess_trace_public_contract",
            status: "IN_PROGRESS",
            current_step: 2,
            current_exercise_id: "exB",
            runtime_state: {
              current_step: 2,
              current_exercise_id: "exB",
              return_decision_required: true,
              return_decision_options: ["RETURN_CONTINUE", "RETURN_SKIP"],
              split_active: true,
              remaining_at_split_ids: ["exC", "exD"]
            },
            runtime_trace: {
              return_decision_required: true,
              return_decision_options: ["RETURN_CONTINUE", "RETURN_SKIP"],
              split_active: true,
              remaining_at_split_ids: ["exC", "exD"],
              return_gate_required: true
            }
          }
        ]
      };
    }

    return { rows: [], rowCount: 0 };
  };

  try {
    const { getSessionState } = await import(distHandlerUrl);
    const req = makeReq("sess_trace_public_contract");
    const res = makeRes();

    await getSessionState(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(res._json, "expected JSON payload");
    assert.ok(res._json.trace, "expected trace object");

    const trace = res._json.trace;

    assert.equal(trace.return_decision_required, true);
    assert.deepEqual(trace.return_decision_options, ["RETURN_CONTINUE", "RETURN_SKIP"]);

    assert.equal(
      Object.prototype.hasOwnProperty.call(trace, "split_active"),
      false,
      "trace must not expose split_active"
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(trace, "remaining_at_split_ids"),
      false,
      "trace must not expose remaining_at_split_ids"
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(trace, "return_gate_required"),
      false,
      "trace must not expose return_gate_required"
    );
  } finally {
    db.query = originalQuery;
  }
});