import { useCallback, useEffect, useState } from "react";

import { loadAthleteBodyMetrics } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: nutrition entries are body_metric_entry records with a
// nutrition-flavoured metric_type (see NUTRITION_METRIC_TYPES in
// AthleteNutritionPanel.tsx) - there is no separate nutrition record type
// or route (see full_ui_29_body_metrics_habits_surface.test.mjs's
// "nutrition reuses the body-metric type registry" test), so this hook
// fetches the same GET /body-metrics/coach/:athlete_user_id endpoint
// AthleteBodyMetricsPanel.tsx independently fetches - a harmless redundant
// GET, same as every other coach mirror in this migration. Read-only, so
// no CSRF token needed.
const OPENED_EVENT = "kolosseum:coach-athlete-profile-opened";
const CLOSED_EVENT = "kolosseum:coach-athlete-profile-closed";

export type AthleteNutritionState = {
  loading: boolean;
  error: string | null;
  entries: JsonRecord[];
};

const initialState: AthleteNutritionState = {
  loading: true,
  error: null,
  entries: []
};

export function useAthleteNutrition() {
  const [athleteUserId, setAthleteUserId] = useState<string | null>(null);
  const [state, setState] = useState<AthleteNutritionState>(initialState);

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
      const entries = await loadAthleteBodyMetrics(id);
      setState({ loading: false, error: null, entries });
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Nutrition history could not be loaded. Check your connection and try again."
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

  return { athleteUserId, ...state };
}
