import fs from "node:fs";
import path from "node:path";
import type { ExerciseSignature } from "../substitution/types.js";
import type { Phase3Constraints, Phase3Output } from "./phase3.js";

export type PlannedItem = {
  block_id: string;
  item_id: string;
  exercise_id: string;

  // Prescription (v0)
  sets?: number;
  reps?: number;

  // Reserved for future (Phase6 supports these as optional fields, but we keep Phase4 v0 minimal for now)
  // intensity?: { type: "percent_1rm"; value: number } | { type: "rpe"; value: number } | { type: "load"; value: number };
  // rest_seconds?: number;
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

type Slot = {
  exercise_id: string;
  sets: number;
  reps: number;
};

function makeSixSlotFullBody(intentFirstTwo: [string, string]): Slot[] {
  // Deterministic 6-slot template using known-valid registry ids (from your grep output).
  // We keep the first two slots activity-specific (so existing behaviors remain “recognizable”),
  // then fill the rest with stable accessory patterns.
  const [a, b] = intentFirstTwo;

  // Core 4 (heavy-ish)
  const core: Slot[] = [
    { exercise_id: a, sets: 3, reps: 5 },
    { exercise_id: b, sets: 3, reps: 5 },
    { exercise_id: "deadlift", sets: 3, reps: 5 },
    { exercise_id: "overhead_press", sets: 3, reps: 5 }
  ];

  // Accessories 2 (higher reps)
  const accessories: Slot[] = [
    { exercise_id: "incline_bench_press", sets: 3, reps: 10 },
    { exercise_id: "push_up", sets: 3, reps: 10 }
  ];

  // Ensure stable uniqueness while preserving first occurrence ordering
  const all = [...core, ...accessories];
  const seen = new Set<string>();
  const out: Slot[] = [];
  for (const s of all) {
    const id = String(s.exercise_id).trim();
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(s);
  }

  // If duplicates reduced count (unlikely), top up deterministically with safe known ids
  const fallback: Slot[] = [
    { exercise_id: "bench_press", sets: 3, reps: 5 },
    { exercise_id: "back_squat", sets: 3, reps: 5 },
    { exercise_id: "goblet_squat", sets: 3, reps: 10 },
    { exercise_id: "dumbbell_bench_press", sets: 3, reps: 10 },
    { exercise_id: "kettlebell_deadlift", sets: 3, reps: 10 },
    { exercise_id: "machine_chest_press", sets: 3, reps: 10 }
  ];

  for (const f of fallback) {
    if (out.length >= 6) break;
    if (seen.has(f.exercise_id)) continue;
    seen.add(f.exercise_id);
    out.push(f);
  }

  return out.slice(0, 6);
}

export function phase4AssembleProgram(
  canonicalInput: any,
  phase3: Phase3Output
): Phase4Result {
  const activity = String(canonicalInput?.activity_id ?? "");

  const regPath = path.join(repoRoot(), "registries", "exercise", "exercise.registry.json");
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
  let firstTwo: [string, string];

  switch (activity) {
    case "powerlifting":
      program_id = "PROGRAM_POWERLIFTING_V0";
      firstTwo = ["bench_press", "back_squat"];
      break;

    case "rugby_union":
      program_id = "PROGRAM_RUGBY_UNION_V0";
      firstTwo = ["back_squat", "bench_press"];
      break;

    case "general_strength":
      program_id = "PROGRAM_GENERAL_STRENGTH_V0";
      firstTwo = ["deadlift", "bench_press"];
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

  // Build deterministic 6-slot plan (full-body minimal demo)
  const slots = makeSixSlotFullBody(firstTwo);

  const planned_exercise_ids = uniqueStable(slots.map((s) => s.exercise_id));

  // Planned items are authoritative plan surface (rich path used by Phase6)
  const planned_items: PlannedItem[] = slots.map((s, i) => ({
    block_id: "B0",
    item_id: `B0_I${i}`,
    exercise_id: s.exercise_id,
    sets: s.sets,
    reps: s.reps
  }));

  // Deterministic exercise_pool: include plan + a small, stable candidate set for substitution tests.
  // Only include if registry entry exists.
  const poolIds = uniqueStable([
    ...planned_exercise_ids,

    // known candidates from your registry grep
    "dumbbell_bench_press",
    "machine_chest_press",
    "goblet_squat",
    "kettlebell_deadlift",
    "dumbbell_overhead_press"
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

  // Deterministic target: first planned id (Phase5 pick target)
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
    notes: ["PHASE_4_V0: rich multi-exercise plan emitted (6-slot)"]
  };
}

export default phase4AssembleProgram;
