import React, { useRef, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { copyKolosseumProgramme, createKolosseumStarterTemplate, loadKolosseumProgrammesForCoach } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";
import { ActivityCategoryFilter } from "../../components/ActivityCategoryFilter";
import { titleCase } from "../../utils/format";

// "Start from a Kolosseum programme": the coach-written Kolosseum programmes
// (programme_catalogue_service.ts) - copy one into your library as a draft to
// change and assign. Until any are published, a draft built from the engine's
// own programme for a sport, level and training days (a 4-week block with a
// deload) instead.
export function KolosseumStarterForm({ onCreated }: { onCreated: (templateId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [programmes, setProgrammes] = useState<JsonRecord[] | null>(null);
  const [copying, setCopying] = useState<string | null>(null);
  // A double tap copies once.
  const copyInFlight = useRef(false);
  const [activityId, setActivityId] = useState("");
  const [level, setLevel] = useState("amateur");
  const [days, setDays] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const account = await loadAccountDetail();
      const csrf = typeof account.csrf_token === "string" ? account.csrf_token : "";
      const result = await createKolosseumStarterTemplate({ activity_id: activityId, experience_level: level, days_per_week: days }, csrf);
      const template = (result.template as JsonRecord | undefined) ?? {};
      setOpen(false);
      onCreated(String(template.template_id ?? ""));
    }
    catch {
      setError("The programme could not be created. Check the sport and try again.");
    }
    finally {
      setBusy(false);
    }
  }

  function openPanel() {
    setOpen(true);
    setError(null);
    setProgrammes(null);
    loadKolosseumProgrammesForCoach()
      .then((result) => setProgrammes(Array.isArray(result.programmes) ? (result.programmes as JsonRecord[]) : []))
      .catch(() => setProgrammes([]));
  }

  async function copy(listingId: string) {
    if (copyInFlight.current) return;
    copyInFlight.current = true;
    setCopying(listingId);
    setError(null);
    try {
      const account = await loadAccountDetail();
      const csrf = typeof account.csrf_token === "string" ? account.csrf_token : "";
      const result = await copyKolosseumProgramme(listingId, csrf);
      const template = (result.template as JsonRecord | undefined) ?? {};
      setOpen(false);
      onCreated(String(template.template_id ?? ""));
    }
    catch {
      setError("The programme could not be copied. Try again.");
    }
    finally {
      copyInFlight.current = false;
      setCopying(null);
    }
  }

  if (!open) {
    return (
      <div className="button-row kolosseum-starter">
        <button className="button secondary" type="button" onClick={openPanel}>Start from a Kolosseum programme</button>
      </div>
    );
  }

  if (programmes === null) {
    return <div className="panel kolosseum-starter-form" data-testid="kolosseum-starter"><p className="muted">Loading Kolosseum programmes…</p></div>;
  }

  if (programmes.length > 0) {
    return (
      <div className="panel kolosseum-starter-form" data-testid="kolosseum-programmes">
        <p className="muted">Programmes written by Kolosseum coaches. Copy one into your library as a draft - change anything, then assign it.</p>
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <ul className="programme-options">
          {programmes.map((programme) => {
            const id = String(programme.listing_id);
            const sports = Array.isArray(programme.activity_ids) ? programme.activity_ids.map(String) : [];
            const levels = Array.isArray(programme.levels) ? programme.levels.map((l) => titleCase(String(l))) : [];
            return (
              <li className="programme-option" key={id}>
                <div className="programme-option-head">
                  <strong>{String(programme.title)}</strong>
                  <span className="badge neutral">{sports.length ? sports.map((s) => titleCase(s)).join(", ") : "Any sport"}</span>
                </div>
                <p className="muted small">{`${Number(programme.days_per_week) || 0} days a week · ${levels.join(", ")}`}</p>
                {programme.summary ? <p>{String(programme.summary)}</p> : null}
                <button className="button primary" type="button" disabled={copying !== null} onClick={() => void copy(id)}>
                  {copying === id ? "Copying…" : "Copy to my library"}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="button-row">
          <button className="button secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel kolosseum-starter-form" data-testid="kolosseum-starter">
      <p className="muted">A 4-week block (three loading weeks and a deload) from the Kolosseum programme for this sport and level, as a draft you can change before assigning.</p>
      <ActivityCategoryFilter value={activityId} onChange={setActivityId} sportLabel="Sport" />
      <label className="field">
        <span>Level</span>
        <select aria-label="Level" value={level} onChange={(event) => setLevel(event.target.value)}>
          <option value="beginner">Beginner</option>
          <option value="amateur">Amateur</option>
          <option value="pro">Pro</option>
        </select>
      </label>
      <label className="field">
        <span>Training days a week</span>
        <select aria-label="Training days a week" value={days} onChange={(event) => setDays(Number(event.target.value))}>
          {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      <div className="button-row">
        <button className="button primary" type="button" disabled={busy || !activityId} onClick={() => void create()}>{busy ? "Creating…" : "Create draft"}</button>
        <button className="button secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}
