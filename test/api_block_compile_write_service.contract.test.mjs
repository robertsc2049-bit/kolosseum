import test, { mock } from "node:test";
import assert from "node:assert/strict";

const distPoolUrl = new URL("../dist/src/db/pool.js", import.meta.url).href;
const distServiceUrl = new URL("../dist/src/api/block_compile_write_service.js", import.meta.url).href;

let state = {};

function resetState() {
  state = {
    connectCalls: 0,
    releaseCalls: 0,
    queries: [],
    returningBlockId: null,
    mirrorInsertedBlockIdOnReturn: false,
    sessionEventSeqThrowsMissingRelation: false,
    failAfterBegin: null
  };
}

resetState();

const client = {
  async query(sql, params) {
    const text = String(sql);
    state.queries.push({ sql: text, params });

    if (state.failAfterBegin && state.failAfterBegin.test(text)) {
      throw new Error("forced write failure");
    }

    if (/INSERT INTO blocks/i.test(text) && state.mirrorInsertedBlockIdOnReturn) {
      state.returningBlockId = params?.[0] ?? null;
    }

    if (/RETURNING block_id/i.test(text)) {
      return {
        rowCount: 1,
        rows: [{ block_id: state.returningBlockId }]
      };
    }

    return { rowCount: 1, rows: [] };
  },
  release() {
    state.releaseCalls += 1;
  }
};

const pool = {
  async connect() {
    state.connectCalls += 1;
    return {
      query: async (sql, params) => {
        if (
          state.sessionEventSeqThrowsMissingRelation &&
          /INSERT INTO session_event_seq/i.test(String(sql))
        ) {
          throw new Error('relation "session_event_seq" does not exist');
        }
        return client.query(sql, params);
      },
      release: () => client.release()
    };
  }
};

mock.module(distPoolUrl, {
  namedExports: { pool }
});

const { persistCompiledBlockAndMaybeCreateSession } = await import(distServiceUrl);

function makeArgs(overrides = {}) {
  return {
    engine_version: "EB2-1.0.0",
    canonical_hash: "hash_123",
    canonical_input: { activity: "powerlifting" },
    phase2_canonical_payload: { phase2_hash: "phase2_hash_123" },
    phase3_output: { constraints: {} },
    phase4_program: { program_id: "p1" },
    phase5_adjustments: [],
    planned_session_from_engine: { exercises: [{ exercise_id: "ex1" }] },
    create_session: false,
    ...overrides
  };
}

test("persistCompiledBlockAndMaybeCreateSession upserts block and returns created_block=true when RETURNING block_id matches generated id", async () => {
  resetState();
  state.mirrorInsertedBlockIdOnReturn = true;

  const out = await persistCompiledBlockAndMaybeCreateSession(makeArgs());

  assert.equal(state.connectCalls, 1);
  assert.equal(state.releaseCalls, 1);
  assert.equal(out.persisted_block_id, state.returningBlockId);
  assert.equal(out.created_block, true);
  assert.equal(out.session_id, undefined);

  assert.match(state.queries[0].sql, /BEGIN/i);
  assert.ok(state.queries.some((x) => /INSERT INTO blocks/i.test(x.sql)));
  assert.ok(state.queries.some((x) => /COMMIT/i.test(x.sql)));

  const insert = state.queries.find((x) => /INSERT INTO blocks/i.test(x.sql));
  assert.ok(insert, "expected block insert query");
  assert.match(insert.params[0], /^b_[a-f0-9]{32}$/i);
  assert.equal(insert.params[1], "EB2-1.0.0");
  assert.equal(insert.params[2], "hash_123");
  assert.deepEqual(JSON.parse(insert.params[3]), { activity: "powerlifting" });
  assert.deepEqual(JSON.parse(insert.params[4]), { phase2_hash: "phase2_hash_123" });
  assert.deepEqual(JSON.parse(insert.params[5]), { constraints: {} });
  assert.deepEqual(JSON.parse(insert.params[6]), { program_id: "p1" });
  assert.deepEqual(JSON.parse(insert.params[7]), []);
});

test("persistCompiledBlockAndMaybeCreateSession creates session and initializes session_event_seq when create_session=true", async () => {
  resetState();
  state.mirrorInsertedBlockIdOnReturn = true;

  const out = await persistCompiledBlockAndMaybeCreateSession(
    makeArgs({ create_session: true })
  );

  assert.equal(out.persisted_block_id, state.returningBlockId);
  assert.equal(out.created_block, true);
  assert.equal(typeof out.session_id, "string");
  assert.match(out.session_id, /^s_[a-f0-9]{32}$/i);

  const sessionInsert = state.queries.find((x) => /INSERT INTO sessions/i.test(x.sql));
  assert.ok(sessionInsert, "expected session insert query");
  assert.equal(sessionInsert.params[0], out.session_id);
  assert.equal(sessionInsert.params[2], out.persisted_block_id);

  const stored = JSON.parse(sessionInsert.params[1]);
  assert.equal(stored.session_id, out.session_id);
  assert.deepEqual(stored.exercises, [{ exercise_id: "ex1" }]);

  const seqInit = state.queries.find((x) => /INSERT INTO session_event_seq/i.test(x.sql));
  assert.ok(seqInit, "expected session_event_seq init query");
  assert.deepEqual(seqInit.params, [out.session_id]);
});

test("persistCompiledBlockAndMaybeCreateSession returns created_block=false when returning block_id differs from generated id", async () => {
  resetState();
  state.returningBlockId = "b_existing";

  const out = await persistCompiledBlockAndMaybeCreateSession(makeArgs());

  assert.equal(out.persisted_block_id, "b_existing");
  assert.equal(out.created_block, false);
  assert.equal(out.session_id, undefined);
});

test("persistCompiledBlockAndMaybeCreateSession tolerates missing session_event_seq relation", async () => {
  resetState();
  state.returningBlockId = "b_existing";
  state.sessionEventSeqThrowsMissingRelation = true;

  const out = await persistCompiledBlockAndMaybeCreateSession(
    makeArgs({ create_session: true })
  );

  assert.equal(out.persisted_block_id, "b_existing");
  assert.equal(out.created_block, false);
  assert.equal(typeof out.session_id, "string");
  assert.match(out.session_id, /^s_[a-f0-9]{32}$/i);
});

test("persistCompiledBlockAndMaybeCreateSession rolls back and releases client when write fails", async () => {
  resetState();
  state.returningBlockId = "b_existing";
  state.failAfterBegin = /INSERT INTO blocks/i;

  await assert.rejects(
    () => persistCompiledBlockAndMaybeCreateSession(makeArgs()),
    /forced write failure/
  );

  assert.ok(state.queries.some((x) => /BEGIN/i.test(x.sql)));
  assert.ok(state.queries.some((x) => /ROLLBACK/i.test(x.sql)));
  assert.equal(state.releaseCalls, 1);
});