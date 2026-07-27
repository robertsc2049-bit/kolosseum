// DEV NOTE: BETA-19 coach programme workspace product state.
// This service records factual athlete strength references supplied by an
// accepted coach-athlete relationship. It performs deterministic arithmetic
// for percentage-based loads without readiness, safety, suitability,
// capability, or recommendation inference.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { pool } from "../db/pool.js";
import {
  loadBeta17StoredCoachContext,
  loadLatestBetaProductRecord,
  persistBetaProductRecord
} from "./beta_product_record_store.js";

type JsonRecord = Record<string, unknown>;

export class Beta19CoachWorkspaceError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(`beta19_coach_workspace_${reason}`);
    this.name = "Beta19CoachWorkspaceError";
    this.reason = reason;
  }
}

const weightUnits = new Set(["kg", "lb"]);
const supportedActivities = new Set([
  "powerlifting",
  "general_strength",
  "rugby_union"
]);
const benchmarkBases = new Set([
  "tested_1rm",
  "estimated_1rm",
  "training_max"
]);

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

function exactKeys(
  record: JsonRecord,
  allowed: readonly string[],
  reason: string
): void {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) {
      throw new Beta19CoachWorkspaceError(`${reason}_unknown_field`);
    }
  }
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
    throw new Beta19CoachWorkspaceError(reason);
  }

  const normalised = Number(value.toFixed(3));
  if (Math.abs(value - normalised) > 0.0000001) {
    throw new Beta19CoachWorkspaceError(`${reason}_precision_invalid`);
  }

  return normalised;
}

function dateOnly(value: unknown, reason: string): string {
  const text = cleanString(value);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(text)) {
    throw new Beta19CoachWorkspaceError(reason);
  }

  const parsed = Date.parse(`${text}T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) {
    throw new Beta19CoachWorkspaceError(reason);
  }

  const canonicalDate =
    new Date(parsed)
      .toISOString()
      .slice(0, 10);

  if (canonicalDate !== text) {
    throw new Beta19CoachWorkspaceError(reason);
  }

  return canonicalDate;
}

function iso8601(value: unknown, reason: string): string {
  const text = cleanString(value);
  const parsed = Date.parse(text);
  if (!text || !Number.isFinite(parsed)) {
    throw new Beta19CoachWorkspaceError(reason);
  }
  return new Date(parsed).toISOString();
}

function loadExerciseIds(): ReadonlySet<string> {
  const registryPath = path.resolve(
    process.cwd(),
    "registries",
    "exercise",
    "exercise.registry.json"
  );

  const parsed = JSON.parse(fs.readFileSync(registryPath, "utf8")) as unknown;
  if (
    !isRecord(parsed) ||
    cleanString(parsed.registry_id) !== "exercise" ||
    !isRecord(parsed.entries)
  ) {
    throw new Beta19CoachWorkspaceError("exercise_registry_invalid");
  }

  return new Set(Object.keys(parsed.entries));
}

async function requireActiveCoachAccount(
  coachUserId: string
): Promise<Readonly<JsonRecord>> {
  const profile =
    await loadLatestBetaProductRecord(
      "beta17_coach_profile",
      coachUserId,
      coachUserId
    );

  if (
    !profile ||
    profile.account_role !== "coach" ||
    profile.account_state !== "active"
  ) {
    throw new Beta19CoachWorkspaceError(
      "coach_access_denied"
    );
  }

  return profile;
}

async function requireCoachAthleteAccess(
  coachUserId: string,
  athleteUserId: string
): Promise<void> {
  const context = await loadBeta17StoredCoachContext(
    coachUserId,
    athleteUserId
  );

  if (!context) {
    throw new Beta19CoachWorkspaceError("relationship_access_denied");
  }

  const profile = isRecord(context.coach_profile) ? context.coach_profile : {};
  const relationship = isRecord(context.relationship) ? context.relationship : {};

  if (
    profile.account_role !== "coach" ||
    profile.account_state !== "active" ||
    relationship.relationship_state !== "accepted" ||
    relationship.coach_user_id !== coachUserId ||
    relationship.athlete_user_id !== athleteUserId
  ) {
    throw new Beta19CoachWorkspaceError("relationship_access_denied");
  }
}

function normaliseBenchmark(
  raw: unknown,
  index: number,
  exerciseIds: ReadonlySet<string>
): Readonly<JsonRecord> {
  if (!isRecord(raw)) {
    throw new Beta19CoachWorkspaceError("benchmark_invalid");
  }

  exactKeys(
    raw,
    [
      "benchmark_id",
      "exercise_id",
      "value",
      "unit",
      "basis",
      "effective_date",
      "source_note"
    ],
    "benchmark"
  );

  const exerciseId = cleanString(raw.exercise_id);
  if (!exerciseIds.has(exerciseId)) {
    throw new Beta19CoachWorkspaceError("benchmark_exercise_invalid");
  }

  const unit = cleanString(raw.unit) || "kg";
  if (!weightUnits.has(unit)) {
    throw new Beta19CoachWorkspaceError("benchmark_unit_invalid");
  }

  const basis = cleanString(raw.basis) || "tested_1rm";
  if (!benchmarkBases.has(basis)) {
    throw new Beta19CoachWorkspaceError("benchmark_basis_invalid");
  }

  const effectiveDate = dateOnly(
    raw.effective_date,
    "benchmark_effective_date_invalid"
  );

  const value = numberInRange(
    raw.value,
    0.25,
    1500,
    "benchmark_value_invalid"
  );

  const sourceNote = cleanString(raw.source_note);
  if (sourceNote.length > 240) {
    throw new Beta19CoachWorkspaceError("benchmark_source_note_too_long");
  }

  const benchmarkId = cleanString(raw.benchmark_id) ||
    `benchmark_${sha256({ exerciseId, value, unit, basis, effectiveDate, index }).slice(0, 24)}`;

  if (!/^[a-z0-9_:-]+$/u.test(benchmarkId)) {
    throw new Beta19CoachWorkspaceError("benchmark_id_invalid");
  }

  return deepFreeze({
    benchmark_id: benchmarkId,
    exercise_id: exerciseId,
    value,
    unit,
    basis,
    effective_date: effectiveDate,
    source_note: sourceNote || null
  });
}

function normaliseProfileInput(input: JsonRecord): Readonly<JsonRecord> {
  exactKeys(
    input,
    [
      "coach_user_id",
      "athlete_user_id",
      "preferred_weight_unit",
      "load_rounding_increment",
      "bodyweight",
      "bodyweight_unit",
      "benchmarks",
      "updated_at_iso8601"
    ],
    "athlete_profile"
  );

  const coachUserId = cleanString(input.coach_user_id);
  const athleteUserId = cleanString(input.athlete_user_id);

  if (!coachUserId || !athleteUserId) {
    throw new Beta19CoachWorkspaceError("profile_identity_required");
  }

  const preferredWeightUnit = cleanString(input.preferred_weight_unit) || "kg";
  if (!weightUnits.has(preferredWeightUnit)) {
    throw new Beta19CoachWorkspaceError("preferred_weight_unit_invalid");
  }

  const loadRoundingIncrement = numberInRange(
    input.load_rounding_increment ?? (preferredWeightUnit === "lb" ? 5 : 2.5),
    0.25,
    25,
    "load_rounding_increment_invalid"
  );

  const bodyweightUnit = cleanString(input.bodyweight_unit) || preferredWeightUnit;
  if (!weightUnits.has(bodyweightUnit)) {
    throw new Beta19CoachWorkspaceError("bodyweight_unit_invalid");
  }

  let bodyweight: number | null = null;
  if (input.bodyweight !== null && typeof input.bodyweight !== "undefined" && input.bodyweight !== "") {
    bodyweight = numberInRange(
      input.bodyweight,
      10,
      500,
      "bodyweight_invalid"
    );
  }

  if (!Array.isArray(input.benchmarks) || input.benchmarks.length > 200) {
    throw new Beta19CoachWorkspaceError("benchmarks_invalid");
  }

  const exerciseIds = loadExerciseIds();
  const benchmarks = input.benchmarks.map((entry, index) =>
    normaliseBenchmark(entry, index, exerciseIds)
  );

  const benchmarkIds = new Set<string>();
  for (const benchmark of benchmarks) {
    const benchmarkId = String(benchmark.benchmark_id);
    if (benchmarkIds.has(benchmarkId)) {
      throw new Beta19CoachWorkspaceError("benchmark_id_duplicate");
    }
    benchmarkIds.add(benchmarkId);
  }

  const updatedAt = iso8601(
    input.updated_at_iso8601 ?? new Date().toISOString(),
    "updated_at_invalid"
  );

  return deepFreeze({
    coach_user_id: coachUserId,
    athlete_user_id: athleteUserId,
    preferred_weight_unit: preferredWeightUnit,
    load_rounding_increment: loadRoundingIncrement,
    bodyweight,
    bodyweight_unit: bodyweightUnit,
    benchmarks,
    updated_at_iso8601: updatedAt
  });
}

export async function listCoachAthleteRelationships(
  coachUserIdInput: string
): Promise<readonly Readonly<JsonRecord>[]> {
  const coachUserId =
    cleanString(coachUserIdInput);

  if (!coachUserId) {
    throw new Beta19CoachWorkspaceError(
      "coach_user_id_required"
    );
  }

  await requireActiveCoachAccount(
    coachUserId
  );

  const result = await pool.query(
    `
    SELECT DISTINCT ON (subject_user_id)
      subject_user_id,
      record_payload
    FROM beta_product_records
    WHERE
      record_type = 'beta17_coach_relationship'
      AND actor_user_id = $1
    ORDER BY
      subject_user_id,
      effective_at DESC,
      created_at DESC,
      record_sha256 DESC
    `,
    [coachUserId]
  );

  const relationships = result.rows
    .map((row) =>
      isRecord(row.record_payload)
        ? row.record_payload
        : null
    )
    .filter(
      (relationship): relationship is JsonRecord =>
        relationship !== null
    );

  const athletes = await Promise.all(
    relationships.map(async (relationship) => {
      const athleteUserId =
        cleanString(
          relationship.athlete_user_id
        );

      const [auth, declaration] =
        await Promise.all([
          loadLatestBetaProductRecord(
            "beta16_auth",
            athleteUserId,
            athleteUserId
          ),
          loadLatestBetaProductRecord(
            "beta16_phase1_declaration",
            athleteUserId,
            athleteUserId
          )
        ]);

      const phase1Input =
        declaration &&
        isRecord(declaration.phase1_input)
          ? declaration.phase1_input
          : {};

      const activityId =
        cleanString(phase1Input.activity_id);

      const storedState =
        cleanString(
          relationship.relationship_state
        );

      const expiresAt =
        cleanString(
          relationship.expires_at_iso8601
        );

      const expired =
        storedState === "invited" &&
        Boolean(expiresAt) &&
        Number.isFinite(Date.parse(expiresAt)) &&
        Date.parse(expiresAt) <= Date.now();

      return deepFreeze({
        athlete_user_id: athleteUserId,
        display_name:
          cleanString(auth?.display_name) ||
          athleteUserId,
        email:
          cleanString(auth?.email) ||
          null,
        activity_id:
          supportedActivities.has(activityId)
            ? activityId
            : null,
        relationship_state:
          expired
            ? "expired"
            : storedState,
        relationship_expired:
          expired,
        relationship
      });
    })
  );

  return deepFreeze(
    athletes.sort((left, right) =>
      String(left.display_name)
        .localeCompare(
          String(right.display_name)
        )
    )
  );
}

export async function listConnectedCoachAthletes(
  coachUserIdInput: string
): Promise<readonly Readonly<JsonRecord>[]> {
  const relationships =
    await listCoachAthleteRelationships(
      coachUserIdInput
    );

  return deepFreeze(
    relationships.filter(
      (athlete) =>
        athlete.relationship_state ===
          "accepted" &&
        athlete.relationship_expired !== true
    )
  );
}

export async function listCoachAssignments(
  coachUserIdInput: string
): Promise<readonly Readonly<JsonRecord>[]> {
  const coachUserId =
    cleanString(coachUserIdInput);

  if (!coachUserId) {
    throw new Beta19CoachWorkspaceError(
      "coach_user_id_required"
    );
  }

  await requireActiveCoachAccount(
    coachUserId
  );

  const result = await pool.query(
    `
    SELECT record_payload
    FROM beta_product_records
    WHERE
      record_type = 'beta17_assignment_trigger'
      AND actor_user_id = $1
    ORDER BY
      effective_at DESC,
      created_at DESC,
      record_id DESC,
      record_sha256 DESC
    `,
    [coachUserId]
  );

  const records = result.rows
    .map((row) =>
      isRecord(row.record_payload)
        ? row.record_payload
        : null
    )
    .filter(
      (record): record is JsonRecord =>
        record !== null
    );

  const lifecycleRecords = records.map(
    (record, index) => {
      const athleteUserId = cleanString(
        record.assigned_athlete_id
      );
      const assignmentId = cleanString(
        record.assignment_id
      );

      const newerForAthlete = records
        .slice(0, index)
        .filter(
          (candidate) =>
            cleanString(
              candidate.assigned_athlete_id
            ) === athleteUserId
        );

      let lifecycleStatus = cleanString(
        record.assignment_status
      ) || "assigned";

      if (lifecycleStatus === "assigned") {
        if (
          newerForAthlete.some(
            (candidate) =>
              cleanString(
                candidate.cancels_assignment_id
              ) === assignmentId
          )
        ) {
          lifecycleStatus = "cancelled";
        }
        else if (
          newerForAthlete.length > 0
        ) {
          lifecycleStatus = "replaced";
        }
      }

      const isCurrent =
        newerForAthlete.length === 0 &&
        lifecycleStatus === "assigned";

      return deepFreeze({
        ...record,
        lifecycle_status:
          lifecycleStatus,
        is_current: isCurrent,
        current_for_athlete: isCurrent,
        engine_visible: false
      });
    }
  );

  return deepFreeze(lifecycleRecords);
}

export async function saveAthleteStrengthProfile(
  input: unknown
): Promise<Readonly<JsonRecord>> {
  if (!isRecord(input)) {
    throw new Beta19CoachWorkspaceError("input_invalid");
  }

  const normalised = normaliseProfileInput(input);
  const coachUserId = String(normalised.coach_user_id);
  const athleteUserId = String(normalised.athlete_user_id);

  await requireCoachAthleteAccess(coachUserId, athleteUserId);

  const profileId = `beta19_athlete_profile_${sha256({ coachUserId, athleteUserId }).slice(0, 24)}`;

  const recordWithoutHash = deepFreeze({
    record_type: "beta19_athlete_strength_profile",
    profile_id: profileId,
    contract_version: "beta19.1.0.0",
    coach_user_id: coachUserId,
    athlete_user_id: athleteUserId,
    preferred_weight_unit: normalised.preferred_weight_unit,
    load_rounding_increment: normalised.load_rounding_increment,
    bodyweight: normalised.bodyweight,
    bodyweight_unit: normalised.bodyweight_unit,
    benchmarks: normalised.benchmarks,
    updated_at_iso8601: normalised.updated_at_iso8601,
    factual_user_supplied_state: true,
    inference_applied: false,
    readiness_semantics: false,
    safety_semantics: false,
    recommendation_semantics: false,
    engine_visible: false,
    compile_reference_visible: true
  });

  return persistBetaProductRecord(
    deepFreeze({
      ...recordWithoutHash,
      record_sha256: sha256(recordWithoutHash)
    })
  );
}

export async function loadAthleteStrengthProfile(
  coachUserIdInput: string,
  athleteUserIdInput: string
): Promise<Readonly<JsonRecord> | null> {
  const coachUserId = cleanString(coachUserIdInput);
  const athleteUserId = cleanString(athleteUserIdInput);

  if (!coachUserId || !athleteUserId) {
    throw new Beta19CoachWorkspaceError("profile_identity_required");
  }

  await requireCoachAthleteAccess(coachUserId, athleteUserId);

  const result = await pool.query(
    `
    SELECT record_payload
    FROM beta_product_records
    WHERE
      record_type = 'beta19_athlete_strength_profile'
      AND actor_user_id = $1
      AND subject_user_id = $2
    ORDER BY
      effective_at DESC,
      created_at DESC,
      record_sha256 DESC
    LIMIT 1
    `,
    [coachUserId, athleteUserId]
  );

  const payload = result.rows?.[0]?.record_payload;
  return isRecord(payload) ? deepFreeze(payload) : null;
}

export function currentBenchmarkForExercise(
  profile: Readonly<JsonRecord> | null,
  exerciseIdInput: string
): Readonly<JsonRecord> | null {
  if (!profile) return null;

  const exerciseId = cleanString(exerciseIdInput);
  const benchmarks = Array.isArray(profile.benchmarks)
    ? profile.benchmarks.filter(isRecord)
    : [];

  const matches = benchmarks
    .filter((entry) => cleanString(entry.exercise_id) === exerciseId)
    .sort((left, right) => {
      const dateCompare = String(right.effective_date ?? "").localeCompare(
        String(left.effective_date ?? "")
      );
      if (dateCompare !== 0) return dateCompare;
      return String(right.benchmark_id ?? "").localeCompare(
        String(left.benchmark_id ?? "")
      );
    });

  return matches[0] ? deepFreeze(matches[0]) : null;
}

export function resolvePercentageLoad(
  profile: Readonly<JsonRecord> | null,
  exerciseIdInput: string,
  percentageInput: number
): Readonly<JsonRecord> | null {
  if (!profile) return null;

  const benchmark = currentBenchmarkForExercise(profile, exerciseIdInput);
  if (!benchmark) return null;

  const percentage = numberInRange(
    percentageInput,
    1,
    100,
    "percentage_invalid"
  );

  const sourceOneRepMax = numberInRange(
    benchmark.value,
    0.25,
    1500,
    "stored_benchmark_value_invalid"
  );

  const sourceUnit =
    cleanString(benchmark.unit) === "lb"
      ? "lb"
      : "kg";

  const targetUnit =
    cleanString(profile.preferred_weight_unit) === "lb"
      ? "lb"
      : "kg";

  const calculationOneRepMax = Number((
    sourceUnit === targetUnit
      ? sourceOneRepMax
      : sourceUnit === "kg"
        ? sourceOneRepMax * 2.2046226218
        : sourceOneRepMax / 2.2046226218
  ).toFixed(6));

  const increment = numberInRange(
    profile.load_rounding_increment,
    0.25,
    25,
    "stored_rounding_increment_invalid"
  );

  const rawLoad = calculationOneRepMax * percentage / 100;
  const roundedLoad = Number((Math.round(rawLoad / increment) * increment).toFixed(3));

  return deepFreeze({
    type: "resolved_load",
    value: roundedLoad,
    unit: targetUnit,
    percentage,
    one_rep_max: sourceOneRepMax,
    one_rep_max_unit: sourceUnit,
    calculation_one_rep_max: calculationOneRepMax,
    calculation_one_rep_max_unit: targetUnit,
    benchmark_basis: cleanString(benchmark.basis),
    benchmark_effective_date: cleanString(benchmark.effective_date),
    benchmark_id: cleanString(benchmark.benchmark_id),
    athlete_profile_record_sha256: cleanString(profile.record_sha256),
    rounding_increment: increment
  });
}

// FULL-UI-04B athlete-detail factual read model.
// FUNCTION NOTE:
// Purpose: Loads one accepted coach-athlete detail surface containing immutable
// programme, event-link, strength-reference, bodyweight, session, and note history.
// Boundary: Read-only product/runtime projection. It does not call the engine,
// infer readiness, rank athletes, or alter assignment/session truth.
// Determinism: Records are ordered by persisted effective and creation timestamps.
// Failure: Identity and accepted-relationship checks fail closed.
export async function loadCoachAthleteDetail(
  coachUserIdInput: string,
  athleteUserIdInput: string
): Promise<Readonly<JsonRecord>> {
  const coachUserId =
    cleanString(coachUserIdInput);

  const athleteUserId =
    cleanString(athleteUserIdInput);

  if (!coachUserId || !athleteUserId) {
    throw new Beta19CoachWorkspaceError(
      "athlete_detail_identity_required"
    );
  }

  await requireCoachAthleteAccess(
    coachUserId,
    athleteUserId
  );

  const [
    recordResult,
    sessionResult,
    noteResult
  ] = await Promise.all([
    pool.query(
      `
      SELECT
        record_type,
        record_payload,
        effective_at,
        created_at
      FROM beta_product_records
      WHERE
        actor_user_id = $1
        AND subject_user_id = $2
        AND record_type IN (
          'beta17_assignment_trigger',
          'beta19_athlete_strength_profile',
          'beta19_event_athlete_link'
        )
      ORDER BY
        effective_at DESC,
        created_at DESC,
        record_id DESC,
        record_sha256 DESC
      `,
      [
        coachUserId,
        athleteUserId
      ]
    ),
    pool.query(
      `
      SELECT
        s.session_id,
        s.block_id,
        s.status,
        s.beta_assignment_id,
        s.created_at,
        s.updated_at,
        count(re.seq)::integer
          AS runtime_event_count
      FROM sessions s
      LEFT JOIN runtime_events re
        ON re.session_id = s.session_id
      WHERE
        s.beta_subject_user_id = $1
        AND s.beta_coach_user_id = $2
      GROUP BY
        s.session_id,
        s.block_id,
        s.status,
        s.beta_assignment_id,
        s.created_at,
        s.updated_at
      ORDER BY
        s.updated_at DESC,
        s.session_id DESC
      `,
      [
        athleteUserId,
        coachUserId
      ]
    ),
    pool.query(
      `
      SELECT
        note_payload,
        created_at
      FROM product_coach_notes
      WHERE
        coach_user_id = $1
        AND athlete_user_id = $2
      ORDER BY
        created_at DESC,
        note_id DESC
      `,
      [
        coachUserId,
        athleteUserId
      ]
    )
  ]);

  const assignmentHistory:
    Readonly<JsonRecord>[] = [];

  const strengthProfileHistory:
    Readonly<JsonRecord>[] = [];

  const eventLinkHistory:
    Readonly<JsonRecord>[] = [];

  for (const row of recordResult.rows) {
    if (!isRecord(row.record_payload)) {
      continue;
    }

    const record = deepFreeze({
      ...row.record_payload,
      stored_effective_at:
        new Date(
          row.effective_at
        ).toISOString(),
      stored_created_at:
        new Date(
          row.created_at
        ).toISOString()
    });

    if (
      row.record_type ===
      "beta17_assignment_trigger"
    ) {
      assignmentHistory.push(record);
    }
    else if (
      row.record_type ===
      "beta19_athlete_strength_profile"
    ) {
      strengthProfileHistory.push(record);
    }
    else if (
      row.record_type ===
      "beta19_event_athlete_link"
    ) {
      eventLinkHistory.push(record);
    }
  }

  const assignmentLifecycleHistory =
    assignmentHistory.map(
      (assignment, index) => {
        const assignmentId =
          cleanString(
            assignment.assignment_id
          );

        const newer =
          assignmentHistory
            .slice(0, index);

        let lifecycleStatus =
          cleanString(
            assignment.assignment_status
          ) || "assigned";

        if (lifecycleStatus === "assigned") {
          if (
            newer.some(
              (candidate) =>
                cleanString(
                  candidate.cancels_assignment_id
                ) === assignmentId
            )
          ) {
            lifecycleStatus = "cancelled";
          }
          else if (newer.length > 0) {
            lifecycleStatus = "replaced";
          }
        }

        return deepFreeze({
          ...assignment,
          lifecycle_status:
            lifecycleStatus,
          is_current:
            index === 0 &&
            lifecycleStatus === "assigned"
        });
      }
    );

  const currentAssignment:
    Readonly<JsonRecord> | null =
      assignmentLifecycleHistory[0]
        ?.lifecycle_status === "assigned"
        ? assignmentLifecycleHistory[0] as
            Readonly<JsonRecord>
        : null;

  const bodyweightHistory =
    strengthProfileHistory
      .filter(
        (profile) =>
          typeof profile.bodyweight ===
            "number" &&
          Number.isFinite(
            profile.bodyweight
          )
      )
      .map(
        (profile) =>
          deepFreeze({
            bodyweight:
              profile.bodyweight,
            unit:
              profile.bodyweight_unit,
            effective_at:
              profile.updated_at_iso8601 ??
              profile.stored_effective_at,
            profile_id:
              profile.profile_id
          })
      );

  const sessionHistory =
    sessionResult.rows.map(
      (row) =>
        deepFreeze({
          session_id:
            String(row.session_id),
          artefact_id:
            `beta_e2e_artefact_${String(
              row.session_id
            )}`,
          block_id:
            String(row.block_id ?? ""),
          session_status:
            String(row.status),
          assignment_id:
            cleanString(
              row.beta_assignment_id
            ) || null,
          runtime_event_count:
            Number(
              row.runtime_event_count
            ),
          created_at:
            new Date(
              row.created_at
            ).toISOString(),
          updated_at:
            new Date(
              row.updated_at
            ).toISOString()
        })
    );

  const noteHistory =
    noteResult.rows
      .map((row) => {
        if (!isRecord(row.note_payload)) {
          return null;
        }

        return deepFreeze({
          ...row.note_payload,
          created_at:
            new Date(
              row.created_at
            ).toISOString()
        });
      })
      .filter(
        (
          note
        ): note is Readonly<JsonRecord> =>
          note !== null
      );

  const latestEventLinks = [];
  const seenEventLinkIds =
    new Set<string>();

  for (const link of eventLinkHistory) {
    const linkId = cleanString(
      link.event_athlete_link_id
    );

    if (!linkId || seenEventLinkIds.has(linkId)) {
      continue;
    }

    seenEventLinkIds.add(linkId);
    latestEventLinks.push(link);
  }

  const currentEventLink =
    currentAssignment
      ? latestEventLinks.find(
          (link) =>
            link.link_state === "linked" &&
            cleanString(link.assignment_id) ===
              cleanString(
                currentAssignment.assignment_id
              )
        ) ?? null
      : null;

  return deepFreeze({
    coach_user_id: coachUserId,
    athlete_user_id: athleteUserId,
    current_assignment:
      currentAssignment,
    current_event_link:
      currentEventLink,
    current_strength_profile:
      strengthProfileHistory[0] ??
      null,
    assignment_history:
      assignmentLifecycleHistory,
    strength_profile_history:
      strengthProfileHistory,
    bodyweight_history:
      bodyweightHistory,
    event_link_history:
      eventLinkHistory,
    session_history:
      sessionHistory,
    note_history:
      noteHistory,
    counts: deepFreeze({
      assignments:
        assignmentHistory.length,
      strength_profiles:
        strengthProfileHistory.length,
      bodyweight_records:
        bodyweightHistory.length,
      event_links:
        eventLinkHistory.length,
      sessions:
        sessionHistory.length,
      notes:
        noteHistory.length
    }),
    factual_records_only: true,
    read_only: true,
    calls_engine: false,
    engine_visible: false
  });
}
