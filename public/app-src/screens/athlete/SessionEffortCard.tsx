import React, { useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { request } from "../../api/transport";

// "How was that session?" - asked when a session ends: how hard the whole
// session was (0-10) and how long it took. It's how the coach's load figures
// become real numbers rather than estimates. It can be changed later.

const SCALE: Array<[number, string]> = [
  [0, "Rest"], [1, "Very, very easy"], [2, "Easy"], [3, "Moderate"], [4, "Somewhat hard"], [5, "Hard"],
  [6, "Hard+"], [7, "Very hard"], [8, "Very hard+"], [9, "Near max"], [10, "Maximal"]
];

export function SessionEffortCard({ sessionId }: { sessionId: string }) {
  const [srpe, setSrpe] = useState<number | null>(null);
  const [minutes, setMinutes] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    request("GET", `/account/onboarding/session-load/${encodeURIComponent(sessionId)}`)
      .then((result) => {
        const report = result.report as { srpe?: number; minutes?: number } | null;
        if (cancelled || !report) return;
        if (typeof report.srpe === "number") setSrpe(report.srpe);
        if (typeof report.minutes === "number") setMinutes(String(report.minutes));
        setSaved(true);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [sessionId]);

  const mins = Number(minutes);
  const valid = srpe !== null && Number.isInteger(mins) && mins >= 1 && mins <= 300;

  async function save() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const account = await loadAccountDetail();
      const csrf = typeof account.csrf_token === "string" ? account.csrf_token : "";
      await request("POST", "/account/onboarding/session-load", { session_id: sessionId, srpe, minutes: mins }, csrf);
      setSaved(true);
    }
    catch {
      setError("That didn't save. Check your connection and try again.");
    }
    finally {
      setBusy(false);
    }
  }

  return (
    <section className="session-effort" data-testid="session-effort">
      <h4>How was that session?</h4>
      <p className="muted small">How hard was the whole session, start to finish? Your coach uses this with how long it took to see your real training load.</p>
      <div className="session-effort-scale" role="radiogroup" aria-label="How hard was the whole session (0-10)">
        {SCALE.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={srpe === value}
            className={`session-effort-option${srpe === value ? " is-selected" : ""}`}
            onClick={() => { setSrpe(value); setSaved(false); }}
          >
            <strong>{value}</strong>
            <span>{label}</span>
          </button>
        ))}
      </div>
      <label className="field session-effort-minutes">
        <span>How long did it take? (minutes)</span>
        <input type="number" inputMode="numeric" min={1} max={300} step={1} value={minutes} onChange={(event) => { setMinutes(event.target.value); setSaved(false); }} />
      </label>
      <div className="report-actions">
        <button type="button" className="button small-button" disabled={!valid || busy || saved} onClick={() => void save()}>{busy ? "Saving…" : saved ? "Saved" : "Save"}</button>
      </div>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </section>
  );
}
