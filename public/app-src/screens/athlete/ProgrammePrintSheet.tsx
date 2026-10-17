import React from "react";
import { createPortal } from "react-dom";

import { restDuration } from "../../utils/format";

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

const rest = restDuration;

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

// The overview: the whole programme on one landscape page per 12 weeks -
// blocks across the top, then a row per training day and a column per
// week, each cell the day's main lift (the first exercise of the main
// work) with its sets x reps and load, ticked once trained. It reads like
// a coach's plan: how the main lifts climb from week to week.
const WEEKS_PER_OVERVIEW_PAGE = 12;
const BLOCK_FOCUS: Record<string, string> = { volume: "Volume", strength: "Strength", peak: "Peak", deload: "Lighter", taper: "Taper", power: "Power", hypertrophy: "Muscle" };

const mostCommon = (values: string[]): string => {
  const counts = new Map<string, number>();
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
};
const mainLift = (session: PrintSession | undefined) => session?.exercises.find((exercise) => exercise.segment === "working");

export function overviewRows(weeks: PrintWeek[]) {
  const slots = Math.max(0, ...weeks.map((week) => week.sessions.length));
  return Array.from({ length: slots }, (_, slot) => {
    const sessions = weeks.map((week) => week.sessions[slot]);
    return {
      title: mostCommon(sessions.map((session) => session?.title ?? "")) || `Day ${slot + 1}`,
      lift: mostCommon(sessions.map((session) => mainLift(session)?.name ?? "")),
      sessions
    };
  });
}

// "115 kg (72.5%)" as the weight, then the % beneath it.
function LoadLines({ load }: { load: string }) {
  const split = /^(.*?)\s*\((.+)\)$/u.exec(load);
  return split ? <><span>{split[1]}</span><small>{split[2]}</small></> : <span>{load}</span>;
}

function OverviewPage({ programmeName, source, weeks, totals }: { programmeName: string; source: string; weeks: PrintWeek[]; totals: { weeks: number; sessions: number; done: number } }) {
  const blocks: Array<{ name: string; block_type: string; first: number; last: number }> = [];
  for (const week of weeks) {
    const last = blocks[blocks.length - 1];
    if (last && last.name === week.block.name && last.last === week.week_number - 1) last.last = week.week_number;
    else blocks.push({ name: week.block.name, block_type: week.block.block_type, first: week.week_number, last: week.week_number });
  }
  const rows = overviewRows(weeks);
  return (
    <article className="print-overview" data-testid="print-overview">
      <header className="print-week-header">
        <div>
          <p>{`${source === "coach" ? "From your coach" : "Kolosseum programme"} · Overview`}</p>
          <h1>{programmeName}</h1>
        </div>
        <h2>{`${totals.weeks} weeks · ${totals.sessions} sessions${totals.done ? ` · ${totals.done} done` : ""}`}</h2>
      </header>
      <table className="print-overview-grid">
        <colgroup>
          <col className="print-overview-label" />
          {weeks.map((week) => <col key={week.week_number} />)}
        </colgroup>
        <thead>
          <tr className="print-overview-blocks">
            <th />
            {blocks.map((block) => (
              <th key={`${block.name}-${block.first}`} colSpan={block.last - block.first + 1}>
                {block.name}
                {BLOCK_FOCUS[block.block_type] && BLOCK_FOCUS[block.block_type] !== block.name ? <span>{BLOCK_FOCUS[block.block_type]}</span> : null}
              </th>
            ))}
          </tr>
          <tr>
            <th />
            {weeks.map((week) => <th key={week.week_number}>{`Wk ${week.week_number}`}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, slot) => (
            <tr key={slot}>
              <th scope="row">
                <strong>{row.title}</strong>
                {row.lift ? <span>{row.lift}</span> : null}
              </th>
              {row.sessions.map((session, index) => {
                const lift = mainLift(session);
                const done = session?.state === "done" || session?.state === "partial";
                return (
                  <td key={index} className={done ? "is-done" : undefined}>
                    {session ? (
                      <>
                        {session.title !== row.title ? <em>{session.title}</em> : null}
                        {lift && lift.name !== row.lift ? <em>{lift.name}</em> : null}
                        {lift ? <b>{lift.reps.trim() ? (lift.sets > 1 ? `${lift.sets}×${lift.reps}` : lift.reps) : `${lift.sets} sets`}</b> : null}
                        {lift?.load ? <LoadLines load={lift.load} /> : null}
                        {done ? <i aria-label="done">✓</i> : null}
                      </>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="print-overview-key">Each cell: the day's main lift - sets × reps, then load. ✓ = trained.</p>
    </article>
  );
}

export function ProgrammePrintSheet({ programmeName, source, weeks, overview = null }: {
  programmeName: string;
  source: string;
  weeks: PrintWeek[];
  overview?: { weeks: PrintWeek[]; totals: { weeks: number; sessions: number; done: number } } | null;
}) {
  if (typeof document === "undefined") return null;
  const overviewPages = overview
    ? Array.from({ length: Math.ceil(overview.weeks.length / WEEKS_PER_OVERVIEW_PAGE) }, (_, page) => overview.weeks.slice(page * WEEKS_PER_OVERVIEW_PAGE, (page + 1) * WEEKS_PER_OVERVIEW_PAGE))
    : [];
  const sheet = (
    <div id={PRINT_ROOT_ID} data-testid="programme-print">
      {overviewPages.map((pageWeeks, page) => (
        <OverviewPage key={`overview-${page}`} programmeName={programmeName} source={source} weeks={pageWeeks} totals={overview!.totals} />
      ))}
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
