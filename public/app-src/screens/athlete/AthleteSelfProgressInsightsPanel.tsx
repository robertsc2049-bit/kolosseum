import React from "react";

import { type JsonRecord } from "../../api/transport";
import { BODY_METRIC_TYPE_LABELS, formatDate, titleCase } from "../../utils/format";
import { useProgressInsights } from "./useProgressInsights";

// DEV NOTE: FULL-UI-36 athlete's own progress insights - ported from
// app.js's progressInsightsAdherenceText()/renderStrengthTrendCard()/
// renderHabitConsistencyCard()/renderBodyMetricTrendCard()/
// renderProgressInsightsSummary(). Named "Self" (and mounted into
// athlete-self-progress-insights-root) to avoid colliding with the
// unrelated, already-shipped coach-facing read-only mirror of the same
// domain (screens/coach/AthleteProgressInsightsPanel.tsx, viewing another
// athlete). That mirror flattens everything into one list; this keeps the
// athlete's own richer three-labeled-section layout the legacy markup had.

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

export function AthleteSelfProgressInsightsPanel() {
  const { loading, error, insights, exercises } = useProgressInsights();

  const strengthTrends = Array.isArray(insights?.strength_trends) ? (insights!.strength_trends as JsonRecord[]) : [];
  const habitConsistency = Array.isArray(insights?.habit_consistency) ? (insights!.habit_consistency as JsonRecord[]) : [];
  const bodyMetricTrends = Array.isArray(insights?.body_metric_trends) ? (insights!.body_metric_trends as JsonRecord[]) : [];

  return (
    <div className="panel progress-insights-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Progress</p>
          <h3>Progress insights</h3>
          <p className="muted">Computed from your own session, strength, habit and body-metric history over the last 30 days.</p>
        </div>
      </div>

      {loading && !insights ? (
        <p className="dashboard-status" role="status" aria-live="polite">Loading progress insights…</p>
      ) : error ? (
        <p className="dashboard-status" role="status" aria-live="polite">{error}</p>
      ) : insights ? (
        <>
          <p className="dashboard-status" role="status" aria-live="polite">{adherenceText(insights.session_adherence as JsonRecord)}</p>

          <div className="progress-insights-section">
            <h4>Strength trends</h4>
            <div className="record-list">
              {strengthTrends.length === 0 ? (
                <div className="empty-state compact-empty"><p>No strength benchmarks recorded yet.</p></div>
              ) : (
                strengthTrends.map((trend) => (
                  <StrengthTrendCard key={String(trend.exercise_id)} trend={trend} exercises={exercises} />
                ))
              )}
            </div>
          </div>

          <div className="progress-insights-section">
            <h4>Habit consistency</h4>
            <div className="record-list">
              {habitConsistency.length === 0 ? (
                <div className="empty-state compact-empty"><p>No habits tracked yet.</p></div>
              ) : (
                habitConsistency.map((habit, index) => (
                  <HabitConsistencyCard key={String(habit.habit_label) + index} habit={habit} />
                ))
              )}
            </div>
          </div>

          <div className="progress-insights-section">
            <h4>Body-metric trends</h4>
            <div className="record-list">
              {bodyMetricTrends.length === 0 ? (
                <div className="empty-state compact-empty"><p>No body-metric entries recorded yet.</p></div>
              ) : (
                bodyMetricTrends.map((trend) => (
                  <BodyMetricTrendCard key={String(trend.metric_type)} trend={trend} />
                ))
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
