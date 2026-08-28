import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import {
  acceptCoachOnboardingTerms,
  completeCoachOnboarding,
  loadCoachOnboardingState,
  saveCoachOnboardingProfile
} from "../../api/coachOnboardingClient";
import { ApiRequestError, type JsonRecord } from "../../api/transport";

// DEV NOTE: FULL-UI-04C coach onboarding profile/terms/completion - ported
// from public/app/coach_onboarding_ui.js's state machine (state/busy
// module-scope variables and saveProfile()/acceptTerms()/
// completeOnboarding()). coach_onboarding_ui.js keeps only
// resolveCoachOnboardingGate() (a separate, non-React copy of the
// GET /account/coach-onboarding call) for route_bootstrap.js's onboarding
// gate. Unlike athlete onboarding's 7-stage wizard, this whole view (status
// badge included) is one mount point, so a single per-component
// useState/useEffect hook is enough - no shared module store needed.

export type CoachOnboardingState = {
  loading: boolean;
  unavailableError: string | null;
  serverState: JsonRecord | null;
  busy: boolean;
  validationError: ApiRequestError | null;
};

const initialState: CoachOnboardingState = {
  loading: true,
  unavailableError: null,
  serverState: null,
  busy: false,
  validationError: null
};

async function csrfToken(): Promise<string> {
  const account = await loadAccountDetail();
  return typeof account.csrf_token === "string" ? account.csrf_token : "";
}

export function useCoachOnboarding() {
  const [state, setState] = useState<CoachOnboardingState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, unavailableError: null }));
    try {
      const serverState = await loadCoachOnboardingState();
      setState({ loading: false, unavailableError: null, serverState, busy: false, validationError: null });
    }
    catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        unavailableError: error instanceof Error ? error.message : "coach_onboarding_request_failed"
      }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveProfile = useCallback(async (input: JsonRecord): Promise<JsonRecord | null> => {
    if (state.busy) return null;
    setState((current) => ({ ...current, busy: true, validationError: null }));
    try {
      const token = await csrfToken();
      const serverState = await saveCoachOnboardingProfile(input, token);
      setState((current) => ({ ...current, busy: false, serverState }));
      return serverState;
    }
    catch (error) {
      setState((current) => ({
        ...current,
        busy: false,
        validationError: error instanceof ApiRequestError ? error : new ApiRequestError("coach_onboarding_request_failed", 0, null)
      }));
      return null;
    }
  }, [state.busy]);

  const acceptTerms = useCallback(async (): Promise<JsonRecord | null> => {
    if (state.busy) return null;
    setState((current) => ({ ...current, busy: true, validationError: null }));
    try {
      const token = await csrfToken();
      const termsVersion = typeof state.serverState?.current_terms_version === "string" ? state.serverState.current_terms_version : "";
      const serverState = await acceptCoachOnboardingTerms({ accepted: true, terms_version: termsVersion }, token);
      setState((current) => ({ ...current, busy: false, serverState }));
      return serverState;
    }
    catch (error) {
      setState((current) => ({
        ...current,
        busy: false,
        validationError: error instanceof ApiRequestError ? error : new ApiRequestError("coach_onboarding_request_failed", 0, null)
      }));
      return null;
    }
  }, [state.busy, state.serverState]);

  const complete = useCallback(async (): Promise<JsonRecord | null> => {
    if (state.busy) return null;
    setState((current) => ({ ...current, busy: true, validationError: null }));
    try {
      const token = await csrfToken();
      const serverState = await completeCoachOnboarding({ completion_confirmed: true }, token);
      setState((current) => ({ ...current, busy: false, serverState }));
      return serverState;
    }
    catch (error) {
      setState((current) => ({
        ...current,
        busy: false,
        validationError: error instanceof ApiRequestError ? error : new ApiRequestError("coach_onboarding_request_failed", 0, null)
      }));
      return null;
    }
  }, [state.busy]);

  return { ...state, refresh, saveProfile, acceptTerms, complete };
}
