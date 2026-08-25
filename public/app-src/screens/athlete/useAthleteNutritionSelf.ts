import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import {
  type LogAthleteNutritionInput,
  loadAthleteNutritionSelf,
  logAthleteNutritionSelf
} from "../../api/athleteNutritionClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: FULL-UI-29 athlete's own nutrition logging - the last consumer
// of app.js's refreshBodyMetrics()/GET /body-metrics on the athlete side,
// now independently fetched here instead. Listens for
// kolosseum:history-changed, same as useAthleteBodyMetricsSelf.ts.
const CHANGED_EVENT = "kolosseum:history-changed";

export type AthleteNutritionSelfState = {
  loading: boolean;
  error: string | null;
  entries: JsonRecord[];
  submitting: boolean;
  submitError: string | null;
};

const initialState: AthleteNutritionSelfState = {
  loading: true,
  error: null,
  entries: [],
  submitting: false,
  submitError: null
};

export function useAthleteNutritionSelf() {
  const [state, setState] = useState<AthleteNutritionSelfState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const entries = await loadAthleteNutritionSelf();
      setState((current) => ({ ...current, loading: false, entries }));
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Nutrition history could not be loaded. Check your connection and try again."
      }));
    }
  }, []);

  const logEntry = useCallback(async (input: LogAthleteNutritionInput): Promise<boolean> => {
    setState((current) => ({ ...current, submitting: true, submitError: null }));
    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      await logAthleteNutritionSelf(input, csrfToken);
      setState((current) => ({ ...current, submitting: false }));
      await refresh();
      return true;
    }
    catch {
      setState((current) => ({ ...current, submitting: false, submitError: "Nutrition could not be logged." }));
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
