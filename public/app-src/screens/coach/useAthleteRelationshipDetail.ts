import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { loadCoachRelationships, upsertCoachRelationship } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";
import { COACH_RELATIONSHIP_MUTATED_EVENT } from "./useConnectAthlete";

// DEV NOTE: ported from app.js's (removed) openAthleteRelationshipDetail()/
// closeAthleteRelationshipDetail()/transitionCoachRelationship() - the
// "Relationship audit" panel. app.js's trimmed openAthleteRelationshipDetail()
// now just dispatches OPEN_REQUEST_EVENT (the existing global
// data-relationship-action='audit' click delegation - see
// AthleteDirectoryPanel.tsx's "View audit" button - still calls it
// unchanged) and hides the still-legacy athlete training-profile panel,
// mirroring the original's mutual-exclusion behaviour; its trimmed
// closeAthleteRelationshipDetail() (called from openAthleteProfile() when
// the coach opens that still-legacy profile instead) dispatches
// CLOSE_EVENT for the reverse direction.
const OPEN_REQUEST_EVENT = "kolosseum:open-relationship-audit-request";
const CLOSE_EVENT = "kolosseum:close-relationship-audit";

export type EffectiveState = "accepted" | "invited" | "expired" | "revoked" | "unknown";

function relationshipEffectiveState(entry: JsonRecord): EffectiveState {
  if (entry.relationship_expired === true) return "expired";

  const relationship = entry.relationship as JsonRecord | undefined;
  const stored = String(entry.relationship_state ?? relationship?.relationship_state ?? "unknown").toLowerCase() as EffectiveState;
  const expiresAt = String(relationship?.expires_at_iso8601 ?? "");
  if (stored === "invited" && expiresAt && Number.isFinite(Date.parse(expiresAt)) && Date.parse(expiresAt) <= Date.now()) {
    return "expired";
  }
  return stored;
}

export type AthleteRelationshipDetailState = {
  open: boolean;
  loading: boolean;
  notFound: boolean;
  athleteUserId: string;
  displayName: string;
  activityId: string;
  effectiveState: EffectiveState;
  relationship: JsonRecord;
  transitioning: boolean;
  transitionError: string | null;
};

const initialState: AthleteRelationshipDetailState = {
  open: false,
  loading: false,
  notFound: false,
  athleteUserId: "",
  displayName: "",
  activityId: "",
  effectiveState: "unknown",
  relationship: {},
  transitioning: false,
  transitionError: null
};

export function useAthleteRelationshipDetail() {
  const [state, setState] = useState<AthleteRelationshipDetailState>(initialState);

  const openFor = useCallback(async (athleteUserId: string) => {
    setState({ ...initialState, open: true, loading: true, athleteUserId });
    try {
      // coach_user_id is resolved server-side from the session - see
      // getCoachAthleteRelationships.
      const relationships = await loadCoachRelationships("");
      const entry = relationships.find((candidate) => String(candidate.athlete_user_id ?? "") === athleteUserId);

      if (!entry) {
        setState((current) => ({ ...current, loading: false, notFound: true }));
        return;
      }

      setState((current) => ({
        ...current,
        loading: false,
        notFound: false,
        displayName: String(entry.display_name ?? athleteUserId),
        activityId: String(entry.activity_id ?? "powerlifting"),
        effectiveState: relationshipEffectiveState(entry),
        relationship: (entry.relationship as JsonRecord | undefined) ?? {}
      }));
    }
    catch {
      setState((current) => ({ ...current, loading: false, notFound: true }));
    }
  }, []);

  useEffect(() => {
    function handleOpenRequest(event: Event) {
      const detail = (event as CustomEvent).detail as { athlete_user_id?: string } | undefined;
      const athleteUserId = String(detail?.athlete_user_id ?? "");
      if (athleteUserId) openFor(athleteUserId).catch(() => {});
    }
    function handleClose() {
      setState(initialState);
    }
    document.addEventListener(OPEN_REQUEST_EVENT, handleOpenRequest);
    document.addEventListener(CLOSE_EVENT, handleClose);
    return () => {
      document.removeEventListener(OPEN_REQUEST_EVENT, handleOpenRequest);
      document.removeEventListener(CLOSE_EVENT, handleClose);
    };
  }, [openFor]);

  const close = useCallback(() => {
    setState(initialState);
  }, []);

  const transition = useCallback(async (action: "revoke" | "cancel") => {
    setState((current) => ({ ...current, transitioning: true, transitionError: null }));
    try {
      const account = await loadAccountDetail();
      const coachUserId = String((account.account as JsonRecord | undefined)?.user_id ?? "");
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      const timestamp = new Date().toISOString();
      const relationship = state.relationship;

      await upsertCoachRelationship(
        {
          relationship_id: String(relationship.relationship_id ?? ""),
          coach_user_id: coachUserId,
          athlete_user_id: state.athleteUserId,
          relationship_state: "revoked",
          relationship_scope: "individual_coach_athlete",
          accepted_at_iso8601: relationship.accepted_at_iso8601 ?? null,
          created_at_iso8601: relationship.created_at_iso8601 ?? timestamp,
          updated_at_iso8601: timestamp,
          revoked_at_iso8601: timestamp,
          expires_at_iso8601: relationship.expires_at_iso8601 ?? null
        },
        csrfToken
      );

      setState(initialState);
      document.dispatchEvent(new CustomEvent(COACH_RELATIONSHIP_MUTATED_EVENT));
      return true;
    }
    catch {
      setState((current) => ({
        ...current,
        transitioning: false,
        transitionError: action === "revoke" ? "The relationship could not be revoked." : "The invitation could not be cancelled."
      }));
      return false;
    }
  }, [state.athleteUserId, state.relationship]);

  return { ...state, close, transition };
}
