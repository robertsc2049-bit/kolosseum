// DEV NOTE: FULL-UI-19 data rights transport (React port of app.js's
// requestDataExportAction()/triggerDataExportDownload()/
// reviewDataDeletionAction()/confirmDataDeletionAction(), previously
// imported from account_ui.js). Same routes, same shapes.
import { type JsonRecord, request } from "./transport";

export function requestDataExport(csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/account/data-rights/export", {}, csrfToken);
}

export async function loadDataExportStatus(): Promise<JsonRecord[]> {
  const response = await request("GET", "/account/data-rights/export");
  return Array.isArray(response.exports) ? (response.exports as JsonRecord[]) : [];
}

export function downloadDataExport(exportRequestId: string): Promise<JsonRecord> {
  return request("GET", `/account/data-rights/export/${encodeURIComponent(exportRequestId)}/download`);
}

export function loadDataDeletionPreview(csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/account/data-rights/deletion/preview", {}, csrfToken);
}

export function confirmDataDeletion(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/account/data-rights/deletion", input, csrfToken);
}

export async function loadDataDeletionStatus(): Promise<JsonRecord[]> {
  const response = await request("GET", "/account/data-rights/deletion");
  return Array.isArray(response.deletion_requests) ? (response.deletion_requests as JsonRecord[]) : [];
}
