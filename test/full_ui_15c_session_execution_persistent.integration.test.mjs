import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";

async function listen() {
  return await new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
    server.once("error", reject);
  });
}

async function closeServer(server) {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function request(baseUrl, method, route, body, options = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (options.cookie) headers.cookie = options.cookie;
  if (options.csrf) headers["x-kolosseum-csrf"] = options.csrf;

  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { response, text, json };
}

function assertStatus(result, status, label) {
  assert.equal(
    result.response.status,
    status,
    `${label}: expected ${status}, received ${result.response.status}. raw=${result.text}`
  );
}

function workItems() {
  return [
    ["back_squat", 75],
    ["bench_press", 75],
    ["deadlift", 70],
    ["overhead_press", 65]
  ].map(([exerciseId, percent], index) => ({
    work_item_id: "",
    order_index: index + 1,
    exercise_id: exerciseId,
    planned_sets: index === 0 ? 4 : 3,
    rep_mode: "fixed",
    planned_reps: index === 0 ? 5 : 8,
    rep_min: index === 0 ? 5 : 8,
    rep_max: index === 0 ? 5 : 8,
    load_mode: "percent_1rm",
    percent_1rm: percent,
    weight_value: 20,
    weight_unit: "kg",
    rest_seconds: index === 0 ? 180 : 120,
    role: index === 0 ? "primary" : "accessory"
  }));
}

function blockWithSessions() {
  return {
    block_id: "",
    order_index: 1,
    name: "Full-UI-15C Block",
    description: "",
    block_type: "strength",
    week_count: 1,
    weeks: [{
      week_id: "",
      order_index: 1,
      sessions: [{
        session_id: "",
        order_index: 1,
        title: "Session 1",
        work_items: workItems()
      }]
    }]
  };
}

function sessionCookie(result, label) {
  const values =
    typeof result.response.headers.getSetCookie === "function"
      ? result.response.headers.getSetCookie()
      : [result.response.headers.get("set-cookie")].filter(Boolean);

  const session = values.find((value) => String(value).startsWith("kolosseum_session="));
  assert.ok(session, `${label}: expected session cookie`);
  return String(session).split(";")[0];
}

async function registerAccount(baseUrl, actorType, label, nonce) {
  const registration = await request(baseUrl, "POST", "/account/register", {
    actor_type: actorType,
    display_name: label,
    email: `${label.toLowerCase().replaceAll(/[^a-z0-9]/gu, "_")}_${nonce}@example.com`,
    password: "Full15cSessionExecution!2026",
    activity_id: "powerlifting",
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  assertStatus(registration, 201, `${label} account registration`);

  const userId = registration.json?.account?.user_id ?? "";
  assert.ok(userId, `${label}: expected registered user_id`);
  const cookie = sessionCookie(registration, `${label} account registration`);
  const csrf = registration.json?.csrf_token;
  assert.ok(csrf, `${label}: expected csrf token`);

  return { userId, cookie, csrf };
}

async function setUpCoach(baseUrl, label, nonce) {
  const coach = await registerAccount(baseUrl, "coach", label, nonce);
  const timestamp = new Date().toISOString();

  const profileResult = await request(baseUrl, "POST", "/sessions/beta-coach-profile", {
    coach_user_id: coach.userId,
    email: `${coach.userId}@example.com`,
    display_name: label,
    account_role: "coach",
    account_state: "active",
    accepted_terms_version: "terms_v1",
    created_at_iso8601: timestamp
  });
  assertStatus(profileResult, 201, `${label} coach profile`);

  return { ...coach, profile: profileResult.json.coach_profile };
}

async function setUpAthlete(baseUrl, label, nonce) {
  const userId = `full_ui_15c_${label.toLowerCase().replaceAll(/[^a-z0-9]/gu, "_")}_${nonce}`;
  const timestamp = new Date().toISOString();

  assertStatus(await request(baseUrl, "POST", "/sessions/beta-auth", {
    user_id: userId,
    email: `${userId}@example.com`,
    display_name: label,
    account_role: "athlete",
    account_state: "active",
    accepted_terms_version: "terms_v1",
    created_at_iso8601: timestamp
  }), 201, `${label} athlete auth`);

  assertStatus(await request(baseUrl, "POST", "/sessions/beta-acknowledgement", {
    acknowledgement_id: `ack_${userId}`,
    user_id: userId,
    beta_id: "september_beta_2026",
    accepted: true,
    jurisdiction_acknowledged: true,
    accepted_at_iso8601: timestamp,
    copy_acknowledgement_id: "BETA16_COPY_ACKNOWLEDGEMENT_LABEL"
  }), 201, `${label} acknowledgement`);

  assertStatus(await request(baseUrl, "POST", "/sessions/beta-declaration", {
    declaration_id: `declaration_${userId}`,
    user_id: userId,
    phase1_input: phase1Input(),
    jurisdiction_acknowledged: true,
    declared_at_iso8601: timestamp,
    accepted_terms_version: "terms_v1",
    copy_acknowledgement_id: "BETA16_COPY_DECLARATION_ACKNOWLEDGEMENT"
  }), 201, `${label} declaration`);

  return { userId };
}

function phase1Input() {
  return {
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
}

async function connectRelationship(baseUrl, coachUserId, athleteUserId, relationshipId, timestamp) {
  return request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
    relationship_id: relationshipId,
    coach_user_id: coachUserId,
    athlete_user_id: athleteUserId,
    relationship_state: "accepted",
    relationship_scope: "individual_coach_athlete",
    accepted_at_iso8601: timestamp,
    created_at_iso8601: timestamp,
    updated_at_iso8601: timestamp,
    revoked_at_iso8601: null,
    expires_at_iso8601: null
  });
}

async function setUpStrengthProfile(baseUrl, coach, athleteUserId) {
  const dateOnly = new Date().toISOString().slice(0, 10);
  assertStatus(await request(baseUrl, "POST", "/coach-workspace/athlete-strength-profile", {
    coach_user_id: coach.userId,
    athlete_user_id: athleteUserId,
    preferred_weight_unit: "kg",
    load_rounding_increment: 2.5,
    bodyweight: 90,
    bodyweight_unit: "kg",
    benchmarks: [
      ["back_squat", 160],
      ["bench_press", 110],
      ["deadlift", 200],
      ["overhead_press", 70]
    ].map(([exerciseId, value]) => ({
      benchmark_id: "",
      exercise_id: exerciseId,
      value,
      unit: "kg",
      basis: "tested_1rm",
      effective_date: dateOnly,
      source_note: "FULL-UI-15C integration proof"
    })),
    expected_current_record_sha256: null
  }, { cookie: coach.cookie, csrf: coach.csrf }), 201, "strength profile");
}

async function createSessionForAthlete(baseUrl, coach, athleteUserId, nonce) {
  const template = await createActivatedTemplate(baseUrl, coach.userId, `Full15c Programme ${nonce}`);

  const assignment = await request(
    baseUrl,
    "POST",
    "/coach-workspace/athlete-assignment",
    {
      request_id: `full_ui_15c_request_${nonce}`,
      requested_at_iso8601: new Date().toISOString(),
      coach_user_id: coach.userId,
      athlete_user_id: athleteUserId,
      template_id: template.template_id,
      activity_id: "powerlifting",
      event_id: ""
    },
    { cookie: coach.cookie, csrf: coach.csrf }
  );
  assertStatus(assignment, 201, "athlete assignment");

  const compiled = await request(
    baseUrl,
    "POST",
    "/blocks/compile?create_session=true&beta_path=true",
    {
      phase1_input: phase1Input(),
      beta_user_id: athleteUserId,
      beta_coach_user_id: coach.userId
    }
  );
  assertStatus(compiled, 201, "compile session");

  const sessionId = compiled.json.session_id;
  assert.ok(sessionId, "expected a created session id");
  return sessionId;
}

async function createActivatedTemplate(baseUrl, coachUserId, name) {
  const saved = await request(baseUrl, "POST", "/templates", {
    coach_user_id: coachUserId,
    template_version: 1,
    template_name: name,
    description: "FULL-UI-15C session execution proof.",
    activity_id: "powerlifting",
    event_plan: null,
    blocks: [blockWithSessions()],
    updated_at_iso8601: new Date().toISOString()
  });
  assertStatus(saved, 201, `${name}: draft save`);
  const template = saved.json.template;

  assertStatus(
    await request(baseUrl, "POST", `/templates/${encodeURIComponent(template.template_id)}/activate`, {
      coach_user_id: coachUserId
    }),
    200,
    `${name}: activate`
  );

  return template;
}

async function getState(baseUrl, sessionId) {
  const result = await request(baseUrl, "GET", `/sessions/${encodeURIComponent(sessionId)}/state`);
  assertStatus(result, 200, "get session state");
  return result.json;
}

async function getEvents(baseUrl, sessionId) {
  const result = await request(baseUrl, "GET", `/sessions/${encodeURIComponent(sessionId)}/events`);
  assertStatus(result, 200, "get session events");
  return result.json.events;
}

test(
  "FULL-UI-15C session execution: idempotent replay, skip reason, pain input, substitution, terminal protection and fresh-process recovery",
  async () => {
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
    let server = null;

    const userIds = [];
    const sessionIds = [];

    const cleanup = async () => {
      for (const sessionId of sessionIds) {
        await pool.query("DELETE FROM session_event_requests WHERE session_id = $1", [sessionId]).catch(() => {});
        await pool.query("DELETE FROM runtime_events WHERE session_id = $1", [sessionId]).catch(() => {});
        await pool.query("DELETE FROM session_event_seq WHERE session_id = $1", [sessionId]).catch(() => {});
      }
      for (const userId of userIds) {
        if (!userId) continue;
        await pool.query("DELETE FROM product_account_events WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_challenges WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_accounts WHERE user_id = $1", [userId]).catch(() => {});
      }
      await pool.query(
        `DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])`,
        [userIds.filter(Boolean)]
      ).catch(() => {});
    };

    try {
      server = await listen();
      let address = server.address();
      let baseUrl = `http://127.0.0.1:${address.port}`;
      const timestamp = new Date().toISOString();

      const coach = await setUpCoach(baseUrl, "Full15c Coach", nonce);
      userIds.push(coach.userId);

      const athlete = await setUpAthlete(baseUrl, "Full15c Athlete", nonce);
      userIds.push(athlete.userId);

      await connectRelationship(baseUrl, coach.userId, athlete.userId, `relationship_${nonce}`, timestamp);
      await setUpStrengthProfile(baseUrl, coach, athlete.userId);

      const sessionId = await createSessionForAthlete(baseUrl, coach, athlete.userId, nonce);
      sessionIds.push(sessionId);

      assertStatus(
        await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/start`, {}),
        200,
        "start session"
      );

      // --- Idempotent retry: same client_request_id + same event must not
      //     create a second runtime event, and must return the same seq. ---
      const skipRequestId = `crid_skip_${nonce}`;
      const skipBody = {
        type: "SKIP_EXERCISE",
        exercise_id: "back_squat",
        reason_code: "pain_or_discomfort",
        client_request_id: skipRequestId
      };

      const skipFirst = await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, skipBody);
      assertStatus(skipFirst, 201, "skip back_squat (first)");
      assert.equal(skipFirst.json.replayed, false);

      const skipReplay = await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, skipBody);
      assertStatus(skipReplay, 201, "skip back_squat (replay)");
      assert.equal(skipReplay.json.replayed, true);
      assert.equal(skipReplay.json.seq, skipFirst.json.seq);

      const eventsAfterReplay = await getEvents(baseUrl, sessionId);
      const skipEvents = eventsAfterReplay.filter((row) => row.event?.type === "SKIP_EXERCISE" && row.event?.exercise_id === "back_squat");
      assert.equal(skipEvents.length, 1, "duplicate submission must not create a duplicate runtime event");
      assert.equal(skipEvents[0].event.reason_code, "pain_or_discomfort");

      // --- Reusing the same client_request_id for a DIFFERENT event is a conflict. ---
      const conflictingReplay = await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
        ...skipBody,
        reason_code: "fatigue"
      });
      assertStatus(conflictingReplay, 409, "client_request_id reused for a different event");
      assert.equal(conflictingReplay.json.details?.failure_token, "phase6_runtime_request_id_conflict");

      // --- Skip reason must be a closed factual code, not free text. ---
      const stateAfterSkip = await getState(baseUrl, sessionId);
      const nextExerciseId = stateAfterSkip.current_step?.exercise?.exercise_id;
      assert.ok(nextExerciseId, "expected a next exercise after skipping back_squat");

      const badSkip = await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
        type: "SKIP_EXERCISE",
        exercise_id: nextExerciseId,
        reason_code: "because I felt like it"
      });
      assertStatus(badSkip, 400, "skip with an unlisted reason code must be rejected");
      assert.equal(badSkip.json.details?.failure_token, "phase6_runtime_skip_reason_invalid");

      // --- Pain input: factual flag only, no free text, no scoring. ---
      const painStateBefore = await getState(baseUrl, sessionId);

      const painReport = await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
        type: "PAIN_REPORT",
        exercise_id: nextExerciseId,
        pain_reported: true
      });
      assertStatus(painReport, 201, "pain report");

      const painStateAfter = await getState(baseUrl, sessionId);
      assert.deepEqual(
        painStateAfter.trace,
        painStateBefore.trace,
        "an unrecognized/no-op event type must not change reducer truth"
      );

      const badPainReport = await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
        type: "PAIN_REPORT",
        exercise_id: nextExerciseId,
        pain_reported: true,
        pain_text: "my shoulder feels off"
      });
      assertStatus(badPainReport, 400, "pain report with free text must be rejected");
      assert.equal(badPainReport.json.details?.failure_token, "phase6_runtime_pain_report_invalid_shape");

      const unknownExercisePainReport = await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
        type: "PAIN_REPORT",
        exercise_id: "not_a_real_exercise",
        pain_reported: true
      });
      assertStatus(unknownExercisePainReport, 400, "pain report for an unknown exercise must be rejected");

      // --- RPE input: a closed, bounded factual value only, no free text, no scoring/inference. ---
      const rpeStateBefore = await getState(baseUrl, sessionId);

      const rpeReport = await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
        type: "RPE_REPORT",
        exercise_id: nextExerciseId,
        rpe_value: 8
      });
      assertStatus(rpeReport, 201, "rpe report");

      const rpeStateAfter = await getState(baseUrl, sessionId);
      assert.deepEqual(
        rpeStateAfter.trace,
        rpeStateBefore.trace,
        "an unrecognized/no-op event type must not change reducer truth"
      );

      const badRpeShape = await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
        type: "RPE_REPORT",
        exercise_id: nextExerciseId,
        rpe_value: 8,
        rpe_text: "felt like an 8"
      });
      assertStatus(badRpeShape, 400, "rpe report with an unlisted key must be rejected");
      assert.equal(badRpeShape.json.details?.failure_token, "phase6_runtime_rpe_report_invalid_shape");

      const badRpeRange = await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
        type: "RPE_REPORT",
        exercise_id: nextExerciseId,
        rpe_value: 11
      });
      assertStatus(badRpeRange, 400, "rpe report outside the closed 1-10 range must be rejected");
      assert.equal(badRpeRange.json.details?.failure_token, "phase6_runtime_rpe_report_invalid_shape");

      const unknownExerciseRpeReport = await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
        type: "RPE_REPORT",
        exercise_id: "not_a_real_exercise",
        rpe_value: 8
      });
      assertStatus(unknownExerciseRpeReport, 400, "rpe report for an unknown exercise must be rejected");
      assert.equal(unknownExerciseRpeReport.json.details?.failure_token, "phase6_runtime_rpe_report_unknown_exercise");

      // --- Substitution: must use the existing contract/registry, and must
      //     never change which exercise_id is authoritative. ---
      const deadliftSubstitution = await request(
        baseUrl,
        "POST",
        `/sessions/${encodeURIComponent(sessionId)}/substitution-request`,
        { exercise_id: "deadlift", unavailable_equipment_ids: ["barbell"] }
      );

      let deadliftSubstitutionApplied = false;
      if (deadliftSubstitution.response.status === 200 && deadliftSubstitution.json?.ok === true) {
        const substitutionOutput = deadliftSubstitution.json.result.substitution_output;
        deadliftSubstitutionApplied = substitutionOutput.substitution_status === "substitution_applied";
        if (deadliftSubstitutionApplied) {
          assert.equal(substitutionOutput.source_exercise_id, "deadlift");
          assert.equal(substitutionOutput.target_exercise_id, "kettlebell_deadlift");

          const unlawfulTag = await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
            type: "COMPLETE_EXERCISE",
            exercise_id: "deadlift",
            substituted_exercise_id: "an_improvised_exercise",
            substitution_edge_id: substitutionOutput.substitution_edge_id
          });
          assertStatus(unlawfulTag, 409, "an improvised substitution tag must be refused");
          assert.equal(unlawfulTag.json.details?.failure_token, "phase6_runtime_substitution_tag_unlawful");

          const lawfulTag = await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
            type: "COMPLETE_EXERCISE",
            exercise_id: "deadlift",
            substituted_exercise_id: substitutionOutput.target_exercise_id,
            substitution_edge_id: substitutionOutput.substitution_edge_id
          });
          assertStatus(lawfulTag, 201, "lawful substitution tag must be accepted");

          const stateAfterSubstitution = await getState(baseUrl, sessionId);
          assert.ok(
            stateAfterSubstitution.trace.completed_ids.includes("deadlift"),
            "planned_items exercise_id (deadlift) must remain authoritative, not the substitute"
          );
        }
      }

      // --- Drive the session to a terminal state. ---
      for (let i = 0; i < 10; i += 1) {
        const probe = await getState(baseUrl, sessionId);
        if (!probe.current_step) break;
        const exerciseId = probe.current_step.exercise?.exercise_id;
        assert.ok(exerciseId, "expected an exercise_id on the current step");
        await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
          type: "COMPLETE_EXERCISE",
          exercise_id: exerciseId
        });
      }

      const terminalState = await getState(baseUrl, sessionId);
      assert.ok(
        terminalState.execution_status === "completed" || terminalState.execution_status === "partial",
        `expected a terminal execution_status, received ${terminalState.execution_status}`
      );

      // --- Terminal protection: no further event, of any type, may mutate or
      //     resurrect a terminal session. ---
      const postTerminalPain = await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
        type: "PAIN_REPORT",
        exercise_id: "back_squat",
        pain_reported: true
      });
      assertStatus(postTerminalPain, 409, "event after terminal must be rejected");
      assert.equal(postTerminalPain.json.details?.failure_token, "phase6_runtime_terminal_session_event_rejected");

      const postTerminalRpe = await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
        type: "RPE_REPORT",
        exercise_id: "back_squat",
        rpe_value: 8
      });
      assertStatus(postTerminalRpe, 409, "rpe event after terminal must be rejected");
      assert.equal(postTerminalRpe.json.details?.failure_token, "phase6_runtime_terminal_session_event_rejected");

      const stateAfterIllegalAttempt = await getState(baseUrl, sessionId);
      assert.deepEqual(
        stateAfterIllegalAttempt,
        terminalState,
        "terminal state must not change after a rejected post-terminal event"
      );

      // --- Fresh-process recovery: a brand new server process (new in-memory
      //     caches) must reconstruct the exact same terminal state from the
      //     database alone. ---
      await closeServer(server);
      server = await listen();
      address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;

      const stateFromFreshProcess = await getState(baseUrl, sessionId);
      assert.deepEqual(
        stateFromFreshProcess,
        terminalState,
        "a fresh process must reconstruct identical terminal state from the database"
      );
    }
    finally {
      await closeServer(server);
      await cleanup();
    }
  }
);
