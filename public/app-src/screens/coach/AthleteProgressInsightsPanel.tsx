import React from "react";

import { type JsonRecord } from "../../api/transport";
import { formatDate, titleCase } from "../../utils/format";
import { useAthleteProgressInsights } from "./useAthleteProgressInsights";

const BODY_METRIC_TYPE_LABELS: Record<string, string> = {
  waist_circumference_cm: "Waist",
  chest_circumference_cm: "Chest",
  arm_circumference_cm: "Arm",
  thigh_circumference_cm: "Thigh",
  hip_circumference_cm: "Hip",
  body_fat_percentage: "Body fat",
  body_weight_kg: "Body weight",
  calories_kcal: "Calories",
  protein_g: "Protein",
  carbs_g: "Carbs",
  fat_g: "Fat"
};

function adherenceText(adherence: JsonRecord): string {
  if (adherence.has_sufficient_data !== true) {
    return "No sessions recorded in the last 30 days.";
  }
  return `${adherence.adherence_percentage}% adherence — ${adherence.completed_sessions} of ${adherence.total_sessions} sessions completed in the last 30 days.`;
}

function exerciseDisplayName(exerciseId: string, exercises: JsonRecord[]): string {
  const exercise = exercises.find((entry) => entry.exercise_id === exerciseId);
  return typeof exercise?.display_name === "string" ? exercise.display_name : titleCase(exerciseId);
}

function StrengthTrendCard({ trend, exercises }: { trend: JsonRecord; exercises: JsonRecord[] }) {
  const changeText = trend.has_prior_value
    ? `${Number(trend.delta) > 0 ? "+" : ""}${trend.delta} ${trend.current_unit} (${Number(trend.delta_percentage) > 0 ? "+" : ""}${trend.delta_percentage}%) since ${formatDate(trend.prior_effective_date)}`
    : "No prior benchmark to compare yet.";

  return (
    <article className="record-card">
      <div className="record-meta">
        <span className="badge neutral">{exerciseDisplayName(String(trend.exercise_id), exercises)}</span>
        <span className="muted small">{formatDate(trend.current_effective_date)}</span>
      </div>
      <strong>{String(trend.current_value)} {String(trend.current_unit)}</strong>
      <p className="muted small">{changeText}</p>
    </article>
  );
}

function HabitConsistencyCard({ habit }: { habit: JsonRecord }) {
  return (
    <article className="record-card">
      <div className="record-meta">
        <span className="badge neutral">{titleCase(habit.cadence)}</span>
      </div>
      <strong>{String(habit.habit_label)}</strong>
      <p className="muted small">
        {String(habit.completion_rate_percentage)}% of expected completions in the last 30 days ({String(habit.window_completions)}/{String(habit.window_expected_units)})
      </p>
      <p className="muted small">
        Current streak {String(habit.current_streak_length)} · Longest streak {String(habit.longest_streak_length)}
      </p>
    </article>
  );
}

function BodyMetricTrendCard({ trend }: { trend: JsonRecord }) {
  const metricType = String(trend.metric_type);
  const label = BODY_METRIC_TYPE_LABELS[metricType] ?? titleCase(metricType);
  const unitSuffix = trend.unit === "percent" ? "%" : ` ${String(trend.unit)}`;
  const changeText = trend.has_prior_value
    ? `${Number(trend.delta) > 0 ? "+" : ""}${trend.delta}${unitSuffix} (${Number(trend.delta_percentage) > 0 ? "+" : ""}${trend.delta_percentage}%) since ${formatDate(trend.prior_effective_date)}`
    : "No entry from 30+ days ago to compare yet.";

  return (
    <article className="record-card">
      <div className="record-meta">
        <span className="badge neutral">{label}</span>
        <span className="muted small">{formatDate(trend.latest_effective_date)}</span>
      </div>
      <strong>{String(trend.latest_value)}{unitSuffix}</strong>
      <p className="muted small">{changeText}</p>
    </article>
  );
}

export function AthleteProgressInsightsPanel() {
  const { athleteUserId, loading, error, insights, exercises } = useAthleteProgressInsights();

  if (!athleteUserId) return null;

  if (loading && !insights) {
    return <p className="muted small">Loading progress insights…</p>;
  }

  if (error) {
    return <p role="status" className="muted small error">{error}</p>;
  }

  if (!insights) return null;

  const strengthTrends = Array.isArray(insights.strength_trends) ? (insights.strength_trends as JsonRecord[]) : [];
  const habitConsistency = Array.isArray(insights.habit_consistency) ? (insights.habit_consistency as JsonRecord[]) : [];
  const bodyMetricTrends = Array.isArray(insights.body_metric_trends) ? (insights.body_metric_trends as JsonRecord[]) : [];

  return (
    <>
      <p className="muted small">{adherenceText(insights.session_adherence as JsonRecord)}</p>
      {strengthTrends.map((trend) => (
        <StrengthTrendCard key={String(trend.exercise_id)} trend={trend} exercises={exercises} />
      ))}
      {habitConsistency.map((habit, index) => (
        <HabitConsistencyCard key={String(habit.habit_label) + index} habit={habit} />
      ))}
      {bodyMetricTrends.map((trend) => (
        <BodyMetricTrendCard key={String(trend.metric_type)} trend={trend} />
      ))}
    </>
  );
}
