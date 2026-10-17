import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { request, type JsonRecord } from "../../api/transport";
import { TrendChart, shortWeek } from "../../components/TrendChart";

// The coach's progress reports for one athlete: one for every week, every
// programme block, every training-cycle phase, every programme and every
// year they've trained in - each that period summed up and set against the
// one before it, and printable. Compiled from what the athlete logged, so
// a new one is there as soon as a period ends; the current one shows so far.

type Finding = { id: string; section: string; level: "alert" | "watch" | "good" | "info"; text: string };
type Period = { type: string; id: string; label: string; start: string; end: string; complete: boolean; detail?: string; weeks?: number };

const TYPES: Array<{ type: string; label: string; title: string; empty: string }> = [
  { type: "week", label: "Weekly", title: "Weekly report", empty: "No training logged yet." },
  { type: "block", label: "Block", title: "Block report", empty: "No sessions from a programme's blocks logged yet." },
  { type: "cycle", label: "Cycle", title: "Cycle report", empty: "Cycles follow the athlete's training plan (their season or competition date) - they have none set." },
  { type: "programme", label: "Programme", title: "Programme report", empty: "No sessions from a programme logged yet." },
  { type: "year", label: "Yearly", title: "Yearly report", empty: "No training logged yet." }
];
const LEVEL_LABEL: Record<string, string> = { alert: "Needs a look", watch: "Keep an eye on", good: "Going well", info: "Note" };
export const REPORT_PRINT_ROOT_ID = "report-print-root";
export const REPORT_PRINTING_CLASS = "printing-report";

const rows = (value: unknown) => (Array.isArray(value) ? (value as JsonRecord[]) : []);
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const show = (value: unknown, suffix = "") => (num(value) === null ? "–" : `${Number(value).toLocaleString()}${suffix}`);
const year = (date: string) => date.slice(0, 4);
const dates = (period: Period) => `${shortWeek(period.start)}${year(period.start) !== year(period.end) ? ` ${year(period.start)}` : ""} – ${shortWeek(period.end)} ${year(period.end)}`;

// "+5% vs the last report" / "-1 vs the last report", coloured by whether up is good.
function Change({ value, suffix = "", upIsGood = true }: { value: unknown; suffix?: string; upIsGood?: boolean }) {
  const n = num(value);
  if (n === null) return null;
  const tone = n === 0 ? "" : (n > 0) === upIsGood ? " is-good" : " is-watch";
  return <span className={`report-change${tone}`}>{`${n > 0 ? "▲ +" : n < 0 ? "▼ " : "= "}${n === 0 ? "no change" : `${n}${suffix}`}`}</span>;
}

function Tile({ label, value, change }: { label: string; value: string; change?: React.ReactNode }) {
  return (
    <div className="report-tile">
      <span className="report-tile-label">{label}</span>
      <strong>{value}</strong>
      {change}
    </div>
  );
}

export function ReportBody({ report, typeTitle }: { report: JsonRecord; typeTitle: string }) {
  const period = report.period as Period;
  const summary = (report.summary ?? {}) as JsonRecord;
  const compared = (report.compared ?? null) as JsonRecord | null;
  const sessions = (summary.sessions ?? {}) as JsonRecord;
  const training = (summary.training ?? {}) as JsonRecord;
  const execution = (summary.execution ?? {}) as JsonRecord;
  const wellbeing = (summary.wellbeing ?? {}) as JsonRecord;
  const pain = (summary.pain ?? {}) as JsonRecord;
  const strength = rows(summary.strength);
  const findings = rows(report.findings) as unknown as Finding[];
  const analysis = (report.analysis ?? {}) as JsonRecord;
  const weeks = (analysis.weeks ?? []) as string[];
  const loadRows = rows((analysis.load as JsonRecord | undefined)?.rows);
  const volumeRows = rows((analysis.volume as JsonRecord | undefined)?.rows);
  const adherenceRows = rows((analysis.adherence as JsonRecord | undefined)?.rows);
  const previous = report.previous as JsonRecord | null;
  const peak = training.peak_acute_chronic as JsonRecord | null;
  const liftChange = new Map(rows(compared?.strength).map((lift) => [String(lift.exercise_id), lift.change_pct]));
  const athlete = String((report.athlete as JsonRecord | undefined)?.display_name ?? "");

  return (
    <article className="report-body" data-testid="report-body">
      <header className="report-head">
        <p className="eyebrow">{`${typeTitle}${athlete ? ` · ${athlete}` : ""}`}</p>
        <h3>{period.label}</h3>
        <p className="muted small">
          {`${dates(period)} · ${period.weeks ?? 1} week${(period.weeks ?? 1) === 1 ? "" : "s"}`}
          {period.complete ? "" : " · still going - this report shows it so far"}
          {previous ? ` · compared with ${String(previous.label)}` : " · the first of its kind, nothing to compare with"}
        </p>
      </header>

      <section className="report-section">
        <h4>What stands out</h4>
        {findings.length ? (
          <ul className="analysis-findings">
            {findings.map((finding) => (
              <li key={finding.id} className={`analysis-finding is-${finding.level}`}>
                <span className="analysis-finding-level">{LEVEL_LABEL[finding.level]}</span>
                <span>{finding.text}</span>
              </li>
            ))}
          </ul>
        ) : <p className="muted small">Nothing stood out.</p>}
      </section>

      <div className="report-tiles" data-testid="report-tiles">
        <Tile label="Sessions" value={`${show(sessions.completed)}${num(sessions.partial) ? ` + ${sessions.partial} part` : ""}${num(sessions.planned) ? ` of ${sessions.planned}` : ""}`} change={<Change value={compared?.sessions_completed} />} />
        <Tile label="Turned up" value={show(sessions.adherence_pct, "%")} change={<Change value={compared?.adherence_pct} suffix=" pts" />} />
        <Tile label="Sets" value={show(training.sets)} change={<Change value={compared?.sets_pct} suffix="%" />} />
        <Tile label="Tonnage" value={show(training.tonnage_kg, " kg")} change={<Change value={compared?.tonnage_pct} suffix="%" />} />
        <Tile label="Weekly load (avg)" value={show(training.load_weekly_average, " AU")} change={<Change value={compared?.load_weekly_average_pct} suffix="%" upIsGood={false} />} />
        <Tile label="Reps hit" value={show(execution.reps_hit_pct, "%")} change={<Change value={compared?.reps_hit_pct} suffix=" pts" />} />
        <Tile label="Readiness (avg of 15)" value={show(wellbeing.readiness_average)} change={<Change value={compared?.readiness_average} />} />
        <Tile label="Pain reports" value={show(pain.reports)} change={<Change value={compared?.pain_reports} upIsGood={false} />} />
      </div>

      <section className="report-section" data-testid="report-strength">
        <h4>Strength</h4>
        {strength.length ? (
          <div className="analysis-table-wrap">
            <table className="analysis-table">
              <thead><tr><th>Lift</th><th>Start</th><th>End</th><th>Best</th><th>Change</th><th>vs last report</th></tr></thead>
              <tbody>
                {strength.map((lift) => (
                  <tr key={String(lift.exercise_id)}>
                    <td>{`${String(lift.name)}${lift.main === false ? "" : " ★"}`}</td>
                    <td>{show(lift.start, " kg")}</td>
                    <td>{show(lift.end, " kg")}</td>
                    <td>{`${show(lift.best, " kg")}${lift.best_from ? ` (${String(lift.best_from)})` : ""}`}</td>
                    <td>{num(lift.change_pct) === null ? "–" : `${Number(lift.change_pct) > 0 ? "+" : ""}${lift.change_pct}%`}</td>
                    <td>{num(liftChange.get(String(lift.exercise_id))) === null ? "–" : `${Number(liftChange.get(String(lift.exercise_id))) > 0 ? "+" : ""}${liftChange.get(String(lift.exercise_id))}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted small">No lift was logged often enough with a weight to estimate a max.</p>}
        <p className="muted small">Estimated max from the best set each week (RTS RPE chart where the athlete rated it, else Epley). ★ main lift.</p>
      </section>

      {weeks.length > 1 ? (
        <section className="report-section">
          <h4>Week by week</h4>
          <TrendChart title="Weekly training load (AU) and sets" weeks={weeks} series={[{ id: "load", label: "Load (AU)", kind: "bar", values: loadRows.map((row) => num(row.load)) }]} emptyLabel="No rated sessions in this period." height={140} />
          <div className="analysis-table-wrap">
            <table className="analysis-table">
              <thead><tr><th>Week of</th><th>Sessions</th><th>Turned up</th><th>Sets</th><th>Tonnage</th><th>Load</th><th>Load ratio</th><th>Monotony</th></tr></thead>
              <tbody>
                {weeks.map((week, index) => (
                  <tr key={week}>
                    <td>{shortWeek(week)}</td>
                    <td>{show(adherenceRows[index]?.completed)}</td>
                    <td>{show(adherenceRows[index]?.adherence_pct, "%")}</td>
                    <td>{show(volumeRows[index]?.sets)}</td>
                    <td>{show(volumeRows[index]?.tonnage_kg)}</td>
                    <td>{show(loadRows[index]?.load)}</td>
                    <td>{show(loadRows[index]?.acute_chronic)}</td>
                    <td>{show(loadRows[index]?.monotony)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="report-columns">
        <section className="report-section">
          <h4>Doing the plan</h4>
          <ul className="report-facts">
            <li>{`Sets logged: ${show(execution.sets_logged_pct, "%")} of those planned, in the sessions done`}</li>
            <li>{`Reps hit: ${show(execution.reps_hit_pct, "%")} of logged sets reached the target`}</li>
            <li>{`Training time: ${show(sessions.minutes, " min")}, average effort ${show(sessions.average_effort, "/10")}`}</li>
            {peak ? <li>{`Highest load ratio: ${show(peak.value)} (week of ${shortWeek(String(peak.week_start))})`}</li> : null}
            {rows(execution.effort_creep).filter((entry) => Math.abs(Number(entry.rpe_change)) >= 0.5).map((entry) => <li key={`creep-${String(entry.exercise_id)}`}>{`${String(entry.name)} at ${show(entry.load_kg, " kg")}: RPE ${show(entry.early_rpe)} → ${show(entry.late_rpe)}`}</li>)}
            {rows(execution.most_missed).slice(0, 3).map((entry) => <li key={`missed-${String(entry.exercise_id)}`}>{`Most missed: ${String(entry.name)} (${show(entry.missed_pct, "%")} of sets)`}</li>)}
            {rows(execution.most_skipped).slice(0, 3).map((entry) => <li key={`skipped-${String(entry.exercise_id)}`}>{`Skipped: ${String(entry.name)} ×${show(entry.skips)}`}</li>)}
          </ul>
        </section>
        <section className="report-section">
          <h4>Readiness and wellbeing</h4>
          <ul className="report-facts">
            <li>{`Daily check-ins: ${show(wellbeing.check_ins)}, average ${show(wellbeing.readiness_average)} of 15`}</li>
            <li>{`Weeks well below their normal: ${show(wellbeing.low_weeks)}`}</li>
            <li>{`Weekly check-in (of 5): energy ${show(wellbeing.energy)}, motivation ${show(wellbeing.motivation)}, sleep ${show(wellbeing.sleep)}`}</li>
          </ul>
          <h4>Pain</h4>
          {rows(pain.areas).length ? (
            <ul className="report-facts">
              {rows(pain.areas).map((area) => <li key={String(area.area)}>{`${String(area.area).replaceAll("_", " ")}: ${show(area.reports)} report${Number(area.reports) === 1 ? "" : "s"} in ${show(area.weeks)} week${Number(area.weeks) === 1 ? "" : "s"}${rows(area.exercises as unknown).length ? "" : ""}`}</li>)}
            </ul>
          ) : <p className="muted small">No pain reported.</p>}
          <p className="muted small">Pain reports are the athlete's own and are not a diagnosis.</p>
        </section>
      </div>
      <p className="muted small report-method">Load is session effort (0-10) × minutes (Foster). Load ratio is a week's load against the 4 weeks before it (context only - disputed as an injury predictor). Readiness compares each check-in with the athlete's own previous 28 days.</p>
    </article>
  );
}

function ReportView({ athleteUserId, type, id, onBack }: { athleteUserId: string; type: string; id: string; onBack: () => void }) {
  const [report, setReport] = useState<JsonRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const typeTitle = TYPES.find((entry) => entry.type === type)?.title ?? "Report";

  useEffect(() => {
    let cancelled = false;
    setReport(null);
    setError(null);
    request("GET", `/coach-workspace/athletes/${encodeURIComponent(athleteUserId)}/reports/${encodeURIComponent(type)}/${encodeURIComponent(id)}`)
      .then((result) => { if (!cancelled) setReport(result); })
      .catch(() => { if (!cancelled) setError("This report could not be loaded. Try again."); });
    return () => { cancelled = true; };
  }, [athleteUserId, type, id]);

  useEffect(() => {
    if (!printing) return;
    document.body.classList.add(REPORT_PRINTING_CLASS);
    const done = () => { document.body.classList.remove(REPORT_PRINTING_CLASS); setPrinting(false); };
    window.addEventListener("afterprint", done, { once: true });
    window.print();
    return () => {
      window.removeEventListener("afterprint", done);
      document.body.classList.remove(REPORT_PRINTING_CLASS);
    };
  }, [printing]);

  return (
    <div className="report-view" data-testid="report-view">
      <div className="report-actions">
        <button type="button" className="button secondary small-button" onClick={onBack}>‹ All reports</button>
        {report ? <button type="button" className="button secondary small-button" onClick={() => setPrinting(true)}>Print</button> : null}
      </div>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {!report && !error ? <p className="muted">Compiling the report…</p> : null}
      {report ? <section className="panel"><ReportBody report={report} typeTitle={typeTitle} /></section> : null}
      {report && printing ? createPortal(<div id={REPORT_PRINT_ROOT_ID}><ReportBody report={report} typeTitle={typeTitle} /></div>, document.body) : null}
    </div>
  );
}

export function CoachReports({ athleteUserId }: { athleteUserId: string }) {
  const [type, setType] = useState("week");
  const [list, setList] = useState<JsonRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<{ type: string; id: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    request("GET", `/coach-workspace/athletes/${encodeURIComponent(athleteUserId)}/reports`)
      .then((result) => { if (!cancelled) setList(result); })
      .catch(() => { if (!cancelled) setError("Reports could not be loaded. Check your connection and try again."); });
    return () => { cancelled = true; };
  }, [athleteUserId]);

  if (open) return <ReportView athleteUserId={athleteUserId} type={open.type} id={open.id} onBack={() => setOpen(null)} />;
  const reports = (list?.reports ?? {}) as Record<string, Period[]>;
  const current = TYPES.find((entry) => entry.type === type)!;
  const periods = reports[type] ?? [];

  return (
    <section className="panel report-list" data-testid="report-list">
      <h3>Progress reports</h3>
      <p className="muted small">A report is compiled for every week, programme block, training cycle, programme and year - each compared with the one before it.</p>
      <div className="analysis-weeks" role="group" aria-label="Report type">
        {TYPES.map((entry) => (
          <button key={entry.type} type="button" className={`button secondary small-button${entry.type === type ? " is-selected" : ""}`} aria-pressed={entry.type === type} onClick={() => setType(entry.type)}>
            {`${entry.label}${list ? ` (${(reports[entry.type] ?? []).length})` : ""}`}
          </button>
        ))}
      </div>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {!list && !error ? <p className="muted">Loading reports…</p> : null}
      {list && !periods.length ? <p className="muted small">{current.empty}</p> : null}
      {periods.length ? (
        <ul className="report-periods">
          {periods.map((period) => (
            <li key={period.id}>
              <button type="button" className="report-period" onClick={() => setOpen({ type: period.type, id: period.id })}>
                <strong>{period.label}</strong>
                <span className="muted small">{`${dates(period)}${period.detail ? ` · ${period.detail}` : ""}`}</span>
                <span className={`analysis-status is-${period.complete ? "good" : "watch"}`}>{period.complete ? "Complete" : "So far"}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
