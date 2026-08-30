import { useCallback, useEffect, useState } from "react";

import { loadCoachProgressRollup } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: progress graphs slice 3 - a roster-wide overview of the
// coach's own athletes, reusing the same "roster changed" signal
// AthleteDirectoryPanel.tsx's useAthleteDirectory.ts already listens to
// (a new/ended relationship changes both views' underlying roster).
const CHANGED_EVENT = "kolosseum:athlete-directory-changed";

export type CoachProgressOverviewState = {
  loading: boolean;
  error: string | null;
  roster: JsonRecord[];
};

const initialState: CoachProgressOverviewState = {
  loading: true,
  error: null,
  roster: []
};

export function useCoachProgressOverview() {
  const [state, setState] = useState<CoachProgressOverviewState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const roster = await loadCoachProgressRollup();
      setState({ loading: false, error: null, roster });
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Progress overview could not be loaded. Check your connection and try again."
      }));
    }
  }, []);

  useEffect(() => {
    refresh();
    document.addEventListener(CHANGED_EVENT, refresh);
    return () => document.removeEventListener(CHANGED_EVENT, refresh);
  }, [refresh]);

  return { ...state, retry: refresh };
}
