import { useCallback, useEffect, useState } from "react";

import {
  confirmDataDeletion,
  downloadDataExport,
  loadDataDeletionPreview,
  loadDataDeletionStatus,
  loadDataExportStatus,
  requestDataExport
} from "../../api/dataRightsClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: FULL-UI-19 data rights - ported from app.js's
// loadDataRightsState()/requestDataExportAction()/
// triggerDataExportDownload()/reviewDataDeletionAction()/
// confirmDataDeletionAction(). Fetches on mount only, matching every other
// account sub-panel migrated so far.
//
// Unlike Progress Photos'/Video Feedback's compare-selection state (dropped
// from localStorage as a deliberate, documented simplification since it was
// only ever cosmetic), the deletion confirm's client_request_id is a real
// idempotency key: confirmDataDeletion's server-side dedupe is keyed on
// (user_id, client_request_id) alone, not a content hash, so losing this
// value on a reload-then-retry after a failed submit would create a second
// deletion_requests row instead of replaying the first. It is kept in
// localStorage under its own key, same as legacy's state.
// dataDeletionClientRequestId (legacy persisted it inside the one big
// STORAGE_KEY blob; this panel is the sole remaining reader/writer of the
// value, so a dedicated key is simpler and carries the same guarantee).
const CLIENT_REQUEST_ID_KEY = "kolosseum.data_rights.deletion_client_request_id";

function newClientRequestId(): string {
  const cryptoObj = globalThis.crypto as Crypto | undefined;
  if (typeof cryptoObj?.randomUUID === "function") return cryptoObj.randomUUID();
  return `crid_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export type DataRightsState = {
  loading: boolean;
  serviceUnavailable: boolean;
  exports: JsonRecord[];
  deletionRequests: JsonRecord[];
  exportResultText: string | null;
  requestingExport: boolean;
  deletionReviewOpen: boolean;
  deletionRetentionPreview: { factual_notice: string; retention_notices: JsonRecord[] } | null;
  deletionResultText: string | null;
  submitting: boolean;
};

const initialState: DataRightsState = {
  loading: true,
  serviceUnavailable: false,
  exports: [],
  deletionRequests: [],
  exportResultText: null,
  requestingExport: false,
  deletionReviewOpen: false,
  deletionRetentionPreview: null,
  deletionResultText: null,
  submitting: false
};

export function useAccountDataRights() {
  const [state, setState] = useState<DataRightsState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, serviceUnavailable: false }));

    // Promise.allSettled, not Promise.all: export status and deletion
    // status are two independent reads - one failing must never hide the
    // other's real, successfully-loaded data behind a blanket
    // "service unavailable".
    const [exportResult, deletionResult] = await Promise.allSettled([
      loadDataExportStatus(),
      loadDataDeletionStatus()
    ]);

    setState((current) => ({
      ...current,
      loading: false,
      serviceUnavailable: exportResult.status === "rejected" && deletionResult.status === "rejected",
      exports: exportResult.status === "fulfilled" ? exportResult.value : current.exports,
      deletionRequests: deletionResult.status === "fulfilled" ? deletionResult.value : current.deletionRequests
    }));
  }, []);

  const requestExport = useCallback(async () => {
    setState((current) => ({ ...current, requestingExport: true }));
    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      const result = await requestDataExport(csrfToken);
      setState((current) => ({ ...current, requestingExport: false, exportResultText: `Export ready: ${String(result.export_request_id)}` }));
      await refresh();
    }
    catch {
      setState((current) => ({ ...current, requestingExport: false, exportResultText: "The export request could not be completed." }));
    }
  }, [refresh]);

  const downloadExport = useCallback(async (exportRequestId: string) => {
    const payload = await downloadDataExport(exportRequestId);

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kolosseum-data-export-${exportRequestId}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    await refresh();
  }, [refresh]);

  const reviewDeletion = useCallback(async () => {
    const account = await loadAccountDetail();
    const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
    const preview = await loadDataDeletionPreview(csrfToken);
    setState((current) => ({
      ...current,
      deletionReviewOpen: true,
      deletionResultText: null,
      deletionRetentionPreview: {
        factual_notice: typeof preview.factual_notice === "string" ? preview.factual_notice : "",
        retention_notices: Array.isArray(preview.retention_notices) ? (preview.retention_notices as JsonRecord[]) : []
      }
    }));
  }, []);

  const confirmDeletion = useCallback(async (confirmation: string): Promise<boolean> => {
    setState((current) => ({ ...current, submitting: true }));

    // Kept across a failed submission (network error, validation rejection)
    // so a retry replays the same logical request instead of queuing a
    // second one; cleared only once a request has actually been recorded.
    const clientRequestId = window.localStorage.getItem(CLIENT_REQUEST_ID_KEY) || newClientRequestId();
    window.localStorage.setItem(CLIENT_REQUEST_ID_KEY, clientRequestId);

    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      const result = await confirmDataDeletion({ confirmation, client_request_id: clientRequestId }, csrfToken);

      window.localStorage.removeItem(CLIENT_REQUEST_ID_KEY);

      setState((current) => ({
        ...current,
        submitting: false,
        deletionResultText: result.replayed
          ? `Deletion already requested: ${String(result.deletion_request_id)}`
          : `Deletion requested: ${String(result.deletion_request_id)}`
      }));
      await refresh();
      return true;
    }
    catch {
      setState((current) => ({ ...current, submitting: false, deletionResultText: "The deletion request could not be completed." }));
      return false;
    }
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    ...state,
    refresh,
    requestExport,
    downloadExport,
    reviewDeletion,
    confirmDeletion
  };
}
