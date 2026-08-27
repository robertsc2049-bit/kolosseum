// DEV NOTE: BETA-18 coach-authored programme template product state.
// This service validates coach-authored templates against the active exercise
// registry, persists immutable product records, and materialises an explicit
// planned_items programme for the existing deterministic Phase 6 boundary.
// It does not expose formula internals, or let coach notes, UI state, billing
// state, or relationship state alter prescriptions. Resistance work may be
// prescribed by percent_1rm, fixed weight, bodyweight, or RPE - RPE is an
// explicit coach-entered value passed through as-is, never inferred or
// resolved to a weight.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { pool } from "../db/pool.js";
import {
  loadLatestBetaProductRecord,
  persistBetaProductRecord
} from "./beta_product_record_store.js";
import {
  loadAthleteStrengthProfile,
  resolvePercentageLoad
} from "./beta19_coach_workspace_service.js";
import {
  compileEventProgrammeCalendar,
  eventWeekCalendar
} from "./event_programme_compiler_service.js";

type JsonRecord = Record<string, unknown>;

export class Beta18ProgrammeTemplateError
  extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(`beta18_programme_template_${reason}`);
    this.name = "Beta18ProgrammeTemplateError";
    this.reason = reason;
  }
}

const supportedActivities =
  new Set([
    "powerlifting",
    "general_strength",
    "rugby_union"
  ]);

const templateStatuses =
  new Set([
    "draft",
    "complete",
    "active",
    "archived"
  ]);

const workItemRoles =
  new Set([
    "primary",
    "accessory"
  ]);

const workItemSegments =
  new Set([
    "warm_up",
    "working",
    "cool_down"
  ]);

const workItemGroupTypes =
  new Set([
    "straight",
    "superset",
    "circuit"
  ]);

const MAX_WORK_ITEMS_PER_SESSION = 12;

const trainingBlockTypes =
  new Set([
    "general",
    "volume",
    "strength",
    "peak",
    "deload",
    "custom"
  ]);

const repModes =
  new Set([
    "fixed",
    "range"
  ]);

const loadModes =
  new Set([
    "percent_1rm",
    "fixed_weight",
    "bodyweight",
    "rpe"
  ]);

const weightUnits =
  new Set([
    "kg",
    "lb"
  ]);

const prescriptionModes =
  new Set([
    "reps",
    "duration",
    "distance"
  ]);

const distanceUnits =
  new Set([
    "meters",
    "feet"
  ]);

export function isCoachAuthoredTemplateId(
  value: unknown
): boolean {
  return cleanString(value)
    .startsWith(
      "coach_template_"
    );
}

function isRecord(
  value: unknown
): value is JsonRecord {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function cleanString(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
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
    throw new Beta18ProgrammeTemplateError(
      reason
    );
  }

  return Number(value);
}

function numberInRange(
  value: unknown,
  minimum: number,
  maximum: number,
  reason: string
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Beta18ProgrammeTemplateError(
      reason
    );
  }

  const normalised =
    Number(value.toFixed(3));

  if (
    Math.abs(
      value - normalised
    ) > 0.0000001
  ) {
    throw new Beta18ProgrammeTemplateError(
      `${reason}_precision_invalid`
    );
  }

  return normalised;
}

type RepPrescription =
  | Readonly<{
      type: "fixed";
      value: number;
    }>
  | Readonly<{
      type: "range";
      minimum: number;
      maximum: number;
    }>;

type LoadingReference =
  | Readonly<{
      type: "percent_1rm";
      value: number;
    }>
  | Readonly<{
      type: "load";
      value: number;
      unit: "kg" | "lb";
    }>
  | Readonly<{
      type: "bodyweight";
    }>
  | Readonly<{
      type: "rpe";
      value: number;
    }>;

type DurationPrescription =
  | Readonly<{
      type: "fixed";
      value: number;
    }>
  | Readonly<{
      type: "range";
      minimum: number;
      maximum: number;
    }>;

type DistancePrescription =
  | Readonly<{
      type: "fixed";
      value: number;
      unit: "meters" | "feet";
    }>
  | Readonly<{
      type: "range";
      minimum: number;
      maximum: number;
      unit: "meters" | "feet";
    }>;

function repPrescriptionFromInput(
  workItem: JsonRecord
): Readonly<{
  planned_reps: number;
  rep_prescription: RepPrescription;
}> {
  const repMode =
    cleanString(
      workItem.rep_mode
    ) ||
    (
      typeof workItem.rep_min !==
        "undefined" ||
      typeof workItem.rep_max !==
        "undefined"
        ? "range"
        : "fixed"
    );

  if (!repModes.has(repMode)) {
    throw new Beta18ProgrammeTemplateError(
      "rep_mode_invalid"
    );
  }

  if (repMode === "range") {
    const minimum =
      integerInRange(
        workItem.rep_min,
        1,
        100,
        "rep_range_min_invalid"
      );

    const maximum =
      integerInRange(
        workItem.rep_max,
        1,
        100,
        "rep_range_max_invalid"
      );

    if (minimum > maximum) {
      throw new Beta18ProgrammeTemplateError(
        "rep_range_order_invalid"
      );
    }

    return deepFreeze({
      planned_reps:
        minimum,
      rep_prescription:
        deepFreeze({
          type: "range",
          minimum,
          maximum
        })
    });
  }

  const value =
    integerInRange(
      workItem.planned_reps,
      1,
      100,
      "planned_reps_invalid"
    );

  return deepFreeze({
    planned_reps:
      value,
    rep_prescription:
      deepFreeze({
        type: "fixed",
        value
      })
  });
}

function loadingReferenceFromInput(
  workItem: JsonRecord
): LoadingReference {
  const loadMode =
    cleanString(
      workItem.load_mode
    ) ||
    "percent_1rm";

  if (!loadModes.has(loadMode)) {
    throw new Beta18ProgrammeTemplateError(
      "load_mode_invalid"
    );
  }

  if (loadMode === "bodyweight") {
    return deepFreeze({
      type: "bodyweight"
    });
  }

  if (loadMode === "rpe") {
    return deepFreeze({
      type: "rpe",
      value:
        integerInRange(
          workItem.rpe_value,
          1,
          10,
          "rpe_value_invalid"
        )
    });
  }

  if (loadMode === "fixed_weight") {
    const value =
      numberInRange(
        workItem.weight_value,
        0.25,
        1000,
        "weight_value_invalid"
      );

    const unit =
      cleanString(
        workItem.weight_unit
      ) ||
      "kg";

    if (!weightUnits.has(unit)) {
      throw new Beta18ProgrammeTemplateError(
        "weight_unit_invalid"
      );
    }

    return deepFreeze({
      type: "load",
      value,
      unit:
        unit as "kg" | "lb"
    });
  }

  return deepFreeze({
    type: "percent_1rm",
    value:
      numberInRange(
        workItem.percent_1rm,
        1,
        100,
        "percent_1rm_invalid"
      )
  });
}

function durationPrescriptionFromInput(
  workItem: JsonRecord
): Readonly<{
  planned_duration_seconds: number;
  duration_prescription: DurationPrescription;
}> {
  const durationMode =
    cleanString(
      workItem.duration_mode
    ) ||
    "fixed";

  if (!repModes.has(durationMode)) {
    throw new Beta18ProgrammeTemplateError(
      "duration_mode_invalid"
    );
  }

  if (durationMode === "range") {
    const minimum =
      integerInRange(
        workItem.duration_min_seconds,
        1,
        1800,
        "duration_range_min_invalid"
      );

    const maximum =
      integerInRange(
        workItem.duration_max_seconds,
        1,
        1800,
        "duration_range_max_invalid"
      );

    if (minimum > maximum) {
      throw new Beta18ProgrammeTemplateError(
        "duration_range_order_invalid"
      );
    }

    return deepFreeze({
      planned_duration_seconds:
        minimum,
      duration_prescription:
        deepFreeze({
          type: "range",
          minimum,
          maximum
        })
    });
  }

  const value =
    integerInRange(
      workItem.planned_duration_seconds,
      1,
      1800,
      "planned_duration_seconds_invalid"
    );

  return deepFreeze({
    planned_duration_seconds:
      value,
    duration_prescription:
      deepFreeze({
        type: "fixed",
        value
      })
  });
}

function distancePrescriptionFromInput(
  workItem: JsonRecord
): Readonly<{
  planned_distance_value: number;
  distance_prescription: DistancePrescription;
}> {
  const distanceMode =
    cleanString(
      workItem.distance_mode
    ) ||
    "fixed";

  if (!repModes.has(distanceMode)) {
    throw new Beta18ProgrammeTemplateError(
      "distance_mode_invalid"
    );
  }

  const unit =
    cleanString(
      workItem.distance_unit
    ) ||
    "meters";

  if (!distanceUnits.has(unit)) {
    throw new Beta18ProgrammeTemplateError(
      "distance_unit_invalid"
    );
  }

  if (distanceMode === "range") {
    const minimum =
      numberInRange(
        workItem.distance_min_value,
        0.1,
        10000,
        "distance_range_min_invalid"
      );

    const maximum =
      numberInRange(
        workItem.distance_max_value,
        0.1,
        10000,
        "distance_range_max_invalid"
      );

    if (minimum > maximum) {
      throw new Beta18ProgrammeTemplateError(
        "distance_range_order_invalid"
      );
    }

    return deepFreeze({
      planned_distance_value:
        minimum,
      distance_prescription:
        deepFreeze({
          type: "range",
          minimum,
          maximum,
          unit:
            unit as "meters" | "feet"
        })
    });
  }

  const value =
    numberInRange(
      workItem.planned_distance_value,
      0.1,
      10000,
      "planned_distance_value_invalid"
    );

  return deepFreeze({
    planned_distance_value:
      value,
    distance_prescription:
      deepFreeze({
        type: "fixed",
        value,
        unit:
          unit as "meters" | "feet"
      })
  });
}

function validateWorkItemGrouping(
  workItems: ReadonlyArray<
    Readonly<{
      order_index: number;
      group_id: string;
      group_type: string;
    }>
  >
): void {
  const groupOrderIndices =
    new Map<string, number[]>();
  const groupTypes =
    new Map<string, string>();

  for (const workItem of workItems) {
    if (workItem.group_id === "") continue;

    const orderIndices =
      groupOrderIndices.get(
        workItem.group_id
      ) ?? [];
    orderIndices.push(
      workItem.order_index
    );
    groupOrderIndices.set(
      workItem.group_id,
      orderIndices
    );

    const existingType =
      groupTypes.get(workItem.group_id);
    if (
      existingType !== undefined &&
      existingType !== workItem.group_type
    ) {
      throw new Beta18ProgrammeTemplateError(
        "work_item_group_type_mismatch"
      );
    }
    groupTypes.set(
      workItem.group_id,
      workItem.group_type
    );
  }

  for (const [
    ,
    orderIndices
  ] of groupOrderIndices) {
    if (orderIndices.length < 2) {
      throw new Beta18ProgrammeTemplateError(
        "work_item_group_too_small"
      );
    }

    const sorted =
      [...orderIndices].sort(
        (a, b) => a - b
      );

    for (
      let index = 1;
      index < sorted.length;
      index += 1
    ) {
      if (
        sorted[index] !==
          sorted[index - 1] + 1
      ) {
        throw new Beta18ProgrammeTemplateError(
          "work_item_group_not_contiguous"
        );
      }
    }
  }
}

function repPrescriptionFromStored(
  workItem: JsonRecord
): RepPrescription {
  const raw =
    isRecord(
      workItem.rep_prescription
    )
      ? workItem.rep_prescription
      : {};

  if (
    cleanString(raw.type) ===
      "range"
  ) {
    const minimum =
      integerInRange(
        raw.minimum,
        1,
        100,
        "stored_rep_range_min_invalid"
      );

    const maximum =
      integerInRange(
        raw.maximum,
        1,
        100,
        "stored_rep_range_max_invalid"
      );

    if (minimum > maximum) {
      throw new Beta18ProgrammeTemplateError(
        "stored_rep_range_order_invalid"
      );
    }

    return deepFreeze({
      type: "range",
      minimum,
      maximum
    });
  }

  const value =
    integerInRange(
      raw.value ??
        workItem.planned_reps,
      1,
      100,
      "stored_fixed_reps_invalid"
    );

  return deepFreeze({
    type: "fixed",
    value
  });
}

function loadingReferenceFromStored(
  workItem: JsonRecord
): LoadingReference {
  const raw =
    isRecord(
      workItem.loading_reference
    )
      ? workItem.loading_reference
      : {};

  const type =
    cleanString(raw.type) ||
    "percent_1rm";

  if (type === "bodyweight") {
    return deepFreeze({
      type: "bodyweight"
    });
  }

  if (type === "load") {
    const unit =
      cleanString(raw.unit) ||
      "kg";

    if (!weightUnits.has(unit)) {
      throw new Beta18ProgrammeTemplateError(
        "stored_weight_unit_invalid"
      );
    }

    return deepFreeze({
      type: "load",
      value:
        numberInRange(
          raw.value,
          0.25,
          1000,
          "stored_weight_value_invalid"
        ),
      unit:
        unit as "kg" | "lb"
    });
  }

  if (type === "rpe") {
    return deepFreeze({
      type: "rpe",
      value:
        integerInRange(
          raw.value,
          1,
          10,
          "stored_rpe_value_invalid"
        )
    });
  }

  if (type !== "percent_1rm") {
    throw new Beta18ProgrammeTemplateError(
      "stored_load_mode_invalid"
    );
  }

  return deepFreeze({
    type: "percent_1rm",
    value:
      numberInRange(
        raw.value,
        1,
        100,
        "stored_percent_1rm_invalid"
      )
  });
}

function prescriptionModeFromStored(
  workItem: JsonRecord
): "reps" | "duration" | "distance" {
  const mode =
    cleanString(
      workItem.prescription_mode
    ) ||
    "reps";

  return prescriptionModes.has(mode)
    ? (mode as
        | "reps"
        | "duration"
        | "distance")
    : "reps";
}

function durationPrescriptionFromStored(
  workItem: JsonRecord
): DurationPrescription {
  const raw =
    isRecord(
      workItem.duration_prescription
    )
      ? workItem.duration_prescription
      : {};

  if (
    cleanString(raw.type) ===
      "range"
  ) {
    const minimum =
      integerInRange(
        raw.minimum,
        1,
        1800,
        "stored_duration_range_min_invalid"
      );

    const maximum =
      integerInRange(
        raw.maximum,
        1,
        1800,
        "stored_duration_range_max_invalid"
      );

    if (minimum > maximum) {
      throw new Beta18ProgrammeTemplateError(
        "stored_duration_range_order_invalid"
      );
    }

    return deepFreeze({
      type: "range",
      minimum,
      maximum
    });
  }

  const value =
    integerInRange(
      raw.value ??
        workItem.planned_duration_seconds,
      1,
      1800,
      "stored_fixed_duration_invalid"
    );

  return deepFreeze({
    type: "fixed",
    value
  });
}

function distancePrescriptionFromStored(
  workItem: JsonRecord
): DistancePrescription {
  const raw =
    isRecord(
      workItem.distance_prescription
    )
      ? workItem.distance_prescription
      : {};

  const unit =
    cleanString(raw.unit) ||
    "meters";

  if (!distanceUnits.has(unit)) {
    throw new Beta18ProgrammeTemplateError(
      "stored_distance_unit_invalid"
    );
  }

  if (
    cleanString(raw.type) ===
      "range"
  ) {
    const minimum =
      numberInRange(
        raw.minimum,
        0.1,
        10000,
        "stored_distance_range_min_invalid"
      );

    const maximum =
      numberInRange(
        raw.maximum,
        0.1,
        10000,
        "stored_distance_range_max_invalid"
      );

    if (minimum > maximum) {
      throw new Beta18ProgrammeTemplateError(
        "stored_distance_range_order_invalid"
      );
    }

    return deepFreeze({
      type: "range",
      minimum,
      maximum,
      unit:
        unit as "meters" | "feet"
    });
  }

  const value =
    numberInRange(
      raw.value ??
        workItem.planned_distance_value,
      0.1,
      10000,
      "stored_fixed_distance_invalid"
    );

  return deepFreeze({
    type: "fixed",
    value,
    unit:
      unit as "meters" | "feet"
  });
}

function iso8601(
  value: unknown,
  reason: string
): string {
  const text = cleanString(value);
  const timestamp = Date.parse(text);

  if (
    !text ||
    !Number.isFinite(timestamp)
  ) {
    throw new Beta18ProgrammeTemplateError(
      reason
    );
  }

  return new Date(timestamp).toISOString();
}

function canonicalise(
  value: unknown
): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalise);
  }

  if (isRecord(value)) {
    const output: JsonRecord = {};

    for (
      const key of Object.keys(value).sort()
    ) {
      output[key] =
        canonicalise(value[key]);
    }

    return output;
  }

  return value;
}

function sha256(
  value: unknown
): string {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify(
        canonicalise(value)
      ),
      "utf8"
    )
    .digest("hex");
}

function deepFreeze<T>(
  value: T
): T {
  if (
    value !== null &&
    typeof value === "object"
  ) {
    Object.freeze(value);

    for (
      const child of Object.values(
        value as Record<string, unknown>
      )
    ) {
      if (
        child !== null &&
        typeof child === "object" &&
        !Object.isFrozen(child)
      ) {
        deepFreeze(child);
      }
    }
  }

  return value;
}

function cloneRecord(
  value: JsonRecord
): JsonRecord {
  return JSON.parse(
    JSON.stringify(value)
  ) as JsonRecord;
}

function exactKeys(
  record: JsonRecord,
  allowed: readonly string[],
  reason: string
): void {
  const allowedKeys =
    new Set(allowed);

  for (
    const key of Object.keys(record)
  ) {
    if (!allowedKeys.has(key)) {
      throw new Beta18ProgrammeTemplateError(
        `${reason}_unknown_field`
      );
    }
  }
}

function titleFromId(
  value: string
): string {
  return value
    .replaceAll("_", " ")
    .replace(
      /\b\w/gu,
      (letter) => letter.toUpperCase()
    );
}

function loadExerciseRegistry(): Readonly<{
  registry_id: string;
  version: string;
  entries: Readonly<Record<string, JsonRecord>>;
}> {
  const registryPath =
    path.resolve(
      process.cwd(),
      "registries",
      "exercise",
      "exercise.registry.json"
    );

  const parsed =
    JSON.parse(
      fs.readFileSync(
        registryPath,
        "utf8"
      )
    ) as unknown;

  if (
    !isRecord(parsed) ||
    cleanString(parsed.registry_id) !==
      "exercise" ||
    !isRecord(parsed.entries)
  ) {
    throw new Beta18ProgrammeTemplateError(
      "active_exercise_registry_invalid"
    );
  }

  const entries: Record<string, JsonRecord> =
    {};

  for (
    const [
      exerciseId,
      rawEntry
    ] of Object.entries(parsed.entries)
  ) {
    if (
      !isRecord(rawEntry) ||
      cleanString(
        rawEntry.exercise_id
      ) !== exerciseId
    ) {
      throw new Beta18ProgrammeTemplateError(
        "active_exercise_registry_entry_invalid"
      );
    }

    entries[exerciseId] =
      rawEntry;
  }

  return deepFreeze({
    registry_id: "exercise",
    version:
      cleanString(parsed.version) ||
      "unknown",
    entries
  });
}

export async function requireActiveCoach(
  coachUserId: string
): Promise<Readonly<JsonRecord>> {
  const coachProfile =
    await loadLatestBetaProductRecord(
      "beta17_coach_profile",
      coachUserId,
      coachUserId
    );

  if (
    !coachProfile ||
    coachProfile.account_role !==
      "coach" ||
    coachProfile.account_state !==
      "active"
  ) {
    throw new Beta18ProgrammeTemplateError(
      "coach_access_denied"
    );
  }

  return coachProfile;
}

function templateInputBlocks(
  input: JsonRecord
): readonly JsonRecord[] {
  if (Array.isArray(input.blocks)) {
    if (
      input.blocks.length < 1 ||
      input.blocks.length > 12
    ) {
      throw new Beta18ProgrammeTemplateError(
        "block_count_invalid"
      );
    }

    return input.blocks.map((block) => {
      if (!isRecord(block)) {
        throw new Beta18ProgrammeTemplateError(
          "block_invalid"
        );
      }
      return block;
    });
  }

  if (Array.isArray(input.weeks)) {
    return [
      {
        block_id: "",
        order_index: 1,
        name: "Block 1",
        description: "",
        block_type: "general",
        weeks: input.weeks
      }
    ];
  }

  throw new Beta18ProgrammeTemplateError(
    "blocks_required"
  );
}

function compileEventPlanFromInput(
  input: JsonRecord,
  rawBlocks: readonly JsonRecord[]
): Readonly<JsonRecord> | null {
  if (
    input.event_plan === null ||
    typeof input.event_plan === "undefined"
  ) {
    return null;
  }

  if (!isRecord(input.event_plan)) {
    throw new Beta18ProgrammeTemplateError(
      "event_plan_invalid"
    );
  }

  try {
    return compileEventProgrammeCalendar({
      ...input.event_plan,
      activity_id:
        cleanString(input.activity_id),
      blocks:
        rawBlocks.map(
          (
            rawBlock,
            blockIndex
          ) => ({
            block_id:
              cleanString(
                rawBlock.block_id
              ),
            order_index:
              Number(
                rawBlock.order_index ??
                blockIndex + 1
              ),
            name:
              cleanString(
                rawBlock.name
              ) ||
              `Block ${blockIndex + 1}`,
            block_type:
              cleanString(
                rawBlock.block_type
              ) ||
              "general",
            week_count:
              Number(
                rawBlock.week_count ??
                (
                  Array.isArray(
                    rawBlock.weeks
                  )
                    ? rawBlock.weeks.length
                    : 0
                )
              )
          })
        )
    });
  }
  catch (error) {
    const reason =
      error &&
      typeof error === "object" &&
      "reason" in error &&
      typeof error.reason === "string"
        ? error.reason
        : "event_compile_failed";

    throw new Beta18ProgrammeTemplateError(
      reason
    );
  }
}

type NormalisedTemplateStructure =
  Readonly<{
    template_structure: Readonly<JsonRecord>;
    exercise_ids: readonly string[];
    equipment_ids: readonly string[];
    block_count: number;
    week_count: number;
    session_count: number;
    event_plan: Readonly<JsonRecord> | null;
    event_compile_summary: Readonly<JsonRecord> | null;
  }>;

function normaliseTemplateStructure(
  input: JsonRecord,
  templateId: string,
  registry:
    ReturnType<
      typeof loadExerciseRegistry
    >
): NormalisedTemplateStructure {
  const rawBlocks =
    templateInputBlocks(input);

  const eventCompile =
    compileEventPlanFromInput(
      input,
      rawBlocks
    );

  const eventWeeks =
    eventCompile
      ? eventWeekCalendar(
          eventCompile
        )
      : [];

  const exerciseIds =
    new Set<string>();

  const equipmentIds =
    new Set<string>();

  let weekCount = 0;
  let sessionCount = 0;
  let globalWeekIndex = 0;

  const blocks =
    rawBlocks.map(
      (
        rawBlock,
        blockIndex
      ) => {
        exactKeys(
          rawBlock,
          [
            "block_id",
            "order_index",
            "name",
            "description",
            "block_type",
            "week_count",
            "weeks"
          ],
          "block"
        );

        const blockOrder =
          integerInRange(
            rawBlock.order_index,
            1,
            12,
            "block_order_invalid"
          );

        if (
          blockOrder !==
          blockIndex + 1
        ) {
          throw new Beta18ProgrammeTemplateError(
            "block_order_not_contiguous"
          );
        }

        const blockId =
          cleanString(
            rawBlock.block_id
          ) ||
          `${templateId}_block_${blockOrder}`;

        const blockName =
          cleanString(
            rawBlock.name
          ) ||
          `Block ${blockOrder}`;

        if (blockName.length > 120) {
          throw new Beta18ProgrammeTemplateError(
            "block_name_too_long"
          );
        }

        const blockDescription =
          cleanString(
            rawBlock.description
          );

        if (blockDescription.length > 500) {
          throw new Beta18ProgrammeTemplateError(
            "block_description_too_long"
          );
        }

        const blockType =
          cleanString(
            rawBlock.block_type
          ) ||
          "general";

        if (!trainingBlockTypes.has(blockType)) {
          throw new Beta18ProgrammeTemplateError(
            "block_type_invalid"
          );
        }

        if (
          !Array.isArray(
            rawBlock.weeks
          ) ||
          rawBlock.weeks.length < 1 ||
          rawBlock.weeks.length > 52
        ) {
          throw new Beta18ProgrammeTemplateError(
            "week_count_per_block_invalid"
          );
        }

        const declaredWeekCount =
          integerInRange(
            rawBlock.week_count ??
              rawBlock.weeks.length,
            1,
            52,
            "block_week_count_invalid"
          );

        if (
          declaredWeekCount !==
          rawBlock.weeks.length
        ) {
          throw new Beta18ProgrammeTemplateError(
            "block_week_count_mismatch"
          );
        }

        const eventBlockSchedule =
          eventCompile &&
          Array.isArray(
            eventCompile.blocks
          ) &&
          isRecord(
            eventCompile.blocks[
              blockIndex
            ]
          )
            ? eventCompile.blocks[
                blockIndex
              ]
            : null;

        weekCount += rawBlock.weeks.length;

        if (weekCount > 104) {
          throw new Beta18ProgrammeTemplateError(
            "total_week_count_invalid"
          );
        }

        const weeks =
          rawBlock.weeks.map(
            (
              rawWeek,
              weekIndex
            ) => {
              if (!isRecord(rawWeek)) {
                throw new Beta18ProgrammeTemplateError(
                  "week_invalid"
                );
              }

              const calendarWeek =
                eventWeeks[
                  globalWeekIndex
                ] ??
                null;

              globalWeekIndex += 1;

              exactKeys(
                rawWeek,
                [
                  "week_id",
                  "order_index",
                  "sessions"
                ],
                "week"
              );

              const orderIndex =
                integerInRange(
                  rawWeek.order_index,
                  1,
                  52,
                  "week_order_invalid"
                );

              if (
                orderIndex !==
                weekIndex + 1
              ) {
                throw new Beta18ProgrammeTemplateError(
                  "week_order_not_contiguous"
                );
              }

              const weekId =
                cleanString(
                  rawWeek.week_id
                ) ||
                `${blockId}_week_${orderIndex}`;

              if (
                !Array.isArray(
                  rawWeek.sessions
                ) ||
                rawWeek.sessions.length < 1 ||
                rawWeek.sessions.length > 7
              ) {
                throw new Beta18ProgrammeTemplateError(
                  "session_count_per_week_invalid"
                );
              }

              const days =
                rawWeek.sessions.map(
                  (
                    rawSession,
                    sessionIndex
                  ) => {
                    if (
                      !isRecord(
                        rawSession
                      )
                    ) {
                      throw new Beta18ProgrammeTemplateError(
                        "session_invalid"
                      );
                    }

                    exactKeys(
                      rawSession,
                      [
                        "session_id",
                        "order_index",
                        "title",
                        "coaching_notes",
                        "work_items"
                      ],
                      "session"
                    );

                    const sessionOrder =
                      integerInRange(
                        rawSession.order_index,
                        1,
                        7,
                        "session_order_invalid"
                      );

                    if (
                      sessionOrder !==
                      sessionIndex + 1
                    ) {
                      throw new Beta18ProgrammeTemplateError(
                        "session_order_not_contiguous"
                      );
                    }

                    const sessionId =
                      cleanString(
                        rawSession.session_id
                      ) ||
                      `${weekId}_session_${sessionOrder}`;

                    const sessionTitle =
                      cleanString(
                        rawSession.title
                      ) ||
                      `Session ${sessionOrder}`;

                    const sessionCoachingNotes =
                      cleanString(
                        rawSession.coaching_notes
                      );

                    if (
                      sessionCoachingNotes.length >
                        500
                    ) {
                      throw new Beta18ProgrammeTemplateError(
                        "session_coaching_notes_too_long"
                      );
                    }

                    if (
                      !Array.isArray(
                        rawSession.work_items
                      ) ||
                      rawSession.work_items.length <
                        1 ||
                      rawSession.work_items.length >
                        MAX_WORK_ITEMS_PER_SESSION
                    ) {
                      throw new Beta18ProgrammeTemplateError(
                        "session_work_item_count_invalid"
                      );
                    }

                    const sessionExerciseIds =
                      new Set<string>();

                    const workItems =
                      rawSession.work_items.map(
                        (
                          rawWorkItem,
                          workItemIndex
                        ) => {
                          if (
                            !isRecord(
                              rawWorkItem
                            )
                          ) {
                            throw new Beta18ProgrammeTemplateError(
                              "work_item_invalid"
                            );
                          }

                          exactKeys(
                            rawWorkItem,
                            [
                              "work_item_id",
                              "order_index",
                              "exercise_id",
                              "planned_sets",
                              "prescription_mode",
                              "rep_mode",
                              "planned_reps",
                              "rep_min",
                              "rep_max",
                              "tempo",
                              "duration_mode",
                              "planned_duration_seconds",
                              "duration_min_seconds",
                              "duration_max_seconds",
                              "distance_mode",
                              "distance_unit",
                              "planned_distance_value",
                              "distance_min_value",
                              "distance_max_value",
                              "load_mode",
                              "percent_1rm",
                              "weight_value",
                              "weight_unit",
                              "rpe_value",
                              "rest_seconds",
                              "role",
                              "coaching_notes",
                              "segment",
                              "group_id",
                              "group_type"
                            ],
                            "work_item"
                          );

                          const workItemOrder =
                            integerInRange(
                              rawWorkItem
                                .order_index,
                              1,
                              MAX_WORK_ITEMS_PER_SESSION,
                              "work_item_order_invalid"
                            );

                          if (
                            workItemOrder !==
                              workItemIndex + 1
                          ) {
                            throw new Beta18ProgrammeTemplateError(
                              "work_item_order_not_contiguous"
                            );
                          }

                          const exerciseId =
                            cleanString(
                              rawWorkItem
                                .exercise_id
                            );

                          const exercise =
                            registry
                              .entries[
                              exerciseId
                            ];

                          if (!exercise) {
                            throw new Beta18ProgrammeTemplateError(
                              "exercise_not_in_active_registry"
                            );
                          }

                          if (
                            sessionExerciseIds.has(
                              exerciseId
                            )
                          ) {
                            throw new Beta18ProgrammeTemplateError(
                              "duplicate_exercise_in_session"
                            );
                          }

                          sessionExerciseIds.add(
                            exerciseId
                          );

                          exerciseIds.add(
                            exerciseId
                          );

                          const equipment =
                            Array.isArray(
                              exercise.equipment_requirements
                            )
                              ? exercise
                                  .equipment
                                  .map(cleanString)
                                  .filter(Boolean)
                              : [];

                          for (
                            const equipmentId of
                            equipment
                          ) {
                            equipmentIds.add(
                              equipmentId
                            );
                          }

                          const plannedSets =
                            integerInRange(
                              rawWorkItem
                                .planned_sets,
                              1,
                              20,
                              "planned_sets_invalid"
                            );

                          const prescriptionMode =
                            cleanString(
                              rawWorkItem
                                .prescription_mode
                            ) ||
                            "reps";

                          if (
                            !prescriptionModes.has(
                              prescriptionMode
                            )
                          ) {
                            throw new Beta18ProgrammeTemplateError(
                              "prescription_mode_invalid"
                            );
                          }

                          const repPrescription =
                            prescriptionMode ===
                              "reps"
                              ? repPrescriptionFromInput(
                                  rawWorkItem
                                )
                              : null;

                          const durationPrescription =
                            prescriptionMode ===
                              "duration"
                              ? durationPrescriptionFromInput(
                                  rawWorkItem
                                )
                              : null;

                          const distancePrescription =
                            prescriptionMode ===
                              "distance"
                              ? distancePrescriptionFromInput(
                                  rawWorkItem
                                )
                              : null;

                          const tempo =
                            cleanString(
                              rawWorkItem.tempo
                            );

                          if (
                            tempo &&
                            !/^[0-9Xx]-[0-9Xx]-[0-9Xx]-[0-9Xx]$/u.test(
                              tempo
                            )
                          ) {
                            throw new Beta18ProgrammeTemplateError(
                              "work_item_tempo_invalid"
                            );
                          }

                          const loadingReference =
                            loadingReferenceFromInput(
                              rawWorkItem
                            );

                          const restSeconds =
                            integerInRange(
                              rawWorkItem
                                .rest_seconds,
                              0,
                              900,
                              "rest_seconds_invalid"
                            );

                          const role =
                            cleanString(
                              rawWorkItem.role
                            );

                          if (
                            !workItemRoles.has(
                              role
                            )
                          ) {
                            throw new Beta18ProgrammeTemplateError(
                              "work_item_role_invalid"
                            );
                          }

                          const workItemCoachingNotes =
                            cleanString(
                              rawWorkItem
                                .coaching_notes
                            );

                          if (
                            workItemCoachingNotes.length >
                              500
                          ) {
                            throw new Beta18ProgrammeTemplateError(
                              "work_item_coaching_notes_too_long"
                            );
                          }

                          const segment =
                            cleanString(
                              rawWorkItem.segment
                            );

                          if (
                            !workItemSegments.has(
                              segment
                            )
                          ) {
                            throw new Beta18ProgrammeTemplateError(
                              "work_item_segment_invalid"
                            );
                          }

                          const groupId =
                            cleanString(
                              rawWorkItem.group_id
                            );

                          const groupType =
                            cleanString(
                              rawWorkItem.group_type
                            );

                          if (
                            !workItemGroupTypes.has(
                              groupType
                            )
                          ) {
                            throw new Beta18ProgrammeTemplateError(
                              "work_item_group_type_invalid"
                            );
                          }

                          if (
                            groupId === "" &&
                            groupType !== "straight"
                          ) {
                            throw new Beta18ProgrammeTemplateError(
                              "work_item_group_type_requires_group"
                            );
                          }

                          const workItemId =
                            cleanString(
                              rawWorkItem
                                .work_item_id
                            ) ||
                            `${sessionId}_item_${workItemOrder}`;

                          return deepFreeze({
                            work_item_id:
                              workItemId,
                            order_index:
                              workItemOrder,
                            exercise_id:
                              exerciseId,
                            planned_sets:
                              plannedSets,
                            prescription_mode:
                              prescriptionMode,
                            tempo,
                            ...(repPrescription
                              ? {
                                  planned_reps:
                                    repPrescription
                                      .planned_reps,
                                  rep_prescription:
                                    repPrescription
                                      .rep_prescription
                                }
                              : {}),
                            ...(durationPrescription
                              ? {
                                  planned_duration_seconds:
                                    durationPrescription
                                      .planned_duration_seconds,
                                  duration_prescription:
                                    durationPrescription
                                      .duration_prescription
                                }
                              : {}),
                            ...(distancePrescription
                              ? {
                                  planned_distance_value:
                                    distancePrescription
                                      .planned_distance_value,
                                  distance_prescription:
                                    distancePrescription
                                      .distance_prescription
                                }
                              : {}),
                            loading_reference:
                              loadingReference,
                            equipment_requirement_ids:
                              [...equipment]
                                .sort(),
                            substitution_policy_id:
                              "runtime_registry_default",
                            role,
                            rest_seconds:
                              restSeconds,
                            coaching_notes:
                              workItemCoachingNotes,
                            segment,
                            group_id:
                              groupId,
                            group_type:
                              groupType
                          });
                        }
                      );

                    validateWorkItemGrouping(
                      workItems
                    );

                    sessionCount += 1;

                    return deepFreeze({
                      day_id:
                        `${weekId}_day_${sessionOrder}`,
                      order_index:
                        sessionOrder,
                      sessions: [
                        deepFreeze({
                          session_id:
                            sessionId,
                          order_index: 1,
                          title:
                            sessionTitle,
                          coaching_notes:
                            sessionCoachingNotes,
                          work_items:
                            workItems
                        })
                      ]
                    });
                  }
                );

              return deepFreeze({
                week_id:
                  weekId,
                order_index:
                  orderIndex,
                ...(calendarWeek
                  ? {
                      week_index_global:
                        calendarWeek
                          .week_index_global,
                      calendar_start_date:
                        calendarWeek
                          .start_date,
                      calendar_end_date:
                        calendarWeek
                          .end_date,
                      days_until_event_at_week_start:
                        calendarWeek
                          .days_until_event_at_week_start,
                      partial_week:
                        calendarWeek
                          .partial_week
                    }
                  : {}),
                days
              });
            }
          );

        return deepFreeze({
          block_id:
            blockId,
          order_index:
            blockOrder,
          name:
            blockName,
          description:
            blockDescription,
          block_type:
            blockType,
          week_count:
            declaredWeekCount,
          ...(eventBlockSchedule
            ? {
                calendar_start_date:
                  eventBlockSchedule
                    .start_date,
                calendar_end_date:
                  eventBlockSchedule
                    .end_date,
                start_week_index:
                  eventBlockSchedule
                    .start_week_index,
                end_week_index:
                  eventBlockSchedule
                    .end_week_index,
                days_until_event_at_block_start:
                  eventBlockSchedule
                    .days_until_event_at_block_start
              }
            : {}),
          weeks
        });
      }
    );

  return deepFreeze({
    template_structure:
      deepFreeze({
        blocks
      }),
    exercise_ids:
      [...exerciseIds].sort(),
    equipment_ids:
      [...equipmentIds].sort(),
    block_count:
      blocks.length,
    week_count:
      weekCount,
    session_count:
      sessionCount,
    event_plan:
      eventCompile
        ? deepFreeze({
            event_plan_id:
              eventCompile
                .event_plan_id,
            event_name:
              eventCompile
                .event_name,
            event_type:
              eventCompile
                .event_type,
            event_date:
              eventCompile
                .event_date,
            programme_start_date:
              eventCompile
                .programme_start_date,
            location:
              eventCompile
                .location,
            timezone:
              eventCompile
                .timezone,
            notes:
              eventCompile
                .notes
          })
        : null,
    event_compile_summary:
      eventCompile
  });
}

export function templateRecordInput(
  record: JsonRecord
): JsonRecord {
  const structure =
    isRecord(
      record.template_structure
    )
      ? record.template_structure
      : {};

  const rawBlocks =
    Array.isArray(
      structure.blocks
    )
      ? structure.blocks
      : [];

  const blocks =
    rawBlocks.map(
      (
        rawBlock,
        blockIndex
      ) => {
        const block =
          isRecord(rawBlock)
            ? rawBlock
            : {};

        const rawWeeks =
          Array.isArray(
            block.weeks
          )
            ? block.weeks
            : [];

        const weeks =
          rawWeeks.map(
            (
              rawWeek,
              weekIndex
            ) => {
              const week =
                isRecord(rawWeek)
                  ? rawWeek
                  : {};

              const rawDays =
                Array.isArray(
                  week.days
                )
                  ? week.days
                  : [];

              const sessions =
                rawDays.flatMap(
                  (
                    rawDay,
                    dayIndex
                  ) => {
                    const day =
                      isRecord(rawDay)
                        ? rawDay
                        : {};

                    const daySessions =
                      Array.isArray(
                        day.sessions
                      )
                        ? day.sessions
                        : [];

                    return daySessions.map(
                      (
                        rawSession,
                        sessionIndex
                      ) => {
                        const session =
                          isRecord(
                            rawSession
                          )
                            ? rawSession
                            : {};

                        const rawWorkItems =
                          Array.isArray(
                            session.work_items
                          )
                            ? session
                                .work_items
                            : [];

                        const workItems =
                          rawWorkItems.map(
                            (
                              rawWorkItem,
                              workItemIndex
                            ) => {
                              const workItem =
                                isRecord(
                                  rawWorkItem
                                )
                                  ? rawWorkItem
                                  : {};

                              const loading =
                                isRecord(
                                  workItem
                                    .loading_reference
                                )
                                  ? workItem
                                      .loading_reference
                                  : {};

                              const rep =
                                isRecord(
                                  workItem
                                    .rep_prescription
                                )
                                  ? workItem
                                      .rep_prescription
                                  : {};

                              const duration =
                                isRecord(
                                  workItem
                                    .duration_prescription
                                )
                                  ? workItem
                                      .duration_prescription
                                  : {};

                              const distance =
                                isRecord(
                                  workItem
                                    .distance_prescription
                                )
                                  ? workItem
                                      .distance_prescription
                                  : {};

                              return {
                                work_item_id:
                                  cleanString(
                                    workItem
                                      .work_item_id
                                  ),
                                order_index:
                                  Number(
                                    workItem
                                      .order_index ??
                                    workItemIndex +
                                      1
                                  ),
                                exercise_id:
                                  cleanString(
                                    workItem
                                      .exercise_id
                                  ),
                                planned_sets:
                                  Number(
                                    workItem
                                      .planned_sets
                                  ),
                                rep_mode:
                                  cleanString(
                                    rep.type
                                  ) === "range"
                                    ? "range"
                                    : "fixed",
                                planned_reps:
                                  Number(
                                    rep.value ??
                                    workItem
                                      .planned_reps
                                  ),
                                rep_min:
                                  Number(
                                    rep.minimum ??
                                    workItem
                                      .planned_reps
                                  ),
                                rep_max:
                                  Number(
                                    rep.maximum ??
                                    workItem
                                      .planned_reps
                                  ),
                                prescription_mode:
                                  prescriptionModes.has(
                                    cleanString(
                                      workItem
                                        .prescription_mode
                                    )
                                  )
                                    ? cleanString(
                                        workItem
                                          .prescription_mode
                                      )
                                    : "reps",
                                tempo:
                                  cleanString(
                                    workItem.tempo
                                  ),
                                duration_mode:
                                  cleanString(
                                    duration.type
                                  ) === "range"
                                    ? "range"
                                    : "fixed",
                                planned_duration_seconds:
                                  Number(
                                    duration.value ??
                                    workItem
                                      .planned_duration_seconds ??
                                    30
                                  ),
                                duration_min_seconds:
                                  Number(
                                    duration.minimum ??
                                    workItem
                                      .planned_duration_seconds ??
                                    30
                                  ),
                                duration_max_seconds:
                                  Number(
                                    duration.maximum ??
                                    workItem
                                      .planned_duration_seconds ??
                                    30
                                  ),
                                distance_mode:
                                  cleanString(
                                    distance.type
                                  ) === "range"
                                    ? "range"
                                    : "fixed",
                                distance_unit:
                                  cleanString(
                                    distance.unit
                                  ) === "feet"
                                    ? "feet"
                                    : "meters",
                                planned_distance_value:
                                  Number(
                                    distance.value ??
                                    workItem
                                      .planned_distance_value ??
                                    20
                                  ),
                                distance_min_value:
                                  Number(
                                    distance.minimum ??
                                    workItem
                                      .planned_distance_value ??
                                    20
                                  ),
                                distance_max_value:
                                  Number(
                                    distance.maximum ??
                                    workItem
                                      .planned_distance_value ??
                                    20
                                  ),
                                load_mode:
                                  cleanString(
                                    loading.type
                                  ) === "load"
                                    ? "fixed_weight"
                                    : cleanString(
                                        loading.type
                                      ) === "bodyweight"
                                      ? "bodyweight"
                                      : cleanString(
                                          loading.type
                                        ) === "rpe"
                                        ? "rpe"
                                        : "percent_1rm",
                                percent_1rm:
                                  cleanString(
                                    loading.type
                                  ) === "percent_1rm"
                                    ? Number(
                                        loading.value
                                      )
                                    : 75,
                                weight_value:
                                  cleanString(
                                    loading.type
                                  ) === "load"
                                    ? Number(
                                        loading.value
                                      )
                                    : 20,
                                weight_unit:
                                  cleanString(
                                    loading.unit
                                  ) === "lb"
                                    ? "lb"
                                    : "kg",
                                rpe_value:
                                  cleanString(
                                    loading.type
                                  ) === "rpe"
                                    ? Number(
                                        loading.value
                                      )
                                    : 8,
                                rest_seconds:
                                  Number(
                                    workItem
                                      .rest_seconds
                                  ),
                                role:
                                  cleanString(
                                    workItem.role
                                  ),
                                coaching_notes:
                                  cleanString(
                                    workItem
                                      .coaching_notes
                                  ),
                                segment:
                                  workItemSegments.has(
                                    cleanString(
                                      workItem.segment
                                    )
                                  )
                                    ? cleanString(
                                        workItem.segment
                                      )
                                    : "working",
                                group_id:
                                  cleanString(
                                    workItem.group_id
                                  ),
                                group_type:
                                  workItemGroupTypes.has(
                                    cleanString(
                                      workItem
                                        .group_type
                                    )
                                  )
                                    ? cleanString(
                                        workItem
                                          .group_type
                                      )
                                    : "straight"
                              };
                            }
                          );

                        return {
                          session_id:
                            cleanString(
                              session
                                .session_id
                            ),
                          order_index:
                            Number(
                              day.order_index ??
                              session
                                .order_index ??
                              dayIndex +
                                sessionIndex +
                                1
                            ),
                          title:
                            cleanString(
                              session.title
                            ),
                          coaching_notes:
                            cleanString(
                              session
                                .coaching_notes
                            ),
                          work_items:
                            workItems
                        };
                      }
                    );
                  }
                );

              return {
                week_id:
                  cleanString(
                    week.week_id
                  ),
                order_index:
                  Number(
                    week.order_index ??
                    weekIndex + 1
                  ),
                sessions
              };
            }
          );

        return {
          block_id:
            cleanString(
              block.block_id
            ),
          order_index:
            Number(
              block.order_index ??
              blockIndex + 1
            ),
          name:
            cleanString(
              block.name
            ) ||
            `Block ${blockIndex + 1}`,
          description:
            cleanString(
              block.description
            ),
          block_type:
            cleanString(
              block.block_type
            ) ||
            "general",
          week_count:
            Number(
              block.week_count ??
              weeks.length
            ),
          weeks
        };
      }
    );

  return {
    coach_user_id:
      cleanString(
        record.coach_user_id
      ),
    template_id:
      cleanString(
        record.template_id
      ),
    template_family_id:
      cleanString(
        record.template_family_id
      ),
    template_version:
      Number(
        record.template_version
      ),
    template_name:
      cleanString(
        record.template_name
      ),
    description:
      cleanString(
        record.description
      ),
    activity_id:
      cleanString(
        record.activity_id
      ),
    event_plan:
      isRecord(
        record.event_plan
      )
        ? cloneRecord(
            record.event_plan
          )
        : null,
    blocks,
    updated_at_iso8601:
      new Date().toISOString()
  };
}

async function latestTemplateById(
  coachUserId: string,
  templateId: string
): Promise<Readonly<JsonRecord> | null> {
  const result =
    await pool.query(
      `
      SELECT record_payload
      FROM beta_product_records
      WHERE
        record_type =
          'beta18_programme_template'
        AND record_id = $1
        AND actor_user_id = $2
      ORDER BY
        effective_at DESC,
        created_at DESC,
        record_sha256 DESC
      LIMIT 1
      `,
      [
        templateId,
        coachUserId
      ]
    );

  const payload =
    result.rows?.[0]?.record_payload;

  return isRecord(payload)
    ? deepFreeze(payload)
    : null;
}

async function persistTemplateRecord(
  recordWithoutHash: JsonRecord
): Promise<Readonly<JsonRecord>> {
  const record =
    deepFreeze({
      ...recordWithoutHash,
      record_sha256:
        sha256(
          recordWithoutHash
        )
    });

  return persistBetaProductRecord(
    record
  );
}

export function listActiveExerciseOptions(): Readonly<{
  registry_id: string;
  registry_version: string;
  exercises: readonly Readonly<JsonRecord>[];
}> {
  const registry =
    loadExerciseRegistry();

  const exercises =
    Object.values(
      registry.entries
    )
      .map(
        (entry) => {
          const exerciseId =
            cleanString(
              entry.exercise_id
            );

          return deepFreeze({
            exercise_id:
              exerciseId,
            display_name:
              cleanString(
                entry.display_name
              ) ||
              titleFromId(
                exerciseId
              ),
            pattern:
              cleanString(
                entry.movement_pattern_id
              ),
            equipment:
              Array.isArray(
                entry.equipment_requirements
              )
                ? entry
                    .equipment
                    .map(cleanString)
                    .filter(Boolean)
                : []
          });
        }
      )
      .sort(
        (left, right) =>
          String(
            left.display_name
          ).localeCompare(
            String(
              right.display_name
            )
          )
      );

  return deepFreeze({
    registry_id:
      registry.registry_id,
    registry_version:
      registry.version,
    exercises
  });
}

export async function saveCoachProgrammeTemplate(
  input: unknown,
  // DEV NOTE: internal-only escape hatch. `allowEventBindingChange` must never be
  // set from an HTTP handler decoding client input — only bindStandaloneEventToProgrammeTemplate,
  // the sole lawful entry point for creating or changing a standalone-event binding, may pass it.
  options: Readonly<{
    allowEventBindingChange?: boolean;
  }> = {}
): Promise<Readonly<JsonRecord>> {
  if (!isRecord(input)) {
    throw new Beta18ProgrammeTemplateError(
      "input_invalid"
    );
  }

  exactKeys(
    input,
    [
      "coach_user_id",
      "template_id",
      "template_family_id",
      "template_version",
      "template_name",
      "description",
      "activity_id",
      "event_plan",
      "bound_event_id",
      "bound_event_record_sha256",
      "blocks",
      "weeks",
      "updated_at_iso8601"
    ],
    "template"
  );

  const coachUserId =
    cleanString(
      input.coach_user_id
    );

  if (!coachUserId) {
    throw new Beta18ProgrammeTemplateError(
      "coach_user_id_required"
    );
  }

  await requireActiveCoach(
    coachUserId
  );

  const templateName =
    cleanString(
      input.template_name
    );

  if (
    !templateName ||
    templateName.length > 120
  ) {
    throw new Beta18ProgrammeTemplateError(
      "template_name_invalid"
    );
  }

  const description =
    cleanString(
      input.description
    );

  if (
    description.length > 1000
  ) {
    throw new Beta18ProgrammeTemplateError(
      "description_too_long"
    );
  }

  const activityId =
    cleanString(
      input.activity_id
    );

  if (
    !supportedActivities.has(
      activityId
    )
  ) {
    throw new Beta18ProgrammeTemplateError(
      "activity_invalid"
    );
  }

  const requestedTemplateId =
    cleanString(
      input.template_id
    );

  const requestedFamilyId =
    cleanString(
      input.template_family_id
    );

  const templateVersion =
    integerInRange(
      input.template_version ??
        1,
      1,
      999,
      "template_version_invalid"
    );

  const templateFamilyId =
    requestedFamilyId ||
    `coach_template_${
      crypto
        .randomUUID()
        .replaceAll("-", "")
    }`;

  const templateId =
    requestedTemplateId ||
    `${templateFamilyId}_v${templateVersion}`;

  if (
    !/^[a-z0-9_:-]+$/u.test(
      templateId
    ) ||
    !/^[a-z0-9_:-]+$/u.test(
      templateFamilyId
    ) ||
    !templateFamilyId.startsWith(
      "coach_template_"
    ) ||
    templateId !==
      `${templateFamilyId}_v${templateVersion}`
  ) {
    throw new Beta18ProgrammeTemplateError(
      "template_id_invalid"
    );
  }

  const existing =
    await latestTemplateById(
      coachUserId,
      templateId
    );

  if (
    existing &&
    existing.template_status !==
      "draft"
  ) {
    throw new Beta18ProgrammeTemplateError(
      "active_or_archived_template_is_immutable"
    );
  }

  if (
    existing &&
    (
      cleanString(
        existing.template_family_id
      ) !== templateFamilyId ||
      Number(
        existing.template_version
      ) !== templateVersion
    )
  ) {
    throw new Beta18ProgrammeTemplateError(
      "template_identity_mismatch"
    );
  }

  // A standalone-event binding may only be created or changed through the
  // explicit bindStandaloneEventToProgrammeTemplate action, never as a side
  // effect of an ordinary content save. An ordinary save may only omit these
  // fields (preserving whatever binding already exists) or echo the
  // currently-stored values back unchanged.
  const existingBoundEventId =
    cleanString(
      existing?.bound_event_id
    );

  const existingBoundEventRecordSha256 =
    cleanString(
      existing?.bound_event_record_sha256
    );

  const submittedBoundEventId =
    Object.prototype.hasOwnProperty.call(
      input,
      "bound_event_id"
    )
      ? cleanString(
          input.bound_event_id
        )
      : existingBoundEventId;

  const submittedBoundEventRecordSha256 =
    Object.prototype.hasOwnProperty.call(
      input,
      "bound_event_record_sha256"
    )
      ? cleanString(
          input.bound_event_record_sha256
        )
      : existingBoundEventRecordSha256;

  if (
    !options.allowEventBindingChange &&
    (
      submittedBoundEventId !==
        existingBoundEventId ||
      submittedBoundEventRecordSha256 !==
        existingBoundEventRecordSha256
    )
  ) {
    throw new Beta18ProgrammeTemplateError(
      "template_event_binding_immutable_via_save"
    );
  }

  const boundEventId =
    submittedBoundEventId || null;

  const boundEventRecordSha256 =
    submittedBoundEventRecordSha256 ||
    null;

  const updatedAt =
    iso8601(
      input.updated_at_iso8601 ??
        new Date().toISOString(),
      "updated_at_invalid"
    );

  const registry =
    loadExerciseRegistry();

  const normalised =
    normaliseTemplateStructure(
      input,
      templateId,
      registry
    );

  const recordWithoutHash =
    deepFreeze({
      record_type:
        "beta18_programme_template",
      template_id:
        templateId,
      template_family_id:
        templateFamilyId,
      template_version:
        templateVersion,
      contract_version:
        "beta18.4.0.0",
      template_status:
        "draft",
      template_name:
        templateName,
      description,
      coach_user_id:
        coachUserId,
      activity_id:
        activityId,
      event_plan:
        normalised.event_plan,
      event_compile_summary:
        normalised.event_compile_summary,
      bound_event_id:
        boundEventId,
      bound_event_record_sha256:
        boundEventRecordSha256,
      assignment_scope:
        "coach_athlete_assigned_execution",
      source_record_id:
        `coach_authored:${coachUserId}:${templateFamilyId}`,
      source_control_status:
        "coach_authored_beta",
      template_structure:
        normalised
          .template_structure,
      registry_bindings:
        deepFreeze({
          activity_id:
            activityId,
          exercise_registry_id:
            registry.registry_id,
          exercise_registry_version:
            registry.version,
          exercise_ids:
            normalised
              .exercise_ids,
          equipment_ids:
            normalised
              .equipment_ids,
          substitution_edge_ids:
            [],
          applicability_ids:
            []
        }),
      visibility_boundary:
        deepFreeze({
          formula_payload_status:
            "not_present",
          progression_internals_status:
            "not_present",
          protected_logic_reference_status:
            "not_present"
        }),
      deterministic_boundary:
        deepFreeze({
          template_hash_inputs: [
            "template_id",
            "template_version",
            "activity_id",
            "registry_bindings",
            "template_structure",
            "event_plan",
            "event_compile_summary"
          ],
          order_policy:
            "explicit_order_index_only",
          unknown_field_policy:
            "fail_closed",
          registry_reference_policy:
            "active_exercise_registry_only"
        }),
      execution_surface:
        deepFreeze({
          coach_can_assign: false,
          athlete_can_execute_assigned:
            false,
          coach_can_edit_after_assignment:
            false,
          assignment_mutates_template:
            false,
          template_mutates_relationship:
            false,
          template_mutates_engine:
            false
        }),
      copy_boundary_flags: [
        "formula_payload_not_visible",
        "no_marketplace_scope",
        "no_royalty_scope",
        "registry_bound",
        "coach_authored_beta"
      ],
      block_count:
        normalised.block_count,
      week_count:
        normalised.week_count,
      session_count:
        normalised.session_count,
      created_at_iso8601:
        cleanString(
          existing
            ?.created_at_iso8601
        ) ||
        updatedAt,
      updated_at_iso8601:
        updatedAt,
      engine_visible:
        false
    });

  return persistTemplateRecord(
    recordWithoutHash
  );
}

function transitionTemplateRecord(
  record: Readonly<JsonRecord>,
  nextStatus: "complete" | "active" | "archived"
): JsonRecord {
  const mutable =
    cloneRecord(
      record as JsonRecord
    );

  delete mutable.record_sha256;

  mutable.template_status =
    nextStatus;

  mutable.updated_at_iso8601 =
    new Date().toISOString();

  mutable.execution_surface =
    deepFreeze({
      coach_can_assign:
        nextStatus === "active",
      athlete_can_execute_assigned:
        nextStatus === "active" ||
        nextStatus === "archived",
      coach_can_edit_after_assignment:
        false,
      assignment_mutates_template:
        false,
      template_mutates_relationship:
        false,
      template_mutates_engine:
        false
    });

  return mutable;
}

export async function completeCoachProgrammeTemplate(
  coachUserIdInput: string,
  templateIdInput: string
): Promise<Readonly<JsonRecord>> {
  const coachUserId =
    cleanString(
      coachUserIdInput
    );

  const templateId =
    cleanString(
      templateIdInput
    );

  await requireActiveCoach(
    coachUserId
  );

  const existing =
    await latestTemplateById(
      coachUserId,
      templateId
    );

  if (!existing) {
    throw new Beta18ProgrammeTemplateError(
      "template_not_found"
    );
  }

  if (
    existing.template_status !==
      "draft"
  ) {
    throw new Beta18ProgrammeTemplateError(
      "only_draft_can_complete"
    );
  }

  const completionNormalised =
    normaliseTemplateStructure(
      templateRecordInput(
        existing as JsonRecord
      ),
      templateId,
      loadExerciseRegistry()
    );

  if (
    completionNormalised
      .event_compile_summary
  ) {
    if (
      completionNormalised
        .event_compile_summary
        .allocation_state !==
      "balanced"
    ) {
      throw new Beta18ProgrammeTemplateError(
        "event_week_allocation_unbalanced"
      );
    }

    const eventDate =
      cleanString(
        completionNormalised
          .event_plan
          ?.event_date
      );

    const today =
      new Date()
        .toISOString()
        .slice(0, 10);

    if (
      eventDate &&
      eventDate < today
    ) {
      throw new Beta18ProgrammeTemplateError(
        "event_date_in_past"
      );
    }
  }

  const boundEventId =
    cleanString(
      existing.bound_event_id
    );

  if (boundEventId) {
    const liveEvent =
      await latestOwnedStandaloneEvent(
        coachUserId,
        boundEventId
      );

    if (!liveEvent) {
      const foreign =
        await standaloneEventExistsForAnotherActor(
          coachUserId,
          boundEventId
        );

      throw new Beta18ProgrammeTemplateError(
        foreign
          ? "event_binding_inaccessible"
          : "event_binding_not_found"
      );
    }

    if (
      liveEvent.event_status ===
      "cancelled"
    ) {
      throw new Beta18ProgrammeTemplateError(
        "event_binding_event_cancelled"
      );
    }

    if (
      liveEvent.event_status ===
      "archived"
    ) {
      throw new Beta18ProgrammeTemplateError(
        "event_binding_event_archived"
      );
    }

    if (
      cleanString(
        liveEvent.record_sha256
      ) !==
      cleanString(
        existing.bound_event_record_sha256
      )
    ) {
      throw new Beta18ProgrammeTemplateError(
        "event_binding_stale_requires_rebind"
      );
    }
  }

  return persistTemplateRecord(
    transitionTemplateRecord(
      existing,
      "complete"
    )
  );
}

export async function activateCoachProgrammeTemplate(
  coachUserIdInput: string,
  templateIdInput: string
): Promise<Readonly<JsonRecord>> {
  const coachUserId =
    cleanString(
      coachUserIdInput
    );

  const templateId =
    cleanString(
      templateIdInput
    );

  await requireActiveCoach(
    coachUserId
  );

  const existing =
    await latestTemplateById(
      coachUserId,
      templateId
    );

  if (!existing) {
    throw new Beta18ProgrammeTemplateError(
      "template_not_found"
    );
  }

  if (
    existing.template_status !==
      "complete"
  ) {
    throw new Beta18ProgrammeTemplateError(
      "only_complete_can_activate"
    );
  }

  return persistTemplateRecord(
    transitionTemplateRecord(
      existing,
      "active"
    )
  );
}

// FULL-UI-12C: the standalone event referenced here (record_type
// 'beta19_coach_event', owned by src/api/full_ui_09c_event_lifecycle_service.ts
// and src/api/beta19_coach_event_service.ts) remains the single event-date
// truth. These helpers only ever read that record; they never create, version,
// cancel or archive it, and never duplicate team/roster/organisation runtime.
async function latestOwnedStandaloneEvent(
  coachUserId: string,
  eventId: string
): Promise<Readonly<JsonRecord> | null> {
  const result =
    await pool.query(
      `
      SELECT record_payload
      FROM beta_product_records
      WHERE
        record_type = 'beta19_coach_event'
        AND record_id = $1
        AND actor_user_id = $2
      ORDER BY
        effective_at DESC,
        created_at DESC,
        record_sha256 DESC
      LIMIT 1
      `,
      [
        eventId,
        coachUserId
      ]
    );

  const payload =
    result.rows?.[0]?.record_payload;

  return isRecord(payload)
    ? deepFreeze(payload)
    : null;
}

async function standaloneEventExistsForAnotherActor(
  coachUserId: string,
  eventId: string
): Promise<boolean> {
  const result =
    await pool.query(
      `
      SELECT 1
      FROM beta_product_records
      WHERE
        record_type = 'beta19_coach_event'
        AND record_id = $1
        AND actor_user_id <> $2
      LIMIT 1
      `,
      [
        eventId,
        coachUserId
      ]
    );

  return (
    result.rowCount ?? 0
  ) > 0;
}

// The sole lawful action that may create or change a template's standalone-event
// binding. It re-derives the template's event_plan snapshot from the event's
// CURRENT record at the moment of this explicit call and pins it (via
// bound_event_record_sha256) until the coach explicitly calls this again -
// ordinary content saves may not move it (see the immutability check inside
// saveCoachProgrammeTemplate).
export async function bindStandaloneEventToProgrammeTemplate(
  inputValue: unknown
): Promise<Readonly<JsonRecord>> {
  if (!isRecord(inputValue)) {
    throw new Beta18ProgrammeTemplateError(
      "event_binding_input_invalid"
    );
  }

  exactKeys(
    inputValue,
    [
      "coach_user_id",
      "template_id",
      "event_id"
    ],
    "event_binding"
  );

  const coachUserId =
    cleanString(
      inputValue.coach_user_id
    );

  const templateId =
    cleanString(
      inputValue.template_id
    );

  const eventId =
    cleanString(
      inputValue.event_id
    );

  if (
    !coachUserId ||
    !templateId ||
    !eventId
  ) {
    throw new Beta18ProgrammeTemplateError(
      "event_binding_identity_required"
    );
  }

  await requireActiveCoach(
    coachUserId
  );

  const existingTemplate =
    await latestTemplateById(
      coachUserId,
      templateId
    );

  if (!existingTemplate) {
    throw new Beta18ProgrammeTemplateError(
      "template_not_found"
    );
  }

  if (
    existingTemplate.template_status !==
    "draft"
  ) {
    throw new Beta18ProgrammeTemplateError(
      "active_or_archived_template_is_immutable"
    );
  }

  const event =
    await latestOwnedStandaloneEvent(
      coachUserId,
      eventId
    );

  if (!event) {
    const foreign =
      await standaloneEventExistsForAnotherActor(
        coachUserId,
        eventId
      );

    throw new Beta18ProgrammeTemplateError(
      foreign
        ? "event_binding_inaccessible"
        : "event_binding_not_found"
    );
  }

  if (
    event.event_status !==
    "active"
  ) {
    throw new Beta18ProgrammeTemplateError(
      event.event_status ===
      "cancelled"
        ? "event_binding_event_cancelled"
        : "event_binding_event_archived"
    );
  }

  if (
    cleanString(
      event.activity_id
    ) !==
    cleanString(
      existingTemplate.activity_id
    )
  ) {
    throw new Beta18ProgrammeTemplateError(
      "event_binding_activity_mismatch"
    );
  }

  const eventRecordSha256 =
    cleanString(
      event.record_sha256
    );

  if (
    !/^[a-f0-9]{64}$/u.test(
      eventRecordSha256
    )
  ) {
    throw new Beta18ProgrammeTemplateError(
      "event_binding_reference_invalid"
    );
  }

  const eventPlan =
    isRecord(event.event_plan)
      ? event.event_plan
      : {};

  const baseInput =
    templateRecordInput(
      existingTemplate as JsonRecord
    );

  const bindInput = {
    ...baseInput,
    event_plan:
      cloneRecord(eventPlan),
    bound_event_id:
      eventId,
    bound_event_record_sha256:
      eventRecordSha256,
    updated_at_iso8601:
      new Date().toISOString()
  };

  return saveCoachProgrammeTemplate(
    bindInput,
    {
      allowEventBindingChange:
        true
    }
  );
}

// Read-side factual comparison between what the template has pinned
// (bound_event_id / bound_event_record_sha256, and the event_plan snapshot
// taken at that binding) and the standalone event's current, live state.
// This never mutates the template and never silently updates the pinned
// snapshot - it only reports whether an explicit rebind is required.
export async function loadTemplateEventBindingStatus(
  coachUserIdInput: string,
  templateIdInput: string
): Promise<Readonly<JsonRecord>> {
  const coachUserId =
    cleanString(
      coachUserIdInput
    );

  const templateId =
    cleanString(
      templateIdInput
    );

  await requireActiveCoach(
    coachUserId
  );

  const template =
    await latestTemplateById(
      coachUserId,
      templateId
    );

  if (!template) {
    throw new Beta18ProgrammeTemplateError(
      "template_not_found"
    );
  }

  const boundEventId =
    cleanString(
      template.bound_event_id
    );

  if (!boundEventId) {
    return deepFreeze({
      template_id:
        templateId,
      bound: false
    });
  }

  const boundEventRecordSha256 =
    cleanString(
      template.bound_event_record_sha256
    );

  const templateEventPlan =
    isRecord(
      template.event_plan
    )
      ? template.event_plan
      : null;

  const templateEventCompileSummary =
    isRecord(
      template.event_compile_summary
    )
      ? template.event_compile_summary
      : null;

  const liveEvent =
    await latestOwnedStandaloneEvent(
      coachUserId,
      boundEventId
    );

  if (!liveEvent) {
    const foreign =
      await standaloneEventExistsForAnotherActor(
        coachUserId,
        boundEventId
      );

    return deepFreeze({
      template_id:
        templateId,
      bound: true,
      event_id:
        boundEventId,
      bound_event_record_sha256:
        boundEventRecordSha256,
      event_plan:
        templateEventPlan,
      event_compile_summary:
        templateEventCompileSummary,
      accessible: false,
      ownership_denied:
        foreign,
      event_status: null,
      live_event_record_sha256:
        null,
      live_event_version:
        null,
      is_current: false,
      requires_rebind: false
    });
  }

  const liveEventRecordSha256 =
    cleanString(
      liveEvent.record_sha256
    );

  const isCurrent =
    liveEventRecordSha256 ===
    boundEventRecordSha256;

  return deepFreeze({
    template_id:
      templateId,
    bound: true,
    event_id:
      boundEventId,
    bound_event_record_sha256:
      boundEventRecordSha256,
    event_plan:
      templateEventPlan,
    event_compile_summary:
      templateEventCompileSummary,
    accessible: true,
    ownership_denied: false,
    event_status:
      cleanString(
        liveEvent.event_status
      ),
    live_event_record_sha256:
      liveEventRecordSha256,
    live_event_version:
      Number(
        liveEvent.event_version ??
        1
      ),
    is_current:
      isCurrent,
    requires_rebind:
      !isCurrent ||
      liveEvent.event_status !==
        "active"
  });
}

export async function archiveCoachProgrammeTemplate(
  coachUserIdInput: string,
  templateIdInput: string
): Promise<Readonly<JsonRecord>> {
  const coachUserId =
    cleanString(
      coachUserIdInput
    );

  const templateId =
    cleanString(
      templateIdInput
    );

  await requireActiveCoach(
    coachUserId
  );

  const existing =
    await latestTemplateById(
      coachUserId,
      templateId
    );

  if (!existing) {
    throw new Beta18ProgrammeTemplateError(
      "template_not_found"
    );
  }

  if (
    existing.template_status ===
      "archived"
  ) {
    return existing;
  }

  return persistTemplateRecord(
    transitionTemplateRecord(
      existing,
      "archived"
    )
  );
}

export async function duplicateCoachProgrammeTemplate(
  coachUserIdInput: string,
  templateIdInput: string
): Promise<Readonly<JsonRecord>> {
  const coachUserId =
    cleanString(
      coachUserIdInput
    );

  const templateId =
    cleanString(
      templateIdInput
    );

  await requireActiveCoach(
    coachUserId
  );

  const existing =
    await latestTemplateById(
      coachUserId,
      templateId
    );

  if (!existing) {
    throw new Beta18ProgrammeTemplateError(
      "template_not_found"
    );
  }

  const familyId =
    cleanString(
      existing.template_family_id
    );

  const versions =
    await pool.query(
      `
      SELECT record_payload
      FROM beta_product_records
      WHERE
        record_type =
          'beta18_programme_template'
        AND actor_user_id = $1
        AND record_payload
          ->> 'template_family_id' = $2
      `,
      [
        coachUserId,
        familyId
      ]
    );

  const maximumVersion =
    versions.rows.reduce(
      (
        maximum: number,
        row: JsonRecord
      ) => {
        const payload =
          isRecord(
            row.record_payload
          )
            ? row.record_payload
            : {};

        const version =
          Number(
            payload.template_version
          );

        return Number.isInteger(
          version
        )
          ? Math.max(
              maximum,
              version
            )
          : maximum;
      },
      0
    );

  const nextVersion =
    maximumVersion + 1;

  const input =
    templateRecordInput(
      existing as JsonRecord
    );

  input.template_id =
    `${familyId}_v${nextVersion}`;

  input.template_family_id =
    familyId;

  input.template_version =
    nextVersion;

  input.template_name =
    `${cleanString(
      existing.template_name
    )} v${nextVersion}`;

  input.updated_at_iso8601 =
    new Date().toISOString();

  return saveCoachProgrammeTemplate(
    input
  );
}

export async function listCoachProgrammeTemplates(
  coachUserIdInput: string
): Promise<readonly Readonly<JsonRecord>[]> {
  const coachUserId =
    cleanString(
      coachUserIdInput
    );

  await requireActiveCoach(
    coachUserId
  );

  const result =
    await pool.query(
      `
      SELECT DISTINCT ON (record_id)
        record_payload
      FROM beta_product_records
      WHERE
        record_type =
          'beta18_programme_template'
        AND actor_user_id = $1
      ORDER BY
        record_id,
        effective_at DESC,
        created_at DESC,
        record_sha256 DESC
      `,
      [
        coachUserId
      ]
    );

  return result.rows
    .map(
      (row: JsonRecord) =>
        row.record_payload
    )
    .filter(isRecord)
    .sort(
      (
        left: JsonRecord,
        right: JsonRecord
      ) =>
        String(
          right.updated_at_iso8601 ??
          ""
        ).localeCompare(
          String(
            left.updated_at_iso8601 ??
            ""
          )
        )
    )
    .map(deepFreeze);
}

export async function loadActiveCoachTemplateById(
  coachUserIdInput: string,
  templateIdInput: string
): Promise<Readonly<JsonRecord> | null> {
  const coachUserId =
    cleanString(
      coachUserIdInput
    );

  const templateId =
    cleanString(
      templateIdInput
    );

  if (
    !coachUserId ||
    !templateId
  ) {
    return null;
  }

  const template =
    await latestTemplateById(
      coachUserId,
      templateId
    );

  return (
    template &&
    template.template_status ===
      "active"
  )
    ? template
    : null;
}

export async function loadExecutableCoachTemplateById(
  coachUserIdInput: string,
  templateIdInput: string
): Promise<Readonly<JsonRecord> | null> {
  const coachUserId =
    cleanString(
      coachUserIdInput
    );

  const templateId =
    cleanString(
      templateIdInput
    );

  if (
    !coachUserId ||
    !templateId
  ) {
    return null;
  }

  const template =
    await latestTemplateById(
      coachUserId,
      templateId
    );

  return (
    template &&
    (
      template.template_status ===
        "active" ||
      template.template_status ===
        "archived"
    )
  )
    ? template
    : null;
}

function orderedTemplateSessions(
  templateRecord: Readonly<JsonRecord>
): readonly Readonly<JsonRecord>[] {
  const structure =
    isRecord(
      templateRecord.template_structure
    )
      ? templateRecord.template_structure
      : {};

  const blocks =
    Array.isArray(
      structure.blocks
    )
      ? structure.blocks
          .filter(isRecord)
          .sort(
            (
              left,
              right
            ) =>
              Number(
                left.order_index
              ) -
              Number(
                right.order_index
              )
          )
      : [];

  const sessions: JsonRecord[] =
    [];

  let derivedGlobalWeekIndex = 0;

  for (
    const block of blocks
  ) {
    const weeks =
      Array.isArray(
        block.weeks
      )
        ? block.weeks
            .filter(isRecord)
            .sort(
              (
                left,
                right
              ) =>
                Number(
                  left.order_index
                ) -
                Number(
                  right.order_index
                )
            )
        : [];

    for (
      const week of weeks
    ) {
      derivedGlobalWeekIndex += 1;

      const days =
        Array.isArray(
          week.days
        )
          ? week.days
              .filter(isRecord)
              .sort(
                (
                  left,
                  right
                ) =>
                  Number(
                    left.order_index
                  ) -
                  Number(
                    right.order_index
                  )
              )
          : [];

      for (
        const day of days
      ) {
        const daySessions =
          Array.isArray(
            day.sessions
          )
            ? day.sessions
                .filter(isRecord)
                .sort(
                  (
                    left,
                    right
                  ) =>
                    Number(
                      left.order_index
                    ) -
                    Number(
                      right.order_index
                    )
                )
            : [];

        for (
          const session of
          daySessions
        ) {
          sessions.push(
            deepFreeze({
              ...session,
              template_block_id:
                cleanString(
                  block.block_id
                ),
              template_block_name:
                cleanString(
                  block.name
                ),
              template_block_type:
                cleanString(
                  block.block_type
                ),
              template_block_order:
                Number(
                  block.order_index
                ),
              template_week_id:
                cleanString(
                  week.week_id
                ),
              template_week_order:
                Number(
                  week.order_index
                ),
              template_day_id:
                cleanString(
                  day.day_id
                ),
              template_week_index_global:
                Number(
                  week.week_index_global ??
                  derivedGlobalWeekIndex
                ),
              template_week_start_date:
                cleanString(
                  week.calendar_start_date
                ) || null,
              template_week_end_date:
                cleanString(
                  week.calendar_end_date
                ) || null,
              days_until_event_at_week_start:
                Number.isInteger(
                  week.days_until_event_at_week_start
                )
                  ? Number(
                      week.days_until_event_at_week_start
                    )
                  : null,
              template_event_plan:
                isRecord(
                  templateRecord.event_plan
                )
                  ? templateRecord.event_plan
                  : null,
              template_event_compile_summary:
                isRecord(
                  templateRecord.event_compile_summary
                )
                  ? templateRecord.event_compile_summary
                  : null
            })
          );
        }
      }
    }
  }

  return sessions;
}

export async function materialiseNextCoachTemplateProgram(
  input: Readonly<{
    coach_user_id: string;
    athlete_user_id: string;
    assignment_id: string;
    template_id: string;
    event_plan_override?: Readonly<JsonRecord> | null;
    event_compile_summary_override?: Readonly<JsonRecord> | null;
    event_record_sha256?: string | null;
    base_program: JsonRecord;
    // FULL-UI-14C: when provided, materialise the session at this exact
    // index instead of counting existing rows to find the next one to
    // create. Used only for a read-only "what does the athlete's current,
    // already-created session actually contain" lookup (Athlete Today's
    // "continue" case) - it never changes which session gets created next.
    session_index_override?: number;
  }>
): Promise<Readonly<JsonRecord>> {
  const coachUserId =
    cleanString(
      input.coach_user_id
    );

  const athleteUserId =
    cleanString(
      input.athlete_user_id
    );

  const assignmentId =
    cleanString(
      input.assignment_id
    );

  const templateId =
    cleanString(
      input.template_id
    );

  const template =
    await loadExecutableCoachTemplateById(
      coachUserId,
      templateId
    );

  if (!template) {
    throw new Beta18ProgrammeTemplateError(
      "assigned_template_not_executable"
    );
  }

  const executionEventPlan =
    isRecord(input.event_plan_override)
      ? input.event_plan_override
      : isRecord(template.event_plan)
        ? template.event_plan
        : null;

  const executionEventCompileSummary =
    isRecord(input.event_compile_summary_override)
      ? input.event_compile_summary_override
      : isRecord(template.event_compile_summary)
        ? template.event_compile_summary
        : null;

  const sessions =
    orderedTemplateSessions(
      template
    );

  const nextIndex =
    Number.isInteger(
      input.session_index_override
    )
      ? Number(input.session_index_override)
      : Number(
          (
            await pool.query(
              `
              SELECT count(*)::integer
                AS session_count
              FROM sessions
              WHERE beta_assignment_id = $1
              `,
              [
                assignmentId
              ]
            )
          ).rows?.[0]?.session_count ??
          0
        );

  const selectedSession =
    sessions[nextIndex];

  if (!selectedSession) {
    throw new Beta18ProgrammeTemplateError(
      "assigned_template_sessions_exhausted"
    );
  }

  const executionWeeks =
    executionEventCompileSummary &&
    Array.isArray(executionEventCompileSummary.weeks)
      ? executionEventCompileSummary.weeks
      : [];

  const selectedGlobalWeekIndex =
    Number(selectedSession.template_week_index_global ?? 0);

  const executionWeek =
    selectedGlobalWeekIndex > 0 &&
    isRecord(executionWeeks[selectedGlobalWeekIndex - 1])
      ? executionWeeks[selectedGlobalWeekIndex - 1]
      : null;

  const registry =
    loadExerciseRegistry();

  const rawWorkItems =
    Array.isArray(
      selectedSession.work_items
    )
      ? selectedSession.work_items
          .filter(isRecord)
          .sort(
            (
              left,
              right
            ) =>
              Number(
                left.order_index
              ) -
              Number(
                right.order_index
              )
          )
      : [];

  if (
    rawWorkItems.length < 1 ||
    rawWorkItems.length >
      MAX_WORK_ITEMS_PER_SESSION
  ) {
    throw new Beta18ProgrammeTemplateError(
      "assigned_template_session_invalid"
    );
  }

  const percentageProfileRequired =
    rawWorkItems.some(
      (workItem) =>
        loadingReferenceFromStored(
          workItem
        ).type ===
          "percent_1rm"
    );

  const athleteProfile =
    percentageProfileRequired
      ? await loadAthleteStrengthProfile(
          coachUserId,
          athleteUserId
        )
      : null;

  const plannedItems =
    rawWorkItems.map(
      (
        workItem,
        index
      ) => {
        const prescriptionMode =
          prescriptionModeFromStored(
            workItem
          );

        const repPrescription =
          prescriptionMode === "reps"
            ? repPrescriptionFromStored(
                workItem
              )
            : null;

        const durationPrescription =
          prescriptionMode === "duration"
            ? durationPrescriptionFromStored(
                workItem
              )
            : null;

        const distancePrescription =
          prescriptionMode === "distance"
            ? distancePrescriptionFromStored(
                workItem
              )
            : null;

        const loadingReference =
          loadingReferenceFromStored(
            workItem
          );

        const exerciseId =
          cleanString(
            workItem.exercise_id
          );

        if (
          !registry.entries[
            exerciseId
          ]
        ) {
          throw new Beta18ProgrammeTemplateError(
            "assigned_template_registry_reference_invalid"
          );
        }

        const resolvedLoad =
          loadingReference.type ===
            "percent_1rm"
            ? resolvePercentageLoad(
                athleteProfile,
                exerciseId,
                loadingReference.value
              )
            : null;

        if (
          loadingReference.type ===
            "percent_1rm" &&
          !resolvedLoad
        ) {
          throw new Beta18ProgrammeTemplateError(
            "athlete_one_rep_max_missing"
          );
        }

        return deepFreeze({
          block_id:
            cleanString(
              selectedSession
                .template_block_id
            ) ||
            `${templateId}_block_1`,
          item_id:
            cleanString(
              workItem
                .work_item_id
            ) ||
            `${templateId}_item_${index + 1}`,
          exercise_id:
            exerciseId,
          session_id:
            cleanString(
              selectedSession
                .session_id
            ) ||
            `${templateId}_session_${nextIndex + 1}`,
          role:
            cleanString(
              workItem.role
            ) === "primary"
              ? "primary"
              : "accessory",
          coaching_notes:
            cleanString(
              workItem.coaching_notes
            ),
          segment:
            workItemSegments.has(
              cleanString(workItem.segment)
            )
              ? cleanString(workItem.segment)
              : "working",
          group_id:
            cleanString(
              workItem.group_id
            ),
          group_type:
            workItemGroupTypes.has(
              cleanString(workItem.group_type)
            )
              ? cleanString(workItem.group_type)
              : "straight",
          prescription_mode:
            prescriptionMode,
          tempo:
            cleanString(
              workItem.tempo
            ),
          sets:
            Number(
              workItem
                .planned_sets
            ),
          ...(repPrescription
            ? {
                reps:
                  repPrescription.type ===
                    "range"
                    ? repPrescription.minimum
                    : repPrescription.value,
                ...(repPrescription.type ===
                  "range"
                  ? {
                      rep_range:
                        deepFreeze({
                          minimum:
                            repPrescription.minimum,
                          maximum:
                            repPrescription.maximum
                        })
                    }
                  : {})
              }
            : {}),
          ...(durationPrescription
            ? {
                duration_seconds:
                  durationPrescription.type ===
                    "range"
                    ? durationPrescription.minimum
                    : durationPrescription.value,
                ...(durationPrescription.type ===
                  "range"
                  ? {
                      duration_range:
                        deepFreeze({
                          minimum:
                            durationPrescription.minimum,
                          maximum:
                            durationPrescription.maximum
                        })
                    }
                  : {})
              }
            : {}),
          ...(distancePrescription
            ? {
                distance_value:
                  distancePrescription.type ===
                    "range"
                    ? distancePrescription.minimum
                    : distancePrescription.value,
                distance_unit:
                  distancePrescription.unit,
                ...(distancePrescription.type ===
                  "range"
                  ? {
                      distance_range:
                        deepFreeze({
                          minimum:
                            distancePrescription.minimum,
                          maximum:
                            distancePrescription.maximum
                        })
                    }
                  : {})
              }
            : {}),
          intensity:
            loadingReference,
          resolved_load:
            resolvedLoad,
          rest_seconds:
            Number(
              workItem
                .rest_seconds
            )
        });
      }
    );

  const exerciseIds =
    plannedItems.map(
      (item) =>
        String(
          item.exercise_id
        )
    );

  const exercisePool:
    Record<string, JsonRecord> =
    {};

  for (
    const exerciseId of
    exerciseIds
  ) {
    exercisePool[exerciseId] =
      registry.entries[
        exerciseId
      ];
  }

  const baseProgram =
    isRecord(
      input.base_program
    )
      ? input.base_program
      : {};

  return deepFreeze({
    ...baseProgram,
    program_id:
      templateId,
    version:
      String(
        template.template_version
      ),
    blocks:
      (() => {
        const structure =
          isRecord(
            template.template_structure
          )
            ? template.template_structure
            : {};

        return Array.isArray(
          structure.blocks
        )
          ? structure.blocks
          : [];
      })(),
    planned_items:
      plannedItems,
    planned_exercise_ids:
      exerciseIds,
    exercises:
      exerciseIds.map(
        (exerciseId) =>
          registry.entries[
            exerciseId
          ]
      ),
    exercise_pool:
      exercisePool,
    target_exercise_id:
      exerciseIds[0],
    coach_template_execution:
      deepFreeze({
        template_id:
          templateId,
        template_version:
          template.template_version,
        template_record_sha256:
          template.record_sha256,
        assignment_id:
          assignmentId,
        template_session_id:
          selectedSession
            .session_id,
        template_session_index:
          nextIndex,
        template_session_title:
          selectedSession.title,
        template_session_coaching_notes:
          selectedSession.coaching_notes,
        template_block_id:
          selectedSession
            .template_block_id,
        template_block_name:
          selectedSession
            .template_block_name,
        template_block_type:
          selectedSession
            .template_block_type,
        template_block_order:
          selectedSession
            .template_block_order,
        template_week_id:
          selectedSession
            .template_week_id,
        template_week_order:
          selectedSession
            .template_week_order,
        template_week_index_global:
          selectedSession
            .template_week_index_global,
        template_week_start_date:
          executionWeek
            ? cleanString(executionWeek.start_date) || null
            : selectedSession
                .template_week_start_date,
        template_week_end_date:
          executionWeek
            ? cleanString(executionWeek.end_date) || null
            : selectedSession
                .template_week_end_date,
        days_until_event_at_week_start:
          executionWeek &&
          Number.isInteger(executionWeek.days_until_event_at_week_start)
            ? Number(executionWeek.days_until_event_at_week_start)
            : selectedSession
                .days_until_event_at_week_start,
        event_plan:
          executionEventPlan,
        event_compile_summary:
          executionEventCompileSummary,
        event_record_sha256:
          cleanString(input.event_record_sha256) || null,
        athlete_profile_record_sha256:
          cleanString(
            athleteProfile
              ?.record_sha256
          ) || null,
        order_policy:
          "explicit_order_index_only",
        registry_reference_policy:
          "active_exercise_registry_only"
      })
  });
}
