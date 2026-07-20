// DEV NOTE: BETA-18 coach template builder persistent HTTP proof.
// The proof creates a coach-authored template, activates and assigns its exact
// version, then compiles its ordered sessions through the persisted beta path.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import test from "node:test";
import {
  spawn
} from "node:child_process";
import {
  fileURLToPath
} from "node:url";

function repoRoot() {
  return path.resolve(
    path.dirname(
      fileURLToPath(
        import.meta.url
      )
    ),
    ".."
  );
}

async function freePort() {
  return await new Promise(
    (
      resolve,
      reject
    ) => {
      const server =
        net.createServer();

      server.once(
        "error",
        reject
      );

      server.listen(
        0,
        "127.0.0.1",
        () => {
          const address =
            server.address();

          assert.ok(
            address &&
            typeof address ===
              "object"
          );

          const port =
            address.port;

          server.close(
            (error) =>
              error
                ? reject(error)
                : resolve(port)
          );
        }
      );
    }
  );
}

function delay(milliseconds) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        milliseconds
      )
  );
}

async function startServer(
  root,
  environment
) {
  const mainModule =
    path.join(
      root,
      "dist",
      "src",
      "main.js"
    );

  await fs.access(mainModule);

  const port =
    await freePort();

  const baseUrl =
    `http://127.0.0.1:${port}`;

  const child =
    spawn(
      process.execPath,
      [
        mainModule
      ],
      {
        cwd: root,
        env: {
          ...environment,
          PORT:
            String(port)
        },
        stdio: [
          "ignore",
          "pipe",
          "pipe"
        ]
      }
    );

  let stdout = "";
  let stderr = "";

  child.stdout.on(
    "data",
    (chunk) => {
      stdout +=
        chunk.toString(
          "utf8"
        );
    }
  );

  child.stderr.on(
    "data",
    (chunk) => {
      stderr +=
        chunk.toString(
          "utf8"
        );
    }
  );

  const deadline =
    Date.now() +
    15000;

  while (
    Date.now() <
    deadline
  ) {
    if (
      child.exitCode !==
        null
    ) {
      throw new Error(
        [
          "Server exited before health.",
          stdout,
          stderr
        ].join("\n")
      );
    }

    try {
      const response =
        await fetch(
          `${baseUrl}/health`
        );

      if (response.ok) {
        return {
          child,
          baseUrl
        };
      }
    }
    catch {
      // Retry until deadline.
    }

    await delay(100);
  }

  child.kill();

  throw new Error(
    [
      "Server health timeout.",
      stdout,
      stderr
    ].join("\n")
  );
}

async function stopServer(
  server
) {
  if (
    server.child.exitCode ===
      null
  ) {
    server.child.kill(
      process.platform ===
        "win32"
        ? undefined
        : "SIGTERM"
    );
  }

  await Promise.race([
    new Promise(
      (resolve) =>
        server.child.once(
          "exit",
          resolve
        )
    ),
    delay(3000)
  ]);

  if (
    server.child.exitCode ===
      null
  ) {
    server.child.kill(
      "SIGKILL"
    );
  }
}

async function request(
  baseUrl,
  method,
  route,
  body
) {
  const response =
    await fetch(
      `${baseUrl}${route}`,
      {
        method,
        headers:
          body === undefined
            ? undefined
            : {
                "content-type":
                  "application/json"
              },
        body:
          body === undefined
            ? undefined
            : JSON.stringify(
                body
              )
      }
    );

  const text =
    await response.text();

  let json = null;

  try {
    json =
      text
        ? JSON.parse(text)
        : null;
  }
  catch {
    // Assertion output retains raw text.
  }

  return {
    response,
    text,
    json
  };
}

function assertStatus(
  result,
  status,
  label
) {
  assert.equal(
    result.response.status,
    status,
    `${label}: ${result.text}`
  );

  assert.ok(
    result.json &&
    typeof result.json ===
      "object",
    `${label}: expected JSON`
  );
}

test(
  "BETA-18 coach template builder persists, assigns and compiles ordered sessions",
  async (
    testContext
  ) => {
    const root =
      repoRoot();

    const databaseUrl =
      process.env.DATABASE_URL;

    assert.ok(
      typeof databaseUrl ===
        "string" &&
      databaseUrl.length > 0,
      "DATABASE_URL is required"
    );

    const environment = {
      ...process.env,
      DATABASE_URL:
        databaseUrl
    };

    delete environment.SMOKE_NO_DB;

    const server =
      await startServer(
        root,
        environment
      );

    testContext.after(
      async () => {
        await stopServer(
          server
        );
      }
    );

    const nonce =
      crypto
        .randomUUID()
        .replaceAll("-", "");

    const coachUserId =
      `beta18_coach_${nonce}`;

    const athleteUserId =
      `beta18_athlete_${nonce}`;

    const phase1Input = {
      consent_granted: true,
      engine_version:
        "EB2-1.0.0",
      enum_bundle_version:
        "EB2-1.0.0",
      phase1_schema_version:
        "1.0.0",
      actor_type:
        "athlete",
      execution_scope:
        "individual",
      activity_id:
        "powerlifting",
      nd_mode: false,
      instruction_density:
        "standard",
      exposure_prompt_density:
        "standard",
      bias_mode:
        "none"
    };

    const coach =
      await request(
        server.baseUrl,
        "POST",
        "/sessions/beta-coach-profile",
        {
          coach_user_id:
            coachUserId,
          email:
            `${coachUserId}@example.com`,
          display_name:
            "Template Builder Coach",
          account_role:
            "coach",
          account_state:
            "active",
          accepted_terms_version:
            "terms_v1",
          created_at_iso8601:
            new Date()
              .toISOString()
        }
      );

    assertStatus(
      coach,
      201,
      "coach profile"
    );

    const auth =
      await request(
        server.baseUrl,
        "POST",
        "/sessions/beta-auth",
        {
          user_id:
            athleteUserId,
          email:
            `${athleteUserId}@example.com`,
          display_name:
            "Template Builder Athlete",
          account_role:
            "athlete",
          account_state:
            "active",
          accepted_terms_version:
            "terms_v1",
          created_at_iso8601:
            new Date()
              .toISOString()
        }
      );

    assertStatus(
      auth,
      201,
      "athlete auth"
    );

    const acknowledgement =
      await request(
        server.baseUrl,
        "POST",
        "/sessions/beta-acknowledgement",
        {
          acknowledgement_id:
            `beta18_ack_${nonce}`,
          user_id:
            athleteUserId,
          beta_id:
            "september_beta_2026",
          accepted: true,
          jurisdiction_acknowledged:
            true,
          accepted_at_iso8601:
            new Date()
              .toISOString(),
          copy_acknowledgement_id:
            "BETA16_COPY_ACKNOWLEDGEMENT_LABEL"
        }
      );

    assertStatus(
      acknowledgement,
      201,
      "acknowledgement"
    );

    const declaration =
      await request(
        server.baseUrl,
        "POST",
        "/sessions/beta-declaration",
        {
          declaration_id:
            `beta18_declaration_${nonce}`,
          user_id:
            athleteUserId,
          phase1_input:
            phase1Input,
          jurisdiction_acknowledged:
            true,
          declared_at_iso8601:
            new Date()
              .toISOString(),
          accepted_terms_version:
            "terms_v1",
          copy_acknowledgement_id:
            "BETA16_COPY_DECLARATION_ACKNOWLEDGEMENT"
        }
      );

    assertStatus(
      declaration,
      201,
      "declaration"
    );

    const timestamp =
      new Date()
        .toISOString();

    const relationship =
      await request(
        server.baseUrl,
        "POST",
        "/sessions/beta-coach-relationship",
        {
          relationship_id:
            `beta18_relationship_${nonce}`,
          coach_user_id:
            coachUserId,
          athlete_user_id:
            athleteUserId,
          relationship_state:
            "accepted",
          relationship_scope:
            "individual_coach_athlete",
          accepted_at_iso8601:
            timestamp,
          created_at_iso8601:
            timestamp,
          updated_at_iso8601:
            timestamp,
          revoked_at_iso8601:
            null,
          expires_at_iso8601:
            null
        }
      );

    assertStatus(
      relationship,
      201,
      "relationship"
    );

    const exerciseResponse =
      await request(
        server.baseUrl,
        "GET",
        "/templates/exercises"
      );

    assertStatus(
      exerciseResponse,
      200,
      "exercise options"
    );

    const exercises =
      exerciseResponse
        .json
        ?.exercises;

    assert.ok(
      Array.isArray(
        exercises
      ) &&
      exercises.length >= 8,
      "Expected at least eight active exercise options"
    );

    const exerciseIds =
      exercises
        .slice(0, 8)
        .map(
          (exercise) =>
            exercise.exercise_id
        );

    const percentageWorkItems =
      (
        selectedIds,
        basePercent
      ) =>
        selectedIds.map(
          (
            exerciseId,
            index
          ) => ({
            work_item_id: "",
            order_index:
              index + 1,
            exercise_id:
              exerciseId,
            planned_sets:
              index === 0
                ? 4
                : 3,
            rep_mode:
              "fixed",
            planned_reps:
              index === 0
                ? 5
                : 8,
            rep_min:
              index === 0
                ? 4
                : 8,
            rep_max:
              index === 0
                ? 6
                : 12,
            load_mode:
              "percent_1rm",
            percent_1rm:
              basePercent -
              index * 5,
            weight_value:
              20,
            weight_unit:
              "kg",
            rest_seconds:
              index === 0
                ? 180
                : 120,
            role:
              index === 0
                ? "primary"
                : "accessory"
          })
        );

    const mixedPrescriptionWorkItems =
      (
        selectedIds
      ) => [
        {
          ...percentageWorkItems(
            selectedIds,
            80
          )[0],
          rep_mode:
            "fixed",
          planned_reps: 5,
          load_mode:
            "percent_1rm",
          percent_1rm: 80
        },
        {
          ...percentageWorkItems(
            selectedIds,
            80
          )[1],
          rep_mode:
            "range",
          rep_min: 6,
          rep_max: 8,
          load_mode:
            "fixed_weight",
          weight_value: 100,
          weight_unit: "kg"
        },
        {
          ...percentageWorkItems(
            selectedIds,
            80
          )[2],
          rep_mode:
            "range",
          rep_min: 8,
          rep_max: 12,
          load_mode:
            "bodyweight"
        },
        {
          ...percentageWorkItems(
            selectedIds,
            80
          )[3],
          rep_mode:
            "fixed",
          planned_reps: 3,
          load_mode:
            "fixed_weight",
          weight_value: 225,
          weight_unit: "lb"
        }
      ];

    const invalidRangeItems =
      mixedPrescriptionWorkItems(
        exerciseIds.slice(
          0,
          4
        )
      );

    invalidRangeItems[1] = {
      ...invalidRangeItems[1],
      rep_min: 10,
      rep_max: 6
    };

    const invalidRange =
      await request(
        server.baseUrl,
        "POST",
        "/templates",
        {
          coach_user_id:
            coachUserId,
          template_version: 1,
          template_name:
            "Invalid Rep Range Template",
          description:
            "Negative range validation proof.",
          activity_id:
            "powerlifting",
          weeks: [
            {
              week_id: "",
              order_index: 1,
              sessions: [
                {
                  session_id: "",
                  order_index: 1,
                  title:
                    "Invalid Range",
                  work_items:
                    invalidRangeItems
                }
              ]
            }
          ],
          updated_at_iso8601:
            new Date()
              .toISOString()
        }
      );

    assertStatus(
      invalidRange,
      400,
      "invalid rep range"
    );

    assert.equal(
      invalidRange.json
        ?.reason ??
      invalidRange.json
        ?.details
        ?.reason,
      "rep_range_order_invalid"
    );

    const invalidWeightItems =
      mixedPrescriptionWorkItems(
        exerciseIds.slice(
          0,
          4
        )
      );

    invalidWeightItems[1] = {
      ...invalidWeightItems[1],
      weight_value: 0
    };

    const invalidWeight =
      await request(
        server.baseUrl,
        "POST",
        "/templates",
        {
          coach_user_id:
            coachUserId,
          template_version: 1,
          template_name:
            "Invalid Weight Template",
          description:
            "Negative weight validation proof.",
          activity_id:
            "powerlifting",
          weeks: [
            {
              week_id: "",
              order_index: 1,
              sessions: [
                {
                  session_id: "",
                  order_index: 1,
                  title:
                    "Invalid Weight",
                  work_items:
                    invalidWeightItems
                }
              ]
            }
          ],
          updated_at_iso8601:
            new Date()
              .toISOString()
        }
      );

    assertStatus(
      invalidWeight,
      400,
      "invalid fixed weight"
    );

    assert.equal(
      invalidWeight.json
        ?.reason ??
      invalidWeight.json
        ?.details
        ?.reason,
      "weight_value_invalid"
    );

    const draft =
      await request(
        server.baseUrl,
        "POST",
        "/templates",
        {
          coach_user_id:
            coachUserId,
          template_version: 1,
          template_name:
            "Two Session Strength Template",
          description:
            "Persistent BETA-18 integration template.",
          activity_id:
            "powerlifting",
          weeks: [
            {
              week_id: "",
              order_index: 1,
              sessions: [
                {
                  session_id: "",
                  order_index: 1,
                  title:
                    "Session One",
                  work_items:
                    mixedPrescriptionWorkItems(
                      exerciseIds.slice(
                        0,
                        4
                      )
                    )
                },
                {
                  session_id: "",
                  order_index: 2,
                  title:
                    "Session Two",
                  work_items:
                    percentageWorkItems(
                      exerciseIds.slice(
                        4,
                        8
                      ),
                      75
                    )
                }
              ]
            }
          ],
          updated_at_iso8601:
            new Date()
              .toISOString()
        }
      );

    assertStatus(
      draft,
      201,
      "template draft"
    );

    assert.equal(
      draft.json
        ?.template
        ?.template_status,
      "draft"
    );

    const templateId =
      draft.json
        ?.template
        ?.template_id;

    assert.equal(
      typeof templateId,
      "string"
    );

    const storedWorkItems =
      draft.json
        ?.template
        ?.template_structure
        ?.blocks
        ?.[0]
        ?.weeks
        ?.[0]
        ?.days
        ?.[0]
        ?.sessions
        ?.[0]
        ?.work_items;

    assert.deepEqual(
      storedWorkItems?.[1]
        ?.rep_prescription,
      {
        type: "range",
        minimum: 6,
        maximum: 8
      }
    );

    assert.deepEqual(
      storedWorkItems?.[1]
        ?.loading_reference,
      {
        type: "load",
        value: 100,
        unit: "kg"
      }
    );

    assert.deepEqual(
      storedWorkItems?.[2]
        ?.loading_reference,
      {
        type: "bodyweight"
      }
    );

    assert.deepEqual(
      storedWorkItems?.[3]
        ?.loading_reference,
      {
        type: "load",
        value: 225,
        unit: "lb"
      }
    );

    const activation =
      await request(
        server.baseUrl,
        "POST",
        `/templates/${
          encodeURIComponent(
            templateId
          )
        }/activate`,
        {
          coach_user_id:
            coachUserId
        }
      );

    assertStatus(
      activation,
      200,
      "template activation"
    );

    assert.equal(
      activation.json
        ?.template
        ?.template_status,
      "active"
    );

    const assignment =
      await request(
        server.baseUrl,
        "POST",
        "/sessions/beta-coach-assignment",
        {
          request_id:
            `beta18_assignment_request_${nonce}`,
          requested_at_iso8601:
            new Date()
              .toISOString(),
          coach_user_id:
            coachUserId,
          athlete_user_id:
            athleteUserId,
          template_id:
            templateId,
          activity_id:
            "powerlifting"
        }
      );

    assertStatus(
      assignment,
      201,
      "template assignment"
    );

    const compileOne =
      await request(
        server.baseUrl,
        "POST",
        "/blocks/compile?create_session=true&beta_path=true",
        {
          phase1_input:
            phase1Input,
          beta_user_id:
            athleteUserId,
          beta_coach_user_id:
            coachUserId
        }
      );

    assertStatus(
      compileOne,
      201,
      "first template compile"
    );

    assert.deepEqual(
      compileOne.json
        ?.planned_session
        ?.exercises
        ?.map(
          (exercise) =>
            exercise.exercise_id
        ),
      exerciseIds.slice(
        0,
        4
      )
    );

    const compiledExercises =
      compileOne.json
        ?.planned_session
        ?.exercises;

    assert.deepEqual(
      compiledExercises?.[1]
        ?.rep_range,
      {
        minimum: 6,
        maximum: 8
      }
    );

    assert.equal(
      compiledExercises?.[1]
        ?.reps,
      6,
      "Range prescriptions retain the minimum as the legacy deterministic reps fallback"
    );

    assert.deepEqual(
      compiledExercises?.[1]
        ?.intensity,
      {
        type: "load",
        value: 100,
        unit: "kg"
      }
    );

    assert.deepEqual(
      compiledExercises?.[2]
        ?.rep_range,
      {
        minimum: 8,
        maximum: 12
      }
    );

    assert.deepEqual(
      compiledExercises?.[2]
        ?.intensity,
      {
        type: "bodyweight"
      }
    );

    assert.deepEqual(
      compiledExercises?.[3]
        ?.intensity,
      {
        type: "load",
        value: 225,
        unit: "lb"
      }
    );

    assert.equal(
      compileOne.json
        ?.beta_path
        ?.template_id,
      templateId
    );

    const compileTwo =
      await request(
        server.baseUrl,
        "POST",
        "/blocks/compile?create_session=true&beta_path=true",
        {
          phase1_input:
            phase1Input,
          beta_user_id:
            athleteUserId,
          beta_coach_user_id:
            coachUserId
        }
      );

    assertStatus(
      compileTwo,
      201,
      "second template compile"
    );

    assert.deepEqual(
      compileTwo.json
        ?.planned_session
        ?.exercises
        ?.map(
          (exercise) =>
            exercise.exercise_id
        ),
      exerciseIds.slice(
        4,
        8
      )
    );

    assert.notEqual(
      compileOne.json
        ?.canonical_hash,
      compileTwo.json
        ?.canonical_hash,
      "Each ordered template session must have a distinct canonical hash"
    );

    const exhausted =
      await request(
        server.baseUrl,
        "POST",
        "/blocks/compile?create_session=true&beta_path=true",
        {
          phase1_input:
            phase1Input,
          beta_user_id:
            athleteUserId,
          beta_coach_user_id:
            coachUserId
        }
      );

    assertStatus(
      exhausted,
      400,
      "exhausted template compile"
    );

    assert.equal(
      exhausted.json
        ?.details
        ?.reason ??
      exhausted.json
        ?.reason,
      "assigned_template_sessions_exhausted"
    );
  }
);
