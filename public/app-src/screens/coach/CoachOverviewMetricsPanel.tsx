import React from "react";

import { CoachOrgHandoverCard } from "./CoachOrgHandoverCard";
import { useCoachOverviewMetrics } from "./useCoachOverviewMetrics";

// DEV NOTE: see useCoachOverviewMetrics.ts. Field labels/order match the
// legacy metric-cards grid exactly, including the "Awaiting review" label
// for what was legacy's coachCompletedSessionCount id.

export function CoachOverviewMetricsPanel() {
  const { athleteCount, assignmentCount, artefactCount, openSessionCount, awaitingReviewCount, upcomingEventCount } = useCoachOverviewMetrics();

  return (
    <>
      <CoachOrgHandoverCard />
      <article className="panel metric-card" data-zero={athleteCount === 0}>
        <span>Connected athletes</span>
        <strong>{athleteCount}</strong>
      </article>

      <article className="panel metric-card" data-zero={assignmentCount === 0}>
        <span>Programmes assigned</span>
        <strong>{assignmentCount}</strong>
      </article>

      <article className="panel metric-card" data-zero={artefactCount === 0}>
        <span>Sessions logged</span>
        <strong>{artefactCount}</strong>
      </article>

      <article className="panel metric-card" data-zero={openSessionCount === 0}>
        <span>Open sessions</span>
        <strong>{openSessionCount}</strong>
      </article>

      <article className="panel metric-card" data-zero={awaitingReviewCount === 0}>
        <span>Awaiting review</span>
        <strong>{awaitingReviewCount}</strong>
      </article>

      <article className="panel metric-card" data-zero={upcomingEventCount === 0}>
        <span>Upcoming events</span>
        <strong>{upcomingEventCount}</strong>
      </article>
    </>
  );
}
