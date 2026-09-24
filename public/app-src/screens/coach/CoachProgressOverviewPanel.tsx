import React from "react";

import { LineChart } from "../../components/LineChart";
import { type JsonRecord } from "../../api/transport";
import { useCoachProgressOverview } from "./useCoachProgressOverview";

// DEV NOTE: progress graphs slice 3 - a roster-wide overview of every
// athlete the coach has an accepted relationship with, one compact
// session-adherence chart per athlete (the one metric every athlete has
// data for). Click-through reuses the exact same kolosseum:open-athlete-
// profile-request bridge AthleteDirectoryPanel.tsx's "Open profile"
// button already dispatches, landing on that athlete's own full
// AthleteProgressInsightsPanel.tsx (slice 2) for the other 3 metrics.

function requestOpenProfile(athleteUserId: string) {
  document.dispatchEvent(
    new CustomEvent("kolosseum:open-athlete-profile-request", { detail: { athlete_user_id: athleteUserId } })
  );
}

function adherenceSeriesPoints(insights: JsonRecord | null): { date: string; value: number }[] {
  const adherence = insights?.session_adherence as JsonRecord | undefined;
  const series = Array.isArray(adherence?.series) ? (adherence!.series as JsonRecord[]) : [];
  return series
    .filter((window) => window.adherence_percentage !== null)
    .map((window) => ({ date: String(window.window_end_date ?? ""), value: Number(window.adherence_percentage) }));
}

function AthleteProgressCard({ entry }: { entry: JsonRecord }) {
  const athleteUserId = String(entry.athlete_user_id);
  const displayName = String(entry.display_name ?? athleteUserId);
  const insights = (entry.insights ?? null) as JsonRecord | null;

  return (
    <article className="record-card">
      <div className="record-meta">
        <span className="badge neutral">{insights ? "Adherence" : "Unavailable"}</span>
      </div>
      <strong>{displayName}</strong>
      <LineChart
        compact
        series={[{ id: "adherence", label: "Adherence %", points: adherenceSeriesPoints(insights) }]}
        emptyLabel={insights ? "Not enough sessions to chart yet." : "Progress could not be loaded for this athlete."}
      />
      <button
        className="button secondary small-button open-athlete-profile"
        type="button"
        onClick={() => requestOpenProfile(athleteUserId)}
      >
        Open profile
      </button>
    </article>
  );
}

export function CoachProgressOverviewPanel() {
  const { loading, error, roster, retry } = useCoachProgressOverview();

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Progress</p>
          <h3>Athlete progress overview</h3>
          <p className="muted">Adherence over time for every athlete you have an accepted connection with. Open an athlete's profile for their full strength, habit and body-metric trends.</p>
        </div>
      </div>

      {loading && roster.length === 0 ? (
        <p className="dashboard-status" role="status" aria-live="polite">Loading athlete progress…</p>
      ) : error ? (
        <div className="dashboard-status error" role="status" aria-live="polite">
          <span>{error}</span>
          <button className="button secondary status-retry-button" type="button" onClick={() => retry()}>Retry</button>
        </div>
      ) : roster.length === 0 ? (
        <div className="empty-state">
          <p>No connected athletes yet. Progress will appear here once an athlete accepts your connection.</p>
        </div>
      ) : (
        <div className="record-list">
          {roster.map((entry) => (
            <AthleteProgressCard key={String(entry.athlete_user_id)} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
