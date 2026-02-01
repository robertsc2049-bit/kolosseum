// engine/src/phases/phase6.ts
import type { ExerciseSignature } from "../substitution/types.js";

export type Phase6SessionExercise = {
  exercise_id: string;
  source: "program";

  // Optional prescription fields
  block_id?: string;
  item_id?: string;
  sets?: number;
  reps?: number;
  intensity?:
    | { type: "percent_1rm"; value: number }
    | { type: "rpe"; value: number }
    | { type: "load"; value: number };
  rest_seconds?: number;

  // Substitution trace
  substituted_from?: string;
};

export type Phase6SessionOutput = {
  session_id: string;
  status: "ready";
  exercises: Phase6SessionExercise[];
};

export type Phase6Result =
  | { ok: true; session: Phase6SessionOutput; notes: string[] }
  | { ok: false; failure_token: string; details?: unknown };

type Phase5Like =
  | { ok: true; adjustments: any[]; notes?: string[] }
  | { ok: false; failure_token: string; details?: unknown }
  | undefined;

type SubRule = { target: string; sub: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

// Not currently used for emission, but kept for future validation/lookup.
function poolFromProgram(program: any): Record<string, ExerciseSignature> {
  if (program?.exercise_pool && isRecord(program.exercise_pool)) {
    return program.exercise_pool as Record<string, ExerciseSignature>;
  }
  const pool: Record<string, ExerciseSignature> = {};
  for (const ex of program?.exercises ?? []) {
    if (ex && typeof ex.exercise_id === "string") {
      pool[ex.exercise_id] = ex as ExerciseSignature;
    }
  }
  return pool;
}

/**
 * Plan mode detection.
 * Contract (enforced):
 * - planned_items is the ONLY accepted non-empty plan source.
 * - planned_exercise_ids and exercises[] are legacy and MUST NOT be used for session emission.
 */
function planMode(program: any): "planned_items" | "planned_exercise_ids" | "exercises" | "empty" {
  if (Array.isArray(program?.planned_items) && program.planned_items.length > 0) return "planned_items";
  if (Array.isArray(program?.planned_exercise_ids) && program.planned_exercise_ids.length > 0)
    return "planned_exercise_ids";
  if (Array.isArray(program?.exercises) && program.exercises.length > 0) return "exercises";
  return "empty";
}

function plannedIdsFromPlannedItems(program: any): string[] {
  if (!Array.isArray(program?.planned_items) || program.planned_items.length === 0) return [];
  return program.planned_items.map((x: any) => String(x?.exercise_id ?? "")).filter(Boolean);
}

function extractSubRules(p5: Phase5Like): SubRule[] {
  if (!p5 || (p5 as any).ok !== true) return [];
  const adjustments = Array.isArray((p5 as any).adjustments) ? (p5 as any).adjustments : [];
  const rules: SubRule[] = [];

  for (const a of adjustments) {
    if (a?.adjustment_id !== "SUBSTITUTE_EXERCISE") continue;
    if (a?.applied !== true) continue;

    const target = String(a?.details?.target_exercise_id ?? "");
    const sub = String(a?.details?.substitute_exercise_id ?? "");
    if (!target || !sub) continue;
    if (target === sub) continue;

    rules.push({ target, sub });
  }

  return rules;
}

/**
 * Deterministic sequential substitution:
 * Applies rules in-order, allowing chaining (A->B then B->C => A->C).
 */
function applyRulesToId(originalId: string, rules: SubRule[]): { finalId: string; changed: boolean } {
  let cur = originalId;
  let changed = false;

  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    if (cur === r.target) {
      cur = r.sub;
      changed = true;
    }
  }

  return { finalId: cur, changed };
}

/**
 * Apply rules to list of ids; `applied` true only if at least one id changes.
 */
function applySubstitutionsToIds(plannedIds: string[], rules: SubRule[]): { ids: string[]; applied: boolean } {
  if (rules.length === 0) return { ids: plannedIds, applied: false };

  let anyChanged = false;
  const ids = plannedIds.map((id) => {
    const r = applyRulesToId(id, rules);
    if (r.changed) anyChanged = true;
    return r.finalId;
  });

  return { ids, applied: anyChanged };
}

function dedupeStable(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Phase 6
 * Contract required by tests/goldens:
 * - If plan is empty: return deterministic empty shell with session_id=SESSION_STUB
 *   and notes exactly ["PHASE_6_STUB: deterministic empty session shell"].
 * - If plan is non-empty: session_id=SESSION_V1.
 * - Non-empty plans MUST use planned_items. Legacy sources are forbidden.
 */
export function phase6ProduceSessionOutput(program: unknown, canonicalInput: unknown, p5?: Phase5Like): Phase6Result {
  const prog: any = program ?? {};
  const mode = planMode(prog);

  // Keep pool extraction for future validation even though it's not used today.
  void canonicalInput;
  void poolFromProgram(prog);

  // Empty plan -> constant stub contract
  if (mode === "empty") {
    return {
      ok: true,
      session: { session_id: "SESSION_STUB", status: "ready", exercises: [] },
      notes: ["PHASE_6_STUB: deterministic empty session shell"]
    };
  }

  // Hard gate: planned_items only
  if (mode !== "planned_items") {
    return {
      ok: false,
      failure_token: "phase6_requires_planned_items",
      details: { required: "planned_items", saw: mode }
    };
  }

  const rules = extractSubRules(p5);

  // Compute final ids for emptiness checks and global applied-flag
  const plannedIds = plannedIdsFromPlannedItems(prog);
  const subbed = applySubstitutionsToIds(plannedIds, rules);
  const finalIds = dedupeStable(subbed.ids);

  if (finalIds.length === 0) {
    return {
      ok: true,
      session: { session_id: "SESSION_STUB", status: "ready", exercises: [] },
      notes: ["PHASE_6_STUB: deterministic empty session shell"]
    };
  }

  const session_id = "SESSION_V1";

  // Emit from planned_items, applying chained rules per item deterministically
  const items: any[] = Array.isArray(prog?.planned_items) ? prog.planned_items : [];
  const exercises: Phase6SessionExercise[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < items.length; i++) {
    const it = items[i] ?? {};
    const originalId = String(it.exercise_id ?? "");
    if (!originalId) continue;

    const r = applyRulesToId(originalId, rules);
    const finalId = r.finalId;

    if (seen.has(finalId)) continue;
    seen.add(finalId);

    const ex: Phase6SessionExercise = {
      exercise_id: finalId,
      source: "program",
      block_id: typeof it.block_id === "string" ? it.block_id : "B0",
      item_id: typeof it.item_id === "string" ? it.item_id : `B0_I${i}`,
      sets: typeof it.sets === "number" ? it.sets : 0,
      reps: typeof it.reps === "number" ? it.reps : 0,
      intensity: it.intensity,
      rest_seconds: typeof it.rest_seconds === "number" ? it.rest_seconds : undefined
    };

    if (finalId !== originalId) ex.substituted_from = originalId;
    exercises.push(ex);
  }

  return {
    ok: true,
    session: { session_id, status: "ready", exercises },
    notes: [
      subbed.applied
        ? "PHASE_6: emitted session from planned_items with Phase5 substitutions (deduped)"
        : "PHASE_6: emitted session from planned_items (deduped)"
    ]
  };
}
