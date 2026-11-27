// Quick build for people who aren't training for a sport (general_strength):
// besides "Get stronger", three goals with their own programme shape, laid
// over the engine's general sessions (the same full-body / upper / lower
// exercise picks, within the equipment):
// - Build muscle: more sets in the 6-12 rep range, blocks alternating
//   higher reps and heavier, short-ish rests on the accessories.
// - General fitness: moderate strength work and a conditioning piece every
//   session - intervals one day, steady work the next.
// - Lose fat: strength work kept fairly heavy (to hold on to muscle) and more
//   conditioning. Training only: the app gives no diet advice and promises
//   no result (see the goal's summary).
// Weeks 1-3 build and week 4 is a deload, as in every quick build. Beginners
// stay at or below RPE 7 and are never given % of max. Pure functions, so
// they're tested without a database.

type Json = Record<string, unknown>;

export type GeneralShape = "muscle" | "fitness" | "fat_loss";

export type GeneralSessionContext = Readonly<{
  shape: GeneralShape;
  blockIndex: number;
  week: number;
  sessionIndex: number;
  level: string;
  weights: string;
  equipment: string;
  // Lifts a % of max makes sense for (barbell and trap-bar lifts); the rest -
  // goblet squats, push-ups, lunges - go by effort even when % was chosen.
  percentLift?: (exerciseId: string) => boolean;
}>;

const BLOCK_LABEL: Record<GeneralShape, (blockIndex: number) => string> = {
  muscle: (blockIndex) => (blockIndex % 2 === 1 ? "Muscle - heavier" : "Muscle - higher reps"),
  fitness: () => "Fitness",
  fat_loss: () => "Strength and conditioning"
};

export function generalBlockLabel(shape: GeneralShape, blockIndex: number): string {
  return BLOCK_LABEL[shape](blockIndex);
}

// The conditioning added to each session, by equipment: a gym has cardio
// machines; at home or with no kit it's bodyweight intervals and a brisk walk.
const CONDITIONING = {
  full_gym: { intervals: "rowing_ergometer", beginnerIntervals: "rowing_ergometer", steady: "bike_ergometer" },
  home_gym: { intervals: "burpee", beginnerIntervals: "jumping_jack", steady: "brisk_walk" },
  bodyweight: { intervals: "burpee", beginnerIntervals: "jumping_jack", steady: "brisk_walk" }
} as const;

export const CONDITIONING_EXERCISE_IDS: ReadonlySet<string> = new Set(
  Object.values(CONDITIONING).flatMap((kit) => [kit.intervals, kit.beginnerIntervals, kit.steady])
);

// Weeks 1-4: introduce, build, hardest, deload.
const weekly = (values: readonly number[], week: number) => values[Math.min(Math.max(week, 1), 4) - 1];

// The % of max that leaves (10 - RPE) reps in reserve at the top of a rep
// range, from the Epley estimate (reps to failure = 30 x (100/% - 1)) - the
// inverse of rpeForPercent in kolosseum_starter_template_service.ts - rounded
// down to 2.5.
export function percentForRpe(rpe: number, reps: number): number {
  const repsToFailure = reps + (10 - rpe);
  const percent = 100 / (1 + repsToFailure / 30);
  return Math.min(85, Math.floor(percent / 2.5) * 2.5);
}

type Dose = { sets: number; deloadSets: number; repMin: number; repMax: number; rpe: readonly number[]; rest: number };

function doses(shape: GeneralShape, blockIndex: number): { primary: Dose; accessory: Dose } {
  if (shape === "muscle") {
    const heavier = blockIndex % 2 === 1;
    return {
      primary: { sets: 4, deloadSets: 2, repMin: heavier ? 6 : 8, repMax: heavier ? 8 : 12, rpe: [7, 8, 8, 6], rest: heavier ? 150 : 120 },
      accessory: { sets: 3, deloadSets: 2, repMin: heavier ? 8 : 10, repMax: heavier ? 12 : 15, rpe: [7, 8, 8, 6], rest: 75 }
    };
  }
  if (shape === "fat_loss") {
    return {
      primary: { sets: 3, deloadSets: 2, repMin: 6, repMax: 10, rpe: [7, 8, 8, 6], rest: 90 },
      accessory: { sets: 2, deloadSets: 1, repMin: 10, repMax: 15, rpe: [7, 7, 8, 6], rest: 45 }
    };
  }
  return {
    primary: { sets: 3, deloadSets: 2, repMin: 8, repMax: 10, rpe: [6, 7, 7, 5], rest: 90 },
    accessory: { sets: 2, deloadSets: 1, repMin: 12, repMax: 15, rpe: [7, 7, 7, 5], rest: 45 }
  };
}

function strengthItem(item: Json, ctx: GeneralSessionContext): Json {
  const dose = item.role === "primary" ? doses(ctx.shape, ctx.blockIndex).primary : doses(ctx.shape, ctx.blockIndex).accessory;
  const beginner = ctx.level === "beginner";
  const sets = ctx.week === 4 ? dose.deloadSets : beginner ? Math.min(dose.sets, 3) : dose.sets;
  // Holds and carries keep their time or distance; only their sets change.
  if (item.prescription_mode !== "reps") return { ...item, planned_sets: sets };
  const rpe = Math.min(beginner ? 7 : 9, weekly(dose.rpe, ctx.week));
  const reps = { rep_mode: "range", planned_reps: dose.repMin, rep_min: dose.repMin, rep_max: dose.repMax };
  const shaped = { ...item, ...reps, planned_sets: sets, rest_seconds: dose.rest };
  if (item.load_mode === "bodyweight") return shaped;
  // Main barbell lifts by % of max only when the coach chose it and the
  // athlete isn't a beginner; everything else is by effort.
  if (item.role === "primary" && ctx.weights === "percent_1rm" && !beginner && ctx.percentLift?.(String(item.exercise_id))) {
    return { ...shaped, load_mode: "percent_1rm", percent_1rm: percentForRpe(rpe, dose.repMax) };
  }
  return { ...shaped, load_mode: "rpe", rpe_value: rpe };
}

function conditioningItem(exerciseId: string, sets: number, seconds: number, rest: number, rpe: number): Json {
  return {
    work_item_id: "",
    order_index: 0,
    exercise_id: exerciseId,
    planned_sets: sets,
    prescription_mode: "duration",
    rep_mode: "fixed",
    planned_reps: 1,
    rep_min: 1,
    rep_max: 1,
    tempo: "",
    duration_mode: "fixed",
    planned_duration_seconds: seconds,
    duration_min_seconds: seconds,
    duration_max_seconds: seconds,
    distance_mode: "fixed",
    distance_unit: "meters",
    planned_distance_value: 20,
    distance_min_value: 20,
    distance_max_value: 20,
    load_mode: "rpe",
    percent_1rm: 70,
    weight_value: 20,
    weight_unit: "kg",
    rpe_value: rpe,
    borg_value: 13,
    cr10_value: 5,
    rest_seconds: rest,
    role: "accessory",
    coaching_notes: "",
    segment: "working",
    group_id: "",
    group_type: "straight",
    group_time_cap_seconds: 0,
    group_round_seconds: 0,
    group_total_rounds: 0
  };
}

// Intervals on the first training day of the week and every other day after
// it, steady work on the days between.
function conditioning(ctx: GeneralSessionContext): Json {
  const beginner = ctx.level === "beginner";
  const kit = CONDITIONING[ctx.equipment as keyof typeof CONDITIONING] ?? CONDITIONING.full_gym;
  const more = ctx.shape === "fat_loss";
  if (ctx.sessionIndex % 2 === 0) {
    const rounds = weekly(beginner ? (more ? [6, 8, 10, 4] : [4, 6, 8, 3]) : more ? [8, 10, 12, 5] : [6, 8, 10, 4], ctx.week);
    const rpe = Math.min(beginner ? 7 : 9, weekly([7, 8, 8, 6], ctx.week));
    return conditioningItem(beginner ? kit.beginnerIntervals : kit.intervals, rounds, 30, beginner ? 90 : 60, rpe);
  }
  const minutes = weekly(beginner ? (more ? [12, 15, 18, 10] : [10, 12, 15, 8]) : more ? [20, 25, 30, 15] : [12, 15, 18, 10], ctx.week);
  return conditioningItem(kit.steady, 1, minutes * 60, 60, weekly([5, 5, 6, 4], ctx.week));
}

export function shapeGeneralSession(items: readonly Json[], ctx: GeneralSessionContext): Json[] {
  const shaped = items.map((item) => strengthItem(item, ctx));
  if (ctx.shape !== "muscle") shaped.push(conditioning(ctx));
  return shaped.map((item, index) => ({ ...item, order_index: index + 1 }));
}
