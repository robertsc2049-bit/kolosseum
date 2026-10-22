import React, { useState } from "react";

import { type JsonRecord } from "../../api/transport";
import { TrendChart, shortWeek, type TrendMarker } from "../../components/TrendChart";
import { Explain } from "./analysisGuide";
import { FindingList, type Finding } from "./FindingList";
import { GymAnalysis, TeamAnalysis, useCoachTeams } from "./TeamAnalysis";
import { TestingSection } from "./TestingSection";
import { InjuryLog } from "./InjuryLog";
import { SquadEntry } from "./SquadEntry";
import { CoachReports } from "./CoachReports";
import { useCoachAnalysisRoster, useCoachAthleteAnalysis } from "./useCoachAnalysis";

// The coach's Analysis page. Two layers on every section: a plain-English
// headline and one chart for the coach, and "Show the numbers" - the weekly
// table, how each figure is worked out and its caveats - for a sports
// scientist. Coach-only; athletes never see it.

// Effort against a target, in words: within half a point is on target.
const effortWords = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "–";
  return Math.abs(value) < 0.5 ? "On target" : value > 0 ? "Harder than set" : "Easier than set";
};
const WEEK_CHOICES = [4, 8, 12, 26];
const SCALE: Record<string, string> = { rpe: "RPE", cr10: "CR10", borg: "Borg" };

const rows = (value: unknown) => (Array.isArray(value) ? (value as JsonRecord[]) : []);
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const show = (value: unknown, suffix = "") => (num(value) === null ? "–" : `${num(value)}${suffix}`);

// An athlete with no training logged in the period isn't "on track" - there's nothing to judge.
function statusOf(attention: number | null, trained = true): { label: string; level: string } {
  if (attention === null) return { label: "No data", level: "info" };
  if (!trained && attention === 0) return { label: "No training yet", level: "info" };
  if (attention >= 3) return { label: "Needs a look", level: "alert" };
  if (attention >= 1) return { label: "Keep an eye on", level: "watch" };
  return { label: "On track", level: "good" };
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
      <Explain id={id} />
      {children}
    </section>
  );
}

function AthleteAnalysis({ athleteUserId, onBack }: { athleteUserId: string; onBack: () => void }) {
  const [weeks, setWeeks] = useState(12);
  const [view, setView] = useState<"trends" | "reports">("trends");
  const { data, error, loading, reload } = useCoachAthleteAnalysis(athleteUserId, weeks);
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
  const injuries = (a?.injuries ?? {}) as JsonRecord;
  const volume = (a?.volume ?? {}) as JsonRecord;
  const col = (list: JsonRecord[], key: string) => list.map((row) => num(row[key]));
  const lifts = rows(strength.lifts);
  const mainLifts = lifts.filter((lift) => lift.main !== false);
  const otherLifts = lifts.filter((lift) => lift.main === false);
  const bodyweightLifts = rows(strength.bodyweight);
  // Competitions, matches, deloads and peaks, on every chart.
  const markers = rows(a?.markers) as unknown as TrendMarker[];
  const quality = (load.quality ?? {}) as JsonRecord;
  const intensity = (execution.intensity ?? {}) as JsonRecord;
  const plan = (a?.plan ?? {}) as JsonRecord;
  const ahead = (plan.ahead ?? {}) as JsonRecord;
  const external = (a?.external ?? {}) as JsonRecord;
  const testing = (a?.testing ?? {}) as JsonRecord;

  return (
    <div className="analysis-athlete" data-testid="analysis-athlete">
      <div className="analysis-athlete-bar">
        <button type="button" className="button secondary small-button" onClick={onBack}>‹ All athletes</button>
        <h2>{String((data?.athlete as JsonRecord | undefined)?.display_name ?? "Athlete")}</h2>
        {data?.viewed_as === "head_coach" ? null : <div className="analysis-weeks" role="group" aria-label="Analysis or reports">
          {(["trends", "reports"] as const).map((choice) => (
            <button key={choice} type="button" className={`button secondary small-button${choice === view ? " is-selected" : ""}`} aria-pressed={choice === view} onClick={() => setView(choice)}>{choice === "trends" ? "Trends" : "Reports"}</button>
          ))}
        </div>}
        {view === "trends" ? (
          <div className="analysis-weeks" role="group" aria-label="Weeks shown">
            {WEEK_CHOICES.map((choice) => (
              <button key={choice} type="button" className={`button secondary small-button${choice === weeks ? " is-selected" : ""}`} aria-pressed={choice === weeks} onClick={() => setWeeks(choice)}>{`${choice} wks`}</button>
            ))}
          </div>
        ) : null}
      </div>
      {data?.viewed_as === "head_coach" ? <p className="muted small analysis-head-coach-note" data-testid="viewed-as-head-coach">{`You're viewing this athlete as head coach of ${String((data.org as JsonRecord | undefined)?.org_name ?? "the team")} - they're coached by someone else, who keeps their reports.`}</p> : null}
      {view === "reports" ? <CoachReports athleteUserId={athleteUserId} /> : null}
      {view === "trends" && error ? <p className="field-error" role="alert">{error}</p> : null}
      {view === "trends" && loading && !a ? <p className="muted">Working out the patterns…</p> : null}
      {view === "trends" && a ? (
        <>
          <section className="analysis-summary panel" data-testid="analysis-summary">
            <h3>What stands out</h3>
            <FindingList findings={findings} />
            <Explain id="summary" />
          </section>

          <div className="analysis-sections">
          <Section id="strength" title="Strength" headline={first("strength")}>
            <TrendChart markers={markers} title="Estimated max per main lift (kg)" weeks={weekList} unit=" kg" series={mainLifts.map((lift) => ({ id: String(lift.exercise_id), label: String(lift.name), values: rows(lift.series).map((p) => num(p.e1rm)) }))} emptyLabel="Log loaded sets of a main lift to see its estimated max." />
            {mainLifts.length ? (
              <ul className="analysis-lift-list">
                {mainLifts.map((lift) => (
                  <li key={String(lift.exercise_id)}><strong>{String(lift.name)}</strong>{` ${lift.latest} kg${num(lift.relative_to_bodyweight) !== null ? ` (${lift.relative_to_bodyweight}× bodyweight)` : ""} · ${lift.status}${num(lift.change_pct) !== null ? ` · ${Number(lift.change_pct) > 0 ? "+" : ""}${lift.change_pct}% since ${shortWeek(String(lift.change_from_week))}` : ""} · peak ${lift.peak} kg (${shortWeek(String(lift.peak_week))})`}{lift.tested_max ? ` · tested max ${(lift.tested_max as JsonRecord).value_kg} kg (${shortWeek(String((lift.tested_max as JsonRecord).date))})` : ""}{num(lift.noise_pct) !== null ? <span className="muted small">{` · ±${lift.noise_pct}% is normal week-to-week variation for this lift`}</span> : null}</li>
                ))}
              </ul>
            ) : null}
            {bodyweightLifts.length ? (
              <>
                <TrendChart markers={markers} title="Best set on bodyweight exercises (reps)" weeks={weekList} unit=" reps" yMin={0} series={bodyweightLifts.map((lift) => ({ id: String(lift.exercise_id), label: String(lift.name), values: rows(lift.series).map((p) => num(p.best_reps)) }))} />
                <ul className="analysis-lift-list" data-testid="analysis-bodyweight-lifts">
                  {bodyweightLifts.map((lift) => <li key={String(lift.exercise_id)}><strong>{String(lift.name)}</strong>{` best set ${lift.latest} reps (from ${lift.first}) · best of the period ${lift.best} reps`}</li>)}
                </ul>
              </>
            ) : null}
            <Numbers>
              <WeekTable weeks={weekList} columns={lifts.map((lift) => ({ label: `${lift.name}${lift.main === false ? " (accessory)" : ""}`, cell: (index: number) => {
                const point = rows(lift.series)[index];
                return point?.e1rm ? <span title={`from ${point.from} (${point.method === "rts" ? "RTS chart" : "Epley"})`}>{`${point.e1rm}${point.method === "rts" ? "ʳ" : ""}`}</span> : "–";
              } }))} />
              {otherLifts.length ? <p className="muted small">{`Accessory lifts are shown for reference; strength findings are only raised for main (primary) lifts.`}</p> : null}
              <Method>
                <p>Each week's best estimated one-rep max (kg), from logged sets of 1-10 reps. Where the athlete rated the exercise (RPE 6-10), its heaviest set uses the RTS (Tuchscherer) RPE chart - load ÷ the chart's % for those reps at that RPE (marked ʳ); other sets use Epley, load × (1 + reps ÷ 30).</p>
                <p>Real change: each lift's own week-to-week variation (typical error = the SD of its week-to-week % changes ÷ √2) sets the smallest change worth calling a change - 1.5× that, and never under 2%. "Rising" and "falling" need a change bigger than that; anything smaller is "steady", however it looks on the chart. × bodyweight uses the latest bodyweight you recorded; the tested max is the latest one in their strength profile.</p>
                <p>"Rising": up by more than the smallest worthwhile change against the best at least 4 weeks earlier. "Plateau": no new best for 6+ weeks while still training it. "Falling": the last 2 weeks are 5%+ below the peak, or the 4-week change is -5% or worse.</p>
              </Method>
            </Numbers>
          </Section>

          <Section id="execution" title="Doing the plan" headline={first("execution")}>
            {rows(plan.rows).some((row) => num(row.planned_tonnage_kg)) ? (
              <TrendChart markers={markers} title="Planned vs done (tonnage, kg)" weeks={weekList} unit=" kg" series={[
                { id: "planned", label: "Planned", kind: "bar", values: col(rows(plan.rows), "planned_tonnage_kg") },
                { id: "done", label: "Done", kind: "bar", values: col(rows(plan.rows), "done_tonnage_kg") }
              ]} />
            ) : null}
            <TrendChart markers={markers} title="Execution against the plan" weeks={weekList} unit="%" yMin={0} yMax={100} series={[
              { id: "reps", label: "Sets with the prescribed reps", values: col(rows(execution.rows), "reps_hit_pct") },
              { id: "sets", label: "Prescribed sets logged", values: col(rows(execution.rows), "sets_logged_pct") }
            ]} />
            {rows(execution.effort_creep).length ? (
              <ul className="analysis-lift-list">
                {rows(execution.effort_creep).filter((creep) => Math.abs(Number(creep.effort_change)) >= 0.5).map((creep) => <li key={`${String(creep.exercise_id)}-${String(creep.scale)}`}><strong>{String(creep.name)}</strong>{` at about ${creep.load_kg} kg: ${creep.scale_label} ${creep.early} (${shortWeek(String(creep.early_date))}) → ${creep.late} (${shortWeek(String(creep.late_date))})`}</li>)}
              </ul>
            ) : null}
            <Numbers>
              <WeekTable weeks={weekList} columns={[
                { label: "Reps hit", cell: (i) => show(rows(execution.rows)[i]?.reps_hit_pct, "%") },
                { label: "Sets logged", cell: (i) => show(rows(execution.rows)[i]?.sets_logged_pct, "%") },
                { label: "Load vs plan", cell: (i) => show(rows(execution.rows)[i]?.load_vs_plan_pct, "%") },
                { label: "Effort vs target", cell: (i) => <span title={show(rows(execution.rows)[i]?.effort_vs_plan)}>{effortWords(rows(execution.rows)[i]?.effort_vs_plan)}</span> },
                { label: "Sessions (done/planned)", cell: (i) => `${show(rows(plan.rows)[i]?.done_sessions)}/${show(rows(plan.rows)[i]?.planned_sessions)}` },
                { label: "Sets (done/planned)", cell: (i) => `${show(rows(plan.rows)[i]?.done_sets)}/${show(rows(plan.rows)[i]?.planned_sets)}` },
                { label: "Tonnage vs plan", cell: (i) => show(rows(plan.rows)[i]?.tonnage_pct, "%") }
              ]} />
              {rows(execution.effort_targets).length ? (
                <>
                  <p className="eyebrow">Effort against the target you set</p>
                  <ul className="analysis-plain-list" data-testid="analysis-effort-targets">{rows(execution.effort_targets).map((t) => <li key={`${t.exercise_id}-${t.scale}-${t.target}`}>{`${t.name}: ${SCALE[String(t.scale)]} ${t.target}${t.target_max ? `-${t.target_max}` : ""} set, rated ${t.rated_average} on average over ${t.ratings} rating${Number(t.ratings) === 1 ? "" : "s"} (${Number(t.diff) === 0 ? "on target" : `${Number(t.diff) > 0 ? "+" : ""}${t.diff}`})`}</li>)}</ul>
                </>
              ) : null}
              {rows(execution.most_missed).length ? (
                <>
                  <p className="eyebrow">Most often short of the plan</p>
                  <ul className="analysis-plain-list">{rows(execution.most_missed).map((m) => <li key={String(m.exercise_id)}>{`${m.name}: ${m.missed_sets} of ${m.planned_sets} sets short (${m.missed_pct}%)`}</li>)}</ul>
                </>
              ) : null}
              <Method>
                <p>Working sets of completed and partial sessions only. "Reps hit": logged sets with at least the prescribed reps (the bottom of a rep range). "Sets logged": prescribed sets logged; timed and distance work counts all its sets once completed, none if skipped.</p>
                <p>"Load vs plan": the logged weight against the prescribed one - a fixed weight, a weight range, or a % of max made a weight. Inside a range is 0; above it is measured from the top, below from the bottom (+ is heavier than planned).</p>
                <p>"Effort vs target": where you prescribed by RPE, Borg or CR10, the athlete's rating of that exercise against your target, in that scale. The weekly column says it in words - on target (within half a point on a 0-10 scale, Borg rescaled), harder than set or easier than set; hover it for the number. Inside a target range is on target.</p>
                <p>"Feels harder at the same weight": the same exercise at a top weight within 2.5%, rated in the same scale in the first half of the period and again in the second; a rise of 1 point (0-10) or more is flagged - a common early sign of accumulated fatigue.</p>
              </Method>
            </Numbers>
          </Section>

          <Section id="load" title="Training load" headline={first("load")}>
            <TrendChart markers={markers} title="Weekly training load (load points): gym and sport" weeks={weekList} unit=" load points" series={[
              { id: "gym", label: "Gym", kind: "bar", values: col(rows(load.rows), "gym_load") },
              { id: "sport", label: "Practice, matches, conditioning", kind: "bar", values: col(rows(load.rows), "sport_load") }
            ]} />
            <p className="muted small" data-testid="analysis-load-quality">{num(quality.gym_sessions)
              ? `${quality.measured} of ${quality.gym_sessions} gym sessions rated by the athlete when they finished (the rest estimated)${num(quality.other_sessions) ? ` · ${quality.other_sessions} practice, match or conditioning sessions logged` : ""}.`
              : "No gym sessions in this period."}</p>
            <TrendChart markers={markers} title="Load against their 4-week normal" weeks={weekList} band={{ from: 0.8, to: 1.3, label: "0.8-1.3: in line with normal" }} yMin={0} series={[
              { id: "acwr", label: "Acute:chronic (rolling)", values: col(rows(load.rows), "acute_chronic") },
              { id: "ewma", label: "Acute:chronic (EWMA)", values: col(rows(load.rows), "ewma_ratio") }
            ]} />
            {rows(ahead.rows).length ? (
              <div className="analysis-ahead" data-testid="analysis-ahead">
                <h4>The next weeks of the plan</h4>
                <div className="analysis-table-wrap">
                  <table className="analysis-table">
                    <thead><tr><th>Week</th><th>Working sets</th><th>Tonnage (kg)</th><th>vs lately</th></tr></thead>
                    <tbody>
                      {rows(ahead.rows).map((week) => (
                        <tr key={String(week.week_number)}>
                          <td>{`Week ${week.week_number}${week.current ? " (now)" : ""} · ${week.block_name}`}</td>
                          <td>{`${show(week.working_sets)} in ${show(week.sessions)} sessions${Number(week.sets_80) ? ` · ${week.sets_80} at 80%+${Number(week.sets_90) ? `, ${week.sets_90} at 90%+` : ""}` : ""}`}</td>
                          <td>{show(week.tonnage_kg)}</td>
                          <td>{num(week.sets_vs_recent) === null ? "–" : `${week.sets_vs_recent}× sets${num(week.tonnage_vs_recent) === null ? "" : `, ${week.tonnage_vs_recent}× tonnage`}`}{week.flag === "spike" ? <span className="analysis-headline is-watch"> Spike</span> : week.flag === "jump" ? <span className="analysis-headline is-info"> Jump</span> : week.flag === "step_up" ? <span className="analysis-headline is-info"> Step up</span> : week.flag === "deload" ? <span className="muted"> Deload</span> : null}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="muted small">{`Lately: ${show((ahead.recent as JsonRecord | undefined)?.sets)} working sets and ${show((ahead.recent as JsonRecord | undefined)?.tonnage_kg)} kg a week (their last 4 complete weeks). "Now" counts the sessions left this week.`}</p>
              </div>
            ) : null}
            <Numbers>
              <WeekTable weeks={weekList} columns={[
                { label: "Load (points)", cell: (i) => show(rows(load.rows)[i]?.load) },
                { label: "Gym", cell: (i) => show(rows(load.rows)[i]?.gym_load) },
                { label: "Sport", cell: (i) => show(rows(load.rows)[i]?.sport_load) },
                { label: "Matches", cell: (i) => show(rows(load.rows)[i]?.matches) },
                { label: "Acute:chronic", cell: (i) => show(rows(load.rows)[i]?.acute_chronic) },
                { label: "EWMA", cell: (i) => show(rows(load.rows)[i]?.ewma_ratio) },
                { label: "Monotony", cell: (i) => show(rows(load.rows)[i]?.monotony) },
                { label: "Strain", cell: (i) => show(rows(load.rows)[i]?.strain) }
              ]} />
              <Method>
                <p>Session load (Foster session-RPE): session effort × minutes, in load points (the research calls them arbitrary units, AU). Measured when the athlete rates the whole session (0-10) and its minutes as they finish; otherwise estimated from the mean of their exercise ratings (RPE and CR10 as they are; Borg 6-20 rescaled) × the minutes from starting the session to its last logged event (capped at 240). Practice, matches and conditioning they log add their own effort × minutes. Unrated sessions add no load.</p>
                <p>Acute:chronic: this week's load ÷ the mean of the 4 weeks before it ("uncoupled"). 0.8-1.3 is the widely quoted range; it is a heuristic and disputed as an injury predictor, so read it as context. Monotony: the week's mean daily load ÷ its standard deviation (rest days count as 0); above 2 is "very samey". Strain: weekly load × monotony (Foster, 1998).</p>
                <p>EWMA acute:chronic (Williams et al., 2017): exponentially weighted daily load, acute over about 7 days (λ = 0.25) and chronic over about 28 (λ ≈ 0.069); a week shows the average of its daily ratios, as a single day swings with the weekday. It weights recent days more and isn't thrown by one big week dropping out of the 4-week window. Needs 28 days of history.</p>
                <p>The next weeks of the plan: the programme's sessions still to come, week by week - working sets, tonnage from the weights it sets (from the maxes you recorded, or fixed weights) and sets at 80%+ / 90%+ of max - against what they've actually done on average over their last 4 complete weeks. Over 1.3× is a jump, over 1.5× a spike; a 30%+ rise in sets on the plan's week before is a step up.</p>
              </Method>
            </Numbers>
          </Section>

          {rows(external.rows).some((row) => Number(row.sessions) > 0) ? (
            <Section id="gps" title="Running load (GPS / HR)" headline={first("gps")}>
              <TrendChart markers={markers} title="Weekly total distance (m)" weeks={weekList} unit=" m" series={[
                { id: "distance", label: "Total distance", kind: "bar", values: col(rows(external.rows), "total_distance_m") }
              ]} />
              <TrendChart markers={markers} title="Weekly high-speed running and sprint distance (m)" weeks={weekList} unit=" m" series={[
                { id: "hsr", label: "High-speed running", kind: "bar", values: col(rows(external.rows), "hsr_m") },
                { id: "sprint", label: "Sprint", kind: "bar", values: col(rows(external.rows), "sprint_m") }
              ]} />
              <TrendChart markers={markers} title="High-speed running against their usual" weeks={weekList} band={{ from: 0.8, to: 1.3, label: "0.8-1.3×: normal" }} yMin={0} series={[{ id: "hsr_ratio", label: "HSR vs usual", values: col(rows(external.rows), "hsr_ratio") }]} />
              <Numbers>
                <WeekTable weeks={weekList} columns={[
                  { label: "Sessions", cell: (i) => show(rows(external.rows)[i]?.sessions) },
                  { label: "Distance (m)", cell: (i) => show(rows(external.rows)[i]?.total_distance_m) },
                  { label: "HSR (m)", cell: (i) => show(rows(external.rows)[i]?.hsr_m) },
                  { label: "Sprint (m)", cell: (i) => show(rows(external.rows)[i]?.sprint_m) },
                  { label: "Player load", cell: (i) => show(rows(external.rows)[i]?.player_load) },
                  { label: "Avg HR", cell: (i) => show(rows(external.rows)[i]?.avg_hr) },
                  { label: "HSR vs usual", cell: (i) => show(rows(external.rows)[i]?.hsr_ratio) },
                  { label: "Distance vs usual", cell: (i) => show(rows(external.rows)[i]?.distance_ratio) }
                ]} />
                <Method><p>From the GPS / heart-rate exports you import. Weekly totals; "vs usual" is that week against the mean of the 4 before it (the same uncoupled ratio as training load). This is kept apart from the effort-based load, so the same session isn't counted twice.</p></Method>
              </Numbers>
            </Section>
          ) : null}

          <Section id="adherence" title="Turning up" headline={first("adherence")}>
            <TrendChart markers={markers} title="Planned sessions done (%)" weeks={weekList} unit="%" yMin={0} yMax={100} series={[{ id: "adh", label: "Sessions done", kind: "bar", values: col(rows(adherence.rows), "adherence_pct") }]} emptyLabel="Adherence shows once their training days are set and a week has passed." />
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
            <TrendChart markers={markers} title="Daily readiness (weekly average, out of 15)" weeks={weekList} yMin={3} yMax={15} series={[{ id: "total", label: "Sleep + soreness + stress", values: col(rows(readiness.rows), "total") }]} emptyLabel="Shows once the athlete answers the readiness check before sessions." />
            <TrendChart markers={markers} title="Weekly check-ins (out of 5)" weeks={weekList} yMin={1} yMax={5} series={[
              { id: "energy", label: "Energy", values: col(rows(readiness.checkins), "energy") },
              { id: "sleep", label: "Sleep", values: col(rows(readiness.checkins), "sleep") },
              { id: "motivation", label: "Motivation", values: col(rows(readiness.checkins), "motivation") }
            ]} emptyLabel="Shows once the athlete fills in weekly check-ins." />
            {rows(readiness.rows).some((row) => num(row.hrv_ms) !== null || num(row.resting_hr) !== null) ? (
              <TrendChart markers={markers} title="Resting heart rate (bpm) and HRV (ms), weekly average" weeks={weekList} series={[
                { id: "rhr", label: "Resting HR (bpm)", values: col(rows(readiness.rows), "resting_hr") },
                { id: "hrv", label: "HRV (ms)", values: col(rows(readiness.rows), "hrv_ms") }
              ]} />
            ) : null}
            <Numbers>
              <WeekTable weeks={weekList} columns={[
                { label: "Check-ins", cell: (i) => show(rows(readiness.rows)[i]?.check_ins) },
                { label: "Fatigue", cell: (i) => show(rows(readiness.rows)[i]?.fatigue) },
                { label: "Mood", cell: (i) => show(rows(readiness.rows)[i]?.mood) },
                { label: "Resting HR", cell: (i) => show(rows(readiness.rows)[i]?.resting_hr) },
                { label: "vs normal (bpm)", cell: (i) => show(rows(readiness.rows)[i]?.resting_hr_delta) },
                { label: "HRV (ms)", cell: (i) => show(rows(readiness.rows)[i]?.hrv_ms) },
                { label: "HRV vs normal (z)", cell: (i) => show(rows(readiness.rows)[i]?.hrv_z) },
                { label: "Sleep", cell: (i) => show(rows(readiness.rows)[i]?.sleep) },
                { label: "Soreness", cell: (i) => show(rows(readiness.rows)[i]?.soreness) },
                { label: "Stress", cell: (i) => show(rows(readiness.rows)[i]?.stress) },
                { label: "vs normal (z)", cell: (i) => show(rows(readiness.rows)[i]?.z) },
                { label: "Energy", cell: (i) => show(rows(readiness.checkins)[i]?.energy) },
                { label: "Motivation", cell: (i) => show(rows(readiness.checkins)[i]?.motivation) }
              ]} />
              <Method>
                <p>Fatigue and mood (1-5), resting heart rate and HRV are optional extras the athlete adds to the check-in. HRV is compared with their own previous 28 days on a log scale (it's skewed) - a week averaging z -1.5 or lower is flagged; resting heart rate 5+ bpm above their 28-day average is flagged. Both need 5+ earlier readings.</p>
                <p>Readiness: sleep, soreness and stress (each 1 poor to 5 great) before a session. Each day is compared with that athlete's own previous 28 days (z-score: how many standard deviations from their normal, after 5+ check-ins); a week averaging -1 or lower is flagged, -1.5 or lower as needing a look. Weekly check-in drops of 1.5 points against their earlier weeks are flagged.</p>
              </Method>
            </Numbers>
          </Section>

          <Section id="injuries" title="Injuries" headline={first("injuries")}>
            <InjuryLog athleteUserId={athleteUserId} injuries={injuries} onChanged={reload} />
          </Section>

          <Section id="pain" title="Pain" headline={first("pain")}>
            <TrendChart markers={markers} title="Pain reports per week" weeks={weekList} yMin={0} series={[{ id: "pain", label: "Pain reports", kind: "bar", values: col(rows(pain.rows), "reports") }]} emptyLabel="No pain reported." />
            <Numbers>
              {rows(pain.areas).length ? (
                <ul className="analysis-plain-list">{rows(pain.areas).map((area) => <li key={String(area.area)}>{`${String(area.area).replaceAll("_", " ")}: ${area.reports} reports in ${area.weeks} weeks${(area.exercises as string[]).length ? ` (${(area.exercises as string[]).join(", ")})` : ""}${num(area.first_week_acute_chronic) !== null ? `; first reported in a week at ${area.first_week_acute_chronic}× normal load` : ""}`}</li>)}</ul>
              ) : <p className="muted small">No pain reported in this period.</p>}
              <Method>
                <p>Pain reported during sessions, by body area. Pain in 2+ different weeks is flagged, and set against that week's load ratio. This records what the athlete reported - it is not a diagnosis.</p>
              </Method>
            </Numbers>
          </Section>

          <Section id="testing" title="Testing" headline={first("testing")}>
            <TestingSection athleteUserId={athleteUserId} tests={rows(testing.tests)} onChanged={reload} readOnly={data?.viewed_as === "head_coach"} />
          </Section>

          <Section id="intensity" title="Intensity (% of max)" headline={null}>
            {num(intensity.sets) ? (
              <>
                <ul className="analysis-weekdays report-bands" aria-label="Sets by % of max">
                  {rows(intensity.zones).map((zone) => <li key={String(zone.zone)} className="analysis-weekday"><span className="analysis-weekday-bar" style={{ height: `${Math.max(4, Number(zone.pct ?? 0))}%` }} /><strong>{show(zone.pct, "%")}</strong><span>{String(zone.zone)}</span></li>)}
                </ul>
                <TrendChart markers={markers} title="Average % of max lifted" weeks={weekList} unit="%" series={[{ id: "intensity", label: "% of max", values: col(rows(execution.rows), "intensity_pct") }]} />
              </>
            ) : <div className="empty-state compact-empty trend-empty"><p>Shows when the programme sets weights as a % of the athlete's max.</p></div>}
            <Numbers>
              {rows(intensity.by_exercise).length ? <ul className="analysis-plain-list">{rows(intensity.by_exercise).map((row) => <li key={String(row.exercise_id)}>{`${row.name}: ${row.sets} sets, ${row.average_pct}% of max on average, heaviest ${row.top_pct}%`}</li>)}</ul> : <p className="muted small">No sets against a % of max in this period.</p>}
              <Method><p>Each logged set's weight ÷ the max the programme's % was worked out from. Zones count sets.</p></Method>
            </Numbers>
          </Section>

          <Section id="volume" title="Volume" headline={null}>
            <TrendChart markers={markers} title="Logged sets and tonnage per week" weeks={weekList} series={[{ id: "sets", label: "Sets logged", kind: "bar", values: col(rows(volume.rows), "sets") }]} />
            <Numbers>
              <WeekTable weeks={weekList} columns={[
                { label: "Sets", cell: (i) => show(rows(volume.rows)[i]?.sets) },
                { label: "Tonnage (kg)", cell: (i) => show(rows(volume.rows)[i]?.tonnage_kg) },
                { label: "Bodyweight reps", cell: (i) => show(rows(volume.rows)[i]?.bodyweight_reps) },
                { label: "Timed (min)", cell: (i) => show(rows(volume.rows)[i]?.timed_minutes) },
                { label: "Distance (m)", cell: (i) => show(rows(volume.rows)[i]?.distance_m) }
              ]} />
              <Method><p>Every logged set (prescribed and extra); tonnage is reps × load summed. Bodyweight reps: reps of sets logged with no weight added. Timed and distance work counts as prescribed (sets × time or distance) once the athlete completes it.</p></Method>
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
  const teams = useCoachTeams();
  const [selected, setSelected] = useState<string | null>(null);
  // "mine" (the coach's own athletes) or a team org's id.
  const [scope, setScope] = useState("mine");
  if (selected) return <AthleteAnalysis athleteUserId={selected} onBack={() => setSelected(null)} />;
  const athletes = rows(roster?.athletes);
  const team = teams.find((entry) => entry.org_id === scope) ?? null;
  return (
    <div className="analysis" data-testid="coach-analysis">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Analysis</p>
          <h2>{team ? team.org_name : "Who needs a look"}</h2>
          <p className="muted">{team
            ? "The whole team over the last 8 weeks: how it's doing as a group, by position and by coach, then every athlete."
            : "Your athletes over the last 8 weeks, the ones needing attention first. Open an athlete for their trends and the numbers behind them."}</p>
        </div>
      </div>
      {teams.length ? (
        <div className="analysis-weeks analysis-scope" role="group" aria-label="Whose analysis">
          <button type="button" className={`button secondary small-button${scope === "mine" ? " is-selected" : ""}`} aria-pressed={scope === "mine"} onClick={() => setScope("mine")}>My athletes</button>
          {teams.map((entry) => (
            <button key={entry.org_id} type="button" className={`button secondary small-button${scope === entry.org_id ? " is-selected" : ""}`} aria-pressed={scope === entry.org_id} onClick={() => setScope(entry.org_id)}>{`${entry.visibility_mode === "shared" ? "Team" : "Gym"}: ${entry.org_name}`}</button>
          ))}
        </div>
      ) : null}
      {team && team.visibility_mode === "shared" ? <TeamAnalysis team={team} onOpenAthlete={setSelected} /> : null}
      {team && team.visibility_mode === "individual" ? <GymAnalysis team={team} /> : null}
      {team ? null : <>
      <Explain id="roster" />
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {!roster && !error ? <p className="muted">Working out the patterns…</p> : null}
      {roster && !athletes.length ? <div className="empty-state"><h3>No athletes yet</h3><p className="muted">Once athletes train with you, their patterns show here.</p></div> : null}
      {athletes.length ? (
        <div className="analysis-table-wrap">
          <table className="analysis-table analysis-roster" data-testid="analysis-roster">
            <thead>
              <tr><th>Athlete</th><th>Status</th><th>What stands out</th><th title="Planned sessions done, latest complete week">Sessions</th><th title="This week's load against their usual (1.0× = a normal week; 0.8-1.3× is normal)">Load vs usual</th><th title="Readiness against their own normal (z)">Readiness</th><th>Main lifts</th></tr>
            </thead>
            <tbody>
              {athletes.map((athlete) => {
                const status = statusOf(num(athlete.attention), Boolean(athlete.last_session));
                const findings = (rows(athlete.findings) as unknown as Finding[]).filter((f) => f.level === "alert" || f.level === "watch");
                const ratio = num((athlete.load as JsonRecord | undefined)?.acute_chronic);
                const z = num((athlete.readiness as JsonRecord | undefined)?.z);
                return (
                  <tr key={String(athlete.athlete_user_id)}>
                    <td data-label="Athlete"><button type="button" className="analysis-athlete-link" onClick={() => setSelected(String(athlete.athlete_user_id))}>{String(athlete.display_name)}</button></td>
                    <td data-label="Status"><span className={`analysis-status is-${status.level}`}>{status.label}</span></td>
                    <td data-label="What stands out" className="analysis-roster-findings">{findings.length ? <FindingList findings={findings.slice(0, 3)} compact /> : <span className="muted small">{athlete.unavailable ? "Couldn't be analysed" : athlete.last_session ? "Nothing needs a look" : "No sessions logged in the last 8 weeks"}</span>}</td>
                    <td data-label="Sessions">{show((athlete.adherence as JsonRecord | undefined)?.latest_pct, "%")}</td>
                    <td data-label="Load vs usual" className={ratio === null ? "" : ratio > 1.5 || ratio < 0.8 ? "is-alert-text" : ratio > 1.3 ? "is-watch-text" : ""}>{ratio === null ? "–" : `${ratio}×`}</td>
                    <td data-label="Readiness" className={z === null ? "" : z <= -1.5 ? "is-alert-text" : z <= -1 ? "is-watch-text" : ""}>{z === null ? "–" : z > -1 ? "Normal" : "Low"}</td>
                    <td data-label="Main lifts">{rows(athlete.strength).map((lift) => `${lift.name} ${lift.status === "rising" ? "↑" : lift.status === "falling" ? "↓" : lift.status === "plateau" ? "→" : "·"}`).join(" · ") || "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <SquadEntry athletes={athletes.filter((athlete) => !athlete.unavailable).map((athlete) => ({ athlete_user_id: String(athlete.athlete_user_id), display_name: String(athlete.display_name), email: typeof athlete.email === "string" ? athlete.email : null }))} />
          <p className="muted small analysis-roster-key">Sessions: planned sessions done last week (90%+ is on track). Load vs usual: last week against their own 4-week normal - 1.0× is a normal week, 0.8-1.3× is normal. Readiness: their pre-session check-ins against their own usual.</p>
        </div>
      ) : null}
      </>}
    </div>
  );
}
