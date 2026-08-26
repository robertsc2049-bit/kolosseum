import { useCallback, useEffect, useState } from "react";

import { loadCoachBrandPreference, saveCoachBrandPreference } from "../../api/coachBrandingClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: FULL-UI-65 coach branding - ported from coach_branding_ui.js's
// refreshBranding()/saveBranding(). Fetches on mount only, since this
// mounts inside the shared #view-account section for both actors and the
// panel itself decides (via isCoach) whether to render anything.
const DEFAULT_BRAND_COLOR = "#d2a952";

const ERROR_MESSAGES: Record<string, string> = {
  coach_branding_coach_brand_color_invalid: "Choose a valid colour.",
  coach_branding_coach_brand_tagline_too_long: "Tagline must be 120 characters or fewer.",
  account_session_missing: "Sign in to edit branding.",
  account_session_invalid: "The sign-in session has expired."
};

function errorMessage(error: unknown): string {
  const payload = error instanceof Error ? (error as Error & { payload?: unknown }).payload : undefined;
  const code = typeof (payload as JsonRecord | undefined)?.error === "string"
    ? String((payload as JsonRecord).error)
    : (error instanceof Error ? error.message : "coach_branding_request_failed");
  return ERROR_MESSAGES[code] ?? "Branding could not be saved.";
}

export type AccountBrandingState = {
  brandColor: string;
  brandTagline: string;
  statusMessage: string | null;
  statusTone: "neutral" | "success" | "error";
  saving: boolean;
};

const initialState: AccountBrandingState = {
  brandColor: DEFAULT_BRAND_COLOR,
  brandTagline: "",
  statusMessage: null,
  statusTone: "neutral",
  saving: false
};

export function useAccountBranding() {
  const [state, setState] = useState<AccountBrandingState>(initialState);

  const refreshBranding = useCallback(async () => {
    try {
      const payload = await loadCoachBrandPreference();
      const preference = payload.brand_preference as JsonRecord | null;
      setState((current) => ({
        ...current,
        brandColor: (preference && typeof preference.brand_color === "string" && preference.brand_color) || DEFAULT_BRAND_COLOR,
        brandTagline: (preference && typeof preference.brand_tagline === "string" && preference.brand_tagline) || ""
      }));
    }
    catch (error) {
      setState((current) => ({ ...current, statusMessage: errorMessage(error), statusTone: "error" }));
    }
  }, []);

  const setBrandColor = useCallback((brandColor: string) => {
    setState((current) => ({ ...current, brandColor }));
  }, []);

  const setBrandTagline = useCallback((brandTagline: string) => {
    setState((current) => ({ ...current, brandTagline }));
  }, []);

  const saveBranding = useCallback(async () => {
    setState((current) => ({ ...current, saving: true }));
    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      await saveCoachBrandPreference(
        {
          brand_color: state.brandColor.trim() || DEFAULT_BRAND_COLOR,
          brand_tagline: state.brandTagline.trim() || undefined
        },
        csrfToken
      );
      setState((current) => ({ ...current, saving: false, statusMessage: "Branding saved.", statusTone: "success" }));
    }
    catch (error) {
      setState((current) => ({ ...current, saving: false, statusMessage: errorMessage(error), statusTone: "error" }));
    }
  }, [state.brandColor, state.brandTagline]);

  useEffect(() => {
    refreshBranding();
  }, [refreshBranding]);

  return {
    ...state,
    setBrandColor,
    setBrandTagline,
    saveBranding
  };
}
