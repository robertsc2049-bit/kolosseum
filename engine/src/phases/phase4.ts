import fs from "node:fs";
import path from "node:path";
import type { ExerciseSignature } from "../substitution/types.js";

export type Phase4Program = {
  program_id: string;
  version: string;
  blocks: unknown[];

  // NEW: minimal substitutable shape for Phase 5
  exercises?: ExerciseSignature[];
  target_exercise_id?: string;
  constraints?: { avoid_joint_stress_tags?: string[] };
};

export type Phase4Result =
  | { ok: true; program: Phase4Program; notes: string[] }
  | { ok: false; failure_token: string; details?: unknown };

function stripBom(s: string): string {
  return s.length > 0 && s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}

function readJson(p: string): any {
  const raw = stripBom(fs.readFileSync(p, "utf8"));
  return JSON.parse(raw);
}

function repoRoot(): string {
  // dist/engine/src/phases/phase4.js -> repoRoot is 4 levels up; but in TS we run compiled from dist.
  // Use process.cwd() which is repo root when running via npm scripts.
  return process.cwd();
}

export function phase4AssembleProgram(canonicalInput: any): Phase4Result {
  const activityId = String(canonicalInput?.activity_id ?? "");

  // Default scaffold
  const base: Phase4Program = {
    program_id: "PROGRAM_STUB",
    version: "1.0.0",
    blocks: [],
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

  return {
    ok: true,
    program: {
      program_id: "PROGRAM_POWERLIFTING_V0",
      version: "1.0.0",
      blocks: [],
      exercises: [bench, dbBench],
      target_exercise_id: "bench_press",

      // Demo constraint to prove Phase 5 substitution in normal run (will move to Phase 3 later)
      constraints: { avoid_joint_stress_tags: ["shoulder_high"] }
    },
    notes: ["PHASE_4_V0: emitted minimal substitutable program from exercise registry"]
  };
}
