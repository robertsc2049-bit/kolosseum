import { useSyncExternalStore } from "react";

import { loadAccountDetail } from "../../api/client";
import {
  loadAthleteHistoryDetail,
  loadCoachEventsList,
  loadCoachTemplates,
  loadTemplateExercises
} from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: unlike every other coach_athlete_detail sub-panel, the six
// cards fed by this hook (current programme, current event, and the
// assignment/strength/bodyweight/event-link history lists) sit in six
// separate, non-adjacent DOM roots so the existing 2-column CSS grid
// layout in index.html isn't disturbed (each root replaces just one
// legacy-rendered <div>, same as every other panel - there's just six of
// them here instead of one). Six independent createRoot trees each
// calling a normal per-component useState/useEffect hook would mean six
// redundant fetches of the same composite detail response every time a
// coach opens an athlete's profile. This module-level store plus
// useSyncExternalStore shares one fetch across all six mount points
// instead.
const OPENED_EVENT = "kolosseum:coach-athlete-profile-opened";
const CLOSED_EVENT = "kolosseum:coach-athlete-profile-closed";

export type AthleteHistoryStore = {
  athleteUserId: string | null;
  loading: boolean;
  error: string | null;
  detail: JsonRecord | null;
  templates: JsonRecord[];
  events: JsonRecord[];
  exercises: JsonRecord[];
};

const initialStore: AthleteHistoryStore = {
  athleteUserId: null,
  loading: true,
  error: null,
  detail: null,
  templates: [],
  events: [],
  exercises: []
};

let store: AthleteHistoryStore = initialStore;
const listeners = new Set<() => void>();

function setStore(patch: Partial<AthleteHistoryStore>) {
  store = { ...store, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AthleteHistoryStore {
  return store;
}

async function refresh(athleteUserId: string) {
  setStore({ loading: true, error: null });
  try {
    const account = await loadAccountDetail();
    const coachUserId = String((account.account as JsonRecord | undefined)?.user_id ?? "");
    const [detail, templates, events, exercises] = await Promise.all([
      loadAthleteHistoryDetail(athleteUserId),
      loadCoachTemplates(coachUserId),
      loadCoachEventsList(coachUserId),
      loadTemplateExercises()
    ]);
    if (store.athleteUserId !== athleteUserId) return;
    setStore({ loading: false, error: null, detail, templates, events, exercises });
  }
  catch {
    if (store.athleteUserId !== athleteUserId) return;
    setStore({
      loading: false,
      error: "Athlete history could not be loaded. Check your connection and try again."
    });
  }
}

let bridgeInstalled = false;

function installBridge() {
  if (bridgeInstalled) return;
  bridgeInstalled = true;

  document.addEventListener(OPENED_EVENT, (event) => {
    const detail = (event as CustomEvent).detail as { athlete_user_id?: string } | undefined;
    const athleteUserId = detail?.athlete_user_id;
    if (!athleteUserId) return;
    setStore({ ...initialStore, athleteUserId, loading: true });
    refresh(athleteUserId);
  });

  document.addEventListener(CLOSED_EVENT, () => {
    setStore(initialStore);
  });
}

export function useAthleteHistory(): AthleteHistoryStore {
  installBridge();
  return useSyncExternalStore(subscribe, getSnapshot);
}
