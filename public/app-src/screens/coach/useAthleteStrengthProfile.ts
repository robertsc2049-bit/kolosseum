import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import {
  loadAthleteStrengthProfile,
  loadTemplateExercises,
  saveAthleteStrengthProfile
} from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: legacy app.js's openAthleteProfile()/closeAthleteProfile() are
// the single reliable point every "open this athlete's profile" path
// funnels through - both a direct roster click and route_bootstrap.js's
// synthetic click for a deep-linked #/coach/athletes/:athlete_id URL call
// the same legacy handler (see bindCoachAthleteActions/applyEntityRoute).
// Dispatching a dedicated event there, rather than reading the generic
// kolosseum:route-change event, avoids depending on that synthetic-click
// round trip's timing for a signal this island actually needs synchronously.
const OPENED_EVENT = "kolosseum:coach-athlete-profile-opened";
const CLOSED_EVENT = "kolosseum:coach-athlete-profile-closed";

// DEV NOTE: reverse bridge so legacy's still-rendered assignment-eligibility
// and athlete-detail-history sub-panels (siblings within the same
// #athleteProfilePanel, not part of this slice) learn about a React-driven
// save - mirrors ProfileForm.tsx's kolosseum:account-identity-updated.
export const PROFILE_UPDATED_EVENT = "kolosseum:coach-athlete-profile-updated";

function dispatchProfileUpdated(athleteUserId: string, profile: JsonRecord) {
  document.dispatchEvent(
    new CustomEvent(PROFILE_UPDATED_EVENT, { detail: { athlete_user_id: athleteUserId, profile } })
  );
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export type AthleteStrengthProfileState = {
  loading: boolean;
  error: string | null;
  profile: JsonRecord | null;
  exercises: JsonRecord[];
  csrfToken: string;
};

const initialState: AthleteStrengthProfileState = {
  loading: true,
  error: null,
  profile: null,
  exercises: [],
  csrfToken: ""
};

export function useAthleteStrengthProfile() {
  const [athleteUserId, setAthleteUserId] = useState<string | null>(null);
  const [state, setState] = useState<AthleteStrengthProfileState>(initialState);

  useEffect(() => {
    function handleOpened(event: Event) {
      const detail = (event as CustomEvent).detail as { athlete_user_id?: string } | undefined;
      if (detail?.athlete_user_id) setAthleteUserId(detail.athlete_user_id);
    }

    function handleClosed() {
      setAthleteUserId(null);
    }

    document.addEventListener(OPENED_EVENT, handleOpened);
    document.addEventListener(CLOSED_EVENT, handleClosed);
    return () => {
      document.removeEventListener(OPENED_EVENT, handleOpened);
      document.removeEventListener(CLOSED_EVENT, handleClosed);
    };
  }, []);

  const refresh = useCallback(async (id: string) => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [account, profileResponse, exercises] = await Promise.all([
        loadAccountDetail(),
        loadAthleteStrengthProfile(id),
        loadTemplateExercises()
      ]);

      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      const profile = isRecord(profileResponse.profile) ? profileResponse.profile : null;

      setState({ loading: false, error: null, profile, exercises, csrfToken });
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Athlete profile could not be loaded. Check your connection and try again."
      }));
    }
  }, []);

  useEffect(() => {
    if (athleteUserId) {
      refresh(athleteUserId);
    }
    else {
      setState(initialState);
    }
  }, [athleteUserId, refresh]);

  const save = useCallback(
    async (input: JsonRecord) => {
      if (!athleteUserId) throw new Error("No athlete profile is open.");

      const response = await saveAthleteStrengthProfile(
        { ...input, athlete_user_id: athleteUserId },
        state.csrfToken
      );
      const profile = isRecord(response.profile) ? response.profile : null;
      setState((current) => ({ ...current, profile }));
      if (profile) dispatchProfileUpdated(athleteUserId, profile);
      return profile;
    },
    [athleteUserId, state.csrfToken]
  );

  return { athleteUserId, ...state, refresh: () => athleteUserId && refresh(athleteUserId), save };
}
