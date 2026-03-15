import test, { mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();

const distEngineRunnerServiceUrl = new URL("../dist/src/api/engine_runner_service.js", import.meta.url).href;
const distEngineRunPersistenceServiceUrl = new URL("../dist/src/api/engine_run_persistence_service.js", import.meta.url).href;
const distRequestNormalizationServiceUrl = new URL("../dist/src/api/plan_session_request_normalization_service.js", import.meta.url).href;
const distOutputValidationServiceUrl = new URL("../dist/src/api/plan_session_output_validation_service.js", import.meta.url).href;
const distServiceUrl = new URL("../dist/src/api/plan_session_service.js", import.meta.url).href;

let runnerCalls = [];
let persistenceCalls = [];
let normalizationCalls = [];
let normalizedInputValue = null;
let validationCalls = [];
let callLog = [];
let normalizationError = null;
let validationError = null;
let validationShouldEnforceContract = false;
let runnerReturnValue = null;
let failPersistence = false;
let runnerError = null;
let persistenceShouldRequireValidatedOutput = false;
let validatedOutputRefs = new Set();
let validationSnapshots = new Map();
let normalizedInputSnapshots = new Map();

function makeRunnerSuccessOutput() {
  return {
    ok: true,
    session: {
      exercises: [{ exercise_id: "ex1", source: "program" }]
    },
    trace: { source: "runner-ok" }
  };
}

function resetState() {
  runnerCalls = [];
  persistenceCalls = [];
  normalizationCalls = [];
  normalizedInputValue = null;
  validationCalls = [];
  callLog = [];
  normalizationError = null;
  validationError = null;
  validationShouldEnforceContract = false;
  runnerReturnValue = makeRunnerSuccessOutput();
  failPersistence = false;
  runnerError = null;
  persistenceShouldRequireValidatedOutput = false;
  validatedOutputRefs = new Set();
  validationSnapshots = new Map();
  normalizedInputSnapshots = new Map();
}

function isInvalidPlanSessionOutput(out) {
  return !out || out.ok !== true ||
    !out.session ||
    !Array.isArray(out.session.exercises) ||
    out.session.exercises.length < 1;
}

mock.module(distEngineRunnerServiceUrl, {
  namedExports: {
    runPipelineFromDist: async (input) => {
      callLog.push("run");
      runnerCalls.push(input);
      if (runnerError) {
        throw runnerError;
      }
      return runnerReturnValue;
    }
  }
});

mock.module(distEngineRunPersistenceServiceUrl, {
  namedExports: {
    persistEngineRunBestEffort: async (kind, input, output) => {
      callLog.push("persist");
      persistenceCalls.push({
        kind,
        input,
        output,
        simulated_failure: failPersistence
      });

      if (persistenceShouldRequireValidatedOutput && !validatedOutputRefs.has(output)) {
        throw new Error("persistence observed unvalidated output");
      }

      return;
    }
  }
});

mock.module(distRequestNormalizationServiceUrl, {
  namedExports: {
    normalizePlanSessionRequest: async (input) => {
      callLog.push("normalize");
      normalizationCalls.push(input);
      if (normalizationError) {
        throw normalizationError;
      }
      return normalizedInputValue;
    }
  }
});

mock.module(distOutputValidationServiceUrl, {
  namedExports: {
    validatePlanSessionOutput: (out) => {
      callLog.push("validate");
      validationCalls.push(out);

      if (validationError) {
        throw validationError;
      }

      if (validationShouldEnforceContract && isInvalidPlanSessionOutput(out)) {
        throw new Error("validation rejected invalid output");
      }

      validatedOutputRefs.add(out);
      validationSnapshots.set(out, JSON.parse(JSON.stringify(out)));
    }
  }
});

const { planSessionService } = await import(distServiceUrl);

test("planSessionService delegates request normalization, output validation, and best-effort persistence", async () => {
  resetState();

  const fixturePath = path.join(repo, "test", "fixtures", "golden", "inputs", "vanilla_minimal.json");
  normalizedInputValue = JSON.parse(await fs.promises.readFile(fixturePath, "utf8"));

  const out = await planSessionService({});

  assert.equal(out.ok, true);
  assert.ok(Array.isArray(out.session.exercises));
  assert.equal(out.session.exercises.length, 1);

  assert.equal(normalizationCalls.length, 1, "expected request normalization helper to be invoked once");
  assert.deepEqual(normalizationCalls[0], {}, "expected raw input to be passed to normalization helper");

  assert.equal(runnerCalls.length, 1, "expected runner to be invoked once");
  assert.deepEqual(runnerCalls[0], normalizedInputValue, "expected runner to receive normalized input");

  assert.equal(validationCalls.length, 1, "expected validation helper to be invoked once");
  assert.equal(validationCalls[0].ok, true);
  assert.ok(Array.isArray(validationCalls[0].session.exercises));

  assert.equal(persistenceCalls.length, 1, "expected persistence helper to be invoked once");
  assert.equal(persistenceCalls[0].kind, "plan_session");
  assert.deepEqual(persistenceCalls[0].input, normalizedInputValue);
  assert.equal(persistenceCalls[0].output.ok, true);
  assert.equal(persistenceCalls[0].simulated_failure, false);

  assert.deepEqual(callLog, ["normalize", "run", "validate", "persist"]);
});

test("planSessionService passes explicit input to request normalization helper", async () => {
  resetState();

  const input = {
    user: { activity: "general_strength" },
    constraints: { available_equipment: ["barbell"] }
  };
  normalizedInputValue = input;

  const out = await planSessionService(input);

  assert.equal(out.ok, true);

  assert.equal(normalizationCalls.length, 1);
  assert.deepEqual(normalizationCalls[0], input);

  assert.equal(runnerCalls.length, 1);
  assert.deepEqual(runnerCalls[0], input);

  assert.equal(validationCalls.length, 1);
  assert.equal(validationCalls[0].ok, true);

  assert.equal(persistenceCalls.length, 1);
  assert.equal(persistenceCalls[0].kind, "plan_session");
  assert.deepEqual(persistenceCalls[0].input, input);
  assert.equal(persistenceCalls[0].output.ok, true);
  assert.equal(persistenceCalls[0].simulated_failure, false);

  assert.deepEqual(callLog, ["normalize", "run", "validate", "persist"]);
});

test("planSessionService preserves orchestration order and returns the validated engine payload without drift", async () => {
  resetState();

  normalizedInputValue = {
    user: { activity: "powerlifting" },
    constraints: { available_equipment: ["barbell", "bench"] }
  };
  runnerReturnValue = {
    ok: true,
    session: {
      exercises: [
        { exercise_id: "squat", source: "program" },
        { exercise_id: "bench_press", source: "program" }
      ]
    },
    trace: { source: "runner-custom" }
  };

  const out = await planSessionService({ request: "raw" });

  assert.deepEqual(callLog, ["normalize", "run", "validate", "persist"]);
  assert.deepEqual(validationCalls[0], runnerReturnValue);
  assert.deepEqual(persistenceCalls[0].output, runnerReturnValue);
  assert.deepEqual(out, runnerReturnValue);
});

test("planSessionService persistence is strictly post-validation and never observes an unvalidated payload", async () => {
  resetState();

  normalizedInputValue = {
    user: { activity: "general_strength" },
    constraints: { available_equipment: ["barbell", "dumbbell"] }
  };
  runnerReturnValue = {
    ok: true,
    session: {
      exercises: [
        { exercise_id: "deadlift", source: "program" }
      ]
    },
    trace: { source: "runner-post-validation-only" }
  };
  persistenceShouldRequireValidatedOutput = true;

  const out = await planSessionService({ post_validation_only_case: true });

  assert.deepEqual(callLog, ["normalize", "run", "validate", "persist"]);
  assert.equal(validationCalls.length, 1);
  assert.equal(persistenceCalls.length, 1);
  assert.equal(validatedOutputRefs.has(runnerReturnValue), true);
  assert.equal(persistenceCalls[0].output, runnerReturnValue);
  assert.deepEqual(out, runnerReturnValue);
});

test("planSessionService returns the exact validated runner object identity without post-validation mutation", async () => {
  resetState();

  normalizedInputValue = {
    user: { activity: "powerlifting" },
    constraints: { available_equipment: ["barbell", "bench", "plates"] }
  };
  runnerReturnValue = {
    ok: true,
    session: {
      exercises: [
        { exercise_id: "squat", source: "program" },
        { exercise_id: "bench_press", source: "program" },
        { exercise_id: "row", source: "accessory" }
      ]
    },
    trace: {
      source: "runner-identity-stable",
      metadata: { block_id: "block-123" }
    }
  };

  const out = await planSessionService({ identity_case: true });

  assert.deepEqual(callLog, ["normalize", "run", "validate", "persist"]);
  assert.equal(validationCalls.length, 1);
  assert.equal(persistenceCalls.length, 1);

  assert.equal(validationCalls[0], runnerReturnValue, "validator should observe the exact runner object");
  assert.equal(persistenceCalls[0].output, runnerReturnValue, "persistence should observe the exact validated runner object");
  assert.equal(out, runnerReturnValue, "service should return the exact validated runner object identity");

  const validationSnapshot = validationSnapshots.get(runnerReturnValue);
  assert.ok(validationSnapshot, "expected a validation snapshot for the validated runner object");
  assert.deepEqual(runnerReturnValue, validationSnapshot, "validated runner object should remain unmutated after validation");
  assert.deepEqual(out, validationSnapshot, "returned object should match the validation-time snapshot exactly");
});

test("planSessionService invokes persistence exactly once for validated success paths", async () => {
  resetState();

  normalizedInputValue = {
    user: { activity: "general_strength" },
    constraints: { available_equipment: ["barbell", "dumbbell", "bench"] }
  };
  runnerReturnValue = {
    ok: true,
    session: {
      exercises: [
        { exercise_id: "deadlift", source: "program" },
        { exercise_id: "bench_press", source: "program" }
      ]
    },
    trace: {
      source: "runner-single-persist-success",
      metadata: { request_id: "req-001" }
    }
  };

  const out = await planSessionService({ success_single_persist_case: true });

  assert.deepEqual(callLog, ["normalize", "run", "validate", "persist"]);
  assert.equal(validationCalls.length, 1, "validated success path should validate exactly once");
  assert.equal(persistenceCalls.length, 1, "validated success path should persist exactly once");
  assert.equal(persistenceCalls.filter((x) => x.kind === "plan_session").length, 1, "should only record one plan_session persistence call");
  assert.equal(persistenceCalls[0].input, normalizedInputValue, "persistence should receive the normalized input exactly once");
  assert.equal(persistenceCalls[0].output, runnerReturnValue, "persistence should receive the validated output exactly once");
  assert.equal(out, runnerReturnValue, "success path should still return the validated runner object");
});

test("planSessionService preserves the exact normalized input reference across runner and persistence", async () => {
  resetState();

  normalizedInputValue = {
    user: {
      activity: "general_strength",
      profile: {
        training_age: "intermediate"
      }
    },
    constraints: {
      available_equipment: ["barbell", "bench", "dumbbell"],
      session_minutes: 45
    },
    context: {
      block_id: "block-normalized-input-reference-stable"
    }
  };
  normalizedInputSnapshots.set(
    normalizedInputValue,
    JSON.parse(JSON.stringify(normalizedInputValue))
  );

  runnerReturnValue = {
    ok: true,
    session: {
      exercises: [
        { exercise_id: "deadlift", source: "program" },
        { exercise_id: "bench_press", source: "program" }
      ]
    },
    trace: {
      source: "runner-normalized-input-reference-stable"
    }
  };

  const out = await planSessionService({ normalized_input_reference_case: true });

  assert.deepEqual(callLog, ["normalize", "run", "validate", "persist"]);
  assert.equal(runnerCalls.length, 1, "runner should be invoked exactly once");
  assert.equal(persistenceCalls.length, 1, "persistence should be invoked exactly once");

  assert.equal(runnerCalls[0], normalizedInputValue, "runner should receive the exact normalized input reference");
  assert.equal(persistenceCalls[0].input, normalizedInputValue, "persistence should receive the exact normalized input reference");
  assert.equal(runnerCalls[0], persistenceCalls[0].input, "runner and persistence should observe the same normalized input object reference");

  const normalizedSnapshot = normalizedInputSnapshots.get(normalizedInputValue);
  assert.ok(normalizedSnapshot, "expected snapshot for normalized input");
  assert.deepEqual(normalizedInputValue, normalizedSnapshot, "normalized input must remain unmutated while preserving reference identity");
  assert.equal(out, runnerReturnValue, "service should still return the validated runner object");
});

test("planSessionService never mutates normalized input before runner or persistence", async () => {
  resetState();

  normalizedInputValue = {
    user: {
      activity: "general_strength",
      profile: {
        training_age: "intermediate"
      }
    },
    constraints: {
      available_equipment: ["barbell", "bench", "dumbbell"],
      session_minutes: 45
    },
    context: {
      block_id: "block-normalized-input-stable"
    }
  };
  normalizedInputSnapshots.set(
    normalizedInputValue,
    JSON.parse(JSON.stringify(normalizedInputValue))
  );

  runnerReturnValue = {
    ok: true,
    session: {
      exercises: [
        { exercise_id: "deadlift", source: "program" },
        { exercise_id: "bench_press", source: "program" }
      ]
    },
    trace: {
      source: "runner-normalized-input-stable"
    }
  };

  const out = await planSessionService({ normalized_input_identity_case: true });

  assert.deepEqual(callLog, ["normalize", "run", "validate", "persist"]);
  assert.equal(runnerCalls.length, 1, "runner should be invoked exactly once");
  assert.equal(persistenceCalls.length, 1, "persistence should be invoked exactly once");
  assert.equal(runnerCalls[0], normalizedInputValue, "runner should receive the exact normalized input object identity");
  assert.equal(persistenceCalls[0].input, normalizedInputValue, "persistence should receive the exact normalized input object identity");

  const normalizedSnapshot = normalizedInputSnapshots.get(normalizedInputValue);
  assert.ok(normalizedSnapshot, "expected snapshot for normalized input");
  assert.deepEqual(normalizedInputValue, normalizedSnapshot, "normalized input must remain unmutated after runner and persistence");
  assert.equal(out, runnerReturnValue, "service should still return the validated runner object");
});

test("planSessionService never persists on any non-success response shape rejected by validation", async () => {
  resetState();

  normalizedInputValue = {
    user: { activity: "general_strength" },
    constraints: { available_equipment: ["barbell"] }
  };
  runnerReturnValue = {
    ok: false,
    session: {
      exercises: []
    },
    trace: {
      source: "runner-non-success-shape",
      metadata: { request_id: "req-non-success" }
    }
  };
  validationShouldEnforceContract = true;

  await assert.rejects(
    () => planSessionService({ non_success_response_shape_case: true }),
    /validation rejected invalid output/
  );

  assert.deepEqual(callLog, ["normalize", "run", "validate"]);
  assert.equal(runnerCalls.length, 1, "runner should still have been invoked once");
  assert.equal(validationCalls.length, 1, "invalid non-success shape should be validated once");
  assert.equal(persistenceCalls.length, 0, "non-success response shape must never persist");
  assert.equal(validatedOutputRefs.has(runnerReturnValue), false, "rejected non-success output must not be marked validated");
});

test("planSessionService persistence failure never alters call ordering or returned validated payload", async () => {
  resetState();

  normalizedInputValue = {
    user: { activity: "general_strength" },
    constraints: { available_equipment: ["barbell", "dumbbell"] }
  };
  runnerReturnValue = {
    ok: true,
    session: {
      exercises: [
        { exercise_id: "deadlift", source: "program" },
        { exercise_id: "row", source: "accessory" }
      ]
    },
    trace: {
      source: "runner-persistence-failure-order-stable",
      metadata: { request_id: "req-persist-fail-stable" }
    }
  };
  failPersistence = true;

  const out = await planSessionService({ persistence_failure_ordering_case: true });

  assert.deepEqual(callLog, ["normalize", "run", "validate", "persist"]);
  assert.equal(validationCalls.length, 1, "validated output should still be validated exactly once");
  assert.equal(persistenceCalls.length, 1, "persistence failure path should still attempt persistence exactly once");
  assert.equal(persistenceCalls[0].simulated_failure, true, "test should be exercising simulated persistence failure mode");
  assert.equal(persistenceCalls[0].output, runnerReturnValue, "persistence failure path should still receive the validated runner object");
  assert.equal(out, runnerReturnValue, "persistence failure must not replace the returned validated payload");

  const validationSnapshot = validationSnapshots.get(runnerReturnValue);
  assert.ok(validationSnapshot, "expected validation snapshot for persistence failure path");
  assert.deepEqual(out, validationSnapshot, "returned payload must remain identical to the validation-time snapshot");
  assert.deepEqual(runnerReturnValue, validationSnapshot, "validated runner object must remain unmutated despite persistence failure");
});

test("planSessionService persistence failure mode remains non-fatal and preserves the validated response contract", async () => {
  resetState();

  normalizedInputValue = {
    user: { activity: "general_strength" },
    constraints: { available_equipment: ["barbell", "dumbbell"] }
  };
  runnerReturnValue = {
    ok: true,
    session: {
      exercises: [
        { exercise_id: "deadlift", source: "program" }
      ]
    },
    trace: { source: "runner-persistence-failure-mode" }
  };
  failPersistence = true;

  const out = await planSessionService({ persistence_failure_mode: true });

  assert.deepEqual(callLog, ["normalize", "run", "validate", "persist"]);
  assert.equal(normalizationCalls.length, 1);
  assert.equal(runnerCalls.length, 1);
  assert.equal(validationCalls.length, 1);
  assert.equal(persistenceCalls.length, 1);

  assert.equal(persistenceCalls[0].simulated_failure, true);
  assert.deepEqual(persistenceCalls[0].input, normalizedInputValue);
  assert.deepEqual(persistenceCalls[0].output, runnerReturnValue);

  assert.deepEqual(out, runnerReturnValue);
  assert.equal(out.ok, true);
  assert.equal(out.trace.source, "runner-persistence-failure-mode");
});

test("planSessionService failure boundary: normalization failure blocks runner, validation, and persistence", async () => {
  resetState();

  normalizationError = Object.assign(new Error("normalization failed"), { status: 500 });

  await assert.rejects(
    () => planSessionService({ broken: true }),
    /normalization failed/
  );

  assert.deepEqual(callLog, ["normalize"]);
  assert.equal(runnerCalls.length, 0);
  assert.equal(validationCalls.length, 0);
  assert.equal(persistenceCalls.length, 0);
});

test("planSessionService failure boundary: runner failure fails fast and blocks validation plus persistence", async () => {
  resetState();

  normalizedInputValue = {
    user: { activity: "general_strength" },
    constraints: { available_equipment: ["barbell"] }
  };
  runnerError = Object.assign(new Error("runner exploded"), { status: 502 });

  await assert.rejects(
    () => planSessionService({ runner_failure_case: true }),
    /runner exploded/
  );

  assert.deepEqual(callLog, ["normalize", "run"]);
  assert.equal(normalizationCalls.length, 1);
  assert.equal(runnerCalls.length, 1);
  assert.equal(validationCalls.length, 0);
  assert.equal(persistenceCalls.length, 0);
});

test("planSessionService failure boundary: invalid runner output fails at validation and blocks persistence", async () => {
  resetState();

  normalizedInputValue = { user: { activity: "general_strength" } };
  runnerReturnValue = {
    ok: false,
    session: {
      exercises: []
    },
    trace: { source: "runner-invalid" }
  };
  validationShouldEnforceContract = true;

  await assert.rejects(
    () => planSessionService({ invalid_case: true }),
    /validation rejected invalid output/
  );

  assert.deepEqual(callLog, ["normalize", "run", "validate"]);
  assert.equal(runnerCalls.length, 1);
  assert.equal(validationCalls.length, 1);
  assert.equal(persistenceCalls.length, 0);
});

test("planSessionService failure boundary: explicit validation failure blocks persistence after runner", async () => {
  resetState();

  normalizedInputValue = { user: { activity: "general_strength" } };
  validationError = Object.assign(new Error("validation exploded"), { status: 502 });

  await assert.rejects(
    () => planSessionService({ explicit_validation_failure: true }),
    /validation exploded/
  );

  assert.deepEqual(callLog, ["normalize", "run", "validate"]);
  assert.equal(runnerCalls.length, 1);
  assert.equal(validationCalls.length, 1);
  assert.equal(persistenceCalls.length, 0);
});

test("planSessionService source contract: delegates request normalization to normalizePlanSessionRequest", async () => {
  const srcPath = path.join(repo, "src", "api", "plan_session_service.ts");
  const src = await fs.promises.readFile(srcPath, "utf8");

  assert.match(src, /import\s+\{\s*normalizePlanSessionRequest\s*\}\s+from\s+"\.\/plan_session_request_normalization_service\.js"/);
  assert.match(src, /const\s+effectiveInput\s*=\s*await\s+normalizePlanSessionRequest\(input\)/);
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

test("planSessionRequestNormalizationService source contract: explicit object input passes through unchanged", async () => {
  const srcPath = path.join(repo, "src", "api", "plan_session_request_normalization_service.ts");
  const src = await fs.promises.readFile(srcPath, "utf8");

  assert.match(src, /import\s+\{\s*loadPlanSessionDefaultInput\s*\}\s+from\s+"\.\/plan_session_default_input_service\.js"/);
  assert.match(
    src,
    /return\s+input\s+&&\s+typeof\s+input\s*===\s*"object"\s+&&\s+Object\.keys\(input\)\.length\s*>\s*0\s*\?\s*input\s*:\s*await\s+loadPlanSessionDefaultInput\(\)/s
  );
});

test("planSessionRequestNormalizationService source contract: empty input falls back to loadPlanSessionDefaultInput", async () => {
  const srcPath = path.join(repo, "src", "api", "plan_session_request_normalization_service.ts");
  const src = await fs.promises.readFile(srcPath, "utf8");

  assert.match(src, /await\s+loadPlanSessionDefaultInput\(\)/);
});