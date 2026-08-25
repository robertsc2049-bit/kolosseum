import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { loadCoachEventsList } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: whole-workspace read for the Coach Overview dashboard's
// "Upcoming events" panel (part of FULL-UI-03). Refetches on mount and
// whenever legacy dispatches kolosseum:coach-overview-changed - see
// app.js's renderCoachDashboard(), which still runs after every
// athlete/assignment/event/artefact refresh exactly as before, just to
// notify this hook (among its other still-legacy responsibilities)
// instead of writing this panel's innerHTML itself.
const CHANGED_EVENT = "kolosseum:coach-overview-changed";

export type CoachOverviewEventsState = {
  loading: boolean;
  error: string | null;
  events: JsonRecord[];
};

const initialState: CoachOverviewEventsState = {
  loading: true,
  error: null,
  events: []
};

export function useCoachOverviewEvents() {
  const [state, setState] = useState<CoachOverviewEventsState>(initialState);

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
        error: "Upcoming events could not be loaded. Check your connection and try again."
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
