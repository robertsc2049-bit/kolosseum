// DEV NOTE: FULL-UI-37 athlete's own goal-setting - a separate API area
// from coach-workspace, hence its own client file. There is no coach write
// path here at all - a goal is the athlete's own declared target, never
// something a coach sets or resolves on their behalf.

import { type JsonRecord, request } from "./transport";

export type CreateAthleteGoalInput = {
  goal_label: string;
  target_date: string | null;
  metric_type?: string;
  target_value?: number;
};

export async function loadAthleteGoalsSelf(): Promise<JsonRecord[]> {
  const response = await request("GET", "/athlete-goals");
  return Array.isArray(response.goals) ? (response.goals as JsonRecord[]) : [];
}

export async function createAthleteGoalSelf(input: CreateAthleteGoalInput, csrfToken: string): Promise<JsonRecord> {
  const response = await request("POST", "/athlete-goals", input, csrfToken);
  return response.goal as JsonRecord;
}

export async function resolveAthleteGoalSelf(goalId: string, resolution: "achieved" | "abandoned", csrfToken: string): Promise<JsonRecord> {
  const response = await request("POST", `/athlete-goals/${encodeURIComponent(goalId)}/resolve`, { resolution }, csrfToken);
  return response.goal as JsonRecord;
}
