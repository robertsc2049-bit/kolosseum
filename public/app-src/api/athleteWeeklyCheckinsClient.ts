// DEV NOTE: FULL-UI-64 athlete's own weekly check-in self-report - a
// separate API area from coach-workspace, hence its own client file.
// There is no coach write path here at all (see weekly_checkins.routes.ts's
// own DEV NOTE) - a check-in is the athlete's own self-report, never
// something submitted on their behalf.

import { type JsonRecord, request } from "./transport";

export type WeeklyCheckinInput = {
  week_start_date: string;
  energy_level: number;
  motivation_level: number;
  sleep_quality: number;
  note?: string;
};

export async function loadWeeklyCheckins(): Promise<JsonRecord[]> {
  const response = await request("GET", "/weekly-checkins");
  return Array.isArray(response.checkins) ? (response.checkins as JsonRecord[]) : [];
}

export async function submitWeeklyCheckin(input: WeeklyCheckinInput, csrfToken: string): Promise<JsonRecord> {
  const response = await request("POST", "/weekly-checkins", input, csrfToken);
  return response.checkin as JsonRecord;
}
