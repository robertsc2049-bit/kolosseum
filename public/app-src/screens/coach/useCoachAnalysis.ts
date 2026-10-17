import { useCallback, useEffect, useState } from "react";

import { request, type JsonRecord } from "../../api/transport";
import { ENTRY_AUTH_SUCCEEDED_EVENT } from "../entry/useEntryAuth";

// The coach's Analysis page: the roster (every connected athlete ranked by
// what needs a look) and one athlete's pattern trends. The roster is worked
// out only while the page is open - it is the heaviest read in the app, and
// the panel is mounted on every page - and again when the page is opened,
// the coach signs in, their roster changes or a session is logged.
const REFRESH_EVENTS = [ENTRY_AUTH_SUCCEEDED_EVENT, "kolosseum:athlete-directory-changed", "kolosseum:history-changed", "kolosseum:coach-overview-changed"];
export const ANALYSIS_HASH = "#/coach/progress";
const analysisOpen = () => window.location.hash.startsWith(ANALYSIS_HASH) || document.getElementById("view-coach-progress")?.hidden === false;

export function useCoachAnalysisRoster() {
  const [roster, setRoster] = useState<JsonRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!analysisOpen()) return;
    try {
      setRoster(await request("GET", "/coach-workspace/analysis"));
      setError(null);
    }
    catch {
      setError("Analysis could not be loaded. Check your connection and try again.");
    }
  }, []);
  useEffect(() => {
    const onHash = () => { if (window.location.hash.startsWith(ANALYSIS_HASH)) void refresh(); };
    void refresh();
    for (const name of REFRESH_EVENTS) document.addEventListener(name, refresh);
    window.addEventListener("hashchange", onHash);
    // The app opens a page by un-hiding its section (and updates the address
    // with replaceState, which fires no hashchange): load when it appears.
    const section = document.getElementById("view-coach-progress");
    const Observer = window.MutationObserver;
    const observer = section && Observer
      ? new Observer(() => { if (section.hidden === false) void refresh(); })
      : null;
    if (section && observer) observer.observe(section, { attributes: true, attributeFilter: ["hidden"] });
    return () => {
      for (const name of REFRESH_EVENTS) document.removeEventListener(name, refresh);
      window.removeEventListener("hashchange", onHash);
      observer?.disconnect();
    };
  }, [refresh]);
  return { roster, error, refresh };
}

export function useCoachAthleteAnalysis(athleteUserId: string | null, weeks: number) {
  const [data, setData] = useState<JsonRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Bumped after a change (a test recorded) to read the analysis again.
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((n) => n + 1), []);
  useEffect(() => {
    if (!athleteUserId) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    request("GET", `/coach-workspace/athletes/${encodeURIComponent(athleteUserId)}/analysis?weeks=${weeks}`)
      .then((result) => { if (!cancelled) { setData(result); setLoading(false); } })
      .catch(() => { if (!cancelled) { setError("This athlete's analysis could not be loaded. Try again."); setLoading(false); } });
    return () => { cancelled = true; };
  }, [athleteUserId, weeks, version]);
  return { data, error, loading, reload };
}
