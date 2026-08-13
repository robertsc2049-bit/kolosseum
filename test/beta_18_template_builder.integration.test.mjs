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
                : "accessory",
            coaching_notes:
              "",
            segment:
              "working",
            group_id:
              "",
            group_type:
              "straight"
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
                  coaching_notes:
                    "",
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
                  coaching_notes:
                    "",
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
                      coaching_notes:
                        "",
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
                      coaching_notes:
                        "",
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
                      coaching_notes:
                        "",
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

test(
  "BETA-18 template builder supports flexible session composition: variable exercise count, supersets, segments and coaching notes",
  async (testContext) => {
    const root = repoRoot();
    const databaseUrl = process.env.DATABASE_URL;
    assert.ok(
      typeof databaseUrl === "string" && databaseUrl.length > 0,
      "DATABASE_URL is required"
    );

    const environment = { ...process.env, DATABASE_URL: databaseUrl };
    delete environment.SMOKE_NO_DB;

    const server = await startServer(root, environment);
    testContext.after(async () => {
      await stopServer(server);
    });

    const nonce = crypto.randomUUID().replaceAll("-", "");

    const coachRegistration = await request(
      server.baseUrl,
      "POST",
      "/account/register",
      {
        actor_type: "coach",
        display_name: "Composition Coach",
        email: `beta18_composition_coach_${nonce}@example.com`,
        password: "Beta18CompositionCoach!2026",
        accepted_terms: true,
        accepted_consent: true,
        accepted_terms_version: "terms_v1",
        accepted_consent_version: "consent_v1"
      }
    );
    assertStatus(coachRegistration, 201, "coach account registration");
    const coachUserId = coachRegistration.json?.account?.user_id ?? "";
    assert.ok(coachUserId, "Expected registered coach user_id");

    const exerciseResponse = await request(server.baseUrl, "GET", "/templates/exercises");
    assertStatus(exerciseResponse, 200, "exercise options");
    const exercises = exerciseResponse.json?.exercises;
    assert.ok(
      Array.isArray(exercises) && exercises.length >= 13,
      "Expected at least thirteen active exercise options"
    );
    const exerciseIds = exercises.map((exercise) => exercise.exercise_id);

    function baseWorkItem(exerciseId, orderIndex, overrides = {}) {
      return {
        work_item_id: "",
        order_index: orderIndex,
        exercise_id: exerciseId,
        planned_sets: 3,
        rep_mode: "fixed",
        planned_reps: 8,
        rep_min: 8,
        rep_max: 8,
        load_mode: "bodyweight",
        percent_1rm: 75,
        weight_value: 20,
        weight_unit: "kg",
        rpe_value: 8,
        rest_seconds: 90,
        role: orderIndex === 1 ? "primary" : "accessory",
        coaching_notes: "",
        segment: "working",
        group_id: "",
        group_type: "straight",
        ...overrides
      };
    }

    function templatePayload(name, workItems, sessionNotes = "") {
      return {
        coach_user_id: coachUserId,
        template_version: 1,
        template_name: name,
        description: "Flexible composition proof.",
        activity_id: "powerlifting",
        blocks: [{
          block_id: "",
          order_index: 1,
          name: "Block 1",
          description: "",
          block_type: "general",
          week_count: 1,
          weeks: [{
            week_id: "",
            order_index: 1,
            sessions: [{
              session_id: "",
              order_index: 1,
              title: "Session 1",
              coaching_notes: sessionNotes,
              work_items: workItems
            }]
          }]
        }],
        updated_at_iso8601: new Date().toISOString()
      };
    }

    // --- Positive: six exercises in one session (beyond the old hard cap of four). ---
    const sixExercises = exerciseIds
      .slice(0, 6)
      .map((exerciseId, index) => baseWorkItem(exerciseId, index + 1));

    const sixExerciseSave = await request(
      server.baseUrl, "POST", "/templates", templatePayload("Six Exercise Session", sixExercises)
    );
    assertStatus(sixExerciseSave, 201, "six exercise session save");
    assert.equal(
      sixExerciseSave.json?.template?.template_structure?.blocks[0]?.weeks[0]?.days[0]?.sessions[0]?.work_items.length,
      6,
      "Expected six persisted work items"
    );

    // --- Positive: a superset pair plus a warm-up segment item plus coaching notes. ---
    const supersetGroupId = "group_proof_1";
    const groupedExercises = [
      baseWorkItem(exerciseIds[0], 1, { segment: "warm_up", coaching_notes: "Easy pace, build up gradually." }),
      baseWorkItem(exerciseIds[1], 2, { group_id: supersetGroupId, group_type: "superset", rest_seconds: 0 }),
      baseWorkItem(exerciseIds[2], 3, { group_id: supersetGroupId, group_type: "superset", coaching_notes: "Go straight into this from the prior exercise." }),
      baseWorkItem(exerciseIds[3], 4, { segment: "cool_down" })
    ];

    const groupedSave = await request(
      server.baseUrl,
      "POST",
      "/templates",
      templatePayload("Superset And Segments Session", groupedExercises, "Focus on bar speed today.")
    );
    assertStatus(groupedSave, 201, "grouped session save");

    const storedGroupedSession =
      groupedSave.json?.template?.template_structure?.blocks[0]?.weeks[0]?.days[0]?.sessions[0];
    assert.equal(storedGroupedSession?.coaching_notes, "Focus on bar speed today.");

    const storedGroupedItems = storedGroupedSession?.work_items ?? [];
    assert.equal(storedGroupedItems[0]?.segment, "warm_up");
    assert.equal(storedGroupedItems[0]?.coaching_notes, "Easy pace, build up gradually.");
    assert.equal(storedGroupedItems[1]?.group_id, supersetGroupId);
    assert.equal(storedGroupedItems[1]?.group_type, "superset");
    assert.equal(storedGroupedItems[2]?.group_id, supersetGroupId);
    assert.equal(storedGroupedItems[2]?.coaching_notes, "Go straight into this from the prior exercise.");
    assert.equal(storedGroupedItems[3]?.segment, "cool_down");
    assert.equal(storedGroupedItems[3]?.group_id, "");

    // --- Positive: the grouping trace survives compilation through Phase 6.
    // Regression proof for a real gap - the athlete-facing UI already renders
    // a "Superset"/"Circuit" badge off exercise.group_id/group_type
    // (public/app/app.js renderExerciseFocus/renderExerciseQueue), but
    // nothing ever proved those fields reach a compiled session. Phase 6
    // (engine/src/phases/phase6.ts) whitelists emitted exercise fields and
    // previously dropped group_id/group_type entirely. ---
    const groupedTemplateId = groupedSave.json?.template?.template_id;
    assert.equal(typeof groupedTemplateId, "string");

    const groupedCompletion = await request(
      server.baseUrl,
      "POST",
      `/templates/${encodeURIComponent(groupedTemplateId)}/complete`,
      { coach_user_id: coachUserId }
    );
    assertStatus(groupedCompletion, 200, "grouped template completion");

    const groupedActivation = await request(
      server.baseUrl,
      "POST",
      `/templates/${encodeURIComponent(groupedTemplateId)}/activate`,
      { coach_user_id: coachUserId }
    );
    assertStatus(groupedActivation, 200, "grouped template activation");

    const groupedAthleteUserId = `beta18_grouped_athlete_${nonce}`;
    const groupedPhase1Input = {
      consent_granted: true,
      engine_version: "EB2-1.0.0",
      enum_bundle_version: "EB2-1.0.0",
      phase1_schema_version: "1.0.0",
      actor_type: "athlete",
      execution_scope: "individual",
      activity_id: "powerlifting",
      nd_mode: false,
      instruction_density: "standard",
      exposure_prompt_density: "standard",
      bias_mode: "none"
    };
    const groupedTimestamp = new Date().toISOString();

    const groupedCoachProfile = await request(
      server.baseUrl,
      "POST",
      "/sessions/beta-coach-profile",
      {
        coach_user_id: coachUserId,
        email: `${coachUserId}@example.com`,
        display_name: "Composition Coach",
        account_role: "coach",
        account_state: "active",
        accepted_terms_version: "terms_v1",
        created_at_iso8601: groupedTimestamp
      }
    );
    assertStatus(groupedCoachProfile, 201, "grouped coach profile");

    const groupedAthleteAuth = await request(
      server.baseUrl,
      "POST",
      "/sessions/beta-auth",
      {
        user_id: groupedAthleteUserId,
        email: `${groupedAthleteUserId}@example.com`,
        display_name: "Composition Athlete",
        account_role: "athlete",
        account_state: "active",
        accepted_terms_version: "terms_v1",
        created_at_iso8601: groupedTimestamp
      }
    );
    assertStatus(groupedAthleteAuth, 201, "grouped athlete auth");

    const groupedAcknowledgement = await request(
      server.baseUrl,
      "POST",
      "/sessions/beta-acknowledgement",
      {
        acknowledgement_id: `beta18_grouped_ack_${nonce}`,
        user_id: groupedAthleteUserId,
        beta_id: "september_beta_2026",
        accepted: true,
        jurisdiction_acknowledged: true,
        accepted_at_iso8601: groupedTimestamp,
        copy_acknowledgement_id: "BETA16_COPY_ACKNOWLEDGEMENT_LABEL"
      }
    );
    assertStatus(groupedAcknowledgement, 201, "grouped acknowledgement");

    const groupedDeclaration = await request(
      server.baseUrl,
      "POST",
      "/sessions/beta-declaration",
      {
        declaration_id: `beta18_grouped_declaration_${nonce}`,
        user_id: groupedAthleteUserId,
        phase1_input: groupedPhase1Input,
        jurisdiction_acknowledged: true,
        declared_at_iso8601: groupedTimestamp,
        accepted_terms_version: "terms_v1",
        copy_acknowledgement_id: "BETA16_COPY_DECLARATION_ACKNOWLEDGEMENT"
      }
    );
    assertStatus(groupedDeclaration, 201, "grouped declaration");

    const groupedRelationship = await request(
      server.baseUrl,
      "POST",
      "/sessions/beta-coach-relationship",
      {
        relationship_id: `beta18_grouped_relationship_${nonce}`,
        coach_user_id: coachUserId,
        athlete_user_id: groupedAthleteUserId,
        relationship_state: "accepted",
        relationship_scope: "individual_coach_athlete",
        accepted_at_iso8601: groupedTimestamp,
        created_at_iso8601: groupedTimestamp,
        updated_at_iso8601: groupedTimestamp,
        revoked_at_iso8601: null,
        expires_at_iso8601: null
      }
    );
    assertStatus(groupedRelationship, 201, "grouped relationship");

    const groupedAssignment = await request(
      server.baseUrl,
      "POST",
      "/sessions/beta-coach-assignment",
      {
        request_id: `beta18_grouped_assignment_${nonce}`,
        requested_at_iso8601: groupedTimestamp,
        coach_user_id: coachUserId,
        athlete_user_id: groupedAthleteUserId,
        template_id: groupedTemplateId,
        activity_id: "powerlifting"
      }
    );
    assertStatus(groupedAssignment, 201, "grouped template assignment");

    const groupedCompile = await request(
      server.baseUrl,
      "POST",
      "/blocks/compile?create_session=true&beta_path=true",
      {
        phase1_input: groupedPhase1Input,
        beta_user_id: groupedAthleteUserId,
        beta_coach_user_id: coachUserId
      }
    );
    assertStatus(groupedCompile, 201, "grouped template compile");

    const compiledGroupedExercises = groupedCompile.json?.planned_session?.exercises ?? [];
    assert.equal(
      compiledGroupedExercises.length,
      4,
      "Expected all four grouped-session exercises to compile"
    );
    assert.equal(compiledGroupedExercises[0]?.group_id, undefined, "warm-up item must not carry a group");
    assert.equal(compiledGroupedExercises[1]?.group_id, supersetGroupId);
    assert.equal(compiledGroupedExercises[1]?.group_type, "superset");
    assert.equal(compiledGroupedExercises[2]?.group_id, supersetGroupId);
    assert.equal(compiledGroupedExercises[2]?.group_type, "superset");
    assert.equal(compiledGroupedExercises[3]?.group_id, undefined, "cool-down item must not carry a group");

    // --- Positive: segment/coaching_notes also survive compilation through Phase 6.
    // Same regression class as group_id/group_type above - the athlete-facing UI
    // already renders segment badges and coaching notes off these fields
    // (public/app/app.js renderExerciseFocus/renderExerciseQueue), but Phase 6
    // previously dropped both entirely. ---
    assert.equal(compiledGroupedExercises[0]?.segment, "warm_up");
    assert.equal(compiledGroupedExercises[0]?.coaching_notes, "Easy pace, build up gradually.");
    assert.equal(compiledGroupedExercises[1]?.segment, "working", "default segment when not authored");
    assert.equal(compiledGroupedExercises[2]?.coaching_notes, "Go straight into this from the prior exercise.");
    assert.equal(compiledGroupedExercises[3]?.segment, "cool_down");

    // --- Negative: thirteen exercises exceeds the maximum of twelve. ---
    const thirteenExercises = exerciseIds
      .slice(0, 13)
      .map((exerciseId, index) => baseWorkItem(exerciseId, index + 1));

    const tooManySave = await request(
      server.baseUrl, "POST", "/templates", templatePayload("Too Many Exercises Session", thirteenExercises)
    );
    assertStatus(tooManySave, 400, "thirteen exercise session rejected");
    assert.equal(
      tooManySave.json?.details?.reason ?? tooManySave.json?.reason,
      "session_work_item_count_invalid"
    );

    // --- Negative: a group with only one member. ---
    const lonelyGroupItems = [
      baseWorkItem(exerciseIds[0], 1, { group_id: "lonely_group", group_type: "superset" }),
      baseWorkItem(exerciseIds[1], 2),
      baseWorkItem(exerciseIds[2], 3),
      baseWorkItem(exerciseIds[3], 4)
    ];
    const lonelyGroupSave = await request(
      server.baseUrl, "POST", "/templates", templatePayload("Lonely Group Session", lonelyGroupItems)
    );
    assertStatus(lonelyGroupSave, 400, "lonely group rejected");
    assert.equal(
      lonelyGroupSave.json?.details?.reason ?? lonelyGroupSave.json?.reason,
      "work_item_group_too_small"
    );

    // --- Negative: a group whose members are not adjacent. ---
    const nonContiguousGroupId = "non_contiguous_group";
    const nonContiguousItems = [
      baseWorkItem(exerciseIds[0], 1, { group_id: nonContiguousGroupId, group_type: "superset" }),
      baseWorkItem(exerciseIds[1], 2),
      baseWorkItem(exerciseIds[2], 3, { group_id: nonContiguousGroupId, group_type: "superset" }),
      baseWorkItem(exerciseIds[3], 4)
    ];
    const nonContiguousSave = await request(
      server.baseUrl, "POST", "/templates", templatePayload("Non Contiguous Group Session", nonContiguousItems)
    );
    assertStatus(nonContiguousSave, 400, "non-contiguous group rejected");
    assert.equal(
      nonContiguousSave.json?.details?.reason ?? nonContiguousSave.json?.reason,
      "work_item_group_not_contiguous"
    );

    // --- Negative: a group whose members disagree on group_type. ---
    const mismatchGroupId = "mismatch_group";
    const mismatchItems = [
      baseWorkItem(exerciseIds[0], 1, { group_id: mismatchGroupId, group_type: "superset" }),
      baseWorkItem(exerciseIds[1], 2, { group_id: mismatchGroupId, group_type: "circuit" }),
      baseWorkItem(exerciseIds[2], 3),
      baseWorkItem(exerciseIds[3], 4)
    ];
    const mismatchSave = await request(
      server.baseUrl, "POST", "/templates", templatePayload("Mismatched Group Session", mismatchItems)
    );
    assertStatus(mismatchSave, 400, "mismatched group type rejected");
    assert.equal(
      mismatchSave.json?.details?.reason ?? mismatchSave.json?.reason,
      "work_item_group_type_mismatch"
    );

    // --- Negative: a grouping type set without an actual group. ---
    const ungroupedTypeItems = [
      baseWorkItem(exerciseIds[0], 1, { group_type: "superset" }),
      baseWorkItem(exerciseIds[1], 2),
      baseWorkItem(exerciseIds[2], 3),
      baseWorkItem(exerciseIds[3], 4)
    ];
    const ungroupedTypeSave = await request(
      server.baseUrl, "POST", "/templates", templatePayload("Ungrouped Type Session", ungroupedTypeItems)
    );
    assertStatus(ungroupedTypeSave, 400, "grouping type without a group rejected");
    assert.equal(
      ungroupedTypeSave.json?.details?.reason ?? ungroupedTypeSave.json?.reason,
      "work_item_group_type_requires_group"
    );

    // --- Negative: coaching notes over the 500-character cap. ---
    const overlongNote = "x".repeat(501);
    const overlongNoteItems = [
      baseWorkItem(exerciseIds[0], 1, { coaching_notes: overlongNote }),
      baseWorkItem(exerciseIds[1], 2),
      baseWorkItem(exerciseIds[2], 3),
      baseWorkItem(exerciseIds[3], 4)
    ];
    const overlongNoteSave = await request(
      server.baseUrl, "POST", "/templates", templatePayload("Overlong Note Session", overlongNoteItems)
    );
    assertStatus(overlongNoteSave, 400, "overlong coaching note rejected");
    assert.equal(
      overlongNoteSave.json?.details?.reason ?? overlongNoteSave.json?.reason,
      "work_item_coaching_notes_too_long"
    );
  }
);

test(
  "BETA-18 template builder supports tempo and duration/distance prescriptions alongside reps",
  async (testContext) => {
    const root = repoRoot();
    const databaseUrl = process.env.DATABASE_URL;
    assert.ok(
      typeof databaseUrl === "string" && databaseUrl.length > 0,
      "DATABASE_URL is required"
    );

    const environment = { ...process.env, DATABASE_URL: databaseUrl };
    delete environment.SMOKE_NO_DB;

    const server = await startServer(root, environment);
    testContext.after(async () => {
      await stopServer(server);
    });

    const nonce = crypto.randomUUID().replaceAll("-", "");

    const coachRegistration = await request(
      server.baseUrl,
      "POST",
      "/account/register",
      {
        actor_type: "coach",
        display_name: "Prescription Coach",
        email: `beta18_prescription_coach_${nonce}@example.com`,
        password: "Beta18PrescriptionCoach!2026",
        accepted_terms: true,
        accepted_consent: true,
        accepted_terms_version: "terms_v1",
        accepted_consent_version: "consent_v1"
      }
    );
    assertStatus(coachRegistration, 201, "coach account registration");
    const coachUserId = coachRegistration.json?.account?.user_id ?? "";
    assert.ok(coachUserId, "Expected registered coach user_id");
    const coachCookie = sessionCookie(coachRegistration, "coach account registration");

    const exerciseResponse = await request(server.baseUrl, "GET", "/templates/exercises");
    assertStatus(exerciseResponse, 200, "exercise options");
    const exercises = exerciseResponse.json?.exercises;
    assert.ok(
      Array.isArray(exercises) && exercises.length >= 4,
      "Expected at least four active exercise options"
    );
    const exerciseIds = exercises.map((exercise) => exercise.exercise_id);

    // FULL-UI-35: the coach builder's "Exercise info" lookup reads written
    // instructions, coaching cues and common faults for a registry exercise.
    const exerciseContentResponse = await request(
      server.baseUrl, "GET", "/exercises/back_squat/content", undefined, { cookie: coachCookie }
    );
    assertStatus(exerciseContentResponse, 200, "coach reads exercise coaching content");
    assert.equal(exerciseContentResponse.json?.exercise_id, "back_squat");
    assert.ok(
      Array.isArray(exerciseContentResponse.json?.coaching_cues) && exerciseContentResponse.json.coaching_cues.length > 0,
      "Expected non-empty coaching_cues"
    );
    assert.ok(
      Array.isArray(exerciseContentResponse.json?.common_faults) && exerciseContentResponse.json.common_faults.length > 0,
      "Expected non-empty common_faults"
    );

    function baseWorkItem(exerciseId, orderIndex, overrides = {}) {
      return {
        work_item_id: "",
        order_index: orderIndex,
        exercise_id: exerciseId,
        planned_sets: 3,
        rep_mode: "fixed",
        planned_reps: 8,
        rep_min: 8,
        rep_max: 8,
        load_mode: "bodyweight",
        percent_1rm: 75,
        weight_value: 20,
        weight_unit: "kg",
        rpe_value: 8,
        rest_seconds: 90,
        role: orderIndex === 1 ? "primary" : "accessory",
        coaching_notes: "",
        segment: "working",
        group_id: "",
        group_type: "straight",
        ...overrides
      };
    }

    function templatePayload(name, workItems) {
      return {
        coach_user_id: coachUserId,
        template_version: 1,
        template_name: name,
        description: "Prescription mode proof.",
        activity_id: "powerlifting",
        blocks: [{
          block_id: "",
          order_index: 1,
          name: "Block 1",
          description: "",
          block_type: "general",
          week_count: 1,
          weeks: [{
            week_id: "",
            order_index: 1,
            sessions: [{
              session_id: "",
              order_index: 1,
              title: "Session 1",
              coaching_notes: "",
              work_items: workItems
            }]
          }]
        }],
        updated_at_iso8601: new Date().toISOString()
      };
    }

    // --- Positive: a duration-mode hold, fixed and then a range. ---
    const durationFixedItems = [
      baseWorkItem(exerciseIds[0], 1, {
        prescription_mode: "duration",
        duration_mode: "fixed",
        planned_duration_seconds: 45
      }),
      baseWorkItem(exerciseIds[1], 2),
      baseWorkItem(exerciseIds[2], 3),
      baseWorkItem(exerciseIds[3], 4)
    ];
    const durationFixedSave = await request(
      server.baseUrl, "POST", "/templates", templatePayload("Duration Fixed Session", durationFixedItems)
    );
    assertStatus(durationFixedSave, 201, "duration fixed session save");
    const storedDurationFixedItem =
      durationFixedSave.json?.template?.template_structure?.blocks[0]?.weeks[0]?.days[0]?.sessions[0]?.work_items[0];
    assert.equal(storedDurationFixedItem?.prescription_mode, "duration");
    assert.equal(storedDurationFixedItem?.duration_prescription?.type, "fixed");
    assert.equal(storedDurationFixedItem?.duration_prescription?.value, 45);

    const durationRangeItems = [
      baseWorkItem(exerciseIds[0], 1, {
        prescription_mode: "duration",
        duration_mode: "range",
        duration_min_seconds: 30,
        duration_max_seconds: 60
      }),
      baseWorkItem(exerciseIds[1], 2),
      baseWorkItem(exerciseIds[2], 3),
      baseWorkItem(exerciseIds[3], 4)
    ];
    const durationRangeSave = await request(
      server.baseUrl, "POST", "/templates", templatePayload("Duration Range Session", durationRangeItems)
    );
    assertStatus(durationRangeSave, 201, "duration range session save");
    const storedDurationRangeItem =
      durationRangeSave.json?.template?.template_structure?.blocks[0]?.weeks[0]?.days[0]?.sessions[0]?.work_items[0];
    assert.equal(storedDurationRangeItem?.duration_prescription?.type, "range");
    assert.equal(storedDurationRangeItem?.duration_prescription?.minimum, 30);
    assert.equal(storedDurationRangeItem?.duration_prescription?.maximum, 60);

    // --- Positive: a distance-mode prescription, fixed in feet and a range in meters. ---
    const distanceFixedItems = [
      baseWorkItem(exerciseIds[0], 1, {
        prescription_mode: "distance",
        distance_mode: "fixed",
        distance_unit: "feet",
        planned_distance_value: 40
      }),
      baseWorkItem(exerciseIds[1], 2),
      baseWorkItem(exerciseIds[2], 3),
      baseWorkItem(exerciseIds[3], 4)
    ];
    const distanceFixedSave = await request(
      server.baseUrl, "POST", "/templates", templatePayload("Distance Fixed Session", distanceFixedItems)
    );
    assertStatus(distanceFixedSave, 201, "distance fixed session save");
    const storedDistanceFixedItem =
      distanceFixedSave.json?.template?.template_structure?.blocks[0]?.weeks[0]?.days[0]?.sessions[0]?.work_items[0];
    assert.equal(storedDistanceFixedItem?.prescription_mode, "distance");
    assert.equal(storedDistanceFixedItem?.distance_prescription?.type, "fixed");
    assert.equal(storedDistanceFixedItem?.distance_prescription?.value, 40);
    assert.equal(storedDistanceFixedItem?.distance_prescription?.unit, "feet");

    const distanceRangeItems = [
      baseWorkItem(exerciseIds[0], 1, {
        prescription_mode: "distance",
        distance_mode: "range",
        distance_unit: "meters",
        distance_min_value: 20,
        distance_max_value: 40
      }),
      baseWorkItem(exerciseIds[1], 2),
      baseWorkItem(exerciseIds[2], 3),
      baseWorkItem(exerciseIds[3], 4)
    ];
    const distanceRangeSave = await request(
      server.baseUrl, "POST", "/templates", templatePayload("Distance Range Session", distanceRangeItems)
    );
    assertStatus(distanceRangeSave, 201, "distance range session save");
    const storedDistanceRangeItem =
      distanceRangeSave.json?.template?.template_structure?.blocks[0]?.weeks[0]?.days[0]?.sessions[0]?.work_items[0];
    assert.equal(storedDistanceRangeItem?.distance_prescription?.type, "range");
    assert.equal(storedDistanceRangeItem?.distance_prescription?.minimum, 20);
    assert.equal(storedDistanceRangeItem?.distance_prescription?.maximum, 40);
    assert.equal(storedDistanceRangeItem?.distance_prescription?.unit, "meters");

    // --- Positive: a reps-mode exercise carrying an optional coaching tempo. ---
    const tempoItems = [
      baseWorkItem(exerciseIds[0], 1, { tempo: "3-1-X-0" }),
      baseWorkItem(exerciseIds[1], 2),
      baseWorkItem(exerciseIds[2], 3),
      baseWorkItem(exerciseIds[3], 4)
    ];
    const tempoSave = await request(
      server.baseUrl, "POST", "/templates", templatePayload("Tempo Session", tempoItems)
    );
    assertStatus(tempoSave, 201, "tempo session save");
    const storedTempoItem =
      tempoSave.json?.template?.template_structure?.blocks[0]?.weeks[0]?.days[0]?.sessions[0]?.work_items[0];
    assert.equal(storedTempoItem?.tempo, "3-1-X-0");
    assert.equal(storedTempoItem?.prescription_mode, "reps");

    // --- Positive: tempo, duration-range and distance-fixed prescriptions all
    // survive compilation through Phase 6. Same regression class as the
    // grouping/segment fix above - the athlete-facing UI already renders
    // exercise.duration_range/duration_seconds/distance_value/distance_unit/tempo
    // (public/app/app.js exerciseDetails), but Phase 6 previously dropped all of
    // them entirely. ---
    const prescriptionCompileItems = [
      baseWorkItem(exerciseIds[0], 1, {
        prescription_mode: "duration",
        duration_mode: "range",
        duration_min_seconds: 30,
        duration_max_seconds: 60
      }),
      baseWorkItem(exerciseIds[1], 2, {
        prescription_mode: "distance",
        distance_mode: "fixed",
        distance_unit: "meters",
        planned_distance_value: 400
      }),
      baseWorkItem(exerciseIds[2], 3, { tempo: "4-2-X-0" }),
      baseWorkItem(exerciseIds[3], 4)
    ];
    const prescriptionCompileSave = await request(
      server.baseUrl, "POST", "/templates", templatePayload("Prescription Compile Session", prescriptionCompileItems)
    );
    assertStatus(prescriptionCompileSave, 201, "prescription compile session save");
    const prescriptionTemplateId = prescriptionCompileSave.json?.template?.template_id;
    assert.equal(typeof prescriptionTemplateId, "string");

    const prescriptionCompletion = await request(
      server.baseUrl,
      "POST",
      `/templates/${encodeURIComponent(prescriptionTemplateId)}/complete`,
      { coach_user_id: coachUserId }
    );
    assertStatus(prescriptionCompletion, 200, "prescription template completion");

    const prescriptionActivation = await request(
      server.baseUrl,
      "POST",
      `/templates/${encodeURIComponent(prescriptionTemplateId)}/activate`,
      { coach_user_id: coachUserId }
    );
    assertStatus(prescriptionActivation, 200, "prescription template activation");

    const prescriptionAthleteUserId = `beta18_prescription_athlete_${nonce}`;
    const prescriptionPhase1Input = {
      consent_granted: true,
      engine_version: "EB2-1.0.0",
      enum_bundle_version: "EB2-1.0.0",
      phase1_schema_version: "1.0.0",
      actor_type: "athlete",
      execution_scope: "individual",
      activity_id: "powerlifting",
      nd_mode: false,
      instruction_density: "standard",
      exposure_prompt_density: "standard",
      bias_mode: "none"
    };
    const prescriptionTimestamp = new Date().toISOString();

    const prescriptionCoachProfile = await request(
      server.baseUrl,
      "POST",
      "/sessions/beta-coach-profile",
      {
        coach_user_id: coachUserId,
        email: `${coachUserId}@example.com`,
        display_name: "Prescription Coach",
        account_role: "coach",
        account_state: "active",
        accepted_terms_version: "terms_v1",
        created_at_iso8601: prescriptionTimestamp
      }
    );
    assertStatus(prescriptionCoachProfile, 201, "prescription coach profile");

    const prescriptionAthleteAuth = await request(
      server.baseUrl,
      "POST",
      "/sessions/beta-auth",
      {
        user_id: prescriptionAthleteUserId,
        email: `${prescriptionAthleteUserId}@example.com`,
        display_name: "Prescription Athlete",
        account_role: "athlete",
        account_state: "active",
        accepted_terms_version: "terms_v1",
        created_at_iso8601: prescriptionTimestamp
      }
    );
    assertStatus(prescriptionAthleteAuth, 201, "prescription athlete auth");

    const prescriptionAcknowledgement = await request(
      server.baseUrl,
      "POST",
      "/sessions/beta-acknowledgement",
      {
        acknowledgement_id: `beta18_prescription_ack_${nonce}`,
        user_id: prescriptionAthleteUserId,
        beta_id: "september_beta_2026",
        accepted: true,
        jurisdiction_acknowledged: true,
        accepted_at_iso8601: prescriptionTimestamp,
        copy_acknowledgement_id: "BETA16_COPY_ACKNOWLEDGEMENT_LABEL"
      }
    );
    assertStatus(prescriptionAcknowledgement, 201, "prescription acknowledgement");

    const prescriptionDeclaration = await request(
      server.baseUrl,
      "POST",
      "/sessions/beta-declaration",
      {
        declaration_id: `beta18_prescription_declaration_${nonce}`,
        user_id: prescriptionAthleteUserId,
        phase1_input: prescriptionPhase1Input,
        jurisdiction_acknowledged: true,
        declared_at_iso8601: prescriptionTimestamp,
        accepted_terms_version: "terms_v1",
        copy_acknowledgement_id: "BETA16_COPY_DECLARATION_ACKNOWLEDGEMENT"
      }
    );
    assertStatus(prescriptionDeclaration, 201, "prescription declaration");

    const prescriptionRelationship = await request(
      server.baseUrl,
      "POST",
      "/sessions/beta-coach-relationship",
      {
        relationship_id: `beta18_prescription_relationship_${nonce}`,
        coach_user_id: coachUserId,
        athlete_user_id: prescriptionAthleteUserId,
        relationship_state: "accepted",
        relationship_scope: "individual_coach_athlete",
        accepted_at_iso8601: prescriptionTimestamp,
        created_at_iso8601: prescriptionTimestamp,
        updated_at_iso8601: prescriptionTimestamp,
        revoked_at_iso8601: null,
        expires_at_iso8601: null
      }
    );
    assertStatus(prescriptionRelationship, 201, "prescription relationship");

    const prescriptionAssignment = await request(
      server.baseUrl,
      "POST",
      "/sessions/beta-coach-assignment",
      {
        request_id: `beta18_prescription_assignment_${nonce}`,
        requested_at_iso8601: prescriptionTimestamp,
        coach_user_id: coachUserId,
        athlete_user_id: prescriptionAthleteUserId,
        template_id: prescriptionTemplateId,
        activity_id: "powerlifting"
      }
    );
    assertStatus(prescriptionAssignment, 201, "prescription template assignment");

    const prescriptionCompile = await request(
      server.baseUrl,
      "POST",
      "/blocks/compile?create_session=true&beta_path=true",
      {
        phase1_input: prescriptionPhase1Input,
        beta_user_id: prescriptionAthleteUserId,
        beta_coach_user_id: coachUserId
      }
    );
    assertStatus(prescriptionCompile, 201, "prescription template compile");

    const compiledPrescriptionExercises = prescriptionCompile.json?.planned_session?.exercises ?? [];
    assert.equal(
      compiledPrescriptionExercises.length,
      4,
      "Expected all four prescription-session exercises to compile"
    );

    assert.deepEqual(compiledPrescriptionExercises[0]?.duration_range, { minimum: 30, maximum: 60 });
    assert.equal(compiledPrescriptionExercises[0]?.duration_seconds, undefined);
    assert.equal(compiledPrescriptionExercises[0]?.distance_value, undefined);

    assert.equal(compiledPrescriptionExercises[1]?.distance_value, 400);
    assert.equal(compiledPrescriptionExercises[1]?.distance_unit, "meters");
    assert.equal(compiledPrescriptionExercises[1]?.distance_range, undefined);

    assert.equal(compiledPrescriptionExercises[2]?.tempo, "4-2-X-0");

    assert.equal(compiledPrescriptionExercises[3]?.tempo, undefined, "control item must not carry a tempo");
    assert.equal(compiledPrescriptionExercises[3]?.duration_range, undefined);
    assert.equal(compiledPrescriptionExercises[3]?.distance_value, undefined);

    // --- Negative: an invalid tempo format. ---
    const invalidTempoItems = [
      baseWorkItem(exerciseIds[0], 1, { tempo: "not-a-tempo" }),
      baseWorkItem(exerciseIds[1], 2),
      baseWorkItem(exerciseIds[2], 3),
      baseWorkItem(exerciseIds[3], 4)
    ];
    const invalidTempoSave = await request(
      server.baseUrl, "POST", "/templates", templatePayload("Invalid Tempo Session", invalidTempoItems)
    );
    assertStatus(invalidTempoSave, 400, "invalid tempo rejected");
    assert.equal(
      invalidTempoSave.json?.details?.reason ?? invalidTempoSave.json?.reason,
      "work_item_tempo_invalid"
    );

    // --- Negative: an unsupported prescription_mode. ---
    const invalidModeItems = [
      baseWorkItem(exerciseIds[0], 1, { prescription_mode: "isometric" }),
      baseWorkItem(exerciseIds[1], 2),
      baseWorkItem(exerciseIds[2], 3),
      baseWorkItem(exerciseIds[3], 4)
    ];
    const invalidModeSave = await request(
      server.baseUrl, "POST", "/templates", templatePayload("Invalid Prescription Mode Session", invalidModeItems)
    );
    assertStatus(invalidModeSave, 400, "invalid prescription mode rejected");
    assert.equal(
      invalidModeSave.json?.details?.reason ?? invalidModeSave.json?.reason,
      "prescription_mode_invalid"
    );

    // --- Negative: a duration range whose maximum is lower than the minimum. ---
    const invalidDurationRangeItems = [
      baseWorkItem(exerciseIds[0], 1, {
        prescription_mode: "duration",
        duration_mode: "range",
        duration_min_seconds: 60,
        duration_max_seconds: 30
      }),
      baseWorkItem(exerciseIds[1], 2),
      baseWorkItem(exerciseIds[2], 3),
      baseWorkItem(exerciseIds[3], 4)
    ];
    const invalidDurationRangeSave = await request(
      server.baseUrl,
      "POST",
      "/templates",
      templatePayload("Invalid Duration Range Session", invalidDurationRangeItems)
    );
    assertStatus(invalidDurationRangeSave, 400, "inverted duration range rejected");
    assert.equal(
      invalidDurationRangeSave.json?.details?.reason ?? invalidDurationRangeSave.json?.reason,
      "duration_range_order_invalid"
    );

    // --- Negative: a distance value outside the supported bounds. ---
    const invalidDistanceItems = [
      baseWorkItem(exerciseIds[0], 1, {
        prescription_mode: "distance",
        distance_mode: "fixed",
        planned_distance_value: 20000
      }),
      baseWorkItem(exerciseIds[1], 2),
      baseWorkItem(exerciseIds[2], 3),
      baseWorkItem(exerciseIds[3], 4)
    ];
    const invalidDistanceSave = await request(
      server.baseUrl, "POST", "/templates", templatePayload("Invalid Distance Session", invalidDistanceItems)
    );
    assertStatus(invalidDistanceSave, 400, "out-of-bounds distance rejected");
    assert.equal(
      invalidDistanceSave.json?.details?.reason ?? invalidDistanceSave.json?.reason,
      "planned_distance_value_invalid"
    );

    // --- Negative: an unsupported distance unit. ---
    const invalidDistanceUnitItems = [
      baseWorkItem(exerciseIds[0], 1, {
        prescription_mode: "distance",
        distance_unit: "yards"
      }),
      baseWorkItem(exerciseIds[1], 2),
      baseWorkItem(exerciseIds[2], 3),
      baseWorkItem(exerciseIds[3], 4)
    ];
    const invalidDistanceUnitSave = await request(
      server.baseUrl,
      "POST",
      "/templates",
      templatePayload("Invalid Distance Unit Session", invalidDistanceUnitItems)
    );
    assertStatus(invalidDistanceUnitSave, 400, "unsupported distance unit rejected");
    assert.equal(
      invalidDistanceUnitSave.json?.details?.reason ?? invalidDistanceUnitSave.json?.reason,
      "distance_unit_invalid"
    );
  }
);
