import React from "react";

import { useCoachOverviewMetrics } from "./useCoachOverviewMetrics";

// DEV NOTE: see useCoachOverviewMetrics.ts. Field labels/order match the
// legacy metric-cards grid exactly, including the "Awaiting review" label
// for what was legacy's coachCompletedSessionCount id.

export function CoachOverviewMetricsPanel() {
  const { athleteCount, assignmentCount, artefactCount, openSessionCount, awaitingReviewCount, upcomingEventCount } = useCoachOverviewMetrics();

  return (
    <>
      <article className="panel metric-card">
        <span>Connected athletes</span>
        <strong>{athleteCount}</strong>
      </article>

      <article className="panel metric-card">
        <span>Assignments recorded</span>
        <strong>{assignmentCount}</strong>
      </article>

      <article className="panel metric-card">
        <span>Session records</span>
        <strong>{artefactCount}</strong>
      </article>

      <article className="panel metric-card">
        <span>Open sessions</span>
        <strong>{openSessionCount}</strong>
      </article>

      <article className="panel metric-card">
        <span>Awaiting review</span>
        <strong>{awaitingReviewCount}</strong>
      </article>

      <article className="panel metric-card">
        <span>Upcoming events</span>
        <strong>{upcomingEventCount}</strong>
      </article>
    </>
  );
}
