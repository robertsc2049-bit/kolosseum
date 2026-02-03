import path from "node:path";
import type { ExerciseSignature } from "../substitution/types.js";
import type { Phase3Constraints, Phase3Output } from "./phase3.js";
import { loadExerciseEntriesFromPath } from "../registries/loadExerciseEntries.js";

export type PlannedItemRole = "primary" | "accessory";

export type PlannedItemIntensity =
  | { type: "percent_1rm"; value: number }
  | { type: "rpe"; value: number }
  | { type: "load"; value: number };

export type PlannedItem = {
  block_id: string;
  item_id: string;
  exercise_id: string;

  // v1 prescription-ready fields (authoritative for Phase6 rendering)
  session_id: string;
  role: PlannedItemRole;
  sets: number;
  reps: number;
  intensity: PlannedItemIntensity;
  rest_seconds: number;
};

export type Phase4Program = {
  program_id: string;
  version: string;
  blocks: unknown[];

  // Authoritative plan
  planned_items: PlannedItem[];

  // Derived convenience only (do not treat as authoritative)
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

function repoRoot(): string {
  return process.cwd();
}

function pick(entries: Record<string, ExerciseSignature>, id: string): ExerciseSignature {
  const ex = entries?.[id];
  if (!ex) throw new Error(`Missing exercise ${id}`);
  return ex;
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

function plannedItemsFromIntent(intent: string[], session_id: string): PlannedItem[] {
  const ids = uniqueStable(intent);

  return ids.map((exercise_id, i) => {
    const isAccessory = i >= 4;
    const role: PlannedItemRole = isAccessory ? "accessory" : "primary";

    const sets = isAccessory ? 3 : 4;
    const reps = isAccessory ? 10 : 5;

    const intensity: PlannedItemIntensity = isAccessory
      ? { type: "percent_1rm", value: 60 }
      : { type: "percent_1rm", value: 75 };

    const rest_seconds = isAccessory ? 90 : 180;

    return {
      block_id: "B0",
      item_id: `B0_I${i}`,
      exercise_id,
      session_id,
      role,
      sets,
      reps,
      intensity,
      rest_seconds
    };
  });
}

function readSessionTimeboxMinutes(canonicalInput: any, phase3Constraints?: any): number {
  const tb =
    canonicalInput?.constraints?.schedule?.session_timebox_minutes ??
    phase3Constraints?.schedule?.session_timebox_minutes ??
    NaN;

  const n = Number(tb);
  if (!Number.isFinite(n) || n <= 0) return NaN;
  return n;
}

/**
 * Timebox pruning (deterministic):
 * - If no timebox: unchanged
 * - Always keep all primaries
 * - tb < 30: drop all accessories
 * - tb < 45: keep at most 1 accessory (stable order)
 */
function applyTimeboxDeterministic(items: PlannedItem[], timeboxMinutes: number): PlannedItem[] {
  if (!Number.isFinite(timeboxMinutes)) return items;

  if (timeboxMinutes < 30) return items.filter((it) => it.role === "primary");

  if (timeboxMinutes < 45) {
    const primaries = items.filter((it) => it.role === "primary");
    const accessories = items.filter((it) => it.role === "accessory");
    return [...primaries, ...accessories.slice(0, 1)];
  }

  return items;
}

export function phase4AssembleProgram(canonicalInput: any, phase3: Phase3Output): Phase4Result {
  const activity = String(canonicalInput?.activity_id ?? "");

  const regPath = path.join(repoRoot(), "registries", "exercise", "exercise.registry.json");
  const entries = loadExerciseEntriesFromPath(regPath);

  /**
   * Phase4 contract (v1):
   * - Emits a MULTI-exercise plan for supported activities (>=2 planned items).
   * - planned_items are authoritative and prescription-ready.
   * - planned_exercise_ids are derived convenience ONLY.
   * - Carries Phase3 canonical constraints forward on program.constraints (authoritative).
   * - Provides deterministic exercise_pool for Phase5 scoring and substitution.
   * - Sets target_exercise_id to derived planned_exercise_ids[0].
   * - Applies deterministic timebox pruning via constraints.schedule.session_timebox_minutes.
   */

  let program_id: string;
  let intent: string[];

  switch (activity) {
    case "powerlifting":
      program_id = "PROGRAM_POWERLIFTING_V1";
      intent = ["bench_press", "back_squat", "deadlift", "overhead_press", "incline_bench_press", "push_up"];
      break;

    case "rugby_union":
      program_id = "PROGRAM_RUGBY_UNION_V1";
      intent = ["back_squat", "bench_press", "deadlift", "overhead_press", "incline_bench_press", "push_up"];
      break;

    case "general_strength":
      program_id = "PROGRAM_GENERAL_STRENGTH_V1";
      intent = ["deadlift", "bench_press", "back_squat", "overhead_press", "incline_bench_press", "push_up"];
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

  // Keep Phase6 stable: single session for now.
  const session_id = "SESSION_V1";

  const timeboxMinutes = readSessionTimeboxMinutes(canonicalInput, phase3.constraints);

  let planned_items = plannedItemsFromIntent(intent, session_id);
  planned_items = applyTimeboxDeterministic(planned_items, timeboxMinutes);

  // Derived convenience only (and must match planned_items order 1:1 per test contract)
  const planned_exercise_ids = planned_items.map((it) => it.exercise_id);

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

  const exercises = Object.values(exercise_pool).sort((a, b) => a.exercise_id.localeCompare(b.exercise_id));
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
    notes: ["PHASE_4_V1: prescription-ready planned_items emitted"]
  };
}

export default phase4AssembleProgram;