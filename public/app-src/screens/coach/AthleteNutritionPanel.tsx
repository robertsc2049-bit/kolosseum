import React from "react";

import { type JsonRecord } from "../../api/transport";
import { BODY_METRIC_TYPE_LABELS, METRIC_UNIT_SUFFIX, NUTRITION_METRIC_TYPES, formatDate } from "../../utils/format";
import { useAthleteNutrition } from "./useAthleteNutrition";

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
    // that day - matches AthleteBodyMetricsPanel's "log again is a
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

export function AthleteNutritionPanel() {
  const { athleteUserId, loading, error, entries } = useAthleteNutrition();

  if (!athleteUserId) return null;

  if (loading && entries.length === 0) {
    return <p className="muted small">Loading nutrition history…</p>;
  }

  if (error) {
    return <p role="status" className="muted small error">{error}</p>;
  }

  const days = groupByDate(entries);

  if (days.length === 0) {
    return (
      <div className="empty-state compact-empty">
        <p>No nutrition entries yet.</p>
      </div>
    );
  }

  return (
    <>
      {days.map(([date, macros]) => (
        <NutritionDayCard key={date} date={date} macros={macros} />
      ))}
    </>
  );
}
