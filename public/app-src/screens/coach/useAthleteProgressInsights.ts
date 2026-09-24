import { useCallback, useEffect, useState } from "react";

import { loadAthleteProgressInsights, loadTemplateExercises } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: reuses the same open/close bridge AthleteStrengthProfilePanel
// listens to (see useAthleteStrengthProfile.ts's DEV NOTE) - both panels
// need the identical "which athlete's profile is open" signal from legacy
// openAthleteProfile()/closeAthleteProfile().
const OPENED_EVENT = "kolosseum:coach-athlete-profile-opened";
const CLOSED_EVENT = "kolosseum:coach-athlete-profile-closed";

export type AthleteProgressInsightsState = {
  loading: boolean;
  error: string | null;
  insights: JsonRecord | null;
  exercises: JsonRecord[];
};

const initialState: AthleteProgressInsightsState = {
  loading: true,
  error: null,
  insights: null,
  exercises: []
};

export function useAthleteProgressInsights() {
  const [athleteUserId, setAthleteUserId] = useState<string | null>(null);
  const [state, setState] = useState<AthleteProgressInsightsState>(initialState);

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
      const [insights, exercises] = await Promise.all([
        loadAthleteProgressInsights(id),
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
    if (athleteUserId) {
      refresh(athleteUserId);
    }
    else {
      setState(initialState);
    }
  }, [athleteUserId, refresh]);

  return { athleteUserId, ...state };
}
