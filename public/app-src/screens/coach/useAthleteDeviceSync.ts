import { useCallback, useEffect, useState } from "react";

import { loadAthleteDeviceConnections, loadAthleteDeviceMetrics } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: reuses the same open/close bridge every coach_athlete_detail
// sub-panel listens to (see useAthleteStrengthProfile.ts's DEV NOTE).
const OPENED_EVENT = "kolosseum:coach-athlete-profile-opened";
const CLOSED_EVENT = "kolosseum:coach-athlete-profile-closed";

export type AthleteDeviceSyncState = {
  loading: boolean;
  error: string | null;
  connections: JsonRecord[];
  metricEntries: JsonRecord[];
};

const initialState: AthleteDeviceSyncState = {
  loading: true,
  error: null,
  connections: [],
  metricEntries: []
};

export function useAthleteDeviceSync() {
  const [athleteUserId, setAthleteUserId] = useState<string | null>(null);
  const [state, setState] = useState<AthleteDeviceSyncState>(initialState);

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
      const [connections, metricEntries] = await Promise.all([
        loadAthleteDeviceConnections(id),
        loadAthleteDeviceMetrics(id)
      ]);
      setState({ loading: false, error: null, connections, metricEntries });
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Device sync could not be loaded. Check your connection and try again."
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
