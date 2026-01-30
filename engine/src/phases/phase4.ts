import fs from "node:fs";
import path from "node:path";
import type { ExerciseSignature } from "../substitution/types.js";
import type { Phase3Constraints, Phase3Output } from "./phase3.js";

export type PlannedItem = {
  block_id: string;
  item_id: string;
  exercise_id: string;
  sets?: number;
  reps?: number;
};

export type Phase4Program = {
  program_id: string;
  version: string;
  blocks: unknown[];

  // Authoritative plan (v0)
  planned_items: PlannedItem[];
  planned_exercise_ids: string[];

  // Candidate pool for substitution
  exercises: ExerciseSignature[];
  exercise_pool: Record<string, ExerciseSignature>;

  // Phase5 target selection hint
  target_exercise_id: string;

  // Canonical constraints (Phase3 authoritative)
  constraints?: Phase3Constraints;
};

export type Phase4Result =
  | { ok: true; program: Phase4Program; notes: string[] }
  | { ok: false; failure_token: string; details?: unknown };

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
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

function pick(entries: any, id: string): ExerciseSignature {
  const ex = entries?.[id];
  if (!ex) throw new Error(`Missing exercise ${id}`);
  return ex as ExerciseSignature;
}

function uniqueStable(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const s = String(id ?? "").trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export function phase4AssembleProgram(
  canonicalInput: any,
  phase3: Phase3Output
): Phase4Result {
  const activity = String(canonicalInput?.activity_id ?? "");

  const regPath = path.join(
    repoRoot(),
    "registries",
    "exercise",
    "exercise.registry.json"
  );

  const reg = readJson(regPath);
  const entries = isRecord(reg?.entries) ? reg.entries : {};

  /**
   * Phase4 contract (v0):
   * - Emits a MULTI-exercise plan for supported activities (>=2 planned ids).
   * - Carries Phase3 canonical constraints forward on program.constraints (authoritative).
   * - Provides deterministic exercise_pool for Phase5 scoring and substitution.
   * - Sets target_exercise_id to planned_exercise_ids[0] (Phase5 pick target).
   */

  let program_id: string;
  let intent: string[];

  switch (activity) {
    case "powerlifting":
      program_id = "PROGRAM_POWERLIFTING_V0";
      intent = ["bench_press", "back_squat"];
      break;

    case "rugby_union":
      program_id = "PROGRAM_RUGBY_UNION_V0";
      intent = ["back_squat", "bench_press"];
      break;

    case "general_strength":
      program_id = "PROGRAM_GENERAL_STRENGTH_V0";
      intent = ["deadlift", "bench_press"];
      break;

    default:
      return {
        ok: true,
        program: {
          program_id: "PROGRAM_STUB",
          version: "1.0.0",
          blocks: [],
          planned_items: [],
          planned_exercise_ids: [],
          exercises: [],
          exercise_pool: {},
          target_exercise_id: "",
          constraints: phase3.constraints
        },
        notes: ["PHASE_4_STUB"]
      };
  }

  const planned_exercise_ids = uniqueStable(intent);

  // Planned items are authoritative plan surface (rich path used by Phase6)
  const planned_items: PlannedItem[] = planned_exercise_ids.map((exercise_id, i) => ({
    block_id: "B0",
    item_id: `B0_I${i}`,
    exercise_id,
    sets: 3,
    reps: 5
  }));

  // Deterministic exercise_pool: include intent + a small candidate set for substitution tests.
  const poolIds = uniqueStable([
    ...planned_exercise_ids,
    "dumbbell_bench_press",
    "machine_chest_press",
    "goblet_squat",
    "kettlebell_deadlift"
  ]);

  const exercise_pool: Record<string, ExerciseSignature> = {};
  for (const id of poolIds) {
    if (entries[id]) {
      exercise_pool[id] = pick(entries, id);
    }
  }

  const exercises = Object.values(exercise_pool).sort((a, b) =>
    a.exercise_id.localeCompare(b.exercise_id)
  );

  // Deterministic target: first planned id (Phase5 will substitute only if disqualified)
  const target_exercise_id = planned_exercise_ids[0] ?? "";

  return {
    ok: true,
    program: {
      program_id,
      version: "1.0.0",
      blocks: [],
      planned_items,
      planned_exercise_ids,
      exercises,
      exercise_pool,
      target_exercise_id,
      constraints: phase3.constraints
    },
    notes: ["PHASE_4_V0: multi-exercise intent emitted"]
  };
}