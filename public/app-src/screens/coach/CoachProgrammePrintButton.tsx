import React, { useEffect, useState } from "react";

import { request, type JsonRecord } from "../../api/transport";
import { PRINTING_CLASS, ProgrammePrintSheet, type PrintWeek, type ProgrammeCover } from "../athlete/ProgrammePrintSheet";

// The coach's printed copy of an athlete's current programme: a cover with
// the athlete's maxes and bodyweight history, the overview, then a page per
// week - each weight with the % of max it comes from (the athlete's own
// prints never show either).
type Exercise = { name: string; segment: string; sets: number; reps: string; load: string; rest_seconds: number | null; notes?: string; percent?: number | null };

export function coachPrintWeeks(data: JsonRecord): PrintWeek[] {
  const blocks = Array.isArray(data.blocks) ? (data.blocks as Array<{ name: string; block_type: string; weeks: Array<{ week_number: number; sessions: Array<JsonRecord> }> }>) : [];
  return blocks.flatMap((block) => block.weeks.map((week) => ({
    week_number: week.week_number,
    block: { name: block.name, block_type: block.block_type },
    sessions: week.sessions.map((session) => ({
      session_index: Number(session.session_index),
      title: String(session.title ?? ""),
      state: String(session.state ?? "upcoming"),
      date: typeof session.date === "string" ? session.date : null,
      exercises: (Array.isArray(session.exercises) ? (session.exercises as Exercise[]) : []).map((exercise) => ({
        ...exercise,
        // "115 kg (72.5%)": the coach's copy keeps the % beside the weight.
        load: exercise.load && typeof exercise.percent === "number" ? `${exercise.load} (${exercise.percent}%)` : exercise.load || (typeof exercise.percent === "number" ? `${exercise.percent}%` : "")
      }))
    }))
  })));
}

export function CoachProgrammePrintButton({ athleteUserId }: { athleteUserId: string }) {
  const [data, setData] = useState<JsonRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    document.body.classList.add(PRINTING_CLASS);
    const done = () => { document.body.classList.remove(PRINTING_CLASS); setData(null); };
    window.addEventListener("afterprint", done, { once: true });
    window.print();
    return () => {
      window.removeEventListener("afterprint", done);
      document.body.classList.remove(PRINTING_CLASS);
    };
  }, [data]);

  async function print() {
    setBusy(true);
    setMessage(null);
    try {
      const loaded = await request("GET", `/coach-workspace/athletes/${encodeURIComponent(athleteUserId)}/programme-print`);
      if (loaded.status !== "active" && loaded.status !== "complete") {
        setMessage(loaded.status === "none" ? "This athlete has no programme from you to print." : "This programme can't be printed right now.");
        return;
      }
      setData(loaded);
    }
    catch {
      setMessage("The programme could not be loaded for printing. Try again.");
    }
    finally {
      setBusy(false);
    }
  }

  const weeks = data ? coachPrintWeeks(data) : [];
  const programme = (data?.programme ?? {}) as JsonRecord;
  const current = (data?.current ?? {}) as JsonRecord;
  const totals = { weeks: weeks.length, sessions: Number(programme.total_sessions) || 0, done: Number(data?.completed_sessions) || 0 };
  return (
    <>
      <button className="button secondary small-button" type="button" disabled={busy} onClick={() => void print()}>
        {busy ? "Preparing…" : "Print programme"}
      </button>
      {message ? <p role="status" className="muted small">{message}</p> : null}
      {data ? (
        <ProgrammePrintSheet
          programmeName={String(programme.name ?? "Programme")}
          source="coach"
          viewer="coach"
          weeks={weeks}
          overview={{ weeks, totals }}
          cover={{ cover: (data.cover ?? {}) as ProgrammeCover, weeks, totals: { ...totals, current_week: Number(current.week_number) || 1, current_block: String(current.block_name ?? "") } }}
        />
      ) : null}
    </>
  );
}
