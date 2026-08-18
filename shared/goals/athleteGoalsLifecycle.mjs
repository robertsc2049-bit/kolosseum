// DEV NOTE: FULL-UI-37 athlete goal-setting lifecycle law. A goal is a
// self-declared fact, optionally linked to an existing body-metric type.
// When linked, its baseline is captured once at creation time from the
// athlete's then-latest body_metric_entry and never backfilled - the
// comparison direction (increase/decrease/maintain) is derived mechanically
// from target vs baseline, not asked of the athlete. Progress toward the
// target is pure arithmetic over already-declared facts, computed fresh on
// every read and never persisted, mirroring
// shared/body-metrics/bodyMetricsAndHabitsLifecycle.mjs's own boundary.

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

const GOAL_RESOLUTIONS =
  new Set([
    "achieved",
    "abandoned"
  ]);

const MAX_GOAL_LABEL_LENGTH = 120;

export class AthleteGoalsLifecycleError
  extends Error {
  constructor(code) {
    super(code);
    this.name =
      "AthleteGoalsLifecycleError";
    this.code = code;
  }
}

function fail(code) {
  throw new AthleteGoalsLifecycleError(
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

function clamp(value, min, max) {
  return Math.min(
    Math.max(value, min),
    max
  );
}

/**
 * FUNCTION NOTE:
 * Purpose: Validates and normalises one athlete-declared goal at creation.
 * Boundary: Exact-key allowlist only - target_value is required exactly
 * when metric_type is present, and rejected otherwise, so a goal never
 * carries a numeric target with nothing to measure it against.
 * Determinism: Returns the same normalised object for the same input every time.
 * Failure: Any unknown field, empty label, unsupported metric_type, or
 * mismatched target_value/metric_type pairing fails closed.
 */
export function normaliseAthleteGoalCreation(
  input
) {
  if (!isRecord(input)) {
    fail(
      "athlete_goal_creation_invalid"
    );
  }

  exactKeys(
    input,
    [
      "goal_label",
      "metric_type",
      "target_value",
      "target_date"
    ],
    "athlete_goal_creation_unknown_field"
  );

  const goalLabel =
    cleanString(input.goal_label);

  if (
    !goalLabel ||
    goalLabel.length > MAX_GOAL_LABEL_LENGTH
  ) {
    fail(
      "athlete_goal_label_invalid"
    );
  }

  const metricTypeProvided =
    input.metric_type !== undefined &&
    input.metric_type !== null &&
    input.metric_type !== "";

  if (!metricTypeProvided) {
    if (
      input.target_value !== undefined &&
      input.target_value !== null
    ) {
      fail(
        "athlete_goal_target_value_without_metric_type"
      );
    }

    const targetDate =
      input.target_date === undefined ||
      input.target_date === null ||
      input.target_date === ""
        ? null
        : dateOnly(
            input.target_date,
            "athlete_goal_target_date_invalid"
          );

    return Object.freeze({
      goal_label: goalLabel,
      metric_type: null,
      target_value: null,
      target_unit: null,
      target_date: targetDate
    });
  }

  const metricType =
    cleanString(input.metric_type);

  const metricDefinition =
    METRIC_TYPES.get(metricType);

  if (!metricDefinition) {
    fail(
      "athlete_goal_metric_type_unsupported"
    );
  }

  const targetValue =
    finiteNumber(
      input.target_value,
      "athlete_goal_target_value_invalid"
    );

  if (
    targetValue < metricDefinition.min ||
    targetValue > metricDefinition.max
  ) {
    fail(
      "athlete_goal_target_value_out_of_range"
    );
  }

  const targetDate =
    input.target_date === undefined ||
    input.target_date === null ||
    input.target_date === ""
      ? null
      : dateOnly(
          input.target_date,
          "athlete_goal_target_date_invalid"
        );

  return Object.freeze({
    goal_label: goalLabel,
    metric_type: metricType,
    target_value: targetValue,
    target_unit: metricDefinition.unit,
    target_date: targetDate
  });
}

/**
 * FUNCTION NOTE:
 * Purpose: Derives a goal's baseline value/date and comparison direction
 * from the athlete's then-latest body-metric entry at creation time.
 * Boundary: Pure arithmetic over already-declared facts - never queries
 * anything itself, never re-derives later. Callers pass the single latest
 * entry (or null) already looked up at creation time.
 * Determinism: Returns the same three fields for the same inputs every time.
 * Failure: Never throws - an unlinked goal or missing prior entry simply
 * yields null baseline fields, which is a valid, expected state.
 */
export function deriveGoalBaseline({
  targetValue,
  metricType,
  latestEntryAtCreation
}) {
  if (
    !metricType ||
    !isRecord(latestEntryAtCreation)
  ) {
    return Object.freeze({
      baseline_value: null,
      baseline_effective_date: null,
      target_direction: null
    });
  }

  const baselineValue =
    Number(latestEntryAtCreation.value);

  if (!Number.isFinite(baselineValue)) {
    return Object.freeze({
      baseline_value: null,
      baseline_effective_date: null,
      target_direction: null
    });
  }

  const targetDirection =
    targetValue > baselineValue
      ? "increase"
      : targetValue < baselineValue
        ? "decrease"
        : "maintain";

  return Object.freeze({
    baseline_value: baselineValue,
    baseline_effective_date:
      cleanString(latestEntryAtCreation.effective_date) || null,
    target_direction: targetDirection
  });
}

/**
 * FUNCTION NOTE:
 * Purpose: Validates an athlete's manual resolution of one of their own goals.
 * Boundary: Exact-key allowlist only - resolution is always athlete-declared,
 * never inferred from computed progress.
 * Determinism: Returns the same normalised object for the same input every time.
 * Failure: A missing or unsupported resolution value fails closed.
 */
export function normaliseAthleteGoalResolution(
  input
) {
  if (!isRecord(input)) {
    fail(
      "athlete_goal_resolution_invalid"
    );
  }

  exactKeys(
    input,
    [
      "resolution"
    ],
    "athlete_goal_resolution_unknown_field"
  );

  const resolution =
    cleanString(input.resolution);

  if (
    !GOAL_RESOLUTIONS.has(resolution)
  ) {
    fail(
      "athlete_goal_resolution_unsupported"
    );
  }

  return Object.freeze({
    resolution
  });
}

/**
 * FUNCTION NOTE:
 * Purpose: Computes read-time progress facts for one goal against the
 * athlete's current body-metric state - never persisted.
 * Boundary: Pure arithmetic over a goal record and (at most) one current
 * metric entry - no comparison beyond what the athlete's own declared
 * target and baseline already establish. progress_percentage is
 * deliberately clamped to [0,100] as an honest "how far along the bar"
 * fact for display; the raw current/baseline/target values are always
 * returned alongside it unclamped, so nothing is hidden.
 * Determinism: Returns the same enrichment object for the same goal record
 * and current-entry pair every time.
 * Failure: Never throws - insufficient data (no baseline, no current
 * entry, or an already-equal target/baseline) simply yields null derived
 * fields rather than a fabricated number.
 */
export function enrichAthleteGoalForRead(
  goalRecord,
  currentMetricEntryOrNull
) {
  const hasCurrentValue =
    isRecord(currentMetricEntryOrNull) &&
    Number.isFinite(Number(currentMetricEntryOrNull.value));

  const currentValue =
    hasCurrentValue
      ? Number(currentMetricEntryOrNull.value)
      : null;

  const currentEffectiveDate =
    hasCurrentValue
      ? cleanString(currentMetricEntryOrNull.effective_date) || null
      : null;

  const hasBaselineValue =
    goalRecord.baseline_value !== null &&
    goalRecord.baseline_value !== undefined;

  const targetValue = goalRecord.target_value;

  let progressPercentage = null;
  if (
    hasBaselineValue &&
    hasCurrentValue &&
    targetValue !== null &&
    targetValue !== goalRecord.baseline_value
  ) {
    progressPercentage =
      Math.round(
        clamp(
          (100 * (currentValue - goalRecord.baseline_value)) /
            (targetValue - goalRecord.baseline_value),
          0,
          100
        )
      );
  }

  let isGoalMet = null;
  if (
    hasCurrentValue &&
    targetValue !== null &&
    goalRecord.target_direction
  ) {
    if (goalRecord.target_direction === "increase") {
      isGoalMet = currentValue >= targetValue;
    }
    else if (goalRecord.target_direction === "decrease") {
      isGoalMet = currentValue <= targetValue;
    }
    else {
      isGoalMet = currentValue === targetValue;
    }
  }

  return Object.freeze({
    has_current_value: hasCurrentValue,
    current_value: currentValue,
    current_effective_date: currentEffectiveDate,
    progress_percentage: progressPercentage,
    is_goal_met: isGoalMet
  });
}
