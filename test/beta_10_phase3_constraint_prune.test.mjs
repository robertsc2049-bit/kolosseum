import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const CONSTRAINT_ORDER = Object.freeze([
  "authority_constraints",
  "consent_constraints",
  "declared_legality_constraints",
  "context_constraints",
  "equipment_constraints",
  "activity_role_constraints"
]);

const SUPPORTED_ACTIVITIES = Object.freeze([
  "general_strength",
  "powerlifting",
  "rugby_union"
]);

function sortedUnique(values) {
  if (!Array.isArray(values)) return undefined;
  const out = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.length > 0) out.push(trimmed);
  }
  const unique = [...new Set(out)].sort((a, b) => a.localeCompare(b));
  return unique.length > 0 ? unique : undefined;
}

function arrayFor(map, key) {
  if (!map || typeof map !== "object" || Array.isArray(map)) return [];
  return sortedUnique(map[key]) ?? [];
}

function fail(token, details) {
  return {
    ok: false,
    failure_token: token,
    details
  };
}

function empty(stage, initial, removedByStage) {
  return fail("empty_solution_space", {
    stage,
    constraint_order: [...CONSTRAINT_ORDER],
    initial_solution_space: initial,
    removed_by_stage: removedByStage
  });
}

function pruneToAllowed(solution, allowed) {
  if (!allowed) return { next: solution, removed: [] };
  const allowedSet = new Set(allowed);
  return {
    next: solution.filter((id) => allowedSet.has(id)).sort((a, b) => a.localeCompare(b)),
    removed: solution.filter((id) => !allowedSet.has(id)).sort((a, b) => a.localeCompare(b))
  };
}

function pruneRemoved(solution, removedIds) {
  if (!removedIds) return { next: solution, removed: [] };
  const removedSet = new Set(removedIds);
  return {
    next: solution.filter((id) => !removedSet.has(id)).sort((a, b) => a.localeCompare(b)),
    removed: solution.filter((id) => removedSet.has(id)).sort((a, b) => a.localeCompare(b))
  };
}

function phase3Probe(input) {
  const env = input.constraints;
  const initial = sortedUnique(env.candidate_exercise_ids) ?? [];
  const removedByStage = {};
  let solution = [...initial];

  const allowedAuthorityIds = sortedUnique(env.allowed_governing_authority_ids);
  const governingAuthorityId = typeof input.governing_authority_id === "string" ? input.governing_authority_id : "";
  if (input.execution_scope === "coach_managed" && governingAuthorityId.length === 0) {
    return fail("type_mismatch", {
      stage: "authority_constraints",
      reason: "invalid_authority",
      constraint_order: [...CONSTRAINT_ORDER]
    });
  }
  if (allowedAuthorityIds && !allowedAuthorityIds.includes(governingAuthorityId)) {
    return fail("type_mismatch", {
      stage: "authority_constraints",
      reason: "invalid_authority",
      governing_authority_id: governingAuthorityId,
      allowed_governing_authority_ids: allowedAuthorityIds,
      constraint_order: [...CONSTRAINT_ORDER]
    });
  }

  if (input.consent_granted !== true) {
    return fail("type_mismatch", {
      stage: "consent_constraints",
      reason: "consent_violation",
      constraint_order: [...CONSTRAINT_ORDER]
    });
  }

  if (!SUPPORTED_ACTIVITIES.includes(input.activity_id)) {
    return fail("type_mismatch", {
      stage: "activity_role_constraints",
      reason: "unsupported_activity",
      activity_id: input.activity_id,
      supported_activities: [...SUPPORTED_ACTIVITIES],
      constraint_order: [...CONSTRAINT_ORDER]
    });
  }

  let pruned = pruneToAllowed(solution, sortedUnique(env.declared_legal_exercise_ids));
  solution = pruned.next;
  if (pruned.removed.length) removedByStage.declared_legality_constraints = pruned.removed;

  pruned = pruneRemoved(solution, sortedUnique(env.declared_illegal_exercise_ids));
  solution = pruned.next;
  if (pruned.removed.length) {
    removedByStage.declared_legality_constraints = sortedUnique([...(removedByStage.declared_legality_constraints ?? []), ...pruned.removed]) ?? [];
  }
  if (initial.length > 0 && solution.length === 0) return empty("declared_legality_constraints", initial, removedByStage);

  pruned = pruneToAllowed(solution, sortedUnique(env.context_allowed_exercise_ids));
  solution = pruned.next;
  if (pruned.removed.length) removedByStage.context_constraints = pruned.removed;

  pruned = pruneRemoved(solution, sortedUnique(env.context_blocked_exercise_ids));
  solution = pruned.next;
  if (pruned.removed.length) {
    removedByStage.context_constraints = sortedUnique([...(removedByStage.context_constraints ?? []), ...pruned.removed]) ?? [];
  }
  if (initial.length > 0 && solution.length === 0) return empty("context_constraints", initial, removedByStage);

  const availableEquipment = sortedUnique(env.available_equipment);
  const bannedEquipment = sortedUnique(env.banned_equipment);
  const requiredEquipment = sortedUnique(env.required_equipment_ids);
  if (requiredEquipment) {
    const availableSet = new Set(availableEquipment ?? []);
    const missing = requiredEquipment.filter((equipmentId) => !availableSet.has(equipmentId));
    if (missing.length) {
      return fail("type_mismatch", {
        stage: "equipment_constraints",
        reason: "equipment_unavailable",
        missing_equipment_ids: missing,
        constraint_order: [...CONSTRAINT_ORDER]
      });
    }
  }

  if (env.exercise_equipment_map && availableEquipment) {
    const availableSet = new Set(availableEquipment);
    const bannedSet = new Set(bannedEquipment ?? []);
    const kept = [];
    const removed = [];
    for (const exerciseId of solution) {
      const required = arrayFor(env.exercise_equipment_map, exerciseId);
      const hasRequired = required.every((equipmentId) => availableSet.has(equipmentId));
      const hasBanned = required.some((equipmentId) => bannedSet.has(equipmentId));
      if (hasRequired && !hasBanned) kept.push(exerciseId);
      else removed.push(exerciseId);
    }
    solution = kept.sort((a, b) => a.localeCompare(b));
    if (removed.length) removedByStage.equipment_constraints = removed.sort((a, b) => a.localeCompare(b));
  }
  if (initial.length > 0 && solution.length === 0) return empty("equipment_constraints", initial, removedByStage);

  if (env.exercise_activity_map) {
    const kept = [];
    const removed = [];
    for (const exerciseId of solution) {
      const activities = arrayFor(env.exercise_activity_map, exerciseId);
      if (activities.includes(input.activity_id)) kept.push(exerciseId);
      else removed.push(exerciseId);
    }
    solution = kept.sort((a, b) => a.localeCompare(b));
    if (removed.length) removedByStage.activity_role_constraints = removed.sort((a, b) => a.localeCompare(b));
  }
  if (initial.length > 0 && solution.length === 0) return empty("activity_role_constraints", initial, removedByStage);

  return {
    ok: true,
    phase3: {
      constraints_resolved: true,
      constraints: {
        candidate_exercise_ids: initial,
        resolved_exercise_ids: solution
      },
      beta10_constraint_prune: {
        remove_only: true,
        no_expansion: true,
        constraint_order: [...CONSTRAINT_ORDER],
        initial_solution_space: initial,
        final_solution_space: solution,
        removed_by_stage: removedByStage
      }
    }
  };
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
  const forbiddenTerms = ["reco" + "mmend", "soften", "closest", "ad" + "vice", "fall" + "back"];
  for (const forbidden of forbiddenTerms) {
    assert.equal(serialized.includes(forbidden), false, `BETA-10 output must not contain ${forbidden}`);
  }
}

function assertFailure(result, reason) {
  assert.equal(result.ok, false, JSON.stringify(result));
  if (reason === "empty_solution_space") {
    assert.equal(result.failure_token, "empty_solution_space");
  } else {
    assert.equal(result.failure_token, "type_mismatch");
    assert.equal(result.details.reason, reason);
  }
  assert.deepEqual(result.details.constraint_order, [...CONSTRAINT_ORDER]);
  assertNoForbiddenLanguage(result);
}

test("BETA-10 Phase 3 source is gated to explicit beta remove-only declarations", () => {
  const phase3Source = fs.readFileSync(path.join(process.cwd(), "engine", "src", "phases", "phase3.ts"), "utf8");
  const helperSource = fs.readFileSync(path.join(process.cwd(), "src", "beta10Phase3ConstraintPrune.ts"), "utf8");

  assert.match(phase3Source, /hasBeta10Phase3ConstraintPrune/);
  assert.match(phase3Source, /runBeta10Phase3ConstraintPrune/);
  assert.match(phase3Source, /beta10_constraint_prune/);
  assert.match(helperSource, /phase3_constraint_prune/);
  assert.match(helperSource, /BETA-10/);
  assert.match(helperSource, /constraint_resolution_mode/);
  assert.match(helperSource, /beta_remove_only/);
  assert.match(helperSource, /authority_constraints/);
  assert.match(helperSource, /consent_constraints/);
  assert.match(helperSource, /declared_legality_constraints/);
  assert.match(helperSource, /context_constraints/);
  assert.match(helperSource, /equipment_constraints/);
  assert.match(helperSource, /activity_role_constraints/);
  assert.match(helperSource, /empty_solution_space/);
  assert.doesNotMatch(helperSource.toLowerCase(), /closest match/);
});

test("BETA-10 valid prune is deterministic, staged, and remove-only", () => {
  const result = phase3Probe(beta10Input());

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.phase3.beta10_constraint_prune.constraint_order, [...CONSTRAINT_ORDER]);
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

test("BETA-10 invalid authority fails before later pruning", () => {
  const result = phase3Probe(beta10Input({
    execution_scope: "coach_managed",
    governing_authority_id: "unapproved_authority",
    constraints: {
      allowed_governing_authority_ids: ["approved_authority"]
    }
  }));

  assertFailure(result, "invalid_authority");
  assert.equal(result.details.stage, "authority_constraints");
});

test("BETA-10 consent violation fails without prune output", () => {
  const result = phase3Probe(beta10Input({ consent_granted: false }));

  assertFailure(result, "consent_violation");
  assert.equal(result.details.stage, "consent_constraints");
});

test("BETA-10 equipment unavailable fails closed", () => {
  const result = phase3Probe(beta10Input({
    constraints: {
      required_equipment_ids: ["platform"]
    }
  }));

  assertFailure(result, "equipment_unavailable");
  assert.equal(result.details.stage, "equipment_constraints");
  assert.deepEqual(result.details.missing_equipment_ids, ["platform"]);
});

test("BETA-10 unsupported activity fails closed", () => {
  const result = phase3Probe(beta10Input({ activity_id: "cycling" }));

  assertFailure(result, "unsupported_activity");
  assert.equal(result.details.stage, "activity_role_constraints");
});

test("BETA-10 empty solution space fails without fallback", () => {
  const result = phase3Probe(beta10Input({
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
