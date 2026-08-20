// DEV NOTE: FULL-UI-64 weekly check-in lifecycle law. A weekly check-in is
// a self-declared, self-submitted factual wellness snapshot - energy,
// motivation and sleep-quality ratings plus an optional note - never a
// computed readiness/wellness score, mirroring
// shared/body-metrics/bodyMetricsAndHabitsLifecycle.mjs's own boundary.
// Exactly one check-in is accepted per athlete per week_start_date; a
// second submission for the same date is rejected by the caller rather
// than silently overwritten or silently deduped, since the values
// genuinely differ and neither the API nor the athlete should guess which
// one is authoritative.

const RATING_MIN = 1;
const RATING_MAX = 5;
const MAX_NOTE_LENGTH = 280;

export class WeeklyCheckinLifecycleError
  extends Error {
  constructor(code) {
    super(code);
    this.name =
      "WeeklyCheckinLifecycleError";
    this.code = code;
  }
}

function fail(code) {
  throw new WeeklyCheckinLifecycleError(
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

function rating(
  value,
  code
) {
  const number =
    Number(value);

  if (
    !Number.isInteger(number) ||
    number < RATING_MIN ||
    number > RATING_MAX
  ) {
    fail(code);
  }

  return number;
}

/**
 * FUNCTION NOTE:
 * Purpose: Validates and normalises one athlete-declared weekly check-in.
 * Boundary: Exact-key allowlist only - three 1-5 self-ratings and an
 * optional note, never a computed or weighted score.
 * Determinism: Returns the same normalised object for the same input every time.
 * Failure: Any unknown field, malformed date, out-of-range rating, or
 * over-length note fails closed.
 */
export function normaliseWeeklyCheckin(
  input
) {
  if (!isRecord(input)) {
    fail(
      "weekly_checkin_invalid"
    );
  }

  exactKeys(
    input,
    [
      "week_start_date",
      "energy_level",
      "motivation_level",
      "sleep_quality",
      "note"
    ],
    "weekly_checkin_unknown_field"
  );

  const weekStartDate =
    dateOnly(
      input.week_start_date,
      "weekly_checkin_week_start_date_invalid"
    );

  const energyLevel =
    rating(
      input.energy_level,
      "weekly_checkin_energy_level_invalid"
    );

  const motivationLevel =
    rating(
      input.motivation_level,
      "weekly_checkin_motivation_level_invalid"
    );

  const sleepQuality =
    rating(
      input.sleep_quality,
      "weekly_checkin_sleep_quality_invalid"
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
      "weekly_checkin_note_too_long"
    );
  }

  return Object.freeze({
    week_start_date: weekStartDate,
    energy_level: energyLevel,
    motivation_level: motivationLevel,
    sleep_quality: sleepQuality,
    note
  });
}
