import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import * as ts from "typescript";

let phase3Promise = null;

async function loadPhase3Fresh() {
  const sourcePath = path.join(process.cwd(), "engine", "src", "phases", "phase3.ts");
  const source = await fs.readFile(sourcePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    }
  });
  const href = `data:text/javascript;base64,${Buffer.from(transpiled.outputText, "utf8").toString("base64")}`;
  const phase3Module = await import(href);
  assert.equal(typeof phase3Module.phase3ResolveConstraintsAndLoadRegistries, "function");
  return phase3Module.phase3ResolveConstraintsAndLoadRegistries;
}

async function loadPhase3() {
  phase3Promise ??= loadPhase3Fresh();
  return phase3Promise;
}

function beta10Input(overrides = {}) {
  const { constraints: constraintOverrides = {}, ...topLevelOverrides } = overrides;

  return {
    consent_granted: true,
    execution_scope: "individual",
    activity_id: "powerlifting",
    sport_role_id: "powerlifter",
    ...topLevelOverrides,
    constraints: {
      constraints_version: "1.0.0",
      phase3_constraint_prune: "BETA-10",
      candidate_exercise_ids: ["comp_squat", "bench_press", "tempo_row"],
      declared_legal_exercise_ids: ["comp_squat", "bench_press", "tempo_row"],
      context_allowed_exercise_ids: ["comp_squat", "bench_press"],
      available_equipment: ["barbell", "rack", "bench"],
      banned_equipment: [],
      exercise_equipment_map: {
        comp_squat: ["barbell", "rack"],
        bench_press: ["barbell", "bench"],
        tempo_row: ["cable"]
      },
      exercise_activity_map: {
        comp_squat: ["powerlifting"],
        bench_press: ["powerlifting"],
        tempo_row: ["general_strength"]
      },
      exercise_role_map: {
        comp_squat: ["powerlifter"],
        bench_press: ["powerlifter"],
        tempo_row: ["general"]
      },
      ...constraintOverrides
    }
  };
}

function assertNoForbiddenLanguage(result) {
  const serialized = JSON.stringify(result).toLowerCase();
  for (const forbidden of ["recommend", "soften", "closest", "advice", "fallback"]) {
    assert.equal(serialized.includes(forbidden), false, `BETA-10 output must not contain ${forbidden}`);
  }
}

function assertFailure(result, token) {
  assert.equal(result.ok, false, JSON.stringify(result));
  assert.equal(result.failure_token, token);
  assert.deepEqual(result.details.constraint_order, [
    "authority_constraints",
    "consent_constraints",
    "declared_legality_constraints",
    "context_constraints",
    "equipment_constraints",
    "activity_role_constraints"
  ]);
  assertNoForbiddenLanguage(result);
}

test("BETA-10 valid prune is deterministic, staged, and remove-only", async () => {
  const phase3 = await loadPhase3();
  const result = phase3(beta10Input());

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.phase3.beta10_constraint_prune.constraint_order, [
    "authority_constraints",
    "consent_constraints",
    "declared_legality_constraints",
    "context_constraints",
    "equipment_constraints",
    "activity_role_constraints"
  ]);
  assert.equal(result.phase3.beta10_constraint_prune.remove_only, true);
  assert.equal(result.phase3.beta10_constraint_prune.no_expansion, true);
  assert.deepEqual(result.phase3.beta10_constraint_prune.initial_solution_space, [
    "bench_press",
    "comp_squat",
    "tempo_row"
  ]);
  assert.deepEqual(result.phase3.beta10_constraint_prune.final_solution_space, [
    "bench_press",
    "comp_squat"
  ]);
  assert.deepEqual(result.phase3.constraints.resolved_exercise_ids, ["bench_press", "comp_squat"]);

  const initial = new Set(result.phase3.beta10_constraint_prune.initial_solution_space);
  for (const exerciseId of result.phase3.beta10_constraint_prune.final_solution_space) {
    assert.equal(initial.has(exerciseId), true, `${exerciseId} must come from the initial solution space`);
  }
  assertNoForbiddenLanguage(result);
});

test("BETA-10 invalid authority fails before later pruning", async () => {
  const phase3 = await loadPhase3();
  const result = phase3(beta10Input({
    execution_scope: "coach_managed",
    governing_authority_id: "unapproved_authority",
    constraints: {
      allowed_governing_authority_ids: ["approved_authority"]
    }
  }));

  assertFailure(result, "invalid_authority");
  assert.equal(result.details.stage, "authority_constraints");
});

test("BETA-10 consent violation fails without prune output", async () => {
  const phase3 = await loadPhase3();
  const result = phase3(beta10Input({ consent_granted: false }));

  assertFailure(result, "consent_violation");
  assert.equal(result.details.stage, "consent_constraints");
});

test("BETA-10 equipment unavailable fails closed", async () => {
  const phase3 = await loadPhase3();
  const result = phase3(beta10Input({
    constraints: {
      required_equipment_ids: ["platform"]
    }
  }));

  assertFailure(result, "equipment_unavailable");
  assert.equal(result.details.stage, "equipment_constraints");
  assert.deepEqual(result.details.missing_equipment_ids, ["platform"]);
});

test("BETA-10 unsupported activity fails closed", async () => {
  const phase3 = await loadPhase3();
  const result = phase3(beta10Input({ activity_id: "cycling" }));

  assertFailure(result, "unsupported_activity");
  assert.equal(result.details.stage, "activity_role_constraints");
});

test("BETA-10 empty solution space fails without fallback", async () => {
  const phase3 = await loadPhase3();
  const result = phase3(beta10Input({
    constraints: {
      context_allowed_exercise_ids: ["non_matching_exercise"]
    }
  }));

  assertFailure(result, "empty_solution_space");
  assert.equal(result.details.stage, "context_constraints");
  assert.deepEqual(result.details.initial_solution_space, ["bench_press", "comp_squat", "tempo_row"]);
  assert.deepEqual(result.details.removed_by_stage.context_constraints, [
    "bench_press",
    "comp_squat",
    "tempo_row"
  ]);
});
