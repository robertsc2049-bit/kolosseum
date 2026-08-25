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

// DEV NOTE: ported verbatim from public/app/app.js's formatAttachmentSize()
// - fixes the same "phantom field" bug class as #884: byte_size was always
// computed and returned by the backend but never actually shown to the user.
export function formatAttachmentSize(bytes: unknown): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// DEV NOTE: ported verbatim from public/app/app.js's countdownLabel() -
// extracted here once a third migrated panel needed the identical
// function (AthleteHistoryPanels.tsx and CoachOverviewEventsPanel.tsx
// each carried their own copy first; this is the "Rule of Three" moment
// to stop duplicating it).
function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateOnlyEpochDay(value: unknown): number | null {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(text)) return null;
  const parsed = Date.parse(`${text}T00:00:00.000Z`);
  return Number.isFinite(parsed) ? Math.floor(parsed / 86400000) : null;
}

export function countdownLabel(eventDate: unknown, fromDate: string = todayDateOnly()): string {
  const from = dateOnlyEpochDay(fromDate);
  const to = dateOnlyEpochDay(eventDate);
  if (from === null || to === null) return "Set dates";
  const days = to - from;
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
  if (days === 0) return "Today";
  const weeks = Math.floor(days / 7);
  const remainder = days % 7;
  return weeks > 0 ? `${weeks}w ${remainder}d` : `${days} day${days === 1 ? "" : "s"}`;
}

// DEV NOTE: ported verbatim from public/app/app.js's strengthSourceLabel() -
// extracted here once a third migrated panel (AthleteTodayPanel) needed the
// identical lookup; AthleteHistoryPanels.tsx carried its own private copy
// first (Rule of Three, same as countdownLabel above).
export function strengthSourceLabel(sourceType: unknown): string {
  if (sourceType === "estimated_1rm") return "Estimated 1RM";
  if (sourceType === "training_max") return "Training max";
  return "Tested 1RM";
}
