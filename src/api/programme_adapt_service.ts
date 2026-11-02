// DEV NOTE: Copy and adapt. A coach makes a new draft from one of their own
// programmes in one step - a new name, fewer training days a week (the
// first ones are kept), a different length (weeks cut from the end, or the
// last block repeated to make it longer), loads a few percent heavier or
// lighter (% of max, set weights and set-by-set lines; reps and sets are
// untouched) and RPE a point up or down. The original is never changed; the
// copy is a fresh programme (its own family, version 1), not a new version.
import {
  Beta18ProgrammeTemplateError,
  listCoachProgrammeTemplates,
  saveCoachProgrammeTemplate,
  templateRecordInput
} from "./beta18_programme_template_service.js";

type Json = Record<string, unknown>;
const isRecord = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export class ProgrammeAdaptError extends Error {
  constructor(public readonly code: string, public readonly status: number, public readonly fieldErrors?: Json) {
    super(code);
    this.name = "ProgrammeAdaptError";
  }
}

export const LOAD_CHANGES: readonly number[] = Object.freeze([-10, -7.5, -5, -2.5, 0, 2.5, 5, 7.5, 10]);
export const RPE_CHANGES: readonly number[] = Object.freeze([-1, 0, 1]);
const MAX_WEEKS = 52;

const roundTo = (value: number, step: number) => Math.round(value / step) * step;

// Heavier or lighter by a percentage: % of max to the nearest 0.5 (kept
// within 1-100), weights to the nearest 0.5 kg or 1 lb.
function scaledPercent(value: unknown, factor: number): unknown {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(100, Math.max(1, roundTo(n * factor, 0.5))) : value;
}

function scaledWeight(value: unknown, factor: number, unit: unknown): unknown {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return value;
  return Math.max(0.5, roundTo(n * factor, unit === "lb" ? 1 : 0.5));
}

function shiftedRpe(value: unknown, change: number): unknown {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(10, Math.max(1, Math.round(n) + change)) : value;
}

export function adaptWorkItem(item: Json, factor: number, rpeChange: number): Json {
  const mode = text(item.load_mode);
  const next: Json = { ...item };
  if (factor !== 1 && mode === "percent_1rm") {
    next.percent_1rm = scaledPercent(item.percent_1rm, factor);
    if (item.percent_1rm_max !== undefined) next.percent_1rm_max = scaledPercent(item.percent_1rm_max, factor);
  }
  if (factor !== 1 && mode === "fixed_weight") {
    next.weight_value = scaledWeight(item.weight_value, factor, item.weight_unit);
    if (item.weight_value_max !== undefined) next.weight_value_max = scaledWeight(item.weight_value_max, factor, item.weight_unit);
  }
  if (rpeChange && mode === "rpe") next.rpe_value = shiftedRpe(item.rpe_value, rpeChange);
  if (Array.isArray(item.set_plan)) {
    next.set_plan = item.set_plan.filter(isRecord).map((line) => {
      if (typeof line.value !== "number") return line;
      if (mode === "percent_1rm") return { ...line, value: scaledPercent(line.value, factor) };
      if (mode === "fixed_weight") return { ...line, value: scaledWeight(line.value, factor, item.weight_unit) };
      if (mode === "rpe") return { ...line, value: shiftedRpe(line.value, rpeChange) };
      return line;
    });
  }
  return next;
}

function weeksOf(blocks: Json[]): number {
  return blocks.reduce((sum, block) => sum + (Array.isArray(block.weeks) ? block.weeks.length : 0), 0);
}

// Cut weeks from the end, or repeat the last block until there are enough.
function toLength(blocks: Json[], weeks: number): Json[] {
  let out: Json[] = blocks.map((block) => ({ ...block, weeks: Array.isArray(block.weeks) ? [...block.weeks] : [] }));
  const last = out[out.length - 1];
  while (weeksOf(out) < weeks && last && (last.weeks as unknown[]).length) {
    out.push({ ...last, block_id: "", name: `${text(last.name) || "Block"} (repeat)`, weeks: (last.weeks as Json[]).map((week) => ({ ...week, week_id: "" })) });
  }
  let excess = weeksOf(out) - weeks;
  while (excess > 0) {
    const tail = out[out.length - 1];
    const tailWeeks = tail.weeks as Json[];
    if (tailWeeks.length <= excess) {
      excess -= tailWeeks.length;
      out = out.slice(0, -1);
    }
    else {
      tail.weeks = tailWeeks.slice(0, tailWeeks.length - excess);
      excess = 0;
    }
  }
  return out.map((block, blockIndex) => {
    const blockWeeks = (block.weeks as Json[]).map((week, weekIndex) => ({ ...week, order_index: weekIndex + 1 }));
    return { ...block, order_index: blockIndex + 1, weeks: blockWeeks, week_count: blockWeeks.length };
  });
}

export async function adaptCoachProgrammeTemplate(coachUserId: string, templateId: string, input: unknown): Promise<Readonly<Json>> {
  if (!isRecord(input)) throw new ProgrammeAdaptError("programme_adapt_invalid", 422);
  const source = (await listCoachProgrammeTemplates(coachUserId)).find((template) => text(template.template_id) === templateId);
  if (!source) throw new ProgrammeAdaptError("programme_adapt_not_found", 404);

  const base = templateRecordInput(source as Json);
  const blocks = (Array.isArray(base.blocks) ? base.blocks : []).filter(isRecord);
  const currentWeeks = weeksOf(blocks);
  const currentDays = Math.max(0, ...blocks.flatMap((block) => (Array.isArray(block.weeks) ? block.weeks : []).filter(isRecord).map((week) => (Array.isArray(week.sessions) ? week.sessions.length : 0))));

  const errors: Json = {};
  const name = text(input.template_name);
  if (!name || name.length > 120) errors.template_name = "Give the copy a name (up to 120 characters).";
  const days = input.days_per_week === undefined || input.days_per_week === null ? currentDays : Number(input.days_per_week);
  if (!Number.isInteger(days) || days < 1 || days > currentDays) errors.days_per_week = `Keep 1 to ${currentDays} training days a week.`;
  const weeks = input.weeks === undefined || input.weeks === null ? currentWeeks : Number(input.weeks);
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > MAX_WEEKS) errors.weeks = `Choose 1 to ${MAX_WEEKS} weeks.`;
  const loadChange = Number(input.load_change_percent ?? 0);
  if (!LOAD_CHANGES.includes(loadChange)) errors.load_change_percent = "Choose a change from -10% to +10%.";
  const rpeChange = Number(input.rpe_change ?? 0);
  if (!RPE_CHANGES.includes(rpeChange)) errors.rpe_change = "Choose one lower, the same or one higher.";
  if (Object.keys(errors).length) throw new ProgrammeAdaptError("programme_adapt_invalid", 422, errors);

  const factor = 1 + loadChange / 100;
  const adaptedBlocks = toLength(blocks, weeks).map((block) => ({
    ...block,
    weeks: (block.weeks as Json[]).map((week) => ({
      ...week,
      sessions: (Array.isArray(week.sessions) ? week.sessions : []).filter(isRecord).slice(0, days).map((session, index) => ({
        ...session,
        session_id: "",
        order_index: index + 1,
        work_items: (Array.isArray(session.work_items) ? session.work_items : []).filter(isRecord).map((item) => ({ ...adaptWorkItem(item, factor, rpeChange), work_item_id: "" }))
      }))
    }))
  }));

  const changes = [
    days !== currentDays ? `${days} day${days === 1 ? "" : "s"} a week` : "",
    weeks !== currentWeeks ? `${weeks} weeks` : "",
    loadChange ? `loads ${loadChange > 0 ? "+" : ""}${loadChange}%` : "",
    rpeChange ? `RPE ${rpeChange > 0 ? "+1" : "-1"}` : ""
  ].filter(Boolean);
  // What the copy is comes first; the original's own description follows,
  // labelled, so its numbers aren't read as the copy's. Capped at 1000.
  const note = `Copied from ${text(source.template_name)}${changes.length ? ` (${changes.join(", ")})` : ""}.`.slice(0, 1000);
  const label = " About the original: ";
  const original = text(base.description).slice(0, Math.max(0, 1000 - note.length - label.length)).trim();
  const draft: Json = {
    ...base,
    template_name: name,
    description: original ? `${note}${label}${original}` : note,
    blocks: adaptedBlocks,
    updated_at_iso8601: new Date().toISOString()
  };
  delete draft.template_id;
  delete draft.template_family_id;
  draft.template_version = 1;
  draft.coach_user_id = coachUserId;
  try {
    return await saveCoachProgrammeTemplate(draft);
  }
  catch (error) {
    if (error instanceof Beta18ProgrammeTemplateError) throw new ProgrammeAdaptError("programme_adapt_unsaveable", 422, { programme: error.message });
    throw error;
  }
}
