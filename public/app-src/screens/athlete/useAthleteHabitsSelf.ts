import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import {
  type CreateHabitInput,
  archiveHabitSelf,
  createHabitSelf,
  loadHabitsSelf,
  logHabitCompletionTodaySelf
} from "../../api/athleteHabitsClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: FULL-UI-29 athlete's own habit create/complete/archive -
// independently fetched, listens for kolosseum:history-changed (dispatched
// by app.js's refreshHistory(), which still runs this panel's data
// alongside the rest of the History view's refresh, same as
// useAthleteGoalsSelf.ts).
const CHANGED_EVENT = "kolosseum:history-changed";

export type AthleteHabitsSelfState = {
  loading: boolean;
  error: string | null;
  habits: JsonRecord[];
  submitting: boolean;
  submitError: string | null;
};

const initialState: AthleteHabitsSelfState = {
  loading: true,
  error: null,
  habits: [],
  submitting: false,
  submitError: null
};

export function useAthleteHabitsSelf() {
  const [state, setState] = useState<AthleteHabitsSelfState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const habits = await loadHabitsSelf();
      setState((current) => ({ ...current, loading: false, habits }));
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Habits could not be loaded. Check your connection and try again."
      }));
    }
  }, []);

  const createHabit = useCallback(async (input: CreateHabitInput): Promise<boolean> => {
    setState((current) => ({ ...current, submitting: true, submitError: null }));
    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      await createHabitSelf(input, csrfToken);
      setState((current) => ({ ...current, submitting: false }));
      await refresh();
      return true;
    }
    catch {
      setState((current) => ({ ...current, submitting: false, submitError: "Habit could not be created." }));
      return false;
    }
  }, [refresh]);

  const completeToday = useCallback(async (habitId: string) => {
    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      await logHabitCompletionTodaySelf(habitId, csrfToken);
      await refresh();
    }
    catch {
      setState((current) => ({ ...current, submitError: "Completion could not be logged." }));
    }
  }, [refresh]);

  const archive = useCallback(async (habitId: string) => {
    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      await archiveHabitSelf(habitId, csrfToken);
      await refresh();
    }
    catch {
      setState((current) => ({ ...current, submitError: "Habit could not be archived." }));
    }
  }, [refresh]);

  useEffect(() => {
    refresh();
    document.addEventListener(CHANGED_EVENT, refresh);
    return () => {
      document.removeEventListener(CHANGED_EVENT, refresh);
    };
  }, [refresh]);

  return { ...state, createHabit, completeToday, archive };
}
