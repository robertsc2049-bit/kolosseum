import React, { useMemo, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { request, type JsonRecord } from "../../api/transport";
import { TEST_OPTIONS } from "./TestingSection";
import { Explain } from "./analysisGuide";

// Getting a squad's data in on one screen: a squad session (everyone's
// effort for a team practice or match), a test day (one test, everyone's
// result), and an import from a GPS or heart-rate system's CSV export.

export type SquadAthlete = { athlete_user_id: string; display_name: string; email?: string | null };
const todayIso = () => new Date().toISOString().slice(0, 10);
const newRequestId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
async function csrf(): Promise<string> {
  const account = await loadAccountDetail();
  return typeof account.csrf_token === "string" ? account.csrf_token : "";
}

// ---------- CSV ----------
// A plain CSV parser: commas, quoted fields, doubled quotes, CRLF.
export function parseCsv(textInput: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const text = textInput.replace(/^﻿/u, "");
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === "\"" && text[i + 1] === "\"") { field += "\""; i += 1; }
      else if (ch === "\"") quoted = false;
      else field += ch;
    }
    else if (ch === "\"") quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field); field = "";
      if (row.some((cell) => cell.trim() !== "")) out.push(row);
      row = [];
    }
    else field += ch;
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) out.push(row);
  return out;
}

export const GPS_FIELDS: Array<{ key: string; label: string; guesses: RegExp }> = [
  { key: "athlete", label: "Athlete (name or email)", guesses: /^(player|athlete)?\s*(name|email)$|^player$|^athlete$/iu },
  { key: "date", label: "Date", guesses: /date|day/iu },
  { key: "duration_min", label: "Duration (min)", guesses: /duration|minutes|time \(min\)/iu },
  { key: "total_distance_m", label: "Total distance (m)", guesses: /total\s*distance|^distance/iu },
  { key: "hsr_m", label: "High-speed running (m)", guesses: /high[\s-]*speed|hsr|hs running/iu },
  { key: "sprint_m", label: "Sprint distance (m)", guesses: /sprint/iu },
  { key: "player_load", label: "Player load", guesses: /player\s*load|playerload|load/iu },
  { key: "avg_hr", label: "Average HR", guesses: /av(g|erage)\.?\s*(hr|heart)/iu },
  { key: "max_hr", label: "Max HR", guesses: /max\.?\s*(hr|heart)/iu }
];

export function guessMapping(headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {};
  for (const field of GPS_FIELDS) {
    const index = headers.findIndex((header, i) => field.guesses.test(header.trim()) && !Object.values(mapping).includes(i));
    if (index >= 0) mapping[field.key] = index;
  }
  return mapping;
}

// Dates as the exports write them: 2026-10-13, 13/10/2026 (UK) or 13.10.2026.
export function isoDate(value: string): string | null {
  const v = value.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/u.exec(v);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/u.exec(v);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

export function matchAthlete(value: string, athletes: SquadAthlete[]): SquadAthlete | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  const byEmail = athletes.find((athlete) => (athlete.email ?? "").toLowerCase() === v);
  if (byEmail) return byEmail;
  // By name only when exactly one athlete has it: two "Sam Lifter"s need an email.
  const byName = athletes.filter((athlete) => athlete.display_name.trim().toLowerCase() === v);
  return byName.length === 1 ? byName[0] : null;
}

// Names to show in the grids: the email beside any name shared by two athletes.
function labelled(athletes: SquadAthlete[]): Array<SquadAthlete & { label: string }> {
  const counts = new Map<string, number>();
  for (const athlete of athletes) counts.set(athlete.display_name.trim().toLowerCase(), (counts.get(athlete.display_name.trim().toLowerCase()) ?? 0) + 1);
  return athletes.map((athlete) => ({ ...athlete, label: (counts.get(athlete.display_name.trim().toLowerCase()) ?? 0) > 1 && athlete.email ? `${athlete.display_name} (${athlete.email})` : athlete.display_name }));
}

// ---------- the panel ----------
function SquadSession({ athletes }: { athletes: SquadAthlete[] }) {
  const [form, setForm] = useState({ date: todayIso(), kind: "practice", minutes: "90", note: "" });
  const [efforts, setEfforts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(() => newRequestId("sq"));
  const entries = athletes.filter((athlete) => efforts[athlete.athlete_user_id] !== undefined && efforts[athlete.athlete_user_id] !== "").map((athlete) => ({ athlete_user_id: athlete.athlete_user_id, srpe: Number(efforts[athlete.athlete_user_id]) }));
  const minutes = Number(form.minutes);
  const valid = entries.length > 0 && Number.isInteger(minutes) && minutes >= 1 && minutes <= 300 && entries.every((entry) => entry.srpe >= 0 && entry.srpe <= 10);
  async function save() {
    setBusy(true);
    setStatus(null);
    try {
      const result = await request("POST", "/coach-workspace/squad/sessions", { ...form, minutes, client_request_id: requestId, entries }, await csrf());
      const skipped = Array.isArray(result.skipped) ? result.skipped.length : 0;
      setStatus(`Saved for ${result.added} athlete${Number(result.added) === 1 ? "" : "s"}${skipped ? ` (${skipped} skipped)` : ""}.`);
      setEfforts({});
      setRequestId(newRequestId("sq"));
    }
    catch { setStatus("That didn't save. Check your connection and try again."); }
    finally { setBusy(false); }
  }
  return (
    <div className="squad-entry-body" data-testid="squad-session">
      <div className="other-training-form">
        <label className="field"><span>Date</span><input type="date" value={form.date} max={todayIso()} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
        <label className="field"><span>What</span>
          <select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>
            <option value="practice">Team practice</option><option value="match">Match</option><option value="conditioning">Conditioning</option><option value="other_sport">Other sport</option>
          </select>
        </label>
        <label className="field"><span>Minutes</span><input type="number" min={1} max={300} value={form.minutes} onChange={(event) => setForm({ ...form, minutes: event.target.value })} /></label>
        <label className="field other-training-note"><span>Note (optional)</span><input type="text" maxLength={120} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="e.g. v Northside" /></label>
      </div>
      <p className="muted small">Each athlete's effort for the whole session, 0-10 (ask them 30 minutes after). Leave blank for anyone who didn't take part.</p>
      <ul className="squad-grid">
        {labelled(athletes).map((athlete) => (
          <li key={athlete.athlete_user_id}>
            <span>{athlete.label}</span>
            <input type="number" inputMode="decimal" min={0} max={10} step={0.5} aria-label={`Effort for ${athlete.label}`} value={efforts[athlete.athlete_user_id] ?? ""} onChange={(event) => setEfforts({ ...efforts, [athlete.athlete_user_id]: event.target.value })} />
          </li>
        ))}
      </ul>
      <div className="report-actions"><button type="button" className="button small-button" disabled={!valid || busy} onClick={() => void save()}>{busy ? "Saving…" : `Save for ${entries.length} athlete${entries.length === 1 ? "" : "s"}`}</button></div>
      {status ? <p className="muted small" role="status">{status}</p> : null}
    </div>
  );
}

function TestDay({ athletes }: { athletes: SquadAthlete[] }) {
  const [testId, setTestId] = useState("cmj_cm");
  const [date, setDate] = useState(todayIso());
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(() => newRequestId("td"));
  const unit = TEST_OPTIONS.find(([id]) => id === testId)?.[2] ?? "";
  const entries = athletes.filter((athlete) => Number(values[athlete.athlete_user_id]) > 0).map((athlete) => ({ athlete_user_id: athlete.athlete_user_id, value: Number(values[athlete.athlete_user_id]) }));
  async function save() {
    setBusy(true);
    setStatus(null);
    try {
      const result = await request("POST", "/coach-workspace/squad/test-day", { test_id: testId, date, client_request_id: requestId, entries }, await csrf());
      setStatus(`Recorded ${result.added} result${Number(result.added) === 1 ? "" : "s"}.`);
      setValues({});
      setRequestId(newRequestId("td"));
    }
    catch { setStatus("The results couldn't be saved. Try again."); }
    finally { setBusy(false); }
  }
  return (
    <div className="squad-entry-body" data-testid="test-day">
      <div className="other-training-form">
        <label className="field"><span>Test</span>
          <select value={testId} onChange={(event) => { setTestId(event.target.value); setValues({}); }}>
            {TEST_OPTIONS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label className="field"><span>Date</span><input type="date" value={date} max={todayIso()} onChange={(event) => setDate(event.target.value)} /></label>
      </div>
      <ul className="squad-grid">
        {labelled(athletes).map((athlete) => (
          <li key={athlete.athlete_user_id}>
            <span>{athlete.label}</span>
            <input type="number" inputMode="decimal" min={0} step="any" aria-label={`${athlete.label} result (${unit})`} value={values[athlete.athlete_user_id] ?? ""} onChange={(event) => setValues({ ...values, [athlete.athlete_user_id]: event.target.value })} />
          </li>
        ))}
      </ul>
      <p className="muted small">{`Results in ${unit}. Leave blank for anyone not tested.`}</p>
      <div className="report-actions"><button type="button" className="button small-button" disabled={!entries.length || busy} onClick={() => void save()}>{busy ? "Saving…" : `Record ${entries.length} result${entries.length === 1 ? "" : "s"}`}</button></div>
      {status ? <p className="muted small" role="status">{status}</p> : null}
    </div>
  );
}

function GpsImport({ athletes }: { athletes: SquadAthlete[] }) {
  const [rowsIn, setRowsIn] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(() => newRequestId("xl"));
  const headers = rowsIn?.[0] ?? [];
  const prepared = useMemo(() => {
    if (!rowsIn || mapping.athlete === undefined || mapping.date === undefined) return { ready: [] as JsonRecord[], unmatched: [] as string[], badDates: 0 };
    const ready: JsonRecord[] = [];
    const unmatched = new Set<string>();
    let badDates = 0;
    for (const row of rowsIn.slice(1)) {
      const who = matchAthlete(row[mapping.athlete] ?? "", athletes);
      const date = isoDate(row[mapping.date] ?? "");
      if (!who) { if ((row[mapping.athlete] ?? "").trim()) unmatched.add((row[mapping.athlete] ?? "").trim()); continue; }
      if (!date) { badDates += 1; continue; }
      const out: JsonRecord = { athlete_user_id: who.athlete_user_id, date };
      for (const field of GPS_FIELDS.slice(2)) {
        const index = mapping[field.key];
        if (index === undefined) continue;
        const value = Number(String(row[index] ?? "").replace(/,/gu, "").trim());
        if (String(row[index] ?? "").trim() !== "" && Number.isFinite(value)) out[field.key] = value;
      }
      ready.push(out);
    }
    return { ready, unmatched: [...unmatched], badDates };
  }, [rowsIn, mapping, athletes]);

  async function readFile(file: File) {
    const parsed = parseCsv(await file.text());
    setRowsIn(parsed);
    setMapping(guessMapping(parsed[0] ?? []));
    setSource(file.name.replace(/\.csv$/iu, "").slice(0, 40));
    setStatus(null);
  }
  async function save() {
    setBusy(true);
    setStatus(null);
    try {
      const result = await request("POST", "/coach-workspace/squad/external-load", { source: source || "import", client_request_id: requestId, rows: prepared.ready }, await csrf());
      const skipped = Array.isArray(result.skipped) ? result.skipped.length : 0;
      setStatus(`Imported ${result.added} session${Number(result.added) === 1 ? "" : "s"}${skipped ? ` (${skipped} skipped)` : ""}${Number(result.added) < prepared.ready.length - skipped ? " - the rest were already imported" : ""}.`);
      setRequestId(newRequestId("xl"));
    }
    catch { setStatus("The import failed. Check the file and try again."); }
    finally { setBusy(false); }
  }
  return (
    <div className="squad-entry-body" data-testid="gps-import">
      <p className="muted small">Export a CSV from your GPS or heart-rate system (Catapult, STATSports, Polar...). One row per athlete per session. Athletes are matched by email, or by name when no one else shares it.</p>
      <label className="field"><span>CSV file</span><input type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); }} /></label>
      {rowsIn ? (
        <>
          <div className="gps-mapping">
            {GPS_FIELDS.map((field) => (
              <label key={field.key} className="field">
                <span>{field.label}</span>
                <select value={mapping[field.key] ?? ""} onChange={(event) => setMapping((current) => { const next = { ...current }; if (event.target.value === "") delete next[field.key]; else next[field.key] = Number(event.target.value); return next; })}>
                  <option value="">Not in this file</option>
                  {headers.map((header, index) => <option key={`${header}-${index}`} value={index}>{header}</option>)}
                </select>
              </label>
            ))}
          </div>
          <p className="muted small" data-testid="gps-preview">{`${prepared.ready.length} of ${rowsIn.length - 1} rows ready.`}{prepared.unmatched.length ? ` Not matched to an athlete: ${prepared.unmatched.slice(0, 8).join(", ")}${prepared.unmatched.length > 8 ? "…" : ""}.` : ""}{prepared.badDates ? ` ${prepared.badDates} with a date that couldn't be read.` : ""}</p>
          <div className="report-actions"><button type="button" className="button small-button" disabled={!prepared.ready.length || busy} onClick={() => void save()}>{busy ? "Importing…" : `Import ${prepared.ready.length} session${prepared.ready.length === 1 ? "" : "s"}`}</button></div>
        </>
      ) : null}
      {status ? <p className="muted small" role="status">{status}</p> : null}
    </div>
  );
}

// testsAllowed: test results stay with each athlete's own coach.
export function SquadEntry({ athletes, testsAllowed = true }: { athletes: SquadAthlete[]; testsAllowed?: boolean }) {
  const [tab, setTab] = useState<"session" | "tests" | "gps" | null>(null);
  if (!athletes.length) return null;
  const tabs: Array<["session" | "tests" | "gps", string]> = [["session", "Squad session"], ...(testsAllowed ? [["tests", "Test day"] as ["tests", string]] : []), ["gps", "Import GPS / HR"]];
  return (
    <section className="panel squad-entry" data-testid="squad-entry">
      <div className="panel-header">
        <h3>Enter for the squad</h3>
        <div className="analysis-weeks" role="group" aria-label="What to enter">
          {tabs.map(([key, label]) => (
            <button key={key} type="button" className={`button secondary small-button${tab === key ? " is-selected" : ""}`} aria-pressed={tab === key} onClick={() => setTab(tab === key ? null : key)}>{label}</button>
          ))}
        </div>
      </div>
      <Explain id="squad_entry" />
      {tab === "session" ? <SquadSession athletes={athletes} /> : null}
      {tab === "tests" ? <TestDay athletes={athletes} /> : null}
      {tab === "gps" ? <GpsImport athletes={athletes} /> : null}
    </section>
  );
}
