import { type JsonRecord, request } from "./transport";

export type CreateHabitInput = {
  habit_label: string;
  cadence: "daily" | "weekly";
};

export async function loadHabitsSelf(): Promise<JsonRecord[]> {
  const response = await request("GET", "/habits");
  return Array.isArray(response.habits) ? (response.habits as JsonRecord[]) : [];
}

export async function createHabitSelf(input: CreateHabitInput, csrfToken: string): Promise<JsonRecord> {
  const response = await request("POST", "/habits", input, csrfToken);
  return response.habit as JsonRecord;
}

// DEV NOTE: ported verbatim from app.js's logHabitCompletionToday() -
// completion_id is deterministic server-side on (habit_id, completion_date),
// so a duplicate same-day call is idempotent rather than an error.
export async function logHabitCompletionTodaySelf(habitId: string, csrfToken: string): Promise<JsonRecord> {
  const completionDate = new Date().toISOString().slice(0, 10);
  const response = await request(
    "POST",
    `/habits/${encodeURIComponent(habitId)}/completions`,
    { completion_date: completionDate },
    csrfToken
  );
  return response.completion as JsonRecord;
}

export async function archiveHabitSelf(habitId: string, csrfToken: string): Promise<JsonRecord> {
  const response = await request("POST", `/habits/${encodeURIComponent(habitId)}/archive`, undefined, csrfToken);
  return response.habit as JsonRecord;
}
