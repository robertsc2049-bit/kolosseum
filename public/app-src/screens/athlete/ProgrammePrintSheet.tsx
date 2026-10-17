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

const eyebrow = (source: string, viewer: "athlete" | "coach") => viewer === "coach" ? "Coach's copy" : source === "coach" ? "From your coach" : "Kolosseum programme";

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

function OverviewPage({ programmeName, source, viewer, weeks, totals }: { programmeName: string; source: string; viewer: "athlete" | "coach"; weeks: PrintWeek[]; totals: { weeks: number; sessions: number; done: number } }) {
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
          <p>{`${eyebrow(source, viewer)} · Overview`}</p>
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

// The cover: who the programme is for and from, when it started, what it
// builds to, the athlete's bodyweight and weight class, the blocks with
// their weeks (and planned dates, from the start date), and the coach's
// notes. The athlete's copy then says how to use the sheets; the coach's
// copy (viewer "coach") lists the maxes the weights come from and the
// bodyweight history instead - never shown to the athlete.
export type ProgrammeCover = {
  athlete_name?: string;
  coach_name?: string;
  description?: string;
  started_on?: string | null;
  competition?: { name: string; date: string } | null;
  bodyweight?: { value: number; unit: string; as_of: string | null } | null;
  weight_class_kg?: number | null;
  maxes?: Array<{ name: string; value: number | null; unit: string; basis: string; date: string | null }>;
  bodyweight_history?: Array<{ value: number; unit: string; date: string | null }>;
};

const day = (iso: string | null | undefined) => {
  if (!iso) return "";
  const date = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};
const plusDays = (iso: string, days: number) => {
  const date = new Date(`${iso.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

function CoverPage({ programmeName, source, viewer, cover, weeks, totals }: {
  programmeName: string;
  source: string;
  viewer: "athlete" | "coach";
  cover: ProgrammeCover;
  weeks: PrintWeek[];
  totals: { weeks: number; sessions: number; done: number; current_week: number; current_block: string };
}) {
  const blocks: Array<{ name: string; block_type: string; first: number; last: number }> = [];
  for (const week of weeks) {
    const last = blocks[blocks.length - 1];
    if (last && last.name === week.block.name && last.last === week.week_number - 1) last.last = week.week_number;
    else blocks.push({ name: week.block.name, block_type: week.block.block_type, first: week.week_number, last: week.week_number });
  }
  const start = cover.started_on ?? null;
  const facts: Array<[string, string]> = [
    ["Athlete", cover.athlete_name || "-"],
    [source === "coach" ? "Coach" : "Programme", source === "coach" ? (cover.coach_name || "Your coach") : "Kolosseum programme"],
    ["Started", day(start) || "-"],
    ["Length", `${totals.weeks} weeks · ${totals.sessions} sessions`],
    [viewer === "coach" ? "Progress" : "Where you are", totals.done >= totals.sessions ? "Finished" : `Week ${totals.current_week}${totals.current_block ? ` · ${totals.current_block}` : ""} · ${totals.done} of ${totals.sessions} done`]
  ];
  if (cover.competition) facts.push(["Competition", `${cover.competition.name} · ${day(cover.competition.date)}`]);
  if (cover.bodyweight) facts.push(["Bodyweight", `${cover.bodyweight.value} ${cover.bodyweight.unit}${cover.bodyweight.as_of ? ` (recorded ${day(cover.bodyweight.as_of)})` : ""}`]);
  if (cover.weight_class_kg) facts.push(["Weight class", `${cover.weight_class_kg} kg`]);
  return (
    <article className="print-cover" data-testid="print-cover">
      <header className="print-cover-title">
        <p>{viewer === "coach" ? "Training programme · coach's copy" : "Training programme"}</p>
        <h1>{programmeName}</h1>
      </header>
      <dl className="print-cover-facts">
        {facts.map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
      <section className="print-cover-section">
        <h2>Blocks</h2>
        <table className="print-cover-table">
          <thead><tr><th>Block</th><th>Weeks</th>{start ? <th>Planned dates</th> : null}</tr></thead>
          <tbody>
            {blocks.map((block) => (
              <tr key={`${block.name}-${block.first}`}>
                <td><strong>{block.name}</strong>{block.block_type === "deload" ? " (lighter)" : ""}</td>
                <td>{block.first === block.last ? `Week ${block.first}` : `Weeks ${block.first}-${block.last}`}</td>
                {start ? <td>{`${day(plusDays(start, (block.first - 1) * 7))} - ${day(plusDays(start, block.last * 7 - 1))}`}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {cover.description ? (
        <section className="print-cover-section">
          <h2>{viewer === "coach" ? "Programme notes" : source === "coach" ? "From your coach" : "About this programme"}</h2>
          <p className="print-cover-notes">{cover.description}</p>
        </section>
      ) : null}
      {viewer === "coach" ? (
        <>
          <section className="print-cover-section" data-testid="print-cover-maxes">
            <h2>Maxes the weights are worked out from</h2>
            {cover.maxes?.length ? (
              <table className="print-cover-table">
                <thead><tr><th>Lift</th><th>Max</th><th>Type</th><th>Recorded</th></tr></thead>
                <tbody>
                  {cover.maxes.map((max) => (
                    <tr key={max.name}><td>{max.name}</td><td><strong>{max.value === null ? "-" : `${max.value} ${max.unit}`}</strong></td><td>{max.basis}</td><td>{day(max.date)}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : <p>No maxes recorded yet.</p>}
          </section>
          {cover.bodyweight_history?.length ? (
            <section className="print-cover-section">
              <h2>Bodyweight</h2>
              <p>{cover.bodyweight_history.map((entry) => `${entry.value} ${entry.unit}${entry.date ? ` (${day(entry.date)})` : ""}`).join(" → ")}</p>
            </section>
          ) : null}
        </>
      ) : (
        <section className="print-cover-section print-cover-howto">
          <h2>Using these sheets</h2>
          <ul>
            <li>Each week has its own page. Write the weight and reps you actually did in the box for each set.</li>
            <li>Note anything that hurt, felt off or felt easy on the session's notes line.</li>
            <li>Bring the sheets to your check-ins, and log your sessions in the app so your coach sees them.</li>
          </ul>
        </section>
      )}
      <footer className="print-cover-footer">{`Printed ${day(new Date().toISOString())}`}</footer>
    </article>
  );
}

export function ProgrammePrintSheet({ programmeName, source, weeks, overview = null, cover = null, viewer = "athlete" }: {
  programmeName: string;
  source: string;
  weeks: PrintWeek[];
  overview?: { weeks: PrintWeek[]; totals: { weeks: number; sessions: number; done: number } } | null;
  cover?: { cover: ProgrammeCover; weeks: PrintWeek[]; totals: { weeks: number; sessions: number; done: number; current_week: number; current_block: string } } | null;
  viewer?: "athlete" | "coach";
}) {
  if (typeof document === "undefined") return null;
  const overviewPages = overview
    ? Array.from({ length: Math.ceil(overview.weeks.length / WEEKS_PER_OVERVIEW_PAGE) }, (_, page) => overview.weeks.slice(page * WEEKS_PER_OVERVIEW_PAGE, (page + 1) * WEEKS_PER_OVERVIEW_PAGE))
    : [];
  const sheet = (
    <div id={PRINT_ROOT_ID} data-testid="programme-print">
      {cover ? <CoverPage programmeName={programmeName} source={source} viewer={viewer} cover={cover.cover} weeks={cover.weeks} totals={cover.totals} /> : null}
      {overviewPages.map((pageWeeks, page) => (
        <OverviewPage key={`overview-${page}`} programmeName={programmeName} source={source} viewer={viewer} weeks={pageWeeks} totals={overview!.totals} />
      ))}
      {weeks.map((week) => (
        <article key={week.week_number} className="print-week">
          <header className="print-week-header">
            <div>
              <p>{eyebrow(source, viewer)}</p>
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
