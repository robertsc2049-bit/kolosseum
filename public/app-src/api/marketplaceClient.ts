// DEV NOTE: programme-marketplace browse (FULL-UI-67) - a separate API
// area from coach-workspace, hence its own client file. Session-
// authenticated (authenticatedCoach(request, false)), read-only.

import { type JsonRecord, request } from "./transport";

export async function loadMarketplaceTemplates(): Promise<JsonRecord[]> {
  const response = await request("GET", "/programme-marketplace/templates");
  return Array.isArray(response.templates) ? (response.templates as JsonRecord[]) : [];
}
