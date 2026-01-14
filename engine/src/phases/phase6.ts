// engine/src/phases/phase6.ts
import type { ExerciseSignature } from "../substitution/types.js";

export type Phase6SessionExercise = {
  exercise_id: string;
  source: "program";

  // Rich fields only when driven by planned_items
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
 * Authoritative plan:
 * 1) planned_items (rich)
 * 2) planned_exercise_ids (legacy)
 * 3) exercises[] (legacy fallback)
 */
function planMode(program: any): "planned_items" | "planned_exercise_ids" | "exercises" | "empty" {
  if (Array.isArray(program?.planned_items) && program.planned_items.length > 0) return "planned_items";
  if (Array.isArray(program?.planned_exercise_ids) && program.planned_exercise_ids.length > 0) return "planned_exercise_ids";
  if (Array.isArray(program?.exercises) && program.exercises.length > 0) return "exercises";
  return "empty";
}

function plannedIdsFromProgram(program: any): string[] {
  if (Array.isArray(program?.planned_items) && program.planned_items.length > 0) {
    return program.planned_items.map((x: any) => String(x?.exercise_id ?? "")).filter(Boolean);
  }
  if (Array.isArray(program?.planned_exercise_ids) && program.planned_exercise_ids.length > 0) {
    return program.planned_exercise_ids.map((x: any) => String(x)).filter(Boolean);
  }
  if (Array.isArray(program?.exercises) && program.exercises.length > 0) {
    return program.exercises.map((x: any) => String(x?.exercise_id ?? "")).filter(Boolean);
  }
  return [];
}

function applySubstitutions(
  plannedIds: string[],
  p5: Phase5Like
): { ids: string[]; substitutedFrom: Map<string, string> } {
  const substitutedFrom = new Map<string, string>();
  if (!p5 || (p5 as any).ok !== true) return { ids: plannedIds, substitutedFrom };

  const adjustments = Array.isArray((p5 as any).adjustments) ? (p5 as any).adjustments : [];
  let ids = [...plannedIds];

  for (const a of adjustments) {
    if (a?.adjustment_id !== "SUBSTITUTE_EXERCISE") continue;
    if (a?.applied !== true) continue;

    const target = String(a?.details?.target_exercise_id ?? "");
    const sub = String(a?.details?.substitute_exercise_id ?? "");
    if (!target || !sub) continue;

    // Replace deterministically across plan
    ids = ids.map((x) => {
      if (x !== target) return x;
      substitutedFrom.set(sub, target);
      return sub;
    });
  }

  return { ids, substitutedFrom };
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
 * Phase 6 (v1+)
 * - Driven by plan (planned_items > planned_exercise_ids > exercises[])
 * - Applies Phase 5 substitutions deterministically
 * - No duplicates
 * - Rich fields only when driven by planned_items
 * - Legacy emission is minimal shape only
 */
export function phase6ProduceSessionOutput(program: unknown, _canonicalInput: unknown, p5?: Phase5Like): Phase6Result {
  const prog: any = program ?? {};
  const mode = planMode(prog);

  // Keep pool hook for future eligibility checks
  void poolFromProgram(prog);

  const plannedIds = plannedIdsFromProgram(prog);
  const { ids: substitutedIds, substitutedFrom } = applySubstitutions(plannedIds, p5);
  const finalIds = dedupeStable(substitutedIds);

  // Baseline: no plan => deterministic empty shell
  if (finalIds.length === 0) {
    return {
      ok: true,
      session: {
        session_id: "SESSION_STUB",
        status: "ready",
        exercises: []
      },
      notes: ["PHASE_6_STUB: deterministic empty session shell"]
    };
  }

  // Rich path: planned_items are authoritative and carry sets/reps/etc.
  if (mode === "planned_items") {
    const items: any[] = Array.isArray(prog?.planned_items) ? prog.planned_items : [];

    // Apply substitutions at item-level (exercise_id replacement) while preserving metadata.
    const exercises: Phase6SessionExercise[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < items.length; i++) {
      const it = items[i] ?? {};
      const originalId = String(it.exercise_id ?? "");
      if (!originalId) continue;

      // Determine substituted id (based on finalIds mapping behavior)
      // We re-run the same deterministic replacement by using substitutedFrom map:
      // if a substitute is recorded for some final id, we only tag when replacement occurred.
      let finalId = originalId;
      // If this original was targeted, the replacement would be stored as (sub -> target).
      // We need to detect if originalId was replaced; easiest is to look for an adjustment target match.
      // Reconstruct by scanning substitutedFrom values.
      for (const [subId, targetId] of substitutedFrom.entries()) {
        if (targetId === originalId) {
          finalId = subId;
          break;
        }
      }

      // Dedupe by final exercise id (stable)
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
      session: {
        session_id: "SESSION_V1",
        status: "ready",
        exercises
      },
      notes:
        p5 && (p5 as any).ok === true
          ? ["PHASE_6: applied Phase 5 substitution adjustments (planned items; no duplicates)"]
          : ["PHASE_6_V1: emitted session exercises from planned items"]
    };
  }

  // Legacy paths: minimal output only (keep old tests stable)
  const exercises: Phase6SessionExercise[] = finalIds.map((id) => {
    const ex: Phase6SessionExercise = { exercise_id: id, source: "program" };
    const from = substitutedFrom.get(id);
    if (from) ex.substituted_from = from;
    return ex;
  });

  return {
    ok: true,
    session: {
      session_id: "SESSION_V1",
      status: "ready",
      exercises
    },
    notes:
      p5 && (p5 as any).ok === true
        ? ["PHASE_6: applied Phase 5 substitution adjustments (legacy plan; no duplicates)"]
        : ["PHASE_6_V1: emitted session exercises from legacy plan"]
  };
}
