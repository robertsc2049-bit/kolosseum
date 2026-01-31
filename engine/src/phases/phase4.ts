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

function asStringArray(v: any): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x ?? "").trim()).filter(Boolean);
}

function toSet(xs: string[]): Set<string> {
  return new Set(xs.map((x) => x.toLowerCase()));
}

function hasAny(hay: Set<string>, needles: string[]): boolean {
  for (const n of needles) if (hay.has(n.toLowerCase())) return true;
  return false;
}

function timeboxBucket(minutes: number | null | undefined): "tiny" | "short" | "normal" {
  const m = typeof minutes === "number" && Number.isFinite(minutes) ? minutes : null;
  if (m === null) return "normal";
  if (m <= 35) return "tiny";
  if (m <= 50) return "short";
  return "normal";
}

type GoalId = "strength" | "hypertrophy" | "general_fitness" | "rehab" | "sport_performance";

function resolveGoal(raw: any): GoalId | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const ok: GoalId[] = ["strength", "hypertrophy", "general_fitness", "rehab", "sport_performance"];
  return (ok as string[]).includes(s) ? (s as GoalId) : null;
}

function resolvePainFlags(c: any): { hasActivePain: boolean; sites: Set<string>; avoidTags: Set<string> } {
  const pain = (c && typeof c === "object" ? c.pain_probe_state : null) ?? null;
  const hasActivePain = !!(pain && typeof pain === "object" && (pain as any).has_active_pain === true);

  const sites = toSet(asStringArray(pain?.active_pain_sites));
  const avoidTags = toSet(asStringArray(c?.avoid_joint_stress_tags));

  return { hasActivePain, sites, avoidTags };
}

/**
 * Deterministic intent selection rules (v0.1):
 * - Equipment constraints can force substitutions.
 * - Timebox can cap number of planned items.
 * - Goal tweaks sets/reps deterministically (no randomness).
 * - Pain/avoid tags can remove or swap movements (knee/hinge/squat obvious cases).
 */
function planWithConstraints(baseIntent: string[], phase3: Phase3Output): { intent: string[]; notes: string[] } {
  const notes: string[] = [];

  const c: any = (phase3 && typeof phase3 === "object" ? (phase3 as any).constraints : undefined) ?? undefined;

  const available = toSet(asStringArray(c?.available_equipment));
  const banned = toSet(asStringArray(c?.banned_equipment));
  const goal = resolveGoal(c?.goal_id);

  const schedule = c?.schedule ?? null;
  const tb = timeboxBucket(schedule?.session_timebox_minutes);

  const { hasActivePain, sites, avoidTags } = resolvePainFlags(c);

  const haveEquipmentEnvelope = available.size > 0 || banned.size > 0;

  const isBanned = (token: string) => banned.has(token.toLowerCase());
  const isAvailable = (token: string) => available.has(token.toLowerCase());

  // Minimal equipment predicates (coarse, deterministic)
  const canBarbell = () => {
    if (!haveEquipmentEnvelope) return true;
    if (isBanned("barbell")) return false;
    // If available is set, require barbell in it
    if (available.size > 0 && !isAvailable("barbell")) return false;
    return true;
  };

  const canRack = () => {
    if (!haveEquipmentEnvelope) return true;
    if (hasAny(banned, ["rack", "power_rack", "squat_rack"])) return false;
    if (available.size > 0 && !hasAny(available, ["rack", "power_rack", "squat_rack"])) return false;
    return true;
  };

  const canBench = () => {
    if (!haveEquipmentEnvelope) return true;
    if (hasAny(banned, ["bench_press_bench", "bench"])) return false;
    if (available.size > 0 && !hasAny(available, ["bench_press_bench", "bench", "adjustable_bench"])) return false;
    return true;
  };

  const canDumbbell = () => {
    if (!haveEquipmentEnvelope) return true;
    if (isBanned("dumbbell")) return false;
    if (available.size > 0 && !isAvailable("dumbbell")) return false;
    return true;
  };

  const canKettlebell = () => {
    if (!haveEquipmentEnvelope) return true;
    if (isBanned("kettlebell")) return false;
    if (available.size > 0 && !isAvailable("kettlebell")) return false;
    return true;
  };

  const canMachinePress = () => {
    if (!haveEquipmentEnvelope) return true;
    if (hasAny(banned, ["machine_chest_press"])) return false;
    // If the gym declares availability, require an explicit machine token or a generic "machine"
    if (available.size > 0 && !hasAny(available, ["machine_chest_press", "machine", "plate_loaded_machine"])) return false;
    return true;
  };

  // 1) Start from base intent
  let intent = [...baseIntent];

  // 2) Equipment-driven substitutions (deterministic)
  // bench_press -> dumbbell_bench_press OR machine_chest_press
  if (intent.includes("bench_press")) {
    const barbellBenchOK = canBarbell() && canBench();
    if (!barbellBenchOK) {
      if (canDumbbell()) {
        intent = intent.map((x) => (x === "bench_press" ? "dumbbell_bench_press" : x));
        notes.push("PHASE_4: bench_press -> dumbbell_bench_press (equipment constraint)");
      } else if (canMachinePress()) {
        intent = intent.map((x) => (x === "bench_press" ? "machine_chest_press" : x));
        notes.push("PHASE_4: bench_press -> machine_chest_press (equipment constraint)");
      } else {
        intent = intent.filter((x) => x !== "bench_press");
        notes.push("PHASE_4: removed bench_press (no viable equipment substitute)");
      }
    }
  }

  // back_squat -> goblet_squat OR (if no squat option) remove
  if (intent.includes("back_squat")) {
    const barbellSquatOK = canBarbell() && canRack();
    if (!barbellSquatOK) {
      if (canDumbbell()) {
        intent = intent.map((x) => (x === "back_squat" ? "goblet_squat" : x));
        notes.push("PHASE_4: back_squat -> goblet_squat (equipment constraint)");
      } else {
        intent = intent.filter((x) => x !== "back_squat");
        notes.push("PHASE_4: removed back_squat (no viable equipment substitute)");
      }
    }
  }

  // deadlift -> kettlebell_deadlift OR remove
  if (intent.includes("deadlift")) {
    const barbellDL = canBarbell();
    if (!barbellDL) {
      if (canKettlebell()) {
        intent = intent.map((x) => (x === "deadlift" ? "kettlebell_deadlift" : x));
        notes.push("PHASE_4: deadlift -> kettlebell_deadlift (equipment constraint)");
      } else {
        intent = intent.filter((x) => x !== "deadlift");
        notes.push("PHASE_4: removed deadlift (no viable equipment substitute)");
      }
    }
  }

  // 3) Pain / avoid tags (very coarse, deterministic)
  // If knee pain or knee_flexion avoid tag, remove squat-pattern if present.
  const kneeSensitive = (hasActivePain && hasAny(sites, ["knee", "knees"])) || hasAny(avoidTags, ["knee_flexion", "knee_stress"]);
  if (kneeSensitive) {
    const before = [...intent];
    intent = intent.filter((x) => !["back_squat", "goblet_squat"].includes(x));
    if (before.length !== intent.length) notes.push("PHASE_4: removed squat pattern (knee pain/avoid tag)");
    // If we removed a main lift, try to add a hinge substitute deterministically (if not already present)
    if (!intent.includes("deadlift") && !intent.includes("kettlebell_deadlift")) {
      if (canBarbell()) {
        intent.push("deadlift");
        notes.push("PHASE_4: added deadlift as squat replacement (knee sensitive)");
      } else if (canKettlebell()) {
        intent.push("kettlebell_deadlift");
        notes.push("PHASE_4: added kettlebell_deadlift as squat replacement (knee sensitive)");
      }
    }
  }

  // 4) Timebox cap (deterministic)
  // tiny: 1 lift, short: 2 lifts, normal: keep (but v0 plans are small anyway).
  intent = uniqueStable(intent);

  if (tb === "tiny") {
    intent = intent.slice(0, 1);
    notes.push("PHASE_4: timebox tiny -> cap intent to 1 exercise");
  } else if (tb === "short") {
    intent = intent.slice(0, 2);
    notes.push("PHASE_4: timebox short -> cap intent to 2 exercises");
  }

  // 5) Goal shaping is handled later (sets/reps), but we note it here for traceability.
  if (goal) notes.push(`PHASE_4: goal_id=${goal}`);

  return { intent, notes };
}

function setsRepsForGoal(goal: GoalId | null): { sets: number; reps: number } {
  // Deterministic defaults (no randomness)
  if (goal === "hypertrophy") return { sets: 4, reps: 8 };
  if (goal === "rehab") return { sets: 2, reps: 10 };
  if (goal === "general_fitness") return { sets: 3, reps: 10 };
  if (goal === "sport_performance") return { sets: 3, reps: 6 };
  // strength or null
  return { sets: 3, reps: 5 };
}

export function phase4AssembleProgram(canonicalInput: any, phase3: Phase3Output): Phase4Result {
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
   *
   * v0.1 extension:
   * - Intent is constraint-aware (equipment, timebox, pain/avoid, goal shaping).
   */

  let program_id: string;
  let baseIntent: string[];

  switch (activity) {
    case "powerlifting":
      program_id = "PROGRAM_POWERLIFTING_V0";
      baseIntent = ["bench_press", "back_squat"];
      break;

    case "rugby_union":
      program_id = "PROGRAM_RUGBY_UNION_V0";
      baseIntent = ["back_squat", "bench_press"];
      break;

    case "general_strength":
      program_id = "PROGRAM_GENERAL_STRENGTH_V0";
      baseIntent = ["deadlift", "bench_press"];
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

  const c: any = (phase3 && typeof phase3 === "object" ? (phase3 as any).constraints : undefined) ?? undefined;
  const goal = resolveGoal(c?.goal_id);
  const { sets, reps } = setsRepsForGoal(goal);

  const planned = planWithConstraints(baseIntent, phase3);
  const planned_exercise_ids = uniqueStable(planned.intent);

  // Planned items are authoritative plan surface (rich path used by Phase6)
  const planned_items: PlannedItem[] = planned_exercise_ids.map((exercise_id, i) => ({
    block_id: "B0",
    item_id: `B0_I${i}`,
    exercise_id,
    sets,
    reps
  }));

  // Deterministic exercise_pool: include plan + deterministic candidate set for substitution tests.
  const poolIds = uniqueStable([
    ...planned_exercise_ids,

    // Deterministic substitutes used by constraint rules
    "dumbbell_bench_press",
    "machine_chest_press",
    "goblet_squat",
    "kettlebell_deadlift",

    // Keep legacy candidates for tests
    "bench_press",
    "back_squat",
    "deadlift"
  ]);

  const exercise_pool: Record<string, ExerciseSignature> = {};
  for (const id of poolIds) {
    if (entries[id]) exercise_pool[id] = pick(entries, id);
  }

  const exercises = Object.values(exercise_pool).sort((a, b) => a.exercise_id.localeCompare(b.exercise_id));

  // Deterministic target: first planned id (Phase5 will substitute only if disqualified)
  const target_exercise_id = planned_exercise_ids[0] ?? "";

  const notes = uniqueStable([
    "PHASE_4_V0: multi-exercise intent emitted",
    ...planned.notes
  ]);

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
    notes
  };
}
