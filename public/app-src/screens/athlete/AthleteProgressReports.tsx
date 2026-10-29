import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { accountMayBeAthlete } from "../../api/client";
import { request, type JsonRecord } from "../../api/transport";
import { shortWeek } from "../../components/TrendChart";
import { ENTRY_AUTH_SUCCEEDED_EVENT } from "../entry/useEntryAuth";

// A progress report as the athlete gets it from their coach: the coach's
// message, how many sessions they did week by week, the best set they
// lifted on each exercise, their volume and how they felt. Only weights
// and reps they actually lifted - never an estimated max, a % of max or the
// coach's load ratios and flags (those stay with the coach).

const rows = (value: unknown) => (Array.isArray(value) ? (value as JsonRecord[]) : []);
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const show = (value: unknown, suffix = "") => (num(value) === null ? "–" : `${Number(value).toLocaleString()}${suffix}`);
const TYPE_TITLE: Record<string, string> = { week: "Weekly report", block: "Block report", cycle: "Cycle report", programme: "Programme report", year: "Yearly report", custom: "Progress report" };
export const ATHLETE_REPORT_PRINT_ROOT_ID = "athlete-report-print-root";
export const ATHLETE_REPORT_PRINTING_CLASS = "printing-athlete-report";

function dates(start: string, end: string): string {
  const year = (date: string) => date.slice(0, 4);
  return `${shortWeek(start)}${year(start) !== year(end) ? ` ${year(start)}` : ""} – ${shortWeek(end)} ${year(end)}`;
}

const SCALE: Record<string, string> = { rpe: "RPE", cr10: "CR10", borg: "Borg", mixed_0_10: "effort /10" };
// Their average effort in the scale they rated in (reports sent before
// Borg and CR10 were counted carry an RPE average only).
const effortOf = (row: JsonRecord) => {
  if (num(row.average_effort) !== null) return `${SCALE[String(row.effort_scale)] ?? ""} ${row.average_effort}`.trim();
  return num(row.average_rpe) !== null ? `RPE ${row.average_rpe}` : "–";
};
// Their best in the form they did it: weight x reps, reps, minutes or metres.
const bestOf = (row: JsonRecord) => {
  const set = row.best_set as JsonRecord | null;
  if (set && num(set.load_kg) !== null) return `${set.load_kg} kg × ${set.reps}`;
  if (num(row.best_bodyweight_reps) !== null) return `${row.best_bodyweight_reps} reps`;
  if (num(row.minutes) !== null) return `${row.minutes} min`;
  if (num(row.distance_m) !== null) return `${Number(row.distance_m).toLocaleString()} m`;
  return "–";
};

export function AthleteReportBody({ report }: { report: JsonRecord }) {
  const period = (report.period ?? {}) as JsonRecord;
  const coach = (report.coach ?? {}) as JsonRecord;
  const sessions = (report.sessions ?? {}) as JsonRecord;
  const training = (report.training ?? {}) as JsonRecord;
  const wellbeing = (report.wellbeing ?? {}) as JsonRecord;
  const pain = (report.pain ?? {}) as JsonRecord;
  const weeks = rows(report.weeks);
  const exercises = rows(report.exercises);
  const message = String(coach.message ?? "").trim();

  return (
    <article className="report-body athlete-report" data-testid="athlete-report-body">
      <header className="report-head">
        <p className="eyebrow">{`${TYPE_TITLE[String(period.type)] ?? "Progress report"}${coach.name ? ` from ${String(coach.name)}` : ""}`}</p>
        <h3>{String(period.label ?? "")}</h3>
        {dates(String(period.start), String(period.end)) !== String(period.label) || period.complete === false
          ? <p className="muted small">{`${dates(String(period.start), String(period.end))}${period.complete === false ? " · so far" : ""}`}</p>
          : null}
      </header>
      {message ? (
        <section className="report-section athlete-report-message">
          <h4>From your coach</h4>
          <p>{message}</p>
        </section>
      ) : null}

      <div className="report-tiles">
        <div className="report-tile"><span className="report-tile-label">{num(sessions.planned) ? `Sessions (${sessions.planned} planned)` : "Sessions"}</span><strong>{`${show(sessions.completed)}${num(sessions.partial) ? ` + ${sessions.partial} part` : ""}`}</strong></div>
        <div className="report-tile"><span className="report-tile-label">Training time</span><strong>{show(sessions.minutes, " min")}</strong></div>
        <div className="report-tile"><span className="report-tile-label">Sets</span><strong>{show(training.sets)}</strong></div>
        <div className="report-tile"><span className="report-tile-label">Total lifted</span><strong>{show(training.tonnage_kg, " kg")}</strong></div>
        {num(training.other_sessions) ? <div className="report-tile"><span className="report-tile-label">Practice & matches</span><strong>{`${training.other_sessions} · ${show(training.other_minutes)} min`}</strong></div> : null}
        {num(training.timed_minutes) ? <div className="report-tile"><span className="report-tile-label">Timed work</span><strong>{show(training.timed_minutes, " min")}</strong></div> : null}
        {num(training.distance_m) ? <div className="report-tile"><span className="report-tile-label">Distance</span><strong>{show(training.distance_m, " m")}</strong></div> : null}
      </div>

      {weeks.length > 1 ? (
        <section className="report-section">
          <h4>Week by week</h4>
          <ul className="athlete-report-weeks">
            {weeks.map((week) => (
              <li key={String(week.week_start)}>
                <span>{shortWeek(String(week.week_start))}</span>
                <strong>{show(week.sessions)}</strong>{num(week.planned) ? <span>{`${week.planned} planned`}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="report-section">
        <h4>What you lifted</h4>
        {exercises.length ? (
          <div className="analysis-table-wrap">
            <table className="analysis-table">
              <thead><tr><th>Exercise</th><th>Sessions</th><th>Sets</th><th>Reps</th><th>Your best</th><th>Average effort</th></tr></thead>
              <tbody>
                {exercises.map((exercise) => (
                  <tr key={String(exercise.name)}>
                    <td>{String(exercise.name)}</td>
                    <td>{show(exercise.sessions)}</td>
                    <td>{show(exercise.sets)}</td>
                    <td>{show(exercise.reps)}</td>
                    <td>{bestOf(exercise)}</td>
                    <td>{effortOf(exercise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted small">No sets were logged in this period.</p>}
      </section>

      {rows(report.tests).length ? (
        <section className="report-section">
          <h4>Your tests</h4>
          <ul className="report-facts">
            {rows(report.tests).map((test) => {
              const latest = (test.latest ?? {}) as JsonRecord;
              const previous = test.previous as JsonRecord | null;
              return <li key={String(test.name)}>{`${String(test.name)}: ${String(latest.value)} ${String(test.unit)}${previous ? ` (last time ${String(previous.value)})` : ""}`}</li>;
            })}
          </ul>
        </section>
      ) : null}

      <section className="report-section">
        <h4>How you felt</h4>
        <ul className="report-facts">
          <li>{`Daily check-ins: ${show(wellbeing.check_ins)}`}</li>
          <li>{`Weekly check-in (out of 5): energy ${show(wellbeing.energy)}, motivation ${show(wellbeing.motivation)}, sleep ${show(wellbeing.sleep)}`}</li>
          {rows(pain.areas).length
            ? <li>{`Pain you reported: ${rows(pain.areas).map((area) => `${String(area.area).replaceAll("_", " ")} (${show(area.reports)})`).join(", ")}`}</li>
            : <li>No pain reported.</li>}
        </ul>
      </section>
    </article>
  );
}

function PrintableReport({ report, onBack }: { report: JsonRecord; onBack: () => void }) {
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    if (!printing) return;
    document.body.classList.add(ATHLETE_REPORT_PRINTING_CLASS);
    const done = () => { document.body.classList.remove(ATHLETE_REPORT_PRINTING_CLASS); setPrinting(false); };
    window.addEventListener("afterprint", done, { once: true });
    window.print();
    return () => {
      window.removeEventListener("afterprint", done);
      document.body.classList.remove(ATHLETE_REPORT_PRINTING_CLASS);
    };
  }, [printing]);
  return (
    <>
      <div className="report-actions">
        <button type="button" className="button secondary small-button" onClick={onBack}>‹ All reports</button>
        <button type="button" className="button secondary small-button" onClick={() => setPrinting(true)}>Print</button>
      </div>
      <AthleteReportBody report={report} />
      {printing ? createPortal(<div id={ATHLETE_REPORT_PRINT_ROOT_ID}><AthleteReportBody report={report} /></div>, document.body) : null}
    </>
  );
}

// History > Reports from your coach.
export function AthleteProgressReportsPanel() {
  const [reports, setReports] = useState<JsonRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      accountMayBeAthlete()
        .then((mayBeAthlete) => (mayBeAthlete ? request("GET", "/account/onboarding/progress-reports") : { reports: [] }))
        .then((result) => { if (!cancelled) { setReports(rows(result.reports)); setError(null); } })
        .catch(() => { if (!cancelled) setError("Your reports could not be loaded. Try again."); });
    };
    load();
    const events = [ENTRY_AUTH_SUCCEEDED_EVENT, "kolosseum:history-changed", "kolosseum:coach-athlete-message-received"];
    for (const name of events) document.addEventListener(name, load);
    return () => {
      cancelled = true;
      for (const name of events) document.removeEventListener(name, load);
    };
  }, []);

  // Nothing to show until a coach has sent one.
  if (!error && (!reports || !reports.length)) return null;
  const open = reports?.find((entry) => entry.report_id === openId) ?? null;

  return (
    <section className="panel report-list" data-testid="athlete-progress-reports">
      <h3>Reports from your coach</h3>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {open ? (
        <div className="report-view">
          <PrintableReport report={open.report as JsonRecord} onBack={() => setOpenId(null)} />
        </div>
      ) : (
        <ul className="report-periods">
          {(reports ?? []).map((entry) => {
            const report = (entry.report ?? {}) as JsonRecord;
            const period = (report.period ?? {}) as JsonRecord;
            return (
              <li key={String(entry.report_id)}>
                <button type="button" className="report-period" onClick={() => setOpenId(String(entry.report_id))}>
                  <strong>{`${TYPE_TITLE[String(period.type)] ?? "Progress report"}: ${String(period.label ?? "")}`}</strong>
                  <span className="muted small">{`Sent ${shortWeek(String(entry.sent_at).slice(0, 10))}${(report.coach as JsonRecord | undefined)?.name ? ` by ${String((report.coach as JsonRecord).name)}` : ""}`}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
