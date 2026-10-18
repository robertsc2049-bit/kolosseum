import React, { useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { request, type JsonRecord } from "../../api/transport";

// The injury log on a coach's Analysis page: every injury with its days
// lost and severity, recording a new one, and moving it on as the athlete
// comes back (out -> modified -> back to full training). Facts only - no
// diagnosis or notes. Seen by the athlete's own coach and a team's head coach.

export const AREAS: Array<[string, string]> = [
  ["thigh_back", "Hamstring"], ["thigh_front", "Thigh (front)"], ["hip_groin", "Hip / groin"], ["knee", "Knee"], ["lower_leg", "Calf / shin"],
  ["achilles", "Achilles"], ["ankle", "Ankle"], ["foot", "Foot"], ["lower_back", "Lower back"], ["upper_back", "Upper back"], ["abdomen", "Abdomen"],
  ["chest", "Chest / ribs"], ["shoulder", "Shoulder"], ["upper_arm", "Upper arm"], ["elbow", "Elbow"], ["forearm", "Forearm"], ["wrist_hand", "Wrist / hand"],
  ["neck", "Neck"], ["head", "Head"]
];
export const TYPES: Array<[string, string]> = [
  ["muscle", "Muscle strain"], ["ligament", "Ligament sprain"], ["tendon", "Tendon"], ["joint", "Joint / cartilage"], ["bone", "Bone (incl. stress)"],
  ["contusion", "Bruise / dead leg"], ["concussion", "Concussion"], ["nerve", "Nerve"], ["other", "Other"]
];
const MECHANISMS: Array<[string, string]> = [["non_contact", "Non-contact"], ["contact", "Contact"], ["overuse", "Gradual / overuse"], ["unknown", "Not known"]];
const CONTEXTS: Array<[string, string]> = [["training", "Training"], ["match", "Match / competition"], ["gym", "Gym"], ["outside_sport", "Outside sport"]];
const SIDES: Array<[string, string]> = [["left", "Left"], ["right", "Right"], ["both", "Both"], ["none", "Not sided"]];
const STATUS_LABEL: Record<string, string> = { out: "Out", modified: "Modified training", returned: "Back to full" };
const SEVERITY_LABEL: Record<string, string> = { no_time_lost: "No time lost", minimal: "Minimal", mild: "Mild", moderate: "Moderate", severe: "Severe" };

const todayIso = () => new Date().toISOString().slice(0, 10);
const newRequestId = () => `inj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
const short = (date: unknown) => (typeof date === "string" && date ? new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "–");
async function csrf(): Promise<string> {
  const account = await loadAccountDetail();
  return typeof account.csrf_token === "string" ? account.csrf_token : "";
}

function Update({ base, injury, onChanged }: { base: string; injury: JsonRecord; onChanged: () => void }) {
  const [status, setStatus] = useState(injury.status === "out" ? "modified" : "returned");
  const [on, setOn] = useState(todayIso());
  const [expected, setExpected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(newRequestId);
  async function save() {
    setBusy(true);
    setError(null);
    try {
      await request("POST", `${base}/${encodeURIComponent(String(injury.id))}/status`, { status, on, ...(expected && status !== "returned" ? { expected_return: expected } : {}), client_request_id: requestId }, await csrf());
      setRequestId(newRequestId());
      onChanged();
    }
    catch { setError("That couldn't be saved. Check the dates and try again."); }
    finally { setBusy(false); }
  }
  return (
    <div className="injury-update" data-testid="injury-update">
      <label className="field"><span>Now</span>
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label={`New status for ${injury.name}`}>
          {injury.status === "modified" ? null : <option value="out">Out - not training</option>}
          <option value="modified">Modified training</option>
          <option value="returned">Back to full training</option>
        </select>
      </label>
      <label className="field"><span>From</span><input type="date" value={on} max={todayIso()} min={String(injury.occurred_on)} onChange={(event) => setOn(event.target.value)} /></label>
      {status !== "returned" ? <label className="field"><span>Expected back (optional)</span><input type="date" value={expected} min={todayIso()} onChange={(event) => setExpected(event.target.value)} /></label> : null}
      <button type="button" className="button small-button" disabled={busy || !on} onClick={() => void save()}>Update</button>
      {error ? <p className="muted small" role="alert">{error}</p> : null}
    </div>
  );
}

export function InjuryLog({ athleteUserId, injuries, onChanged }: { athleteUserId: string; injuries: JsonRecord; onChanged: () => void }) {
  const base = `/coach-workspace/athletes/${encodeURIComponent(athleteUserId)}/injuries`;
  const rows = (Array.isArray(injuries.rows) ? injuries.rows : []) as JsonRecord[];
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ area: "thigh_back", side: "left", type: "muscle", mechanism: "non_contact", context: "training", status: "out", occurred_on: todayIso(), expected_return: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(newRequestId);
  const [updating, setUpdating] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => setForm({ ...form, [key]: event.target.value });
  async function record() {
    setBusy(true);
    setError(null);
    try {
      const { expected_return: expectedReturn, ...rest } = form;
      await request("POST", base, { ...rest, ...(expectedReturn ? { expected_return: expectedReturn } : {}), client_request_id: requestId }, await csrf());
      setRequestId(newRequestId());
      setAdding(false);
      onChanged();
    }
    catch { setError("The injury couldn't be saved. Check the dates and try again."); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true);
    try { await request("POST", `${base}/${encodeURIComponent(id)}/remove`, {}, await csrf()); onChanged(); }
    catch { setError("That couldn't be removed. Try again."); }
    finally { setBusy(false); }
  }
  return (
    <div className="injury-log" data-testid="injury-log">
      {rows.length ? (
        <div className="analysis-table-wrap">
          <table className="analysis-table injury-table">
            <thead><tr><th>Injury</th><th>Date</th><th>How</th><th>Status</th><th>Days lost</th><th>Severity</th><th /></tr></thead>
            <tbody>
              {rows.map((injury) => (
                <React.Fragment key={String(injury.id)}>
                  <tr>
                    <td data-label="Injury">{String(injury.name).replace(/^./u, (c) => c.toUpperCase())}</td>
                    <td data-label="Date">{short(injury.occurred_on)}</td>
                    <td data-label="How">{`${MECHANISMS.find(([id]) => id === injury.mechanism)?.[1] ?? ""}, ${(CONTEXTS.find(([id]) => id === injury.context)?.[1] ?? "").toLowerCase()}`}</td>
                    <td data-label="Status">{STATUS_LABEL[String(injury.status)] ?? String(injury.status)}{injury.status === "returned" ? ` ${short(injury.returned_on)}` : injury.expected_return ? ` - expected back ${short(injury.expected_return)}` : ""}</td>
                    <td data-label="Days lost">{`${injury.days_lost}${Number(injury.days_modified) ? ` (+${injury.days_modified} modified)` : ""}`}</td>
                    <td data-label="Severity">{SEVERITY_LABEL[String(injury.severity)] ?? ""}</td>
                    <td className="injury-actions">
                      {injury.status !== "returned" ? <button type="button" className="text-button" onClick={() => setUpdating(updating === injury.id ? null : String(injury.id))}>Update</button> : null}
                      <button type="button" className="text-button" aria-label={`Remove ${injury.name} on ${injury.occurred_on}`} disabled={busy} onClick={() => void remove(String(injury.id))}>Remove</button>
                    </td>
                  </tr>
                  {updating === injury.id ? <tr><td colSpan={7}><Update base={base} injury={injury} onChanged={() => { setUpdating(null); onChanged(); }} /></td></tr> : null}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="muted small">No injuries recorded.</p>}
      {adding ? (
        <div className="injury-form" data-testid="injury-form">
          <label className="field"><span>Where</span><select value={form.area} onChange={set("area")}>{AREAS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label className="field"><span>Side</span><select value={form.side} onChange={set("side")}>{SIDES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label className="field"><span>Type</span><select value={form.type} onChange={set("type")}>{TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label className="field"><span>How</span><select value={form.mechanism} onChange={set("mechanism")}>{MECHANISMS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label className="field"><span>Where it happened</span><select value={form.context} onChange={set("context")}>{CONTEXTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label className="field"><span>Date</span><input type="date" value={form.occurred_on} max={todayIso()} onChange={set("occurred_on")} /></label>
          <label className="field"><span>Training now</span><select value={form.status} onChange={set("status")}><option value="out">Out - not training</option><option value="modified">Modified training</option></select></label>
          <label className="field"><span>Expected back (optional)</span><input type="date" value={form.expected_return} min={form.occurred_on} onChange={set("expected_return")} /></label>
          {form.type === "concussion" || form.area === "head" ? <p className="muted small injury-note">For a head injury, also record a stand-down with the date their doctor gives, so no sessions are set until they're cleared.</p> : null}
          <div className="report-actions">
            <button type="button" className="button small-button" disabled={busy || !form.occurred_on} onClick={() => void record()}>Save injury</button>
            <button type="button" className="button secondary small-button" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      ) : <div className="report-actions"><button type="button" className="button secondary small-button" onClick={() => setAdding(true)}>Record an injury</button></div>}
      {error ? <p className="muted small" role="alert">{error}</p> : null}
      <p className="muted small">Record what their physio or doctor has said - this log never gives medical advice. Only you{" "}and a team's head coach see it; others see only whether they're available.</p>
    </div>
  );
}
