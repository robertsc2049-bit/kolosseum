import { useCallback, useEffect, useState } from "react";

import { loadAthleteCoachNotes } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: reuses the same open/close bridge every coach_athlete_detail
// sub-panel listens to (see useAthleteStrengthProfile.ts's DEV NOTE).
const OPENED_EVENT = "kolosseum:coach-athlete-profile-opened";
const CLOSED_EVENT = "kolosseum:coach-athlete-profile-closed";

export type AthleteCoachNotesState = {
  loading: boolean;
  error: string | null;
  notes: JsonRecord[];
};

const initialState: AthleteCoachNotesState = {
  loading: true,
  error: null,
  notes: []
};

export function useAthleteCoachNotes() {
  const [athleteUserId, setAthleteUserId] = useState<string | null>(null);
  const [state, setState] = useState<AthleteCoachNotesState>(initialState);

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
      const notes = await loadAthleteCoachNotes(id);
      setState({ loading: false, error: null, notes });
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Coach notes could not be loaded. Check your connection and try again."
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
