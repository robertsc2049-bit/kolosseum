import React, { useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { request, type JsonRecord } from "../../api/transport";
import { ENTRY_AUTH_SUCCEEDED_EVENT } from "../entry/useEntryAuth";

// Training outside your sessions here - team practice, matches,
// conditioning, another sport: when, how long and how hard. Your coach sees
// it in your training load, so a heavy match week isn't mistaken for an easy
// one.

const KINDS: Array<[string, string]> = [["practice", "Team practice"], ["match", "Match"], ["conditioning", "Conditioning"], ["other_sport", "Other sport"]];
const kindLabel = (kind: unknown) => KINDS.find(([value]) => value === kind)?.[1] ?? "Training";
const todayIso = () => new Date().toISOString().slice(0, 10);
const newRequestId = () => `ot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

async function csrf(): Promise<string> {
  const account = await loadAccountDetail();
  return typeof account.csrf_token === "string" ? account.csrf_token : "";
}

export function OtherTrainingPanel() {
  const [entries, setEntries] = useState<JsonRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: todayIso(), kind: "practice", minutes: "", srpe: "", note: "", jumps: "", balls_bowled: "" });
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState(newRequestId);

  const load = () => {
    request("GET", "/account/onboarding/other-training")
      .then((result) => { setEntries(Array.isArray(result.entries) ? (result.entries as JsonRecord[]) : []); setError(null); })
      .catch(() => setEntries((current) => current ?? []));
  };
  useEffect(() => {
    load();
    document.addEventListener(ENTRY_AUTH_SUCCEEDED_EVENT, load);
    return () => document.removeEventListener(ENTRY_AUTH_SUCCEEDED_EVENT, load);
  }, []);

  const minutes = Number(form.minutes);
  const srpe = Number(form.srpe);
  const valid = Number.isInteger(minutes) && minutes >= 1 && minutes <= 300 && form.srpe !== "" && srpe >= 0 && srpe <= 10 && Boolean(form.date);

  async function add() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const count = (value: string) => (value.trim() !== "" && Number.isInteger(Number(value)) ? Number(value) : undefined);
      await request("POST", "/account/onboarding/other-training", {
        date: form.date, kind: form.kind, minutes, srpe, note: form.note.trim(), client_request_id: requestId,
        ...(count(form.jumps) !== undefined ? { jumps: count(form.jumps) } : {}), ...(count(form.balls_bowled) !== undefined ? { balls_bowled: count(form.balls_bowled) } : {})
      }, await csrf());
      setForm({ date: todayIso(), kind: form.kind, minutes: "", srpe: "", note: "", jumps: "", balls_bowled: "" });
      setRequestId(newRequestId());
      setOpen(false);
      load();
    }
    catch {
      setError("That didn't save. Check your connection and try again.");
    }
    finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await request("POST", "/account/onboarding/other-training/remove", { id }, await csrf());
      load();
    }
    catch {
      setError("That couldn't be removed. Try again.");
    }
    finally {
      setBusy(false);
    }
  }

  const recent = (entries ?? []).slice(0, 5);
  return (
    <section className="panel other-training" data-testid="other-training">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Other training</p>
          <h3>Practice, matches and conditioning</h3>
        </div>
        {!open ? <button type="button" className="button secondary small-button" onClick={() => setOpen(true)}>Log training</button> : null}
      </div>
      <p className="muted small">Training outside your sessions here counts towards your load - your coach sees a heavy match week for what it is.</p>
      {open ? (
        <div className="other-training-form">
          <label className="field"><span>Date</span><input type="date" value={form.date} max={todayIso()} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
          <label className="field"><span>What</span>
            <select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>
              {KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="field"><span>Minutes</span><input type="number" inputMode="numeric" min={1} max={300} value={form.minutes} onChange={(event) => setForm({ ...form, minutes: event.target.value })} /></label>
          <label className="field"><span>How hard (0-10)</span><input type="number" inputMode="decimal" min={0} max={10} step={0.5} value={form.srpe} onChange={(event) => setForm({ ...form, srpe: event.target.value })} placeholder="e.g. 7" /></label>
          <label className="field"><span>Jumps (optional)</span><input type="number" inputMode="numeric" min={0} max={2000} value={form.jumps} onChange={(event) => setForm({ ...form, jumps: event.target.value })} placeholder="if counted" /></label>
          <label className="field"><span>Balls bowled (optional)</span><input type="number" inputMode="numeric" min={0} max={600} value={form.balls_bowled} onChange={(event) => setForm({ ...form, balls_bowled: event.target.value })} placeholder="cricket" /></label>
          <label className="field other-training-note"><span>Note (optional)</span><input type="text" maxLength={120} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="e.g. v Northside" /></label>
          <div className="report-actions">
            <button type="button" className="button small-button" disabled={!valid || busy} onClick={() => void add()}>{busy ? "Saving…" : "Save"}</button>
            <button type="button" className="button secondary small-button" onClick={() => setOpen(false)}>Cancel</button>
          </div>
          <p className="muted small">How hard: 0 rest, 3 moderate, 5 hard, 7 very hard, 10 maximal - for the whole session.</p>
        </div>
      ) : null}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {recent.length ? (
        <ul className="other-training-list">
          {recent.map((entry) => (
            <li key={String(entry.id)}>
              <span><strong>{kindLabel(entry.kind)}</strong>{` · ${String(entry.date)} · ${entry.minutes} min · ${entry.srpe}/10${typeof entry.jumps === "number" ? ` · ${entry.jumps} jumps` : ""}${typeof entry.balls_bowled === "number" ? ` · ${entry.balls_bowled} balls` : ""}${entry.note ? ` · ${String(entry.note)}` : ""}`}</span>
              <button type="button" className="text-button" disabled={busy} onClick={() => void remove(String(entry.id))}>Remove</button>
            </li>
          ))}
        </ul>
      ) : entries ? <p className="muted small">Nothing logged yet.</p> : null}
    </section>
  );
}
