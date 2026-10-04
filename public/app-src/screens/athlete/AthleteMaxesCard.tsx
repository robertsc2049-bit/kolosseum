import React, { useEffect, useState } from "react";

import { loadAthleteMaxes, saveAthleteMaxes } from "../../api/athleteOnboardingClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";

// How a self-directed athlete's weights are set, and their maxes:
// - build from what they lift (the beginner default): each session's weight
//   comes from the last one - every rep made, a little more;
// - % of their max: the maxes below (or the estimate from what they actually
//   lifted, offered here) turn each percentage into a weight;
// - RPE: an effort target.

type Method = "progression" | "percent_1rm" | "rpe";
const METHODS: Array<[Method, string, string]> = [
  ["progression", "Build from what you lift", "Each session's weight comes from your last one: make every rep and it goes up a little; miss reps and you repeat it. Best if you're new to lifting."],
  ["percent_1rm", "% of your max", "Enter a tested or estimated max for each lift below - each weight is worked out from it. Without one, we use the estimate from what you've logged."],
  ["rpe", "RPE (effort)", "You choose the weight by how hard it feels - RPE 8 means about 2 reps left in the tank."]
];
const methodOf = (value: unknown): Method => (value === "progression" || value === "rpe" ? value : "percent_1rm");

type Row = { exercise_id: string; display_name: string; value: string; unit: "kg" | "lb"; basis: "tested_1rm" | "estimated_1rm"; from_training: JsonRecord | null };

function rowsFrom(result: JsonRecord): Row[] {
  const lifts = Array.isArray(result.lifts) ? (result.lifts as JsonRecord[]) : [];
  const unit = result.preferred_weight_unit === "lb" ? "lb" : "kg";
  return lifts.map((lift) => {
    const entered = lift.entered as JsonRecord | null;
    return {
      exercise_id: String(lift.exercise_id),
      display_name: String(lift.display_name ?? lift.exercise_id),
      value: entered ? String(entered.value) : "",
      unit: entered?.unit === "lb" ? "lb" : entered?.unit === "kg" ? "kg" : unit,
      basis: entered?.basis === "estimated_1rm" ? "estimated_1rm" : "tested_1rm",
      from_training: (lift.from_training as JsonRecord | null) ?? null
    };
  });
}

export function AthleteMaxesCard() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [method, setMethod] = useState<Method>("percent_1rm");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<JsonRecord>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadAthleteMaxes()
      .then((result) => { if (!cancelled) { setRows(rowsFrom(result)); setMethod(methodOf(result.loading_method)); } })
      .catch(() => { if (!cancelled) setError("Your maxes could not be loaded. Try again."); });
    return () => { cancelled = true; };
  }, []);

  function update(index: number, patch: Partial<Row>) {
    setSaved(false);
    setRows((current) => (current ?? []).map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function save() {
    if (!rows) return;
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      const account = await loadAccountDetail();
      const csrf = typeof account.csrf_token === "string" ? account.csrf_token : "";
      const maxes = rows.filter((row) => row.value.trim()).map((row) => ({
        exercise_id: row.exercise_id, value: Number(row.value), unit: row.unit, basis: row.basis
      }));
      const unit = rows.find((row) => row.value.trim())?.unit ?? "kg";
      const result = await saveAthleteMaxes({ preferred_weight_unit: unit, maxes, loading_method: method }, csrf);
      setRows(rowsFrom(result));
      setMethod(methodOf(result.loading_method));
      setSaved(true);
    }
    catch (caught) {
      const payload = (caught as { payload?: JsonRecord })?.payload;
      setFieldErrors((payload?.field_errors as JsonRecord | undefined) ?? {});
      setError("Some maxes could not be saved - check the highlighted lifts.");
    }
    finally {
      setSaving(false);
    }
  }

  if (!rows && !error) return null;
  const hint = METHODS.find(([value]) => value === method)?.[2] ?? "";

  return (
    <article className="onboarding-card athlete-maxes" data-testid="athlete-maxes">
      <p className="eyebrow">Your weights</p>
      <h3>How your weights are set</h3>
      <fieldset className="choice-chips loading-method">
        <legend>Set my weights by</legend>
        {METHODS.map(([value, label]) => (
          <label key={value} className="choice-chip">
            <input type="radio" name="loading-method" checked={method === value} onChange={() => { setSaved(false); setMethod(value); }} />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      <p className="choice-hint">{hint}</p>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {saved ? <p className="muted" role="status">Saved.</p> : null}
      {method === "percent_1rm" ? (rows ?? []).map((row, index) => (
        <div className="athlete-max-row" key={row.exercise_id}>
          <strong>{row.display_name}</strong>
          <label className="field">
            <span>Max</span>
            <input
              aria-label={`${row.display_name} max`}
              inputMode="decimal"
              value={row.value}
              onChange={(event) => update(index, { value: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Unit</span>
            <select aria-label={`${row.display_name} unit`} value={row.unit} onChange={(event) => update(index, { unit: event.target.value === "lb" ? "lb" : "kg" })}>
              <option value="kg">kg</option>
              <option value="lb">lb</option>
            </select>
          </label>
          <label className="field">
            <span>Source</span>
            <select aria-label={`${row.display_name} source`} value={row.basis} onChange={(event) => update(index, { basis: event.target.value === "estimated_1rm" ? "estimated_1rm" : "tested_1rm" })}>
              <option value="tested_1rm">Tested 1RM</option>
              <option value="estimated_1rm">Estimated</option>
            </select>
          </label>
          {row.from_training ? (
            <p className="muted small">
              {`From your training: ${Number(row.from_training.value)} ${String(row.from_training.unit)} estimated max`}
              {!row.value ? (
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => update(index, { value: String(row.from_training?.value), unit: row.from_training?.unit === "lb" ? "lb" : "kg", basis: "estimated_1rm" })}
                >
                  Use this
                </button>
              ) : null}
            </p>
          ) : null}
          {fieldErrors[row.exercise_id] ? <p className="field-error" role="alert">{String(fieldErrors[row.exercise_id])}</p> : null}
        </div>
      )) : null}
      <div className="onboarding-actions">
        <button className="button primary" type="button" disabled={saving} onClick={() => void save()}>{method === "percent_1rm" ? "Save maxes" : "Save"}</button>
      </div>
    </article>
  );
}
