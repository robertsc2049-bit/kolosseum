import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { loadCoachAssignments, loadCoachRelationships } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: whole-workspace read for the Coach Overview dashboard's
// "Action queue" panel (part of FULL-UI-03) - ported from app.js's
// (removed) renderCoachDashboard() assignment-queue block and
// dashboardAssignmentAthleteId(). Refetches on mount and whenever legacy
// dispatches kolosseum:coach-overview-changed, same as
// useCoachOverviewEvents.ts. "Connected athletes"/"Open sessions"/
// "Completed since review" stay legacy for now - Connected athletes needs
// per-athlete strength-profile lookups (a third data source this slice
// doesn't otherwise touch), and Open sessions/Review queue need the much
// heavier per-athlete POST /sessions/beta-coach-artefacts fan-out.
const CHANGED_EVENT = "kolosseum:coach-overview-changed";

export type CoachOverviewAssignmentsState = {
  loading: boolean;
  error: string | null;
  unassignedAthletes: JsonRecord[];
  totalConnectedAthletes: number;
};

const initialState: CoachOverviewAssignmentsState = {
  loading: true,
  error: null,
  unassignedAthletes: [],
  totalConnectedAthletes: 0
};

function assignmentAthleteId(assignment: JsonRecord): string {
  return String(assignment.athleteUserId ?? assignment.athlete_user_id ?? assignment.assigned_athlete_id ?? "");
}

export function useCoachOverviewAssignments() {
  const [state, setState] = useState<CoachOverviewAssignmentsState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const account = await loadAccountDetail();
      const coachUserId = String((account.account as JsonRecord | undefined)?.user_id ?? "");
      const [relationships, assignments] = await Promise.all([
        loadCoachRelationships(coachUserId),
        loadCoachAssignments(coachUserId)
      ]);

      const connectedAthletes = relationships.filter(
        (entry) => String(entry.relationship_state ?? "") === "accepted" && entry.relationship_expired !== true
      );
      const assignedAthleteIds = new Set(assignments.map(assignmentAthleteId).filter(Boolean));
      const unassignedAthletes = connectedAthletes.filter(
        (athlete) => !assignedAthleteIds.has(String(athlete.athlete_user_id ?? ""))
      );

      setState({
        loading: false,
        error: null,
        unassignedAthletes,
        totalConnectedAthletes: connectedAthletes.length
      });
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "The assignment action queue could not be loaded. Check your connection and try again."
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
