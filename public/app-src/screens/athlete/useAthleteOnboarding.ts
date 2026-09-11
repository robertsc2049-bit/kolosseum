import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import {
  cancelActivityChange,
  confirmAthleteOnboarding,
  loadActivityChangeState,
  loadAthleteOnboardingState,
  requestActivityChange,
  respondToActivityChangeProposal,
  saveAthleteOnboardingDraft,
  updateAthleteOnboardingPreferences
} from "../../api/athleteOnboardingClient";
import { ApiRequestError, type JsonRecord } from "../../api/transport";
import { applyAccessibilityPreferences as applySharedAccessibilityPreferences } from "../../utils/accessibilityPreferences";

// DEV NOTE: FULL-UI-03C athlete onboarding wizard/completed-declaration
// view - ported from public/app/athlete_onboarding_ui.js's state machine
// (state/draft/busy/editing module-scope variables and move()/confirm()/
// savePreferences()). route_bootstrap.js's own resolveAthleteOnboardingGate()
// (a separate, non-React copy in that file) still applies accessibility/
// instruction-density preferences on every route resolution - this hook
// applies them too, immediately after the two mutations that can change
// them (confirm/savePreferences), matching legacy exactly (same bug class
// as PR #865 - a declared preference with no downstream effect - already
// fixed once here and must not regress).
export const STAGES = [
  "activity", "execution_scope", "product_acknowledgement", "jurisdiction",
  "accessibility", "instruction_density", "review"
] as const;

export type OnboardingStage = typeof STAGES[number];

export const STAGE_TITLES: Record<OnboardingStage, string> = {
  activity: "Activity declaration",
  execution_scope: "Execution-scope declaration",
  product_acknowledgement: "Beta/product acknowledgement",
  jurisdiction: "Jurisdiction acknowledgement",
  accessibility: "Accessibility preferences",
  instruction_density: "Instruction-density preference",
  review: "Review and confirmation"
};

const RELOAD_KEY = "kolosseum.athlete_onboarding.reload_required";
const INSTRUCTION_DENSITIES = ["minimal", "standard", "detailed"];

// DEV NOTE: same effect as route_bootstrap.js's own copy (via
// athlete_onboarding_ui.js's resolveAthleteOnboardingGate()) - applied here
// too so the effect is visible immediately after a same-tab confirm/save,
// without waiting for the next route resolution. The 4 accessibility fields
// themselves are delegated to the shared public/app-src/utils/
// accessibilityPreferences.ts module (also used by coach onboarding) - this
// wrapper keeps its own name/call sites so it stays the file-local
// "declared preference has a real downstream reader" proof point.
function applyAccessibilityPreferences(fields: JsonRecord | undefined) {
  applySharedAccessibilityPreferences(fields?.accessibility_preferences);
  const root = document.documentElement;
  root.dataset.instructionDensity = INSTRUCTION_DENSITIES.includes(String(fields?.instruction_density ?? ""))
    ? String(fields?.instruction_density)
    : "standard";
}

export type AthleteOnboardingState = {
  loading: boolean;
  unavailableError: string | null;
  serverState: JsonRecord | null;
  draft: JsonRecord;
  busy: boolean;
  editing: boolean;
  validationError: ApiRequestError | null;
  activityChange: JsonRecord | null;
  activityChangeBusy: boolean;
  activityChangeError: string | null;
};

const initialState: AthleteOnboardingState = {
  loading: true,
  unavailableError: null,
  serverState: null,
  draft: {},
  busy: false,
  editing: false,
  validationError: null,
  activityChange: null,
  activityChangeBusy: false,
  activityChangeError: null
};

async function csrfToken(): Promise<string> {
  const account = await loadAccountDetail();
  return typeof account.csrf_token === "string" ? account.csrf_token : "";
}

export function useAthleteOnboarding() {
  const [state, setState] = useState<AthleteOnboardingState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, unavailableError: null }));
    try {
      const serverState = await loadAthleteOnboardingState();
      const draft = (serverState.draft as JsonRecord | undefined)?.fields
        ?? (serverState.current_effective_declaration as JsonRecord | undefined)?.fields
        ?? {};
      applyAccessibilityPreferences((serverState.current_effective_declaration as JsonRecord | undefined)?.fields as JsonRecord | undefined);

      let activityChange: JsonRecord | null = null;
      if (serverState.onboarding_status === "completed") {
        try {
          const activityChangeState = await loadActivityChangeState();
          activityChange = (activityChangeState.activity_change as JsonRecord | null | undefined) ?? null;
        }
        catch { /* non-fatal - the onboarding view itself still loaded fine */ }
      }

      setState({
        loading: false, unavailableError: null, serverState, draft: { ...draft }, busy: false,
        editing: false, validationError: null, activityChange, activityChangeBusy: false, activityChangeError: null
      });
    }
    catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        unavailableError: error instanceof Error ? error.message : "athlete_onboarding_request_failed"
      }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const currentStage = useCallback((): OnboardingStage => {
    return (state.serverState?.current_stage as OnboardingStage) || "activity";
  }, [state.serverState]);

  const move = useCallback(async (direction: 1 | -1, fields: JsonRecord) => {
    if (state.busy) return;
    const stage = currentStage();
    const index = Math.max(0, STAGES.indexOf(stage));
    const target = STAGES[Math.max(0, Math.min(STAGES.length - 1, index + direction))];
    const nextDraft = direction < 0 ? state.draft : fields;

    setState((current) => ({ ...current, busy: true, validationError: null }));
    try {
      const token = await csrfToken();
      const serverState = await saveAthleteOnboardingDraft({ current_stage: target, fields: nextDraft }, token);
      const draft = (serverState.draft as JsonRecord | undefined)?.fields ?? nextDraft;
      setState((current) => ({ ...current, busy: false, serverState, draft: { ...draft } }));
    }
    catch (error) {
      setState((current) => ({
        ...current,
        busy: false,
        validationError: error instanceof ApiRequestError ? error : new ApiRequestError("athlete_onboarding_request_failed", 0, null)
      }));
    }
  }, [state.busy, state.draft, currentStage]);

  const confirm = useCallback(async () => {
    if (state.busy) return;
    setState((current) => ({ ...current, busy: true, validationError: null }));
    try {
      const token = await csrfToken();
      const serverState = await confirmAthleteOnboarding(token);
      const fields = (serverState.current_effective_declaration as JsonRecord | undefined)?.fields as JsonRecord | undefined;
      applyAccessibilityPreferences(fields);
      sessionStorage.setItem(RELOAD_KEY, "1");
      setState((current) => ({ ...current, busy: false, serverState, draft: { ...(fields ?? {}) } }));
    }
    catch (error) {
      setState((current) => ({
        ...current,
        busy: false,
        validationError: error instanceof ApiRequestError ? error : new ApiRequestError("athlete_onboarding_request_failed", 0, null)
      }));
    }
  }, [state.busy]);

  const startEditing = useCallback(() => setState((current) => ({ ...current, editing: true })), []);
  const cancelEditing = useCallback(() => setState((current) => ({ ...current, editing: false })), []);

  const savePreferences = useCallback(async (input: JsonRecord) => {
    if (state.busy) return;
    setState((current) => ({ ...current, busy: true, validationError: null }));
    try {
      const token = await csrfToken();
      const serverState = await updateAthleteOnboardingPreferences(input, token);
      const fields = (serverState.current_effective_declaration as JsonRecord | undefined)?.fields as JsonRecord | undefined;
      applyAccessibilityPreferences(fields);
      sessionStorage.setItem(RELOAD_KEY, "1");
      setState((current) => ({ ...current, busy: false, editing: false, serverState }));
    }
    catch (error) {
      setState((current) => ({
        ...current,
        busy: false,
        validationError: error instanceof ApiRequestError ? error : new ApiRequestError("athlete_onboarding_request_failed", 0, null)
      }));
    }
  }, [state.busy]);

  const changeActivity = useCallback(async (newActivityId: string, applyAt: "immediately" | "after_current_session") => {
    if (state.activityChangeBusy) return false;
    setState((current) => ({ ...current, activityChangeBusy: true, activityChangeError: null }));
    try {
      const token = await csrfToken();
      const result = await requestActivityChange({ new_activity_id: newActivityId, apply_at: applyAt }, token);
      const requestState = String(result.request_state ?? "");
      setState((current) => ({
        ...current,
        activityChangeBusy: false,
        activityChange: requestState === "queued" ? result : null
      }));
      if (requestState === "applied") await refresh();
      return true;
    }
    catch {
      setState((current) => ({ ...current, activityChangeBusy: false, activityChangeError: "The activity change could not be requested." }));
      return false;
    }
  }, [state.activityChangeBusy, refresh]);

  const respondToProposal = useCallback(async (
    requestId: string,
    response: "confirmed" | "declined",
    applyAt?: "immediately" | "after_current_session"
  ) => {
    if (state.activityChangeBusy) return false;
    setState((current) => ({ ...current, activityChangeBusy: true, activityChangeError: null }));
    try {
      const token = await csrfToken();
      const result = await respondToActivityChangeProposal(
        { request_id: requestId, response, ...(applyAt ? { apply_at: applyAt } : {}) },
        token
      );
      const requestState = String(result.request_state ?? "");
      setState((current) => ({
        ...current,
        activityChangeBusy: false,
        activityChange: requestState === "queued" ? result : null
      }));
      if (requestState === "applied") await refresh();
      return true;
    }
    catch {
      setState((current) => ({ ...current, activityChangeBusy: false, activityChangeError: "The proposal response could not be recorded." }));
      return false;
    }
  }, [state.activityChangeBusy, refresh]);

  const cancelPendingActivityChange = useCallback(async (requestId: string) => {
    if (state.activityChangeBusy) return false;
    setState((current) => ({ ...current, activityChangeBusy: true, activityChangeError: null }));
    try {
      const token = await csrfToken();
      await cancelActivityChange(requestId, token);
      setState((current) => ({ ...current, activityChangeBusy: false, activityChange: null }));
      return true;
    }
    catch {
      setState((current) => ({ ...current, activityChangeBusy: false, activityChangeError: "The pending change could not be cancelled." }));
      return false;
    }
  }, [state.activityChangeBusy]);

  return {
    ...state, currentStage: currentStage(), refresh, move, confirm, startEditing, cancelEditing, savePreferences,
    changeActivity, respondToProposal, cancelPendingActivityChange
  };
}
