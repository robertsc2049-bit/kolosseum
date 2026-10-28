// DEV NOTE: Progressing a block across its weeks in one go. A coach writes
// week 1, duplicates it, then - instead of editing every main lift in every
// copied week - sets a step per week (+2.5% of max, +2.5 kg, +0.5 RPE, a rep
// change) and an optional deload every Nth week. Week 1 is the source: an
// exercise in week N is progressed from the same exercise in the same place
// in week 1 (anything that doesn't line up is left alone). Pure.

import type { ProgrammeWeekDraft, ProgrammeWorkItemDraft } from "./programmeDraft";

export type ProgressionOptions = {
  pct_step: number; // % of max points per week
  kg_step: number; // kg (or lb) per week, fixed weights
  rpe_step: number; // RPE per week
  reps_step: number; // reps per week (e.g. -1 to go 8s -> 5s)
  deload_every: number; // 0 = no deload; 4 = every 4th week
  scope: "primary" | "loaded"; // main lifts only, or every loaded working exercise
};

export const DEFAULT_PROGRESSION: ProgressionOptions = { pct_step: 2.5, kg_step: 2.5, rpe_step: 0.5, reps_step: 0, deload_every: 0, scope: "primary" };

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const roundTo = (value: number, step: number) => Math.round(value / step) * step;
const tidy = (value: number) => Math.round(value * 100) / 100;

export function isDeloadWeek(weekIndex: number, deloadEvery: number): boolean {
  return deloadEvery > 1 && (weekIndex + 1) % deloadEvery === 0;
}

// How many progression steps week `weekIndex` (0-based) is past week 1:
// one per week, not counting deload weeks before it.
function stepsFor(weekIndex: number, deloadEvery: number): number {
  const deloads = deloadEvery > 1 ? Math.floor((weekIndex + 1) / deloadEvery) : 0;
  return weekIndex - deloads + (isDeloadWeek(weekIndex, deloadEvery) ? 1 : 0);
}

export function progresses(item: ProgrammeWorkItemDraft, scope: ProgressionOptions["scope"]): boolean {
  if (item.segment !== "working" || !item.exercise_id) return false;
  if (scope === "primary" && item.role !== "primary") return false;
  return ["percent_1rm", "fixed_weight", "rpe"].includes(item.load_mode) || item.prescription_mode === "reps";
}

function progressItem(source: ProgrammeWorkItemDraft, target: ProgrammeWorkItemDraft, weekIndex: number, options: ProgressionOptions): ProgrammeWorkItemDraft {
  const steps = stepsFor(weekIndex, options.deload_every);
  const deload = isDeloadWeek(weekIndex, options.deload_every);
  const next: ProgrammeWorkItemDraft = { ...target };
  if (source.load_mode === "percent_1rm" && target.load_mode === "percent_1rm") {
    const low = clamp(source.percent_1rm + options.pct_step * steps - (deload ? 10 : 0), 30, 100);
    next.percent_1rm = tidy(low);
    next.percent_1rm_max = tidy(clamp(source.percent_1rm_max + (low - source.percent_1rm), low, 100));
  }
  else if (source.load_mode === "fixed_weight" && target.load_mode === "fixed_weight") {
    const scale = deload ? 0.9 : 1;
    const low = Math.max(0.5, roundTo((source.weight_value + options.kg_step * steps) * scale, 0.5));
    next.weight_value = tidy(low);
    next.weight_value_max = tidy(Math.max(low, roundTo((source.weight_value_max + options.kg_step * steps) * scale, 0.5)));
  }
  else if (source.load_mode === "rpe" && target.load_mode === "rpe") {
    next.rpe_value = tidy(clamp(roundTo(source.rpe_value + options.rpe_step * steps - (deload ? 1.5 : 0), 0.5), 5, 10));
  }
  if (source.prescription_mode === "reps" && target.prescription_mode === "reps" && options.reps_step !== 0 && !deload) {
    next.planned_reps = clamp(source.planned_reps + options.reps_step * steps, 1, 100);
    next.rep_min = clamp(source.rep_min + options.reps_step * steps, 1, 100);
    next.rep_max = clamp(source.rep_max + options.reps_step * steps, next.rep_min, 100);
  }
  if (deload) {
    next.planned_sets = Math.max(1, source.planned_sets - 1);
    next.planned_sets_max = Math.max(next.planned_sets, source.planned_sets_max - 1);
  }
  return next;
}

// The block's weeks with weeks 2.. progressed from week 1.
export function progressBlockWeeks(weeks: readonly ProgrammeWeekDraft[], options: ProgressionOptions): ProgrammeWeekDraft[] {
  const first = weeks[0];
  if (!first) return [...weeks];
  return weeks.map((week, weekIndex) => {
    if (weekIndex === 0) return week;
    return {
      ...week,
      sessions: week.sessions.map((session, sessionIndex) => ({
        ...session,
        work_items: session.work_items.map((item, itemIndex) => {
          const source = first.sessions[sessionIndex]?.work_items[itemIndex];
          if (!source || source.exercise_id !== item.exercise_id || !progresses(source, options.scope)) return item;
          return progressItem(source, item, weekIndex, options);
        })
      }))
    };
  });
}

function loadLabel(item: ProgrammeWorkItemDraft): string {
  const reps = item.prescription_mode === "reps" ? `${item.planned_sets}×${item.rep_mode === "range" ? `${item.rep_min}-${item.rep_max}` : item.planned_reps}` : `${item.planned_sets} sets`;
  if (item.load_mode === "percent_1rm") return `${reps} @ ${item.percent_1rm}%`;
  if (item.load_mode === "fixed_weight") return `${reps} @ ${item.weight_value} ${item.weight_unit}`;
  if (item.load_mode === "rpe") return `${reps} @ RPE ${item.rpe_value}`;
  return reps;
}

export type ProgressionPreviewRow = { label: string; weeks: string[] };

// One line per progressed exercise in week 1 (up to `limit`), week by week.
export function progressionPreview(weeks: readonly ProgrammeWeekDraft[], options: ProgressionOptions, name: (exerciseId: string) => string, limit = 4): ProgressionPreviewRow[] {
  const result = progressBlockWeeks(weeks, options);
  const rows: ProgressionPreviewRow[] = [];
  (weeks[0]?.sessions ?? []).forEach((session, sessionIndex) => {
    session.work_items.forEach((item, itemIndex) => {
      if (rows.length >= limit || !progresses(item, options.scope)) return;
      rows.push({
        label: `${session.title || `Session ${sessionIndex + 1}`}: ${name(item.exercise_id)}`,
        weeks: result.map((week, weekIndex) => {
          const at = week.sessions[sessionIndex]?.work_items[itemIndex];
          if (!at || at.exercise_id !== item.exercise_id) return "-";
          return `${loadLabel(at)}${isDeloadWeek(weekIndex, options.deload_every) ? " (deload)" : ""}`;
        })
      });
    });
  });
  return rows;
}
