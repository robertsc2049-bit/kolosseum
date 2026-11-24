import { useCallback, useEffect, useState } from "react";

import { accountMayBeAthlete, loadAccountDetail } from "../../api/client";
import { loadWeeklyCheckins, submitWeeklyCheckin, type WeeklyCheckinInput } from "../../api/athleteWeeklyCheckinsClient";
import { ApiRequestError, type JsonRecord } from "../../api/transport";
import { ENTRY_AUTH_SUCCEEDED_EVENT } from "../entry/useEntryAuth";

// DEV NOTE: FULL-UI-64 athlete's own weekly check-in self-report -
// independently fetched, first athlete-self write path in app-src. Listens
// for kolosseum:history-changed (the same reverse bridge
// useTrainingHistory.ts listens to, dispatched by app.js's refreshHistory())
// since this panel lives in the same legacy view and should refresh
// whenever that does.
const CHANGED_EVENT = "kolosseum:history-changed";

export type WeeklyCheckinsState = {
  loading: boolean;
  error: string | null;
  checkins: JsonRecord[];
  submitting: boolean;
  submitError: string | null;
};

const SUBMIT_ERRORS: Record<string, string> = {
  weekly_checkin_already_submitted_for_week: "You've already checked in for that week.",
  weekly_checkin_week_not_started: "That week hasn't started yet.",
  weekly_checkin_week_start_date_invalid: "Choose a date in the week you're checking in for."
};

const initialState: WeeklyCheckinsState = {
  loading: true,
  error: null,
  checkins: [],
  submitting: false,
  submitError: null
};

export function useWeeklyCheckins() {
  const [state, setState] = useState<WeeklyCheckinsState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      if (!(await accountMayBeAthlete())) {
        setState((current) => ({ ...current, loading: false }));
        return;
      }
      const checkins = await loadWeeklyCheckins();
      setState((current) => ({ ...current, loading: false, checkins }));
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Weekly check-ins could not be loaded. Check your connection and try again."
      }));
    }
  }, []);

  const submit = useCallback(async (input: WeeklyCheckinInput): Promise<boolean> => {
    setState((current) => ({ ...current, submitting: true, submitError: null }));
    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      await submitWeeklyCheckin(input, csrfToken);
      setState((current) => ({ ...current, submitting: false }));
      await refresh();
      return true;
    }
    catch (error) {
      const code = error instanceof ApiRequestError ? String((error.payload as { error?: unknown } | null)?.error ?? "") : "";
      setState((current) => ({
        ...current,
        submitting: false,
        submitError: SUBMIT_ERRORS[code] ?? "Check-in could not be submitted."
      }));
      return false;
    }
  }, [refresh]);

  useEffect(() => {
    refresh();
    document.addEventListener(CHANGED_EVENT, refresh);
    document.addEventListener(ENTRY_AUTH_SUCCEEDED_EVENT, refresh);
    return () => {
      document.removeEventListener(CHANGED_EVENT, refresh);
      document.removeEventListener(ENTRY_AUTH_SUCCEEDED_EVENT, refresh);
    };
  }, [refresh]);

  return { ...state, submit };
}
