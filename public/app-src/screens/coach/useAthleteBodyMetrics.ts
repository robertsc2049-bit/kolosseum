import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { loadAthleteBodyMetrics, saveAthleteBodyMetric } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: reuses the same open/close bridge every coach_athlete_detail
// sub-panel listens to (see useAthleteStrengthProfile.ts's DEV NOTE).
// Unlike the read-only mirrors, this one has a real coach write path
// (POST /body-metrics/coach/:athlete_user_id was already implemented
// server-side but had no UI form until this migration - see
// full_ui_29_body_metrics_habits_surface.test.mjs's history on this), so
// it fetches a CSRF token the same way useAthleteStrengthProfile.ts does.
// No reverse-bridge event is needed on save though: nothing else in legacy
// reads state.coachAthleteBodyMetricEntries besides the rendering this
// hook replaces.
const OPENED_EVENT = "kolosseum:coach-athlete-profile-opened";
const CLOSED_EVENT = "kolosseum:coach-athlete-profile-closed";

export type AthleteBodyMetricsState = {
  loading: boolean;
  error: string | null;
  entries: JsonRecord[];
  csrfToken: string;
};

const initialState: AthleteBodyMetricsState = {
  loading: true,
  error: null,
  entries: [],
  csrfToken: ""
};

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function useAthleteBodyMetrics() {
  const [athleteUserId, setAthleteUserId] = useState<string | null>(null);
  const [state, setState] = useState<AthleteBodyMetricsState>(initialState);

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
      const [account, entries] = await Promise.all([loadAccountDetail(), loadAthleteBodyMetrics(id)]);
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      setState({ loading: false, error: null, entries, csrfToken });
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Body-metric history could not be loaded. Check your connection and try again."
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
      const response = await saveAthleteBodyMetric(athleteUserId, input, state.csrfToken);
      const entry = isRecord(response.entry) ? response.entry : null;
      if (entry) {
        setState((current) => ({ ...current, entries: [entry, ...current.entries] }));
      }
      return entry;
    },
    [athleteUserId, state.csrfToken]
  );

  return { athleteUserId, ...state, save };
}
