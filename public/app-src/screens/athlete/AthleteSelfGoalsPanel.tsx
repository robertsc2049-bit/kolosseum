import React, { useState } from "react";

import { type JsonRecord } from "../../api/transport";
import { BODY_METRIC_TYPE_LABELS, formatDate, titleCase } from "../../utils/format";
import { useAthleteGoalsSelf } from "./useAthleteGoalsSelf";

// DEV NOTE: FULL-UI-37 athlete's own goal-setting - ported from app.js's
// renderAthleteGoalMetricLine()/renderAthleteGoalCard()/
// renderAthleteGoalList()/refreshAthleteGoals()/
// updateAthleteGoalTargetValueVisibility()/createAthleteGoal()/
// resolveAthleteGoal(). Named "Self" (and mounted into
// athlete-self-goals-root) to avoid colliding with the unrelated,
// already-shipped coach-facing read-only mirror of the same domain
// (screens/coach/AthleteGoalsPanel.tsx, viewing another athlete's goals -
// which never renders Mark achieved/Abandon controls since a coach has no
// route to take those actions).

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

function GoalCard({ goal, onResolve }: { goal: JsonRecord; onResolve: (goalId: string, resolution: "achieved" | "abandoned") => void }) {
  const statusBadgeClass = STATUS_BADGE_CLASS[String(goal.status)] ?? "neutral";
  const active = goal.status === "active";

  return (
    <article className="record-card">
      <div className="record-meta">
        <span className={`badge ${statusBadgeClass}`}>{titleCase(goal.status)}</span>
      </div>
      <strong>{String(goal.goal_label)}</strong>
      {goal.metric_type ? <GoalMetricLine goal={goal} /> : null}
      {goal.target_date ? <p className="muted small">Target date {formatDate(goal.target_date)}</p> : null}
      {active ? (
        <div className="inline-controls">
          <button className="button secondary" type="button" onClick={() => onResolve(String(goal.goal_id), "achieved")}>Mark achieved</button>
          <button className="button secondary" type="button" onClick={() => onResolve(String(goal.goal_id), "abandoned")}>Abandon</button>
        </div>
      ) : null}
    </article>
  );
}

export function AthleteSelfGoalsPanel() {
  const { goals, submitError, createGoal, resolveGoal } = useAthleteGoalsSelf();
  const [goalLabel, setGoalLabel] = useState("");
  const [metricType, setMetricType] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedLabel = goalLabel.trim();
    if (!trimmedLabel) {
      setValidationError("Enter a goal.");
      return;
    }

    if (metricType && targetValue === "") {
      setValidationError("Enter a target value for the linked measurement.");
      return;
    }

    setValidationError(null);

    const ok = await createGoal({
      goal_label: trimmedLabel,
      target_date: targetDate || null,
      ...(metricType ? { metric_type: metricType, target_value: Number(targetValue) } : {})
    });

    if (ok) {
      setGoalLabel("");
      setMetricType("");
      setTargetValue("");
      setTargetDate("");
    }
  }

  const statusText = validationError ?? submitError;

  return (
    <div className="panel athlete-goals-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Goals</p>
          <h3>Goals</h3>
        </div>
      </div>

      <form className="athlete-detail-note-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Goal</span>
          <input type="text" maxLength={120} required value={goalLabel} onChange={(event) => setGoalLabel(event.target.value)} />
        </label>

        <label className="field">
          <span>Linked measurement (optional)</span>
          <select value={metricType} onChange={(event) => setMetricType(event.target.value)}>
            <option value="">No linked metric</option>
            <option value="waist_circumference_cm">Waist (cm)</option>
            <option value="chest_circumference_cm">Chest (cm)</option>
            <option value="arm_circumference_cm">Arm (cm)</option>
            <option value="thigh_circumference_cm">Thigh (cm)</option>
            <option value="hip_circumference_cm">Hip (cm)</option>
            <option value="body_fat_percentage">Body fat (%)</option>
            <option value="body_weight_kg">Body weight (kg)</option>
          </select>
        </label>

        {metricType ? (
          <label className="field">
            <span>Target value</span>
            <input type="number" step={0.1} value={targetValue} onChange={(event) => setTargetValue(event.target.value)} />
          </label>
        ) : null}

        <label className="field">
          <span>Target date (optional)</span>
          <input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
        </label>

        <div className="inline-controls">
          <button className="button primary" type="submit">Set goal</button>
        </div>
      </form>

      {statusText ? <p className="dashboard-status" role="status" aria-live="polite">{statusText}</p> : null}

      <div className="record-list">
        {goals.length === 0 ? (
          <div className="empty-state compact-empty"><p>No goals yet.</p></div>
        ) : (
          goals.map((goal) => (
            <GoalCard key={String(goal.goal_id)} goal={goal} onResolve={resolveGoal} />
          ))
        )}
      </div>
    </div>
  );
}
