import fs from "node:fs";
import path from "node:path";
import type { ExerciseSignature } from "../substitution/types.js";
import type { Phase3Constraints, Phase3Output } from "./phase3.js";

export type Phase4Program = {
  program_id: string;
  version: string;
  blocks: unknown[];

  /**
   * v0+:
   * - planned_exercise_ids: intended work only (the plan)
   * - exercises: closed-world candidate set for Phase 5 scoring (intended + alternates)
   * - exercise_pool: deterministic lookup map for Phase 6 mapping
   */
  planned_exercise_ids?: string[];
  exercises?: ExerciseSignature[];
  exercise_pool?: Record<string, ExerciseSignature>;

  // Phase 5 target (defaults to planned[0] if absent, Phase 5 handles)
  target_exercise_id?: string;

  /**
   * Canonical constraint contract (Phase 3 authoritative).
   * No renaming/mapping downstream.
   */
  constraints?: Phase3Constraints;
};

export type Phase4Result =
  | { ok: true; program: Phase4Program; notes: string[] }
  | { ok: false; failure_token: string; details?: unknown };

function stripBom(s: string): string {
  return s.length > 0 && s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function readJson(p: string): any {
  const raw = stripBom(fs.readFileSync(p, "utf8"));
  return JSON.parse(raw);
}

function repoRoot(): string {
  return process.cwd();
}

function pickExercise(entries: any, id: string): ExerciseSignature | undefined {
  const ex = entries?.[id];
  if (!ex || typeof ex !== "object") return undefined;
  if (typeof (ex as any).exercise_id !== "string") return undefined;
  return ex as ExerciseSignature;
}

export function phase4AssembleProgram(canonicalInput: any, phase3: Phase3Output): Phase4Result {
  const activityId = String(canonicalInput?.activity_id ?? "");

  const base: Phase4Program = {
    program_id: "PROGRAM_STUB",
    version: "1.0.0",
    blocks: []
  };

  if (activityId !== "powerlifting") {
    return {
      ok: true,
      program: base,
      notes: ["PHASE_4_STUB: program assembly not yet implemented"]
    };
  }

  // Load exercise registry (Phase 4 owns program composition; it may rely on Phase 3 having loaded registries,
  // but v0 reads directly from disk for determinism + simplicity).
  const regPath = path.join(repoRoot(), "registries", "exercise", "exercise.registry.json");
  if (!fs.existsSync(regPath)) {
    return {
      ok: false,
      failure_token: "registry_load_failed",
      details: `PHASE_4: missing exercise registry: ${path.relative(repoRoot(), regPath)}`
    };
  }

  const reg = readJson(regPath);
  const entries = reg?.entries ?? {};

  const bench = pickExercise(entries, "bench_press");
  const dbBench = pickExercise(entries, "dumbbell_bench_press");

  if (!bench || !dbBench) {
    return {
      ok: false,
      failure_token: "registry_incomplete",
      details: "PHASE_4: required exercises missing from exercise registry (bench_press, dumbbell_bench_press)"
    };
  }

  // Plan = intended work only (stable)
  const planned_exercise_ids: string[] = ["bench_press"];

  // Pool = intended + alternates (lookup)
  const exercise_pool: Record<string, ExerciseSignature> = {
    bench_press: bench,
    dumbbell_bench_press: dbBench
  };

  // Candidate list for Phase 5 substitution scoring
  // Deterministic order: intended first, then alternates.
  const exercises: ExerciseSignature[] = [bench, dbBench];

  return {
    ok: true,
    program: {
      program_id: "PROGRAM_POWERLIFTING_V0",
      version: "1.0.0",
      blocks: [],
      planned_exercise_ids,
      exercises,
      exercise_pool,
      target_exercise_id: "bench_press",

      // Canonical constraints contract (Phase 3 authoritative)
      constraints: phase3.constraints
    },
    notes: [
      "PHASE_4_V0: emitted planned_exercise_ids (intended) + exercises (candidates) + exercise_pool (lookup) from exercise registry; constraints consumed from Phase 3 canonical contract"
    ]
  };
}




