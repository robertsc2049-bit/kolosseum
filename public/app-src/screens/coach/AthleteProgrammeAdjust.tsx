import React, { useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { request, type JsonRecord } from "../../api/transport";

// Adjusting the programme for this athlete only: their next sessions, and for
// any exercise fewer sets, other reps, a weight or an RPE, leaving it out, or
// a note - without copying the programme for the whole squad. The change is
// used when that session is created.

const newRequestId = () => `po_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
async function csrf(): Promise<string> {
  const account = await loadAccountDetail();
  return typeof account.csrf_token === "string" ? account.csrf_token : "";
}
type Upcoming = { session_index: number; title: string; week_number: number; exercises: JsonRecord[] };

export function upcomingSessions(data: JsonRecord, count = 6): Upcoming[] {
  const blocks = Array.isArray(data.blocks) ? (data.blocks as JsonRecord[]) : [];
  return blocks.flatMap((block) => (block.weeks as JsonRecord[]).flatMap((week) => (week.sessions as JsonRecord[])
    .filter((session) => session.state === "current" || session.state === "upcoming")
    .map((session) => ({ session_index: Number(session.session_index), title: String(session.title ?? ""), week_number: Number(week.week_number), exercises: (session.exercises as JsonRecord[]).filter((exercise) => exercise.segment === "working") }))))
    .slice(0, count);
}

export function overrideSummary(override: JsonRecord): string {
  if (override.remove === true) return "Left out";
  return [
    override.sets !== undefined ? `${override.sets} sets` : "",
    override.reps !== undefined ? `${override.reps} reps` : "",
    override.load_kg !== undefined ? `${override.load_kg} kg` : "",
    override.rpe !== undefined ? `RPE ${override.rpe}` : "",
    override.note ? `"${String(override.note)}"` : ""
  ].filter(Boolean).join(", ");
}

function AdjustForm({ athleteUserId, sessionIndex, exercise, onDone }: { athleteUserId: string; sessionIndex: number; exercise: JsonRecord; onDone: () => void }) {
  const [form, setForm] = useState({ sets: "", reps: "", load_kg: "", rpe: "", remove: false, note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId] = useState(newRequestId);
  async function save() {
    setBusy(true);
    setError(null);
    const value = (text: string) => (text.trim() === "" ? undefined : Number(text));
    try {
      await request("POST", `/coach-workspace/athletes/${encodeURIComponent(athleteUserId)}/programme-overrides`, {
        session_index: sessionIndex, exercise_id: exercise.exercise_id, client_request_id: requestId,
        ...(form.remove ? { remove: true } : { sets: value(form.sets), reps: value(form.reps), load_kg: value(form.load_kg), rpe: value(form.rpe) }),
        ...(form.note.trim() ? { note: form.note.trim() } : {})
      }, await csrf());
      onDone();
    }
    catch { setError("That change couldn't be saved. Use a weight or an RPE, not both, and whole numbers for sets and reps."); }
    finally { setBusy(false); }
  }
  const set = (key: "sets" | "reps" | "load_kg" | "rpe" | "note") => (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: event.target.value });
  return (
    <div className="programme-adjust-form" data-testid="programme-adjust-form">
      <label className="checkbox-field"><input type="checkbox" checked={form.remove} onChange={(event) => setForm({ ...form, remove: event.target.checked })} /><span>Leave it out</span></label>
      {!form.remove ? (
        <>
          <label className="field"><span>Sets</span><input type="number" inputMode="numeric" min={1} max={30} value={form.sets} onChange={set("sets")} placeholder={String(exercise.sets ?? "")} /></label>
          <label className="field"><span>Reps</span><input type="number" inputMode="numeric" min={1} max={100} value={form.reps} onChange={set("reps")} placeholder={String(exercise.reps ?? "")} /></label>
          <label className="field"><span>Weight (kg)</span><input type="number" inputMode="decimal" step="0.5" value={form.load_kg} onChange={set("load_kg")} /></label>
          <label className="field"><span>or RPE</span><input type="number" inputMode="decimal" step="0.5" min={1} max={10} value={form.rpe} onChange={set("rpe")} /></label>
        </>
      ) : null}
      <label className="field programme-adjust-note"><span>Note for the athlete (optional)</span><input type="text" maxLength={200} value={form.note} onChange={set("note")} placeholder="e.g. keep it pain-free" /></label>
      <button type="button" className="button small-button" disabled={busy} onClick={() => void save()}>Save for this athlete</button>
      {error ? <p className="muted small" role="alert">{error}</p> : null}
    </div>
  );
}

export function AthleteProgrammeAdjust({ athleteUserId }: { athleteUserId: string }) {
  const [data, setData] = useState<JsonRecord | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    try { setData(await request("GET", `/coach-workspace/athletes/${encodeURIComponent(athleteUserId)}/programme-print`)); setError(null); }
    catch { setError("The programme couldn't be loaded."); }
  };
  async function clear(sessionIndex: number, exerciseId: string) {
    try {
      await request("POST", `/coach-workspace/athletes/${encodeURIComponent(athleteUserId)}/programme-overrides/clear`, { session_index: sessionIndex, exercise_id: exerciseId }, await csrf());
      await load();
    }
    catch { setError("That change couldn't be undone. Try again."); }
  }
  if (!open) return <button type="button" className="button secondary small-button" onClick={() => { setOpen(true); void load(); }}>Adjust for this athlete</button>;
  const sessions = data ? upcomingSessions(data) : [];
  return (
    <section className="programme-adjust" data-testid="programme-adjust">
      <div className="panel-header"><h4>Adjust for this athlete</h4><button type="button" className="text-button" onClick={() => setOpen(false)}>Close</button></div>
      <p className="muted small">Changes here are for this athlete only - the programme stays the same for everyone else. They're used when the session is created.</p>
      {error ? <p className="muted small" role="alert">{error}</p> : null}
      {data && data.status !== "active" ? <p className="muted small">Only a programme you assigned, with sessions still to come, can be adjusted.</p> : null}
      {sessions.map((session) => (
        <div key={session.session_index} className="programme-adjust-session">
          <h5>{`Week ${session.week_number} · ${session.title}`}</h5>
          <ul className="analysis-plain-list">
            {session.exercises.map((exercise) => {
              const key = `${session.session_index}|${String(exercise.exercise_id)}`;
              const override = exercise.override as JsonRecord | undefined;
              return (
                <li key={key}>
                  <span>{`${String(exercise.name)}: ${exercise.sets}x${String(exercise.reps)}${exercise.load ? ` · ${String(exercise.load)}` : ""}`}</span>
                  {override ? <strong className="programme-adjust-change">{` → ${overrideSummary(override)}`}</strong> : null}
                  {override ? <button type="button" className="text-button" onClick={() => void clear(session.session_index, String(exercise.exercise_id))}>Undo</button>
                    : <button type="button" className="text-button" aria-label={`Adjust ${String(exercise.name)} in week ${session.week_number}`} onClick={() => setEditing(editing === key ? null : key)}>Adjust</button>}
                  {editing === key ? <AdjustForm athleteUserId={athleteUserId} sessionIndex={session.session_index} exercise={exercise} onDone={() => { setEditing(null); void load(); }} /> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
