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
  body,
  options = {}
) {
  const headers = {};

  if (body !== undefined) {
    headers["content-type"] =
      "application/json";
  }

  if (options.cookie) {
    headers.cookie =
      options.cookie;
  }

  if (options.csrf) {
    headers["x-kolosseum-csrf"] =
      options.csrf;
  }

  const response =
    await fetch(
      `${baseUrl}${route}`,
      {
        method,
        headers,
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

function sessionCookie(result, label) {
  const values =
    typeof result.response.headers.getSetCookie === "function"
      ? result.response.headers.getSetCookie()
      : [result.response.headers.get("set-cookie")].filter(Boolean);

  const session = values.find(
    (value) => String(value).startsWith("kolosseum_session=")
  );

  assert.ok(session, `${label}: expected session cookie`);

  return String(session).split(";")[0];
}

function dateOnlyFromNow(dayOffset) {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return date.toISOString().slice(0, 10);
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

    const programmeStartDate =
      dateOnlyFromNow(1);

    const eventDate =
      dateOnlyFromNow(15);

    const athleteUserId =
      `beta18_athlete_${nonce}`;

    const coachRegistration =
      await request(
        server.baseUrl,
        "POST",
        "/account/register",
        {
          actor_type: "coach",
          display_name: "Template Builder Coach",
          email: `beta18_coach_${nonce}@example.com`,
          password: "Beta18TemplateCoach!2026",
          accepted_terms: true,
          accepted_consent: true,
          accepted_terms_version: "terms_v1",
          accepted_consent_version: "consent_v1"
        }
      );

    assertStatus(
      coachRegistration,
      201,
      "coach account registration"
    );

    const coachUserId =
      coachRegistration.json?.account?.user_id ?? "";

    assert.ok(
      coachUserId,
      "Expected registered coach user_id"
    );

    const coachCookie =
      sessionCookie(
        coachRegistration,
        "coach account registration"
      );

    const coachCsrf =
      coachRegistration.json?.csrf_token;

    assert.ok(
      coachCsrf,
      "Expected coach csrf token"
    );

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

    const connectedAthletes =
      await request(
        server.baseUrl,
        "GET",
        "/coach-workspace/athletes",
        undefined,
        { cookie: coachCookie }
      );

    assertStatus(
      connectedAthletes,
      200,
      "persisted coach roster"
    );

    assert.ok(
      connectedAthletes.json
        ?.athletes
        ?.some(
          (athlete) =>
            athlete.athlete_user_id ===
              athleteUserId
        ),
      "Expected the connected athlete in the persisted coach roster"
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

    const athleteProfile =
      await request(
        server.baseUrl,
        "POST",
        "/coach-workspace/athlete-strength-profile",
        {
          coach_user_id:
            coachUserId,
          athlete_user_id:
            athleteUserId,
          preferred_weight_unit:
            "kg",
          load_rounding_increment:
            2.5,
          bodyweight:
            92.5,
          bodyweight_unit:
            "kg",
          benchmarks:
            exerciseIds.map(
              (
                exerciseId,
                index
              ) => ({
                benchmark_id: "",
                exercise_id:
                  exerciseId,
                value:
                  100 +
                  index * 10,
                unit: "kg",
                basis:
                  index % 2 === 0
                    ? "tested_1rm"
                    : "estimated_1rm",
                effective_date:
                  "2026-07-20",
                source_note:
                  "BETA-19 persistent proof"
              })
            ),
          expected_current_record_sha256:
            null
        },
        { cookie: coachCookie, csrf: coachCsrf }
      );

    assertStatus(
      athleteProfile,
      201,
      "athlete strength profile"
    );

    const storedAthleteProfile =
      await request(
        server.baseUrl,
        "GET",
        `/coach-workspace/athlete-strength-profile?athlete_user_id=${encodeURIComponent(athleteUserId)}`,
        undefined,
        { cookie: coachCookie }
      );

    assertStatus(
      storedAthleteProfile,
      200,
      "stored athlete strength profile"
    );

    assert.equal(
      storedAthleteProfile.json
        ?.profile
        ?.record_sha256,
      athleteProfile.json
        ?.profile
        ?.record_sha256
    );
    const staleAthleteProfile =
      await request(
        server.baseUrl,
        "POST",
        "/coach-workspace/athlete-strength-profile",
        {
          coach_user_id:
            coachUserId,
          athlete_user_id:
            athleteUserId,
          preferred_weight_unit:
            athleteProfile.json
              .profile
              .preferred_weight_unit,
          load_rounding_increment:
            athleteProfile.json
              .profile
              .load_rounding_increment,
          bodyweight:
            athleteProfile.json
              .profile
              .bodyweight,
          bodyweight_unit:
            athleteProfile.json
              .profile
              .bodyweight_unit,
          benchmarks:
            athleteProfile.json
              .profile
              .benchmarks,
          expected_current_record_sha256:
            null
        },
        { cookie: coachCookie, csrf: coachCsrf }
      );

    assertStatus(
      staleAthleteProfile,
      409,
      "stale athlete strength profile"
    );

    assert.equal(
      staleAthleteProfile.json
        ?.details
        ?.failure_token,
      "strength_reference_profile_stale_write"
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

    const unbalancedDraft =
      await request(
        server.baseUrl,
        "POST",
        "/templates",
        {
          coach_user_id:
            coachUserId,
          template_version: 1,
          template_name:
            "Under Allocated Event Programme",
          description:
            "Event allocation failure proof.",
          activity_id:
            "powerlifting",
          event_plan: {
            event_plan_id: "",
            event_name:
              "Under Allocated Meet",
            event_type:
              "powerlifting_meet",
            event_date:
              dateOnlyFromNow(29),
            programme_start_date:
              programmeStartDate,
            location: "",
            timezone:
              "Europe/London",
            notes: ""
          },
          blocks: [
            {
              block_id: "",
              order_index: 1,
              name:
                "One Week Block",
              description: "",
              block_type:
                "general",
              week_count: 1,
              weeks: [
                {
                  week_id: "",
                  order_index: 1,
                  sessions: [
                    {
                      session_id: "",
                      order_index: 1,
                      title:
                        "Under Allocated Session",
                      work_items:
                        percentageWorkItems(
                          exerciseIds.slice(0, 4),
                          70
                        )
                    }
                  ]
                }
              ]
            }
          ],
          updated_at_iso8601:
            new Date().toISOString()
        }
      );

    assertStatus(
      unbalancedDraft,
      201,
      "under allocated event draft"
    );

    assert.equal(
      unbalancedDraft.json
        ?.template
        ?.event_compile_summary
        ?.allocation_state,
      "under_allocated"
    );

    const unbalancedCompletion =
      await request(
        server.baseUrl,
        "POST",
        `/templates/${encodeURIComponent(unbalancedDraft.json?.template?.template_id)}/complete`,
        {
          coach_user_id:
            coachUserId
        }
      );

    assertStatus(
      unbalancedCompletion,
      400,
      "under allocated event completion"
    );

    assert.equal(
      unbalancedCompletion.json
        ?.reason ??
      unbalancedCompletion.json
        ?.details
        ?.reason,
      "event_week_allocation_unbalanced"
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
          event_plan: {
            event_plan_id: "",
            event_name:
              "BETA-19 Championship",
            event_type:
              "powerlifting_meet",
            event_date:
              eventDate,
            programme_start_date:
              programmeStartDate,
            location:
              "Mansfield",
            timezone:
              "Europe/London",
            notes:
              "Persistent event compiler proof."
          },
          blocks: [
            {
              block_id: "",
              order_index: 1,
              name: "Volume Block",
              description:
                "First ordered training block.",
              block_type: "volume",
              week_count: 1,
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
                    }
                  ]
                }
              ]
            },
            {
              block_id: "",
              order_index: 2,
              name: "Strength Block",
              description:
                "Second ordered training block.",
              block_type: "strength",
              week_count: 1,
              weeks: [
                {
                  week_id: "",
                  order_index: 1,
                  sessions: [
                    {
                      session_id: "",
                      order_index: 1,
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

    assert.equal(
      draft.json
        ?.template
        ?.block_count,
      2
    );

    assert.equal(
      draft.json
        ?.template
        ?.week_count,
      2
    );

    assert.equal(
      draft.json
        ?.template
        ?.event_compile_summary
        ?.allocation_state,
      "balanced"
    );

    assert.equal(
      draft.json
        ?.template
        ?.event_compile_summary
        ?.required_week_count,
      2
    );

    assert.equal(
      draft.json
        ?.template
        ?.template_structure
        ?.blocks
        ?.[0]
        ?.week_count,
      1
    );

    assert.deepEqual(
      draft.json
        ?.template
        ?.template_structure
        ?.blocks
        ?.map(
          (block) => ({
            name: block.name,
            type: block.block_type
          })
        ),
      [
        {
          name: "Volume Block",
          type: "volume"
        },
        {
          name: "Strength Block",
          type: "strength"
        }
      ]
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

    // programme_complete: a still-draft template cannot be activated
    // directly - the coach must mark it complete first. This is the
    // single most important guard assertion for the draft -> complete
    // -> active state machine.
    const prematureActivation =
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
      prematureActivation,
      400,
      "premature activation of a still-draft template"
    );

    assert.equal(
      prematureActivation.json
        ?.reason ??
      prematureActivation.json
        ?.details
        ?.reason,
      "only_complete_can_activate"
    );

    const completion =
      await request(
        server.baseUrl,
        "POST",
        `/templates/${
          encodeURIComponent(
            templateId
          )
        }/complete`,
        {
          coach_user_id:
            coachUserId
        }
      );

    assertStatus(
      completion,
      200,
      "template completion"
    );

    assert.equal(
      completion.json
        ?.template
        ?.template_status,
      "complete"
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

    const storedAssignments =
      await request(
        server.baseUrl,
        "GET",
        "/coach-workspace/assignments",
        undefined,
        { cookie: coachCookie }
      );

    assertStatus(
      storedAssignments,
      200,
      "persisted coach assignments"
    );

    assert.ok(
      storedAssignments.json
        ?.assignments
        ?.some(
          (storedAssignment) =>
            storedAssignment.assignment_id ===
              assignment.json
                ?.assignment
                ?.assignment_id
        ),
      "Expected the assignment in the persisted coach workspace"
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
      compiledExercises?.[0]
        ?.resolved_load,
      {
        type: "resolved_load",
        value: 80,
        unit: "kg",
        percentage: 80,
        one_rep_max: 100,
        one_rep_max_unit: "kg",
        calculation_one_rep_max: 100,
        calculation_one_rep_max_unit: "kg",
        benchmark_basis:
          "tested_1rm",
        benchmark_effective_date:
          "2026-07-20",
        benchmark_id:
          athleteProfile.json
            ?.profile
            ?.benchmarks
            ?.[0]
            ?.benchmark_id,
        athlete_profile_record_sha256:
          athleteProfile.json
            ?.profile
            ?.record_sha256,
        rounding_increment: 2.5,
        factual_source_only: true,
        readiness_inferred: false,
        safety_inferred: false,
        suitability_inferred: false,
        source: {
          reference_id:
            athleteProfile.json
              ?.profile
              ?.benchmarks
              ?.[0]
              ?.benchmark_id,
          exercise_id:
            exerciseIds[0],
          source_type:
            "tested_1rm",
          source_value:
            100,
          source_unit:
            "kg",
          effective_date:
            "2026-07-20",
          source_note:
            "BETA-19 persistent proof",
          replaces_reference_id:
            null
        }
      }
    );

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

    assert.equal(
      compileOne.json
        ?.beta_path
        ?.template_session_title,
      "Session One"
    );

    assert.equal(
      compileOne.json
        ?.beta_path
        ?.event_plan
        ?.event_name,
      "BETA-19 Championship"
    );

    assert.equal(
      compileOne.json
        ?.beta_path
        ?.event_plan
        ?.event_date,
      eventDate
    );

    assert.equal(
      compileOne.json
        ?.beta_path
        ?.event_compile_summary
        ?.required_week_count,
      2
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

    assert.equal(
      compileTwo.json
        ?.beta_path
        ?.template_session_title,
      "Session Two"
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
