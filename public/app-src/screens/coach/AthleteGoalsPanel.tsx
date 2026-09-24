import React from "react";

import { type JsonRecord } from "../../api/transport";
import { BODY_METRIC_TYPE_LABELS, formatDate, titleCase } from "../../utils/format";
import { useAthleteGoals } from "./useAthleteGoals";

const STATUS_BADGE_CLASS: Record<string, string> = {
  active: "active",
  achieved: "complete",
  abandoned: "partial"
};

function GoalMetricLine({ goal }: { goal: JsonRecord }) {
  const metricType = String(goal.metric_type);
  const label = BODY_METRIC_TYPE_LABELS[metricType] ?? titleCase(metricType);
  const unitSuffix = goal.target_unit === "percent" ? "%" : ` ${String(goal.target_unit)}`;

  if (goal.has_current_value !== true) {
    return (
      <p className="muted small">
        {label}: target {String(goal.target_value)}{unitSuffix} - no measurement logged yet.
      </p>
    );
  }

  const progressText = goal.progress_percentage !== null ? ` (${goal.progress_percentage}% of the way there)` : "";
  const metText = goal.is_goal_met === true ? " - target met" : "";

  return (
    <p className="muted small">
      {label}: {String(goal.current_value)}{unitSuffix} now, target {String(goal.target_value)}{unitSuffix}{progressText}{metText}.
    </p>
  );
}

function GoalCard({ goal }: { goal: JsonRecord }) {
  const statusBadgeClass = STATUS_BADGE_CLASS[String(goal.status)] ?? "neutral";

  return (
    <article className="record-card">
      <div className="record-meta">
        <span className={`badge ${statusBadgeClass}`}>{titleCase(goal.status)}</span>
      </div>
      <strong>{String(goal.goal_label)}</strong>
      {goal.metric_type ? <GoalMetricLine goal={goal} /> : null}
      {goal.target_date ? <p className="muted small">Target date {formatDate(goal.target_date)}</p> : null}
    </article>
  );
}

export function AthleteGoalsPanel() {
  const { athleteUserId, loading, error, goals } = useAthleteGoals();

  if (!athleteUserId) return null;

  if (loading && goals.length === 0) {
    return <p className="muted small">Loading goals…</p>;
  }

  if (error) {
    return <p role="status" className="muted small error">{error}</p>;
  }

  if (goals.length === 0) {
    return (
      <div className="empty-state compact-empty">
        <p>No goals yet.</p>
      </div>
    );
  }

  return (
    <>
      {goals.map((goal) => (
        <GoalCard key={String(goal.goal_id)} goal={goal} />
      ))}
    </>
  );
}
