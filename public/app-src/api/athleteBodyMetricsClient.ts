import { type JsonRecord, request } from "./transport";

export type LogAthleteBodyMetricInput = {
  metric_type: string;
  value: number;
  effective_date: string;
  note?: string;
};

export async function loadAthleteBodyMetricsSelf(): Promise<JsonRecord[]> {
  const response = await request("GET", "/body-metrics");
  return Array.isArray(response.entries) ? (response.entries as JsonRecord[]) : [];
}

export async function logAthleteBodyMetricSelf(input: LogAthleteBodyMetricInput, csrfToken: string): Promise<JsonRecord> {
  const response = await request("POST", "/body-metrics", input, csrfToken);
  return response.entry as JsonRecord;
}
