import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import {
  connectDevice,
  disconnectDevice,
  loadDeviceConnections,
  loadDeviceMetrics
} from "../../api/athleteDeviceSyncClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: FULL-UI-31 athlete's own device sync - independently fetched,
// listens for kolosseum:history-changed (dispatched by app.js's
// refreshHistory(), which still runs this panel's data alongside the rest
// of the History view's refresh).
const CHANGED_EVENT = "kolosseum:history-changed";

export type DeviceSyncState = {
  loading: boolean;
  error: string | null;
  connections: JsonRecord[];
  metricEntries: JsonRecord[];
  actionPending: boolean;
  actionError: string | null;
};

const initialState: DeviceSyncState = {
  loading: true,
  error: null,
  connections: [],
  metricEntries: [],
  actionPending: false,
  actionError: null
};

export function useDeviceSync() {
  const [state, setState] = useState<DeviceSyncState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [connections, metricEntries] = await Promise.all([
        loadDeviceConnections(),
        loadDeviceMetrics()
      ]);
      setState((current) => ({ ...current, loading: false, connections, metricEntries }));
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Device sync could not be loaded. Check your connection and try again."
      }));
    }
  }, []);

  const connect = useCallback(async (provider: string): Promise<boolean> => {
    setState((current) => ({ ...current, actionPending: true, actionError: null }));
    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      await connectDevice(provider, csrfToken);
      setState((current) => ({ ...current, actionPending: false }));
      await refresh();
      return true;
    }
    catch {
      setState((current) => ({ ...current, actionPending: false, actionError: "Device could not be connected." }));
      return false;
    }
  }, [refresh]);

  const disconnect = useCallback(async (connectionId: string) => {
    setState((current) => ({ ...current, actionPending: true }));
    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      await disconnectDevice(connectionId, csrfToken);
      setState((current) => ({ ...current, actionPending: false }));
      await refresh();
    }
    catch {
      setState((current) => ({ ...current, actionPending: false }));
    }
  }, [refresh]);

  useEffect(() => {
    refresh();
    document.addEventListener(CHANGED_EVENT, refresh);
    return () => {
      document.removeEventListener(CHANGED_EVENT, refresh);
    };
  }, [refresh]);

  return { ...state, connect, disconnect };
}
