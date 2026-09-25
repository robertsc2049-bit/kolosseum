// DEV NOTE: Engine-side implementation surface. Keep this code deterministic, closed-world, and
// free of product/UI/coach-note influence. Engine truth must come from explicit inputs,
// canonical registries, and validated contracts only.

// Periodisation: where an athlete is in their year (macrocycle phase), in their
// 4-week block (mesocycle week) and in their week (microcycle session slot).
// The engine never reads a clock - the caller declares the position explicitly
// and the engine turns it into a session deterministically.

import type { Phase4ItemPrescription, PlannedItemIntensity } from "./types.js";

// How each sport's year is organised.
// - season: a fixture season (team sports, tennis) - build in the off-season,
//   sharpen in pre-season, maintain in-season, recover in transition.
// - meet: strength sports peaking for a meet (general strength cycles
//   accumulation/intensification with no meet).
// - event: a dated race, competition or fight (endurance, hybrid, combat).
export type CycleModel = "season" | "meet" | "event";

export const MACRO_PHASES_BY_MODEL: Readonly<Record<CycleModel, readonly string[]>> = Object.freeze({
  season: Object.freeze(["off_season", "pre_season", "in_season", "transition"]),
  meet: Object.freeze(["accumulation", "intensification", "peak", "transition"]),
  event: Object.freeze(["base", "build", "specific", "taper", "transition"])
});

export const ALL_MACRO_PHASES: readonly string[] = Object.freeze(
  [...new Set(Object.values(MACRO_PHASES_BY_MODEL).flat())]
);

const MODEL_BY_ACTIVITY: Readonly<Record<string, CycleModel>> = Object.freeze({
  powerlifting: "meet",
  olympic_weightlifting: "meet",
  strongman: "meet",
  street_lifting: "meet",
  general_strength: "meet",
  hyrox: "event",
  crossfit: "event",
  athletics: "event",
  swimming: "event",
  cycling: "event",
  rowing: "event",
  kayaking: "event",
  triathlon: "event",
  boxing: "event",
  muay_thai: "event",
  mma: "event",
  wrestling: "event",
  judo: "event",
  brazilian_jiu_jitsu: "event",
  rugby_union: "season",
  rugby_league: "season",
  rugby_sevens: "season",
  american_football: "season",
  ice_hockey: "season",
  football_soccer: "season",
  basketball: "season",
  netball: "season",
  volleyball: "season",
  field_hockey: "season",
  cricket: "season",
  tennis: "season"
});

export function cycleModelFor(activity: string): CycleModel | undefined {
  return MODEL_BY_ACTIVITY[activity];
}

export type TrainingCycle = {
  macro_phase: string;
  meso_week: number;
  days_per_week: number;
  session_slot: number;
};

// Structural and activity checks for a declared cycle. Returns a reason or null.
export function trainingCycleProblem(activity: string, cycle: TrainingCycle): string | null {
  const model = cycleModelFor(activity);
  if (!model) return `activity ${activity} has no cycle model`;
  if (!MACRO_PHASES_BY_MODEL[model].includes(cycle.macro_phase)) {
    return `macro_phase ${cycle.macro_phase} is not a ${model} phase (${MACRO_PHASES_BY_MODEL[model].join(", ")})`;
  }
  if (cycle.session_slot >= cycle.days_per_week) return "session_slot must be below days_per_week";
  return null;
}

// Strength sessions a week the phase supports, whatever the athlete has free:
// in-season and taper keep strength to maintenance, transition is recovery,
// and a peak keeps the competition lifts sharp without extra fatigue.
export function sessionsPerWeek(macroPhase: string, daysPerWeek: number): number {
  if (macroPhase === "in_season" || macroPhase === "taper" || macroPhase === "transition") return Math.min(daysPerWeek, 2);
  if (macroPhase === "peak") return Math.min(daysPerWeek, 3);
  return daysPerWeek;
}

const PRIMARY_COUNT = 4;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const round1 = (x: number) => Math.round(x * 10) / 10;

function shiftIntensity(intensity: PlannedItemIntensity, percent: number, rpe: number): PlannedItemIntensity {
  if (intensity.type === "percent_1rm") return { type: "percent_1rm", value: round1(clamp(intensity.value + percent, 40, 95)) };
  if (intensity.type === "rpe") return { type: "rpe", value: clamp(intensity.value + rpe, 5, 10) };
  return { ...intensity } as PlannedItemIntensity;
}

// Distance- and time-dosed items keep one rep per length or hold.
const repsLocked = (p: Phase4ItemPrescription) => p.distance_m !== undefined || p.duration_seconds !== undefined;

// Macrocycle phase: turns the authored (build/pre-season/intensification)
// session into that phase's version. Timed groups are never altered - their
// structure is the workout.
function applyPhase(p: Phase4ItemPrescription, i: number, phase: string): Phase4ItemPrescription {
  if (p.group) return p;
  const q: Phase4ItemPrescription = { ...p, intensity: { ...p.intensity } as PlannedItemIntensity };
  const primary = i < PRIMARY_COUNT;
  switch (phase) {
    // General preparation: more sets and reps at slightly lower loads.
    case "off_season":
    case "accumulation":
    case "base":
      q.sets = Math.min(primary ? 6 : 4, q.sets + 1);
      if (!repsLocked(q) && q.reps >= 2 && q.reps <= 6) q.reps += 2;
      q.intensity = shiftIntensity(q.intensity, -5, 0);
      return q;
    // Competition-specific: heavier, fewer reps on the primaries, less accessory work.
    case "peak":
    case "specific":
      if (primary) {
        if (!repsLocked(q) && q.reps >= 2 && q.reps <= 6) q.reps -= 1;
        q.intensity = shiftIntensity(q.intensity, 5, 1);
      }
      else q.sets = Math.max(2, q.sets - 1);
      return q;
    // Maintain strength around fixtures: intensity held, volume down.
    case "in_season":
      q.sets = Math.max(2, q.sets - 1);
      return q;
    // Taper: roughly half the volume, intensity held, so the athlete arrives fresh.
    case "taper":
      q.sets = Math.max(2, Math.ceil(q.sets / 2));
      return q;
    // Transition: active recovery - two easy sets by effort, no % 1RM.
    case "transition":
      q.sets = 2;
      q.intensity = q.intensity.type === "percent_1rm" || q.intensity.type === "rpe" ? { type: "rpe", value: 6 } : q.intensity;
      return q;
    default:
      return q;
  }
}

// Mesocycle week: 3 loading weeks (introduce, build, overreach) then a deload.
// Not applied in taper or transition, which already set their own load.
function applyMesoWeek(p: Phase4ItemPrescription, week: number): Phase4ItemPrescription {
  if (p.group) return p;
  const q: Phase4ItemPrescription = { ...p, intensity: { ...p.intensity } as PlannedItemIntensity };
  if (week === 1) q.intensity = shiftIntensity(q.intensity, -5, -1);
  else if (week === 3) q.intensity = shiftIntensity(q.intensity, 2.5, 1);
  else if (week === 4) {
    q.sets = Math.max(1, Math.round(q.sets * 0.6));
    q.intensity = shiftIntensity(q.intensity, -10, -2);
  }
  return q;
}

// Level ceilings survive every phase and week: beginners stay at or below
// RPE 7 and never get % 1RM work (no tested max); nobody exceeds RPE 9.
function applyLevelCeiling(p: Phase4ItemPrescription, level: string | undefined): Phase4ItemPrescription {
  const q: Phase4ItemPrescription = { ...p, intensity: { ...p.intensity } as PlannedItemIntensity };
  if (q.intensity.type === "rpe") q.intensity = { type: "rpe", value: Math.min(level === "beginner" ? 7 : 9, q.intensity.value) };
  if (level === "beginner" && q.intensity.type === "percent_1rm") q.intensity = { type: "rpe", value: 6 };
  return q;
}

export function periodisePrescriptions(
  prescriptions: Phase4ItemPrescription[],
  cycle: TrainingCycle,
  level: string | undefined
): Phase4ItemPrescription[] {
  const meso = cycle.macro_phase !== "taper" && cycle.macro_phase !== "transition";
  return prescriptions.map((p, i) => {
    let q = applyPhase(p, i, cycle.macro_phase);
    if (meso) q = applyMesoWeek(q, cycle.meso_week);
    return applyLevelCeiling(q, level);
  });
}

// The session output's record of where this session sits in the plan.
export type TrainingCycleOutput = TrainingCycle & {
  cycle_model: CycleModel;
  sessions_per_week: number;
  day_index: number;
  day_focus: string;
  deload: boolean;
};
