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

// The hours the coach is free for check-in calls, and their days off.
export function loadAvailability(): Promise<JsonRecord> {
  return request("GET", "/check-ins/availability");
}

export function addAvailabilityBlock(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/check-ins/availability/blocks", input, csrfToken);
}

export function removeAvailabilityBlock(blockId: string, csrfToken: string): Promise<JsonRecord> {
  return request("DELETE", `/check-ins/availability/blocks/${encodeURIComponent(blockId)}`, undefined, csrfToken);
}

export function addDayOff(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/check-ins/availability/days-off", input, csrfToken);
}

export function removeDayOff(dayOffId: string, csrfToken: string): Promise<JsonRecord> {
  return request("DELETE", `/check-ins/availability/days-off/${encodeURIComponent(dayOffId)}`, undefined, csrfToken);
}

// Open slots from the athlete's coaches, booking one, cancelling their own.
export function loadOpenSlots(): Promise<JsonRecord> {
  return request("GET", "/check-ins/slots");
}

export function bookSlot(input: { coach_user_id: string; starts_at: string; note?: string }, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/check-ins/book", input, csrfToken);
}

export function cancelMyBooking(checkinId: string, csrfToken: string): Promise<JsonRecord> {
  return request("POST", `/check-ins/${encodeURIComponent(checkinId)}/cancel-mine`, {}, csrfToken);
}

// The athlete's package with this coach: put them on one, record a payment,
// end it, or (payment due) cancel everything upcoming.
export function loadAthletePackage(athleteUserId: string): Promise<JsonRecord> {
  return request("GET", `/check-ins/athletes/${encodeURIComponent(athleteUserId)}/package`);
}

export function startAthletePackage(athleteUserId: string, input: { package_id: string; started_on?: string; paid_now: boolean }, csrfToken: string): Promise<JsonRecord> {
  return request("PUT", `/check-ins/athletes/${encodeURIComponent(athleteUserId)}/package`, input, csrfToken);
}

export function recordPackagePayment(athleteUserId: string, paidUntil: string, csrfToken: string): Promise<JsonRecord> {
  return request("POST", `/check-ins/athletes/${encodeURIComponent(athleteUserId)}/package/payment`, paidUntil ? { paid_until: paidUntil } : {}, csrfToken);
}

export function endAthletePackage(athleteUserId: string, csrfToken: string): Promise<JsonRecord> {
  return request("POST", `/check-ins/athletes/${encodeURIComponent(athleteUserId)}/package/end`, {}, csrfToken);
}

export function cancelUpcomingForUnpaid(athleteUserId: string, csrfToken: string): Promise<JsonRecord> {
  return request("POST", `/check-ins/athletes/${encodeURIComponent(athleteUserId)}/package/cancel-upcoming`, {}, csrfToken);
}

export function loadPackageMembers(): Promise<JsonRecord> {
  return request("GET", "/check-ins/package-members");
}
