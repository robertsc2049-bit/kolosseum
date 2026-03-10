import test, { mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();

const distPoolUrl = new URL("../dist/src/db/pool.js", import.meta.url).href;
const distHttpErrorsUrl = new URL("../dist/src/api/http_errors.js", import.meta.url).href;
const distServiceUrl = new URL("../dist/src/api/plan_session_service.js", import.meta.url).href;

let poolQueries = [];
let failPersistence = false;
let runnerCalls = [];

function resetState() {
  poolQueries = [];
  failPersistence = false;
  runnerCalls = [];
}

function runnerPath() {
  return path.join(repo, "dist", "src", "run_pipeline.js");
}

function backupPath() {
  return path.join(repo, "dist", "src", "run_pipeline.js.__plan_session_service_test_backup__");
}

async function writeOkRunnerModule() {
  const fullPath = runnerPath();
  const dir = path.dirname(fullPath);
  await fs.promises.mkdir(dir, { recursive: true });

  const body = `
globalThis.__planSessionRunnerCalls = globalThis.__planSessionRunnerCalls ?? [];
export async function runPipeline(input) {
  globalThis.__planSessionRunnerCalls.push(input);
  return {
    ok: true,
    session: {
      exercises: [{ exercise_id: "ex1", source: "program" }]
    },
    trace: { source: "runner-ok" }
  };
}
`;

  await fs.promises.writeFile(fullPath, body, "utf8");
}

async function withOkRunner(fn) {
  const runPath = runnerPath();
  const bakPath = backupPath();
  const hadOriginal = fs.existsSync(runPath);

  if (fs.existsSync(bakPath)) {
    await fs.promises.unlink(bakPath);
  }

  if (hadOriginal) {
    await fs.promises.copyFile(runPath, bakPath);
  }

  try {
    globalThis.__planSessionRunnerCalls = [];
    await writeOkRunnerModule();
    await fn();
    runnerCalls = [...globalThis.__planSessionRunnerCalls];
  } finally {
    delete globalThis.__planSessionRunnerCalls;

    if (fs.existsSync(bakPath)) {
      await fs.promises.copyFile(bakPath, runPath);
      await fs.promises.unlink(bakPath);
    } else if (fs.existsSync(runPath) && !hadOriginal) {
      await fs.promises.unlink(runPath);
    }
  }
}

mock.module(distPoolUrl, {
  namedExports: {
    pool: {
      query: async (sql, params) => {
        poolQueries.push({ sql: String(sql), params });

        if (failPersistence) {
          throw new Error("persistence unavailable");
        }

        return { rowCount: 1, rows: [] };
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

const { planSessionService } = await import(distServiceUrl);

test("planSessionService falls back to vanilla_minimal fixture for empty input and persists best-effort engine run", async () => {
  resetState();

  await withOkRunner(async () => {
    const out = await planSessionService({});

    assert.equal(out.ok, true);
    assert.ok(Array.isArray(out.session.exercises));
    assert.equal(out.session.exercises.length, 1);
  });

  const fixturePath = path.join(repo, "test", "fixtures", "golden", "inputs", "vanilla_minimal.json");
  const expectedFixture = JSON.parse(await fs.promises.readFile(fixturePath, "utf8"));

  assert.equal(runnerCalls.length, 1, "expected runner to be invoked once");
  assert.deepEqual(runnerCalls[0], expectedFixture, "expected empty input to fall back to vanilla_minimal fixture");

  assert.ok(poolQueries.length >= 1, "expected best-effort persistence queries");
  assert.match(poolQueries[0].sql, /CREATE TABLE IF NOT EXISTS engine_runs/i);
  assert.ok(
    poolQueries.some((x) => /INSERT INTO engine_runs/i.test(x.sql)),
    "expected engine_runs insert attempt"
  );
});

test("planSessionService passes through explicit input to the dist runner", async () => {
  resetState();

  const input = {
    user: { activity: "general_strength" },
    constraints: { available_equipment: ["barbell"] }
  };

  await withOkRunner(async () => {
    const out = await planSessionService(input);
    assert.equal(out.ok, true);
  });

  assert.equal(runnerCalls.length, 1);
  assert.deepEqual(runnerCalls[0], input);
});

test("planSessionService does not fail the request when engine_runs persistence fails", async () => {
  resetState();
  failPersistence = true;

  await withOkRunner(async () => {
    const out = await planSessionService({ explicit: true });
    assert.equal(out.ok, true);
    assert.equal(out.trace.source, "runner-ok");
  });

  assert.equal(runnerCalls.length, 1);
  assert.deepEqual(runnerCalls[0], { explicit: true });
  assert.ok(poolQueries.length >= 1, "expected persistence attempt before best-effort swallow");
});

test("planSessionService source contract: rejects ok !== true with upstreamBadGateway 502", async () => {
  const srcPath = path.join(repo, "src", "api", "plan_session_service.ts");
  const src = await fs.promises.readFile(srcPath, "utf8");

  assert.match(
    src,
    /if\s*\(!out\s*\|\|\s*out\.ok\s*!==\s*true\)\s*\{\s*throw\s+upstreamBadGateway\("Engine output invalid \(ok !== true\)"/s
  );
});

test("planSessionService source contract: rejects missing session.exercises with upstreamBadGateway 502", async () => {
  const srcPath = path.join(repo, "src", "api", "plan_session_service.ts");
  const src = await fs.promises.readFile(srcPath, "utf8");

  assert.match(
    src,
    /if\s*\(!out\.session\s*\|\|\s*!Array\.isArray\(out\.session\.exercises\)\s*\|\|\s*out\.session\.exercises\.length\s*<\s*1\)\s*\{\s*throw\s+upstreamBadGateway\("Engine output invalid \(missing session\.exercises\)"/s
  );
});