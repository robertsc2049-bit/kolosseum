// DEV NOTE: Engine-side implementation surface. Keep this code deterministic, closed-world, and
// free of product/UI/coach-note influence. Engine truth must come from explicit inputs,
// canonical registries, and validated contracts only.

// Exercise slots: a programme names only the exercises it must (competition
// lifts, and the movements of a timed group - the workout itself); every
// other item is an open slot with a purpose (its movement pattern and
// whether it is explosive work) that the athlete or coach fills with an
// exercise of their choice. The engine never picks one for them: when a
// caller declares its choices, a slot left empty fails the session. It
// recommends exercises that fit the slot, but never locks any out: any
// exercise in the registry may be chosen, and a choice outside the
// recommendations is reported with the reason it is not one. The athlete may
// also choose their own exercise ("custom_<name>"), which the engine treats
// as training the slot's movement, and may choose the same exercise more than
// once in a session: each repeat is tracked as its own entry ("<id>__r2").

import type { Phase4ItemPrescription, Phase4MicrocycleDay } from "./types.js";

export type SlotExercise = {
  exercise_id?: string;
  movement_pattern_id?: string;
  pattern?: string;
  difficulty_tier?: string;
  fast_execution?: boolean;
  joint_stress_tags?: string[];
  equipment_requirements?: string[];
  equipment_ids?: string[];
};

export type SlotConstraints = {
  avoid_joint_stress_tags?: string[];
  banned_equipment?: string[];
  available_equipment?: string[];
};

export type SlotContext = {
  activity: string;
  level: string | undefined;
  exercises: Record<string, SlotExercise>;
  // "<exercise>__<activity>__training" -> applicability row
  applicability: Record<string, { applicability_state?: string }>;
  constraints?: SlotConstraints;
};

export type ExerciseSelections = Record<string, string>;

// The athlete's own exercise: any id under this prefix (none is in the registry).
export const CUSTOM_EXERCISE_PREFIX = "custom_";
export const isCustomExerciseId = (id: string) => id.startsWith(CUSTOM_EXERCISE_PREFIX) && id.length > CUSTOM_EXERCISE_PREFIX.length;
// A repeat of an exercise already in the session: "<id>__r<n>" (n >= 2).
const REPEAT = /^(.+)__r([2-9]|[1-9][0-9])$/;
export function repeatOf(id: string): { base: string; n: number } | null {
  const m = REPEAT.exec(id);
  return m ? { base: m[1], n: Number(m[2]) } : null;
}
// The exercise a session entry is (a repeat is its base exercise).
export const baseExerciseId = (id: string) => repeatOf(id)?.base ?? id;

// Reactive plyometrics need landing competence first (as for the level rules).
const BEGINNER_EXCLUDED = new Set(["pogo_jump", "depth_jump", "repeated_broad_jump", "lateral_bound", "box_jump"]);

const patternOf = (ex: SlotExercise | undefined) => (ex?.movement_pattern_id ?? ex?.pattern ?? "") || "";
// Ballistic lifts the registry does not flag as fast-execution still count
// as explosive work: a heavy hinge slot must never offer a kettlebell swing.
const BALLISTIC = new Set(["kettlebell_swing"]);
const isFast = (ex: SlotExercise | undefined) => ex?.fast_execution === true || BALLISTIC.has(ex?.exercise_id ?? "");

// Open-slot identity: the day, the reference exercise's movement pattern and
// its ordinal among that day's open slots of the same pattern ("b.horizontal_pull_1").
// Fixed items (declared fixed, or members of a timed group) have no slot.
export function slotIdsForDay(
  dayId: string,
  intent: string[],
  prescriptions: Phase4ItemPrescription[] | undefined,
  exercises: Record<string, SlotExercise>
): (string | null)[] {
  const counts = new Map<string, number>();
  return intent.map((exerciseId, i) => {
    const p = prescriptions?.[i];
    if (p?.fixed === true || p?.group) return null;
    const pattern = patternOf(exercises[exerciseId]) || "exercise";
    const n = (counts.get(pattern) ?? 0) + 1;
    counts.set(pattern, n);
    return `${dayId}.${pattern}_${n}`;
  });
}

// What the engine recommends for a slot: the same movement pattern and the
// same kind of work (explosive vs strength) as the programme's reference
// exercise, training-allowed for the sport, suitable for the level (no
// advanced lifts or reactive plyometrics for beginners), and not excluded by
// a declared joint stress to avoid or by equipment that is banned or not
// available. Returns why a candidate is not recommended, or null when it is.
// A recommendation only - it never refuses a choice.
export function slotFitIssue(candidateId: string, referenceId: string, ctx: SlotContext): string | null {
  if (isCustomExerciseId(candidateId)) return "custom_exercise";
  const candidate = ctx.exercises[candidateId];
  const reference = ctx.exercises[referenceId];
  if (!candidate) return "unknown_exercise";
  if (patternOf(candidate) !== patternOf(reference)) return "movement_pattern_mismatch";
  if (isFast(candidate) !== isFast(reference)) return "work_type_mismatch";
  if (ctx.applicability[`${candidateId}__${ctx.activity}__training`]?.applicability_state !== "allowed") return "not_allowed_for_activity";
  if (ctx.level === "beginner" && (candidate.difficulty_tier === "advanced" || BEGINNER_EXCLUDED.has(candidateId))) return "above_athlete_level";
  const avoid = new Set(ctx.constraints?.avoid_joint_stress_tags ?? []);
  if ((candidate.joint_stress_tags ?? []).some((tag) => avoid.has(tag))) return "joint_stress_avoided";
  const equipment = candidate.equipment_requirements ?? candidate.equipment_ids ?? [];
  const banned = new Set(ctx.constraints?.banned_equipment ?? []);
  if (equipment.some((id) => banned.has(id))) return "equipment_banned";
  const available = ctx.constraints?.available_equipment;
  if (Array.isArray(available) && available.length > 0) {
    const have = new Set([...available, "bodyweight", "open_floor_space"]);
    if (equipment.some((id) => !have.has(id))) return "equipment_unavailable";
  }
  return null;
}

export function recommendedExercisesForSlot(referenceId: string, ctx: SlotContext): string[] {
  return Object.keys(ctx.exercises)
    .filter((id) => slotFitIssue(id, referenceId, ctx) === null)
    .sort();
}

export type SlotSelectionFailure =
  | { failure_token: "exercise_selection_required"; details: { missing_slot_ids: string[] } }
  | { failure_token: "exercise_selection_invalid"; details: { slot_id: string; exercise_id: string; reason: string } };

// Replace each open slot of the day with the athlete's choice. Fixed items keep
// their named exercise. Any known exercise or the athlete's own may be
// chosen, recommended or not, and the same exercise more than once (each
// repeat numbered: "back_squat__r2"). A missing choice or an exercise that
// does not exist fails the whole session - never a silent default.
export function applySelectionsToDay(
  dayId: string,
  intent: string[],
  prescriptions: Phase4ItemPrescription[] | undefined,
  selections: ExerciseSelections,
  ctx: SlotContext
): { ok: true; intent: string[]; exercises: Record<string, SlotExercise> } | ({ ok: false } & SlotSelectionFailure) {
  const slotIds = slotIdsForDay(dayId, intent, prescriptions, ctx.exercises);
  const missing = slotIds.filter((id): id is string => id !== null && !selections[id]);
  if (missing.length) return { ok: false, failure_token: "exercise_selection_required", details: { missing_slot_ids: missing } };
  const chosen = intent.map((referenceId, i) => {
    const slotId = slotIds[i];
    return slotId === null ? referenceId : selections[slotId];
  });
  for (let i = 0; i < intent.length; i++) {
    const slotId = slotIds[i];
    if (slotId === null) continue;
    if (!ctx.exercises[chosen[i]] && !isCustomExerciseId(chosen[i])) {
      return { ok: false, failure_token: "exercise_selection_invalid", details: { slot_id: slotId, exercise_id: chosen[i], reason: "unknown_exercise" } };
    }
  }
  // Session entries: the athlete's own exercises train the slot's movement;
  // a repeat is its own entry with the same signature as the exercise.
  const exercises: Record<string, SlotExercise> = {};
  const seen = new Map<string, number>();
  const entries = chosen.map((id, i) => {
    const n = (seen.get(id) ?? 0) + 1;
    seen.set(id, n);
    const base: SlotExercise = ctx.exercises[id] ?? { exercise_id: id, movement_pattern_id: patternOf(ctx.exercises[intent[i]]) || undefined, pattern: patternOf(ctx.exercises[intent[i]]) || undefined, equipment_ids: [], joint_stress_tags: [] };
    const entryId = n === 1 ? id : `${id}__r${n}`;
    if (!ctx.exercises[entryId]) exercises[entryId] = { ...base, exercise_id: entryId };
    return entryId;
  });
  return { ok: true, intent: entries, exercises };
}

export type SlotListing = {
  day_id: string;
  focus: string;
  items: Array<
    | { kind: "fixed"; exercise_id: string; prescription: Phase4ItemPrescription | null }
    | { kind: "slot"; slot_id: string; movement_pattern_id: string; explosive: boolean; prescription: Phase4ItemPrescription | null;
        recommended_exercise_ids: string[];
        // With choices given: the slot's choice and why it is not recommended (null when it is).
        selected_exercise_id?: string | null; selected_fit_issue?: string | null }
  >;
};

// Every day of the athlete's programme with its fixed items and open slots
// (and what the engine recommends for each), for choosing exercises before
// training. With the athlete's choices, each slot also says whether its
// choice is a recommended one.
export function listProgrammeSlots(
  days: Array<Pick<Phase4MicrocycleDay, "day_id" | "focus" | "exercise_eligibility" | "item_prescriptions">>,
  ctx: SlotContext,
  selections?: ExerciseSelections
): SlotListing[] {
  return days.map((day) => {
    const slotIds = slotIdsForDay(day.day_id, day.exercise_eligibility, day.item_prescriptions, ctx.exercises);
    return {
      day_id: day.day_id,
      focus: day.focus,
      items: day.exercise_eligibility.map((referenceId, i) => {
        const prescription = day.item_prescriptions?.[i] ?? null;
        const slotId = slotIds[i];
        if (slotId === null) return { kind: "fixed" as const, exercise_id: referenceId, prescription };
        const reference = ctx.exercises[referenceId];
        return {
          kind: "slot" as const,
          slot_id: slotId,
          movement_pattern_id: patternOf(reference),
          explosive: isFast(reference),
          prescription,
          recommended_exercise_ids: recommendedExercisesForSlot(referenceId, ctx),
          ...(selections ? selectionFit(selections[slotId], referenceId, ctx) : {})
        };
      })
    };
  });
}

function selectionFit(choice: string | undefined, referenceId: string, ctx: SlotContext) {
  if (typeof choice !== "string" || (!ctx.exercises[choice] && !isCustomExerciseId(choice))) return { selected_exercise_id: null, selected_fit_issue: null };
  return { selected_exercise_id: choice, selected_fit_issue: slotFitIssue(choice, referenceId, ctx) };
}
