import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

function repoRoot() {
  const here = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(here), "..");
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function spawnProc(cmd, args, opts = {}) {
  const child = spawn(cmd, args, {
    stdio: ["ignore", "pipe", "pipe"],
    ...opts
  });

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (d) => {
    stdout += d.toString("utf8");
  });

  child.stderr.on("data", (d) => {
    stderr += d.toString("utf8");
  });

  return {
    child,
    get stdout() {
      return stdout;
    },
    get stderr() {
      return stderr;
    }
  };
}

function spawnNpm(args, opts = {}) {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  return spawnProc(npmCmd, args, opts);
}

async function ensureBuiltEngine(root, env) {
  const phase1ModulePath = path.join(root, "dist", "engine", "src", "phases", "phase1.js");
  const phase3ModulePath = path.join(root, "dist", "engine", "src", "phases", "phase3.js");
  const phase4ModulePath = path.join(root, "dist", "engine", "src", "phases", "phase4.js");

  if (!(await fileExists(phase1ModulePath)) || !(await fileExists(phase3ModulePath)) || !(await fileExists(phase4ModulePath))) {
    const build = spawnNpm(["run", "build:fast"], { cwd: root, env });
    const code = await new Promise((resolve) => build.child.on("close", resolve));

    if (code !== 0) {
      throw new Error(
        `build:fast failed (code=${code}).\nstdout:\n${build.stdout}\nstderr:\n${build.stderr}`
      );
    }
  }

  assert.equal(await fileExists(phase1ModulePath), true, `expected built phase1 module to exist: ${phase1ModulePath}`);
  assert.equal(await fileExists(phase3ModulePath), true, `expected built phase3 module to exist: ${phase3ModulePath}`);
  assert.equal(await fileExists(phase4ModulePath), true, `expected built phase4 module to exist: ${phase4ModulePath}`);

  return { phase1ModulePath, phase3ModulePath, phase4ModulePath };
}

function makeAcceptedPhase1InputVariantA() {
  return {
    phase1_schema_version: "1.0.0",
    engine_version: "EB2-1.0.0",
    enum_bundle_version: "EB2-1.0.0",
    consent_granted: true,
    activity_id: "powerlifting",
    actor_type: "athlete",
    execution_scope: "individual",
    nd_mode: false,
    instruction_density: "standard",
    exposure_prompt_density: "standard",
    bias_mode: "none",
    constraints: {
      constraints_version: "1.0.0",
      available_equipment: ["eq_barbell", "eq_bench", "eq_rack"],
      banned_equipment: ["eq_barbell"]
    }
  };
}

function makeAcceptedPhase1InputVariantB() {
  return {
    constraints: {
      banned_equipment: ["eq_barbell"],
      available_equipment: ["eq_rack", "eq_barbell", "eq_bench"],
      constraints_version: "1.0.0"
    },
    bias_mode: "none",
    exposure_prompt_density: "standard",
    instruction_density: "standard",
    nd_mode: false,
    execution_scope: "individual",
    actor_type: "athlete",
    activity_id: "powerlifting",
    consent_granted: true,
    enum_bundle_version: "EB2-1.0.0",
    engine_version: "EB2-1.0.0",
    phase1_schema_version: "1.0.0"
  };
}

function materialise(phase1Validate, phase3ResolveConstraintsAndLoadRegistries, phase4AssembleProgram, acceptedInput) {
  const p1 = phase1Validate(acceptedInput);
  assert.equal(p1.ok, true, `phase1 failed: ${JSON.stringify(p1)}`);

  const p3 = phase3ResolveConstraintsAndLoadRegistries(p1.canonical_input);
  assert.equal(p3.ok, true, `phase3 failed: ${JSON.stringify(p3)}`);

  const p4 = phase4AssembleProgram(p1.canonical_input, p3.phase3);
  assert.equal(p4.ok, true, `phase4 failed: ${JSON.stringify(p4)}`);

  return { p1, p3, p4 };
}

function stableProgramProjection(p4) {
  return {
    notes: p4.notes,
    program: p4.program
  };
}

function orderedExercisePoolKeys(program) {
  return Object.keys(program.exercise_pool ?? {});
}

test("S5 enumeration and selection determinism: repeated phase4 runs over the same accepted input materialise identical program output", async () => {
  const root = repoRoot();
  const env = { ...process.env };
  const { phase1ModulePath, phase3ModulePath, phase4ModulePath } = await ensureBuiltEngine(root, env);

  const phase1Module = await import(pathToFileURL(phase1ModulePath).href);
  const phase3Module = await import(pathToFileURL(phase3ModulePath).href);
  const phase4Module = await import(pathToFileURL(phase4ModulePath).href);

  const { phase1Validate } = phase1Module;
  const { phase3ResolveConstraintsAndLoadRegistries } = phase3Module;
  const { phase4AssembleProgram } = phase4Module;

  assert.equal(typeof phase1Validate, "function", "expected phase1Validate export");
  assert.equal(typeof phase3ResolveConstraintsAndLoadRegistries, "function", "expected phase3ResolveConstraintsAndLoadRegistries export");
  assert.equal(typeof phase4AssembleProgram, "function", "expected phase4AssembleProgram export");

  const acceptedInput = makeAcceptedPhase1InputVariantA();

  const runs = [];
  for (let i = 0; i < 10; i++) {
    runs.push(materialise(phase1Validate, phase3ResolveConstraintsAndLoadRegistries, phase4AssembleProgram, acceptedInput));
  }

  const first = stableProgramProjection(runs[0].p4);
  const firstJson = JSON.stringify(first);
  const firstProgram = first.program;

  assert.equal(Array.isArray(firstProgram.planned_items), true, "planned_items must be present");
  assert.equal(firstProgram.planned_items.length > 0, true, "planned_items must be non-empty for deterministic materialisation proof");
  assert.equal(Array.isArray(firstProgram.planned_exercise_ids), true, "planned_exercise_ids must be present");
  assert.equal(firstProgram.planned_exercise_ids.length > 0, true, "planned_exercise_ids must be non-empty for deterministic materialisation proof");
  assert.equal(typeof firstProgram.exercise_pool, "object", "exercise_pool must be present");
  assert.equal(typeof firstProgram.target_exercise_id, "string", "target_exercise_id must be present");
  assert.equal(firstProgram.target_exercise_id.length > 0, true, "target_exercise_id must be non-empty");

  const firstPoolKeys = orderedExercisePoolKeys(firstProgram);

  for (let i = 1; i < runs.length; i++) {
    const current = stableProgramProjection(runs[i].p4);

    assert.deepEqual(
      current,
      first,
      `phase4 materialisation drifted on repeat run index ${i}`
    );

    assert.equal(
      JSON.stringify(current),
      firstJson,
      `phase4 JSON serialisation drifted on repeat run index ${i}`
    );

    assert.deepEqual(
      orderedExercisePoolKeys(current.program),
      firstPoolKeys,
      `exercise_pool key ordering drifted on repeat run index ${i}`
    );

    assert.deepEqual(
      current.program.planned_items,
      firstProgram.planned_items,
      `planned_items drifted on repeat run index ${i}`
    );

    assert.deepEqual(
      current.program.planned_exercise_ids,
      firstProgram.planned_exercise_ids,
      `planned_exercise_ids drifted on repeat run index ${i}`
    );

    assert.equal(
      current.program.target_exercise_id,
      firstProgram.target_exercise_id,
      `target_exercise_id drifted on repeat run index ${i}`
    );
  }
});

test("S5 enumeration and selection determinism: semantically identical reordered accepted inputs materialise identical phase4 output", async () => {
  const root = repoRoot();
  const env = { ...process.env };
  const { phase1ModulePath, phase3ModulePath, phase4ModulePath } = await ensureBuiltEngine(root, env);

  const phase1Module = await import(pathToFileURL(phase1ModulePath).href);
  const phase3Module = await import(pathToFileURL(phase3ModulePath).href);
  const phase4Module = await import(pathToFileURL(phase4ModulePath).href);

  const { phase1Validate } = phase1Module;
  const { phase3ResolveConstraintsAndLoadRegistries } = phase3Module;
  const { phase4AssembleProgram } = phase4Module;

  const runA = materialise(phase1Validate, phase3ResolveConstraintsAndLoadRegistries, phase4AssembleProgram, makeAcceptedPhase1InputVariantA());
  const runB = materialise(phase1Validate, phase3ResolveConstraintsAndLoadRegistries, phase4AssembleProgram, makeAcceptedPhase1InputVariantB());

  assert.deepEqual(
    runA.p1.canonical_input,
    runB.p1.canonical_input,
    "phase1 canonical input must be identical for semantically identical reordered inputs"
  );

  assert.deepEqual(
    runA.p3.phase3,
    runB.p3.phase3,
    "phase3 output must be identical for semantically identical reordered inputs"
  );

  assert.deepEqual(
    stableProgramProjection(runA.p4),
    stableProgramProjection(runB.p4),
    "phase4 materialised output must be identical for semantically identical reordered inputs"
  );

  assert.deepEqual(
    orderedExercisePoolKeys(runA.p4.program),
    orderedExercisePoolKeys(runB.p4.program),
    "exercise_pool key ordering must remain stable for semantically identical reordered inputs"
  );
});