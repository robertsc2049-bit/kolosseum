import React, { useEffect, useMemo, useState } from "react";

import { type JsonRecord } from "../../api/transport";
import { useAthleteMyProgramme } from "./useAthleteMyProgramme";
import { PRINTING_CLASS, ProgrammePrintSheet } from "./ProgrammePrintSheet";

// "My programme": the whole programme at a glance. A strip of blocks sized
// by their weeks (so a 12-week plan reads left to right, like the coach's
// builder), the chosen week's days side by side, and each day's exercises
// with the dose. Done days are ticked; the next one is highlighted.

type Exercise = { name: string; segment: string; sets: number; reps: string; load: string; rest_seconds: number | null; notes?: string };
type Session = { session_index: number; title: string; state: string; date: string | null; exercises: Exercise[] };
type Week = { week_number: number; sessions: Session[] };
type Block = { name: string; block_type: string; weeks: Week[] };

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const STATE_LABEL: Record<string, string> = {
  done: "Done",
  partial: "Partly done",
  current: "Next up",
  skipped: "Skipped",
  upcoming: ""
};

export function restLabel(seconds: number | null): string {
  if (!seconds) return "";
  if (seconds < 120 || seconds % 30 !== 0) return `${seconds}s rest`;
  return `${seconds / 60} min rest`;
}

export function doseLabel(exercise: Exercise): string {
  const reps = exercise.reps.trim();
  if (!reps) return `${exercise.sets} sets`;
  return exercise.sets > 1 ? `${exercise.sets} × ${reps}` : reps;
}

function weekState(week: Week): string {
  const states = week.sessions.map((session) => session.state);
  if (states.includes("current")) return "current";
  if (states.length && states.every((state) => state === "done" || state === "partial")) return "done";
  if (states.some((state) => state === "done" || state === "partial")) return "started";
  if (states.every((state) => state === "skipped")) return "skipped";
  return "upcoming";
}

function ExerciseRows({ exercises }: { exercises: Exercise[] }) {
  return (
    <ul className="my-programme-exercises">
      {exercises.map((exercise, index) => (
        <li key={`${exercise.name}-${index}`}>
          <span className="my-programme-exercise-name">{exercise.name}</span>
          <span className="my-programme-dose">{doseLabel(exercise)}</span>
          <span className="my-programme-load">{exercise.load}</span>
          <span className="my-programme-rest muted">{restLabel(exercise.rest_seconds)}</span>
          {exercise.notes ? <span className="my-programme-notes muted">{exercise.notes}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function DayCard({ session }: { session: Session }) {
  const working = session.exercises.filter((exercise) => exercise.segment === "working");
  const warmUp = session.exercises.filter((exercise) => exercise.segment === "warm_up");
  const coolDown = session.exercises.filter((exercise) => exercise.segment === "cool_down");
  const label = STATE_LABEL[session.state] ?? "";
  const date = session.date && (session.state === "done" || session.state === "partial")
    ? new Date(session.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })
    : "";
  return (
    <article className={`my-programme-day is-${session.state}`} data-testid="my-programme-day" aria-current={session.state === "current" ? "step" : undefined}>
      <header>
        <p className="eyebrow">{`Session ${session.session_index + 1}`}</p>
        <h4>{session.title}</h4>
        {label ? <span className={`my-programme-state is-${session.state}`}>{session.state === "done" ? `✓ ${label}` : label}{date ? ` · ${date}` : ""}</span> : null}
      </header>
      {warmUp.length ? (
        <details className="my-programme-bookend">
          <summary>{`Warm-up (${warmUp.length})`}</summary>
          <ExerciseRows exercises={warmUp} />
        </details>
      ) : null}
      <ExerciseRows exercises={working} />
      {coolDown.length ? (
        <details className="my-programme-bookend">
          <summary>{`Cool-down (${coolDown.length})`}</summary>
          <ExerciseRows exercises={coolDown} />
        </details>
      ) : null}
    </article>
  );
}

export function AthleteMyProgrammePanel() {
  const { data, error } = useAthleteMyProgramme();
  const blocks = useMemo(() => asArray<Block>(data?.blocks), [data]);
  const weeks = useMemo(() => blocks.flatMap((block) => block.weeks.map((week) => ({ ...week, block }))), [blocks]);
  const current = (data?.current ?? {}) as JsonRecord;
  const currentWeek = Number(current.week_number) || 1;
  // Open on the athlete's current week, and follow it when they move on: a
  // week they chose only holds while their current week is the one it was
  // chosen from (worked out here, not in an effect, so it can't race a click).
  const [choice, setChoice] = useState<{ week: number; from: number } | null>(null);
  const setSelected = (week: number | null) => setChoice(week === null ? null : { week, from: currentWeek });
  const weekNumber = choice && choice.from === currentWeek ? choice.week : currentWeek;
  const week = weeks.find((entry) => entry.week_number === weekNumber) ?? weeks[0];

  // Printing: the buttons choose this week or the whole programme; the
  // browser's own Print (Ctrl+P) on this page prints the week on screen.
  // Either way only the paper sheet prints, never the app around it.
  const [printScope, setPrintScope] = useState<"week" | "all" | "overview" | null>(null);
  useEffect(() => {
    const onScreen = () => document.getElementById("view-programme")?.hidden === false;
    const before = () => { if (onScreen()) document.body.classList.add(PRINTING_CLASS); };
    const after = () => { document.body.classList.remove(PRINTING_CLASS); setPrintScope(null); };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
      document.body.classList.remove(PRINTING_CLASS);
    };
  }, []);
  useEffect(() => {
    if (!printScope) return;
    document.body.classList.add(PRINTING_CLASS);
    window.print();
  }, [printScope]);

  if (error && !data) return <p className="field-error" role="alert">{error}</p>;
  if (!data) return <p className="muted">Loading your programme…</p>;
  if (data.status === "none") {
    return (
      <div className="empty-state" data-testid="my-programme-empty">
        <h3>No programme yet</h3>
        <p className="muted">When your coach assigns you a programme, every block, week and session shows here.</p>
      </div>
    );
  }
  if (data.status === "unavailable" || !week) {
    return <p className="muted" data-testid="my-programme-unavailable">Your programme can't be shown right now. Ask your coach to check it's still active.</p>;
  }

  const programme = (data.programme ?? {}) as JsonRecord;
  const total = Number(programme.total_sessions) || 0;
  const done = Number(data.completed_sessions) || 0;
  const totalWeeks = weeks.length;
  const position = weeks.findIndex((entry) => entry.week_number === week.week_number);

  return (
    <section className="my-programme" data-testid="my-programme">
      <ProgrammePrintSheet
        programmeName={String(programme.name ?? "Your programme")}
        source={String(data.source ?? "")}
        weeks={printScope === "all" ? weeks : printScope === "overview" ? [] : [week]}
        overview={printScope === "all" || printScope === "overview" ? { weeks, totals: { weeks: totalWeeks, sessions: total, done } } : null}
      />
      <div className="my-programme-heading">
        <div>
          <p className="eyebrow">{data.source === "coach" ? "From your coach" : "Kolosseum programme"}</p>
          <h3>{String(programme.name ?? "Your programme")}</h3>
          <p className="my-programme-progress muted">
            {data.status === "complete"
              ? `Finished - all ${total} sessions done`
              : `${done} of ${total} sessions done · Week ${currentWeek} of ${totalWeeks}${current.block_name ? ` · ${String(current.block_name)}` : ""}`}
          </p>
        </div>
        <div className="my-programme-print-actions">
          <button type="button" className="button secondary small-button" onClick={() => setPrintScope("overview")}>Print overview</button>
          <button type="button" className="button secondary small-button" onClick={() => setPrintScope("week")}>Print this week</button>
          <button type="button" className="button secondary small-button" onClick={() => setPrintScope("all")}>Print whole programme</button>
        </div>
      </div>

      <div className="my-programme-timeline" role="group" aria-label="Blocks and weeks">
        {blocks.map((block, blockIndex) => (
          <div
            key={`${block.name}-${blockIndex}`}
            className={`my-programme-block is-${block.block_type}`}
            style={{ flexGrow: block.weeks.length, flexBasis: 0, ["--weeks" as string]: block.weeks.length } as React.CSSProperties}
            data-testid="my-programme-block"
          >
            <span className="my-programme-block-name" title={block.name}>{block.name}</span>
            <div className="my-programme-week-cells">
              {block.weeks.map((entry) => (
                <button
                  key={entry.week_number}
                  type="button"
                  className={`my-programme-week-cell is-${weekState(entry)}${entry.week_number === week.week_number ? " is-selected" : ""}`}
                  aria-pressed={entry.week_number === week.week_number}
                  aria-label={`Week ${entry.week_number}`}
                  onClick={() => setSelected(entry.week_number)}
                >
                  {entry.week_number}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="my-programme-week-bar">
        <button type="button" className="button secondary" disabled={position <= 0} onClick={() => setSelected(weeks[position - 1].week_number)} aria-label="Previous week">‹<span className="my-programme-wide"> Previous week</span></button>
        <h4>{`Week ${week.week_number}`}<span className="muted my-programme-wide">{` · ${week.block.name}`}</span></h4>
        <button type="button" className="button secondary" disabled={position >= weeks.length - 1} onClick={() => setSelected(weeks[position + 1].week_number)} aria-label="Next week"><span className="my-programme-wide">Next week </span>›</button>
      </div>
      {week.week_number !== currentWeek && data.status !== "complete" ? (
        <button type="button" className="button secondary my-programme-back" onClick={() => setSelected(null)}>{`Back to this week (week ${currentWeek})`}</button>
      ) : null}

      <div className="my-programme-days">
        {week.sessions.map((session) => <DayCard key={session.session_index} session={session} />)}
      </div>
    </section>
  );
}
