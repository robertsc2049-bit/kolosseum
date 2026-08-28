import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { loadAthleteStrengthProfile, loadCoachAssignments, loadCoachRelationships } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";
// DEV NOTE: reused verbatim rather than re-derived - the same canonical
// current-strength-reference count the backend computes, exactly as
// AthleteStrengthProfilePanel.tsx/useAthleteProfileAssignment.ts already
// reuse from this module. Re-deriving app.js's (removed)
// currentProfileBenchmarks() by hand would risk silently drifting from
// that law over time.
// eslint-disable-next-line import/no-unresolved
import { projectStrengthReferenceLifecycle } from "../../../../shared/strength-reference/strengthReferenceLifecycle.mjs";

// DEV NOTE: whole-workspace read for the Coach Overview dashboard's
// "Connected athletes" panel (part of FULL-UI-03) - ported from app.js's
// (removed) renderCoachDashboard()/renderCoachWorkspace() connected-
// athletes rendering and coachAthleteCard()/profileForAthlete()/
// currentProfileBenchmarks(). Unlike the other three dashboard panels
// already migrated (Assignments/Open sessions/Review queue), this one
// needs a third data source - one GET /coach-workspace/athlete-strength-
// profile per displayed athlete (no bulk endpoint exists; confirmed via
// src/api/coach_workspace.routes.ts) - which is why it stayed legacy
// through those three earlier slices. Capped at the same 6 athletes
// legacy displayed, so the fan-out is bounded. Refetches on mount and
// whenever legacy dispatches kolosseum:coach-overview-changed - both
// renderCoachDashboard() and renderCoachWorkspace() dispatch it now (the
// latter runs after a relationship mutation and after an athlete
// strength-profile save, either of which can change what this panel
// shows).
const CHANGED_EVENT = "kolosseum:coach-overview-changed";
const DISPLAY_LIMIT = 6;

export type CoachOverviewAthleteEntry = {
  athleteUserId: string;
  displayName: string;
  activityId: string;
  assignmentCount: number;
  hasProfile: boolean;
  referenceCount: number;
};

export type CoachOverviewAthletesState = {
  loading: boolean;
  error: string | null;
  athletes: CoachOverviewAthleteEntry[];
  pendingInvitationCount: number;
};

const initialState: CoachOverviewAthletesState = {
  loading: true,
  error: null,
  athletes: [],
  pendingInvitationCount: 0
};

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function useCoachOverviewAthletes() {
  const [state, setState] = useState<CoachOverviewAthletesState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const account = await loadAccountDetail();
      const coachUserId = String((account.account as JsonRecord | undefined)?.user_id ?? "");
      const [relationships, assignments] = await Promise.all([
        loadCoachRelationships(coachUserId),
        loadCoachAssignments(coachUserId)
      ]);

      const connected = relationships.filter(
        (entry) => String(entry.relationship_state ?? "") === "accepted" && entry.relationship_expired !== true
      );
      const pendingInvitationCount = relationships.filter(
        (entry) => String(entry.relationship_state ?? "") === "invited" && entry.relationship_expired !== true
      ).length;

      const displayed = connected.slice(0, DISPLAY_LIMIT);

      const athletes = await Promise.all(
        displayed.map(async (athlete) => {
          const athleteUserId = String(athlete.athlete_user_id ?? "");
          const assignmentCount = assignments.filter(
            (assignment) => String(assignment.athleteUserId ?? assignment.athlete_user_id ?? assignment.assigned_athlete_id ?? "") === athleteUserId
          ).length;

          let hasProfile = false;
          let referenceCount = 0;
          try {
            const response = await loadAthleteStrengthProfile(athleteUserId);
            if (isRecord(response.profile)) {
              hasProfile = true;
              const lifecycle = projectStrengthReferenceLifecycle(response.profile) as { current_count: number };
              referenceCount = Number(lifecycle?.current_count ?? 0);
            }
          }
          catch {
            hasProfile = false;
          }

          return {
            athleteUserId,
            displayName: String(athlete.display_name ?? athleteUserId),
            activityId: String(athlete.activity_id ?? "powerlifting"),
            assignmentCount,
            hasProfile,
            referenceCount
          };
        })
      );

      setState({ loading: false, error: null, athletes, pendingInvitationCount });
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Connected athletes could not be loaded. Check your connection and try again."
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
