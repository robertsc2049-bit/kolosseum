import React, { useEffect, useState } from "react";

import { loadCoachOrgMemberships } from "../../api/accountRelationshipsClient";
import { request, type JsonRecord } from "../../api/transport";
import { TrendChart } from "../../components/TrendChart";
import { Explain } from "./analysisGuide";
import { FindingList, type Finding } from "./FindingList";

// A coach's team view on the Analysis page: every athlete in a team org
// they coach in, summed up as a team, by position and by coach, then athlete
// by athlete - the coach's own athletes open in full; a teammate's pain is
// only ever a flag (the detail stays with their own coach).

const rows = (value: unknown) => (Array.isArray(value) ? (value as JsonRecord[]) : []);
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const show = (value: unknown, suffix = "") => (num(value) === null ? "–" : `${num(value)}${suffix}`);

export type TeamOption = { org_id: string; org_name: string };

// The team orgs the coach is an active member of (shared visibility only -
// a gym's coaches each keep their own athletes private).
export function useCoachTeams(): TeamOption[] {
  const [teams, setTeams] = useState<TeamOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    loadCoachOrgMemberships()
      .then((memberships) => {
        if (cancelled) return;
        setTeams(memberships
          .filter((m) => m.membership_status === "active" && m.visibility_mode === "shared")
          .map((m) => ({ org_id: String(m.org_id), org_name: String(m.org_name ?? "Team") })));
      })
      .catch(() => { if (!cancelled) setTeams([]); });
    return () => { cancelled = true; };
  }, []);
  return teams;
}

function statusLabel(row: JsonRecord): { label: string; level: string } {
  if (row.unavailable) return { label: "No data", level: "info" };
  const attention = Number(row.attention ?? 0);
  if (!row.last_session && attention === 0) return { label: "No training yet", level: "info" };
  if (attention >= 3) return { label: "Needs a look", level: "alert" };
  if (attention >= 1) return { label: "Keep an eye on", level: "watch" };
  return { label: "On track", level: "good" };
}

// A position or coach group in one table row.
function GroupTable({ title, groups, testId }: { title: string; groups: JsonRecord[]; testId: string }) {
  if (groups.length < 2) return null;
  return (
    <section className="panel analysis-section" data-testid={testId}>
      <h3>{title}</h3>
      <div className="analysis-table-wrap">
        <table className="analysis-table">
          <thead><tr><th>Group</th><th>Athletes</th><th>Need a look</th><th>Sessions done</th><th>Load vs usual</th><th>Low readiness</th><th>What stands out</th></tr></thead>
          <tbody>
            {groups.map((group) => {
              const summary = (group.summary ?? {}) as JsonRecord;
              const top = (rows(group.findings) as unknown as Finding[]).find((f) => f.level === "alert" || f.level === "watch");
              return (
                <tr key={String(group.key)}>
                  <td>{String(group.label)}</td>
                  <td>{show(group.athletes)}</td>
                  <td>{group.withheld ? "–" : show((summary.status as JsonRecord | undefined)?.needs_a_look)}</td>
                  <td>{show((summary.adherence as JsonRecord | undefined)?.average_pct, "%")}</td>
                  <td>{num((summary.load as JsonRecord | undefined)?.average_ratio) === null ? "–" : `${(summary.load as JsonRecord).average_ratio}×`}</td>
                  <td>{show((summary.readiness as JsonRecord | undefined)?.low)}</td>
                  <td className="small">{group.withheld ? "Too few athletes to show" : top ? top.text : "Nothing stands out"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function TeamAnalysis({ team, onOpenAthlete }: { team: TeamOption; onOpenAthlete: (athleteUserId: string) => void }) {
  const [data, setData] = useState<JsonRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    request("GET", `/coach-workspace/organisations/${encodeURIComponent(team.org_id)}/team-analysis`)
      .then((result) => { if (!cancelled) setData(result); })
      .catch(() => { if (!cancelled) setError("The team's analysis could not be loaded. Try again."); });
    return () => { cancelled = true; };
  }, [team.org_id]);

  if (error) return <p className="field-error" role="alert">{error}</p>;
  if (!data) return <p className="muted">Working out the team's patterns…</p>;
  const summary = (data.summary ?? {}) as JsonRecord;
  const status = (summary.status ?? {}) as JsonRecord;
  const adherence = (summary.adherence ?? {}) as JsonRecord;
  const load = (summary.load ?? {}) as JsonRecord;
  const readiness = (summary.readiness ?? {}) as JsonRecord;
  const pain = (summary.pain ?? {}) as JsonRecord;
  const lifts = (summary.lifts ?? {}) as JsonRecord;
  const weekly = rows(summary.weekly);
  const weeks = weekly.map((week) => String(week.week_start));
  const athletes = rows(data.athletes);

  return (
    <div className="analysis-team" data-testid="team-analysis">
      <section className="analysis-summary panel">
        <h3>{`${String((data.org as JsonRecord | undefined)?.org_name ?? team.org_name)}: what stands out`}</h3>
        <FindingList findings={rows(data.findings) as unknown as Finding[]} />
        <Explain id="team" />
      </section>

      <div className="report-tiles" data-testid="team-tiles">
        <div className="report-tile"><span className="report-tile-label">Athletes</span><strong>{`${show(summary.trained)} of ${show(summary.athletes)}`}</strong><span className="report-tile-usual">trained in the last 8 weeks</span></div>
        <div className="report-tile"><span className="report-tile-label">Need a look</span><strong>{show(status.needs_a_look)}</strong><span className="report-tile-usual">{`${show(status.keep_an_eye_on)} to keep an eye on`}</span></div>
        <div className="report-tile"><span className="report-tile-label">Sessions done (avg)</span><strong>{show(adherence.average_pct, "%")}</strong><span className="report-tile-usual">On track: 90%+</span></div>
        <div className="report-tile"><span className="report-tile-label">Load vs usual (avg)</span><strong>{num(load.average_ratio) === null ? "–" : `${load.average_ratio}×`}</strong><span className="report-tile-usual">{`Normal 0.8-1.3× · ${show(load.high)} big jumps`}</span></div>
        <div className="report-tile"><span className="report-tile-label">Low readiness</span><strong>{show(readiness.low)}</strong><span className="report-tile-usual">well below their own normal</span></div>
        <div className="report-tile"><span className="report-tile-label">Recurring pain</span><strong>{show(pain.athletes_with_recurring_pain)}</strong><span className="report-tile-usual">details with their coach</span></div>
        <div className="report-tile"><span className="report-tile-label">Main lifts</span><strong>{`${show(lifts.rising)} ↑ · ${show(lifts.falling)} ↓`}</strong><span className="report-tile-usual">{`${show(lifts.plateau)} stalled`}</span></div>
      </div>

      {weeks.length ? (
        <section className="panel analysis-section" data-testid="team-trends">
          <h3>Week by week</h3>
          <TrendChart title="Team sessions done (average %)" weeks={weeks} unit="%" yMin={0} yMax={100} series={[{ id: "adherence", label: "Sessions done (avg)", kind: "bar", values: weekly.map((week) => num(week.adherence_pct)) }]} emptyLabel="Shows once athletes' training days are set." />
          <TrendChart title="Team load against usual (average)" weeks={weeks} band={{ from: 0.8, to: 1.3, label: "0.8-1.3×: normal" }} yMin={0} series={[{ id: "load", label: "Load vs usual (avg)", values: weekly.map((week) => num(week.load_ratio)) }]} />
        </section>
      ) : null}

      <GroupTable title="By position" groups={rows(data.by_position)} testId="team-by-position" />
      <GroupTable title="By coach" groups={rows(data.by_coach)} testId="team-by-coach" />

      <section className="panel" data-testid="team-athletes">
        <h3>Every athlete</h3>
        <div className="analysis-table-wrap">
          <table className="analysis-table analysis-roster">
            <thead><tr><th>Athlete</th><th>Status</th><th>What stands out</th><th>Position</th><th>Coach</th><th>Sessions</th><th>Load vs usual</th></tr></thead>
            <tbody>
              {athletes.map((athlete) => {
                const statusInfo = statusLabel(athlete);
                const findings = (rows(athlete.findings) as unknown as Finding[]).filter((f) => f.level === "alert" || f.level === "watch");
                const ratio = num((athlete.load as JsonRecord | undefined)?.acute_chronic);
                return (
                  <tr key={String(athlete.athlete_user_id)}>
                    <td data-label="Athlete">{athlete.yours
                      ? <button type="button" className="analysis-athlete-link" onClick={() => onOpenAthlete(String(athlete.athlete_user_id))}>{String(athlete.display_name)}</button>
                      : <span>{String(athlete.display_name)}</span>}</td>
                    <td data-label="Status"><span className={`analysis-status is-${statusInfo.level}`}>{statusInfo.label}</span></td>
                    <td data-label="What stands out" className="analysis-roster-findings">{findings.length ? <FindingList findings={findings.slice(0, 2)} compact /> : <span className="muted small">{athlete.last_session ? "Nothing needs a look" : "No sessions logged in the last 8 weeks"}</span>}</td>
                    <td data-label="Position">{athlete.position ? String(athlete.position).replaceAll("_", " ") : "–"}</td>
                    <td data-label="Coach">{athlete.yours ? "You" : String(athlete.coach_name ?? "Coach")}</td>
                    <td data-label="Sessions">{show((athlete.adherence as JsonRecord | undefined)?.latest_pct, "%")}</td>
                    <td data-label="Load vs usual">{ratio === null ? "–" : `${ratio}×`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted small analysis-roster-key">Your own athletes open in full. A teammate's detail - and any pain - stays with their own coach.</p>
      </section>
    </div>
  );
}
