import React, { useCallback, useEffect, useState } from "react";

import { type CustomExercise, loadProgrammeExercises, saveProgrammeExercises } from "../../api/athleteOnboardingClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";
import { titleCase } from "../../utils/format";

// The athlete chooses their own exercise for every open slot of their
// programme; only competition lifts (and timed-group workouts) are named.
// Nothing is pre-selected: an empty slot stays empty until they choose, and
// a session with an empty slot does not start. Nothing is locked out either:
// the exercises that fit the slot are recommended first, every other
// exercise can still be chosen, the athlete can add their own, and the same
// exercise can fill more than one slot of a session (tracked as a separate
// entry). A choice outside the recommendations says why it is not one.

const NOT_RECOMMENDED = "Not one of the recommended exercises for this slot.";
const OWN_EXERCISE = "Your own exercise - make sure it trains what this slot is for.";
const REPEATED = "Also in this session - it will be tracked as a separate entry.";
const ADD_OWN = "__add_own__";
const MAX_OWN_NAME = 60;

// Must match the server's customExerciseIdFor: the same name is the same exercise.
export function ownExerciseIdFor(name: string): string {
  const slug = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48).replace(/_+$/g, "");
  return slug ? `custom_${slug}` : "";
}

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

function customList(value: unknown): CustomExercise[] {
  return Array.isArray(value)
    ? (value as JsonRecord[]).map((c) => ({ exercise_id: String(c.exercise_id), display_name: String(c.display_name) }))
    : [];
}

export function ProgrammeExercisesCard() {
  const [data, setData] = useState<JsonRecord | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [ownExercises, setOwnExercises] = useState<CustomExercise[]>([]);
  const [adding, setAdding] = useState<{ slotId: string; name: string; error: string | null } | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<JsonRecord>({});
  const [saved, setSaved] = useState(false);

  const apply = useCallback((next: JsonRecord) => {
    setData(next);
    setDraft({ ...((next.selections as Record<string, string> | undefined) ?? {}) });
    setOwnExercises(customList(next.custom_exercises));
    setAdding(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadProgrammeExercises()
      .then((next) => { if (!cancelled) apply(next); })
      .catch(() => { if (!cancelled) setError("Your programme exercises could not be loaded. Try again."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [apply]);

  function choose(slotId: string, value: string) {
    if (value === ADD_OWN) {
      setAdding({ slotId, name: "", error: null });
      return;
    }
    setDraft((prev) => {
      const next = { ...prev };
      if (value) next[slotId] = value;
      else delete next[slotId];
      return next;
    });
  }

  function addOwn() {
    if (!adding) return;
    const name = adding.name.trim().replace(/\s+/g, " ");
    const id = ownExerciseIdFor(name);
    if (!name || name.length > MAX_OWN_NAME || !id) {
      setAdding({ ...adding, error: `Name your exercise in 1 to ${MAX_OWN_NAME} characters, using letters or numbers.` });
      return;
    }
    setOwnExercises((prev) => (prev.some((c) => c.exercise_id === id) ? prev : [...prev, { exercise_id: id, display_name: name }]));
    setDraft((prev) => ({ ...prev, [adding.slotId]: id }));
    setAdding(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setFieldErrors({});
    setSaved(false);
    try {
      const account = await loadAccountDetail();
      const csrf = typeof account.csrf_token === "string" ? account.csrf_token : "";
      apply(await saveProgrammeExercises(draft, ownExercises, csrf));
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
  const allExercises = Array.isArray(data.all_exercises) ? (data.all_exercises as JsonRecord[]) : [];
  const savedSelections = (data.selections as Record<string, string> | undefined) ?? {};
  const ownIds = new Set(ownExercises.map((c) => c.exercise_id));

  return (
    <article className="onboarding-card programme-exercises" data-testid="programme-exercises">
      <p className="eyebrow">Your programme exercises</p>
      <h3>{`${chosen} of ${open} exercises chosen`}</h3>
      <p>Your programme names only your competition lifts. For everything else you choose the exercise. We recommend ones that train the same thing and suit your level, but you can choose any exercise, add your own, or use the same one more than once.</p>
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
            const dayName = titleCase(String(day.focus ?? day.day_id));
            // How many times each exercise is in this session (named lifts and choices).
            const uses = new Map<string, number>();
            for (const item of items) {
              const id = item.kind === "fixed" ? String(item.exercise_id) : draft[String(item.slot_id)];
              if (id) uses.set(id, (uses.get(id) ?? 0) + 1);
            }
            return (
              <fieldset className="programme-day" key={String(day.day_id)}>
                <legend>{dayName}</legend>
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
                    const recommended = new Set(options.map((option) => String(option.exercise_id)));
                    const others = allExercises.filter((exercise) => !recommended.has(String(exercise.exercise_id)));
                    const current = draft[slotId] ?? "";
                    const fieldError = fieldErrors[slotId];
                    const fitNote = !current || recommended.has(current) ? null
                      : ownIds.has(current) ? OWN_EXERCISE
                        : current === savedSelections[slotId] && item.selected_fit_note ? String(item.selected_fit_note) : NOT_RECOMMENDED;
                    const renderOption = (id: string, name: string) => <option key={id} value={id}>{name}</option>;
                    const label = `${dayName}: ${slotLabel(item)}`;
                    return (
                      <li key={slotId} className="programme-item slot">
                        <label className="field">
                          <span>{`${slotLabel(item)} · ${doseText(item.prescription as JsonRecord)}`}</span>
                          <select aria-label={label} value={current} onChange={(event) => choose(slotId, event.target.value)}>
                            <option value="">Choose an exercise</option>
                            <optgroup label="Recommended">
                              {options.map((o) => renderOption(String(o.exercise_id), String(o.display_name ?? o.exercise_id)))}
                            </optgroup>
                            {ownExercises.length ? (
                              <optgroup label="Your own exercises">{ownExercises.map((c) => renderOption(c.exercise_id, c.display_name))}</optgroup>
                            ) : null}
                            {others.length ? (
                              <optgroup label="All other exercises">
                                {others.map((o) => renderOption(String(o.exercise_id), String(o.display_name ?? o.exercise_id)))}
                              </optgroup>
                            ) : null}
                            <option value={ADD_OWN}>Add your own exercise…</option>
                          </select>
                        </label>
                        {adding?.slotId === slotId ? (
                          <div className="programme-own-exercise">
                            <label className="field">
                              <span>Your exercise</span>
                              <input
                                aria-label={`${label}: your exercise`}
                                maxLength={MAX_OWN_NAME}
                                value={adding.name}
                                onChange={(event) => setAdding({ ...adding, name: event.target.value, error: null })}
                                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addOwn(); } }}
                              />
                            </label>
                            <button className="button secondary" type="button" onClick={addOwn}>Add exercise</button>
                            <button className="button secondary" type="button" onClick={() => setAdding(null)}>Cancel</button>
                            {adding.error ? <p className="field-error" role="alert">{adding.error}</p> : null}
                          </div>
                        ) : null}
                        {fitNote ? <p className="muted programme-fit-note" role="note">{fitNote}</p> : null}
                        {current && (uses.get(current) ?? 0) > 1 ? <p className="muted programme-fit-note" role="note">{REPEATED}</p> : null}
                        {fieldError ? <p className="field-error" role="alert">{String(fieldError)}</p> : null}
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            );
          })}
          <div className="onboarding-actions">
            <button className="button secondary" type="button" onClick={() => { setEditing(false); apply(data); }}>Cancel</button>
            <button className="button primary" type="submit" disabled={saving}>Save exercises</button>
          </div>
        </form>
      )}
    </article>
  );
}
