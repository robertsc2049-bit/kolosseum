import { useCallback, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { upsertCoachRelationship } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: ported from app.js's (removed) connectAthlete() - the manual,
// account-code-based relationship record ("Relationship record / Add
// athlete"), distinct from FULL-UI-24's lawful email invitation
// (useInviteAthleteByEmail.ts). Dispatches COACH_RELATIONSHIP_MUTATED_EVENT
// on success so app.js's own kept (not gutted) refreshCoachAthletes()/
// refreshCoachAssignments() - still read by the still-legacy athlete
// training-profile panel and Coach Dashboard - stay in sync, exactly as
// connectAthlete() used to refresh them itself before calling
// renderCoachWorkspace()/renderCoachDashboard(). See
// useAthleteRelationshipDetail.ts for the sibling event listener wiring.
export const COACH_RELATIONSHIP_MUTATED_EVENT = "kolosseum:coach-relationship-mutated";

function createRelationshipId(): string {
  const id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `relationship_${id.replaceAll("-", "")}`;
}

export type ConnectAthleteState = {
  submitting: boolean;
  error: string | null;
};

const initialState: ConnectAthleteState = {
  submitting: false,
  error: null
};

export function useConnectAthlete() {
  const [state, setState] = useState<ConnectAthleteState>(initialState);

  const connect = useCallback(async (input: {
    athleteUserId: string;
    displayName: string;
    activityId: string;
    relationshipState: "accepted" | "invited";
    expiryDate: string;
  }) => {
    setState({ submitting: true, error: null });
    try {
      const account = await loadAccountDetail();
      const coachUserId = String((account.account as JsonRecord | undefined)?.user_id ?? "");
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      const timestamp = new Date().toISOString();
      const expiresAt = input.relationshipState === "invited" && input.expiryDate
        ? new Date(`${input.expiryDate}T23:59:59.999Z`).toISOString()
        : null;

      await upsertCoachRelationship(
        {
          relationship_id: createRelationshipId(),
          coach_user_id: coachUserId,
          athlete_user_id: input.athleteUserId,
          relationship_state: input.relationshipState,
          relationship_scope: "individual_coach_athlete",
          accepted_at_iso8601: input.relationshipState === "accepted" ? timestamp : null,
          created_at_iso8601: timestamp,
          updated_at_iso8601: timestamp,
          revoked_at_iso8601: null,
          expires_at_iso8601: expiresAt
        },
        csrfToken
      );

      setState({ submitting: false, error: null });
      document.dispatchEvent(new CustomEvent(COACH_RELATIONSHIP_MUTATED_EVENT));
      return true;
    }
    catch {
      setState({ submitting: false, error: "The relationship record could not be saved." });
      return false;
    }
  }, []);

  return { ...state, connect };
}
