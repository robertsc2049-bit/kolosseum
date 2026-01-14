import fs from "node:fs";
import path from "node:path";
import type { ExerciseSignature } from "../substitution/types.js";
import type { Phase3Output } from "./phase3.js";

export type Phase4Program = {
  program_id: string;
  version: string;
  blocks: unknown[];

  // NEW: intended work only (the plan)
  planned_exercise_ids?: string[];

  // NEW: substitution pool for Phase 5 (includes intended + alternates)
  exercise_pool?: Record<string, ExerciseSignature>;

  // Phase 5 target
  target_exercise_id?: string;

  // constraints from Phase 3
  constraints?: Phase3Output["constraints"];
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

  // Load exercise registry
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

  const bench: ExerciseSignature | undefined = entries["bench_press"];
  const dbBench: ExerciseSignature | undefined = entries["dumbbell_bench_press"];

  if (!bench || !dbBench) {
    return {
      ok: false,
      failure_token: "registry_incomplete",
      details: "PHASE_4: required exercises missing from exercise registry (bench_press, dumbbell_bench_press)"
    };
  }

  // ✅ Plan = intended work only
  const planned_exercise_ids = ["bench_press"];

  // ✅ Pool = intended + alternates
  const exercise_pool: Record<string, ExerciseSignature> = {
    bench_press: bench,
    dumbbell_bench_press: dbBench
  };

  return {
    ok: true,
    program: {
      program_id: "PROGRAM_POWERLIFTING_V0",
      version: "1.0.0",
      blocks: [],
      planned_exercise_ids,
      exercise_pool,
      target_exercise_id: "bench_press",
      constraints: phase3.constraints
    },
    notes: ["PHASE_4_V0: emitted planned_exercise_ids (intended) + exercise_pool (candidates) from exercise registry (constraints from Phase 3)"]
  };
}


