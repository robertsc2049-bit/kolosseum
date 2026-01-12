import type { ExerciseSignature } from "../substitution/types.js";

export type Phase6SessionExercise = {
  exercise_id: string;
  source: "program";
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

function plannedIdsFromProgram(program: any): string[] {
  if (Array.isArray(program?.planned_exercise_ids) && program.planned_exercise_ids.length > 0) {
    return program.planned_exercise_ids.map((x: any) => String(x));
  }
  if (Array.isArray(program?.exercises) && program.exercises.length > 0) {
    return program.exercises.map((x: any) => String(x?.exercise_id ?? "")).filter(Boolean);
  }
  return [];
}

function applySubstitutions(
  planned: string[],
  p5: Phase5Like
): { ids: string[]; substitutedFrom: Map<string, string> } {
  const substitutedFrom = new Map<string, string>();

  if (!p5 || (p5 as any).ok !== true) return { ids: planned, substitutedFrom };

  const adjustments = Array.isArray((p5 as any).adjustments) ? (p5 as any).adjustments : [];
  let ids = [...planned];

  for (const a of adjustments) {
    if (a?.adjustment_id !== "SUBSTITUTE_EXERCISE") continue;
    if (a?.applied !== true) continue;

    const target = String(a?.details?.target_exercise_id ?? "");
    const sub = String(a?.details?.substitute_exercise_id ?? "");
    if (!target || !sub) continue;

    // Replace all occurrences deterministically
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
 * Phase 6 (v1)
 * Emits session exercises from program.planned_exercise_ids and applies Phase 5 substitutions
 * deterministically without duplicates.
 */
export function phase6ProduceSessionOutput(program: unknown, _canonicalInput: unknown, p5?: Phase5Like): Phase6Result {
  const prog: any = program ?? {};
  const pool = poolFromProgram(prog);

  const planned = plannedIdsFromProgram(prog);
  const { ids: substitutedIds, substitutedFrom } = applySubstitutions(planned, p5);

  const finalIds = dedupeStable(substitutedIds);

  const exercises: Phase6SessionExercise[] = finalIds.map((id) => {
    const ex: Phase6SessionExercise = { exercise_id: id, source: "program" };
    const from = substitutedFrom.get(id);
    if (from) ex.substituted_from = from;
    return ex;
  });

  // If planned list was empty, fall back to emitting nothing (deterministic)
  // (Do NOT emit full pool/exercises list; Phase 6 is driven by plan.)
    const hasPlan = finalIds.length > 0;

  if (!hasPlan) {
    return {
      ok: true,
      session: {
        session_id: "SESSION_STUB",
        status: "ready",
        exercises: []
      },
      notes: ["PHASE_6_STUB: session output not yet implemented"]
    };
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
        ? ["PHASE_6: applied Phase 5 substitution adjustments (planned list; no duplicates)"]
        : ["PHASE_6_V1: emitted session exercises from planned list"]
  };
}
