// DEV NOTE: FULL-UI-31 / S-V1-P-06 athlete's own device sync - a separate
// API area from coach-workspace, hence its own client file. Connect/
// disconnect are athlete-self only (simulated - no redirect to any real
// provider, no live SDK call anywhere in this file, matching
// device_sync.routes.ts's own DEV NOTE).

import { type JsonRecord, request } from "./transport";

export async function loadDeviceConnections(): Promise<JsonRecord[]> {
  const response = await request("GET", "/device-sync/connections");
  return Array.isArray(response.connections) ? (response.connections as JsonRecord[]) : [];
}

export async function loadDeviceMetrics(): Promise<JsonRecord[]> {
  const response = await request("GET", "/device-sync/metrics");
  return Array.isArray(response.entries) ? (response.entries as JsonRecord[]) : [];
}

export async function connectDevice(provider: string, csrfToken: string): Promise<JsonRecord> {
  const providerAccountId = `${provider}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const response = await request("POST", "/device-sync/connect", { provider, provider_account_id: providerAccountId }, csrfToken);
  return response.connection as JsonRecord;
}

export async function disconnectDevice(connectionId: string, csrfToken: string): Promise<JsonRecord> {
  const response = await request("POST", "/device-sync/disconnect", { connection_id: connectionId }, csrfToken);
  return response.connection as JsonRecord;
}
