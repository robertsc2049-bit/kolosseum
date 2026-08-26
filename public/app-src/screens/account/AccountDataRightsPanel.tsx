import React, { useState } from "react";

import { type JsonRecord } from "../../api/transport";
import { formatDate, titleCase } from "../../utils/format";
import { useAccountDataRights } from "./useAccountDataRights";

// DEV NOTE: FULL-UI-19 data rights - ported from app.js's #dataRightsPanel
// rendering. Shared (not role-gated) - both athlete and coach accounts can
// export or request deletion of their own data.
function exportStatusClass(status: unknown): string {
  if (status === "ready") return "complete";
  if (status === "expired") return "partial";
  if (status === "failed") return "danger";
  return "neutral";
}

function ExportRecordCard({ entry, onDownload }: { entry: JsonRecord; onDownload: (id: string) => void }) {
  const canDownload = entry.status === "ready";
  return (
    <article className="record-card">
      <div>
        <h3>Export requested {formatDate(entry.requested_at_iso8601)}</h3>
        <p>{entry.expires_at_iso8601 ? `Expires ${formatDate(entry.expires_at_iso8601)}` : "No expiry recorded"}</p>
        <p>{entry.downloaded_at_iso8601 ? `Downloaded ${formatDate(entry.downloaded_at_iso8601)}` : "Not yet downloaded"}</p>
      </div>
      <div className="record-meta">
        <span className={`badge ${exportStatusClass(entry.status)}`}>{titleCase(entry.status)}</span>
        {canDownload ? (
          <button className="button secondary small-button" type="button" onClick={() => onDownload(String(entry.export_request_id))}>Download</button>
        ) : null}
      </div>
    </article>
  );
}

function DeletionRecordCard({ entry }: { entry: JsonRecord }) {
  const retainedCount = Number((entry.retention_boundary as JsonRecord | undefined)?.retained_record_count ?? 0);
  return (
    <article className="record-card">
      <div>
        <h3>Deletion requested {formatDate(entry.requested_at_iso8601)}</h3>
        <p>{titleCase(entry.reason_code)}</p>
      </div>
      <div className="record-meta">
        <span className="badge active">{titleCase(entry.queue_status)}</span>
        <span className="badge neutral">{retainedCount} retained</span>
      </div>
    </article>
  );
}

export function AccountDataRightsPanel() {
  const {
    loading,
    serviceUnavailable,
    exports,
    deletionRequests,
    exportResultText,
    requestingExport,
    deletionReviewOpen,
    deletionRetentionPreview,
    deletionResultText,
    submitting,
    refresh,
    requestExport,
    downloadExport,
    reviewDeletion,
    confirmDeletion
  } = useAccountDataRights();

  const [confirmation, setConfirmation] = useState("");

  async function handleConfirmSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await confirmDeletion(confirmation.trim());
    if (ok) setConfirmation("");
  }

  return (
    <article className="panel">
      <div>
        <p className="eyebrow">Data rights</p>
        <h3>Export and deletion</h3>
        <p className="muted">Request a complete copy of your personal data, or request deletion. Some records are retained for audit, legal or billing reasons before any deletion decision is made - see the factual notice below.</p>
      </div>

      {loading ? (
        <div className="empty-state compact-empty">
          <p>Loading data rights status…</p>
        </div>
      ) : null}
      {!loading && serviceUnavailable ? (
        <div className="empty-state compact-empty">
          <p>Data rights status could not be loaded.</p>
          <button className="button secondary" type="button" onClick={() => refresh()}>Retry</button>
        </div>
      ) : null}

      <div className="data-rights-section">
        <div className="data-rights-section-heading">
          <h4>Data export</h4>
          <button className="button primary" type="button" disabled={requestingExport} onClick={() => requestExport()}>Request data export</button>
        </div>
        {exportResultText ? <p className="inline-result">{exportResultText}</p> : null}
        <div className="record-list compact-record-list">
          {exports.length === 0 ? (
            <div className="empty-state compact-empty"><p>No export requested yet.</p></div>
          ) : (
            exports.map((entry) => <ExportRecordCard key={String(entry.export_request_id)} entry={entry} onDownload={downloadExport} />)
          )}
        </div>
      </div>

      <div className="data-rights-section">
        <div className="data-rights-section-heading">
          <h4>Deletion request</h4>
          <button className="button secondary" type="button" onClick={() => reviewDeletion()}>Review deletion consequences</button>
        </div>

        {deletionReviewOpen && deletionRetentionPreview ? (
          <div className="data-deletion-review">
            <p className="muted">{deletionRetentionPreview.factual_notice}</p>
            <div className="record-list compact-record-list">
              {deletionRetentionPreview.retention_notices.length === 0 ? (
                <div className="empty-state compact-empty"><p>No records are retained; nothing blocks a deletion request.</p></div>
              ) : (
                deletionRetentionPreview.retention_notices.map((notice, index) => (
                  <div className="record-card" key={`${String(notice.retention_reason)}-${index}`}>
                    <div>
                      <h3>{titleCase(notice.retention_reason)}</h3>
                      <p>{String(notice.copy)}</p>
                    </div>
                    <div className="record-meta"><span className="badge neutral">{Number(notice.record_count)} records</span></div>
                  </div>
                ))
              )}
            </div>

            <form className="closure-controls" onSubmit={handleConfirmSubmit}>
              <input
                autoComplete="off"
                placeholder="Type DELETE"
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
              <button className="button danger" type="submit" disabled={submitting}>Request deletion</button>
            </form>
            {deletionResultText ? <p className="inline-result">{deletionResultText}</p> : null}
          </div>
        ) : null}

        <div className="record-list compact-record-list">
          {deletionRequests.length === 0 ? (
            <div className="empty-state compact-empty"><p>No deletion requested yet.</p></div>
          ) : (
            deletionRequests.map((entry) => <DeletionRecordCard key={String(entry.deletion_request_id)} entry={entry} />)
          )}
        </div>
      </div>
    </article>
  );
}
