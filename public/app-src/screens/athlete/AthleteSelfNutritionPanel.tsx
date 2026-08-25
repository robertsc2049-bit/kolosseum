import React, { useState } from "react";

import { type JsonRecord } from "../../api/transport";
import { BODY_METRIC_TYPE_LABELS, METRIC_UNIT_SUFFIX, NUTRITION_METRIC_TYPES, formatDate } from "../../utils/format";
import { useAthleteNutritionSelf } from "./useAthleteNutritionSelf";

// DEV NOTE: FULL-UI-29 athlete's own nutrition logging - ported from
// app.js's logNutritionEntry()/groupNutritionEntriesByDate()/
// renderNutritionDayCard()/renderNutritionSummary(). This is the last
// consumer of the shared refreshBodyMetrics() legacy function, which is
// removed alongside this migration - see the DEV NOTE left at its old site
// in app.js.
function groupByDate(entries: JsonRecord[]): Array<[string, Record<string, unknown>]> {
  const byDate = new Map<string, Record<string, unknown>>();

  for (const entry of entries) {
    const metricType = String(entry.metric_type);
    if (!NUTRITION_METRIC_TYPES.includes(metricType)) continue;

    const date = String(entry.effective_date);
    if (!byDate.has(date)) byDate.set(date, {});
    const day = byDate.get(date)!;
    // Entries arrive newest-logged-first, so the first one seen per
    // metric_type for a given date is the most recently logged value for
    // that day - matches AthleteSelfBodyMetricsPanel's "log again is a
    // correction, not an addend" convention.
    if (!(metricType in day)) day[metricType] = entry.value;
  }

  return [...byDate.entries()].sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0));
}

function NutritionDayCard({ date, macros }: { date: string; macros: Record<string, unknown> }) {
  const parts = NUTRITION_METRIC_TYPES
    .filter((metricType) => metricType in macros)
    .map((metricType) => `${BODY_METRIC_TYPE_LABELS[metricType]} ${String(macros[metricType])}${METRIC_UNIT_SUFFIX[metricType]}`)
    .join(" · ");

  return (
    <article className="record-card">
      <div className="record-meta">
        <span className="muted small">{formatDate(date)}</span>
      </div>
      <p>{parts}</p>
    </article>
  );
}

export function AthleteSelfNutritionPanel() {
  const { entries, submitError, logEntry } = useAthleteNutritionSelf();

  const [effectiveDate, setEffectiveDate] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const macros = [
      ["calories_kcal", calories],
      ["protein_g", protein],
      ["carbs_g", carbs],
      ["fat_g", fat]
    ]
      .filter(([, rawValue]) => rawValue !== "")
      .map(([metric_type, rawValue]) => ({ metric_type, value: Number(rawValue) }));

    if (!effectiveDate || macros.length === 0) {
      setValidationError("Enter a date and at least one macro.");
      return;
    }

    setValidationError(null);

    const ok = await logEntry({ effective_date: effectiveDate, macros });

    if (ok) {
      setEffectiveDate("");
      setCalories("");
      setProtein("");
      setCarbs("");
      setFat("");
    }
  }

  const statusText = validationError ?? submitError;
  const days = groupByDate(entries);

  return (
    <div className="panel nutrition-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Nutrition</p>
          <h3>Nutrition</h3>
        </div>
      </div>

      <form className="athlete-detail-note-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Date</span>
          <input type="date" required value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} />
        </label>

        <label className="field">
          <span>Calories (kcal)</span>
          <input type="number" min={0} step={1} value={calories} onChange={(event) => setCalories(event.target.value)} />
        </label>

        <label className="field">
          <span>Protein (g)</span>
          <input type="number" min={0} step={1} value={protein} onChange={(event) => setProtein(event.target.value)} />
        </label>

        <label className="field">
          <span>Carbs (g)</span>
          <input type="number" min={0} step={1} value={carbs} onChange={(event) => setCarbs(event.target.value)} />
        </label>

        <label className="field">
          <span>Fat (g)</span>
          <input type="number" min={0} step={1} value={fat} onChange={(event) => setFat(event.target.value)} />
        </label>

        <div className="inline-controls">
          <button className="button primary" type="submit">Log nutrition</button>
        </div>
      </form>

      {statusText ? <p className="dashboard-status" role="status" aria-live="polite">{statusText}</p> : null}

      <div className="record-list">
        {days.length === 0 ? (
          <div className="empty-state compact-empty"><p>No nutrition entries yet.</p></div>
        ) : (
          days.map(([date, macros]) => <NutritionDayCard key={date} date={date} macros={macros} />)
        )}
      </div>
    </div>
  );
}
