// DEV NOTE: Ported verbatim from public/app/app.js's titleCase()/formatDate()
// so migrated consent-history rendering matches the legacy output exactly.
// escapeHtml() has no equivalent here - React escapes all text content by
// default, which is the same guarantee via a safer default.

export function titleCase(value: unknown): string {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

export function formatDate(value: unknown): string {
  if (!value) return "Date not recorded";

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/u.test(String(value));
  const parsed = new Date(isDateOnly ? `${value}T12:00:00.000Z` : String(value));
  if (Number.isNaN(parsed.getTime())) return "Date not recorded";

  return new Intl.DateTimeFormat(
    "en-GB",
    isDateOnly
      ? { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }
      : { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
  ).format(parsed);
}

// DEV NOTE: ported verbatim from public/app/app.js's BODY_METRIC_TYPE_LABELS
// - shared here once it was needed by a second migrated panel
// (AthleteProgressInsightsPanel, then AthleteGoalsPanel) to avoid two copies
// of this lookup table drifting apart.
export const BODY_METRIC_TYPE_LABELS: Record<string, string> = {
  waist_circumference_cm: "Waist",
  chest_circumference_cm: "Chest",
  arm_circumference_cm: "Arm",
  thigh_circumference_cm: "Thigh",
  hip_circumference_cm: "Hip",
  body_fat_percentage: "Body fat",
  body_weight_kg: "Body weight",
  calories_kcal: "Calories",
  protein_g: "Protein",
  carbs_g: "Carbs",
  fat_g: "Fat"
};

// DEV NOTE: nutrition entries are body_metric_entry records with one of
// these metric_type values - there is no separate nutrition record type or
// route (see app.js's identically-named NUTRITION_METRIC_TYPES constant).
export const NUTRITION_METRIC_TYPES = ["calories_kcal", "protein_g", "carbs_g", "fat_g"];

export const METRIC_UNIT_SUFFIX: Record<string, string> = {
  calories_kcal: " kcal",
  protein_g: "g",
  carbs_g: "g",
  fat_g: "g"
};
