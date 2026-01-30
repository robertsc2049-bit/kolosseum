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

function pickFirstAvailable(entries: any, ids: string[]): ExerciseSignature | undefined {
  for (const id of ids) {
    const ex = pickExercise(entries, id);
    if (ex) return ex;
  }
  return undefined;
}

function buildProgramFromSpec(args: {
  activityId: string;
  entries: any;
  program_id: string;
  version: string;
  planned_priority: string[]; // first available becomes the planned target
  alternate_priority: string[]; // alternates for substitution candidate set
  constraints: Phase3Constraints;
}): Phase4Result {
  const { activityId, entries, program_id, version, planned_priority, alternate_priority, constraints } = args;

  const planned = pickFirstAvailable(entries, planned_priority);
  if (!planned) {
    return {
      ok: false,
      failure_token: "registry_incomplete",
      details: `PHASE_4: activity '${activityId}' missing required planned exercises. Tried: ${planned_priority.join(", ")}`
    };
  }

  const planned_id = planned.exercise_id;

  // Build deterministic alternates list: first-match order, excluding planned if duplicated.
  const alternates: ExerciseSignature[] = [];
  const seen = new Set<string>([planned_id]);

  for (const id of alternate_priority) {
    const ex = pickExercise(entries, id);
    if (!ex) continue;
    if (seen.has(ex.exercise_id)) continue;
    seen.add(ex.exercise_id);
    alternates.push(ex);
  }

  const planned_exercise_ids: string[] = [planned_id];

  // Candidate list for Phase 5: planned first, then alternates.
  const exercises: ExerciseSignature[] = [planned, ...alternates];

  const exercise_pool: Record<string, ExerciseSignature> = {};
  for (const ex of exercises) exercise_pool[ex.exercise_id] = ex;

  return {
    ok: true,
    program: {
      program_id,
      version,
      blocks: [],
      planned_exercise_ids,
      exercises,
      exercise_pool,
      target_exercise_id: planned_id,
      constraints
    },
    notes: [
      `PHASE_4_V0: emitted planned_exercise_ids + exercises + exercise_pool for activity '${activityId}' from exercise registry; constraints consumed from Phase 3 canonical contract`
    ]
  };
}

export function phase4AssembleProgram(canonicalInput: any, phase3: Phase3Output): Phase4Result {
  const activityId = String(canonicalInput?.activity_id ?? "");

  // Load exercise registry (v0 reads directly from disk for determinism + simplicity).
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

  // NOTE: These are deterministic preference lists.
  // We do NOT infer; we only select from explicitly declared registry IDs.
  // If the registry doesn't contain these, we fail closed-world (correct for v0).
  if (activityId === "powerlifting") {
    return buildProgramFromSpec({
      activityId,
      entries,
      program_id: "PROGRAM_POWERLIFTING_V0",
      version: "1.0.0",
      planned_priority: [
        "bench_press"
      ],
      alternate_priority: [
        "dumbbell_bench_press",
        "machine_chest_press"
      ],
      constraints: phase3.constraints
    });
  }

  if (activityId === "rugby_union") {
    // Minimal “field sport strength” plan: pick one compound push as the target
    // with deterministic alternates. Keep it small; v0 just needs something non-stub.
    return buildProgramFromSpec({
      activityId,
      entries,
      program_id: "PROGRAM_RUGBY_UNION_V0",
      version: "1.0.0",
      planned_priority: [
        "bench_press",
        "dumbbell_bench_press",
        "machine_chest_press",
        "push_up"
      ],
      alternate_priority: [
        "dumbbell_bench_press",
        "machine_chest_press",
        "push_up",
        "incline_dumbbell_press",
        "incline_bench_press"
      ],
      constraints: phase3.constraints
    });
  }

  if (activityId === "general_strength") {
    // Minimal general strength plan: same approach, but allow broader fallbacks.
    return buildProgramFromSpec({
      activityId,
      entries,
      program_id: "PROGRAM_GENERAL_STRENGTH_V0",
      version: "1.0.0",
      planned_priority: [
        "bench_press",
        "push_up",
        "dumbbell_bench_press",
        "machine_chest_press"
      ],
      alternate_priority: [
        "push_up",
        "dumbbell_bench_press",
        "machine_chest_press",
        "incline_bench_press"
      ],
      constraints: phase3.constraints
    });
  }

  // Closed-world v0: still stub for anything else.
  const base: Phase4Program = {
    program_id: "PROGRAM_STUB",
    version: "1.0.0",
    blocks: []
  };

  return {
    ok: true,
    program: base,
    notes: ["PHASE_4_STUB: program assembly not yet implemented for this activity_id"]
  };
}




