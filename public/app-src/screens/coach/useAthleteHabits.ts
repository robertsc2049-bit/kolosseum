import { useCallback, useEffect, useState } from "react";

import { loadAthleteHabits } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: reuses the same open/close bridge every coach_athlete_detail
// sub-panel listens to (see useAthleteNutrition.ts's DEV NOTE). Read-only -
// a coach has no write path anywhere in the habit routes (enforced by
// full_ui_29_body_metrics_habits_surface.test.mjs), so no CSRF token needed.
const OPENED_EVENT = "kolosseum:coach-athlete-profile-opened";
const CLOSED_EVENT = "kolosseum:coach-athlete-profile-closed";

export type AthleteHabitsState = {
  loading: boolean;
  error: string | null;
  habits: JsonRecord[];
};

const initialState: AthleteHabitsState = {
  loading: true,
  error: null,
  habits: []
};

export function useAthleteHabits() {
  const [athleteUserId, setAthleteUserId] = useState<string | null>(null);
  const [state, setState] = useState<AthleteHabitsState>(initialState);

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
      const habits = await loadAthleteHabits(id);
      setState({ loading: false, error: null, habits });
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Habits could not be loaded. Check your connection and try again."
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
