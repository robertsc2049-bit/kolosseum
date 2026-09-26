import React, { useCallback, useEffect, useState } from "react";

import { loadProgrammeExercises, saveProgrammeExercises } from "../../api/athleteOnboardingClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";
import { titleCase } from "../../utils/format";

// The athlete chooses their own exercise for every open slot of their
// programme; only competition lifts (and timed-group workouts) are named.
// Nothing is pre-selected: an empty slot stays empty until they choose, and
// a session with an empty slot does not start.

function doseText(prescription: JsonRecord | null | undefined): string {
  if (!prescription) return "";
  const sets = Number(prescription.sets);
  const dose = prescription.distance_m !== undefined ? `${Number(prescription.distance_m)} m`
    : prescription.duration_seconds !== undefined ? `${Number(prescription.duration_seconds)} s`
      : `${Number(prescription.reps)}`;
  const intensity = prescription.intensity as JsonRecord | undefined;
  const effort = intensity?.type === "percent_1rm" ? ` @ ${Number(intensity.value)}%`
    : intensity?.type === "rpe" ? ` @ RPE ${Number(intensity.value)}` : "";
  return Number.isFinite(sets) ? `${sets} × ${dose}${effort}` : "";
}

function slotLabel(item: JsonRecord): string {
  const pattern = titleCase(String(item.movement_pattern_id ?? "exercise"));
  return item.explosive === true ? `${pattern} (explosive)` : pattern;
}

export function ProgrammeExercisesCard() {
  const [data, setData] = useState<JsonRecord | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<JsonRecord>({});
  const [saved, setSaved] = useState(false);

  const apply = useCallback((next: JsonRecord) => {
    setData(next);
    setDraft({ ...((next.selections as Record<string, string> | undefined) ?? {}) });
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadProgrammeExercises()
      .then((next) => { if (!cancelled) apply(next); })
      .catch(() => { if (!cancelled) setError("Your programme exercises could not be loaded. Try again."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [apply]);

  async function save() {
    setSaving(true);
    setError(null);
    setFieldErrors({});
    setSaved(false);
    try {
      const account = await loadAccountDetail();
      const csrf = typeof account.csrf_token === "string" ? account.csrf_token : "";
      apply(await saveProgrammeExercises(draft, csrf));
      setSaved(true);
      setEditing(false);
    }
    catch (caught) {
      const payload = (caught as { payload?: JsonRecord })?.payload;
      setFieldErrors((payload?.field_errors as JsonRecord | undefined) ?? {});
      setError("Some choices could not be saved - check the highlighted slots.");
    }
    finally {
      setSaving(false);
    }
  }

  if (loading) return <article className="onboarding-card"><p className="muted">Loading your programme exercises…</p></article>;
  if (!data || data.status !== "ok") {
    return error ? <article className="onboarding-card"><p role="alert">{error}</p></article> : null;
  }

  const days = Array.isArray(data.days) ? (data.days as JsonRecord[]) : [];
  const open = Number(data.open_slot_count ?? 0);
  if (open === 0) return null;
  const chosen = open - (Array.isArray(data.missing_slot_ids) ? data.missing_slot_ids.length : 0);

  return (
    <article className="onboarding-card programme-exercises" data-testid="programme-exercises">
      <p className="eyebrow">Your programme exercises</p>
      <h3>{`${chosen} of ${open} exercises chosen`}</h3>
      <p>Your programme names only your competition lifts. For everything else you choose the exercise - from ones that train the same thing and suit your level.</p>
      {data.complete !== true ? (
        <p className="onboarding-boundary" role="status">Choose an exercise for every open slot before your next session.</p>
      ) : null}
      {saved ? <p className="muted" role="status">Your exercises are saved.</p> : null}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {!editing ? (
        <div className="onboarding-actions">
          <button className="button primary" type="button" onClick={() => setEditing(true)}>{chosen === 0 ? "Choose exercises" : "Change exercises"}</button>
        </div>
      ) : (
        <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
          {days.map((day) => {
            const items = Array.isArray(day.items) ? (day.items as JsonRecord[]) : [];
            const usedInDay = new Set<string>([
              ...items.filter((i) => i.kind === "fixed").map((i) => String(i.exercise_id)),
              ...items.filter((i) => i.kind === "slot").map((i) => draft[String(i.slot_id)]).filter(Boolean)
            ]);
            return (
              <fieldset className="programme-day" key={String(day.day_id)}>
                <legend>{titleCase(String(day.focus ?? day.day_id))}</legend>
                <ul className="programme-day-items">
                  {items.map((item, index) => {
                    if (item.kind === "fixed") {
                      return (
                        <li key={`fixed-${index}`} className="programme-item fixed">
                          <strong>{String(item.display_name ?? item.exercise_id)}</strong>
                          <span className="badge neutral">Named in your programme</span>
                          <small>{doseText(item.prescription as JsonRecord)}</small>
                        </li>
                      );
                    }
                    const slotId = String(item.slot_id);
                    const options = Array.isArray(item.options) ? (item.options as JsonRecord[]) : [];
                    const current = draft[slotId] ?? "";
                    const fieldError = fieldErrors[slotId];
                    return (
                      <li key={slotId} className="programme-item slot">
                        <label className="field">
                          <span>{`${slotLabel(item)} · ${doseText(item.prescription as JsonRecord)}`}</span>
                          <select
                            aria-label={`${titleCase(String(day.focus ?? day.day_id))}: ${slotLabel(item)}`}
                            value={current}
                            onChange={(event) => setDraft((prev) => {
                              const next = { ...prev };
                              if (event.target.value) next[slotId] = event.target.value;
                              else delete next[slotId];
                              return next;
                            })}
                          >
                            <option value="">Choose an exercise</option>
                            {options.map((option) => {
                              const id = String(option.exercise_id);
                              return (
                                <option key={id} value={id} disabled={id !== current && usedInDay.has(id)}>
                                  {String(option.display_name ?? id)}
                                </option>
                              );
                            })}
                          </select>
                        </label>
                        {fieldError ? <p className="field-error" role="alert">{String(fieldError)}</p> : null}
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            );
          })}
          <div className="onboarding-actions">
            <button className="button secondary" type="button" onClick={() => { setEditing(false); setDraft({ ...((data.selections as Record<string, string>) ?? {}) }); }}>Cancel</button>
            <button className="button primary" type="submit" disabled={saving}>Save exercises</button>
          </div>
        </form>
      )}
    </article>
  );
}
