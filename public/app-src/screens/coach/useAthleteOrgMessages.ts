import { useCallback, useEffect, useState } from "react";

import { loadAthleteOrgMessageThreads, type OrgMessageThreadEntry } from "../../api/coachWorkspaceClient";

// DEV NOTE: reuses the same open/close bridge every coach_athlete_detail
// sub-panel listens to (see useAthleteStrengthProfile.ts's DEV NOTE).
const OPENED_EVENT = "kolosseum:coach-athlete-profile-opened";
const CLOSED_EVENT = "kolosseum:coach-athlete-profile-closed";

export type AthleteOrgMessagesState = {
  loading: boolean;
  error: string | null;
  threads: OrgMessageThreadEntry[];
};

const initialState: AthleteOrgMessagesState = {
  loading: true,
  error: null,
  threads: []
};

export function useAthleteOrgMessages() {
  const [athleteUserId, setAthleteUserId] = useState<string | null>(null);
  const [state, setState] = useState<AthleteOrgMessagesState>(initialState);

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
      const threads = await loadAthleteOrgMessageThreads(id);
      setState({ loading: false, error: null, threads });
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Team messages could not be loaded. Check your connection and try again."
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
