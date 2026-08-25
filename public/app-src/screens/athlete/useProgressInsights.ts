import { useCallback, useEffect, useState } from "react";

import { loadProgressInsights } from "../../api/athleteProgressInsightsClient";
import { loadTemplateExercises } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: FULL-UI-36 athlete's own progress insights - independently
// fetched, listens for kolosseum:history-changed (dispatched by app.js's
// refreshHistory(), which still runs this panel's data alongside the rest
// of the History view's refresh). Also fetches the public exercise catalog
// (loadTemplateExercises, from coachWorkspaceClient.ts - the endpoint isn't
// coach-specific) to resolve exercise_id -> display_name for strength
// trends: legacy's own exerciseDisplayName() read state.templateExercises,
// a coach-only cache that's always empty for an athlete account, so legacy
// silently fell back to titleCase(exerciseId) here - fetching the real
// catalog is a deliberate improvement, matching the coach-side mirror
// (AthleteProgressInsightsPanel.tsx) which already does the same fetch.
const CHANGED_EVENT = "kolosseum:history-changed";

export type ProgressInsightsState = {
  loading: boolean;
  error: string | null;
  insights: JsonRecord | null;
  exercises: JsonRecord[];
};

const initialState: ProgressInsightsState = {
  loading: true,
  error: null,
  insights: null,
  exercises: []
};

export function useProgressInsights() {
  const [state, setState] = useState<ProgressInsightsState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [insights, exercises] = await Promise.all([
        loadProgressInsights(),
        loadTemplateExercises()
      ]);
      setState({ loading: false, error: null, insights, exercises });
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Progress insights could not be loaded. Check your connection and try again."
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
