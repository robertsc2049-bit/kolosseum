// DEV NOTE: FULL-UI-65 coach branding transport (React port of
// coach_branding_ui.js's loadCoachBrandPreference()/saveCoachBrandPreference()
// calls, previously in account_ui.js). Read-only coach_branding_athlete_view
// (the athlete-facing "My coach" card) is a separate, still-legacy feature
// fed via the relationship endpoint - untouched by this client.
import { type JsonRecord, request } from "./transport";

export function loadCoachBrandPreference(): Promise<JsonRecord> {
  return request("GET", "/coach-branding");
}

// The gyms the coach works out of.
export function loadCoachGyms(): Promise<JsonRecord> {
  return request("GET", "/coach-branding/gyms");
}

export function searchCoachGyms(query: string): Promise<JsonRecord> {
  return request("GET", `/coach-branding/gyms/search?q=${encodeURIComponent(query)}`);
}

export function addCoachGym(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/coach-branding/gyms", input, csrfToken);
}

export function linkCoachGym(coachGymId: string, orgId: string, csrfToken: string): Promise<JsonRecord> {
  return request("POST", `/coach-branding/gyms/${encodeURIComponent(coachGymId)}/link`, { org_id: orgId }, csrfToken);
}

export function removeCoachGym(coachGymId: string, csrfToken: string): Promise<JsonRecord> {
  return request("DELETE", `/coach-branding/gyms/${encodeURIComponent(coachGymId)}`, undefined, csrfToken);
}

// The coach's share link: a public page with a QR code.
export function loadCoachShareLink(): Promise<JsonRecord> {
  return request("GET", "/coach-branding/share-link");
}

export function saveCoachShareLink(input: { slug: string; enabled: boolean }, csrfToken: string): Promise<JsonRecord> {
  return request("PUT", "/coach-branding/share-link", input, csrfToken);
}

// A coach's public card, from their share link (no sign-in needed).
export function loadSharedCoachCard(slug: string): Promise<JsonRecord> {
  return request("GET", `/c/${encodeURIComponent(slug)}/card`);
}

export function saveCoachBrandPreference(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/coach-branding", input, csrfToken);
}
