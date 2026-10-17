import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { loadAccountDetail } from "../../api/client";
import { request, type JsonRecord } from "../../api/transport";
import { AthleteReportBody } from "../athlete/AthleteProgressReports";
import { Explain } from "./analysisGuide";
import { FindingList, type Finding } from "./FindingList";
import { TrendChart, shortWeek, type TrendMarker } from "../../components/TrendChart";

// The coach's progress reports for one athlete: one for every week, every
// programme block, every training-cycle phase, every programme and every
// year they've trained in - each that period summed up and set against the
// one before it, and printable. Compiled from what the athlete logged, so
// a new one is there as soon as a period ends; the current one shows so far.

type Period = { type: string; id: string; label: string; start: string; end: string; complete: boolean; detail?: string; weeks?: number; from?: string; to?: string };

const TYPES: Array<{ type: string; label: string; title: string; empty: string }> = [
  { type: "week", label: "Weekly", title: "Weekly report", empty: "No training logged yet." },
  { type: "block", label: "Block", title: "Block report", empty: "No sessions from a programme's blocks logged yet." },
  { type: "cycle", label: "Cycle", title: "Cycle report", empty: "Cycles follow the athlete's training plan (their season or competition date) - they have none set." },
  { type: "programme", label: "Programme", title: "Programme report", empty: "No sessions from a programme logged yet." },
  { type: "year", label: "Yearly", title: "Yearly report", empty: "No training logged yet." },
  { type: "custom", label: "Custom dates", title: "Custom report", empty: "" }
];
export const REPORT_PRINT_ROOT_ID = "report-print-root";
export const REPORT_PRINTING_CLASS = "printing-report";

const SCALE: Record<string, string> = { rpe: "RPE", cr10: "CR10", borg: "Borg", mixed_0_10: "effort /10" };
// The best of an exercise in the form it was done: weight x reps, bodyweight reps, minutes or metres.
export const bestOf = (row: JsonRecord, times = "x") => {
  const top = row.top_set ?? row.best_set;
  if (top && typeof top === "object" && typeof (top as JsonRecord).load_kg === "number") return `${(top as JsonRecord).load_kg} kg ${times} ${(top as JsonRecord).reps}`;
  if (typeof row.best_bodyweight_reps === "number") return `${row.best_bodyweight_reps} reps (bodyweight)`;
  if (typeof row.minutes === "number") return `${row.minutes} min`;
  if (typeof row.distance_m === "number") return `${Number(row.distance_m).toLocaleString()} m`;
  return "–";
};
const rows = (value: unknown) => (Array.isArray(value) ? (value as JsonRecord[]) : []);
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const show = (value: unknown, suffix = "") => (num(value) === null ? "–" : `${Number(value).toLocaleString()}${suffix}`);
const year = (date: string) => date.slice(0, 4);
// A custom report shows its exact dates; the others their whole weeks.
const dates = (period: Period) => {
  const start = period.from ?? period.start;
  const end = period.to ?? period.end;
  return `${shortWeek(start)}${year(start) !== year(end) ? ` ${year(start)}` : ""} – ${shortWeek(end)} ${year(end)}`;
};

// "+5% vs the last report" / "-1 vs the last report", coloured by whether up is good.
function Change({ value, suffix = "", upIsGood = true }: { value: unknown; suffix?: string; upIsGood?: boolean }) {
  const n = num(value);
  if (n === null) return null;
  const tone = n === 0 ? "" : (n > 0) === upIsGood ? " is-good" : " is-watch";
  return <span className={`report-change${tone}`}>{`${n > 0 ? "▲ +" : n < 0 ? "▼ " : "= "}${n === 0 ? "no change" : `${n}${suffix}`}`}</span>;
}

// A headline number, what usual looks like, and the change since the last report.
function Tile({ label, value, change, usual }: { label: string; value: string; change?: React.ReactNode; usual?: string | null }) {
  return (
    <div className="report-tile">
      <span className="report-tile-label">{label}</span>
      <strong>{value}</strong>
      {usual ? <span className="report-tile-usual">{usual}</span> : null}
      {change}
    </div>
  );
}

export function ReportBody({ report, typeTitle, printing = false }: { report: JsonRecord; typeTitle: string; printing?: boolean }) {
  const period = report.period as Period;
  const summary = (report.summary ?? {}) as JsonRecord;
  const compared = (report.compared ?? null) as JsonRecord | null;
  const sessions = (summary.sessions ?? {}) as JsonRecord;
  const training = (summary.training ?? {}) as JsonRecord;
  const execution = (summary.execution ?? {}) as JsonRecord;
  const wellbeing = (summary.wellbeing ?? {}) as JsonRecord;
  const pain = (summary.pain ?? {}) as JsonRecord;
  const strength = rows(summary.strength);
  const exercises = rows(summary.exercises);
  const bodyweightStrength = rows(summary.bodyweight_strength);
  const intensity = (summary.intensity ?? null) as JsonRecord | null;
  const sessionLog = rows(summary.session_log);
  const findings = rows(report.findings) as unknown as Finding[];
  const baseline = (summary.baseline ?? null) as JsonRecord | null;
  const usualReadiness = (baseline?.readiness ?? null) as JsonRecord | null;
  const readinessUsual = usualReadiness ? (usualReadiness.low === usualReadiness.high ? String(usualReadiness.average) : `${usualReadiness.low}-${usualReadiness.high}`) : null;
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
          {`${dates(period) === period.label ? "" : `${dates(period)} · `}${period.type === "custom" ? period.detail ?? "" : `${period.weeks ?? 1} week${(period.weeks ?? 1) === 1 ? "" : "s"}`}`}
          {period.complete ? "" : " · still going - this report shows it so far"}
          {previous ? ` · compared with ${String(previous.label)}` : " · the first of its kind, nothing to compare with"}
        </p>
      </header>

      <section className="report-section">
        <h4>What stands out</h4>
        <FindingList findings={findings} showAll={printing} emptyText="Nothing stood out." />
      </section>

      <Explain id="summary" />
      <div className="report-tiles" data-testid="report-tiles">
        <Tile label={num(sessions.planned) ? `Sessions (${sessions.planned} planned)` : "Sessions"} value={`${show(sessions.completed)}${num(sessions.partial) ? ` + ${sessions.partial} part` : ""}`} change={<Change value={compared?.sessions_completed} />} />
        <Tile label="Turned up" value={show(sessions.adherence_pct, "%")} usual="On track: 90%+" change={<Change value={compared?.adherence_pct} suffix=" pts" />} />
        <Tile label="Sets" value={show(training.sets)} change={<Change value={compared?.sets_pct} suffix="%" />} />
        <Tile label="Tonnage" value={show(training.tonnage_kg, " kg")} change={<Change value={compared?.tonnage_pct} suffix="%" />} />
        <Tile label="Weekly load (avg)" value={show(training.load_weekly_average, " points")} usual={num(baseline?.weekly_load) ? `Their usual before this: ${Number(baseline!.weekly_load).toLocaleString()}` : null} change={<Change value={compared?.load_weekly_average_pct} suffix="%" upIsGood={false} />} />
        <Tile label="Reps hit" value={show(execution.reps_hit_pct, "%")} usual="Normal: 90%+" change={<Change value={compared?.reps_hit_pct} suffix=" pts" />} />
        <Tile label="Readiness (out of 15)" value={show(wellbeing.readiness_average)} usual={readinessUsual ? `Their usual: ${readinessUsual}` : null} change={<Change value={compared?.readiness_average} />} />
        {num(training.other_sessions) ? <Tile label="Practice & matches" value={`${training.other_sessions} · ${show(training.other_minutes)} min`} usual={num(training.matches) ? `${training.matches} match${Number(training.matches) === 1 ? "" : "es"}` : null} /> : null}
        {num(training.timed_minutes) ? <Tile label="Timed work" value={show(training.timed_minutes, " min")} /> : null}
        {num(training.distance_m) ? <Tile label="Distance" value={show(training.distance_m, " m")} /> : null}
        {num(training.bodyweight_reps) ? <Tile label="Bodyweight reps" value={show(training.bodyweight_reps)} /> : null}
        <Tile label="Pain reports" value={show(pain.reports)} change={<Change value={compared?.pain_reports} upIsGood={false} />} />
      </div>
      <Explain id="report_overview" />

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
        {bodyweightStrength.length ? (
          <ul className="report-facts" data-testid="report-bodyweight-strength">
            {bodyweightStrength.map((lift) => <li key={String(lift.exercise_id)}>{`${String(lift.name)} (bodyweight): best set ${lift.first} → ${lift.latest} reps, best ${lift.best}`}</li>)}
          </ul>
        ) : null}
        <Explain id="report_strength" />
      </section>

      {weeks.length > 1 ? (
        <section className="report-section">
          <h4>Week by week</h4>
          <Explain id="report_weeks" />
          <TrendChart markers={rows(analysis.markers) as unknown as TrendMarker[]} title="Weekly training load (load points): gym and sport" weeks={weeks} series={[{ id: "gym", label: "Gym", kind: "bar", values: loadRows.map((row) => num(row.gym_load)) }, { id: "sport", label: "Practice, matches, conditioning", kind: "bar", values: loadRows.map((row) => num(row.sport_load)) }]} emptyLabel="No rated sessions in this period." height={140} />
          <div className="analysis-table-wrap">
            <table className="analysis-table">
              <thead><tr><th>Week of</th><th>Sessions</th><th>Turned up</th><th>Sets</th><th>Tonnage</th><th>Load (points)</th><th>Sport</th><th>vs usual</th><th>Monotony</th></tr></thead>
              <tbody>
                {weeks.map((week, index) => (
                  <tr key={week}>
                    <td>{shortWeek(week)}</td>
                    <td>{show(adherenceRows[index]?.completed)}</td>
                    <td>{show(adherenceRows[index]?.adherence_pct, "%")}</td>
                    <td>{show(volumeRows[index]?.sets)}</td>
                    <td>{show(volumeRows[index]?.tonnage_kg)}</td>
                    <td>{show(loadRows[index]?.load)}</td>
                    <td>{num(loadRows[index]?.sport_load) ? show(loadRows[index]?.sport_load) : "–"}</td>
                    <td>{show(loadRows[index]?.acute_chronic)}</td>
                    <td>{show(loadRows[index]?.monotony)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {intensity && num(intensity.sets) ? (
        <section className="report-section" data-testid="report-intensity">
          <h4>Intensity (% of max)</h4>
          <Explain id="intensity" />
          <ul className="analysis-weekdays report-bands">
            {rows(intensity.zones).map((zone) => <li key={String(zone.zone)} className="analysis-weekday"><span className="analysis-weekday-bar" style={{ height: `${Math.max(4, Number(zone.pct ?? 0))}%` }} /><strong>{show(zone.pct, "%")}</strong><span>{String(zone.zone)}</span></li>)}
          </ul>
          <ul className="report-facts">{rows(intensity.by_exercise).map((row) => <li key={String(row.exercise_id)}>{`${String(row.name)}: ${row.sets} sets, ${row.average_pct}% of max on average, heaviest ${row.top_pct}%`}</li>)}</ul>
        </section>
      ) : null}

      {rows(summary.testing).length ? (
        <section className="report-section" data-testid="report-testing">
          <h4>Testing</h4>
          <Explain id="testing" />
          <ul className="report-facts">
            {rows(summary.testing).map((test) => {
              const latest = test.latest as JsonRecord;
              const previous = test.previous as JsonRecord | null;
              const verdict = test.verdict === "improved" ? "real improvement" : test.verdict === "declined" ? "real decline" : test.verdict === "within_noise" ? "within normal variation" : "first result";
              return <li key={String(test.test_id)}>{`${String(test.name)}: ${latest.value} ${String(test.unit)} (${shortWeek(String(latest.date))})${previous ? `, from ${previous.value}` : ""} - ${verdict}`}</li>;
            })}
          </ul>
        </section>
      ) : null}

      <section className="report-section" data-testid="report-exercises">
        <h4>Every exercise</h4>
        <Explain id="report_exercises" />
        {exercises.length ? (
          <div className="analysis-table-wrap">
            <table className="analysis-table">
              <thead><tr><th>Exercise</th><th>Sessions</th><th>Sets</th><th>Reps</th><th>Tonnage</th><th>Best</th><th>% of max</th><th>Avg effort</th></tr></thead>
              <tbody>
                {exercises.map((row) => (
                  <tr key={String(row.exercise_id)}>
                    <td>{String(row.name)}</td>
                    <td>{show(row.sessions)}</td>
                    <td>{show(row.sets)}</td>
                    <td>{show(row.reps)}</td>
                    <td>{num(row.tonnage_kg) ? show(row.tonnage_kg, " kg") : "–"}</td>
                    <td>{bestOf(row)}</td>
                    <td>{show(row.intensity_pct, "%")}</td>
                    <td>{num(row.average_effort) === null ? "–" : `${SCALE[String(row.effort_scale)] ?? ""} ${row.average_effort}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted small">No sets logged.</p>}
      </section>

      <div className="report-columns">
        <section className="report-section" data-testid="report-effort">
          <h4>How hard it felt</h4>
          <Explain id="report_effort" />
          {num(summary.effort_rated) ? (
            <ul className="analysis-weekdays report-bands">
              {rows(summary.effort_bands).map((band) => (
                <li key={String(band.band)} className="analysis-weekday">
                  <span className="analysis-weekday-bar" style={{ height: `${Math.max(4, Number(band.pct ?? 0))}%` }} />
                  <strong>{show(band.pct, "%")}</strong>
                  <span>{`RPE ${String(band.band)}`}</span>
                </li>
              ))}
            </ul>
          ) : <p className="muted small">No exercises rated.</p>}
          <p className="muted small">{`Share of ${show(summary.effort_rated)} exercise ratings (the athlete's hardest set) on a 0-10 scale${summary.effort_rated_by ? ` - RPE ${show((summary.effort_rated_by as JsonRecord).rpe)}, CR10 ${show((summary.effort_rated_by as JsonRecord).cr10)}, Borg ${show((summary.effort_rated_by as JsonRecord).borg)} (Borg 6-20 converted)` : ""}.`}</p>
        </section>
        <section className="report-section" data-testid="report-patterns">
          <h4>Sets by movement</h4>
          <Explain id="report_patterns" />
          {rows(summary.patterns).length ? (
            <ul className="report-facts">
              {rows(summary.patterns).map((row) => <li key={String(row.pattern)}>{`${String(row.pattern).replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase())}: ${show(row.sets)} sets`}</li>)}
            </ul>
          ) : <p className="muted small">No sets logged.</p>}
          <h4>Bodyweight</h4>
          <Explain id="report_bodyweight" />
          {rows(summary.bodyweight).length ? (
            <ul className="report-facts">
              {rows(summary.bodyweight).map((entry, index) => <li key={index}>{`${show(entry.value)} ${String(entry.unit ?? "kg")}${entry.date ? ` (${shortWeek(String(entry.date))} ${String(entry.date).slice(0, 4)})` : ""}`}</li>)}
            </ul>
          ) : <p className="muted small">No bodyweight recorded in this period.</p>}
        </section>
      </div>

      <details className="analysis-numbers" open={printing || sessionLog.length <= 12} data-testid="report-sessions">
        <summary>{`Every session (${sessionLog.length})`}</summary>
        <Explain id="report_sessions" />
        {sessionLog.length ? (
          <div className="analysis-table-wrap">
            <table className="analysis-table">
              <thead><tr><th>Date</th><th>Session</th><th>Status</th><th>Sets</th><th>Minutes</th><th>Effort</th><th>Load</th><th>Notes</th></tr></thead>
              <tbody>
                {sessionLog.map((row) => (
                  <tr key={String(row.session_id)}>
                    <td>{`${shortWeek(String(row.date))}`}</td>
                    <td>{String(row.title ?? "Session")}</td>
                    <td>{row.kind && row.kind !== "gym" ? "Logged" : row.status === "partial" ? "Part done" : "Done"}</td>
                    <td>{show(row.sets)}</td>
                    <td>{show(row.minutes)}</td>
                    <td>{show(row.effort)}</td>
                    <td>{`${show(row.load)}${row.kind === "gym" && row.measured === false && num(row.load) !== null ? " (est.)" : ""}`}</td>
                    <td>{[row.pain ? "Pain reported" : "", num(row.skipped) ? `${row.skipped} skipped` : ""].filter(Boolean).join(", ") || "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted small">No sessions in this period.</p>}
      </details>

      <div className="report-columns">
        <section className="report-section">
          <h4>Doing the plan</h4>
          <Explain id="report_plan" />
          <ul className="report-facts">
            <li>{`Sets logged: ${show(execution.sets_logged_pct, "%")} of those planned, in the sessions done`}</li>
            {summary.plan && num((summary.plan as JsonRecord).planned_tonnage_kg) ? <li data-testid="report-plan-line">{`Planned vs done: ${show((summary.plan as JsonRecord).done_sessions)} of ${show((summary.plan as JsonRecord).planned_sessions)} sessions, ${show((summary.plan as JsonRecord).done_sets)} of ${show((summary.plan as JsonRecord).planned_sets)} sets, ${show((summary.plan as JsonRecord).tonnage_pct, "%")} of the planned tonnage`}</li> : null}
            <li>{`Reps hit: ${show(execution.reps_hit_pct, "%")} of logged sets reached the target`}</li>
            <li>{`Training time: ${show(sessions.minutes, " min")}, average effort ${show(sessions.average_effort, "/10")}`}</li>
            {peak ? <li>{`Highest load vs usual: ${show(peak.value)}× (week of ${shortWeek(String(peak.week_start))}; 0.8-1.3× is normal)`}</li> : null}
            {num(execution.load_vs_plan_pct) !== null ? <li>{`Weight against the plan: ${Number(execution.load_vs_plan_pct) > 0 ? "+" : ""}${execution.load_vs_plan_pct}% (inside a prescribed range counts as on plan)`}</li> : null}
            {rows(execution.effort_targets).map((t) => <li key={`target-${String(t.exercise_id)}-${String(t.scale)}-${String(t.target)}`}>{`${String(t.name)}: ${SCALE[String(t.scale)]} ${t.target}${t.target_max ? `-${t.target_max}` : ""} set, rated ${t.rated_average} on average (${Number(t.diff) === 0 ? "on target" : `${Number(t.diff) > 0 ? "+" : ""}${t.diff}`})`}</li>)}
            {rows(execution.effort_creep).filter((entry) => Math.abs(Number(entry.effort_change)) >= 0.5).map((entry) => <li key={`creep-${String(entry.exercise_id)}-${String(entry.scale)}`}>{`${String(entry.name)} at ${show(entry.load_kg, " kg")}: ${String(entry.scale_label)} ${show(entry.early)} → ${show(entry.late)}`}</li>)}
            {rows(execution.most_missed).slice(0, 3).map((entry) => <li key={`missed-${String(entry.exercise_id)}`}>{`Most missed: ${String(entry.name)} (${show(entry.missed_pct, "%")} of sets)`}</li>)}
            {rows(execution.most_skipped).slice(0, 3).map((entry) => <li key={`skipped-${String(entry.exercise_id)}`}>{`Skipped: ${String(entry.name)} ×${show(entry.skips)}`}</li>)}
          </ul>
        </section>
        <section className="report-section">
          <h4>Readiness and wellbeing</h4>
          <Explain id="report_wellbeing" />
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
      <p className="muted small report-method">Load is session effort (0-10) × minutes, in load points (Foster's session-RPE). Load vs usual is a week's load against the 4 weeks before it (context only - disputed as an injury predictor). Readiness compares each check-in with the athlete's own previous 28 days.</p>
    </article>
  );
}

function ReportView({ athleteUserId, type, id, onBack }: { athleteUserId: string; type: string; id: string; onBack: () => void }) {
  const [report, setReport] = useState<JsonRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [sending, setSending] = useState(false);
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
        {report ? <button type="button" className="button small-button" aria-expanded={sending} onClick={() => setSending((open) => !open)}>Send to athlete</button> : null}
      </div>
      {report && sending ? <SendToAthlete athleteUserId={athleteUserId} type={type} id={id} athleteName={String((report.athlete as JsonRecord | undefined)?.display_name ?? "the athlete")} onClose={() => setSending(false)} /> : null}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {!report && !error ? <p className="muted">Compiling the report…</p> : null}
      {report ? <section className="panel"><ReportBody report={report} typeTitle={typeTitle} /></section> : null}
      {report && printing ? createPortal(<div id={REPORT_PRINT_ROOT_ID}><ReportBody report={report} typeTitle={typeTitle} printing /></div>, document.body) : null}
    </div>
  );
}

const newRequestId = () => `rpt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

// The athlete's copy, previewed, with a message from the coach - then sent.
function SendToAthlete({ athleteUserId, type, id, athleteName, onClose }: { athleteUserId: string; type: string; id: string; athleteName: string; onClose: () => void }) {
  const [preview, setPreview] = useState<JsonRecord | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [requestId] = useState(newRequestId);
  const base = `/coach-workspace/athletes/${encodeURIComponent(athleteUserId)}/reports/${encodeURIComponent(type)}/${encodeURIComponent(id)}`;

  useEffect(() => {
    let cancelled = false;
    request("GET", `${base}/athlete-copy`)
      .then((result) => { if (!cancelled) setPreview(result.report as JsonRecord); })
      .catch(() => { if (!cancelled) setStatus({ ok: false, text: "The athlete's copy could not be loaded. Try again." }); });
    return () => { cancelled = true; };
  }, [base]);

  async function send() {
    setBusy(true);
    setStatus(null);
    try {
      const account = await loadAccountDetail();
      const csrf = typeof account.csrf_token === "string" ? account.csrf_token : "";
      await request("POST", `${base}/send`, { message, client_request_id: requestId }, csrf);
      setStatus({ ok: true, text: `Sent to ${athleteName}. They'll find it in History, and a message tells them it's there.` });
    }
    catch {
      setStatus({ ok: false, text: "The report could not be sent. Check your connection and try again." });
    }
    finally {
      setBusy(false);
    }
  }

  const sent = status?.ok === true;
  return (
    <section className="panel report-send" data-testid="report-send">
      <h3>{`Send to ${athleteName}`}</h3>
      <p className="muted small">They get the sessions they did, the best set they lifted on each exercise, their volume and how they felt - no estimated maxes, load ratios or your flags.</p>
      <Explain id="report_send" />
      <label className="field">
        <span>Your message (optional)</span>
        <textarea rows={4} maxLength={2000} value={message} disabled={busy || sent} onChange={(event) => setMessage(event.target.value)} placeholder="What went well, and what's next." />
      </label>
      <div className="report-actions">
        <button type="button" className="button small-button" disabled={busy || sent || !preview} onClick={() => void send()}>{busy ? "Sending…" : sent ? "Sent" : "Send report"}</button>
        <button type="button" className="button secondary small-button" onClick={onClose}>{sent ? "Close" : "Cancel"}</button>
      </div>
      {status ? <p className={status.ok ? "dashboard-status" : "field-error"} role={status.ok ? "status" : "alert"}>{status.text}</p> : null}
      {preview ? (
        <details className="analysis-numbers">
          <summary>What they'll see</summary>
          <AthleteReportBody report={{ ...preview, coach: { ...(preview.coach as JsonRecord), message } }} />
        </details>
      ) : null}
    </section>
  );
}

// A report from a set date to another.
function CustomDates({ today, onCompile }: { today: string; onCompile: (id: string) => void }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(today);
  const valid = Boolean(from) && from <= (to || today);
  return (
    <form className="report-custom" onSubmit={(event) => { event.preventDefault(); if (valid) onCompile(`${from}_${to || today}`); }}>
      <label className="field"><span>From</span><input type="date" value={from} max={today} onChange={(event) => setFrom(event.target.value)} required /></label>
      <label className="field"><span>To</span><input type="date" value={to} max={today} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label>
      <button type="submit" className="button small-button" disabled={!valid}>Compile report</button>
      <p className="muted small">Any dates up to 2 years apart. Only sessions between them count, and it's compared with the same number of days just before.</p>
    </form>
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
      <p className="muted small">A report is compiled for every week, programme block, training cycle, programme and year - each compared with the one before it - or pick your own dates.</p>
      <Explain id="reports" />
      <div className="analysis-weeks" role="group" aria-label="Report type">
        {TYPES.map((entry) => (
          <button key={entry.type} type="button" className={`button secondary small-button${entry.type === type ? " is-selected" : ""}`} aria-pressed={entry.type === type} onClick={() => setType(entry.type)}>
            {`${entry.label}${list && entry.type !== "custom" ? ` (${(reports[entry.type] ?? []).length})` : ""}`}
          </button>
        ))}
      </div>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {!list && !error ? <p className="muted">Loading reports…</p> : null}
      {type === "custom" ? <CustomDates today={String(list?.today ?? new Date().toISOString().slice(0, 10))} onCompile={(id) => setOpen({ type: "custom", id })} /> : null}
      {list && !periods.length && current.empty ? <p className="muted small">{current.empty}</p> : null}
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
