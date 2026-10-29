import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { loadAthleteSessionState, loadAthleteTodaySnapshot } from "../../api/athleteSessionClient";
import { type JsonRecord } from "../../api/transport";
import { ENTRY_AUTH_SUCCEEDED_EVENT } from "../entry/useEntryAuth";

// DEV NOTE: Today's read-only display (FULL-UI-14C), independently fetched -
// mirrors app.js's loadAthleteToday()/loadSessionState(), which keep running
// unchanged (they still own state.activeSessionId, which the still-legacy
// Session screen needs) and now additionally dispatch
// kolosseum:today-changed after every render so this hook knows to refetch
// instead of legacy writing this card's DOM itself. Unlike legacy (which
// only shows real session progress counts if state.activeSessionState
// already happens to be cached from a Session-tab visit, else a 0/4/0
// placeholder), this hook always fetches the real session state itself when
// a session exists, so the counts shown here are always accurate.
const CHANGED_EVENT = "kolosseum:today-changed";

export type AthleteTodayState = {
  loading: boolean;
  today: JsonRecord | null;
  sessionState: JsonRecord | null;
  // The signed-in account's actor_type ("" until known). This card is
  // always mounted, so callers use it to keep a coach/org owner/admin
  // session off athlete-only endpoints.
  actorType: string;
};

const initialState: AthleteTodayState = {
  loading: true,
  today: null,
  sessionState: null,
  actorType: ""
};

export function useAthleteToday() {
  const [state, setState] = useState<AthleteTodayState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));

    let today: JsonRecord;
    let actorType = "";
    try {
      const account = await loadAccountDetail();
      actorType = String((account.account as JsonRecord | undefined)?.actor_type ?? "");
      const athleteUserId = String((account.account as JsonRecord | undefined)?.user_id ?? "");
      today = await loadAthleteTodaySnapshot(athleteUserId);
    }
    catch {
      today = { state: "service_unavailable" };
    }

    const sessionId = String((today.session as JsonRecord | undefined)?.session_id ?? "");
    const sessionState = sessionId ? await loadAthleteSessionState(sessionId).catch(() => null) : null;

    setState({ loading: false, today, sessionState, actorType });
  }, []);

  useEffect(() => {
    refresh();
    document.addEventListener(CHANGED_EVENT, refresh);
    document.addEventListener(ENTRY_AUTH_SUCCEEDED_EVENT, refresh);
    return () => {
      document.removeEventListener(CHANGED_EVENT, refresh);
      document.removeEventListener(ENTRY_AUTH_SUCCEEDED_EVENT, refresh);
    };
  }, [refresh]);

  return { ...state, refresh };
}
