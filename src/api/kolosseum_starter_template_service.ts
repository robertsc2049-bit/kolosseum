// DEV NOTE: API boundary surface. "Start from a Kolosseum programme": a
// coach gets a draft template built from the engine's own programme for a
// sport, level and training days a week - one 4-week block (three loading
// weeks and a deload, periodised exactly as a self-directed athlete's), one
// session per training day - instead of a blank builder. Open exercise slots
// are filled with the engine's first recommendation; named competition lifts
// stay. The coach then edits it like any other draft; nothing is assigned.

import {
  MACRO_PHASES_BY_MODEL,
  cycleModelFor,
  describeProgrammeSlots,
  phase4AssembleProgram
} from "@kolosseum/engine/phases/phase4.js";
import { saveCoachProgrammeTemplate } from "./beta18_programme_template_service.js";

type Json = Record<string, unknown>;

const LEVELS = new Set(["beginner", "amateur", "pro"]);
const LEVEL_LABEL: Record<string, string> = { beginner: "Beginner", amateur: "Amateur", pro: "Pro" };
const isRecord = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const titleCase = (id: string) => id.replaceAll("_", " ").replace(/\b\w/gu, (c) => c.toUpperCase());

export class StarterTemplateError extends Error {
  constructor(public readonly code: string, public readonly status: number, public readonly fieldErrors?: Json) {
    super(code);
  }
}

// One distinct recommended exercise per open slot of each training day.
function defaultSelections(activity: string, level: string, daysPerWeek: number): Record<string, string> {
  const days = describeProgrammeSlots({ activity_id: activity, experience_level: level, days_per_week: daysPerWeek }) ?? [];
  const selections: Record<string, string> = {};
  for (const day of days) {
    const used = new Set(day.items.filter((i) => i.kind === "fixed").map((i) => (i as { exercise_id: string }).exercise_id));
    for (const item of day.items) {
      if (item.kind !== "slot") continue;
      const pick = item.recommended_exercise_ids.find((id) => !used.has(id)) ?? item.recommended_exercise_ids[0];
      if (pick) { selections[item.slot_id] = pick; used.add(pick); }
    }
  }
  return selections;
}

// An engine planned item as a template work item.
function workItem(item: Json, index: number): Json {
  const intensity = isRecord(item.intensity) ? item.intensity : { type: "bodyweight" };
  const distance = Number(item.distance_value ?? item.distance_m);
  const duration = Number(item.duration_seconds);
  const reps = Number(item.reps ?? 1);
  const mode = Number.isFinite(distance) && distance > 0 ? "distance" : Number.isFinite(duration) && duration > 0 ? "duration" : "reps";
  const load = intensity.type === "percent_1rm" ? "percent_1rm" : intensity.type === "rpe" ? "rpe" : intensity.type === "load" ? "fixed_weight" : "bodyweight";
  return {
    work_item_id: "",
    order_index: index + 1,
    exercise_id: String(item.exercise_id),
    planned_sets: Number(item.sets ?? 1),
    prescription_mode: mode,
    rep_mode: "fixed",
    planned_reps: reps,
    rep_min: reps,
    rep_max: reps,
    tempo: "",
    duration_mode: "fixed",
    planned_duration_seconds: mode === "duration" ? duration : 30,
    duration_min_seconds: mode === "duration" ? duration : 30,
    duration_max_seconds: mode === "duration" ? duration : 30,
    distance_mode: "fixed",
    distance_unit: item.distance_unit === "feet" ? "feet" : "meters",
    planned_distance_value: mode === "distance" ? distance : 20,
    distance_min_value: mode === "distance" ? distance : 20,
    distance_max_value: mode === "distance" ? distance : 20,
    load_mode: load,
    percent_1rm: load === "percent_1rm" ? Number(intensity.value) : 70,
    weight_value: load === "fixed_weight" ? Number(intensity.value) : 20,
    weight_unit: intensity.unit === "lb" ? "lb" : "kg",
    rpe_value: load === "rpe" ? Number(intensity.value) : 7,
    borg_value: 13,
    cr10_value: 5,
    rest_seconds: Number(item.rest_seconds ?? 90),
    role: item.role === "primary" ? "primary" : "accessory",
    coaching_notes: "",
    segment: "working",
    group_id: typeof item.group_id === "string" ? item.group_id : "",
    group_type: typeof item.group_type === "string" ? item.group_type : "straight",
    group_time_cap_seconds: Number(item.group_time_cap_seconds ?? 0),
    group_round_seconds: Number(item.group_round_seconds ?? 0),
    group_total_rounds: Number(item.group_total_rounds ?? 0)
  };
}

export async function createKolosseumStarterTemplate(coachUserId: string, input: unknown): Promise<Readonly<Json>> {
  if (!isRecord(input)) throw new StarterTemplateError("starter_template_invalid", 422);
  const activity = String(input.activity_id ?? "");
  const level = String(input.experience_level ?? "");
  const days = Number(input.days_per_week);
  const errors: Json = {};
  const model = cycleModelFor(activity);
  if (!model) errors.activity_id = "Choose a supported sport.";
  if (!LEVELS.has(level)) errors.experience_level = "Choose beginner, amateur or pro.";
  if (!Number.isInteger(days) || days < 1 || days > 6) errors.days_per_week = "Choose 1 to 6 training days a week.";
  if (Object.keys(errors).length || !model) throw new StarterTemplateError("starter_template_invalid", 422, errors);

  const phase = MACRO_PHASES_BY_MODEL[model][0];
  const selections = defaultSelections(activity, level, days);
  const weeks = [1, 2, 3, 4].map((week) => ({
    week_id: "",
    order_index: week,
    sessions: Array.from({ length: days }, (_, slot) => {
      const result = phase4AssembleProgram(
        { activity_id: activity, experience_level: level, training_cycle: { macro_phase: phase, meso_week: week, days_per_week: days, session_slot: slot }, exercise_selections: selections },
        { constraints: { constraints_version: "1.0.0" } } as never
      ) as unknown as Json;
      const program = isRecord(result.program) ? result.program : null;
      if (result.ok !== true || !program) throw new StarterTemplateError("starter_template_unavailable", 409);
      const items = Array.isArray(program.planned_items) ? program.planned_items.filter(isRecord) : [];
      return { session_id: "", order_index: slot + 1, title: `Day ${slot + 1}`, work_items: items.map(workItem) };
    })
  }));

  return saveCoachProgrammeTemplate({
    coach_user_id: coachUserId,
    template_version: 1,
    template_name: `Kolosseum ${titleCase(activity)} - ${LEVEL_LABEL[level]}, ${days} day${days === 1 ? "" : "s"}`,
    description: `Started from the Kolosseum ${titleCase(activity)} programme (${LEVEL_LABEL[level].toLowerCase()}): one 4-week block - three loading weeks and a deload. Change anything before assigning it.`,
    activity_id: activity,
    event_plan: null,
    blocks: [{
      block_id: "",
      order_index: 1,
      name: "Kolosseum block",
      description: "Weeks 1-3 build, week 4 is a deload.",
      block_type: "general",
      week_count: 4,
      weeks
    }],
    updated_at_iso8601: new Date().toISOString()
  }) as Promise<Readonly<Json>>;
}
