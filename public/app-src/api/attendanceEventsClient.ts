// DEV NOTE: Attendance events client - coach_user_id/athlete_user_id are
// always derived server-side from the session (src/api/attendance_event.
// routes.ts's authenticatedCoach/authenticatedAthlete calls); the client
// only ever sends the fields a caller doesn't already have server-side.

import { type JsonRecord, request } from "./transport";

export type CreateAttendanceEventInput = Readonly<{
  title: string;
  description: string;
  location: string;
  activity_label: string;
  timezone: string;
  occurrence_date: string;
  start_time: string | null;
  end_time: string | null;
  athlete_user_ids: readonly string[];
}>;

export async function createAttendanceEvent(
  input: CreateAttendanceEventInput,
  csrfToken: string
): Promise<JsonRecord> {
  return request("POST", "/attendance-events", input as unknown as JsonRecord, csrfToken);
}

export async function loadCoachAttendanceEvents(): Promise<JsonRecord[]> {
  const response = await request("GET", "/attendance-events");
  return Array.isArray(response.events) ? (response.events as JsonRecord[]) : [];
}

export async function loadCoachAttendanceEventDetail(eventId: string): Promise<JsonRecord> {
  return request("GET", `/attendance-events/${encodeURIComponent(eventId)}`);
}

export async function cancelAttendanceEvent(eventId: string, csrfToken: string): Promise<JsonRecord> {
  return request("POST", `/attendance-events/${encodeURIComponent(eventId)}/cancel`, {}, csrfToken);
}

export async function loadMyAttendanceOccurrences(): Promise<JsonRecord[]> {
  const response = await request("GET", "/attendance-events/mine");
  return Array.isArray(response.occurrences) ? (response.occurrences as JsonRecord[]) : [];
}

export async function submitAttendanceRsvp(
  occurrenceId: string,
  rsvpState: "attending" | "maybe" | "not_attending",
  csrfToken: string
): Promise<JsonRecord> {
  return request(
    "POST",
    `/attendance-events/occurrences/${encodeURIComponent(occurrenceId)}/rsvp`,
    { rsvp_state: rsvpState },
    csrfToken
  );
}
