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

function firstExerciseId() {
  const registry =
    JSON.parse(
      fs.readFileSync(
        "registries/exercise/exercise.registry.json",
        "utf8"
      )
    );

  const exerciseId =
    Object.keys(
      registry.entries ??
      {}
    )[0];

  assert.ok(
    exerciseId,
    "Exercise registry must contain at least one exercise."
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

    const initialTimestamp =
      "2026-07-01T09:00:00.000Z";

    const replacementTimestamp =
      "2026-07-15T09:00:00.000Z";

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
          }
        ],
        updated_at_iso8601:
          initialTimestamp
      });

    assert.equal(
      initialProfile
        .strength_reference_lifecycle
        .current[0]
        .reference_id,
      initialReferenceId
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
          }
        ],
        updated_at_iso8601:
          replacementTimestamp
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
      1
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

      console.log(
        JSON.stringify({
          profile,
          preflight,
          resolved
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

    await pool.end();
  }
);