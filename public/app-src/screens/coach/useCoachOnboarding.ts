import { useCallback, useEffect, useRef, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import {
  acceptCoachOnboardingTerms,
  completeCoachOnboarding,
  loadCoachOnboardingState,
  saveCoachOnboardingAccessibilityPreferences,
  saveCoachOnboardingProfile
} from "../../api/coachOnboardingClient";
import { ApiRequestError, type JsonRecord } from "../../api/transport";
import { ENTRY_AUTH_SUCCEEDED_EVENT } from "../entry/useEntryAuth";
import { applyAccessibilityPreferences } from "../../utils/accessibilityPreferences";

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
  unavailableError: ApiRequestError | null;
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
  // Guards against a stale response overwriting a newer one: this panel is
  // one of several always-mounted regardless of route, so refresh() can be
  // called again (on ENTRY_AUTH_SUCCEEDED_EVENT below) while the very first,
  // mounted-before-sign-in call is still in flight. Only the most recently
  // *started* call is ever allowed to update state, so a stale 401 arriving
  // after a real 200 already succeeded can never clobber it back to an
  // error state.
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setState((current) => ({ ...current, loading: true, unavailableError: null }));
    try {
      const serverState = await loadCoachOnboardingState();
      if (requestIdRef.current !== requestId) return;
      applyAccessibilityPreferences(serverState.accessibility_preferences);
      setState({ loading: false, unavailableError: null, serverState, busy: false, validationError: null });
    }
    catch (error) {
      if (requestIdRef.current !== requestId) return;
      setState((current) => ({
        ...current,
        loading: false,
        unavailableError: error instanceof ApiRequestError ? error : new ApiRequestError("coach_onboarding_request_failed", 0, null)
      }));
    }
  }, []);

  useEffect(() => {
    refresh();
    // This panel mounts unconditionally on script load, regardless of
    // whether the person is signed in yet - a fresh sign-up/sign-in
    // completing later needs to trigger a real refetch, since nothing else
    // ever tells this hook that auth state just changed.
    document.addEventListener(ENTRY_AUTH_SUCCEEDED_EVENT, refresh);
    return () => {
      document.removeEventListener(ENTRY_AUTH_SUCCEEDED_EVENT, refresh);
    };
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

  const saveAccessibilityPreferences = useCallback(async (input: JsonRecord): Promise<JsonRecord | null> => {
    if (state.busy) return null;
    setState((current) => ({ ...current, busy: true, validationError: null }));
    try {
      const token = await csrfToken();
      const serverState = await saveCoachOnboardingAccessibilityPreferences(input, token);
      applyAccessibilityPreferences(serverState.accessibility_preferences);
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

  return { ...state, refresh, saveProfile, acceptTerms, saveAccessibilityPreferences, complete };
}
