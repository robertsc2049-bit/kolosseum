// Check-in calls between a coach and their athletes (coach_checkin.routes.ts).
import { type JsonRecord, request } from "./transport";

export function loadCallSettings(): Promise<JsonRecord> {
  return request("GET", "/check-ins/call-settings");
}

export function saveCallSettings(input: { whatsapp_number: string; teams_link: string }, csrfToken: string): Promise<JsonRecord> {
  return request("PUT", "/check-ins/call-settings", input, csrfToken);
}

export function loadAthleteCheckinsForCoach(athleteUserId: string): Promise<JsonRecord> {
  return request("GET", `/check-ins/athletes/${encodeURIComponent(athleteUserId)}`);
}

export function scheduleCheckin(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/check-ins", input, csrfToken);
}

export function cancelCheckin(checkinId: string, andLater: boolean, csrfToken: string): Promise<JsonRecord> {
  return request("POST", `/check-ins/${encodeURIComponent(checkinId)}/cancel`, { and_later: andLater }, csrfToken);
}

export function moveCheckin(checkinId: string, startsAt: string, csrfToken: string): Promise<JsonRecord> {
  return request("POST", `/check-ins/${encodeURIComponent(checkinId)}/move`, { starts_at: startsAt }, csrfToken);
}

export function loadMyCheckins(): Promise<JsonRecord> {
  return request("GET", "/check-ins/mine");
}

export function respondToCheckin(checkinId: string, response: "confirm" | "move", message: string, csrfToken: string): Promise<JsonRecord> {
  return request("POST", `/check-ins/${encodeURIComponent(checkinId)}/respond`, { response, ...(message ? { message } : {}) }, csrfToken);
}
