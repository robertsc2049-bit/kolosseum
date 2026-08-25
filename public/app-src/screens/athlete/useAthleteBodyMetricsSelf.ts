import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import {
  type LogAthleteBodyMetricInput,
  loadAthleteBodyMetricsSelf,
  logAthleteBodyMetricSelf
} from "../../api/athleteBodyMetricsClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: FULL-UI-29 athlete's own body-measurement logging -
// independently fetched, listens for kolosseum:history-changed (dispatched
// by app.js's refreshHistory(), which still runs the legacy
// refreshBodyMetrics() alongside this for the not-yet-migrated Nutrition
// panel - see the DEV NOTE left in app.js at the old
// logBodyMetricEntry()/renderBodyMetricList() site).
const CHANGED_EVENT = "kolosseum:history-changed";

export type AthleteBodyMetricsSelfState = {
  loading: boolean;
  error: string | null;
  entries: JsonRecord[];
  submitting: boolean;
  submitError: string | null;
};

const initialState: AthleteBodyMetricsSelfState = {
  loading: true,
  error: null,
  entries: [],
  submitting: false,
  submitError: null
};

export function useAthleteBodyMetricsSelf() {
  const [state, setState] = useState<AthleteBodyMetricsSelfState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const entries = await loadAthleteBodyMetricsSelf();
      setState((current) => ({ ...current, loading: false, entries }));
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Body-metric history could not be loaded. Check your connection and try again."
      }));
    }
  }, []);

  const logEntry = useCallback(async (input: LogAthleteBodyMetricInput): Promise<boolean> => {
    setState((current) => ({ ...current, submitting: true, submitError: null }));
    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      await logAthleteBodyMetricSelf(input, csrfToken);
      setState((current) => ({ ...current, submitting: false }));
      await refresh();
      return true;
    }
    catch {
      setState((current) => ({ ...current, submitting: false, submitError: "Measurement could not be logged." }));
      return false;
    }
  }, [refresh]);

  useEffect(() => {
    refresh();
    document.addEventListener(CHANGED_EVENT, refresh);
    return () => {
      document.removeEventListener(CHANGED_EVENT, refresh);
    };
  }, [refresh]);

  return { ...state, logEntry };
}
