import React, { useState } from "react";

import { type JsonRecord } from "../../api/transport";

// Per-set logging for the current prescribed exercise: one row per set,
// pre-filled with the prescription (reps, and the resolved load when the
// programme gives one), so logging a set as prescribed is one tap and a
// missed rep or different load is one edit. Distance- and time-dosed work
// (carries, sleds, sprints, holds) is logged by completing the exercise.

type Load = { value: number; unit: "kg" | "lb" } | null;
type LogSet = (exerciseId: string, setIndex: number, reps: number, load: Load) => Promise<boolean | null>;

function prescribedReps(exercise: JsonRecord): number {
  const range = exercise.rep_range as JsonRecord | undefined;
  if (range && Number.isInteger(range.maximum)) return Number(range.maximum);
  return Number.isInteger(exercise.reps) ? Number(exercise.reps) : 0;
}

function prescribedLoad(exercise: JsonRecord): { value: string; unit: "kg" | "lb" } {
  const resolved = exercise.resolved_load as JsonRecord | null | undefined;
  if (resolved && Number.isFinite(Number(resolved.value))) {
    return { value: String(Number(resolved.value)), unit: resolved.unit === "lb" ? "lb" : "kg" };
  }
  const intensity = exercise.intensity as JsonRecord | undefined;
  if (intensity?.type === "load" && Number.isFinite(Number(intensity.value))) {
    return { value: String(Number(intensity.value)), unit: intensity.unit === "lb" ? "lb" : "kg" };
  }
  return { value: "", unit: "kg" };
}

function formatLogged(log: JsonRecord): string {
  const load = log.load_value !== null && log.load_value !== undefined ? ` × ${Number(log.load_value)} ${String(log.load_unit ?? "kg")}` : "";
  return `${Number(log.reps)} reps${load}${log.is_pr === true ? " · PR" : ""}`;
}

function SetRow({ exerciseId, setIndex, defaults, logged, busy, logSet }: {
  exerciseId: string;
  setIndex: number;
  defaults: { reps: number; load: string; unit: "kg" | "lb" };
  logged: JsonRecord | undefined;
  busy: boolean;
  logSet: LogSet;
}) {
  const [editing, setEditing] = useState(false);
  const [reps, setReps] = useState(String(logged ? logged.reps : defaults.reps));
  const [load, setLoad] = useState(logged && logged.load_value !== null && logged.load_value !== undefined ? String(logged.load_value) : defaults.load);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const repsNumber = Number(reps);
    if (!Number.isInteger(repsNumber) || repsNumber < 0 || repsNumber > 100) {
      setError("Enter the reps you completed (0-100).");
      return;
    }
    const trimmed = load.trim();
    const loadNumber = Number(trimmed);
    if (trimmed && (!Number.isFinite(loadNumber) || loadNumber === 0)) {
      setError("Enter the load, or leave it blank for bodyweight.");
      return;
    }
    setError(null);
    const result = await logSet(exerciseId, setIndex, repsNumber, trimmed ? { value: loadNumber, unit: defaults.unit } : null);
    if (result !== null) setEditing(false);
  }

  if (logged && !editing) {
    return (
      <li className="set-log-row logged" data-testid={`set-log-${setIndex}`}>
        <span>{`Set ${setIndex}`}</span>
        <strong>{formatLogged(logged)}</strong>
        <button className="button secondary small-button" type="button" disabled={busy} onClick={() => setEditing(true)}>Edit</button>
      </li>
    );
  }

  return (
    <li className="set-log-row" data-testid={`set-log-${setIndex}`}>
      <span>{`Set ${setIndex}`}</span>
      <label className="set-log-field">
        <span className="visually-hidden">{`Set ${setIndex} reps`}</span>
        <input aria-label={`Set ${setIndex} reps`} type="number" inputMode="numeric" min={0} max={100} value={reps} onChange={(event) => setReps(event.target.value)} />
      </label>
      <span aria-hidden="true">×</span>
      <label className="set-log-field">
        <span className="visually-hidden">{`Set ${setIndex} load (${defaults.unit})`}</span>
        <input aria-label={`Set ${setIndex} load (${defaults.unit})`} type="number" inputMode="decimal" step="0.5" placeholder="BW" value={load} onChange={(event) => setLoad(event.target.value)} />
      </label>
      <span>{defaults.unit}</span>
      <button className="button primary small-button" type="button" disabled={busy} onClick={submit}>{`Log set ${setIndex}`}</button>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </li>
  );
}

export function SetLogger({ exercise, setLogs, busy, logSet }: {
  exercise: JsonRecord;
  setLogs: JsonRecord[];
  busy: boolean;
  logSet: LogSet;
}) {
  const exerciseId = String(exercise.exercise_id ?? "");
  const sets = Number(exercise.sets);
  if (!exerciseId || !Number.isInteger(sets) || sets < 1) return null;
  if (exercise.distance_value !== undefined || exercise.duration_seconds !== undefined || exercise.distance_range || exercise.duration_range) return null;

  const load = prescribedLoad(exercise);
  const defaults = { reps: prescribedReps(exercise), load: load.value, unit: load.unit };
  const bySet = new Map(setLogs.map((log) => [Number(log.set_index), log]));
  const loggedCount = [...bySet.keys()].filter((index) => index <= sets).length;

  return (
    <section className="set-logger" aria-label="Log your sets">
      <p className="eyebrow">{`Sets logged: ${loggedCount} of ${sets}`}</p>
      <ul className="set-log-list">
        {Array.from({ length: sets }, (_, i) => i + 1).map((setIndex) => (
          <SetRow
            key={`${exerciseId}-${setIndex}-${bySet.has(setIndex) ? "logged" : "open"}`}
            exerciseId={exerciseId}
            setIndex={setIndex}
            defaults={defaults}
            logged={bySet.get(setIndex)}
            busy={busy}
            logSet={logSet}
          />
        ))}
      </ul>
    </section>
  );
}
