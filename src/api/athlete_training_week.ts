// DEV NOTE: The rules of a self-coached athlete's own training week
// (athlete_training_week_service.ts holds and serves it): which exercises they
// can choose, what a valid week is, which day and week a session falls on, and
// that day's session as the engine's planned items. Pure apart from reading
// the registries.

import fs from "node:fs";
import path from "node:path";

type Json = Record<string, unknown>;
const isRecord = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export const MAX_DAYS = 6;
export const MAX_EXERCISES_A_DAY = 10;

export class TrainingWeekError extends Error {
  constructor(public readonly code: string, public readonly status: number, public readonly fieldErrors?: Json) {
    super(code);
  }
}

export type WeekItem = { exercise_id: string; sets: number; reps: number };
export type TrainingWeek = { week_id: string; days: { items: WeekItem[] }[]; lighter_every_fourth: boolean; saved_at: string };
export type OwnTrainingStamp = { week_id: string; day_number: number; days_total: number; week_number: number; lighter: boolean };

// Exercises an athlete can choose: those the registry allows in training for
// their sport (any sport's general strength list when none is declared).
let applicability: Map<string, Set<string>> | null = null;
let exercises: Map<string, Json> | null = null;
function registries() {
  if (!exercises || !applicability) {
    const ex = JSON.parse(fs.readFileSync(path.join(process.cwd(), "registries", "exercise", "exercise.registry.json"), "utf8"));
    exercises = new Map(Object.values(isRecord(ex?.entries) ? ex.entries : {}).filter(isRecord).map((e) => [text(e.exercise_id), e]));
    const ap = JSON.parse(fs.readFileSync(path.join(process.cwd(), "registries", "exercise_activity_applicability", "exercise_activity_applicability.registry.json"), "utf8"));
    applicability = new Map();
    for (const row of Object.values(isRecord(ap?.entries) ? ap.entries : {}).filter(isRecord)) {
      if (row.activity_context !== "training" || row.applicability_state !== "allowed") continue;
      const activity = text(row.activity_id);
      if (!applicability.has(activity)) applicability.set(activity, new Set());
      applicability.get(activity)!.add(text(row.exercise_id));
    }
  }
  return { exercises: exercises!, applicability: applicability! };
}

export function exerciseOptionsFor(activityId: string | undefined): { exercise_id: string; label: string; pattern: string }[] {
  const { exercises: ex, applicability: ap } = registries();
  const allowed = ap.get(activityId ?? "") ?? ap.get("general_strength") ?? new Set<string>();
  return [...allowed]
    .map((id) => ex.get(id))
    .filter((e): e is Json => !!e)
    .map((e) => ({ exercise_id: text(e.exercise_id), label: text(e.display_label) || text(e.exercise_id), pattern: text(e.movement_pattern_id) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function validateTrainingWeek(input: unknown, activityId: string | undefined): Omit<TrainingWeek, "week_id" | "saved_at"> {
  const errors: Json = {};
  if (!isRecord(input) || !Array.isArray(input.days)) throw new TrainingWeekError("training_week_invalid", 422, { days: "Add your training days." });
  const allowed = new Set(exerciseOptionsFor(activityId).map((o) => o.exercise_id));
  if (input.days.length < 1 || input.days.length > MAX_DAYS) errors.days = `Choose 1 to ${MAX_DAYS} training days.`;
  const days = input.days.slice(0, MAX_DAYS).map((rawDay, d) => {
    const items = isRecord(rawDay) && Array.isArray(rawDay.items) ? rawDay.items : [];
    if (items.length < 1) errors[`day_${d + 1}`] = `Add at least one exercise to day ${d + 1}.`;
    if (items.length > MAX_EXERCISES_A_DAY) errors[`day_${d + 1}`] = `Day ${d + 1}: at most ${MAX_EXERCISES_A_DAY} exercises.`;
    const seen = new Set<string>();
    return {
      items: items.slice(0, MAX_EXERCISES_A_DAY).map((raw, i) => {
        const item = isRecord(raw) ? raw : {};
        const id = text(item.exercise_id);
        const sets = Number(item.sets);
        const reps = Number(item.reps);
        const where = `day_${d + 1}_${i + 1}`;
        if (!allowed.has(id)) errors[where] = "Choose an exercise from the list.";
        else if (seen.has(id)) errors[where] = "This exercise is already in this day.";
        seen.add(id);
        if (!Number.isInteger(sets) || sets < 1 || sets > 8) errors[`${where}_sets`] = "Choose 1 to 8 sets.";
        if (!Number.isInteger(reps) || reps < 1 || reps > 30) errors[`${where}_reps`] = "Choose 1 to 30 reps.";
        return { exercise_id: id, sets, reps };
      })
    };
  });
  if (Object.keys(errors).length) throw new TrainingWeekError("training_week_invalid", 422, errors);
  return { days, lighter_every_fourth: isRecord(input) && input.lighter_every_fourth === true };
}

// Where a session falls: which day of the week, which week, and whether it's
// the lighter 4th week.
export function ownTrainingStamp(week: TrainingWeek, index: number): OwnTrainingStamp {
  const daysTotal = week.days.length;
  const weekNumber = Math.floor(index / daysTotal) + 1;
  return { week_id: week.week_id, day_number: (index % daysTotal) + 1, days_total: daysTotal, week_number: weekNumber, lighter: week.lighter_every_fourth && weekNumber % 4 === 0 };
}

// Today's session as the engine's planned items: each exercise an effort
// target (RPE 8) that the athlete's own way of setting weights turns into a
// weight, a progression or an effort; a set off everything in a lighter week.
export function ownTrainingProgram(baseProgram: Json, week: TrainingWeek, stamp: OwnTrainingStamp): Json {
  const { exercises: ex } = registries();
  const day = week.days[stamp.day_number - 1];
  const sessionId = `${week.week_id}_w${stamp.week_number}_d${stamp.day_number}`;
  const items = day.items.map((item, i) => ({
    block_id: `${week.week_id}_block`, item_id: `${sessionId}_${i + 1}`, exercise_id: item.exercise_id, session_id: sessionId,
    role: i === 0 ? "primary" : "accessory", coaching_notes: "", segment: "working",
    group_id: "", group_type: "straight", group_time_cap_seconds: 0, group_round_seconds: 0, group_total_rounds: 0,
    prescription_mode: "reps", tempo: "", sets: stamp.lighter ? Math.max(1, item.sets - 1) : item.sets, reps: item.reps,
    intensity: { type: "rpe", value: 8 }, resolved_load: null, rest_seconds: i === 0 ? 180 : 120
  }));
  const ids = items.map((i) => i.exercise_id);
  return {
    ...baseProgram,
    program_id: week.week_id,
    planned_items: items,
    planned_exercise_ids: ids,
    exercise_pool: Object.fromEntries(ids.map((id) => [id, ex.get(id)])),
    target_exercise_id: ids[0]
  };
}
