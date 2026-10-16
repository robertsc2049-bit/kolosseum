import React from "react";
import { createPortal } from "react-dom";

// The paper copy of "My programme": black on white, one week to a page,
// every session a table with the prescription and empty boxes to write in
// what was lifted. Rendered straight into <body> (outside the app shell) so
// the print stylesheet can hide the whole app and show only this.

export type PrintExercise = { name: string; segment: string; sets: number; reps: string; load: string; rest_seconds: number | null; notes?: string };
export type PrintSession = { session_index: number; title: string; state: string; date: string | null; exercises: PrintExercise[] };
export type PrintWeek = { week_number: number; sessions: PrintSession[]; block: { name: string; block_type: string } };

export const PRINT_ROOT_ID = "programme-print-root";
export const PRINTING_CLASS = "printing-programme";
const MAX_SET_BOXES = 8;

function rest(seconds: number | null): string {
  if (!seconds) return "";
  if (seconds < 120 || seconds % 30 !== 0) return `${seconds}s`;
  return `${seconds / 60} min`;
}

function dose(exercise: PrintExercise): string {
  const reps = exercise.reps.trim();
  if (!reps) return `${exercise.sets} sets`;
  return exercise.sets > 1 ? `${exercise.sets} × ${reps}` : reps;
}

// Warm-up and cool-down on one line each - the main work gets the rows.
function BookendRow({ label, exercises }: { label: string; exercises: PrintExercise[] }) {
  if (!exercises.length) return null;
  return (
    <tr className="print-segment">
      <td colSpan={5}><strong>{`${label}: `}</strong>{exercises.map((exercise) => `${exercise.name} ${dose(exercise)}`).join(" · ")}</td>
    </tr>
  );
}

function Rows({ exercises, logged }: { exercises: PrintExercise[]; logged: boolean }) {
  return (
    <>
      {exercises.map((exercise, index) => (
        <tr key={`${exercise.name}-${index}`}>
          <td className="print-exercise">
            <strong>{exercise.name}</strong>
            {exercise.notes ? <span className="print-notes">{exercise.notes}</span> : null}
          </td>
          <td className="print-dose">{dose(exercise)}</td>
          <td>{exercise.load}</td>
          <td>{rest(exercise.rest_seconds)}</td>
          <td className="print-lifted">
            {logged
              ? Array.from({ length: Math.min(Math.max(exercise.sets, 1), MAX_SET_BOXES) }, (_, set) => <span key={set} className="print-box" aria-hidden="true" />)
              : null}
          </td>
        </tr>
      ))}
    </>
  );
}

function SessionTable({ session }: { session: PrintSession }) {
  const warmUp = session.exercises.filter((exercise) => exercise.segment === "warm_up");
  const working = session.exercises.filter((exercise) => exercise.segment === "working");
  const coolDown = session.exercises.filter((exercise) => exercise.segment === "cool_down");
  const done = session.state === "done" || session.state === "partial";
  return (
    <section className="print-session" data-testid="print-session">
      <header>
        <h3>{`Session ${session.session_index + 1} · ${session.title}`}</h3>
        <span className="print-date">
          {done && session.date
            ? `✓ Done ${new Date(session.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
            : "Date: ____________"}
        </span>
      </header>
      <table>
        <thead>
          <tr><th>Exercise</th><th>Sets × reps</th><th>Load</th><th>Rest</th><th>Lifted - weight × reps, each set</th></tr>
        </thead>
        <tbody>
          <BookendRow label="Warm-up" exercises={warmUp} />
          <Rows exercises={working} logged />
          <BookendRow label="Cool-down" exercises={coolDown} />
        </tbody>
      </table>
      <p className="print-session-notes">Notes:</p>
    </section>
  );
}

export function ProgrammePrintSheet({ programmeName, source, weeks }: { programmeName: string; source: string; weeks: PrintWeek[] }) {
  if (typeof document === "undefined") return null;
  const sheet = (
    <div id={PRINT_ROOT_ID} data-testid="programme-print">
      {weeks.map((week) => (
        <article key={week.week_number} className="print-week">
          <header className="print-week-header">
            <div>
              <p>{source === "coach" ? "From your coach" : "Kolosseum programme"}</p>
              <h1>{programmeName}</h1>
            </div>
            <h2>{`Week ${week.week_number} · ${week.block.name}${week.block.block_type === "deload" ? " (lighter)" : ""}`}</h2>
          </header>
          {week.sessions.map((session) => <SessionTable key={session.session_index} session={session} />)}
        </article>
      ))}
    </div>
  );
  return createPortal(sheet, document.body);
}
