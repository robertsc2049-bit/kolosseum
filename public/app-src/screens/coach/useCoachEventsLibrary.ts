import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { loadCoachEventsList } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: the coach's event library (part of the Events screen). Unlike
// CoachOverviewEventsPanel.tsx (which only needs the upcoming subset),
// this feeds the full list plus the three metric counts, so it refetches
// on mount and whenever legacy dispatches kolosseum:coach-events-changed
// - see app.js's (gutted) renderCoachEvents(), which still runs after
// every event create/refresh cycle exactly as before, just to notify
// this hook instead of writing this panel's innerHTML itself.
const CHANGED_EVENT = "kolosseum:coach-events-changed";

export type CoachEventsLibraryState = {
  loading: boolean;
  error: string | null;
  events: JsonRecord[];
};

const initialState: CoachEventsLibraryState = {
  loading: true,
  error: null,
  events: []
};

export function useCoachEventsLibrary() {
  const [state, setState] = useState<CoachEventsLibraryState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const account = await loadAccountDetail();
      const coachUserId = String((account.account as JsonRecord | undefined)?.user_id ?? "");
      const events = await loadCoachEventsList(coachUserId);
      setState({ loading: false, error: null, events });
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "The event library could not be loaded. Check your connection and try again."
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
