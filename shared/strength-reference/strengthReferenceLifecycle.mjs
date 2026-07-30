// DEV NOTE: FULL-UI-08C immutable strength-reference lifecycle law.
// This module performs factual selection, unit presentation, programme preflight,
// immutable replacement validation and resolved-load source reconstruction.
// The module is limited to declared facts and deterministic reconstruction.

const SOURCE_TYPES =
  new Set([
    "tested_1rm",
    "estimated_1rm",
    "training_max"
  ]);

const WEIGHT_UNITS =
  new Set([
    "kg",
    "lb"
  ]);

const KG_TO_LB =
  2.2046226218487757;

export class StrengthReferenceLifecycleError
  extends Error {
  constructor(code) {
    super(code);
    this.name =
      "StrengthReferenceLifecycleError";
    this.code = code;
  }
}

function fail(code) {
  throw new StrengthReferenceLifecycleError(
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

function weightUnit(
  value,
  code
) {
  const unit =
    cleanString(value);

  if (
    !WEIGHT_UNITS.has(unit)
  ) {
    fail(code);
  }

  return unit;
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
      `${text}T00:00:00.000Z`
    );

  if (
    !Number.isFinite(parsed)
  ) {
    fail(code);
  }

  const canonical =
    new Date(parsed)
      .toISOString()
      .slice(0, 10);

  if (
    canonical !== text
  ) {
    fail(code);
  }

  return canonical;
}

function sourceRecords(
  value
) {
  if (
    Array.isArray(value)
  ) {
    return value;
  }

  if (
    isRecord(value) &&
    Array.isArray(value.benchmarks)
  ) {
    return value.benchmarks;
  }

  return [];
}

function sourceId(
  value
) {
  return cleanString(
    value?.benchmark_id ??
    value?.reference_id
  );
}

function sourceType(
  value
) {
  const type =
    cleanString(
      value?.basis ??
      value?.source_type
    );

  if (
    !SOURCE_TYPES.has(type)
  ) {
    fail(
      "strength_reference_source_type_invalid"
    );
  }

  return type;
}

function sourceValue(
  value
) {
  const number =
    finiteNumber(
      value?.value ??
      value?.source_value,
      "strength_reference_value_invalid"
    );

  if (
    number < 0.25 ||
    number > 1500
  ) {
    fail(
      "strength_reference_value_invalid"
    );
  }

  const normalised =
    Number(
      number.toFixed(3)
    );

  if (
    Math.abs(
      number - normalised
    ) > 0.0000001
  ) {
    fail(
      "strength_reference_value_precision_invalid"
    );
  }

  return normalised;
}

function normaliseSource(
  value
) {
  if (
    !isRecord(value)
  ) {
    fail(
      "strength_reference_invalid"
    );
  }

  const referenceId =
    sourceId(value);

  if (
    !referenceId ||
    !/^[a-z0-9_:-]+$/u.test(
      referenceId
    )
  ) {
    fail(
      "strength_reference_id_invalid"
    );
  }

  const exerciseId =
    cleanString(
      value.exercise_id
    );

  if (
    !exerciseId
  ) {
    fail(
      "strength_reference_exercise_required"
    );
  }

  const note =
    cleanString(
      value.source_note
    );

  if (
    note.length > 240
  ) {
    fail(
      "strength_reference_source_note_too_long"
    );
  }

  const replacementId =
    cleanString(
      value.replaces_reference_id
    ) || null;

  if (
    replacementId &&
    !/^[a-z0-9_:-]+$/u.test(
      replacementId
    )
  ) {
    fail(
      "strength_reference_replacement_id_invalid"
    );
  }

  return Object.freeze({
    reference_id:
      referenceId,
    benchmark_id:
      referenceId,
    exercise_id:
      exerciseId,
    source_type:
      sourceType(value),
    source_value:
      sourceValue(value),
    source_unit:
      weightUnit(
        value.unit ??
        value.source_unit,
        "strength_reference_unit_invalid"
      ),
    effective_date:
      dateOnly(
        value.effective_date,
        "strength_reference_effective_date_invalid"
      ),
    source_note:
      note || null,
    replaces_reference_id:
      replacementId
  });
}

function compareSources(
  left,
  right
) {
  const date =
    left.effective_date.localeCompare(
      right.effective_date
    );

  if (
    date !== 0
  ) {
    return date;
  }

  return left.reference_id.localeCompare(
    right.reference_id
  );
}

function canonicalFacts(
  value
) {
  const source =
    normaliseSource(value);

  return JSON.stringify({
    reference_id:
      source.reference_id,
    exercise_id:
      source.exercise_id,
    source_type:
      source.source_type,
    source_value:
      source.source_value,
    source_unit:
      source.source_unit,
    effective_date:
      source.effective_date,
    source_note:
      source.source_note,
    replaces_reference_id:
      source.replaces_reference_id
  });
}

function cloneRecord(
  value
) {
  return JSON.parse(
    JSON.stringify(value)
  );
}

function convertExact(
  value,
  fromUnit,
  toUnit
) {
  if (
    fromUnit === toUnit
  ) {
    return value;
  }

  return fromUnit === "kg"
    ? value * KG_TO_LB
    : value / KG_TO_LB;
}

export function convertStrengthValue(
  valueInput,
  fromUnitInput,
  toUnitInput
) {
  const value =
    finiteNumber(
      valueInput,
      "strength_reference_conversion_value_invalid"
    );

  const fromUnit =
    weightUnit(
      fromUnitInput,
      "strength_reference_conversion_source_unit_invalid"
    );

  const toUnit =
    weightUnit(
      toUnitInput,
      "strength_reference_conversion_target_unit_invalid"
    );

  return Number(
    convertExact(
      value,
      fromUnit,
      toUnit
    ).toFixed(3)
  );
}

function displayProjection(
  source,
  displayUnit,
  lifecycleStatus
) {
  return Object.freeze({
    ...source,
    display_value:
      convertStrengthValue(
        source.source_value,
        source.source_unit,
        displayUnit
      ),
    display_unit:
      displayUnit,
    lifecycle_status:
      lifecycleStatus,
    factual_source_only:
      true,
    readiness_inferred:
      false,
    suitability_inferred:
      false,
    safety_inferred:
      false
  });
}

export function projectStrengthReferenceLifecycle(
  recordsOrProfile,
  displayUnitInput = "kg",
  asOfDateInput =
    new Date()
      .toISOString()
      .slice(0, 10)
) {
  const displayUnit =
    weightUnit(
      displayUnitInput,
      "strength_reference_display_unit_invalid"
    );

  const asOfDate =
    dateOnly(
      asOfDateInput,
      "strength_reference_as_of_date_invalid"
    );

  const records =
    sourceRecords(
      recordsOrProfile
    ).map(
      normaliseSource
    );

  const ids =
    new Set();

  for (
    const record of records
  ) {
    if (
      ids.has(
        record.reference_id
      )
    ) {
      fail(
        "strength_reference_id_duplicate"
      );
    }

    ids.add(
      record.reference_id
    );
  }

  const grouped =
    new Map();

  for (
    const record of records
  ) {
    const group =
      grouped.get(
        record.exercise_id
      ) ?? [];

    group.push(record);

    grouped.set(
      record.exercise_id,
      group
    );
  }

  const current = [];
  const superseded = [];
  const scheduled = [];
  const all = [];

  for (
    const exerciseId of
    [...grouped.keys()].sort()
  ) {
    const ordered =
      grouped
        .get(exerciseId)
        .slice()
        .sort(compareSources);

    const effective =
      ordered.filter(
        (record) =>
          record.effective_date <=
          asOfDate
      );

    const currentRecord =
      effective.at(-1) ??
      null;

    for (
      const record of ordered
    ) {
      let status =
        "scheduled";

      if (
        currentRecord &&
        record.reference_id ===
          currentRecord.reference_id
      ) {
        status =
          "current";
      }
      else if (
        record.effective_date <=
        asOfDate
      ) {
        status =
          "superseded";
      }

      const projected =
        displayProjection(
          record,
          displayUnit,
          status
        );

      all.push(projected);

      if (
        status === "current"
      ) {
        current.push(projected);
      }
      else if (
        status === "superseded"
      ) {
        superseded.push(projected);
      }
      else {
        scheduled.push(projected);
      }
    }
  }

  return Object.freeze({
    as_of_date:
      asOfDate,
    display_unit:
      displayUnit,
    current:
      Object.freeze(current),
    superseded:
      Object.freeze(superseded),
    scheduled:
      Object.freeze(scheduled),
    records:
      Object.freeze(all),
    record_count:
      all.length,
    current_count:
      current.length,
    superseded_count:
      superseded.length,
    scheduled_count:
      scheduled.length
  });
}

export function assertImmutableStrengthReferenceAppend(
  previousRecordsOrProfile,
  nextRecordsOrProfile
) {
  const previousRaw =
    sourceRecords(
      previousRecordsOrProfile
    );

  const nextRaw =
    sourceRecords(
      nextRecordsOrProfile
    );

  const previous =
    previousRaw.map(
      normaliseSource
    );

  const next =
    nextRaw.map(
      normaliseSource
    );

  const previousById =
    new Map(
      previous.map(
        (record, index) => [
          record.reference_id,
          {
            record,
            raw:
              previousRaw[index]
          }
        ]
      )
    );

  const nextById =
    new Map();

  for (
    const record of next
  ) {
    if (
      nextById.has(
        record.reference_id
      )
    ) {
      fail(
        "strength_reference_id_duplicate"
      );
    }

    nextById.set(
      record.reference_id,
      record
    );
  }

  for (
    const previousRecord of
    previous
  ) {
    const nextRecord =
      nextById.get(
        previousRecord.reference_id
      );

    if (
      !nextRecord
    ) {
      fail(
        "strength_reference_history_removal_forbidden"
      );
    }

    if (
      canonicalFacts(
        previousRecord
      ) !==
      canonicalFacts(
        nextRecord
      )
    ) {
      fail(
        "strength_reference_history_mutation_forbidden"
      );
    }
  }

  const output =
    nextRaw.map(
      (record) =>
        cloneRecord(record)
    );

  const outputById =
    new Map(
      output.map(
        (record) => [
          sourceId(record),
          record
        ]
      )
    );

  for (
    const [
      referenceId,
      previousEntry
    ] of previousById
  ) {
    outputById.set(
      referenceId,
      cloneRecord(
        previousEntry.raw
      )
    );
  }

  const newByExercise =
    new Map();

  for (
    const record of next
  ) {
    if (
      previousById.has(
        record.reference_id
      )
    ) {
      continue;
    }

    const records =
      newByExercise.get(
        record.exercise_id
      ) ?? [];

    records.push(record);

    newByExercise.set(
      record.exercise_id,
      records
    );
  }

  for (
    const [
      exerciseId,
      newRecords
    ] of newByExercise
  ) {
    const existing =
      previous
        .filter(
          (record) =>
            record.exercise_id ===
            exerciseId
        )
        .sort(compareSources);

    let predecessor =
      existing.at(-1) ??
      null;

    for (
      const record of
      newRecords
        .slice()
        .sort(compareSources)
    ) {
      if (
        predecessor &&
        record.effective_date <=
          predecessor.effective_date
      ) {
        fail(
          "strength_reference_replacement_effective_date_invalid"
        );
      }

      const expectedReplacement =
        predecessor
          ? predecessor.reference_id
          : null;

      if (
        record.replaces_reference_id &&
        record.replaces_reference_id !==
          expectedReplacement
      ) {
        fail(
          "strength_reference_replacement_target_invalid"
        );
      }

      const outputRecord =
        output.find(
          (candidate) =>
            sourceId(candidate) ===
            record.reference_id
        );

      if (
        !outputRecord
      ) {
        fail(
          "strength_reference_output_record_missing"
        );
      }

      outputRecord.replaces_reference_id =
        expectedReplacement;

      predecessor =
        normaliseSource(
          outputRecord
        );
    }
  }

  return Object.freeze(
    output.map(
      (record) =>
        Object.freeze(record)
    )
  );
}

export function requiredStrengthReferenceExerciseIds(
  template
) {
  const ids =
    new Set();

  const blocks =
    Array.isArray(
      template?.template_structure
        ?.blocks
    )
      ? template.template_structure
          .blocks
      : [];

  for (
    const block of blocks
  ) {
    for (
      const week of
      Array.isArray(block?.weeks)
        ? block.weeks
        : []
    ) {
      for (
        const day of
        Array.isArray(week?.days)
          ? week.days
          : []
      ) {
        for (
          const session of
          Array.isArray(day?.sessions)
            ? day.sessions
            : []
        ) {
          for (
            const item of
            Array.isArray(
              session?.work_items
            )
              ? session.work_items
              : []
          ) {
            if (
              item?.loading_reference
                ?.type ===
              "percent_1rm"
            ) {
              const exerciseId =
                cleanString(
                  item.exercise_id
                );

              if (
                exerciseId
              ) {
                ids.add(
                  exerciseId
                );
              }
            }
          }
        }
      }
    }
  }

  return Object.freeze(
    [...ids].sort()
  );
}

export function compareProgrammeStrengthRequirements(
  template,
  recordsOrProfile,
  asOfDateInput =
    new Date()
      .toISOString()
      .slice(0, 10),
  displayUnitInput = "kg"
) {
  const required =
    requiredStrengthReferenceExerciseIds(
      template
    );

  const lifecycle =
    projectStrengthReferenceLifecycle(
      recordsOrProfile,
      displayUnitInput,
      asOfDateInput
    );

  const currentByExercise =
    new Map(
      lifecycle.current.map(
        (record) => [
          record.exercise_id,
          record
        ]
      )
    );

  const missing =
    required.filter(
      (exerciseId) =>
        !currentByExercise.has(
          exerciseId
        )
    );

  const available =
    required.filter(
      (exerciseId) =>
        currentByExercise.has(
          exerciseId
        )
    );

  return Object.freeze({
    as_of_date:
      lifecycle.as_of_date,
    required:
      Object.freeze(required),
    available:
      Object.freeze(available),
    missing:
      Object.freeze(missing),
    complete:
      missing.length === 0,
    effective_sources:
      Object.freeze(
        available.map(
          (exerciseId) =>
            currentByExercise.get(
              exerciseId
            )
        )
      )
  });
}

export function resolveStrengthReferenceLoad(
  recordsOrProfile,
  exerciseIdInput,
  percentageInput,
  options = {}
) {
  const exerciseId =
    cleanString(
      exerciseIdInput
    );

  if (
    !exerciseId
  ) {
    fail(
      "strength_reference_resolution_exercise_required"
    );
  }

  const percentage =
    finiteNumber(
      percentageInput,
      "strength_reference_percentage_invalid"
    );

  if (
    percentage < 1 ||
    percentage > 100
  ) {
    fail(
      "strength_reference_percentage_invalid"
    );
  }

  const targetUnit =
    weightUnit(
      options.target_unit ??
      recordsOrProfile
        ?.preferred_weight_unit ??
      "kg",
      "strength_reference_resolution_unit_invalid"
    );

  const increment =
    finiteNumber(
      options.rounding_increment ??
      recordsOrProfile
        ?.load_rounding_increment ??
      (
        targetUnit === "lb"
          ? 5
          : 2.5
      ),
      "strength_reference_rounding_increment_invalid"
    );

  if (
    increment < 0.25 ||
    increment > 25
  ) {
    fail(
      "strength_reference_rounding_increment_invalid"
    );
  }

  const lifecycle =
    projectStrengthReferenceLifecycle(
      recordsOrProfile,
      targetUnit,
      options.as_of_date ??
      new Date()
        .toISOString()
        .slice(0, 10)
    );

  const source =
    lifecycle.current.find(
      (record) =>
        record.exercise_id ===
        exerciseId
    );

  if (
    !source
  ) {
    return null;
  }

  const calculationSource =
    Number(
      convertExact(
        source.source_value,
        source.source_unit,
        targetUnit
      ).toFixed(6)
    );

  const rawLoad =
    calculationSource *
    percentage /
    100;

  const resolvedLoad =
    Number(
      (
        Math.round(
          rawLoad /
          increment
        ) *
        increment
      ).toFixed(3)
    );

  return Object.freeze({
    type:
      "resolved_load",
    value:
      resolvedLoad,
    unit:
      targetUnit,
    percentage,
    one_rep_max:
      source.source_value,
    one_rep_max_unit:
      source.source_unit,
    calculation_one_rep_max:
      calculationSource,
    calculation_one_rep_max_unit:
      targetUnit,
    benchmark_basis:
      source.source_type,
    benchmark_effective_date:
      source.effective_date,
    benchmark_id:
      source.reference_id,
    rounding_increment:
      increment,
    source:
      Object.freeze({
        reference_id:
          source.reference_id,
        exercise_id:
          source.exercise_id,
        source_type:
          source.source_type,
        source_value:
          source.source_value,
        source_unit:
          source.source_unit,
        effective_date:
          source.effective_date,
        source_note:
          source.source_note,
        replaces_reference_id:
          source.replaces_reference_id
      }),
    factual_source_only:
      true,
    readiness_inferred:
      false,
    suitability_inferred:
      false,
    safety_inferred:
      false
  });
}