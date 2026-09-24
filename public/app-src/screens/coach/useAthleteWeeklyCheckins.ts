import { useCallback, useEffect, useState } from "react";

import { loadAthleteWeeklyCheckins } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: reuses the same open/close bridge AthleteStrengthProfilePanel
// and AthleteProgressInsightsPanel listen to (see useAthleteStrengthProfile
// .ts's DEV NOTE) - every coach_athlete_detail sub-panel needs the identical
// "which athlete's profile is open" signal from legacy
// openAthleteProfile()/closeAthleteProfile().
const OPENED_EVENT = "kolosseum:coach-athlete-profile-opened";
const CLOSED_EVENT = "kolosseum:coach-athlete-profile-closed";

export type AthleteWeeklyCheckinsState = {
  loading: boolean;
  error: string | null;
  checkins: JsonRecord[];
};

const initialState: AthleteWeeklyCheckinsState = {
  loading: true,
  error: null,
  checkins: []
};

export function useAthleteWeeklyCheckins() {
  const [athleteUserId, setAthleteUserId] = useState<string | null>(null);
  const [state, setState] = useState<AthleteWeeklyCheckinsState>(initialState);

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
      const checkins = await loadAthleteWeeklyCheckins(id);
      setState({ loading: false, error: null, checkins });
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Weekly check-ins could not be loaded. Check your connection and try again."
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
