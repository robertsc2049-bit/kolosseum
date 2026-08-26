import { useCallback, useEffect, useState } from "react";

import {
  type SubmitSupportReportInput,
  loadPlatformStatus,
  loadSupportReports,
  retryFailedGet,
  submitSupportReportRequest
} from "../../api/accountSupportClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";
import { formatDate } from "../../utils/format";

// DEV NOTE: FULL-UI-20 platform status + error-reporting - ported from
// app.js's refreshPlatformStatus()/openSupportReportForm()/
// submitSupportReport()/retrySupportFailedRequest()/refreshSupportHistory().
// Fetches status+history on mount only (no view-entry trigger needed -
// legacy's refreshPlatformStatus()/refreshSupportHistory() calls at
// account-view-entry are removed alongside this migration).
//
// Two small bridges to legacy, since a report can be opened from *any*
// failed request anywhere in the app, and "recover to a safe screen" needs
// legacy's state.role/setView():
// - listens for kolosseum:open-support-report (dispatched by the global
//   error-notice's "Report this problem" button, app.js's showNotice())
// - dispatches kolosseum:recover-to-safe-screen (a tiny legacy listener
//   calls the same setView(state.role === "coach" ? "coach-overview" :
//   "today") line openSupportReportForm's caller used to run)
const OPEN_REPORT_EVENT = "kolosseum:open-support-report";
const RECOVER_EVENT = "kolosseum:recover-to-safe-screen";

export type FailureContext = {
  status: number | null;
  reason: string;
  method: string;
  path: string;
} | null;

function generateCorrelationId(): string {
  const cryptoObj = globalThis.crypto as Crypto | undefined;
  if (typeof cryptoObj?.randomUUID === "function") return cryptoObj.randomUUID();
  return `corr-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildBrowserContextSnapshot(): JsonRecord {
  return {
    user_agent: navigator.userAgent ?? "",
    language: navigator.language ?? "",
    viewport_width: window.innerWidth ?? null,
    viewport_height: window.innerHeight ?? null,
    timezone_offset_minutes: new Date().getTimezoneOffset()
  };
}

export type ReportContext = {
  correlation_id: string;
  route_hash: string;
  occurred_at_iso8601: string;
  browser_context: JsonRecord;
  failure_context: FailureContext;
};

export type AccountSupportState = {
  platformStatus: "Checking..." | "Operational" | "Degraded" | "Unavailable";
  platformStatusOperational: boolean;
  platformStatusCheckedAt: string | null;
  reportOpen: boolean;
  reportContext: ReportContext | null;
  reports: JsonRecord[];
  reportsLoading: boolean;
  submitting: boolean;
  resultText: string | null;
};

const initialState: AccountSupportState = {
  platformStatus: "Checking...",
  platformStatusOperational: false,
  platformStatusCheckedAt: null,
  reportOpen: false,
  reportContext: null,
  reports: [],
  reportsLoading: true,
  submitting: false,
  resultText: null
};

export function useAccountSupport() {
  const [state, setState] = useState<AccountSupportState>(initialState);

  const checkPlatformStatus = useCallback(async () => {
    setState((current) => ({ ...current, platformStatus: "Checking...", platformStatusOperational: false }));
    try {
      const result = await loadPlatformStatus();
      const operational = result.status === "ok";
      setState((current) => ({
        ...current,
        platformStatus: operational ? "Operational" : "Degraded",
        platformStatusOperational: operational,
        platformStatusCheckedAt: formatDate(new Date().toISOString())
      }));
    }
    catch {
      setState((current) => ({
        ...current,
        platformStatus: "Unavailable",
        platformStatusOperational: false,
        platformStatusCheckedAt: formatDate(new Date().toISOString())
      }));
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    setState((current) => ({ ...current, reportsLoading: true }));
    try {
      const reports = await loadSupportReports();
      setState((current) => ({ ...current, reportsLoading: false, reports }));
    }
    catch {
      setState((current) => ({ ...current, reportsLoading: false }));
    }
  }, []);

  const openReportForm = useCallback((failureContext: FailureContext) => {
    setState((current) => ({
      ...current,
      reportOpen: true,
      resultText: null,
      reportContext: {
        correlation_id: generateCorrelationId(),
        route_hash: window.location.hash || "#/",
        occurred_at_iso8601: new Date().toISOString(),
        browser_context: buildBrowserContextSnapshot(),
        failure_context: failureContext?.path ? failureContext : null
      }
    }));
  }, []);

  const closeReportForm = useCallback(() => {
    setState((current) => ({ ...current, reportOpen: false }));
  }, []);

  const submitReport = useCallback(async (description: string): Promise<boolean> => {
    const context = state.reportContext;
    if (!context) return false;

    const trimmed = description.trim();
    if (!trimmed) {
      setState((current) => ({ ...current, resultText: "Enter a description before submitting." }));
      return false;
    }

    setState((current) => ({ ...current, submitting: true }));
    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      const input: SubmitSupportReportInput = {
        correlation_id: context.correlation_id,
        route_hash: context.route_hash,
        occurred_at_iso8601: context.occurred_at_iso8601,
        description: trimmed,
        browser_context: context.browser_context,
        failure_context: context.failure_context ?? {}
      };
      const report = await submitSupportReportRequest(input, csrfToken);
      setState((current) => ({
        ...current,
        submitting: false,
        resultText: `Report submitted. Correlation ID: ${String(report.correlation_id)}`
      }));
      await refreshHistory();
      return true;
    }
    catch {
      setState((current) => ({ ...current, submitting: false, resultText: "Report could not be submitted." }));
      return false;
    }
  }, [state.reportContext, refreshHistory]);

  // DEV NOTE: shows its own inline result text instead of the global
  // showNotice() toast legacy used - a deliberate simplification, since
  // this panel already has its own result-message slot and doesn't need a
  // bridge back into the legacy toast just for this one message.
  const retryFailedRequest = useCallback(async () => {
    const context = state.reportContext?.failure_context;
    if (!context || context.method !== "GET" || !context.path) return;

    try {
      await retryFailedGet(context.path);
      setState((current) => ({ ...current, reportOpen: false, resultText: "The request succeeded on retry." }));
    }
    catch {
      setState((current) => ({ ...current, resultText: "The retry also failed." }));
    }
  }, [state.reportContext]);

  const recoverToSafeScreen = useCallback(() => {
    setState((current) => ({ ...current, reportOpen: false }));
    document.dispatchEvent(new CustomEvent(RECOVER_EVENT));
  }, []);

  useEffect(() => {
    checkPlatformStatus();
    refreshHistory();
  }, [checkPlatformStatus, refreshHistory]);

  useEffect(() => {
    function handleOpenReport(event: Event) {
      const detail = (event as CustomEvent).detail as { failureContext?: FailureContext } | undefined;
      openReportForm(detail?.failureContext ?? null);
    }

    document.addEventListener(OPEN_REPORT_EVENT, handleOpenReport);
    return () => {
      document.removeEventListener(OPEN_REPORT_EVENT, handleOpenReport);
    };
  }, [openReportForm]);

  return {
    ...state,
    checkPlatformStatus,
    openReportForm,
    closeReportForm,
    submitReport,
    retryFailedRequest,
    recoverToSafeScreen
  };
}
