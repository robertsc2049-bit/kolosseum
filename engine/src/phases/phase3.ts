// DEV NOTE: Engine-side implementation surface. Keep this code deterministic, closed-world, and
// free of product/UI/coach-note influence. Engine truth must come from explicit inputs,
// canonical registries, and validated contracts only.

import fs from "node:fs";
import path from "node:path";

export type Phase3Constraints = Record<string, any>;

export type Phase3ResolutionSummary = {
  rules_applied: string[];
  removed_from_available_equipment?: string[];
};

export type Phase3Output = {
  constraints_resolved: boolean;
  notes: string[];
  registry_index_version: string;
  loaded_registries: string[];
  constraints: Phase3Constraints;

  // High-signal, stable debug for golden fixtures (no circular refs)
  constraints_resolution?: Phase3ResolutionSummary;
  beta10_constraint_prune?: Record<string, any>;
};

export type Phase3Result =
  | { ok: true; phase3: Phase3Output; notes: string[] }
  | { ok: false; failure_token: string; details?: unknown };

type Beta10PruneSuccess = {
  ok: true;
  constraints: Record<string, any>;
  prune: Record<string, any>;
};

type Beta10PruneFailure = {
  ok: false;
  failure_token: string;
  details?: unknown;
};

type Beta10PruneResult = Beta10PruneSuccess | Beta10PruneFailure;

const BETA10_CONSTRAINT_ORDER = Object.freeze([
  "authority_constraints",
  "consent_constraints",
  "declared_legality_constraints",
  "context_constraints",
  "equipment_constraints",
  "activity_role_constraints"
]);

const BETA10_SUPPORTED_ACTIVITIES = Object.freeze([
  "general_strength",
  "powerlifting",
  "rugby_union"
]);

function stripBom(s: string): string {
  return s.charAt(0) === "\uFEFF" ? s.slice(1) : s;
}

function readJson(p: string): any {
  return JSON.parse(stripBom(fs.readFileSync(p, "utf8")));
}

function repoRoot(): string {
  return process.cwd();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function asId(x: unknown): string {
  if (typeof x === "string") return x;
  if (!x || typeof x !== "object") return "";
  const o = x as any;
  return String(o.id ?? o.registry_id ?? o.name ?? o.key ?? "");
}

/**
 * Extract registry ids from registry_index.json across multiple plausible schemas.
 * Goal: return an ordered list of registry ids (strings).
 */
function extractRegistryIds(idx: unknown): string[] {
  if (!idx) return [];

  if (Array.isArray(idx)) {
    return idx
      .map(asId)
      .map((s: string) => String(s).trim())
      .filter(Boolean);
  }

  if (!isRecord(idx)) return [];

  const anyIdx: any = idx;

  const rawArray =
    (Array.isArray(anyIdx.index) && anyIdx.index) ||
    (Array.isArray(anyIdx.registries) && anyIdx.registries) ||
    (Array.isArray(anyIdx.items) && anyIdx.items) ||
    (Array.isArray(anyIdx.entries) && anyIdx.entries) ||
    (Array.isArray(anyIdx.order) && anyIdx.order) ||
    null;

  if (rawArray) {
    return rawArray
      .map(asId)
      .map((s: string) => String(s).trim())
      .filter(Boolean);
  }

  if (isRecord(anyIdx.index) && Array.isArray((anyIdx.index as any).entries)) {
    return (anyIdx.index as any).entries
      .map(asId)
      .map((s: string) => String(s).trim())
      .filter(Boolean);
  }
  if (isRecord(anyIdx.registries) && Array.isArray((anyIdx.registries as any).entries)) {
    return (anyIdx.registries as any).entries
      .map(asId)
      .map((s: string) => String(s).trim())
      .filter(Boolean);
  }
  if (isRecord(anyIdx.items) && Array.isArray((anyIdx.items as any).entries)) {
    return (anyIdx.items as any).entries
      .map(asId)
      .map((s: string) => String(s).trim())
      .filter(Boolean);
  }

  const mapCandidate =
    (isRecord(anyIdx.registries) && anyIdx.registries) ||
    (isRecord(anyIdx.index) && anyIdx.index) ||
    (isRecord(anyIdx.entries) && anyIdx.entries) ||
    null;

  if (mapCandidate) {
    return Object.keys(mapCandidate)
      .map((s: string) => String(s).trim())
      .filter(Boolean);
  }

  return [];
}

function pickStringArray(xs: unknown): string[] | undefined {
  if (!Array.isArray(xs)) return undefined;
  const out: string[] = [];
  for (const v of xs) {
    if (typeof v !== "string") continue;
    const s = v.trim();
    if (s.length > 0) out.push(s);
  }
  const uniq = Array.from(new Set(out));
  return uniq.length > 0 ? uniq : undefined;
}

function sortedUnique(xs: string[] | undefined): string[] | undefined {
  if (!xs || xs.length === 0) return undefined;
  const uniq = Array.from(new Set(xs));
  uniq.sort((a, b) => a.localeCompare(b));
  return uniq.length ? uniq : undefined;
}

function hasBeta10Prune(canonicalInput: any, env: any): boolean {
  return canonicalInput?.phase3_constraint_prune === "BETA-10" ||
    env?.phase3_constraint_prune === "BETA-10" ||
    env?.constraint_resolution_mode === "beta_remove_only";
}

function failPhase3(failure_token: string, details: Record<string, any>): Beta10PruneFailure {
  return {
    ok: false,
    failure_token,
    details
  };
}

function beta10Empty(stage: string, initial: string[], removedByStage: Record<string, string[]>): Beta10PruneFailure {
  return failPhase3("empty_solution_space", {
    stage,
    constraint_order: [...BETA10_CONSTRAINT_ORDER],
    initial_solution_space: initial,
    removed_by_stage: removedByStage
  });
}

function stringArrayFromRecordMap(map: any, key: string): string[] {
  if (!isRecord(map)) return [];
  return sortedUnique(pickStringArray((map as any)[key])) ?? [];
}

function pruneToAllowed(solution: string[], allowed: string[] | undefined): { next: string[]; removed: string[] } {
  if (!allowed) return { next: solution, removed: [] };
  const allowedSet = new Set(allowed);
  const next = solution.filter((id) => allowedSet.has(id));
  const removed = solution.filter((id) => !allowedSet.has(id));
  return {
    next: sortedUnique(next) ?? [],
    removed: sortedUnique(removed) ?? []
  };
}

function pruneRemoved(solution: string[], removedIds: string[] | undefined): { next: string[]; removed: string[] } {
  if (!removedIds) return { next: solution, removed: [] };
  const removedSet = new Set(removedIds);
  const next = solution.filter((id) => !removedSet.has(id));
  const removed = solution.filter((id) => removedSet.has(id));
  return {
    next: sortedUnique(next) ?? [],
    removed: sortedUnique(removed) ?? []
  };
}

function beta10Prune(canonicalInput: any, env: Record<string, any>): Beta10PruneResult {
  const initial = sortedUnique(pickStringArray(env.candidate_exercise_ids)) ?? [];
  const removedByStage: Record<string, string[]> = {};
  let solution = [...initial];

  const activityId = typeof canonicalInput?.activity_id === "string" ? canonicalInput.activity_id : "";
  const executionScope = typeof canonicalInput?.execution_scope === "string" ? canonicalInput.execution_scope : "";
  const governingAuthorityId = typeof canonicalInput?.governing_authority_id === "string" ? canonicalInput.governing_authority_id : "";

  const allowedAuthorityIds = sortedUnique(pickStringArray(env.allowed_governing_authority_ids));
  if (executionScope === "coach_managed" && governingAuthorityId.length === 0) {
    return failPhase3("invalid_authority", {
      stage: "authority_constraints",
      constraint_order: [...BETA10_CONSTRAINT_ORDER]
    });
  }
  if (allowedAuthorityIds && !allowedAuthorityIds.includes(governingAuthorityId)) {
    return failPhase3("invalid_authority", {
      stage: "authority_constraints",
      governing_authority_id: governingAuthorityId,
      allowed_governing_authority_ids: allowedAuthorityIds,
      constraint_order: [...BETA10_CONSTRAINT_ORDER]
    });
  }

  if (canonicalInput?.consent_granted !== true) {
    return failPhase3("consent_violation", {
      stage: "consent_constraints",
      constraint_order: [...BETA10_CONSTRAINT_ORDER]
    });
  }

  if (!BETA10_SUPPORTED_ACTIVITIES.includes(activityId as any)) {
    return failPhase3("unsupported_activity", {
      stage: "activity_role_constraints",
      activity_id: activityId,
      supported_activities: [...BETA10_SUPPORTED_ACTIVITIES],
      constraint_order: [...BETA10_CONSTRAINT_ORDER]
    });
  }

  const declaredLegal = sortedUnique(pickStringArray(env.declared_legal_exercise_ids));
  const declaredIllegal = sortedUnique(pickStringArray(env.declared_illegal_exercise_ids));
  let pruned = pruneToAllowed(solution, declaredLegal);
  solution = pruned.next;
  if (pruned.removed.length) removedByStage.declared_legality_constraints = pruned.removed;
  pruned = pruneRemoved(solution, declaredIllegal);
  solution = pruned.next;
  if (pruned.removed.length) {
    removedByStage.declared_legality_constraints = sortedUnique([...(removedByStage.declared_legality_constraints ?? []), ...pruned.removed]) ?? [];
  }
  if (initial.length > 0 && solution.length === 0) {
    return beta10Empty("declared_legality_constraints", initial, removedByStage);
  }

  const contextAllowed = sortedUnique(pickStringArray(env.context_allowed_exercise_ids));
  const contextBlocked = sortedUnique(pickStringArray(env.context_blocked_exercise_ids));
  pruned = pruneToAllowed(solution, contextAllowed);
  solution = pruned.next;
  if (pruned.removed.length) removedByStage.context_constraints = pruned.removed;
  pruned = pruneRemoved(solution, contextBlocked);
  solution = pruned.next;
  if (pruned.removed.length) {
    removedByStage.context_constraints = sortedUnique([...(removedByStage.context_constraints ?? []), ...pruned.removed]) ?? [];
  }
  if (initial.length > 0 && solution.length === 0) {
    return beta10Empty("context_constraints", initial, removedByStage);
  }

  const availableEquipment = sortedUnique(pickStringArray(env.available_equipment));
  const bannedEquipment = sortedUnique(pickStringArray(env.banned_equipment));
  const requiredEquipment = sortedUnique(pickStringArray(env.required_equipment_ids));
  if (requiredEquipment) {
    const availableSet = new Set(availableEquipment ?? []);
    const missing = requiredEquipment.filter((id) => !availableSet.has(id));
    if (missing.length) {
      return failPhase3("equipment_unavailable", {
        stage: "equipment_constraints",
        missing_equipment_ids: missing,
        constraint_order: [...BETA10_CONSTRAINT_ORDER]
      });
    }
  }

  if (isRecord(env.exercise_equipment_map) && availableEquipment) {
    const availableSet = new Set(availableEquipment);
    const bannedSet = new Set(bannedEquipment ?? []);
    const kept: string[] = [];
    const removed: string[] = [];
    for (const exerciseId of solution) {
      const required = stringArrayFromRecordMap(env.exercise_equipment_map, exerciseId);
      const hasRequired = required.every((equipmentId) => availableSet.has(equipmentId));
      const hasBanned = required.some((equipmentId) => bannedSet.has(equipmentId));
      if (hasRequired && !hasBanned) kept.push(exerciseId);
      else removed.push(exerciseId);
    }
    solution = sortedUnique(kept) ?? [];
    if (removed.length) removedByStage.equipment_constraints = sortedUnique(removed) ?? [];
  }
  if (initial.length > 0 && solution.length === 0) {
    return beta10Empty("equipment_constraints", initial, removedByStage);
  }

  if (isRecord(env.exercise_activity_map)) {
    const kept: string[] = [];
    const removed: string[] = [];
    for (const exerciseId of solution) {
      const activities = stringArrayFromRecordMap(env.exercise_activity_map, exerciseId);
      if (activities.includes(activityId)) kept.push(exerciseId);
      else removed.push(exerciseId);
    }
    solution = sortedUnique(kept) ?? [];
    if (removed.length) removedByStage.activity_role_constraints = sortedUnique(removed) ?? [];
  }

  const sportRoleId = typeof canonicalInput?.sport_role_id === "string" ? canonicalInput.sport_role_id : "";
  if (sportRoleId && isRecord(env.exercise_role_map)) {
    const kept: string[] = [];
    const removed: string[] = [];
    for (const exerciseId of solution) {
      const roles = stringArrayFromRecordMap(env.exercise_role_map, exerciseId);
      if (roles.length === 0 || roles.includes(sportRoleId)) kept.push(exerciseId);
      else removed.push(exerciseId);
    }
    solution = sortedUnique(kept) ?? [];
    if (removed.length) {
      removedByStage.activity_role_constraints = sortedUnique([...(removedByStage.activity_role_constraints ?? []), ...removed]) ?? [];
    }
  }
  if (initial.length > 0 && solution.length === 0) {
    return beta10Empty("activity_role_constraints", initial, removedByStage);
  }

  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(env)) {
    if (k === "constraints_version") continue;
    if (k === "phase3_constraint_prune") continue;
    if (k === "constraint_resolution_mode") continue;
    out[k] = v;
  }

  out.candidate_exercise_ids = initial;
  out.resolved_exercise_ids = solution;
  if (availableEquipment) out.available_equipment = availableEquipment;
  if (bannedEquipment) out.banned_equipment = bannedEquipment;

  return {
    ok: true,
    constraints: out,
    prune: {
      remove_only: true,
      no_expansion: true,
      constraint_order: [...BETA10_CONSTRAINT_ORDER],
      initial_solution_space: initial,
      final_solution_space: solution,
      removed_by_stage: removedByStage
    }
  };
}

export function phase3ResolveConstraintsAndLoadRegistries(canonicalInput: any): Phase3Result {
  const notes: string[] = [];
  const loaded_registries: string[] = [];

  const idxPath = path.join(repoRoot(), "registries", "registry_index.json");
  let registry_index_version = "unknown";
  let indexList: string[] = [];

  if (fs.existsSync(idxPath)) {
    const idx = readJson(idxPath);
    if (typeof idx?.version === "string") registry_index_version = idx.version;
    indexList = extractRegistryIds(idx);
  }

  for (const id of indexList) {
    loaded_registries.push(id);

    const candidates = [
      path.join(repoRoot(), "registries", id, `${id}.registry.json`),
      path.join(repoRoot(), "registries", id, `${id}.registry.v1.0.0.json`),
      path.join(repoRoot(), "registries", id, "registry.json"),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        void readJson(p);
        break;
      }
    }
  }

  let constraints: Phase3Constraints = {};

  const env = canonicalInput?.constraints;
  if (!env) {
    notes.push("PHASE_3: registries loaded");
    notes.push("PHASE_3: constraints envelope absent — defaults permitted (v0)");
    return {
      ok: true,
      phase3: {
        constraints_resolved: true,
        notes,
        registry_index_version,
        loaded_registries,
        constraints,
      },
      notes,
    };
  }

  if (!isRecord(env)) {
    return {
      ok: false,
      failure_token: "type_mismatch",
      details: { path: "constraints", expected: "object" },
    };
  }

  if (hasBeta10Prune(canonicalInput, env)) {
    const beta10 = beta10Prune(canonicalInput, env as Record<string, any>);
    if (beta10.ok === false) return beta10;

    notes.push("PHASE_3: registries loaded");
    notes.push("PHASE_3: BETA-10 remove-only constraints resolved");

    return {
      ok: true,
      phase3: {
        constraints_resolved: true,
        notes,
        registry_index_version,
        loaded_registries,
        constraints: beta10.constraints,
        beta10_constraint_prune: beta10.prune,
      },
      notes,
    };
  }

  // Canonical constraints: exclude constraints_version, normalize known list fields.
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(env)) {
    if (k === "constraints_version") continue;
    out[k] = v;
  }

  // Normalize specific list fields we care about for precedence
  const available_equipment = sortedUnique(pickStringArray(out.available_equipment));
  const banned_equipment = sortedUnique(pickStringArray(out.banned_equipment));

  const resolution: Phase3ResolutionSummary = { rules_applied: [] };

  // Precedence rule: banned overrides available (remove banned from available)
  if (available_equipment && banned_equipment) {
    const bannedSet = new Set(banned_equipment);
    const filtered = available_equipment.filter((id) => !bannedSet.has(id));
    const removed = available_equipment.filter((id) => bannedSet.has(id));
    const filteredSorted = sortedUnique(filtered);

    out.available_equipment = filteredSorted ?? [];
    out.banned_equipment = banned_equipment;

    resolution.rules_applied.push("banned_over_available_equipment");
    if (removed.length) {
      removed.sort((a, b) => a.localeCompare(b));
      resolution.removed_from_available_equipment = removed;
    }
  } else {
    // Even if no precedence applied, still canonicalize list fields if present
    if (available_equipment) out.available_equipment = available_equipment;
    if (banned_equipment) out.banned_equipment = banned_equipment;
  }

  constraints = out;

  notes.push("PHASE_3: registries loaded");
  notes.push("PHASE_3: constraints envelope present — canonicalized (v1)");

  return {
    ok: true,
    phase3: {
      constraints_resolved: true,
      notes,
      registry_index_version,
      loaded_registries,
      constraints,
      constraints_resolution: resolution.rules_applied.length ? resolution : undefined,
    },
    notes,
  };
}

export default phase3ResolveConstraintsAndLoadRegistries;
