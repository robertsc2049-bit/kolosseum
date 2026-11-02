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
  sessionsPerWeek,
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

type SlotConstraints = { available_equipment?: string[] };

// One distinct recommended exercise per open slot of each training day.
function defaultSelections(activity: string, level: string, daysPerWeek: number, constraints: SlotConstraints = {}): Record<string, string> {
  const days = describeProgrammeSlots({ activity_id: activity, experience_level: level, days_per_week: daysPerWeek, constraints }) ?? [];
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

// Picks within the equipment, plus the slots nothing in it can fill. The
// engine needs every slot chosen, so those get the full-gym pick as a
// stand-in and the work items for them are taken out afterwards; the
// movements left out are named ("throw slam") for the coach.
function selectionsWithinEquipment(activity: string, level: string, daysPerWeek: number, constraints: SlotConstraints) {
  const selections = defaultSelections(activity, level, daysPerWeek, constraints);
  const listing = describeProgrammeSlots({ activity_id: activity, experience_level: level, days_per_week: daysPerWeek, constraints }) ?? [];
  const unfilled = listing.flatMap((day) => day.items.filter((item) => item.kind === "slot" && !selections[item.slot_id]).map((item) => (item as { slot_id: string }).slot_id));
  if (!unfilled.length) return { selections, standIns: new Set<string>(), leftOut: [] as string[] };
  const fullGym = defaultSelections(activity, level, daysPerWeek);
  const kept = new Set([...Object.values(selections), ...listing.flatMap((day) => day.items.filter((i) => i.kind === "fixed").map((i) => (i as { exercise_id: string }).exercise_id))]);
  const standIns = new Set<string>();
  for (const slotId of unfilled) {
    const standIn = fullGym[slotId];
    if (!standIn) continue;
    selections[slotId] = standIn;
    if (!kept.has(standIn)) standIns.add(standIn);
  }
  const leftOut = [...new Set(unfilled.map((slotId) => slotId.replace(/^[^.]*\./u, "").replace(/_\d+$/u, "").replaceAll("_", " ")))];
  return { selections, standIns, leftOut };
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

// --- Quick build -----------------------------------------------------------
// One short form - sport, level, days a week, length, goal, session length
// and equipment - builds a whole periodised draft: one 4-week block per four
// weeks (three loading weeks and a deload each), the blocks running through
// the goal's phases in order. Equipment narrows the exercise picks the way
// an athlete's own equipment does; a session length trims accessory work
// (never the main lifts) until the estimated session fits.

type Goal = { goal_id: string; label: string; summary: string; phases: (blocks: number) => string[] };

const repeatTo = (pattern: string[], blocks: number) => Array.from({ length: blocks }, (_, n) => pattern[n % pattern.length]);

// The last block is the goal's own phase; the blocks before it lead up to
// it in order, earliest phase first (["acc", "int"] + "peak" over 4 blocks:
// acc, acc, int, peak).
function endingIn(lead: string[], last: string) {
  return (blocks: number): string[] => {
    const before = blocks - 1;
    if (before <= 0) return [last];
    const tail = lead.slice(Math.max(0, lead.length - before));
    const fill = Array(Math.max(0, before - tail.length)).fill(tail[0]);
    return [...fill, ...tail, last];
  };
}

export const QUICK_BUILD_GOALS: Readonly<Record<string, readonly Goal[]>> = Object.freeze({
  meet: [
    { goal_id: "build", label: "Get stronger", summary: "Volume then intensity blocks, repeating.", phases: (b) => repeatTo(["accumulation", "intensification"], b) },
    { goal_id: "peak", label: "Peak for a competition", summary: "Volume, then intensity, then a peak block to finish.", phases: endingIn(["accumulation", "intensification"], "peak") }
  ],
  season: [
    { goal_id: "off_season", label: "Off-season", summary: "Build strength while there are no matches.", phases: (b) => repeatTo(["off_season"], b) },
    { goal_id: "pre_season", label: "Pre-season", summary: "Off-season strength into pre-season to finish.", phases: endingIn(["off_season"], "pre_season") },
    { goal_id: "in_season", label: "In-season", summary: "Keep strength with two sessions a week around matches.", phases: (b) => repeatTo(["in_season"], b) }
  ],
  event: [
    { goal_id: "base", label: "Build a base", summary: "Base then build blocks.", phases: (b) => Array.from({ length: b }, (_, n) => (n < Math.ceil(b / 2) ? "base" : "build")) },
    { goal_id: "event_prep", label: "Prepare for an event", summary: "Base and build blocks, then event-specific work to finish.", phases: endingIn(["base", "build"], "specific") }
  ]
});

const PHASE_LABEL: Record<string, string> = {
  accumulation: "Volume", intensification: "Intensity", peak: "Peak", off_season: "Off-season", pre_season: "Pre-season",
  in_season: "In-season", base: "Base", build: "Build", specific: "Event-specific"
};
const PHASE_BLOCK_TYPE: Record<string, string> = { accumulation: "volume", intensification: "strength", peak: "peak", specific: "peak" };

export const QUICK_BUILD_WEEKS: readonly number[] = Object.freeze([4, 8, 12, 16]);
export const QUICK_BUILD_SESSION_MINUTES: readonly number[] = Object.freeze([45, 60, 75, 90]);
// Always available, then what a home gym usually has (AthleteEquipmentCard).
const ALWAYS = ["bodyweight", "open_floor_space"];
const EQUIPMENT: Record<string, string[] | null> = {
  full_gym: null,
  home_gym: [...ALWAYS, "barbell", "rack", "bench", "plate", "dumbbell", "pull_up_bar", "resistance_band"],
  bodyweight: ALWAYS
};

export function quickBuildGoals(activityId: unknown): Json {
  const model = cycleModelFor(String(activityId ?? ""));
  if (!model) throw new StarterTemplateError("starter_template_invalid", 422, { activity_id: "Choose a supported sport." });
  return { ok: true, goals: QUICK_BUILD_GOALS[model].map(({ goal_id, label, summary }) => ({ goal_id, label, summary })) };
}

// Roughly how long a session takes: each set's work plus its rest, and ten
// minutes for the warm-up and changeovers.
function estimatedMinutes(items: Json[]): number {
  const seconds = items.reduce((sum, item) => {
    const sets = Number(item.planned_sets ?? 1);
    const work = item.prescription_mode === "duration" ? Number(item.planned_duration_seconds ?? 30) : 40;
    return sum + sets * (work + Number(item.rest_seconds ?? 90));
  }, 0);
  return Math.ceil(seconds / 60) + 10;
}

// Drop accessory work from the end until the session fits; the main lifts stay.
export function fitToSession(items: Json[], minutes: number | null): Json[] {
  if (!minutes) return items;
  const kept = [...items];
  while (estimatedMinutes(kept) > minutes) {
    const last = kept.map((item) => item.role).lastIndexOf("accessory");
    if (last < 0 || kept.length <= 2) break;
    kept.splice(last, 1);
  }
  return kept.map((item, index) => ({ ...item, order_index: index + 1 }));
}

// Weights by RPE instead of % of max, so a programme can be assigned before
// the athlete's maxes are known: each % of max line becomes the RPE it
// works out at for its reps - reps to failure at that % from the Epley
// estimate (30 x (1/p - 1)), less the reps done, as reps in reserve - kept
// between 5 and 10 in whole numbers.
export function rpeForPercent(percent: number, reps: number): number {
  const repsToFailure = 30 * (100 / percent - 1);
  return Math.min(10, Math.max(5, Math.round(10 - (repsToFailure - reps))));
}

function byRpe(item: Json): Json {
  if (item.load_mode !== "percent_1rm") return item;
  return { ...item, load_mode: "rpe", rpe_value: rpeForPercent(Number(item.percent_1rm), Number(item.planned_reps ?? 1)) };
}

export const QUICK_BUILD_WEIGHTS: readonly string[] = Object.freeze(["percent_1rm", "rpe"]);

export async function createQuickBuildProgramme(coachUserId: string, input: unknown): Promise<Readonly<Json>> {
  if (!isRecord(input)) throw new StarterTemplateError("starter_template_invalid", 422);
  const activity = String(input.activity_id ?? "");
  const level = String(input.experience_level ?? "");
  const days = Number(input.days_per_week);
  const totalWeeks = Number(input.weeks);
  const goalId = String(input.goal ?? "");
  const minutes = input.session_minutes === null || input.session_minutes === undefined || input.session_minutes === "" ? null : Number(input.session_minutes);
  const equipmentId = String(input.equipment ?? "full_gym");
  const errors: Json = {};
  const model = cycleModelFor(activity);
  const goal = model ? QUICK_BUILD_GOALS[model].find((g) => g.goal_id === goalId) : undefined;
  if (!model) errors.activity_id = "Choose a supported sport.";
  if (!LEVELS.has(level)) errors.experience_level = "Choose beginner, amateur or pro.";
  if (!Number.isInteger(days) || days < 1 || days > 6) errors.days_per_week = "Choose 1 to 6 training days a week.";
  if (!QUICK_BUILD_WEEKS.includes(totalWeeks)) errors.weeks = "Choose 4, 8, 12 or 16 weeks.";
  if (model && !goal) errors.goal = "Choose a goal for this sport.";
  if (minutes !== null && !QUICK_BUILD_SESSION_MINUTES.includes(minutes)) errors.session_minutes = "Choose 45, 60, 75 or 90 minutes, or no limit.";
  if (!(equipmentId in EQUIPMENT)) errors.equipment = "Choose full gym, home gym or bodyweight.";
  const weights = String(input.weights ?? "percent_1rm");
  if (!QUICK_BUILD_WEIGHTS.includes(weights)) errors.weights = "Choose % of max or RPE.";
  if (Object.keys(errors).length || !model || !goal) throw new StarterTemplateError("starter_template_invalid", 422, errors);

  const available = EQUIPMENT[equipmentId];
  const constraints: SlotConstraints = available ? { available_equipment: available } : {};
  const { selections, standIns, leftOut } = selectionsWithinEquipment(activity, level, days, constraints);
  const phases = goal.phases(totalWeeks / 4);
  const blocks = phases.map((phase, blockIndex) => ({
    block_id: "",
    order_index: blockIndex + 1,
    name: `Block ${blockIndex + 1} - ${PHASE_LABEL[phase] ?? titleCase(phase)}`,
    description: `${PHASE_LABEL[phase] ?? titleCase(phase)}: weeks 1-3 build, week 4 is a deload.`,
    block_type: PHASE_BLOCK_TYPE[phase] ?? "general",
    week_count: 4,
    weeks: [1, 2, 3, 4].map((week) => ({
      week_id: "",
      order_index: week,
      sessions: Array.from({ length: sessionsPerWeek(phase, days) }, (_, slot) => {
        const result = phase4AssembleProgram(
          { activity_id: activity, experience_level: level, training_cycle: { macro_phase: phase, meso_week: week, days_per_week: days, session_slot: slot }, exercise_selections: selections },
          // The picks were already made within the equipment (stand-ins included).
          { constraints: { constraints_version: "1.0.0" } } as never
        ) as unknown as Json;
        const program = isRecord(result.program) ? result.program : null;
        if (result.ok !== true || !program) throw new StarterTemplateError("starter_template_unavailable", 409);
        // With little kit two slots can land on the same exercise; the engine
        // marks the second one a repeat (<id>__r2) - one is enough here.
        const items = (Array.isArray(program.planned_items) ? program.planned_items.filter(isRecord) : [])
          .filter((item) => !standIns.has(String(item.exercise_id)) && !/__r\d+$/u.test(String(item.exercise_id)));
        return { session_id: "", order_index: slot + 1, title: `Day ${slot + 1}`, work_items: fitToSession(items.map(workItem).map((item, index) => ({ ...(weights === "rpe" ? byRpe(item) : item), order_index: index + 1 })), minutes) };
      })
        // A day whose every exercise needs kit that isn't there is dropped.
        .filter((session) => session.work_items.length > 0)
        .map((session, index) => ({ ...session, order_index: index + 1, title: `Day ${index + 1}` }))
    }))
  }));
  if (blocks.some((block) => block.weeks.some((week) => week.sessions.length === 0))) {
    throw new StarterTemplateError("quick_build_equipment_too_limited", 422, { equipment: "There isn't enough to do for this sport with that equipment - choose more." });
  }

  const equipmentLabel = equipmentId === "home_gym" ? "home gym" : equipmentId === "bodyweight" ? "bodyweight only" : "full gym";
  return saveCoachProgrammeTemplate({
    coach_user_id: coachUserId,
    template_version: 1,
    template_name: `${titleCase(activity)} - ${goal.label}, ${LEVEL_LABEL[level]}, ${totalWeeks} weeks`,
    description: `Quick build: ${goal.label.toLowerCase()} for ${titleCase(activity)} (${LEVEL_LABEL[level].toLowerCase()}), ${days} day${days === 1 ? "" : "s"} a week, ${equipmentLabel}${minutes ? `, about ${minutes} minutes a session` : ""}, weights by ${weights === "rpe" ? "RPE (no maxes needed)" : "% of max (needs each athlete's maxes)"}. ${phases.length} block${phases.length === 1 ? "" : "s"} of 4 weeks, each ending in a deload.${leftOut.length ? ` Left out - needs equipment that isn't there: ${leftOut.join(", ")}.` : ""} Change anything before assigning it.`,
    activity_id: activity,
    event_plan: null,
    blocks,
    updated_at_iso8601: new Date().toISOString()
  }) as Promise<Readonly<Json>>;
}
