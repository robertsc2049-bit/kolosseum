import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import {
  type CreateAthleteGoalInput,
  createAthleteGoalSelf,
  loadAthleteGoalsSelf,
  resolveAthleteGoalSelf
} from "../../api/athleteGoalsClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: FULL-UI-37 athlete's own goal-setting - independently fetched,
// listens for kolosseum:history-changed (dispatched by app.js's
// refreshHistory(), which still runs this panel's data alongside the rest
// of the History view's refresh).
const CHANGED_EVENT = "kolosseum:history-changed";

export type AthleteGoalsSelfState = {
  loading: boolean;
  error: string | null;
  goals: JsonRecord[];
  submitting: boolean;
  submitError: string | null;
};

const initialState: AthleteGoalsSelfState = {
  loading: true,
  error: null,
  goals: [],
  submitting: false,
  submitError: null
};

export function useAthleteGoalsSelf() {
  const [state, setState] = useState<AthleteGoalsSelfState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const goals = await loadAthleteGoalsSelf();
      setState((current) => ({ ...current, loading: false, goals }));
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Goals could not be loaded. Check your connection and try again."
      }));
    }
  }, []);

  const createGoal = useCallback(async (input: CreateAthleteGoalInput): Promise<boolean> => {
    setState((current) => ({ ...current, submitting: true, submitError: null }));
    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      await createAthleteGoalSelf(input, csrfToken);
      setState((current) => ({ ...current, submitting: false }));
      await refresh();
      return true;
    }
    catch {
      setState((current) => ({ ...current, submitting: false, submitError: "Goal could not be set." }));
      return false;
    }
  }, [refresh]);

  const resolveGoal = useCallback(async (goalId: string, resolution: "achieved" | "abandoned") => {
    setState((current) => ({ ...current, submitting: true }));
    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      await resolveAthleteGoalSelf(goalId, resolution, csrfToken);
      setState((current) => ({ ...current, submitting: false }));
      await refresh();
    }
    catch {
      setState((current) => ({ ...current, submitting: false }));
    }
  }, [refresh]);

  useEffect(() => {
    refresh();
    document.addEventListener(CHANGED_EVENT, refresh);
    return () => {
      document.removeEventListener(CHANGED_EVENT, refresh);
    };
  }, [refresh]);

  return { ...state, createGoal, resolveGoal };
}
