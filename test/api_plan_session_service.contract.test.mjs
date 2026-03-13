import test, { mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();

const distEngineRunnerServiceUrl = new URL("../dist/src/api/engine_runner_service.js", import.meta.url).href;
const distEngineRunPersistenceServiceUrl = new URL("../dist/src/api/engine_run_persistence_service.js", import.meta.url).href;
const distDefaultInputServiceUrl = new URL("../dist/src/api/plan_session_default_input_service.js", import.meta.url).href;
const distOutputValidationServiceUrl = new URL("../dist/src/api/plan_session_output_validation_service.js", import.meta.url).href;
const distServiceUrl = new URL("../dist/src/api/plan_session_service.js", import.meta.url).href;

let runnerCalls = [];
let persistenceCalls = [];
let defaultLoaderCalls = 0;
let defaultLoaderValue = null;
let validationCalls = [];

function resetState() {
  runnerCalls = [];
  persistenceCalls = [];
  defaultLoaderCalls = 0;
  defaultLoaderValue = null;
  validationCalls = [];
}

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
      persistenceCalls.push({ kind, input, output });
    }
  }
});

mock.module(distDefaultInputServiceUrl, {
  namedExports: {
    loadPlanSessionDefaultInput: async () => {
      defaultLoaderCalls += 1;
      return defaultLoaderValue;
    }
  }
});

mock.module(distOutputValidationServiceUrl, {
  namedExports: {
    validatePlanSessionOutput: (out) => {
      validationCalls.push(out);
    }
  }
});

const { planSessionService } = await import(distServiceUrl);

test("planSessionService falls back to default input loader and delegates validation plus best-effort persistence", async () => {
  resetState();

  const fixturePath = path.join(repo, "test", "fixtures", "golden", "inputs", "vanilla_minimal.json");
  defaultLoaderValue = JSON.parse(await fs.promises.readFile(fixturePath, "utf8"));

  const out = await planSessionService({});

  assert.equal(out.ok, true);
  assert.ok(Array.isArray(out.session.exercises));
  assert.equal(out.session.exercises.length, 1);

  assert.equal(defaultLoaderCalls, 1, "expected default loader to be invoked once");
  assert.equal(runnerCalls.length, 1, "expected runner to be invoked once");
  assert.deepEqual(runnerCalls[0], defaultLoaderValue, "expected empty input to fall back to default loader");

  assert.equal(validationCalls.length, 1, "expected validation helper to be invoked once");
  assert.equal(validationCalls[0].ok, true);
  assert.ok(Array.isArray(validationCalls[0].session.exercises));

  assert.equal(persistenceCalls.length, 1, "expected persistence helper to be invoked once");
  assert.equal(persistenceCalls[0].kind, "plan_session");
  assert.deepEqual(persistenceCalls[0].input, defaultLoaderValue);
  assert.equal(persistenceCalls[0].output.ok, true);
});

test("planSessionService passes through explicit input without invoking default loader", async () => {
  resetState();

  const input = {
    user: { activity: "general_strength" },
    constraints: { available_equipment: ["barbell"] }
  };

  const out = await planSessionService(input);

  assert.equal(out.ok, true);
  assert.equal(defaultLoaderCalls, 0);
  assert.equal(runnerCalls.length, 1);
  assert.deepEqual(runnerCalls[0], input);

  assert.equal(validationCalls.length, 1);
  assert.equal(validationCalls[0].ok, true);

  assert.equal(persistenceCalls.length, 1);
  assert.equal(persistenceCalls[0].kind, "plan_session");
  assert.deepEqual(persistenceCalls[0].input, input);
  assert.equal(persistenceCalls[0].output.ok, true);
});

test("planSessionService source contract: delegates default input loading to loadPlanSessionDefaultInput", async () => {
  const srcPath = path.join(repo, "src", "api", "plan_session_service.ts");
  const src = await fs.promises.readFile(srcPath, "utf8");

  assert.match(src, /import\s+\{\s*loadPlanSessionDefaultInput\s*\}\s+from\s+"\.\/plan_session_default_input_service\.js"/);
  assert.match(src, /:\s*await\s+loadPlanSessionDefaultInput\(\)/);
});

test("planSessionService source contract: delegates engine execution to runPipelineFromDist", async () => {
  const srcPath = path.join(repo, "src", "api", "plan_session_service.ts");
  const src = await fs.promises.readFile(srcPath, "utf8");

  assert.match(src, /import\s+\{\s*runPipelineFromDist\s*\}\s+from\s+"\.\/engine_runner_service\.js"/);
  assert.match(src, /const\s+out\s*=\s*await\s+runPipelineFromDist\(effectiveInput\)/);
});

test("planSessionService source contract: delegates output validation to validatePlanSessionOutput", async () => {
  const srcPath = path.join(repo, "src", "api", "plan_session_service.ts");
  const src = await fs.promises.readFile(srcPath, "utf8");

  assert.match(src, /import\s+\{\s*validatePlanSessionOutput\s*\}\s+from\s+"\.\/plan_session_output_validation_service\.js"/);
  assert.match(src, /validatePlanSessionOutput\(out\)/);
});

test("planSessionService source contract: delegates persistence to persistEngineRunBestEffort", async () => {
  const srcPath = path.join(repo, "src", "api", "plan_session_service.ts");
  const src = await fs.promises.readFile(srcPath, "utf8");

  assert.match(src, /import\s+\{\s*persistEngineRunBestEffort\s*\}\s+from\s+"\.\/engine_run_persistence_service\.js"/);
  assert.match(src, /await\s+persistEngineRunBestEffort\("plan_session",\s*effectiveInput,\s*out\)/);
});

test("planSessionOutputValidationService source contract: rejects ok !== true with upstreamBadGateway 502", async () => {
  const srcPath = path.join(repo, "src", "api", "plan_session_output_validation_service.ts");
  const src = await fs.promises.readFile(srcPath, "utf8");

  assert.match(src, /import\s+\{\s*upstreamBadGateway\s*\}\s+from\s+"\.\/http_errors\.js"/);
  assert.match(
    src,
    /if\s*\(!out\s*\|\|\s*out\.ok\s*!==\s*true\)\s*\{\s*throw\s+upstreamBadGateway\("Engine output invalid \(ok !== true\)"/s
  );
});

test("planSessionOutputValidationService source contract: rejects missing session.exercises with upstreamBadGateway 502", async () => {
  const srcPath = path.join(repo, "src", "api", "plan_session_output_validation_service.ts");
  const src = await fs.promises.readFile(srcPath, "utf8");

  assert.match(
    src,
    /if\s*\(!out\.session\s*\|\|\s*!Array\.isArray\(out\.session\.exercises\)\s*\|\|\s*out\.session\.exercises\.length\s*<\s*1\)\s*\{\s*throw\s+upstreamBadGateway\("Engine output invalid \(missing session\.exercises\)"/s
  );
});