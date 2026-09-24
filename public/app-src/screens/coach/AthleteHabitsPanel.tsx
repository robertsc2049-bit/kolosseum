import React from "react";

import { type JsonRecord } from "../../api/transport";
import { titleCase } from "../../utils/format";
import { useAthleteHabits } from "./useAthleteHabits";

function HabitCard({ habit }: { habit: JsonRecord }) {
  const archived = Boolean(habit.archived_at_iso8601);
  const currentStreak = Number(habit.current_streak_length ?? 0);

  return (
    <article className="record-card">
      <div className="record-meta">
        <span className="badge neutral">{titleCase(habit.cadence)}</span>
        {archived ? <span className="muted small">Archived</span> : null}
      </div>
      <strong>{String(habit.habit_label)}</strong>
      <p className="muted small">
        {currentStreak} day{currentStreak === 1 ? "" : "s"} logged in a row - longest {String(habit.longest_streak_length ?? 0)}, {String(habit.total_completions ?? 0)} total.
      </p>
    </article>
  );
}

export function AthleteHabitsPanel() {
  const { athleteUserId, loading, error, habits } = useAthleteHabits();

  if (!athleteUserId) return null;

  if (loading && habits.length === 0) {
    return <p className="muted small">Loading habits…</p>;
  }

  if (error) {
    return <p role="status" className="muted small error">{error}</p>;
  }

  if (habits.length === 0) {
    return (
      <div className="empty-state compact-empty">
        <p>No habits yet.</p>
      </div>
    );
  }

  return (
    <>
      {habits.map((habit) => <HabitCard key={String(habit.habit_id)} habit={habit} />)}
    </>
  );
}
