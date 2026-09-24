import { type JsonRecord, request } from "./transport";

export async function loadPlatformStatus(): Promise<JsonRecord> {
  return request("GET", "/health");
}

export async function loadSupportReports(): Promise<JsonRecord[]> {
  const response = await request("GET", "/account/support/reports");
  return Array.isArray(response.reports) ? (response.reports as JsonRecord[]) : [];
}

export type SubmitSupportReportInput = {
  correlation_id: string;
  route_hash: string;
  occurred_at_iso8601: string;
  description: string;
  browser_context: JsonRecord;
  failure_context: JsonRecord;
};

export async function submitSupportReportRequest(input: SubmitSupportReportInput, csrfToken: string): Promise<JsonRecord> {
  const response = await request("POST", "/account/support/reports", input, csrfToken);
  return response.report as JsonRecord;
}

// DEV NOTE: ported verbatim from app.js's retrySupportFailedRequest() -
// re-runs the one safe GET that failed, nothing else. No CSRF needed since
// GET requests never send one (see transport.ts's request()).
export async function retryFailedGet(path: string): Promise<void> {
  await request("GET", path);
}
