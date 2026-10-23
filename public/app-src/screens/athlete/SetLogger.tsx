import React, { useState } from "react";

import { type JsonRecord } from "../../api/transport";

// Per-set logging for the current prescribed exercise: one row per set,
// pre-filled with the prescription (reps, and the resolved load when the
// programme gives one), so logging a set as prescribed is one tap and a
// missed rep or different load is one edit. Distance- and time-dosed work
// (carries, sleds, sprints, holds) is logged by completing the exercise.

type Load = { value: number; unit: "kg" | "lb" } | null;
type LogSet = (exerciseId: string, setIndex: number, reps: number, load: Load, velocity?: number | null, missedPart?: "clean" | "jerk" | null) => Promise<boolean | null>;
// A clean & jerk can be missed on the clean or the jerk: worth knowing which.
const isCleanAndJerk = (exerciseId: string) => /^clean_and_jerk(__r[0-9]+)?$/u.test(exerciseId);

// Bar speed from a VBT device: shown only for athletes who switch it on
// (remembered on this phone).
const SPEED_KEY = "kolosseum.logBarSpeed";
function readSpeedSetting(): boolean {
  try { return window.localStorage.getItem(SPEED_KEY) === "1"; }
  catch { return false; }
}
function writeSpeedSetting(on: boolean): void {
  try { window.localStorage.setItem(SPEED_KEY, on ? "1" : "0"); }
  catch { /* not remembered: fine */ }
}

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
  const start = exercise.starting_load as JsonRecord | null | undefined;
  if (start && Number.isFinite(Number(start.value))) {
    return { value: String(Number(start.value)), unit: start.unit === "lb" ? "lb" : "kg" };
  }
  return { value: "", unit: "kg" };
}

function formatLogged(log: JsonRecord): string {
  const load = log.load_value !== null && log.load_value !== undefined ? ` × ${Number(log.load_value)} ${String(log.load_unit ?? "kg")}` : "";
  const speed = log.velocity_mps !== null && log.velocity_mps !== undefined ? ` · ${Number(log.velocity_mps).toFixed(2)} m/s` : "";
  const missed = log.missed_part === "clean" || log.missed_part === "jerk" ? ` · missed the ${String(log.missed_part)}` : "";
  return `${Number(log.reps)} reps${load}${speed}${missed}${log.is_pr === true ? " · PR" : ""}${log.pending === true ? " · saved on this phone" : ""}`;
}

function SetRow({ exerciseId, setIndex, optional = false, defaults, logged, busy, logSet, speedOn = false }: {
  speedOn?: boolean;
  exerciseId: string;
  setIndex: number;
  optional?: boolean;
  defaults: { reps: number; load: string; unit: "kg" | "lb" };
  logged: JsonRecord | undefined;
  busy: boolean;
  logSet: LogSet;
}) {
  const [editing, setEditing] = useState(false);
  const [reps, setReps] = useState(String(logged ? logged.reps : defaults.reps));
  const [load, setLoad] = useState(logged && logged.load_value !== null && logged.load_value !== undefined ? String(logged.load_value) : defaults.load);
  const [error, setError] = useState<string | null>(null);
  const [speed, setSpeed] = useState(logged && logged.velocity_mps !== null && logged.velocity_mps !== undefined ? String(logged.velocity_mps) : "");
  const [missed, setMissed] = useState<"" | "clean" | "jerk">(logged?.missed_part === "clean" || logged?.missed_part === "jerk" ? logged.missed_part as "clean" | "jerk" : "");

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
    const speedText = speed.trim();
    const speedNumber = Number(speedText);
    if (speedOn && speedText && (!Number.isFinite(speedNumber) || speedNumber < 0.05 || speedNumber > 3)) {
      setError("Bar speed is in m/s, between 0.05 and 3 - or leave it blank.");
      return;
    }
    setError(null);
    const result = await logSet(exerciseId, setIndex, repsNumber, trimmed ? { value: loadNumber, unit: defaults.unit } : null, speedOn && speedText ? speedNumber : null, isCleanAndJerk(exerciseId) && missed ? missed : null);
    if (result !== null) setEditing(false);
  }

  if (logged && !editing) {
    return (
      <li className="set-log-row logged" data-testid={`set-log-${setIndex}`}>
        <span>{optional ? `Set ${setIndex} (optional)` : `Set ${setIndex}`}</span>
        <strong>{formatLogged(logged)}</strong>
        <button className="button secondary small-button" type="button" disabled={busy} onClick={() => setEditing(true)}>Edit</button>
      </li>
    );
  }

  return (
    <li className="set-log-row" data-testid={`set-log-${setIndex}`}>
      <span>{optional ? `Set ${setIndex} (optional)` : `Set ${setIndex}`}</span>
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
      {speedOn ? (
        <label className="set-log-field set-log-speed">
          <span className="visually-hidden">{`Set ${setIndex} bar speed (m/s)`}</span>
          <input aria-label={`Set ${setIndex} bar speed (m/s)`} type="number" inputMode="decimal" step="0.01" min={0.05} max={3} placeholder="m/s" value={speed} onChange={(event) => setSpeed(event.target.value)} />
        </label>
      ) : null}
      {isCleanAndJerk(exerciseId) ? (
        <label className="set-log-field">
          <span className="visually-hidden">{`Set ${setIndex} missed`}</span>
          <select aria-label={`Set ${setIndex} missed`} value={missed} onChange={(event) => setMissed(event.target.value as "" | "clean" | "jerk")}>
            <option value="">Made it</option>
            <option value="clean">Missed the clean</option>
            <option value="jerk">Missed the jerk</option>
          </select>
        </label>
      ) : null}
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
  // A warm-up drill or cool-down stretch is done by completing it, not logged set by set.
  if (exercise.segment === "warm_up" || exercise.segment === "cool_down") return null;
  if (exercise.distance_value !== undefined || exercise.duration_seconds !== undefined || exercise.distance_range || exercise.duration_range) return null;

  const [speedOn, setSpeedOn] = useState(readSpeedSetting);
  const load = prescribedLoad(exercise);
  const defaults = { reps: prescribedReps(exercise), load: load.value, unit: load.unit };
  const bySet = new Map(setLogs.map((log) => [Number(log.set_index), log]));
  // A set range ("3–4 sets"): the sets beyond the least are offered as optional.
  const setRange = exercise.set_range && typeof exercise.set_range === "object" ? (exercise.set_range as JsonRecord) : null;
  const mostSets = Number.isInteger(setRange?.maximum) && Number(setRange?.maximum) > sets ? Number(setRange?.maximum) : sets;
  const loggedCount = [...bySet.keys()].filter((index) => index <= mostSets).length;

  return (
    <section className="set-logger" aria-label="Log your sets">
      <p className="eyebrow">{mostSets > sets ? `Sets logged: ${loggedCount} of ${sets}–${mostSets}` : `Sets logged: ${loggedCount} of ${sets}`}</p>
      <ul className="set-log-list">
        {Array.from({ length: mostSets }, (_, i) => i + 1).map((setIndex) => (
          <SetRow
            key={`${exerciseId}-${setIndex}-${bySet.has(setIndex) ? "logged" : "open"}`}
            exerciseId={exerciseId}
            setIndex={setIndex}
            optional={setIndex > sets}
            defaults={defaults}
            logged={bySet.get(setIndex)}
            busy={busy}
            logSet={logSet}
            speedOn={speedOn}
          />
        ))}
      </ul>
      {!defaults.load ? <p className="muted small set-log-hint">No weight set: leave the weight blank for bodyweight, or enter what you added (a weighted pull-up or dip) or used.</p> : null}
      <label className="set-log-speed-toggle">
        <input type="checkbox" checked={speedOn} onChange={(event) => { setSpeedOn(event.target.checked); writeSpeedSetting(event.target.checked); }} />
        <span>Log bar speed (from a VBT device)</span>
      </label>
    </section>
  );
}
