import React from "react";

import { type JsonRecord } from "../api/transport";
import { TRAINING_DAY_OPTIONS, planDateKind } from "../utils/trainingPlan";

export const TRAINING_PLAN_KEYS = ["training_days_per_week", "season_start_date", "season_end_date", "competition_date", "no_fixed_date"] as const;

// The plan fields a declaration carries, without empty values (the server
// refuses an empty date or a false "no fixed date").
export function trainingPlanOf(fields: JsonRecord): JsonRecord {
  const out: JsonRecord = {};
  for (const key of TRAINING_PLAN_KEYS) {
    const value = fields[key];
    if (value !== undefined && value !== null && value !== "" && value !== false) out[key] = value;
  }
  return out;
}

// Training days per week plus the dates the athlete's year builds towards:
// season dates for team and racket sports, a competition date for every other
// competitive sport, nothing for general strength. "No fixed date" is an
// explicit choice that clears the dates.
export function TrainingPlanFields({ activityId, value, onChange }: {
  activityId: unknown;
  value: JsonRecord;
  onChange: (plan: JsonRecord) => void;
}) {
  const kind = planDateKind(activityId);
  const set = (patch: JsonRecord) => onChange(trainingPlanOf({ ...value, ...patch }));
  const noFixed = value.no_fixed_date === true;
  const days = value.training_days_per_week === undefined ? "" : String(value.training_days_per_week);

  return (
    <>
      <label className="field">
        <span>Training days per week</span>
        <select value={days} onChange={(event) => set({ training_days_per_week: event.target.value ? Number(event.target.value) : undefined })}>
          {days ? null : <option value="">Choose your training days</option>}
          {TRAINING_DAY_OPTIONS.map((n) => <option key={n} value={n}>{n === 1 ? "1 day" : `${n} days`}</option>)}
        </select>
      </label>
      {kind === "season" ? (
        <>
          <label className="field">
            <span>Season start</span>
            <input type="date" value={String(value.season_start_date ?? "")} disabled={noFixed} onChange={(event) => set({ season_start_date: event.target.value || undefined, no_fixed_date: undefined })} />
          </label>
          <label className="field">
            <span>Season end</span>
            <input type="date" value={String(value.season_end_date ?? "")} disabled={noFixed} onChange={(event) => set({ season_end_date: event.target.value || undefined, no_fixed_date: undefined })} />
          </label>
          <label className="onboarding-choice">
            <input type="checkbox" checked={noFixed} onChange={(event) => set(event.target.checked ? { no_fixed_date: true, season_start_date: undefined, season_end_date: undefined } : { no_fixed_date: undefined })} />
            <span><strong>No fixed season</strong><small>Train in alternating off-season and pre-season blocks until you know your dates.</small></span>
          </label>
        </>
      ) : null}
      {kind === "competition" ? (
        <>
          <label className="field">
            <span>Next competition date</span>
            <input type="date" value={String(value.competition_date ?? "")} disabled={noFixed} onChange={(event) => set({ competition_date: event.target.value || undefined, no_fixed_date: undefined })} />
          </label>
          <label className="onboarding-choice">
            <input type="checkbox" checked={noFixed} onChange={(event) => set(event.target.checked ? { no_fixed_date: true, competition_date: undefined } : { no_fixed_date: undefined })} />
            <span><strong>No fixed competition date</strong><small>Train in alternating general and specific blocks until you enter one.</small></span>
          </label>
        </>
      ) : null}
      {kind === "none" ? <p>Your programme runs in rolling 4-week blocks: three building weeks, then a lighter deload week.</p> : null}
    </>
  );
}
