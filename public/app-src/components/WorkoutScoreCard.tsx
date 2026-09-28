import React from "react";

import { type JsonRecord } from "../api/transport";
import { formatDate, groupTimingLabel, titleCase } from "../utils/format";

// One timed workout (AMRAP, EMOM, for time) and its scores over time, the way
// CrossFit keeps them: Rx and scaled are labelled on every score and have
// separate bests - shared by the coach's and the athlete's progress panels.
export function WorkoutScoreCard({ workout, exercises }: { workout: JsonRecord; exercises: JsonRecord[] }) {
  const name = (id: string) => {
    const match = exercises.find((entry) => entry.exercise_id === id);
    return typeof match?.display_name === "string" ? match.display_name : titleCase(id);
  };
  const members = Array.isArray(workout.exercises) ? (workout.exercises as JsonRecord[]) : [];
  const memberLine = members.map((m) => {
    const dose = m.distance_m ? `${Number(m.distance_m)} m` : m.duration_seconds ? `${Number(m.duration_seconds)}s` : m.reps ? `${Number(m.reps)}` : "";
    return `${dose ? `${dose} ` : ""}${name(String(m.exercise_id))}`;
  }).join(", ");
  const results = Array.isArray(workout.results) ? (workout.results as JsonRecord[]) : [];
  const best = (score: unknown) => (score && typeof score === "object" ? String((score as JsonRecord).label) : null);
  const bestRx = best(workout.best_rx);
  const bestScaled = best(workout.best_scaled);

  return (
    <article className="record-card workout-score-card" data-testid="workout-score">
      <div className="record-meta">
        <span className="badge neutral">{groupTimingLabel(workout)}</span>
        <span className="muted small">{memberLine}</span>
      </div>
      <p>
        {bestRx ? <strong>{`Best Rx: ${bestRx}`}</strong> : null}
        {bestRx && bestScaled ? " · " : null}
        {bestScaled ? <strong>{`Best scaled: ${bestScaled}`}</strong> : null}
      </p>
      <ul className="workout-score-results">
        {results.map((score) => (
          <li key={`${String(score.session_id)}-${String(score.date)}`}>
            <span>{formatDate(score.date)}</span>
            <span>{String(score.label)}</span>
            <span className={score.scaled ? "badge warning" : "badge success"}>{score.scaled ? "Scaled" : "Rx"}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
