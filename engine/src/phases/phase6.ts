export type Phase6SessionExercise = {
  exercise_id: string;
  source: "program";
};

export type Phase6SessionOutput = {
  session_id: string;
  status: "ready";
  exercises: Phase6SessionExercise[];
};

export type Phase6Result =
  | { ok: true; session: Phase6SessionOutput; notes: string[] }
  | { ok: false; failure_token: string; details?: unknown };

/**
 * Phase 6 (v1)
 * Deterministically emits session exercises from program.exercises[] when present.
 */
export function phase6ProduceSessionOutput(program: unknown, _canonicalInput: unknown): Phase6Result {
  const notes: string[] = [];

  const exercises: Phase6SessionExercise[] = [];

  if (program && typeof program === "object") {
    const maybe = program as { exercises?: unknown };

    if (Array.isArray(maybe.exercises)) {
      for (const item of maybe.exercises) {
        if (item && typeof item === "object") {
          const ex = item as { exercise_id?: unknown };
          if (typeof ex.exercise_id === "string" && ex.exercise_id.length > 0) {
            exercises.push({ exercise_id: ex.exercise_id, source: "program" });
          }
        }
      }
      notes.push("PHASE_6_V1: emitted session exercises from program.exercises[]");
    } else {
      notes.push("PHASE_6_V1: program has no exercises[]; emitted empty session");
    }
  } else {
    notes.push("PHASE_6_V1: program not an object; emitted empty session");
  }

  return {
    ok: true,
    session: {
      session_id: "SESSION_STUB",
      status: "ready",
      exercises
    },
    notes
  };
}
