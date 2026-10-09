import React, { useEffect, useState } from "react";

import { loadTrainingWeek, saveTrainingWeek } from "../../api/athleteOnboardingClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";
import { type DayItem, type ExerciseOption, TrainingDayEditor, newDayItem, toExerciseOption } from "../../components/TrainingDayEditor";

// "My training" (src/api/athlete_training_week_service.ts): an athlete without
// a coach builds one week - how many days, and on each day the exercises
// with sets and reps - and their sessions follow it, day by day, week after
// week. Weights come from their own way of setting them (build from what
// they lift, % of max, or RPE); an optional lighter week every 4th.

type Day = { items: DayItem[] };

const MAX_DAYS = 6;
const asDays = (value: unknown): Day[] => (Array.isArray(value) ? value : []).map((d) => ({
  items: (Array.isArray((d as JsonRecord)?.items) ? ((d as JsonRecord).items as JsonRecord[]) : []).map((i) => ({ exercise_id: String(i.exercise_id ?? ""), sets: Number(i.sets) || 3, reps: Number(i.reps) || 8 }))
}));

export function MyTrainingCard() {
  const [data, setData] = useState<JsonRecord | null>(null);
  const [editing, setEditing] = useState(false);
  const [days, setDays] = useState<Day[]>([{ items: [newDayItem()] }, { items: [newDayItem()] }, { items: [newDayItem()] }]);
  const [lighter, setLighter] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function apply(result: JsonRecord) {
    setData(result);
    const week = result.week && typeof result.week === "object" ? (result.week as JsonRecord) : null;
    if (week) {
      setDays(asDays(week.days));
      setLighter(week.lighter_every_fourth === true);
    }
  }

  useEffect(() => {
    let cancelled = false;
    loadTrainingWeek()
      .then((result) => { if (!cancelled) apply(result); })
      .catch(() => { if (!cancelled) setError("Your training could not be loaded. Try again."); });
    return () => { cancelled = true; };
  }, []);

  const options: ExerciseOption[] = Array.isArray(data?.exercise_options) ? (data!.exercise_options as JsonRecord[]).map(toExerciseOption) : [];
  const labelOf = (id: string) => options.find((o) => o.exercise_id === id)?.label ?? id;
  const week = data?.week && typeof data.week === "object" ? (data.week as JsonRecord) : null;
  const next = data?.next && typeof data.next === "object" ? (data.next as JsonRecord) : null;

  function setDayCount(count: number) {
    setDays((current) => Array.from({ length: count }, (_, i) => current[i] ?? { items: [newDayItem()] }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const account = await loadAccountDetail();
      const csrf = typeof account.csrf_token === "string" ? account.csrf_token : "";
      apply(await saveTrainingWeek({ days, lighter_every_fourth: lighter }, csrf));
      setEditing(false);
    }
    catch (caught) {
      const fields = (caught as { payload?: JsonRecord })?.payload?.field_errors as JsonRecord | undefined;
      setError(fields ? Object.values(fields).map(String).join(" ") : "Your training could not be saved. Try again.");
    }
    finally {
      setBusy(false);
    }
  }

  if (!data && !error) return null;

  return (
    <article className="onboarding-card my-training" data-testid="my-training">
      <p className="eyebrow">My training</p>
      <h3>{week ? `${days.length} day${days.length === 1 ? "" : "s"} a week` : "Build your training"}</h3>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {!editing ? (
        <>
          {week ? (
            <>
              {next ? (
                <p className="programme-position" data-testid="my-training-next">
                  {`Next: Day ${Number(next.day_number)} of ${Number(next.days_total)} · week ${Number(next.week_number)}${next.lighter === true ? " (lighter)" : ""}`}
                </p>
              ) : null}
              <ul className="my-training-days">
                {days.map((day, d) => (
                  <li key={d}><strong>{`Day ${d + 1}`}</strong>{` ${day.items.map((item) => `${labelOf(item.exercise_id)} ${item.sets}x${item.reps}`).join(" · ")}`}</li>
                ))}
              </ul>
              <p className="muted small">{lighter ? "Every 4th week is lighter (a set off everything)." : "No lighter weeks."} Your weights come from how you've chosen to set them.</p>
            </>
          ) : (
            <p className="muted">Choose your training days and the exercises for each - your sessions then follow it in order, week after week, with the weights set the way you've chosen. Until you do, your sessions come from Kolosseum's generated programme.</p>
          )}
          <div className="button-row">
            <button className="button primary" type="button" onClick={() => setEditing(true)}>{week ? "Edit my training" : "Build my training"}</button>
          </div>
        </>
      ) : (
        <>
          <label className="field">
            <span>Training days a week</span>
            <select value={days.length} onChange={(event) => setDayCount(Number(event.target.value))}>
              {Array.from({ length: MAX_DAYS }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          {days.map((day, d) => (
            <TrainingDayEditor key={d} label={`Day ${d + 1}`} items={day.items} options={options} onChange={(items) => setDays((current) => current.map((x, i) => (i === d ? { items } : x)))} />
          ))}
          <label className="checkbox-field">
            <input type="checkbox" checked={lighter} onChange={(event) => setLighter(event.target.checked)} />
            <span>A lighter week every 4th week (a set off everything)</span>
          </label>
          {week ? <p className="muted small">Changing your days or exercises starts your training again at Day 1.</p> : null}
          <div className="button-row">
            <button className="button primary" type="button" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save my training"}</button>
            <button className="button secondary" type="button" onClick={() => { if (data) apply(data); setError(null); setEditing(false); }}>Cancel</button>
          </div>
        </>
      )}
    </article>
  );
}
