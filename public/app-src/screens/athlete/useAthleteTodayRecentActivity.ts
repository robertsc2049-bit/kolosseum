import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { loadAthleteHistoryList } from "../../api/athleteHistoryClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: Today's "Recent activity" preview (FULL-UI-14C) - independently
// fetches the same /sessions/beta-athlete-history endpoint
// useTrainingHistory.ts (the full History screen) already uses, dropping
// app.js's old state.localSessions/mergeHistory() client-side merge of
// locally-cached, not-yet-server-confirmed session state - the same
// simplification the full History screen already made when it migrated,
// since every field this preview shows (status, runtime_event_count) is
// already present on the server's own history record. Refetches on
// kolosseum:history-changed, the same signal useTrainingHistory listens for,
// so this preview and the full History screen never drift out of sync with
// each other.
const CHANGED_EVENT = "kolosseum:history-changed";
const PREVIEW_LIMIT = 4;

export type AthleteTodayRecentActivityState = {
  loading: boolean;
  sessionCount: number;
  recentSessions: JsonRecord[];
};

const initialState: AthleteTodayRecentActivityState = {
  loading: true,
  sessionCount: 0,
  recentSessions: []
};

export function useAthleteTodayRecentActivity() {
  const [state, setState] = useState<AthleteTodayRecentActivityState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));
    try {
      const account = await loadAccountDetail();
      const athleteUserId = String((account.account as JsonRecord | undefined)?.user_id ?? "");
      const response = await loadAthleteHistoryList(athleteUserId);
      const sessions = Array.isArray(response.sessions) ? (response.sessions as JsonRecord[]) : [];
      setState({
        loading: false,
        sessionCount: sessions.length,
        recentSessions: [...sessions].reverse().slice(0, PREVIEW_LIMIT)
      });
    }
    catch {
      setState({ loading: false, sessionCount: 0, recentSessions: [] });
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
