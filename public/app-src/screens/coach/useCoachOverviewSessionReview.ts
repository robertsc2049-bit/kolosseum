import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { loadCoachRelationships, loadCoachReviews } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: whole-workspace read for the Coach Overview dashboard's "Open
// sessions"/"Completed since review" panels (part of FULL-UI-03) - ported
// from app.js's (removed) renderCoachDashboard() open-sessions/review-queue
// rendering blocks. Unlike the removed legacy code, this fetches only
// GET /coach-workspace/reviews (the same single, richer query
// useCoachReview.ts's full Review view already relies on exclusively) -
// legacy additionally fan-out-fetched POST /sessions/beta-coach-artefacts
// per connected athlete as a fallback for when review records were empty,
// but that endpoint predates /coach-workspace/reviews and the fallback is
// never exercised in practice (reviews already covers every session, open
// or completed, for the coach). Refetches on mount and whenever legacy
// dispatches kolosseum:coach-overview-changed, same as
// useCoachOverviewEvents.ts/useCoachOverviewAssignments.ts.
// "Connected athletes" stays legacy - it needs per-athlete
// strength-profile lookups, a data source this slice doesn't otherwise
// touch.
const CHANGED_EVENT = "kolosseum:coach-overview-changed";

export type CoachOverviewSessionReviewState = {
  loading: boolean;
  error: string | null;
  openSessions: JsonRecord[];
  awaitingReview: JsonRecord[];
  athleteNamesById: Record<string, string>;
};

const initialState: CoachOverviewSessionReviewState = {
  loading: true,
  error: null,
  openSessions: [],
  awaitingReview: [],
  athleteNamesById: {}
};

function recordDate(record: JsonRecord): string {
  return String(record.updated_at ?? record.created_at ?? "");
}

export function useCoachOverviewSessionReview() {
  const [state, setState] = useState<CoachOverviewSessionReviewState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const account = await loadAccountDetail();
      const coachUserId = String((account.account as JsonRecord | undefined)?.user_id ?? "");
      const [records, relationships] = await Promise.all([
        loadCoachReviews(coachUserId),
        loadCoachRelationships(coachUserId)
      ]);

      const athleteNamesById: Record<string, string> = {};
      for (const relationship of relationships) {
        const athleteUserId = String(relationship.athlete_user_id ?? "");
        if (athleteUserId) athleteNamesById[athleteUserId] = String(relationship.display_name ?? athleteUserId);
      }

      const openSessions = records
        .filter((record) => String(record.review_status ?? "") === "open")
        .sort((left, right) => recordDate(right).localeCompare(recordDate(left)));

      const awaitingReview = records
        .filter((record) => record.awaiting_review === true)
        .sort((left, right) => recordDate(right).localeCompare(recordDate(left)));

      setState({ loading: false, error: null, openSessions, awaitingReview, athleteNamesById });
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Session and review records could not be loaded. Check your connection and try again."
      }));
    }
  }, []);

  useEffect(() => {
    refresh();
    document.addEventListener(CHANGED_EVENT, refresh);
    return () => {
      document.removeEventListener(CHANGED_EVENT, refresh);
    };
  }, [refresh]);

  return { ...state, refresh };
}
