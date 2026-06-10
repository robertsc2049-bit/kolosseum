import test, { mock } from "node:test";
import assert from "node:assert/strict";

const distPoolUrl = new URL("../dist/src/db/pool.js", import.meta.url).href;
const distServiceUrl = new URL("../dist/src/api/block_session_query_service.js", import.meta.url).href;

let poolCalls = [];
let queryRows = [];

function resetState() {
  poolCalls = [];
  queryRows = [
    { session_id: "s1", status: "created", created_at: "t1", updated_at: "t1" },
    { session_id: "s2", status: "in_progress", created_at: "t2", updated_at: "t3" }
  ];
}

resetState();

const pool = {
  async query(sql, params) {
    poolCalls.push({ sql: String(sql), params });
    return { rowCount: queryRows.length, rows: queryRows };
  }
};

mock.module(distPoolUrl, {
  namedExports: { pool }
});

const { listBlockSessionsQuery } = await import(distServiceUrl);

test("listBlockSessionsQuery returns ordered block sessions payload unchanged", async () => {
  resetState();

  const out = await listBlockSessionsQuery("b_list");

  assert.equal(poolCalls.length, 1);
  assert.match(poolCalls[0].sql, /SELECT session_id, status, created_at, updated_at/i);
  assert.match(poolCalls[0].sql, /FROM sessions/i);
  assert.match(poolCalls[0].sql, /WHERE block_id = \$1/i);
  assert.match(poolCalls[0].sql, /ORDER BY created_at ASC/i);
  assert.deepEqual(poolCalls[0].params, ["b_list"]);

  assert.deepEqual(out, { block_id: "b_list", sessions: queryRows });
});

test("listBlockSessionsQuery returns empty sessions array when none exist", async () => {
  resetState();
  queryRows = [];

  const out = await listBlockSessionsQuery("b_empty");
  assert.deepEqual(out, { block_id: "b_empty", sessions: [] });
});