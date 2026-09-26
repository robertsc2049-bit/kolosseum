import React from "react";

import { type JsonRecord } from "../api/transport";
import { formatDate, titleCase } from "../utils/format";
import { LineChart } from "./LineChart";

// Estimated one-rep max from what the athlete actually lifted in training
// (logged sets and extra sets), per exercise, with its trend - shared by the
// coach's and the athlete's progress panels.
export function TrainingE1rmCard({ trend, exercises }: { trend: JsonRecord; exercises: JsonRecord[] }) {
  const exerciseId = String(trend.exercise_id);
  const match = exercises.find((entry) => entry.exercise_id === exerciseId);
  const name = typeof match?.display_name === "string" ? match.display_name : titleCase(exerciseId);
  const unit = String(trend.unit ?? "kg");
  const change = trend.has_prior_value
    ? `${Number(trend.delta) > 0 ? "+" : ""}${trend.delta} ${unit} (${Number(trend.delta_percentage) > 0 ? "+" : ""}${trend.delta_percentage}%) since ${formatDate(trend.prior_date)}`
    : "No earlier training to compare yet.";
  const points = Array.isArray(trend.series)
    ? (trend.series as JsonRecord[]).map((point) => ({ date: String(point.date ?? ""), value: Number(point.e1rm) }))
    : [];

  return (
    <article className="record-card" data-testid={`training-e1rm-${exerciseId}`}>
      <div className="record-meta">
        <span className="badge neutral">{name}</span>
        <span className="muted small">{`Estimated from training · ${formatDate(trend.current_date)}`}</span>
      </div>
      <strong>{`${String(trend.current_e1rm)} ${unit} e1RM`}</strong>
      <p className="muted small">{change}</p>
      {trend.includes_bodyweight === true ? <p className="muted small">Includes bodyweight plus added load.</p> : null}
      <LineChart compact series={[{ id: "e1rm", label: `${name} e1RM (${unit})`, points }]} emptyLabel="Not enough training logged to chart yet." />
    </article>
  );
}
