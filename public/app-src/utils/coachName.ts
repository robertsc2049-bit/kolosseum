import { type JsonRecord } from "../api/transport";

// A coach's name as their athletes see it: with the coaching business name
// they've set in Branding, when there is one ("Chris Roberts · Old Tyme
// Strength").
export function coachLabel(entry: JsonRecord | null | undefined, fallback = ""): string {
  const name = String(entry?.coach_display_name ?? "").trim() || fallback;
  const business = String(entry?.coach_business_name ?? "").trim();
  return business && name ? `${name} · ${business}` : name;
}
