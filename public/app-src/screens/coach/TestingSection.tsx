import React, { useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { request, type JsonRecord } from "../../api/transport";
import { shortWeek } from "../../components/TrendChart";

// Testing: the tests a coach records for the athlete - jumps, sprints,
// agility, conditioning, grip - each with its latest result, the change
// since last time and whether that change is real (beyond the test's
// smallest worthwhile change) or within its normal variation.

export const TEST_OPTIONS: Array<[string, string, string]> = [
  ["cmj_cm", "Countermovement jump", "cm"], ["squat_jump_cm", "Squat jump", "cm"], ["broad_jump_cm", "Standing broad jump", "cm"],
  ["sprint_10m_s", "10 m sprint", "s"], ["sprint_20m_s", "20 m sprint", "s"], ["sprint_40m_s", "40 m sprint", "s"], ["agility_505_s", "505 agility", "s"],
  ["yoyo_ir1_m", "Yo-Yo IR1", "m"], ["bronco_s", "Bronco", "s"], ["row_2k_s", "2 km row", "s"],
  ["grip_kg", "Grip strength", "kg"], ["pull_ups_reps", "Max pull-ups", "reps"]
];
const VERDICT: Record<string, { label: string; level: string }> = {
  improved: { label: "Real improvement", level: "good" },
  declined: { label: "Real decline", level: "watch" },
  within_noise: { label: "Within normal variation", level: "info" },
  first: { label: "First result", level: "info" }
};
const rows = (value: unknown) => (Array.isArray(value) ? (value as JsonRecord[]) : []);
const todayIso = () => new Date().toISOString().slice(0, 10);
const newRequestId = () => `pt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

export function TestingSection({ athleteUserId, tests, onChanged, readOnly = false }: { athleteUserId: string; tests: JsonRecord[]; onChanged: () => void; readOnly?: boolean }) {
  const [form, setForm] = useState({ test_id: "cmj_cm", value: "", date: todayIso() });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(newRequestId);
  const unit = TEST_OPTIONS.find(([id]) => id === form.test_id)?.[2] ?? "";
  const value = Number(form.value);
  const valid = form.value !== "" && value > 0 && Boolean(form.date);
  const base = `/coach-workspace/athletes/${encodeURIComponent(athleteUserId)}/tests`;

  async function csrf() {
    const account = await loadAccountDetail();
    return typeof account.csrf_token === "string" ? account.csrf_token : "";
  }
  async function record() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await request("POST", base, { test_id: form.test_id, value, date: form.date, client_request_id: requestId }, await csrf());
      setForm({ ...form, value: "" });
      setRequestId(newRequestId());
      onChanged();
    }
    catch { setError("The result couldn't be saved. Check the value and try again."); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true);
    try { await request("POST", `${base}/remove`, { id }, await csrf()); onChanged(); }
    catch { setError("That result couldn't be removed. Try again."); }
    finally { setBusy(false); }
  }

  return (
    <div className="testing" data-testid="testing">
      {tests.length ? (
        <div className="analysis-table-wrap">
          <table className="analysis-table">
            <thead><tr><th>Test</th><th>Latest</th><th>Previous</th><th>Change</th><th>Best</th><th>Verdict</th><th>All results</th></tr></thead>
            <tbody>
              {tests.map((test) => {
                const latest = test.latest as JsonRecord;
                const previous = test.previous as JsonRecord | null;
                const best = test.best as JsonRecord;
                const verdict = VERDICT[String(test.verdict)] ?? VERDICT.first;
                const change = typeof test.change === "number" ? test.change : null;
                return (
                  <tr key={String(test.test_id)}>
                    <td>{String(test.name)}</td>
                    <td>{`${latest.value} ${test.unit} (${shortWeek(String(latest.date))})`}</td>
                    <td>{previous ? `${previous.value} ${test.unit}` : "–"}</td>
                    <td>{change === null ? "–" : `${change > 0 ? "+" : ""}${change} ${test.unit}`}</td>
                    <td>{`${best.value} ${test.unit}`}</td>
                    <td><span className={`analysis-status is-${verdict.level}`} title={`Smallest worthwhile change: ${test.swc} ${test.unit}`}>{verdict.label}</span></td>
                    <td className="small">
                      {rows(test.results).map((result) => (
                        <span key={String(result.id)} className="testing-result">
                          {`${shortWeek(String(result.date))}: ${result.value}`}
                          {readOnly ? null : <button type="button" className="text-button" disabled={busy} aria-label={`Remove ${test.name} ${result.value} on ${result.date}`} onClick={() => void remove(String(result.id))}>×</button>}
                        </span>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <p className="muted small">No tests recorded yet.</p>}
      {readOnly ? <p className="muted small">Their own coach records their tests.</p> : <div className="testing-form" data-testid="testing-form">
        <label className="field"><span>Test</span>
          <select value={form.test_id} onChange={(event) => setForm({ ...form, test_id: event.target.value })}>
            {TEST_OPTIONS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label className="field"><span>{`Result (${unit})`}</span><input type="number" inputMode="decimal" min={0} step="any" value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} /></label>
        <label className="field"><span>Date</span><input type="date" value={form.date} max={todayIso()} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
        <button type="button" className="button small-button" disabled={!valid || busy} onClick={() => void record()}>{busy ? "Saving…" : "Record result"}</button>
      </div>}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </div>
  );
}
