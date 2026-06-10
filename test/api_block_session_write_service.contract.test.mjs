import test, { mock } from "node:test";
import assert from "node:assert/strict";

const distPoolUrl = new URL("../dist/src/db/pool.js", import.meta.url).href;
const distServiceUrl = new URL("../dist/src/api/block_session_write_service.js", import.meta.url).href;

let poolState = {};

function resetPoolState() {
  poolState = {
    queryCalls: [],
    blockRows: [{ block_id: "b_existing" }],
    insertSessionRows: [],
    sessionEventSeqThrowsMissingRelation: false
  };
}

resetPoolState();

const pool = {
  async query(sql, params) {
    const text = String(sql);
    poolState.queryCalls.push({ sql: text, params });

    if (/SELECT block_id FROM blocks WHERE block_id = \$1/i.test(text)) {
      return { rowCount: poolState.blockRows.length, rows: poolState.blockRows };
    }

    if (/INSERT INTO sessions/i.test(text)) {
      poolState.insertSessionRows.push({ sql: text, params });
      return { rowCount: 1, rows: [] };
    }

    if (/INSERT INTO session_event_seq/i.test(text)) {
      if (poolState.sessionEventSeqThrowsMissingRelation) {
        throw new Error('relation "session_event_seq" does not exist');
      }
      return { rowCount: 1, rows: [] };
    }

    return { rowCount: 0, rows: [] };
  }
};

mock.module(distPoolUrl, {
  namedExports: { pool }
});

const { createSessionFromBlockMutation } = await import(distServiceUrl);

test("createSessionFromBlockMutation verifies block exists, inserts created session, initializes seq at 0, and returns session_id", async () => {
  resetPoolState();

  const planned = { exercises: [{ exercise_id: "ex1" }] };
  const out = await createSessionFromBlockMutation("b_existing", planned);

  assert.equal(typeof out.session_id, "string");
  assert.match(out.session_id, /^s_[a-f0-9]{32}$/i);

  assert.ok(poolState.queryCalls.some((x) => /SELECT block_id FROM blocks/i.test(x.sql)));
  assert.ok(poolState.queryCalls.some((x) => /INSERT INTO sessions/i.test(x.sql)));
  assert.ok(poolState.queryCalls.some((x) => /INSERT INTO session_event_seq/i.test(x.sql)));

  const inserted = poolState.insertSessionRows.at(-1);
  assert.ok(inserted, "expected session insert call");
  assert.equal(inserted.params[2], "b_existing");

  const stored = JSON.parse(inserted.params[1]);
  assert.equal(stored.session_id, out.session_id);
  assert.deepEqual(stored.exercises, planned.exercises);
});

test("createSessionFromBlockMutation throws 404 when block does not exist", async () => {
  resetPoolState();
  poolState.blockRows = [];

  await assert.rejects(
    () => createSessionFromBlockMutation("b_missing", { exercises: [] }),
    /Block not found/
  );
});

test("createSessionFromBlockMutation tolerates missing session_event_seq relation", async () => {
  resetPoolState();
  poolState.sessionEventSeqThrowsMissingRelation = true;

  const out = await createSessionFromBlockMutation("b_existing", { exercises: [] });
  assert.equal(typeof out.session_id, "string");
});