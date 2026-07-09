// DEV NOTE: BETA-10 helper for explicit beta Phase 3 remove-only pruning. This file is called by Phase 3 only when the beta marker is present; it does not run discovery, substitutions, advisory interpretation, or programme assembly.

export type Beta10Phase3PruneSuccess = {
  ok: true;
  constraints: Record<string, unknown>;
  prune: Record<string, unknown>;
};

export type Beta10Phase3PruneFailure = {
  ok: false;
  failure_token: string;
  details: Record<string, unknown>;
};

export type Beta10Phase3PruneResult = Beta10Phase3PruneSuccess | Beta10Phase3PruneFailure;

const constraintOrder = Object.freeze([
  "authority_constraints",
  "consent_constraints",
  "declared_legality_constraints",
  "context_constraints",
  "equipment_constraints",
  "activity_role_constraints"
]);

const supportedActivities = Object.freeze([
  "general_strength",
  "powerlifting",
  "rugby_union"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (trimmed.length > 0) out.push(trimmed);
  }
  const unique = Array.from(new Set(out)).sort((a, b) => a.localeCompare(b));
  return unique.length > 0 ? unique : undefined;
}

function arrayFromMap(map: unknown, key: string): string[] {
  if (!isRecord(map)) return [];
  return stringArray(map[key]) ?? [];
}

function fail(failure_token: string, details: Record<string, unknown>): Beta10Phase3PruneFailure {
  return {
    ok: false,
    failure_token,
    details: {
      ...details,
      constraint_order: [...constraintOrder]
    }
  };
}

function empty(stage: string, initial: string[], removedByStage: Record<string, string[]>): Beta10Phase3PruneFailure {
  return fail("empty_solution_space", {
    stage,
    initial_solution_space: initial,
    removed_by_stage: removedByStage
  });
}

function keepOnly(solution: string[], allowed: string[] | undefined): { next: string[]; removed: string[] } {
  if (!allowed) return { next: solution, removed: [] };
  const allowedSet = new Set(allowed);
  return {
    next: solution.filter((id) => allowedSet.has(id)).sort((a, b) => a.localeCompare(b)),
    removed: solution.filter((id) => !allowedSet.has(id)).sort((a, b) => a.localeCompare(b))
  };
}

function removeIds(solution: string[], blocked: string[] | undefined): { next: string[]; removed: string[] } {
  if (!blocked) return { next: solution, removed: [] };
  const blockedSet = new Set(blocked);
  return {
    next: solution.filter((id) => !blockedSet.has(id)).sort((a, b) => a.localeCompare(b)),
    removed: solution.filter((id) => blockedSet.has(id)).sort((a, b) => a.localeCompare(b))
  };
}

function mergeRemoved(existing: string[] | undefined, added: string[]): string[] {
  return Array.from(new Set([...(existing ?? []), ...added])).sort((a, b) => a.localeCompare(b));
}

export function hasBeta10Phase3ConstraintPrune(canonicalInput: unknown, env: unknown): boolean {
  if (!isRecord(env)) return false;
  const input = isRecord(canonicalInput) ? canonicalInput : {};
  return input.phase3_constraint_prune === "BETA-10" ||
    env.phase3_constraint_prune === "BETA-10" ||
    env.constraint_resolution_mode === "beta_remove_only";
}

export function runBeta10Phase3ConstraintPrune(canonicalInput: unknown, env: Record<string, unknown>): Beta10Phase3PruneResult {
  const input = isRecord(canonicalInput) ? canonicalInput : {};
  const activityId = typeof input.activity_id === "string" ? input.activity_id : "";
  const executionScope = typeof input.execution_scope === "string" ? input.execution_scope : "";
  const governingAuthorityId = typeof input.governing_authority_id === "string" ? input.governing_authority_id : "";

  const initial = stringArray(env.candidate_exercise_ids) ?? [];
  const removedByStage: Record<string, string[]> = {};
  let solution = [...initial];

  const allowedAuthorityIds = stringArray(env.allowed_governing_authority_ids);
  if (executionScope === "coach_managed" && governingAuthorityId.length === 0) {
    return fail("type_mismatch", {
      stage: "authority_constraints",
      reason: "invalid_authority"
    });
  }
  if (allowedAuthorityIds && !allowedAuthorityIds.includes(governingAuthorityId)) {
    return fail("type_mismatch", {
      stage: "authority_constraints",
      reason: "invalid_authority",
      governing_authority_id: governingAuthorityId,
      allowed_governing_authority_ids: allowedAuthorityIds
    });
  }

  if (input.consent_granted !== true) {
    return fail("type_mismatch", {
      stage: "consent_constraints",
      reason: "consent_violation"
    });
  }

  if (!supportedActivities.includes(activityId as any)) {
    return fail("type_mismatch", {
      stage: "activity_role_constraints",
      reason: "unsupported_activity",
      activity_id: activityId,
      supported_activities: [...supportedActivities]
    });
  }

  let pruned = keepOnly(solution, stringArray(env.declared_legal_exercise_ids));
  solution = pruned.next;
  if (pruned.removed.length) removedByStage.declared_legality_constraints = pruned.removed;

  pruned = removeIds(solution, stringArray(env.declared_illegal_exercise_ids));
  solution = pruned.next;
  if (pruned.removed.length) {
    removedByStage.declared_legality_constraints = mergeRemoved(removedByStage.declared_legality_constraints, pruned.removed);
  }
  if (initial.length > 0 && solution.length === 0) return empty("declared_legality_constraints", initial, removedByStage);

  pruned = keepOnly(solution, stringArray(env.context_allowed_exercise_ids));
  solution = pruned.next;
  if (pruned.removed.length) removedByStage.context_constraints = pruned.removed;

  pruned = removeIds(solution, stringArray(env.context_blocked_exercise_ids));
  solution = pruned.next;
  if (pruned.removed.length) {
    removedByStage.context_constraints = mergeRemoved(removedByStage.context_constraints, pruned.removed);
  }
  if (initial.length > 0 && solution.length === 0) return empty("context_constraints", initial, removedByStage);

  const availableEquipment = stringArray(env.available_equipment);
  const bannedEquipment = stringArray(env.banned_equipment);
  const requiredEquipment = stringArray(env.required_equipment_ids);
  if (requiredEquipment) {
    const availableSet = new Set(availableEquipment ?? []);
    const missing = requiredEquipment.filter((id) => !availableSet.has(id));
    if (missing.length) {
      return fail("type_mismatch", {
        stage: "equipment_constraints",
        reason: "equipment_unavailable",
        missing_equipment_ids: missing
      });
    }
  }

  if (isRecord(env.exercise_equipment_map) && availableEquipment) {
    const availableSet = new Set(availableEquipment);
    const bannedSet = new Set(bannedEquipment ?? []);
    const kept: string[] = [];
    const removed: string[] = [];
    for (const exerciseId of solution) {
      const required = arrayFromMap(env.exercise_equipment_map, exerciseId);
      const hasRequired = required.every((id) => availableSet.has(id));
      const hasBanned = required.some((id) => bannedSet.has(id));
      if (hasRequired && !hasBanned) kept.push(exerciseId);
      else removed.push(exerciseId);
    }
    solution = kept.sort((a, b) => a.localeCompare(b));
    if (removed.length) removedByStage.equipment_constraints = removed.sort((a, b) => a.localeCompare(b));
  }
  if (initial.length > 0 && solution.length === 0) return empty("equipment_constraints", initial, removedByStage);

  if (isRecord(env.exercise_activity_map)) {
    const kept: string[] = [];
    const removed: string[] = [];
    for (const exerciseId of solution) {
      const activities = arrayFromMap(env.exercise_activity_map, exerciseId);
      if (activities.includes(activityId)) kept.push(exerciseId);
      else removed.push(exerciseId);
    }
    solution = kept.sort((a, b) => a.localeCompare(b));
    if (removed.length) removedByStage.activity_role_constraints = removed.sort((a, b) => a.localeCompare(b));
  }

  const sportRoleId = typeof input.sport_role_id === "string" ? input.sport_role_id : "";
  if (sportRoleId && isRecord(env.exercise_role_map)) {
    const kept: string[] = [];
    const removed: string[] = [];
    for (const exerciseId of solution) {
      const roles = arrayFromMap(env.exercise_role_map, exerciseId);
      if (roles.length === 0 || roles.includes(sportRoleId)) kept.push(exerciseId);
      else removed.push(exerciseId);
    }
    solution = kept.sort((a, b) => a.localeCompare(b));
    if (removed.length) removedByStage.activity_role_constraints = mergeRemoved(removedByStage.activity_role_constraints, removed);
  }
  if (initial.length > 0 && solution.length === 0) return empty("activity_role_constraints", initial, removedByStage);

  const constraints: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(env)) {
    if (key === "constraints_version") continue;
    if (key === "phase3_constraint_prune") continue;
    if (key === "constraint_resolution_mode") continue;
    constraints[key] = value;
  }

  constraints.candidate_exercise_ids = initial;
  constraints.resolved_exercise_ids = solution;
  if (availableEquipment) constraints.available_equipment = availableEquipment;
  if (bannedEquipment) constraints.banned_equipment = bannedEquipment;

  return {
    ok: true,
    constraints,
    prune: {
      remove_only: true,
      no_expansion: true,
      constraint_order: [...constraintOrder],
      initial_solution_space: initial,
      final_solution_space: solution,
      removed_by_stage: removedByStage
    }
  };
}
