// DEV NOTE: Ported verbatim from public/app/app.js's titleCase()/formatDate()
// so migrated consent-history rendering matches the legacy output exactly.
// escapeHtml() has no equivalent here - React escapes all text content by
// default, which is the same guarantee via a safer default.

export function titleCase(value: unknown): string {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

export function initials(name: unknown): string {
  const words = String(name ?? "").trim().split(/\s+/u).filter(Boolean);
  return (words.slice(0, 2).map((word) => word[0]).join("") || "K").toUpperCase();
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

type JsonRecord = Record<string, unknown>;

// DEV NOTE: ported verbatim from public/app/app.js's exerciseName()/
// exerciseDetails() for FULL-UI-15C session execution
// (AthleteSessionExecutionPanel.tsx) - the exact same prescription-display
// rules the coach template builder and athlete session view have always
// shared, so they live here rather than duplicated a third time.
export function exerciseName(exercise: JsonRecord | null | undefined): string {
  return String(exercise?.display_name ?? exercise?.exercise_name ?? exercise?.exercise_id ?? exercise?.item_id ?? "Exercise");
}

export function exerciseDetails(exercise: JsonRecord | null | undefined): string[] {
  const details: string[] = [];

  if (Number.isInteger(exercise?.sets)) {
    details.push(`${exercise?.sets} sets`);
  }

  const repRange = exercise?.rep_range && typeof exercise.rep_range === "object" ? exercise.rep_range as JsonRecord : null;
  const durationRange = exercise?.duration_range && typeof exercise.duration_range === "object" ? exercise.duration_range as JsonRecord : null;
  const distanceRange = exercise?.distance_range && typeof exercise.distance_range === "object" ? exercise.distance_range as JsonRecord : null;

  if (Number.isInteger(repRange?.minimum) && Number.isInteger(repRange?.maximum)) {
    details.push(`${repRange?.minimum}–${repRange?.maximum} reps`);
  }
  else if (Number.isInteger(durationRange?.minimum) && Number.isInteger(durationRange?.maximum)) {
    details.push(`Hold ${durationRange?.minimum}–${durationRange?.maximum}s`);
  }
  else if (Number.isInteger(exercise?.duration_seconds)) {
    details.push(`Hold ${exercise?.duration_seconds}s`);
  }
  else if (Number.isFinite(distanceRange?.minimum) && Number.isFinite(distanceRange?.maximum)) {
    const unit = exercise?.distance_unit === "feet" ? "ft" : "m";
    details.push(`${distanceRange?.minimum}–${distanceRange?.maximum}${unit}`);
  }
  else if (Number.isFinite(exercise?.distance_value)) {
    const unit = exercise?.distance_unit === "feet" ? "ft" : "m";
    details.push(`${exercise?.distance_value}${unit}`);
  }
  else if (Number.isInteger(exercise?.reps)) {
    details.push(`${exercise?.reps} reps`);
  }

  const tempo = String(exercise?.tempo ?? "");
  if (tempo) details.push(`Tempo ${tempo}`);

  const intensity = exercise?.intensity && typeof exercise.intensity === "object" ? exercise.intensity as JsonRecord : null;

  if (intensity?.type === "percent_1rm" && Number.isFinite(Number(intensity.value))) {
    const resolved = exercise?.resolved_load && typeof exercise.resolved_load === "object" ? exercise.resolved_load as JsonRecord : null;

    if (resolved && Number.isFinite(Number(resolved.value))) {
      const unit = resolved.unit === "lb" ? "lb" : "kg";
      details.push(`${Number(intensity.value)}% 1RM · ${Number(resolved.value)} ${unit}`);

      const source = resolved?.source && typeof resolved.source === "object" ? resolved.source as JsonRecord : null;
      if (source) {
        details.push(
          `${strengthSourceLabel(source.source_type)} source · ${Number(source.source_value)} ${source.source_unit === "lb" ? "lb" : "kg"} · effective ${String(source.effective_date ?? "")}`
        );
      }
    }
    else {
      details.push(`${Number(intensity.value)}% 1RM`);
    }
  }
  else if (intensity?.type === "load" && Number.isFinite(Number(intensity.value))) {
    const unit = intensity.unit === "lb" ? "lb" : "kg";
    details.push(`${Number(intensity.value)} ${unit}`);
  }
  else if (intensity?.type === "bodyweight") {
    details.push("Bodyweight");
  }
  else if (intensity?.type === "rpe" && Number.isFinite(Number(intensity.value))) {
    details.push(`RPE ${Number(intensity.value)}`);
  }

  if (Number.isInteger(exercise?.rest_seconds)) {
    details.push(`${exercise?.rest_seconds}s rest`);
  }

  return details;
}
