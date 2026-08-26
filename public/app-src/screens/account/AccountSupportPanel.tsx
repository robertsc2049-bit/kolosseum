import React, { useState } from "react";

import { type JsonRecord } from "../../api/transport";
import { formatDate, titleCase } from "../../utils/format";
import { useAccountSupport } from "./useAccountSupport";

// DEV NOTE: FULL-UI-20 platform status + error reporting - ported from
// app.js's #statusSupportPanel rendering. See useAccountSupport.ts's DEV
// NOTE for the two small legacy bridges this panel depends on.
function HistoryRow({ report }: { report: JsonRecord }) {
  return (
    <div className="support-history-row">
      <span className="badge neutral support-history-status">{titleCase(report.status)}</span>
      <span className="support-history-description">{String(report.description)}</span>
      <span className="support-history-time">{formatDate(report.created_at_iso8601)}</span>
    </div>
  );
}

export function AccountSupportPanel() {
  const {
    platformStatus,
    platformStatusOperational,
    platformStatusCheckedAt,
    reportOpen,
    reportContext,
    reports,
    submitting,
    resultText,
    checkPlatformStatus,
    openReportForm,
    closeReportForm,
    submitReport,
    retryFailedRequest,
    recoverToSafeScreen
  } = useAccountSupport();

  const [description, setDescription] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await submitReport(description);
    if (ok) setDescription("");
  }

  const canRetry = reportContext?.failure_context?.method === "GET" && Boolean(reportContext.failure_context.path);
  const browserContext = reportContext?.browser_context;
  const browserSummary = browserContext
    ? `${String(browserContext.viewport_width)}x${String(browserContext.viewport_height)}, ${String(browserContext.language) || "unknown language"}`
    : "-";

  return (
    <section className="panel status-support-panel" aria-labelledby="statusSupportHeading">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Status and support</p>
          <h3 id="statusSupportHeading">Platform status and error reporting</h3>
          <p className="muted">Check current platform status, or report a problem with the exact context that will be attached shown before you send it.</p>
        </div>
      </div>

      <div className="status-support-grid">
        <article className="panel">
          <div>
            <p className="eyebrow">Platform status</p>
            <h4>Current status</h4>
          </div>
          <div className="commercial-fact-grid account-version-grid">
            <div className="commercial-fact">
              <span>Status</span>
              <strong className={platformStatusOperational ? "status-ok" : undefined}>{platformStatus}</strong>
            </div>
            <div className="commercial-fact">
              <span>Last checked</span>
              <strong>{platformStatusCheckedAt ?? "Not checked yet"}</strong>
            </div>
          </div>
          <button className="button secondary" type="button" onClick={() => checkPlatformStatus()}>Check platform status</button>
        </article>

        <article className="panel">
          <div>
            <p className="eyebrow">Support</p>
            <h4>Report a problem</h4>
            <p className="muted">Opens a form that shows exactly what route, timestamp, browser context and correlation ID will be attached before you submit a description.</p>
          </div>
          <button className="button primary" type="button" onClick={() => openReportForm(null)}>Report a problem</button>

          {reportOpen && reportContext ? (
            <div className="support-report-panel">
              <div className="commercial-fact-grid account-version-grid">
                <div className="commercial-fact">
                  <span>Correlation ID</span>
                  <strong>{reportContext.correlation_id}</strong>
                </div>
                <div className="commercial-fact">
                  <span>Route</span>
                  <strong>{reportContext.route_hash}</strong>
                </div>
                <div className="commercial-fact">
                  <span>Timestamp</span>
                  <strong>{formatDate(reportContext.occurred_at_iso8601)}</strong>
                </div>
                <div className="commercial-fact">
                  <span>Browser context</span>
                  <strong>{browserSummary}</strong>
                </div>
              </div>

              <form className="form-panel" onSubmit={handleSubmit}>
                <label className="field">
                  <span>What happened?</span>
                  <textarea
                    required
                    maxLength={4000}
                    rows={4}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </label>

                <div className="support-report-actions">
                  {canRetry ? (
                    <button className="button secondary" type="button" onClick={() => retryFailedRequest()}>Retry the failed request</button>
                  ) : null}
                  <button className="button secondary" type="button" onClick={() => recoverToSafeScreen()}>Return to a safe screen</button>
                  <button className="button secondary" type="button" onClick={() => closeReportForm()}>Cancel</button>
                  <button className="button primary" type="submit" disabled={submitting}>Submit report</button>
                </div>
                {resultText ? <p className="inline-result">{resultText}</p> : null}
              </form>
            </div>
          ) : null}
        </article>

        <article className="panel">
          <div>
            <p className="eyebrow">Support history</p>
            <h4>Your submitted reports</h4>
          </div>
          {reports.length === 0 ? (
            <div className="empty-state compact-empty"><p>No problems reported yet.</p></div>
          ) : (
            <div className="record-list compact-record-list">
              {reports.map((report) => <HistoryRow key={String(report.correlation_id)} report={report} />)}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
