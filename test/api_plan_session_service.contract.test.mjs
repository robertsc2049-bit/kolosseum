import test, { mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();

const distHttpErrorsUrl = new URL("../dist/src/api/http_errors.js", import.meta.url).href;
const distEngineRunnerServiceUrl = new URL("../dist/src/api/engine_runner_service.js", import.meta.url).href;
const distEngineRunPersistenceServiceUrl = new URL("../dist/src/api/engine_run_persistence_service.js", import.meta.url).href;
const distServiceUrl = new URL("../dist/src/api/plan_session_service.js", import.meta.url).href;

let runnerCalls = [];
let persistenceCalls = [];
let failPersistence = false;

function resetState() {
  runnerCalls = [];
  persistenceCalls = [];
  failPersistence = false;
}

mock.module(distHttpErrorsUrl, {
  namedExports: {
    badRequest: (msg, meta) => Object.assign(new Error(msg), { status: 400, meta }),
    notFound: (msg, meta) => Object.assign(new Error(msg), { status: 404, meta }),
    upstreamBadGateway: (msg, meta) => Object.assign(new Error(msg), { status: 502, meta }),
    internalError: (msg, meta) => Object.assign(new Error(msg), { status: 500, meta })
  }
});

mock.module(distEngineRunnerServiceUrl, {
  namedExports: {
    runPipelineFromDist: async (input) => {
      runnerCalls.push(input);
      return {
        ok: true,
        session: {
          exercises: [{ exercise_id: "ex1", source: "program" }]
        },
        trace: { source: "runner-ok" }
      };
    }
  }
});

mock.module(distEngineRunPersistenceServiceUrl, {
  namedExports: {
    persistEngineRunBestEffort: async (kind, input, output) => {
      persistenceCalls.push({
        kind,
        input,
        output,
        simulated_failure: failPersistence
      });

      return;
    }
  }
});

const { planSessionService } = await import(distServiceUrl);

test("planSessionService falls back to vanilla_minimal fixture and delegates best-effort engine run persistence", async () => {
  resetState();

  const out = await planSessionService({});

  assert.equal(out.ok, true);
  assert.ok(Array.isArray(out.session.exercises));
  assert.equal(out.session.exercises.length, 1);

  const fixturePath = path.join(repo, "test", "fixtures", "golden", "inputs", "vanilla_minimal.json");
  const expectedFixture = JSON.parse(await fs.promises.readFile(fixturePath, "utf8"));

  assert.equal(runnerCalls.length, 1, "expected runner to be invoked once");
  assert.deepEqual(runnerCalls[0], expectedFixture, "expected empty input to fall back to vanilla_minimal fixture");

  assert.equal(persistenceCalls.length, 1, "expected persistence helper to be invoked once");
  assert.equal(persistenceCalls[0].kind, "plan_session");
  assert.deepEqual(persistenceCalls[0].input, expectedFixture);
  assert.equal(persistenceCalls[0].output.ok, true);
  assert.equal(persistenceCalls[0].simulated_failure, false);
});

test("planSessionService passes through explicit input to the dist runner and persistence helper", async () => {
  resetState();

  const input = {
    user: { activity: "general_strength" },
    constraints: { available_equipment: ["barbell"] }
  };

  const out = await planSessionService(input);

  assert.equal(out.ok, true);
  assert.equal(runnerCalls.length, 1);
  assert.deepEqual(runnerCalls[0], input);

  assert.equal(persistenceCalls.length, 1);
  assert.equal(persistenceCalls[0].kind, "plan_session");
  assert.deepEqual(persistenceCalls[0].input, input);
  assert.equal(persistenceCalls[0].output.ok, true);
  assert.equal(persistenceCalls[0].simulated_failure, false);
});

test("planSessionService preserves response success contract when persistence helper is in failure mode", async () => {
  resetState();
  failPersistence = true;

  const out = await planSessionService({ explicit: true });

  assert.equal(out.ok, true);
  assert.equal(out.trace.source, "runner-ok");
  assert.equal(runnerCalls.length, 1);
  assert.deepEqual(runnerCalls[0], { explicit: true });

  assert.equal(persistenceCalls.length, 1);
  assert.equal(persistenceCalls[0].kind, "plan_session");
  assert.deepEqual(persistenceCalls[0].input, { explicit: true });
  assert.equal(persistenceCalls[0].simulated_failure, true);
});

test("planSessionService source contract: delegates engine execution to runPipelineFromDist", async () => {
  const srcPath = path.join(repo, "src", "api", "plan_session_service.ts");
  const src = await fs.promises.readFile(srcPath, "utf8");

  assert.match(src, /import\s+\{\s*runPipelineFromDist\s*\}\s+from\s+"\.\/engine_runner_service\.js"/);
  assert.match(src, /const\s+out\s*=\s*await\s+runPipelineFromDist\(effectiveInput\)/);
});

test("planSessionService source contract: delegates persistence to persistEngineRunBestEffort", async () => {
  const srcPath = path.join(repo, "src", "api", "plan_session_service.ts");
  const src = await fs.promises.readFile(srcPath, "utf8");

  assert.match(src, /import\s+\{\s*persistEngineRunBestEffort\s*\}\s+from\s+"\.\/engine_run_persistence_service\.js"/);
  assert.match(src, /await\s+persistEngineRunBestEffort\("plan_session",\s*effectiveInput,\s*out\)/);
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