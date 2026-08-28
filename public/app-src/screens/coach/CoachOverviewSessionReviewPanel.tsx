import React from "react";

import { type JsonRecord } from "../../api/transport";
import { formatDate, titleCase } from "../../utils/format";
import { useCoachOverviewSessionReview } from "./useCoachOverviewSessionReview";

// DEV NOTE: part of FULL-UI-03's Coach Overview dashboard - ported from
// app.js's (removed) renderCoachDashboard() open-sessions/review-queue
// rendering blocks. See useCoachOverviewSessionReview.ts's DEV NOTE for
// the data-source simplification and why "Connected athletes" stays
// legacy. Both "Open live status" and "Review record" buttons dispatch
// the same kolosseum:open-session-review event the dashboard's removed
// dashboard-action branch used to (app.js's own listener for that event
// still owns the setView("review") navigation).
function openReview(athleteUserId: string) {
  document.dispatchEvent(
    new CustomEvent("kolosseum:open-session-review", { detail: { athlete_user_id: athleteUserId } })
  );
}

function SessionCard({ record, athleteName, badgeClass, buttonLabel }: {
  record: JsonRecord;
  athleteName: string;
  badgeClass: string;
  buttonLabel: string;
}) {
  const athleteUserId = String(record.athlete_user_id ?? "");
  return (
    <article className="record-card dashboard-record-card">
      <div>
        <h4>{athleteName}</h4>
        <p>
          {titleCase(String(record.session_status ?? "recorded"))} · {Number(record.runtime_event_count ?? 0)} recorded events
        </p>
      </div>
      <div className="record-meta">
        <span className={`badge ${badgeClass}`}>{formatDate(record.updated_at ?? record.created_at)}</span>
        <button className="button secondary small-button" type="button" onClick={() => openReview(athleteUserId)}>
          {buttonLabel}
        </button>
      </div>
    </article>
  );
}

export function CoachOverviewOpenSessionsPanel() {
  const { loading, error, openSessions, athleteNamesById } = useCoachOverviewSessionReview();

  if (loading && openSessions.length === 0) {
    return <p className="muted small">Loading open sessions…</p>;
  }

  if (error) {
    return <p role="status" className="muted small error">{error}</p>;
  }

  if (openSessions.length === 0) {
    return (
      <div className="empty-state dashboard-empty-state">
        <h4>No open sessions</h4>
        <p>No connected athlete currently has an open recorded session.</p>
      </div>
    );
  }

  return (
    <>
      {openSessions.slice(0, 8).map((record, index) => {
        const athleteUserId = String(record.athlete_user_id ?? "");
        return (
          <SessionCard
            key={String(record.artefact_id ?? record.session_id ?? index)}
            record={record}
            athleteName={athleteNamesById[athleteUserId] ?? "Connected athlete"}
            badgeClass="neutral"
            buttonLabel="Open live status"
          />
        );
      })}
    </>
  );
}

export function CoachOverviewReviewQueuePanel() {
  const { loading, error, awaitingReview, athleteNamesById } = useCoachOverviewSessionReview();

  if (loading && awaitingReview.length === 0) {
    return <p className="muted small">Loading completed sessions…</p>;
  }

  if (error) {
    return <p role="status" className="muted small error">{error}</p>;
  }

  if (awaitingReview.length === 0) {
    return (
      <div className="empty-state dashboard-empty-state">
        <h4>No completed session records</h4>
        <p>Completed athlete sessions will appear here when factual artefacts are available.</p>
      </div>
    );
  }

  return (
    <>
      {awaitingReview.slice(0, 8).map((record, index) => {
        const athleteUserId = String(record.athlete_user_id ?? "");
        return (
          <SessionCard
            key={String(record.artefact_id ?? record.session_id ?? index)}
            record={record}
            athleteName={athleteNamesById[athleteUserId] ?? "Connected athlete"}
            badgeClass="complete"
            buttonLabel="Review record"
          />
        );
      })}
    </>
  );
}
