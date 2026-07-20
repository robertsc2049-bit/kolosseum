// DEV NOTE: Product event-calendar compiler.
// This service performs explicit date and allocation arithmetic only. It does
// not select training methods, infer athlete state, recommend block types, or
// alter deterministic engine decisions.

import crypto from "node:crypto";

type JsonRecord = Record<string, unknown>;

export class EventProgrammeCompilerError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(`event_programme_compiler_${reason}`);
    this.name = "EventProgrammeCompilerError";
    this.reason = reason;
  }
}

const supportedActivities = new Set([
  "powerlifting",
  "general_strength",
  "rugby_union"
]);

const eventTypesByActivity = new Map<string, ReadonlySet<string>>([
  [
    "powerlifting",
    new Set([
      "powerlifting_meet",
      "strength_event",
      "test_day",
      "other"
    ])
  ],
  [
    "general_strength",
    new Set([
      "strength_event",
      "test_day",
      "other"
    ])
  ],
  [
    "rugby_union",
    new Set([
      "rugby_match",
      "rugby_tournament",
      "test_day",
      "other"
    ])
  ]
]);

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function exactKeys(
  record: JsonRecord,
  allowed: readonly string[],
  reason: string
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(record)) {
    if (!allowedSet.has(key)) {
      throw new EventProgrammeCompilerError(`${reason}_unknown_field`);
    }
  }
}

function integerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
  reason: string
): number {
  if (
    !Number.isInteger(value) ||
    Number(value) < minimum ||
    Number(value) > maximum
  ) {
    throw new EventProgrammeCompilerError(reason);
  }

  return Number(value);
}

function dateOnly(value: unknown, reason: string): string {
  const text = cleanString(value);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(text)) {
    throw new EventProgrammeCompilerError(reason);
  }

  const parsed = Date.parse(`${text}T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) {
    throw new EventProgrammeCompilerError(reason);
  }

  const canonical = new Date(parsed).toISOString().slice(0, 10);
  if (canonical !== text) {
    throw new EventProgrammeCompilerError(reason);
  }

  return canonical;
}

function dateToEpochDay(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00.000Z`) / 86400000);
}

function epochDayToDate(day: number): string {
  return new Date(day * 86400000).toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  return epochDayToDate(dateToEpochDay(date) + days);
}

function dayDifference(fromDate: string, toDate: string): number {
  return dateToEpochDay(toDate) - dateToEpochDay(fromDate);
}

function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalise);

  if (isRecord(value)) {
    const output: JsonRecord = {};
    for (const key of Object.keys(value).sort()) {
      output[key] = canonicalise(value[key]);
    }
    return output;
  }

  return value;
}

function sha256(value: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalise(value)), "utf8")
    .digest("hex");
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      if (child !== null && typeof child === "object" && !Object.isFrozen(child)) {
        deepFreeze(child);
      }
    }
  }
  return value;
}

export type EventCompilerBlockInput = Readonly<{
  block_id?: string;
  order_index: number;
  name: string;
  block_type: string;
  week_count: number;
}>;

export type EventProgrammeCompilerInput = Readonly<{
  activity_id: string;
  event_plan_id?: string;
  event_name: string;
  event_type: string;
  event_date: string;
  programme_start_date: string;
  location?: string;
  timezone?: string;
  notes?: string;
  blocks: readonly EventCompilerBlockInput[];
}>;

export function compileEventProgrammeCalendar(
  inputValue: unknown
): Readonly<JsonRecord> {
  if (!isRecord(inputValue)) {
    throw new EventProgrammeCompilerError("input_invalid");
  }

  exactKeys(
    inputValue,
    [
      "activity_id",
      "event_plan_id",
      "event_name",
      "event_type",
      "event_date",
      "programme_start_date",
      "location",
      "timezone",
      "notes",
      "blocks"
    ],
    "event_plan"
  );

  const activityId = cleanString(inputValue.activity_id);
  if (!supportedActivities.has(activityId)) {
    throw new EventProgrammeCompilerError("activity_invalid");
  }

  const eventName = cleanString(inputValue.event_name);
  if (!eventName || eventName.length > 120) {
    throw new EventProgrammeCompilerError("event_name_invalid");
  }

  const eventType = cleanString(inputValue.event_type);
  if (!eventTypesByActivity.get(activityId)?.has(eventType)) {
    throw new EventProgrammeCompilerError("event_type_invalid_for_activity");
  }

  const eventDate = dateOnly(inputValue.event_date, "event_date_invalid");
  const programmeStartDate = dateOnly(
    inputValue.programme_start_date,
    "programme_start_date_invalid"
  );

  const trainingDayCount = dayDifference(programmeStartDate, eventDate);
  if (trainingDayCount < 1) {
    throw new EventProgrammeCompilerError("event_must_follow_programme_start");
  }

  const requiredWeekCount = Math.ceil(trainingDayCount / 7);
  if (requiredWeekCount < 1 || requiredWeekCount > 104) {
    throw new EventProgrammeCompilerError("event_week_count_invalid");
  }

  const location = cleanString(inputValue.location);
  if (location.length > 200) {
    throw new EventProgrammeCompilerError("event_location_too_long");
  }

  const timezone = cleanString(inputValue.timezone) || "Europe/London";
  if (timezone.length > 80 || !/^[A-Za-z0-9_+\-/]+$/u.test(timezone)) {
    throw new EventProgrammeCompilerError("event_timezone_invalid");
  }

  const notes = cleanString(inputValue.notes);
  if (notes.length > 1000) {
    throw new EventProgrammeCompilerError("event_notes_too_long");
  }

  if (!Array.isArray(inputValue.blocks) || inputValue.blocks.length < 1 || inputValue.blocks.length > 12) {
    throw new EventProgrammeCompilerError("block_count_invalid");
  }

  let allocatedWeekCount = 0;

  const blocks = inputValue.blocks.map((rawBlock, blockIndex) => {
    if (!isRecord(rawBlock)) {
      throw new EventProgrammeCompilerError("block_invalid");
    }

    exactKeys(
      rawBlock,
      [
        "block_id",
        "order_index",
        "name",
        "block_type",
        "week_count"
      ],
      "block"
    );

    const orderIndex = integerInRange(
      rawBlock.order_index,
      1,
      12,
      "block_order_invalid"
    );

    if (orderIndex !== blockIndex + 1) {
      throw new EventProgrammeCompilerError("block_order_not_contiguous");
    }

    const weekCount = integerInRange(
      rawBlock.week_count,
      1,
      52,
      "block_week_count_invalid"
    );

    const blockStartWeekIndex = allocatedWeekCount + 1;
    const startDate = addDays(programmeStartDate, allocatedWeekCount * 7);
    allocatedWeekCount += weekCount;
    const blockEndWeekIndex = allocatedWeekCount;
    const theoreticalEndDate = addDays(startDate, weekCount * 7 - 1);
    const finalTrainingDate = addDays(eventDate, -1);
    const endDate = theoreticalEndDate > finalTrainingDate
      ? finalTrainingDate
      : theoreticalEndDate;

    return deepFreeze({
      block_id: cleanString(rawBlock.block_id) || null,
      order_index: orderIndex,
      name: cleanString(rawBlock.name) || `Block ${orderIndex}`,
      block_type: cleanString(rawBlock.block_type) || "general",
      week_count: weekCount,
      start_week_index: blockStartWeekIndex,
      end_week_index: blockEndWeekIndex,
      start_date: startDate,
      end_date: endDate,
      days_until_event_at_block_start: dayDifference(startDate, eventDate)
    });
  });

  if (allocatedWeekCount > 104) {
    throw new EventProgrammeCompilerError("total_week_count_invalid");
  }

  const weekDelta = requiredWeekCount - allocatedWeekCount;
  const allocationState = weekDelta === 0
    ? "balanced"
    : weekDelta > 0
      ? "under_allocated"
      : "over_allocated";

  const partialFinalWeekDays = trainingDayCount - ((requiredWeekCount - 1) * 7);
  const eventPlanId = cleanString(inputValue.event_plan_id) ||
    `event_plan_${sha256({
      activityId,
      eventName,
      eventType,
      eventDate,
      programmeStartDate,
      location,
      timezone
    }).slice(0, 24)}`;

  if (!/^[a-z0-9_:-]+$/u.test(eventPlanId)) {
    throw new EventProgrammeCompilerError("event_plan_id_invalid");
  }

  return deepFreeze({
    event_plan_id: eventPlanId,
    activity_id: activityId,
    event_name: eventName,
    event_type: eventType,
    event_date: eventDate,
    programme_start_date: programmeStartDate,
    location: location || null,
    timezone,
    notes: notes || null,
    training_day_count: trainingDayCount,
    required_week_count: requiredWeekCount,
    allocated_week_count: allocatedWeekCount,
    week_delta: weekDelta,
    allocation_state: allocationState,
    partial_final_week_days: partialFinalWeekDays,
    final_training_date: addDays(eventDate, -1),
    blocks
  });
}

export function eventWeekCalendar(
  compileResultValue: unknown
): readonly Readonly<JsonRecord>[] {
  if (!isRecord(compileResultValue)) {
    throw new EventProgrammeCompilerError("compile_result_invalid");
  }

  const programmeStartDate = dateOnly(
    compileResultValue.programme_start_date,
    "stored_programme_start_date_invalid"
  );
  const eventDate = dateOnly(
    compileResultValue.event_date,
    "stored_event_date_invalid"
  );
  const requiredWeekCount = integerInRange(
    compileResultValue.required_week_count,
    1,
    104,
    "stored_required_week_count_invalid"
  );

  const weeks: Readonly<JsonRecord>[] = [];
  for (let index = 0; index < requiredWeekCount; index += 1) {
    const startDate = addDays(programmeStartDate, index * 7);
    const theoreticalEndDate = addDays(startDate, 6);
    const finalTrainingDate = addDays(eventDate, -1);
    const endDate = theoreticalEndDate > finalTrainingDate
      ? finalTrainingDate
      : theoreticalEndDate;

    weeks.push(deepFreeze({
      week_index_global: index + 1,
      start_date: startDate,
      end_date: endDate,
      days_until_event_at_week_start: dayDifference(startDate, eventDate),
      partial_week: dayDifference(startDate, endDate) + 1 < 7
    }));
  }

  return deepFreeze(weeks);
}
