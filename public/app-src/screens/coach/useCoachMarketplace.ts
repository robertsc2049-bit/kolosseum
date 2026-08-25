import { useCallback, useEffect, useState } from "react";

import { loadMarketplaceTemplates } from "../../api/marketplaceClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: whole-workspace read for the Marketplace browse screen
// (FULL-UI-67). Nothing else in the app ever changes another coach's
// shared templates while this coach is looking at them, so unlike most
// other coach-workspace panels there's no kolosseum:*-changed reverse
// bridge here - just fetch once on mount.
export type CoachMarketplaceState = {
  loading: boolean;
  error: string | null;
  templates: JsonRecord[];
};

const initialState: CoachMarketplaceState = {
  loading: true,
  error: null,
  templates: []
};

export function useCoachMarketplace() {
  const [state, setState] = useState<CoachMarketplaceState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const templates = await loadMarketplaceTemplates();
      setState({ loading: false, error: null, templates });
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "The marketplace could not be loaded. Check your connection and try again."
      }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, refresh };
}
