import React, { useRef, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { adaptProgramme } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";

// Copy and adapt: a new draft from this programme in one step - a new name,
// fewer training days, a different length, heavier or lighter loads, RPE a
// point up or down (programme_adapt_service.ts). The original is untouched.
const LOAD_CHANGES = [-10, -7.5, -5, -2.5, 0, 2.5, 5, 7.5, 10];

function structureFacts(template: JsonRecord): { days: number; weeks: number } {
  const structure = (template.template_structure ?? {}) as JsonRecord;
  const blocks = Array.isArray(structure.blocks) ? (structure.blocks as JsonRecord[]) : [];
  const weeks = blocks.flatMap((block) => (Array.isArray(block.weeks) ? (block.weeks as JsonRecord[]) : []));
  const days = Math.max(1, ...weeks.map((week) => (Array.isArray(week.days) ? (week.days as JsonRecord[]) : [])
    .reduce((sum, day) => sum + (Array.isArray(day.sessions) ? day.sessions.length : 0), 0)));
  return { days, weeks: weeks.length || Number(template.week_count ?? 1) || 1 };
}

function openProgramme(templateId: string) {
  document.dispatchEvent(new CustomEvent("kolosseum:templates-changed"));
  window.location.hash = `#/coach/programmes/${encodeURIComponent(templateId)}`;
  document.dispatchEvent(new CustomEvent("kolosseum:open-programme-detail", { detail: { template_id: templateId } }));
}

export function CopyAndAdaptSection({ template }: { template: JsonRecord }) {
  const facts = structureFacts(template);
  const sourceName = String(template.template_name ?? "Programme");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(`${sourceName} (copy)`.slice(0, 120));
  const [days, setDays] = useState(facts.days);
  const [weeks, setWeeks] = useState(String(facts.weeks));
  const [load, setLoad] = useState("0");
  const [rpe, setRpe] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  if (!open) {
    return (
      <div className="button-row programme-detail-actions">
        <button className="button secondary" type="button" onClick={() => setOpen(true)}>Copy and adapt</button>
      </div>
    );
  }

  const recognised = /\(based on /iu.test(sourceName);
  const changingLoads = load !== "0" || rpe !== "0";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const account = await loadAccountDetail();
      const result = await adaptProgramme(String(template.template_id), {
        template_name: name.trim(),
        days_per_week: days,
        weeks: Number(weeks),
        load_change_percent: Number(load),
        rpe_change: Number(rpe)
      }, typeof account.csrf_token === "string" ? account.csrf_token : "");
      const created = (result.template ?? {}) as JsonRecord;
      setOpen(false);
      if (created.template_id) openProgramme(String(created.template_id));
    }
    catch (caught) {
      const fieldErrors = (((caught as { payload?: JsonRecord }).payload ?? {}).field_errors ?? {}) as JsonRecord;
      setError(Object.values(fieldErrors).map(String).filter(Boolean)[0] ?? "The copy couldn't be made. Try again.");
    }
    finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <form className="panel kolosseum-starter-form" data-testid="copy-and-adapt" onSubmit={submit}>
      <div className="panel-header kolosseum-starter-header">
        <h4>Copy and adapt</h4>
        <button className="button secondary small-button" type="button" onClick={() => setOpen(false)}>Close</button>
      </div>
      <p className="muted">Makes a new draft from this programme. This one isn't changed.</p>
      <label className="field">
        <span>Name of the copy</span>
        <input type="text" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="field">
        <span>Training days a week</span>
        <select aria-label="Training days a week" value={days} onChange={(event) => setDays(Number(event.target.value))}>
          {Array.from({ length: facts.days }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n === facts.days ? `${n} (as now)` : `${n} - keeps the first ${n}`}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Length in weeks</span>
        <input type="number" aria-label="Length in weeks" min={1} max={52} value={weeks} onChange={(event) => setWeeks(event.target.value)} />
      </label>
      <p className="muted small">{`Now ${facts.weeks} weeks. Shorter cuts weeks from the end; longer repeats the last block.`}</p>
      <label className="field">
        <span>Loads</span>
        <select aria-label="Loads" value={load} onChange={(event) => setLoad(event.target.value)}>
          {LOAD_CHANGES.map((n) => <option key={n} value={String(n)}>{n === 0 ? "As now" : `${n > 0 ? "+" : ""}${n}% (${n > 0 ? "heavier" : "lighter"})`}</option>)}
        </select>
      </label>
      <label className="field">
        <span>RPE targets</span>
        <select aria-label="RPE targets" value={rpe} onChange={(event) => setRpe(event.target.value)}>
          <option value="-1">One lower</option>
          <option value="0">As now</option>
          <option value="1">One higher</option>
        </select>
      </label>
      {recognised && changingLoads ? (
        <p className="field-error" role="note">This is based on a recognised programme. Changing its loads means the copy is no longer the original.</p>
      ) : null}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      <div className="button-row">
        <button className="button primary" type="submit" disabled={busy || !name.trim()}>{busy ? "Copying…" : "Make the copy"}</button>
        <button className="button secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
