import assert from "node:assert/strict";
import {
  createHash,
  randomUUID
} from "node:crypto";
import fs from "node:fs";
import {
  spawnSync
} from "node:child_process";
import test from "node:test";

import {
  pool
} from "../dist/src/db/pool.js";

import {
  persistBetaProductRecord
} from "../dist/src/api/beta_product_record_store.js";

import {
  loadAthleteStrengthProfile,
  loadPersistedProgrammeStrengthPreflight,
  reconstructResolvedStrengthLoadSource,
  saveAthleteStrengthProfile
} from "../dist/src/api/beta19_coach_workspace_service.js";

function sha256(value) {
  return createHash("sha256")
    .update(
      JSON.stringify(value),
      "utf8"
    )
    .digest("hex");
}

function recordWithHash(
  record
) {
  return {
    ...record,
    record_sha256:
      sha256(record)
  };
}

function exerciseRegistryIds() {
  const registry =
    JSON.parse(
      fs.readFileSync(
        "registries/exercise/exercise.registry.json",
        "utf8"
      )
    );

  return Object.keys(
    registry.entries ??
    {}
  );
}

function firstExerciseId() {
  const exerciseId =
    exerciseRegistryIds()[0];

  assert.ok(
    exerciseId,
    "Exercise registry must contain at least one exercise."
  );

  return exerciseId;
}

function secondExerciseId() {
  const exerciseId =
    exerciseRegistryIds()[1];

  assert.ok(
    exerciseId,
    "Exercise registry must contain at least two exercises."
  );

  return exerciseId;
}

test(
  "FULL-UI-08C persists immutable strength lifecycle and reconstructs source after restart",
  async () => {
    const suffix =
      randomUUID()
        .replaceAll("-", "")
        .slice(0, 16);

    const coachUserId =
      `coach_full_ui_08c_${suffix}`;

    const athleteUserId =
      `athlete_full_ui_08c_${suffix}`;

    const relationshipId =
      `relationship_full_ui_08c_${suffix}`;

    const templateId =
      `template_full_ui_08c_${suffix}`;

    const initialReferenceId =
      `reference_initial_${suffix}`;

    const replacementReferenceId =
      `reference_replacement_${suffix}`;

    const exerciseId =
      firstExerciseId();

    const missingExerciseId =
      `${exerciseId}_missing_reference`;

    const trainingMaxExerciseId =
      secondExerciseId();

    const trainingMaxReferenceId =
      `reference_training_max_${suffix}`;

    const initialTimestamp =
      "2026-07-01T09:00:00.000Z";


    await persistBetaProductRecord(
      recordWithHash({
        record_type:
          "beta17_coach_profile",
        coach_user_id:
          coachUserId,
        coach_profile_id:
          `profile_${suffix}`,
        display_name:
          "FULL-UI-08C Coach",
        account_role:
          "coach",
        account_state:
          "active",
        created_at_iso8601:
          initialTimestamp
      })
    );

    await persistBetaProductRecord(
      recordWithHash({
        record_type:
          "beta17_coach_relationship",
        relationship_id:
          relationshipId,
        coach_user_id:
          coachUserId,
        athlete_user_id:
          athleteUserId,
        relationship_state:
          "accepted",
        updated_at_iso8601:
          initialTimestamp
      })
    );

    await persistBetaProductRecord(
      recordWithHash({
        record_type:
          "beta18_programme_template",
        template_id:
          templateId,
        version_family_id:
          `family_${suffix}`,
        template_version:
          1,
        template_name:
          "FULL-UI-08C Programme",
        template_state:
          "active",
        activity_id:
          "general_strength",
        coach_user_id:
          coachUserId,
        template_structure: {
          blocks: [
            {
              weeks: [
                {
                  days: [
                    {
                      sessions: [
                        {
                          work_items: [
                            {
                              exercise_id:
                                exerciseId,
                              loading_reference: {
                                type:
                                  "percent_1rm",
                                value:
                                  80
                              }
                            },
                            {
                              exercise_id:
                                missingExerciseId,
                              loading_reference: {
                                type:
                                  "percent_1rm",
                                value:
                                  75
                              }
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        },
        updated_at_iso8601:
          initialTimestamp
      })
    );

    const initialProfile =
      await saveAthleteStrengthProfile({
        coach_user_id:
          coachUserId,
        athlete_user_id:
          athleteUserId,
        preferred_weight_unit:
          "lb",
        load_rounding_increment:
          5,
        bodyweight:
          null,
        bodyweight_unit:
          "kg",
        benchmarks: [
          {
            benchmark_id:
              initialReferenceId,
            exercise_id:
              exerciseId,
            value:
              100,
            unit:
              "kg",
            basis:
              "tested_1rm",
            effective_date:
              "2026-07-01",
            source_note:
              "Competition result",
            replaces_reference_id:
              null
          },
          {
            benchmark_id:
              trainingMaxReferenceId,
            exercise_id:
              trainingMaxExerciseId,
            value:
              140,
            unit:
              "kg",
            basis:
              "training_max",
            effective_date:
              "2026-07-01",
            source_note:
              "Block-set training max",
            replaces_reference_id:
              null
          }
        ],
        expected_current_record_sha256:
          null
      });

    assert.equal(
      initialProfile
        .strength_reference_lifecycle
        .current[0]
        .reference_id,
      initialReferenceId
    );

    const initialTrainingMax =
      initialProfile
        .strength_reference_lifecycle
        .current
        .find(
          (record) =>
            record.exercise_id ===
            trainingMaxExerciseId
        );

    assert.equal(
      initialTrainingMax.reference_id,
      trainingMaxReferenceId
    );

    assert.equal(
      initialTrainingMax.source_type,
      "training_max"
    );

    assert.equal(
      initialTrainingMax.source_value,
      140
    );

    const replacementProfile =
      await saveAthleteStrengthProfile({
        coach_user_id:
          coachUserId,
        athlete_user_id:
          athleteUserId,
        preferred_weight_unit:
          "lb",
        load_rounding_increment:
          5,
        bodyweight:
          null,
        bodyweight_unit:
          "kg",
        benchmarks: [
          {
            benchmark_id:
              initialReferenceId,
            exercise_id:
              exerciseId,
            value:
              100,
            unit:
              "kg",
            basis:
              "tested_1rm",
            effective_date:
              "2026-07-01",
            source_note:
              "Competition result",
            replaces_reference_id:
              null
          },
          {
            benchmark_id:
              replacementReferenceId,
            exercise_id:
              exerciseId,
            value:
              105,
            unit:
              "kg",
            basis:
              "estimated_1rm",
            effective_date:
              "2026-07-15",
            source_note:
              "Repetition calculation",
            replaces_reference_id:
              initialReferenceId
          },
          {
            benchmark_id:
              trainingMaxReferenceId,
            exercise_id:
              trainingMaxExerciseId,
            value:
              140,
            unit:
              "kg",
            basis:
              "training_max",
            effective_date:
              "2026-07-01",
            source_note:
              "Block-set training max",
            replaces_reference_id:
              null
          }
        ],
        expected_current_record_sha256:
          initialProfile.record_sha256
      });

    const current =
      replacementProfile
        .strength_reference_lifecycle
        .current[0];

    const superseded =
      replacementProfile
        .strength_reference_lifecycle
        .superseded[0];

    assert.equal(
      current.reference_id,
      replacementReferenceId
    );

    assert.equal(
      current.source_type,
      "estimated_1rm"
    );

    assert.equal(
      superseded.reference_id,
      initialReferenceId
    );

    assert.equal(
      superseded.source_type,
      "tested_1rm"
    );

    const replacementTrainingMax =
      replacementProfile
        .strength_reference_lifecycle
        .current
        .find(
          (record) =>
            record.exercise_id ===
            trainingMaxExerciseId
        );

    assert.equal(
      replacementTrainingMax.reference_id,
      trainingMaxReferenceId
    );

    assert.equal(
      replacementTrainingMax.source_type,
      "training_max"
    );

    assert.equal(
      replacementTrainingMax.source_value,
      140
    );

    const rows =
      await pool.query(
        `
        SELECT record_payload
        FROM beta_product_records
        WHERE
          record_type =
            'beta19_athlete_strength_profile'
          AND actor_user_id = $1
          AND subject_user_id = $2
        ORDER BY
          effective_at ASC,
          created_at ASC,
          record_sha256 ASC
        `,
        [
          coachUserId,
          athleteUserId
        ]
      );

    assert.equal(
      rows.rowCount,
      2
    );

    assert.equal(
      rows.rows[0]
        .record_payload
        .benchmarks[0]
        .value,
      100
    );

    assert.equal(
      rows.rows[0]
        .record_payload
        .benchmarks.length,
      2
    );

    const preflightBeforeRestart =
      await loadPersistedProgrammeStrengthPreflight(
        coachUserId,
        athleteUserId,
        templateId,
        "2026-07-20"
      );

    assert.deepEqual(
      preflightBeforeRestart.missing,
      [
        missingExerciseId
      ]
    );

    assert.equal(
      preflightBeforeRestart
        .effective_sources[0]
        .reference_id,
      replacementReferenceId
    );

    const resolvedBeforeRestart =
      await reconstructResolvedStrengthLoadSource(
        coachUserId,
        athleteUserId,
        exerciseId,
        80,
        {
          target_unit:
            "lb",
          rounding_increment:
            5,
          as_of_date:
            "2026-07-20"
        }
      );

    assert.equal(
      resolvedBeforeRestart
        .source
        .reference_id,
      replacementReferenceId
    );

    assert.equal(
      resolvedBeforeRestart
        .source
        .source_type,
      "estimated_1rm"
    );

    const resolvedTrainingMaxBeforeRestart =
      await reconstructResolvedStrengthLoadSource(
        coachUserId,
        athleteUserId,
        trainingMaxExerciseId,
        80,
        {
          target_unit:
            "kg",
          rounding_increment:
            2.5,
          as_of_date:
            "2026-07-20"
        }
      );

    assert.equal(
      resolvedTrainingMaxBeforeRestart
        .source
        .reference_id,
      trainingMaxReferenceId
    );

    assert.equal(
      resolvedTrainingMaxBeforeRestart
        .source
        .source_type,
      "training_max"
    );

    assert.equal(
      resolvedTrainingMaxBeforeRestart
        .value,
      112.5
    );

    const childScript = `
      import {
        loadAthleteStrengthProfile,
        loadPersistedProgrammeStrengthPreflight,
        reconstructResolvedStrengthLoadSource
      } from "./dist/src/api/beta19_coach_workspace_service.js";

      import {
        pool
      } from "./dist/src/db/pool.js";

      const profile =
        await loadAthleteStrengthProfile(
          ${JSON.stringify(coachUserId)},
          ${JSON.stringify(athleteUserId)}
        );

      const preflight =
        await loadPersistedProgrammeStrengthPreflight(
          ${JSON.stringify(coachUserId)},
          ${JSON.stringify(athleteUserId)},
          ${JSON.stringify(templateId)},
          "2026-07-20"
        );

      const resolved =
        await reconstructResolvedStrengthLoadSource(
          ${JSON.stringify(coachUserId)},
          ${JSON.stringify(athleteUserId)},
          ${JSON.stringify(exerciseId)},
          80,
          {
            target_unit: "lb",
            rounding_increment: 5,
            as_of_date: "2026-07-20"
          }
        );

      const resolvedTrainingMax =
        await reconstructResolvedStrengthLoadSource(
          ${JSON.stringify(coachUserId)},
          ${JSON.stringify(athleteUserId)},
          ${JSON.stringify(trainingMaxExerciseId)},
          80,
          {
            target_unit: "kg",
            rounding_increment: 2.5,
            as_of_date: "2026-07-20"
          }
        );

      console.log(
        JSON.stringify({
          profile,
          preflight,
          resolved,
          resolvedTrainingMax
        })
      );

      await pool.end();
    `;

    const child =
      spawnSync(
        process.execPath,
        [
          "--input-type=module",
          "--eval",
          childScript
        ],
        {
          cwd:
            process.cwd(),
          env:
            process.env,
          encoding:
            "utf8"
        }
      );

    assert.equal(
      child.status,
      0,
      child.stderr ||
      child.stdout
    );

    const outputLine =
      child.stdout
        .trim()
        .split(/\r?\n/u)
        .filter(Boolean)
        .at(-1);

    const afterRestart =
      JSON.parse(
        outputLine
      );

    const coachSource =
      afterRestart
        .profile
        .strength_reference_lifecycle
        .current[0];

    const athleteSource =
      afterRestart
        .resolved
        .source;

    assert.equal(
      coachSource.reference_id,
      replacementReferenceId
    );

    assert.equal(
      athleteSource.reference_id,
      replacementReferenceId
    );

    assert.equal(
      coachSource.source_type,
      "estimated_1rm"
    );

    assert.equal(
      athleteSource.source_type,
      "estimated_1rm"
    );

    const trainingMaxProfileAfterRestart =
      afterRestart
        .profile
        .strength_reference_lifecycle
        .current
        .find(
          (record) =>
            record.exercise_id ===
            trainingMaxExerciseId
        );

    assert.equal(
      trainingMaxProfileAfterRestart.reference_id,
      trainingMaxReferenceId
    );

    assert.equal(
      trainingMaxProfileAfterRestart.source_type,
      "training_max"
    );

    const trainingMaxSourceAfterRestart =
      afterRestart
        .resolvedTrainingMax
        .source;

    assert.equal(
      trainingMaxSourceAfterRestart.reference_id,
      trainingMaxReferenceId
    );

    assert.equal(
      trainingMaxSourceAfterRestart.source_type,
      "training_max"
    );

    assert.equal(
      afterRestart
        .resolvedTrainingMax
        .value,
      112.5
    );

    assert.deepEqual(
      afterRestart
        .preflight
        .missing,
      [
        missingExerciseId
      ]
    );

    assert.equal(
      afterRestart
        .profile
        .strength_reference_lifecycle
        .superseded[0]
        .reference_id,
      initialReferenceId
    );

    const concurrentSuffix =
      randomUUID()
        .replaceAll("-", "")
        .slice(0, 16);

    const concurrentCoachUserId =
      `coach_full_ui_08c_concurrent_${concurrentSuffix}`;

    const concurrentAthleteUserId =
      `athlete_full_ui_08c_concurrent_${concurrentSuffix}`;

    const concurrentInitialReferenceId =
      `reference_concurrent_initial_${concurrentSuffix}`;

    const concurrentReplacementAId =
      `reference_concurrent_a_${concurrentSuffix}`;

    const concurrentReplacementBId =
      `reference_concurrent_b_${concurrentSuffix}`;

    const concurrentSetupTimestamp =
      new Date()
        .toISOString();

    await persistBetaProductRecord(
      recordWithHash({
        record_type:
          "beta17_coach_profile",
        coach_user_id:
          concurrentCoachUserId,
        coach_profile_id:
          `profile_concurrent_${concurrentSuffix}`,
        display_name:
          "FULL-UI-08C Concurrent Coach",
        account_role:
          "coach",
        account_state:
          "active",
        created_at_iso8601:
          concurrentSetupTimestamp
      })
    );

    await persistBetaProductRecord(
      recordWithHash({
        record_type:
          "beta17_coach_relationship",
        relationship_id:
          `relationship_concurrent_${concurrentSuffix}`,
        coach_user_id:
          concurrentCoachUserId,
        athlete_user_id:
          concurrentAthleteUserId,
        relationship_state:
          "accepted",
        updated_at_iso8601:
          concurrentSetupTimestamp
      })
    );

    const concurrentBaseBenchmark = {
      benchmark_id:
        concurrentInitialReferenceId,
      exercise_id:
        exerciseId,
      value:
        120,
      unit:
        "kg",
      basis:
        "tested_1rm",
      effective_date:
        "2026-07-01",
      source_note:
        "Concurrent-write base",
      replaces_reference_id:
        null
    };

    const serverTimeBefore =
      Date.now();

    const concurrentInitialProfile =
      await saveAthleteStrengthProfile({
        coach_user_id:
          concurrentCoachUserId,
        athlete_user_id:
          concurrentAthleteUserId,
        preferred_weight_unit:
          "kg",
        load_rounding_increment:
          2.5,
        bodyweight:
          null,
        bodyweight_unit:
          "kg",
        benchmarks: [
          concurrentBaseBenchmark
        ],
        expected_current_record_sha256:
          null
      });

    const serverTimeAfter =
      Date.now();

    const concurrentInitialTime =
      Date.parse(
        concurrentInitialProfile
          .updated_at_iso8601
      );

    assert.ok(
      concurrentInitialTime >=
        serverTimeBefore - 1000 &&
      concurrentInitialTime <=
        serverTimeAfter + 1000,
      "Profile ordering time must come from the database transaction."
    );

    assert.equal(
      concurrentInitialProfile
        .ordering_time_authority,
      "postgres_server_clock"
    );

    assert.equal(
      concurrentInitialProfile
        .profile_version,
      1
    );

    assert.equal(
      concurrentInitialProfile
        .previous_profile_record_sha256,
      null
    );

    const replacementInput =
      (
        benchmarkId,
        value
      ) => ({
        coach_user_id:
          concurrentCoachUserId,
        athlete_user_id:
          concurrentAthleteUserId,
        preferred_weight_unit:
          "kg",
        load_rounding_increment:
          2.5,
        bodyweight:
          null,
        bodyweight_unit:
          "kg",
        benchmarks: [
          concurrentBaseBenchmark,
          {
            benchmark_id:
              benchmarkId,
            exercise_id:
              exerciseId,
            value,
            unit:
              "kg",
            basis:
              "estimated_1rm",
            effective_date:
              "2026-07-20",
            source_note:
              "Concurrent replacement",
            replaces_reference_id:
              concurrentInitialReferenceId
          }
        ],
        expected_current_record_sha256:
          concurrentInitialProfile
            .record_sha256
      });

    const concurrentOutcomes =
      await Promise.allSettled([
        saveAthleteStrengthProfile(
          replacementInput(
            concurrentReplacementAId,
            125
          )
        ),
        saveAthleteStrengthProfile(
          replacementInput(
            concurrentReplacementBId,
            127.5
          )
        )
      ]);

    const acceptedWrites =
      concurrentOutcomes.filter(
        (outcome) =>
          outcome.status ===
            "fulfilled"
      );

    const rejectedWrites =
      concurrentOutcomes.filter(
        (outcome) =>
          outcome.status ===
            "rejected"
      );

    assert.equal(
      acceptedWrites.length,
      1,
      "Exactly one concurrent replacement may succeed."
    );

    assert.equal(
      rejectedWrites.length,
      1,
      "The competing replacement must be rejected."
    );

    assert.equal(
      rejectedWrites[0]
        .reason
        ?.reason,
      "strength_reference_profile_stale_write"
    );

    const acceptedProfile =
      acceptedWrites[0]
        .value;

    const acceptedReferenceId =
      acceptedProfile
        .benchmarks
        .at(-1)
        .benchmark_id;

    assert.ok(
      [
        concurrentReplacementAId,
        concurrentReplacementBId
      ].includes(
        acceptedReferenceId
      )
    );

    const concurrentCurrent =
      await loadAthleteStrengthProfile(
        concurrentCoachUserId,
        concurrentAthleteUserId
      );

    assert.equal(
      concurrentCurrent
        .record_sha256,
      acceptedProfile
        .record_sha256
    );

    assert.equal(
      concurrentCurrent
        .profile_version,
      2
    );

    assert.equal(
      concurrentCurrent
        .previous_profile_record_sha256,
      concurrentInitialProfile
        .record_sha256
    );

    assert.deepEqual(
      concurrentCurrent
        .benchmarks
        .map(
          (benchmark) =>
            benchmark.benchmark_id
        ),
      [
        concurrentInitialReferenceId,
        acceptedReferenceId
      ]
    );

    assert.equal(
      concurrentCurrent
        .strength_reference_lifecycle
        .current[0]
        .reference_id,
      acceptedReferenceId
    );

    assert.equal(
      concurrentCurrent
        .strength_reference_lifecycle
        .superseded[0]
        .reference_id,
      concurrentInitialReferenceId
    );

    const concurrentRows =
      await pool.query(
        `
        SELECT record_payload
        FROM beta_product_records
        WHERE
          record_type =
            'beta19_athlete_strength_profile'
          AND actor_user_id = $1
          AND subject_user_id = $2
        ORDER BY
          COALESCE(
            NULLIF(
              record_payload ->> 'profile_version',
              ''
            )::integer,
            1
          ) ASC
        `,
        [
          concurrentCoachUserId,
          concurrentAthleteUserId
        ]
      );

    assert.equal(
      concurrentRows.rowCount,
      2,
      "Only the initial record and one replacement may persist."
    );

    const concurrentProfiles =
      concurrentRows.rows.map(
        (row) =>
          row.record_payload
      );

    assert.deepEqual(
      concurrentProfiles.map(
        (profile) =>
          profile.profile_version
      ),
      [
        1,
        2
      ]
    );

    assert.equal(
      concurrentProfiles[1]
        .previous_profile_record_sha256,
      concurrentProfiles[0]
        .record_sha256
    );

    assert.deepEqual(
      concurrentProfiles[1]
        .benchmarks
        .slice(
          0,
          concurrentProfiles[0]
            .benchmarks
            .length
        ),
      concurrentProfiles[0]
        .benchmarks,
      "Every accepted predecessor must remain in the linear lifecycle."
    );
    await pool.end();
  }
);