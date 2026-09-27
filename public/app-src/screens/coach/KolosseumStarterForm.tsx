import React, { useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { createKolosseumStarterTemplate } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";
import { ActivityCategoryFilter } from "../../components/ActivityCategoryFilter";

// "Start from a Kolosseum programme": a draft built from the engine's own
// programme for a sport, level and training days - a 4-week block with a
// deload - opened for the coach to edit instead of a blank builder.
export function KolosseumStarterForm({ onCreated }: { onCreated: (templateId: string) => void }) {
  const [open, setOpen] = useState(false);
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

  if (!open) {
    return (
      <div className="button-row kolosseum-starter">
        <button className="button secondary" type="button" onClick={() => setOpen(true)}>Start from a Kolosseum programme</button>
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
