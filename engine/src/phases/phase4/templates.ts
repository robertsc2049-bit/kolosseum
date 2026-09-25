
// DEV NOTE: Engine-side implementation surface. Keep this code deterministic, closed-world, and
// free of product/UI/coach-note influence. Engine truth must come from explicit inputs,
// canonical registries, and validated contracts only.

import type { Phase4GroupType, Phase4ItemGroup, Phase4ItemPrescription, Phase4MicrocycleDay, Phase4Template } from "./types.js";
import { cycleModelFor, periodisePrescriptions, sessionsPerWeek, type TrainingCycle } from "./periodisation.js";
import { defaultPrescription } from "./planned_items.js";
import { loadRegistryBundle } from "../../registries/loadRegistryBundle.js";

type ProgramLevelVariant = {
  exercise_eligibility: string[];
  item_prescriptions: Phase4ItemPrescription[];
  microcycle?: Phase4MicrocycleDay[];
};

// The base entry is the amateur programme; beginner and pro may each declare
// their own session. A level with no variant falls back to the base entry.
export const PROGRAM_LEVELS = ["beginner", "amateur", "pro"] as const;
export type ProgramLevel = (typeof PROGRAM_LEVELS)[number];

// A competition event (powerlifting's single-lift and push-pull divisions) is
// its own programme with its own level variants. The base entry is full power.
export const COMPETITION_EVENTS = ["full_power", "bench_only", "deadlift_only", "push_pull", "squat_only"] as const;
export type CompetitionEvent = (typeof COMPETITION_EVENTS)[number];

type ProgramEventVariant = ProgramLevelVariant & {
  level_variants?: Partial<Record<"beginner" | "pro", ProgramLevelVariant>>;
};

export type ProgramTemplateEntry = {
  activity_id: string;
  template_id: string;
  exercise_eligibility: string[];
  item_prescriptions?: Phase4ItemPrescription[];
  microcycle?: Phase4MicrocycleDay[];
  level_variants?: Partial<Record<"beginner" | "pro", ProgramLevelVariant>>;
  event_variants?: Partial<Record<Exclude<CompetitionEvent, "full_power">, ProgramEventVariant>>;
};

type ProgramTemplateRegistry = {
  registry_id: "program";
  version: string;
  entries: ProgramTemplateEntry[];
};

function die(msg: string): never {
  throw new Error(`PHASE4_TEMPLATE_REGISTRY: ${msg}`);
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function positiveInt(x: unknown): x is number {
  return typeof x === "number" && Number.isInteger(x) && x > 0;
}

const GROUP_TYPES: readonly Phase4GroupType[] = ["superset", "circuit", "complex", "amrap", "emom", "for_time"];
const PRIMARY_COUNT = 4;

function nonNegativeInt(x: unknown): x is number {
  return typeof x === "number" && Number.isInteger(x) && x >= 0;
}

function validateGroup(raw: unknown, at: string): Phase4ItemGroup {
  if (!isPlainObject(raw)) die(`${at}.group not an object`);
  const { group_id, group_type, time_cap_seconds, round_seconds, total_rounds } = raw;
  if (typeof group_id !== "string" || !/^[a-z0-9][a-z0-9_]*$/.test(group_id)) die(`${at}.group.group_id invalid`);
  if (typeof group_type !== "string" || !GROUP_TYPES.includes(group_type as Phase4GroupType)) die(`${at}.group.group_type invalid`);

  const group: Phase4ItemGroup = { group_id, group_type: group_type as Phase4GroupType };
  if (group_type === "amrap" || group_type === "for_time") {
    if (!positiveInt(time_cap_seconds)) die(`${at}.group.time_cap_seconds required for ${group_type}`);
    group.time_cap_seconds = time_cap_seconds;
  }
  if (group_type === "emom") {
    if (!positiveInt(round_seconds) || !positiveInt(total_rounds)) die(`${at}.group emom requires round_seconds and total_rounds`);
    group.round_seconds = round_seconds;
    group.total_rounds = total_rounds;
  }
  return group;
}

// Groups must be contiguous, declared identically on every member, and sit
// entirely within the primaries - timebox pruning only ever drops accessories,
// so this guarantees a group is never split.
function validateGroupLayout(prescriptions: Phase4ItemPrescription[], at: string): void {
  const seen = new Set<string>();
  let previous: Phase4ItemGroup | undefined;
  prescriptions.forEach((p, j) => {
    const g = p.group;
    if (g) {
      if (j >= PRIMARY_COUNT) die(`${at}[${j}].group must be within the first ${PRIMARY_COUNT} (primary) items`);
      if (previous?.group_id === g.group_id) {
        if (JSON.stringify(previous) !== JSON.stringify(g)) die(`${at}[${j}].group must match the rest of group ${g.group_id}`);
      } else {
        if (seen.has(g.group_id)) die(`${at}[${j}].group ${g.group_id} must be contiguous`);
        seen.add(g.group_id);
      }
    }
    previous = g;
  });
}

// item_prescriptions is optional; when present it must align 1:1 with a
// duplicate-free exercise_eligibility so planned item i gets prescription i.
function validateItemPrescriptions(raw: unknown, i: number, eligibility: string[]): Phase4ItemPrescription[] {
  const at = `program.entries[${i}].item_prescriptions`;
  if (!Array.isArray(raw)) die(`${at} must be an array`);
  if (raw.length !== eligibility.length) die(`${at} must align 1:1 with exercise_eligibility`);
  if (new Set(eligibility).size !== eligibility.length) die(`${at} requires a duplicate-free exercise_eligibility`);

  const prescriptions = raw.map((p, j): Phase4ItemPrescription => {
    if (!isPlainObject(p)) die(`${at}[${j}] not an object`);
    const { sets, reps, rest_seconds, intensity } = p;
    if (!positiveInt(sets)) die(`${at}[${j}].sets must be a positive integer`);
    if (!positiveInt(reps)) die(`${at}[${j}].reps must be a positive integer`);
    const group = p["group"] === undefined ? undefined : validateGroup(p["group"], `${at}[${j}]`);
    // Movements inside a timed group run back to back, so 0 rest is valid there.
    if (group ? !nonNegativeInt(rest_seconds) : !positiveInt(rest_seconds)) {
      die(`${at}[${j}].rest_seconds must be a positive integer (or 0 inside a group)`);
    }
    const rest = rest_seconds as number;
    if (!isPlainObject(intensity)) die(`${at}[${j}].intensity not an object`);

    const type = intensity["type"];
    const value = intensity["value"];
    let out: Phase4ItemPrescription;
    if (type === "bodyweight") {
      out = { sets, reps, rest_seconds: rest, intensity: { type } };
    } else if (type === "percent_1rm" && typeof value === "number" && value > 0 && value <= 100) {
      out = { sets, reps, rest_seconds: rest, intensity: { type, value } };
    } else if (type === "rpe" && typeof value === "number" && value >= 1 && value <= 10) {
      out = { sets, reps, rest_seconds: rest, intensity: { type, value } };
    } else {
      die(`${at}[${j}].intensity must be bodyweight, percent_1rm (0-100] or rpe [1-10]`);
    }
    if (group) out.group = group;
    const distance = p["distance_m"];
    const duration = p["duration_seconds"];
    if (distance !== undefined && duration !== undefined) die(`${at}[${j}] may declare distance_m or duration_seconds, not both`);
    if (distance !== undefined) {
      if (typeof distance !== "number" || !(distance > 0) || distance > 10000) die(`${at}[${j}].distance_m must be a number in (0, 10000]`);
      out.distance_m = distance;
    }
    if (duration !== undefined) {
      if (!positiveInt(duration) || duration > 3600) die(`${at}[${j}].duration_seconds must be an integer in [1, 3600]`);
      out.duration_seconds = duration;
    }
    return out;
  });
  validateGroupLayout(prescriptions, at);
  return prescriptions;
}

// A training week of 2-4 distinct sessions, in priority order (a two-session
// in-season week uses the first two).
function validateMicrocycle(raw: unknown, i: number, at: string): Phase4MicrocycleDay[] {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 4) die(`${at}.microcycle must list 2-4 sessions`);
  const ids = new Set<string>();
  return raw.map((day, d) => {
    const here = `${at}.microcycle[${d}]`;
    if (!isPlainObject(day)) die(`${here} must be an object`);
    const day_id = day["day_id"];
    const focus = day["focus"];
    if (typeof day_id !== "string" || !/^[a-z][a-z0-9_]*$/.test(day_id)) die(`${here}.day_id invalid`);
    if (ids.has(day_id)) die(`${here}.day_id ${day_id} duplicated`);
    ids.add(day_id);
    if (typeof focus !== "string" || !/^[a-z][a-z0-9_]*$/.test(focus)) die(`${here}.focus invalid`);
    const elig = day["exercise_eligibility"];
    if (!Array.isArray(elig) || elig.length === 0 || !elig.every((x) => typeof x === "string" && x.trim() !== "")) {
      die(`${here}.exercise_eligibility must be a non-empty string array`);
    }
    return { day_id, focus, exercise_eligibility: elig as string[], item_prescriptions: validateItemPrescriptions(day["item_prescriptions"], i, elig as string[]) };
  });
}

function validateLevelVariants(raw: unknown, i: number): Partial<Record<"beginner" | "pro", ProgramLevelVariant>> {
  const at = `program.entries[${i}].level_variants`;
  if (!isPlainObject(raw)) die(`${at} must be an object`);
  const out: Partial<Record<"beginner" | "pro", ProgramLevelVariant>> = {};
  for (const [level, variant] of Object.entries(raw)) {
    if (level !== "beginner" && level !== "pro") die(`${at} may only declare beginner or pro (amateur is the base entry), got ${level}`);
    if (!isPlainObject(variant)) die(`${at}.${level} must be an object`);
    const elig = variant["exercise_eligibility"];
    if (!Array.isArray(elig) || elig.length === 0 || !elig.every((x) => typeof x === "string" && x.trim() !== "")) {
      die(`${at}.${level}.exercise_eligibility must be a non-empty string array`);
    }
    out[level] = {
      exercise_eligibility: elig as string[],
      item_prescriptions: validateItemPrescriptions(variant["item_prescriptions"], i, elig as string[])
    };
    if (variant["microcycle"] !== undefined) out[level]!.microcycle = validateMicrocycle(variant["microcycle"], i, `${at}.${level}`);
  }
  return out;
}

function validateEventVariants(raw: unknown, i: number): NonNullable<ProgramTemplateEntry["event_variants"]> {
  const at = `program.entries[${i}].event_variants`;
  if (!isPlainObject(raw)) die(`${at} must be an object`);
  const out: NonNullable<ProgramTemplateEntry["event_variants"]> = {};
  for (const [event, variant] of Object.entries(raw)) {
    if (event === "full_power" || !(COMPETITION_EVENTS as readonly string[]).includes(event)) {
      die(`${at} may only declare bench_only, deadlift_only, push_pull or squat_only (full_power is the base entry), got ${event}`);
    }
    if (!isPlainObject(variant)) die(`${at}.${event} must be an object`);
    const elig = variant["exercise_eligibility"];
    if (!Array.isArray(elig) || elig.length === 0 || !elig.every((x) => typeof x === "string" && x.trim() !== "")) {
      die(`${at}.${event}.exercise_eligibility must be a non-empty string array`);
    }
    const parsed: ProgramEventVariant = {
      exercise_eligibility: elig as string[],
      item_prescriptions: validateItemPrescriptions(variant["item_prescriptions"], i, elig as string[])
    };
    if (variant["microcycle"] !== undefined) parsed.microcycle = validateMicrocycle(variant["microcycle"], i, `${at}.${event}`);
    if (variant["level_variants"] !== undefined) parsed.level_variants = validateLevelVariants(variant["level_variants"], i);
    out[event as Exclude<CompetitionEvent, "full_power">] = parsed;
  }
  return out;
}

// Exported for tests: the load-time validator every registry entry passes through.
export function validateProgramRegistry(doc: unknown): ProgramTemplateRegistry {
  if (!isPlainObject(doc)) die(`program registry not an object`);

  const registry_id = doc["registry_id"];
  const version = doc["version"];
  const entries = doc["entries"];

  if (registry_id !== "program") die(`program.registry_id must be "program"`);
  if (typeof version !== "string" || version.trim() === "") die(`program.version must be non-empty string`);
  if (!Array.isArray(entries)) die(`program.entries must be an array`);

  const out: ProgramTemplateEntry[] = [];
  for (let i = 0; i < entries.length; i++) {
    const row = entries[i];
    if (!isPlainObject(row)) die(`program.entries[${i}] not an object`);

    const activity_id = row["activity_id"];
    const template_id = row["template_id"];
    const exercise_eligibility = row["exercise_eligibility"];

    if (typeof activity_id !== "string" || activity_id.trim() === "") die(`program.entries[${i}].activity_id invalid`);
    if (typeof template_id !== "string" || template_id.trim() === "") die(`program.entries[${i}].template_id invalid`);
    if (!Array.isArray(exercise_eligibility)) die(`program.entries[${i}].exercise_eligibility must be array`);

    const exerciseEligibilityOut: string[] = [];
    for (let j = 0; j < exercise_eligibility.length; j++) {
      const ex = exercise_eligibility[j];
      if (typeof ex !== "string" || ex.trim() === "") die(`program.entries[${i}].exercise_eligibility[${j}] invalid`);
      exerciseEligibilityOut.push(ex);
    }

    const entry: ProgramTemplateEntry = {
      activity_id: activity_id.trim(),
      template_id: template_id.trim(),
      exercise_eligibility: exerciseEligibilityOut
    };
    if (row["item_prescriptions"] !== undefined) {
      entry.item_prescriptions = validateItemPrescriptions(row["item_prescriptions"], i, exerciseEligibilityOut);
    }
    if (row["microcycle"] !== undefined) {
      entry.microcycle = validateMicrocycle(row["microcycle"], i, `program.entries[${i}]`);
    }
    if (row["level_variants"] !== undefined) {
      entry.level_variants = validateLevelVariants(row["level_variants"], i);
    }
    if (row["event_variants"] !== undefined) {
      entry.event_variants = validateEventVariants(row["event_variants"], i);
    }
    out.push(entry);
  }

  return { registry_id: "program", version, entries: out };
}

let _cache: ProgramTemplateRegistry | null = null;

function loadProgramRegistry(): ProgramTemplateRegistry {
  if (_cache) return _cache;

  const bundle = loadRegistryBundle();
  const program = bundle?.registries?.["program"];

  if (!program) {
    die(`registry bundle missing registries["program"]`);
  }

  _cache = validateProgramRegistry(program);
  return _cache;
}

export function selectTemplate(activity: string, level?: string, event?: string): Phase4Template | null {
  const act = String(activity ?? "").trim();
  if (!act) return null;

  const reg = loadProgramRegistry();
  const hit = reg.entries.find((t) => t.activity_id === act);
  if (!hit) return null;

  return templateForLevel(entryForEvent(hit, event), level);
}

// Pure event resolution: a declared event variant (with its own level variants)
// replaces the base programme; full_power, no event, or an event this activity
// does not declare use the base entry.
export function entryForEvent(entry: ProgramTemplateEntry, event?: string): ProgramTemplateEntry {
  const variant = event && event !== "full_power" ? entry.event_variants?.[event as Exclude<CompetitionEvent, "full_power">] : undefined;
  if (!variant) return entry;
  const out: ProgramTemplateEntry = {
    activity_id: entry.activity_id,
    template_id: entry.template_id,
    exercise_eligibility: variant.exercise_eligibility,
    item_prescriptions: variant.item_prescriptions
  };
  if (variant.microcycle) out.microcycle = variant.microcycle;
  if (variant.level_variants) out.level_variants = variant.level_variants;
  return out;
}

// Pure level resolution for one program entry: a declared beginner/pro variant
// wins; amateur, an unknown level or a missing variant use the base entry.
export function templateForLevel(entry: ProgramTemplateEntry, level?: string): Phase4Template {
  const variant = level === "beginner" || level === "pro" ? entry.level_variants?.[level] : undefined;
  if (variant) {
    const t: Phase4Template = { program_id: entry.template_id, intent: variant.exercise_eligibility, prescriptions: variant.item_prescriptions };
    if (variant.microcycle) t.microcycle = variant.microcycle;
    return t;
  }
  const t: Phase4Template = entry.item_prescriptions
    ? { program_id: entry.template_id, intent: entry.exercise_eligibility, prescriptions: entry.item_prescriptions }
    : { program_id: entry.template_id, intent: entry.exercise_eligibility };
  if (entry.microcycle) t.microcycle = entry.microcycle;
  return t;
}

// Pure periodisation of a resolved template: pick this week's session for the
// slot (the single full-body session when the phase allows one session a week
// or the sport declares no microcycle), then apply the macrocycle phase,
// mesocycle week and level ceilings to its prescriptions.
export function templateForCycle(template: Phase4Template, activity: string, cycle: TrainingCycle, level?: string): Phase4Template {
  const model = cycleModelFor(activity);
  if (!model) throw new Error(`PHASE4_TEMPLATE_REGISTRY: activity ${activity} has no cycle model`);
  const perWeek = sessionsPerWeek(cycle.macro_phase, cycle.days_per_week);
  const week = perWeek > 1 && template.microcycle ? template.microcycle.slice(0, Math.min(template.microcycle.length, perWeek)) : null;
  const day_index = week ? cycle.session_slot % week.length : 0;
  const day = week ? week[day_index] : null;
  const intent = day ? day.exercise_eligibility : template.intent;
  const declared = day ? day.item_prescriptions : template.prescriptions;
  const base = declared ?? intent.map((_, i) => defaultPrescription(i));
  const deload = cycle.meso_week === 4 && cycle.macro_phase !== "taper" && cycle.macro_phase !== "transition";
  return {
    program_id: template.program_id,
    intent,
    prescriptions: periodisePrescriptions(base, cycle, level),
    training_cycle: {
      ...cycle,
      cycle_model: model,
      sessions_per_week: perWeek,
      day_index,
      day_focus: day ? day.focus : "full_body",
      deload
    }
  };
}
