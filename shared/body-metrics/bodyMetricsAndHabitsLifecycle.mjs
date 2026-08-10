// DEV NOTE: FULL-UI-29 body-metric and habit lifecycle law. This module
// performs factual entry normalisation and deterministic streak
// reconstruction. A streak count is arithmetic over dates the athlete
// themselves declared as "completed" - it is never persisted, never
// compared against a target the athlete didn't set, and never weighted
// or combined into a single derived figure. This module is limited to declared facts
// and deterministic reconstruction, mirroring
// shared/strength-reference/strengthReferenceLifecycle.mjs's own boundary.

const METRIC_TYPES =
  new Map([
    ["waist_circumference_cm", { unit: "cm", min: 10, max: 300 }],
    ["chest_circumference_cm", { unit: "cm", min: 10, max: 300 }],
    ["arm_circumference_cm", { unit: "cm", min: 10, max: 300 }],
    ["thigh_circumference_cm", { unit: "cm", min: 10, max: 300 }],
    ["hip_circumference_cm", { unit: "cm", min: 10, max: 300 }],
    ["body_fat_percentage", { unit: "percent", min: 1, max: 60 }],
    ["body_weight_kg", { unit: "kg", min: 20, max: 400 }]
  ]);

const METRIC_SOURCES =
  new Set([
    "coach_entered",
    "athlete_entered",
    "device_synced"
  ]);

const HABIT_CADENCES =
  new Set([
    "daily",
    "weekly"
  ]);

const MAX_NOTE_LENGTH = 280;
const MAX_HABIT_LABEL_LENGTH = 120;
const MILLISECONDS_PER_DAY = 86400000;

export class BodyMetricsAndHabitsLifecycleError
  extends Error {
  constructor(code) {
    super(code);
    this.name =
      "BodyMetricsAndHabitsLifecycleError";
    this.code = code;
  }
}

function fail(code) {
  throw new BodyMetricsAndHabitsLifecycleError(
    code
  );
}

function isRecord(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function cleanString(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function finiteNumber(
  value,
  code
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    fail(code);
  }

  return number;
}

function dateOnly(
  value,
  code
) {
  const text =
    cleanString(value);

  if (
    !/^\d{4}-\d{2}-\d{2}$/u.test(
      text
    )
  ) {
    fail(code);
  }

  const parsed =
    Date.parse(
      text + "T00:00:00.000Z"
    );

  if (
    Number.isNaN(parsed)
  ) {
    fail(code);
  }

  return text;
}

function exactKeys(
  record,
  allowed,
  code
) {
  const allowedKeys =
    new Set(allowed);

  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) {
      fail(code);
    }
  }
}

/**
 * FUNCTION NOTE:
 * Purpose: Validates and normalises one athlete/coach-declared body-metric entry.
 * Boundary: Exact-key allowlist only - metric_type/unit pairing is mechanical, never free text.
 * Determinism: Returns the same normalised object for the same input every time.
 * Failure: Any unknown field, unsupported metric_type/source, or out-of-range value fails closed.
 */
export function normaliseBodyMetricEntry(
  input
) {
  if (!isRecord(input)) {
    fail(
      "body_metric_entry_invalid"
    );
  }

  exactKeys(
    input,
    [
      "metric_type",
      "value",
      "effective_date",
      "source",
      "note"
    ],
    "body_metric_entry_unknown_field"
  );

  const metricType =
    cleanString(input.metric_type);

  const metricDefinition =
    METRIC_TYPES.get(metricType);

  if (!metricDefinition) {
    fail(
      "body_metric_type_unsupported"
    );
  }

  const value =
    finiteNumber(
      input.value,
      "body_metric_value_invalid"
    );

  if (
    value < metricDefinition.min ||
    value > metricDefinition.max
  ) {
    fail(
      "body_metric_value_out_of_range"
    );
  }

  const source =
    cleanString(input.source);

  if (
    !METRIC_SOURCES.has(source)
  ) {
    fail(
      "body_metric_source_unsupported"
    );
  }

  const effectiveDate =
    dateOnly(
      input.effective_date,
      "body_metric_effective_date_invalid"
    );

  const note =
    input.note === undefined ||
    input.note === null ||
    input.note === ""
      ? null
      : cleanString(input.note);

  if (
    note !== null &&
    note.length > MAX_NOTE_LENGTH
  ) {
    fail(
      "body_metric_note_too_long"
    );
  }

  return Object.freeze({
    metric_type: metricType,
    value,
    unit: metricDefinition.unit,
    effective_date: effectiveDate,
    source,
    note
  });
}

/**
 * FUNCTION NOTE:
 * Purpose: Validates a habit definition's own declared shape.
 * Boundary: Exact-key allowlist only - a habit is self-defined, never coach-authored.
 * Determinism: Returns the same normalised object for the same input every time.
 * Failure: Any unknown field, empty label, or unsupported cadence fails closed.
 */
export function normaliseHabitDefinition(
  input
) {
  if (!isRecord(input)) {
    fail(
      "habit_definition_invalid"
    );
  }

  exactKeys(
    input,
    [
      "habit_label",
      "cadence"
    ],
    "habit_definition_unknown_field"
  );

  const habitLabel =
    cleanString(input.habit_label);

  if (
    !habitLabel ||
    habitLabel.length > MAX_HABIT_LABEL_LENGTH
  ) {
    fail(
      "habit_label_invalid"
    );
  }

  const cadence =
    cleanString(input.cadence);

  if (
    !HABIT_CADENCES.has(cadence)
  ) {
    fail(
      "habit_cadence_unsupported"
    );
  }

  return Object.freeze({
    habit_label: habitLabel,
    cadence
  });
}

/**
 * FUNCTION NOTE:
 * Purpose: Validates a single habit-completion date against the habit's own cadence.
 * Boundary: Date-only, never a timestamp - "did you do it that day/week" is the only fact recorded.
 * Determinism: Returns the same normalised date string for the same input every time.
 * Failure: A malformed or missing completion_date fails closed.
 */
export function normaliseHabitCompletionDate(
  input
) {
  if (!isRecord(input)) {
    fail(
      "habit_completion_invalid"
    );
  }

  exactKeys(
    input,
    [
      "completion_date"
    ],
    "habit_completion_unknown_field"
  );

  return dateOnly(
    input.completion_date,
    "habit_completion_date_invalid"
  );
}

function cadenceIndex(
  dateOnlyString,
  cadence
) {
  const dayIndex =
    Math.floor(
      Date.parse(
        dateOnlyString + "T00:00:00.000Z"
      ) / MILLISECONDS_PER_DAY
    );

  if (cadence === "daily") {
    return dayIndex;
  }

  // ISO week index: floor(dayIndex / 7) after aligning every date to the
  // Thursday of its own ISO week - the standard ISO-8601 week algorithm.
  // This increments by exactly 1 per successive week and is stable across
  // year boundaries, unlike a raw calendar-week-number comparison.
  const date =
    new Date(
      dayIndex * MILLISECONDS_PER_DAY
    );

  const isoDayOfWeek =
    (date.getUTCDay() + 6) % 7;

  const thursdayOfWeek =
    new Date(
      date.getTime() +
        (3 - isoDayOfWeek) *
          MILLISECONDS_PER_DAY
    );

  return Math.floor(
    thursdayOfWeek.getTime() /
      (7 * MILLISECONDS_PER_DAY)
  );
}

/**
 * FUNCTION NOTE:
 * Purpose: Computes streak facts from an athlete's own raw completion-date set.
 * Boundary: Pure arithmetic over self-declared dates - no comparison to any target
 * the athlete didn't set, no weighting, no derived figure. Never persisted; always
 * reproducible from the raw fact set alone.
 * Determinism: Returns the same three integers for the same completion-date set,
 * cadence and as-of date every time.
 * Failure: An unsupported cadence fails closed; malformed dates are the caller's
 * responsibility (each one already passed through normaliseHabitCompletionDate).
 */
export function computeHabitStreak(
  completionDates,
  asOfDateInput,
  cadence
) {
  if (
    !HABIT_CADENCES.has(cadence)
  ) {
    fail(
      "habit_cadence_unsupported"
    );
  }

  const asOfDate =
    dateOnly(
      asOfDateInput,
      "habit_streak_as_of_date_invalid"
    );

  const totalCompletions =
    Array.isArray(completionDates)
      ? completionDates.length
      : 0;

  if (totalCompletions === 0) {
    return Object.freeze({
      current_streak_length: 0,
      longest_streak_length: 0,
      total_completions: 0
    });
  }

  const bucketIndices =
    [...new Set(
      completionDates.map(
        (completionDate) =>
          cadenceIndex(
            dateOnly(
              completionDate,
              "habit_streak_completion_date_invalid"
            ),
            cadence
          )
      )
    )].sort((a, b) => a - b);

  let longestStreakLength = 1;
  let runLength = 1;

  for (let index = 1; index < bucketIndices.length; index += 1) {
    if (bucketIndices[index] === bucketIndices[index - 1] + 1) {
      runLength += 1;
    }
    else {
      runLength = 1;
    }
    longestStreakLength =
      Math.max(longestStreakLength, runLength);
  }

  const lastBucketIndex =
    bucketIndices[bucketIndices.length - 1];

  let trailingRunLength = 1;
  for (
    let index = bucketIndices.length - 2;
    index >= 0;
    index -= 1
  ) {
    if (bucketIndices[index] === bucketIndices[index + 1] - 1) {
      trailingRunLength += 1;
    }
    else {
      break;
    }
  }

  const nowBucketIndex =
    cadenceIndex(asOfDate, cadence);

  // The streak stays alive until a full cadence unit has elapsed with no
  // completion (Duolingo-style: not having done "today" yet does not zero
  // the streak while today is still in progress).
  const currentStreakLength =
    nowBucketIndex - lastBucketIndex <= 1
      ? trailingRunLength
      : 0;

  return Object.freeze({
    current_streak_length: currentStreakLength,
    longest_streak_length: longestStreakLength,
    total_completions: totalCompletions
  });
}
