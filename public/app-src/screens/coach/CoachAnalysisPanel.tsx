import React, { useState } from "react";

import { type JsonRecord } from "../../api/transport";
import { TrendChart, shortWeek } from "../../components/TrendChart";
import { CoachReports } from "./CoachReports";
import { useCoachAnalysisRoster, useCoachAthleteAnalysis } from "./useCoachAnalysis";

// The coach's Analysis page. Two layers on every section: a plain-English
// headline and one chart for the coach, and "Show the numbers" - the weekly
// table, how each figure is worked out and its caveats - for a sports
// scientist. Coach-only; athletes never see it.

type Finding = { id: string; section: string; level: "alert" | "watch" | "good" | "info"; text: string };
const LEVEL_LABEL: Record<string, string> = { alert: "Needs a look", watch: "Keep an eye on", good: "Going well", info: "Note" };
const WEEK_CHOICES = [4, 8, 12, 26];

const rows = (value: unknown) => (Array.isArray(value) ? (value as JsonRecord[]) : []);
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const show = (value: unknown, suffix = "") => (num(value) === null ? "–" : `${num(value)}${suffix}`);

function statusOf(attention: number | null): { label: string; level: string } {
  if (attention === null) return { label: "No data", level: "info" };
  if (attention >= 3) return { label: "Needs a look", level: "alert" };
  if (attention >= 1) return { label: "Keep an eye on", level: "watch" };
  return { label: "On track", level: "good" };
}

function FindingList({ findings, compact = false }: { findings: Finding[]; compact?: boolean }) {
  if (!findings.length) return <p className="muted small">Nothing stands out yet - more logged sessions will show patterns.</p>;
  return (
    <ul className={`analysis-findings${compact ? " is-compact" : ""}`}>
      {findings.map((finding) => (
        <li key={finding.id} className={`analysis-finding is-${finding.level}`}>
          {compact ? null : <span className="analysis-finding-level">{LEVEL_LABEL[finding.level]}</span>}
          <span>{finding.text}</span>
        </li>
      ))}
    </ul>
  );
}

function Numbers({ children }: { children: React.ReactNode }) {
  return (
    <details className="analysis-numbers">
      <summary>Show the numbers</summary>
      {children}
    </details>
  );
}

function Method({ children }: { children: React.ReactNode }) {
  return <div className="analysis-method"><p className="eyebrow">How it's worked out</p>{children}</div>;
}

function WeekTable({ weeks, columns }: { weeks: string[]; columns: Array<{ label: string; cell: (index: number) => React.ReactNode }> }) {
  return (
    <div className="analysis-table-wrap">
      <table className="analysis-table">
        <thead><tr><th>Week of</th>{columns.map((column) => <th key={column.label}>{column.label}</th>)}</tr></thead>
        <tbody>
          {weeks.map((week, index) => (
            <tr key={week}><td>{shortWeek(week)}</td>{columns.map((column) => <td key={column.label}>{column.cell(index)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ id, title, headline, children }: { id: string; title: string; headline: Finding | null; fallback?: string; children: React.ReactNode }) {
  return (
    <section className="analysis-section panel" id={`analysis-${id}`} data-testid={`analysis-${id}`}>
      <header>
        <h3>{title}</h3>
        {headline ? <p className={`analysis-headline is-${headline.level}`}>{headline.text}</p> : null}
      </header>
      {children}
    </section>
  );
}

function AthleteAnalysis({ athleteUserId, onBack }: { athleteUserId: string; onBack: () => void }) {
  const [weeks, setWeeks] = useState(12);
  const [view, setView] = useState<"trends" | "reports">("trends");
  const { data, error, loading } = useCoachAthleteAnalysis(athleteUserId, weeks);
  const a = (data?.analysis ?? null) as JsonRecord | null;
  const findings = rows(data?.findings) as unknown as Finding[];
  const first = (section: string) => findings.find((finding) => finding.section === section) ?? null;
  const weekList = (a?.weeks ?? []) as string[];

  const load = (a?.load ?? {}) as JsonRecord;
  const strength = (a?.strength ?? {}) as JsonRecord;
  const execution = (a?.execution ?? {}) as JsonRecord;
  const adherence = (a?.adherence ?? {}) as JsonRecord;
  const readiness = (a?.readiness ?? {}) as JsonRecord;
  const pain = (a?.pain ?? {}) as JsonRecord;
  const volume = (a?.volume ?? {}) as JsonRecord;
  const col = (list: JsonRecord[], key: string) => list.map((row) => num(row[key]));
  const lifts = rows(strength.lifts);
  const mainLifts = lifts.filter((lift) => lift.main !== false);
  const otherLifts = lifts.filter((lift) => lift.main === false);

  return (
    <div className="analysis-athlete" data-testid="analysis-athlete">
      <div className="analysis-athlete-bar">
        <button type="button" className="button secondary small-button" onClick={onBack}>‹ All athletes</button>
        <h2>{String((data?.athlete as JsonRecord | undefined)?.display_name ?? "Athlete")}</h2>
        <div className="analysis-weeks" role="group" aria-label="Analysis or reports">
          {(["trends", "reports"] as const).map((choice) => (
            <button key={choice} type="button" className={`button secondary small-button${choice === view ? " is-selected" : ""}`} aria-pressed={choice === view} onClick={() => setView(choice)}>{choice === "trends" ? "Trends" : "Reports"}</button>
          ))}
        </div>
        {view === "trends" ? (
          <div className="analysis-weeks" role="group" aria-label="Weeks shown">
            {WEEK_CHOICES.map((choice) => (
              <button key={choice} type="button" className={`button secondary small-button${choice === weeks ? " is-selected" : ""}`} aria-pressed={choice === weeks} onClick={() => setWeeks(choice)}>{`${choice} wks`}</button>
            ))}
          </div>
        ) : null}
      </div>
      {view === "reports" ? <CoachReports athleteUserId={athleteUserId} /> : null}
      {view === "trends" && error ? <p className="field-error" role="alert">{error}</p> : null}
      {view === "trends" && loading && !a ? <p className="muted">Working out the patterns…</p> : null}
      {view === "trends" && a ? (
        <>
          <section className="analysis-summary panel" data-testid="analysis-summary">
            <h3>What stands out</h3>
            <FindingList findings={findings} />
          </section>

          <div className="analysis-sections">
          <Section id="strength" title="Strength" headline={first("strength")}>
            <TrendChart title="Estimated max per main lift (kg)" weeks={weekList} unit=" kg" series={mainLifts.map((lift) => ({ id: String(lift.exercise_id), label: String(lift.name), values: rows(lift.series).map((p) => num(p.e1rm)) }))} emptyLabel="Log loaded sets of a main lift to see its estimated max." />
            {mainLifts.length ? (
              <ul className="analysis-lift-list">
                {mainLifts.map((lift) => (
                  <li key={String(lift.exercise_id)}><strong>{String(lift.name)}</strong>{` ${lift.latest} kg · ${lift.status}${num(lift.change_pct) !== null ? ` · ${Number(lift.change_pct) > 0 ? "+" : ""}${lift.change_pct}% since ${shortWeek(String(lift.change_from_week))}` : ""} · peak ${lift.peak} kg (${shortWeek(String(lift.peak_week))})`}</li>
                ))}
              </ul>
            ) : null}
            <Numbers>
              <WeekTable weeks={weekList} columns={lifts.map((lift) => ({ label: `${lift.name}${lift.main === false ? " (accessory)" : ""}`, cell: (index: number) => {
                const point = rows(lift.series)[index];
                return point?.e1rm ? <span title={`from ${point.from} (${point.method === "rts" ? "RTS chart" : "Epley"})`}>{`${point.e1rm}${point.method === "rts" ? "ʳ" : ""}`}</span> : "–";
              } }))} />
              {otherLifts.length ? <p className="muted small">{`Accessory lifts are shown for reference; strength findings are only raised for main (primary) lifts.`}</p> : null}
              <Method>
                <p>Each week's best estimated one-rep max (kg), from logged sets of 1-10 reps. Where the athlete rated the exercise (RPE 6-10), its heaviest set uses the RTS (Tuchscherer) RPE chart - load ÷ the chart's % for those reps at that RPE (marked ʳ); other sets use Epley, load × (1 + reps ÷ 30).</p>
                <p>"Rising": up 2% or more against the best at least 4 weeks earlier. "Plateau": no new best for 6+ weeks while still training it. "Falling": the last 2 weeks are 5%+ below the peak, or the 4-week change is -5% or worse.</p>
              </Method>
            </Numbers>
          </Section>

          <Section id="execution" title="Doing the plan" headline={first("execution")}>
            <TrendChart title="Execution against the plan" weeks={weekList} unit="%" yMin={0} yMax={100} series={[
              { id: "reps", label: "Sets with the prescribed reps", values: col(rows(execution.rows), "reps_hit_pct") },
              { id: "sets", label: "Prescribed sets logged", values: col(rows(execution.rows), "sets_logged_pct") }
            ]} />
            {rows(execution.effort_creep).length ? (
              <ul className="analysis-lift-list">
                {rows(execution.effort_creep).map((creep) => <li key={String(creep.exercise_id)}><strong>{String(creep.name)}</strong>{` at about ${creep.load_kg} kg: RPE ${creep.early_rpe} (${shortWeek(String(creep.early_date))}) → ${creep.late_rpe} (${shortWeek(String(creep.late_date))})`}</li>)}
              </ul>
            ) : null}
            <Numbers>
              <WeekTable weeks={weekList} columns={[
                { label: "Reps hit", cell: (i) => show(rows(execution.rows)[i]?.reps_hit_pct, "%") },
                { label: "Sets logged", cell: (i) => show(rows(execution.rows)[i]?.sets_logged_pct, "%") },
                { label: "Load vs plan", cell: (i) => show(rows(execution.rows)[i]?.load_vs_plan_pct, "%") }
              ]} />
              {rows(execution.most_missed).length ? (
                <>
                  <p className="eyebrow">Most often short of the plan</p>
                  <ul className="analysis-plain-list">{rows(execution.most_missed).map((m) => <li key={String(m.exercise_id)}>{`${m.name}: ${m.missed_sets} of ${m.planned_sets} sets short (${m.missed_pct}%)`}</li>)}</ul>
                </>
              ) : null}
              <Method>
                <p>Working sets of completed and partial sessions only. "Reps hit": logged sets with at least the prescribed reps (the bottom of a rep range). "Load vs plan": the mean logged load against the prescribed weight (+ is heavier than planned).</p>
                <p>"Feels harder at the same weight": the same exercise at a top weight within 2.5%, rated in the first half of the period and again in the second; a rise of 1 RPE or more is flagged - a common early sign of accumulated fatigue.</p>
              </Method>
            </Numbers>
          </Section>

          <Section id="load" title="Training load" headline={first("load")}>
            <TrendChart title="Weekly training load (AU)" weeks={weekList} unit=" AU" series={[{ id: "load", label: "Weekly load", kind: "bar", values: col(rows(load.rows), "load") }]} />
            <TrendChart title="Load against their 4-week normal" weeks={weekList} band={{ from: 0.8, to: 1.3, label: "0.8-1.3: in line with normal" }} yMin={0} series={[{ id: "acwr", label: "Acute:chronic ratio", values: col(rows(load.rows), "acute_chronic") }]} />
            <Numbers>
              <WeekTable weeks={weekList} columns={[
                { label: "Load (AU)", cell: (i) => show(rows(load.rows)[i]?.load) },
                { label: "Acute:chronic", cell: (i) => show(rows(load.rows)[i]?.acute_chronic) },
                { label: "Monotony", cell: (i) => show(rows(load.rows)[i]?.monotony) },
                { label: "Strain", cell: (i) => show(rows(load.rows)[i]?.strain) }
              ]} />
              <Method>
                <p>Session load (Foster session-RPE): session effort × minutes, in arbitrary units (AU). Effort is the mean of the athlete's exercise ratings on a 0-10 scale (RPE and CR10 as they are; Borg 6-20 rescaled); minutes run from the session's start to its last logged event (capped at 240). Unrated sessions add no load.</p>
                <p>Acute:chronic: this week's load ÷ the mean of the 4 weeks before it ("uncoupled"). 0.8-1.3 is the widely quoted range; it is a heuristic and disputed as an injury predictor, so read it as context. Monotony: the week's mean daily load ÷ its standard deviation (rest days count as 0); above 2 is "very samey". Strain: weekly load × monotony (Foster, 1998).</p>
              </Method>
            </Numbers>
          </Section>

          <Section id="adherence" title="Turning up" headline={first("adherence")}>
            <TrendChart title="Planned sessions done (%)" weeks={weekList} unit="%" yMin={0} yMax={100} series={[{ id: "adh", label: "Sessions done", kind: "bar", values: col(rows(adherence.rows), "adherence_pct") }]} emptyLabel="Adherence shows once their training days are set and a week has passed." />
            <div className="analysis-weekdays" aria-label="Sessions by day of the week">
              {rows(adherence.by_weekday).map((d) => {
                const most = Math.max(1, ...rows(adherence.by_weekday).map((x) => Number(x.sessions)));
                return <div key={String(d.day)} className="analysis-weekday"><span className="analysis-weekday-bar" style={{ height: `${(Number(d.sessions) / most) * 100}%` }} /><span>{String(d.day)}</span><small>{String(d.sessions)}</small></div>;
              })}
            </div>
            <Numbers>
              <WeekTable weeks={weekList} columns={[
                { label: "Done", cell: (i) => show(rows(adherence.rows)[i]?.completed) },
                { label: "Partial", cell: (i) => show(rows(adherence.rows)[i]?.partial) },
                { label: "Not done", cell: (i) => show(rows(adherence.rows)[i]?.abandoned) },
                { label: "Planned", cell: (i) => show(rows(adherence.rows)[i]?.planned) },
                { label: "%", cell: (i) => show(rows(adherence.rows)[i]?.adherence_pct, "%") }
              ]} />
              {rows(adherence.most_skipped).length ? (
                <>
                  <p className="eyebrow">Most skipped exercises</p>
                  <ul className="analysis-plain-list">{rows(adherence.most_skipped).map((s) => <li key={String(s.exercise_id)}>{`${s.name}: ${s.skips} skips (${Object.entries((s.reasons ?? {}) as Record<string, number>).map(([reason, count]) => `${reason.replaceAll("_", " ")} ${count}`).join(", ")})`}</li>)}</ul>
                </>
              ) : null}
              <Method>
                <p>Done ÷ the athlete's planned training days per week (a partial session counts as half), from the week of their first session; the current week isn't scored until it ends. "Not done": a session created but not started or finished after 2 days.</p>
              </Method>
            </Numbers>
          </Section>

          <Section id="readiness" title="Readiness and wellbeing" headline={first("readiness")}>
            <TrendChart title="Daily readiness (weekly average, out of 15)" weeks={weekList} yMin={3} yMax={15} series={[{ id: "total", label: "Sleep + soreness + stress", values: col(rows(readiness.rows), "total") }]} emptyLabel="Shows once the athlete answers the readiness check before sessions." />
            <TrendChart title="Weekly check-ins (out of 5)" weeks={weekList} yMin={1} yMax={5} series={[
              { id: "energy", label: "Energy", values: col(rows(readiness.checkins), "energy") },
              { id: "sleep", label: "Sleep", values: col(rows(readiness.checkins), "sleep") },
              { id: "motivation", label: "Motivation", values: col(rows(readiness.checkins), "motivation") }
            ]} emptyLabel="Shows once the athlete fills in weekly check-ins." />
            <Numbers>
              <WeekTable weeks={weekList} columns={[
                { label: "Check-ins", cell: (i) => show(rows(readiness.rows)[i]?.check_ins) },
                { label: "Sleep", cell: (i) => show(rows(readiness.rows)[i]?.sleep) },
                { label: "Soreness", cell: (i) => show(rows(readiness.rows)[i]?.soreness) },
                { label: "Stress", cell: (i) => show(rows(readiness.rows)[i]?.stress) },
                { label: "vs normal (z)", cell: (i) => show(rows(readiness.rows)[i]?.z) },
                { label: "Energy", cell: (i) => show(rows(readiness.checkins)[i]?.energy) },
                { label: "Motivation", cell: (i) => show(rows(readiness.checkins)[i]?.motivation) }
              ]} />
              <Method>
                <p>Readiness: sleep, soreness and stress (each 1 poor to 5 great) before a session. Each day is compared with that athlete's own previous 28 days (z-score: how many standard deviations from their normal, after 5+ check-ins); a week averaging -1 or lower is flagged, -1.5 or lower as needing a look. Weekly check-in drops of 1.5 points against their earlier weeks are flagged.</p>
              </Method>
            </Numbers>
          </Section>

          <Section id="pain" title="Pain" headline={first("pain")}>
            <TrendChart title="Pain reports per week" weeks={weekList} yMin={0} series={[{ id: "pain", label: "Pain reports", kind: "bar", values: col(rows(pain.rows), "reports") }]} emptyLabel="No pain reported." />
            <Numbers>
              {rows(pain.areas).length ? (
                <ul className="analysis-plain-list">{rows(pain.areas).map((area) => <li key={String(area.area)}>{`${String(area.area).replaceAll("_", " ")}: ${area.reports} reports in ${area.weeks} weeks${(area.exercises as string[]).length ? ` (${(area.exercises as string[]).join(", ")})` : ""}${num(area.first_week_acute_chronic) !== null ? `; first reported in a week at ${area.first_week_acute_chronic}× normal load` : ""}`}</li>)}</ul>
              ) : <p className="muted small">No pain reported in this period.</p>}
              <Method>
                <p>Pain reported during sessions, by body area. Pain in 2+ different weeks is flagged, and set against that week's load ratio. This records what the athlete reported - it is not a diagnosis.</p>
              </Method>
            </Numbers>
          </Section>

          <Section id="volume" title="Volume" headline={null}>
            <TrendChart title="Logged sets and tonnage per week" weeks={weekList} series={[{ id: "sets", label: "Sets logged", kind: "bar", values: col(rows(volume.rows), "sets") }]} />
            <Numbers>
              <WeekTable weeks={weekList} columns={[
                { label: "Sets", cell: (i) => show(rows(volume.rows)[i]?.sets) },
                { label: "Tonnage (kg)", cell: (i) => show(rows(volume.rows)[i]?.tonnage_kg) }
              ]} />
              <Method><p>Every logged set (prescribed and extra); tonnage is reps × load summed.</p></Method>
            </Numbers>
          </Section>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function CoachAnalysisPanel() {
  const { roster, error } = useCoachAnalysisRoster();
  const [selected, setSelected] = useState<string | null>(null);
  if (selected) return <AthleteAnalysis athleteUserId={selected} onBack={() => setSelected(null)} />;
  const athletes = rows(roster?.athletes);
  return (
    <div className="analysis" data-testid="coach-analysis">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Analysis</p>
          <h2>Who needs a look</h2>
          <p className="muted">Your athletes over the last 8 weeks, the ones needing attention first. Open an athlete for their trends and the numbers behind them.</p>
        </div>
      </div>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {!roster && !error ? <p className="muted">Working out the patterns…</p> : null}
      {roster && !athletes.length ? <div className="empty-state"><h3>No athletes yet</h3><p className="muted">Once athletes train with you, their patterns show here.</p></div> : null}
      {athletes.length ? (
        <div className="analysis-table-wrap">
          <table className="analysis-table analysis-roster" data-testid="analysis-roster">
            <thead>
              <tr><th>Athlete</th><th>Status</th><th>What stands out</th><th title="Planned sessions done, latest complete week">Sessions</th><th title="This week's load against their 4-week normal (0.8-1.3 is normal)">Load</th><th title="Readiness against their own normal (z)">Readiness</th><th>Main lifts</th></tr>
            </thead>
            <tbody>
              {athletes.map((athlete) => {
                const status = statusOf(num(athlete.attention));
                const findings = (rows(athlete.findings) as unknown as Finding[]).filter((f) => f.level === "alert" || f.level === "watch");
                const ratio = num((athlete.load as JsonRecord | undefined)?.acute_chronic);
                const z = num((athlete.readiness as JsonRecord | undefined)?.z);
                return (
                  <tr key={String(athlete.athlete_user_id)}>
                    <td data-label="Athlete"><button type="button" className="analysis-athlete-link" onClick={() => setSelected(String(athlete.athlete_user_id))}>{String(athlete.display_name)}</button></td>
                    <td data-label="Status"><span className={`analysis-status is-${status.level}`}>{status.label}</span></td>
                    <td data-label="What stands out" className="analysis-roster-findings">{findings.length ? <FindingList findings={findings.slice(0, 3)} compact /> : <span className="muted small">{athlete.unavailable ? "Couldn't be analysed" : "Nothing needs a look"}</span>}</td>
                    <td data-label="Sessions">{show((athlete.adherence as JsonRecord | undefined)?.latest_pct, "%")}</td>
                    <td data-label="Load" className={ratio === null ? "" : ratio > 1.5 || ratio < 0.8 ? "is-alert-text" : ratio > 1.3 ? "is-watch-text" : ""}>{show(ratio)}</td>
                    <td data-label="Readiness" className={z === null ? "" : z <= -1.5 ? "is-alert-text" : z <= -1 ? "is-watch-text" : ""}>{z === null ? "–" : z > -1 ? "Normal" : "Low"}</td>
                    <td data-label="Main lifts">{rows(athlete.strength).map((lift) => `${lift.name} ${lift.status === "rising" ? "↑" : lift.status === "falling" ? "↓" : lift.status === "plateau" ? "→" : "·"}`).join(" · ") || "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
