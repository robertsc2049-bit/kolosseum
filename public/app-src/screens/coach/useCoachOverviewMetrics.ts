import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { loadCoachAssignments, loadCoachEventsList, loadCoachRelationships, loadCoachReviews } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: FULL-UI-03 Coach Overview dashboard metric strip - ported from
// app.js's (removed) renderCoachDashboard() metric-writing block
// (coachAthleteCount/coachAssignmentCount/coachArtefactCount/
// coachOpenSessionCount/coachCompletedSessionCount/
// coachUpcomingEventCount). This is the last still-legacy piece of the
// dashboard - it was deferred across all five card migrations because it
// needed all four of their independent data sources at once
// (relationships, assignments, reviews, events), disproportionately more
// than any single card's own slice touched. Now that all five cards are
// React, this hook just re-fetches the same four endpoints they already
// use and derives the six counts, matching each card's own counting logic
// exactly (see useCoachOverviewAthletes.ts/useCoachOverviewAssignments.ts/
// useCoachOverviewSessionReview.ts/useCoachOverviewEvents.ts for the
// precedents this mirrors). Refetches on mount and on
// kolosseum:coach-overview-changed, same as every other dashboard hook.
const CHANGED_EVENT = "kolosseum:coach-overview-changed";

export type CoachOverviewMetricsState = {
  loading: boolean;
  athleteCount: number;
  assignmentCount: number;
  artefactCount: number;
  openSessionCount: number;
  awaitingReviewCount: number;
  upcomingEventCount: number;
};

const initialState: CoachOverviewMetricsState = {
  loading: true,
  athleteCount: 0,
  assignmentCount: 0,
  artefactCount: 0,
  openSessionCount: 0,
  awaitingReviewCount: 0,
  upcomingEventCount: 0
};

function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

function eventDateOf(eventRecord: JsonRecord): string {
  const plan = eventRecord.event_plan && typeof eventRecord.event_plan === "object" ? (eventRecord.event_plan as JsonRecord) : null;
  return String(plan?.event_date ?? eventRecord.event_date ?? "");
}

export function useCoachOverviewMetrics() {
  const [state, setState] = useState<CoachOverviewMetricsState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));
    try {
      const account = await loadAccountDetail();
      const coachUserId = String((account.account as JsonRecord | undefined)?.user_id ?? "");
      const [relationships, assignments, reviews, events] = await Promise.all([
        loadCoachRelationships(coachUserId),
        loadCoachAssignments(coachUserId),
        loadCoachReviews(coachUserId),
        loadCoachEventsList(coachUserId)
      ]);

      const athleteCount = relationships.filter(
        (entry) => String(entry.relationship_state ?? "") === "accepted" && entry.relationship_expired !== true
      ).length;

      const today = todayDateOnly();
      const upcomingEventCount = events.filter((eventRecord) => {
        const eventDate = eventDateOf(eventRecord);
        return eventDate && eventDate >= today;
      }).length;

      setState({
        loading: false,
        athleteCount,
        assignmentCount: assignments.length,
        artefactCount: reviews.length,
        openSessionCount: reviews.filter((record) => String(record.review_status ?? "") === "open").length,
        awaitingReviewCount: reviews.filter((record) => record.awaiting_review === true).length,
        upcomingEventCount
      });
    }
    catch {
      setState((current) => ({ ...current, loading: false }));
    }
  }, []);

  useEffect(() => {
    refresh();
    document.addEventListener(CHANGED_EVENT, refresh);
    return () => {
      document.removeEventListener(CHANGED_EVENT, refresh);
    };
  }, [refresh]);

  return state;
}
