import { useCallback, useEffect, useState } from "react";

import { accountMayBeAthlete } from "../../api/client";
import { loadAthleteMyProgramme } from "../../api/athleteOnboardingClient";
import { type JsonRecord } from "../../api/transport";
import { ENTRY_AUTH_SUCCEEDED_EVENT } from "../entry/useEntryAuth";

// A finished or newly created session moves the athlete along, so both of
// the app's own change events refetch, as does opening the page.
const CHANGED_EVENTS = ["kolosseum:today-changed", "kolosseum:history-changed", ENTRY_AUTH_SUCCEEDED_EVENT];
export const MY_PROGRAMME_HASH = "#/athlete/programme";

export function useAthleteMyProgramme() {
  const [data, setData] = useState<JsonRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      if (!(await accountMayBeAthlete())) return;
      setData(await loadAthleteMyProgramme());
      setError(null);
    }
    catch {
      setError("Your programme could not be loaded. Check your connection and try again.");
    }
  }, []);

  useEffect(() => {
    const onHash = () => { if (window.location.hash === MY_PROGRAMME_HASH) void refresh(); };
    void refresh();
    for (const name of CHANGED_EVENTS) document.addEventListener(name, refresh);
    window.addEventListener("hashchange", onHash);
    return () => {
      for (const name of CHANGED_EVENTS) document.removeEventListener(name, refresh);
      window.removeEventListener("hashchange", onHash);
    };
  }, [refresh]);

  return { data, error, refresh };
}
