import React, { useState } from "react";

import { type JsonRecord } from "../../api/transport";
import { titleCase } from "../../utils/format";
import { useAthleteHabitsSelf } from "./useAthleteHabitsSelf";

// DEV NOTE: FULL-UI-29 athlete's own habit tracking - ported from app.js's
// renderHabitCard()/renderHabitList()/refreshHabits()/createHabit()/
// logHabitCompletionToday()/archiveHabit(). Habit streak counts
// (current_streak_length/longest_streak_length/total_completions) arrive
// pre-computed on every habit record from GET /habits - computeHabitStreak()
// runs server-side only (see bodyMetricsAndHabitsLifecycle.mjs), this just
// renders the integers verbatim, same as legacy.
function HabitCard({ habit, onComplete, onArchive }: {
  habit: JsonRecord;
  onComplete: (habitId: string) => void;
  onArchive: (habitId: string) => void;
}) {
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
      {archived ? null : (
        <div className="inline-controls">
          <button className="button secondary" type="button" onClick={() => onComplete(String(habit.habit_id))}>Mark done today</button>
          <button className="button secondary" type="button" onClick={() => onArchive(String(habit.habit_id))}>Archive</button>
        </div>
      )}
    </article>
  );
}

export function AthleteSelfHabitsPanel() {
  const { habits, submitError, createHabit, completeToday, archive } = useAthleteHabitsSelf();
  const [habitLabel, setHabitLabel] = useState("");
  const [cadence, setCadence] = useState<"daily" | "weekly">("daily");
  const [validationError, setValidationError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedLabel = habitLabel.trim();
    if (!trimmedLabel) {
      setValidationError("Enter a habit.");
      return;
    }

    setValidationError(null);

    const ok = await createHabit({ habit_label: trimmedLabel, cadence });

    if (ok) {
      setHabitLabel("");
      setCadence("daily");
    }
  }

  const statusText = validationError ?? submitError;

  return (
    <div className="panel habits-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Habits</p>
          <h3>Habits</h3>
        </div>
      </div>

      <form className="athlete-detail-note-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Habit</span>
          <input type="text" maxLength={120} required value={habitLabel} onChange={(event) => setHabitLabel(event.target.value)} />
        </label>

        <label className="field">
          <span>Cadence</span>
          <select value={cadence} onChange={(event) => setCadence(event.target.value as "daily" | "weekly")}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </label>

        <div className="inline-controls">
          <button className="button primary" type="submit">Create habit</button>
        </div>
      </form>

      {statusText ? <p className="dashboard-status" role="status" aria-live="polite">{statusText}</p> : null}

      <div className="record-list">
        {habits.length === 0 ? (
          <div className="empty-state compact-empty"><p>No habits yet.</p></div>
        ) : (
          habits.map((habit) => (
            <HabitCard key={String(habit.habit_id)} habit={habit} onComplete={completeToday} onArchive={archive} />
          ))
        )}
      </div>
    </div>
  );
}
