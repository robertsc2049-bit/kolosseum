import React, { useState } from "react";

import { DEFAULT_PROGRESSION, type ProgressionOptions, progressBlockWeeks, progressionPreview } from "./blockProgression";
import type { ProgrammeBlockDraft, ProgrammeWeekDraft } from "./programmeDraft";

// "Progress across weeks": fills weeks 2.. of a block from week 1 with a step
// per week and an optional deload (blockProgression.ts). The new weeks go to
// the builder (app.js holds the draft) through an event; onApplied lets the
// block remount its weeks so the inputs show the new values. Undo puts the
// weeks back as they were.

export const REPLACE_BLOCK_WEEKS_EVENT = "kolosseum:replace-template-block-weeks";

function NumberField({ label, value, step, onChange, hint }: { label: string; value: number; step: number; onChange: (value: number) => void; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="number" step={step} value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(Number(event.target.value))} />
      {hint ? <small className="muted">{hint}</small> : null}
    </label>
  );
}

export function BlockProgressionPanel({ block, blockIndex, exerciseName, onApplied }: { block: ProgrammeBlockDraft; blockIndex: number; exerciseName: (exerciseId: string) => string; onApplied: () => void }) {
  const [options, setOptions] = useState<ProgressionOptions>(DEFAULT_PROGRESSION);
  const [confirming, setConfirming] = useState(false);
  const [undo, setUndo] = useState<ProgrammeWeekDraft[] | null>(null);
  const set = (patch: Partial<ProgressionOptions>) => { setOptions((current) => ({ ...current, ...patch })); setConfirming(false); };
  const weekCount = block.weeks.length;
  if (weekCount < 2) {
    return <p className="muted small" data-testid="block-progression-hint">Add or duplicate weeks, then progress the main lifts across them from week 1 here.</p>;
  }
  const preview = progressionPreview(block.weeks, options, exerciseName);
  const replace = (weeks: ProgrammeWeekDraft[]) => {
    document.dispatchEvent(new CustomEvent(REPLACE_BLOCK_WEEKS_EVENT, { detail: { block_index: blockIndex, weeks } }));
    onApplied();
  };
  const apply = () => {
    setUndo(structuredClone(block.weeks));
    replace(progressBlockWeeks(block.weeks, options));
    setConfirming(false);
  };
  return (
    <details className="block-progression" data-testid="block-progression">
      <summary>Progress across weeks</summary>
      <p className="muted small">Week 1 is the starting point. Each later week steps up from it - set week 1, duplicate it, then fill the rest here.</p>
      <div className="block-progression-fields">
        <label className="field">
          <span>Apply to</span>
          <select value={options.scope} onChange={(event) => set({ scope: event.target.value === "loaded" ? "loaded" : "primary" })}>
            <option value="primary">Main lifts</option>
            <option value="loaded">Every loaded exercise</option>
          </select>
        </label>
        <NumberField label="% of max per week" value={options.pct_step} step={0.5} onChange={(value) => set({ pct_step: value })} />
        <NumberField label="Weight per week (kg/lb)" value={options.kg_step} step={0.5} onChange={(value) => set({ kg_step: value })} />
        <NumberField label="RPE per week" value={options.rpe_step} step={0.5} onChange={(value) => set({ rpe_step: value })} />
        <NumberField label="Reps per week" value={options.reps_step} step={1} onChange={(value) => set({ reps_step: Math.round(value) })} hint="e.g. -1 to go from 8s to 5s" />
        <label className="field">
          <span>Deload</span>
          <select value={String(options.deload_every)} onChange={(event) => set({ deload_every: Number(event.target.value) })}>
            <option value="0">No deload</option>
            {[3, 4, 5, 6].map((n) => <option key={n} value={String(n)}>{`Every ${n}th week (lighter, a set fewer)`}</option>)}
          </select>
        </label>
      </div>
      {preview.length ? (
        <div className="block-progression-preview" data-testid="block-progression-preview">
          {preview.map((row) => (
            <p key={row.label} className="small"><strong>{row.label}</strong>{`: ${row.weeks.map((week, index) => `W${index + 1} ${week}`).join(" → ")}`}</p>
          ))}
        </div>
      ) : <p className="muted small">{options.scope === "primary" ? "No main lifts in week 1 to progress - mark an exercise as Main, or choose every loaded exercise." : "Nothing in week 1 to progress."}</p>}
      <div className="button-row">
        {confirming ? (
          <>
            <button className="button primary" type="button" onClick={apply}>{`Overwrite weeks 2-${weekCount}`}</button>
            <button className="button tertiary" type="button" onClick={() => setConfirming(false)}>Cancel</button>
          </>
        ) : (
          <button className="button secondary" type="button" disabled={!preview.length} onClick={() => setConfirming(true)}>Progress weeks 2-{weekCount}</button>
        )}
        {undo ? <button className="button tertiary" type="button" onClick={() => { replace(undo); setUndo(null); }}>Undo</button> : null}
      </div>
      {confirming ? <p className="muted small">This replaces the loads (and reps, if set) of these exercises in weeks 2-{weekCount}. Everything else stays as it is, and you can undo it.</p> : null}
    </details>
  );
}
