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

function sessionCookie(result, label) {
  const values =
    typeof result.response.headers.getSetCookie === "function"
      ? result.response.headers.getSetCookie()
      : [result.response.headers.get("set-cookie")].filter(Boolean);

  const session = values.find((value) => String(value).startsWith("kolosseum_session="));
  assert.ok(session, `${label}: expected session cookie`);
  return String(session).split(";")[0];
}

function phase1Input() {
  return {
    consent_granted: true,
    engine_version: "EB2-1.0.0",
    enum_bundle_version: "EB2-1.0.0",
    phase1_schema_version: "1.0.0",
    actor_type: "athlete",
    execution_scope: "individual",
    activity_id: "crossfit",
    nd_mode: false,
    instruction_density: "standard",
    exposure_prompt_density: "standard",
    bias_mode: "none"
  };
}

async function registerAccount(baseUrl, actorType, label, nonce) {
  const registration = await request(baseUrl, "POST", "/account/register", {
    actor_type: actorType,
    display_name: label,
    email: `${label.toLowerCase().replaceAll(/[^a-z0-9]/gu, "_")}_${nonce}@example.com`,
    password: "Full82cCrossfitGroupWorkouts!2026",
    activity_id: "crossfit",
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
  const userId = `full_ui_82c_${label.toLowerCase().replaceAll(/[^a-z0-9]/gu, "_")}_${nonce}`;
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

// One barbell "complex" group (power_clean -> push_jerk -> thruster, same
// fixed weight/unit throughout, matching what a real barbell complex is: the
// bar never gets put down or reloaded between movements) and one "amrap"
// group (toes_to_bar + pull_up, bodyweight-loaded, shared 12-minute cap).
function workItems() {
  const complexMembers = [
    ["power_clean", 3],
    ["push_jerk", 3],
    ["thruster", 5]
  ].map(([exerciseId, reps], index) => ({
    work_item_id: "",
    order_index: index + 1,
    exercise_id: exerciseId,
    planned_sets: 3,
    rep_mode: "fixed",
    planned_reps: reps,
    rep_min: reps,
    rep_max: reps,
    load_mode: "fixed_weight",
    weight_value: 40,
    weight_unit: "kg",
    rest_seconds: 0,
    role: index === 0 ? "primary" : "accessory",
    coaching_notes: "",
    segment: "working",
    group_id: "complex1",
    group_type: "complex"
  }));

  const amrapMembers = [
    ["toes_to_bar", 8],
    ["pull_up", 10]
  ].map(([exerciseId, reps], index) => ({
    work_item_id: "",
    order_index: complexMembers.length + index + 1,
    exercise_id: exerciseId,
    planned_sets: 1,
    rep_mode: "fixed",
    planned_reps: reps,
    rep_min: reps,
    rep_max: reps,
    load_mode: "bodyweight",
    rest_seconds: 0,
    role: index === 0 ? "primary" : "accessory",
    coaching_notes: "",
    segment: "working",
    group_id: "amrapA",
    group_type: "amrap",
    group_time_cap_seconds: 720
  }));

  return [...complexMembers, ...amrapMembers];
}

function blockWithSessions() {
  return {
    block_id: "",
    order_index: 1,
    name: "Full-UI-82C Block",
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
        work_items: workItems()
      }]
    }]
  };
}

async function createActivatedTemplate(baseUrl, coachUserId, name) {
  const saved = await request(baseUrl, "POST", "/templates", {
    coach_user_id: coachUserId,
    template_version: 1,
    template_name: name,
    description: "FULL-UI-82C crossfit group-workout proof.",
    activity_id: "crossfit",
    event_plan: null,
    blocks: [blockWithSessions()],
    updated_at_iso8601: new Date().toISOString()
  });
  assertStatus(saved, 201, `${name}: draft save`);
  const template = saved.json.template;

  assertStatus(
    await request(baseUrl, "POST", `/templates/${encodeURIComponent(template.template_id)}/complete`, {
      coach_user_id: coachUserId
    }),
    200,
    `${name}: complete`
  );

  assertStatus(
    await request(baseUrl, "POST", `/templates/${encodeURIComponent(template.template_id)}/activate`, {
      coach_user_id: coachUserId
    }),
    200,
    `${name}: activate`
  );

  return template;
}

async function createSessionForAthlete(baseUrl, coach, athleteUserId, nonce) {
  const template = await createActivatedTemplate(baseUrl, coach.userId, `Full82c Programme ${nonce}`);

  const assignment = await request(
    baseUrl,
    "POST",
    "/coach-workspace/athlete-assignment",
    {
      request_id: `full_ui_82c_request_${nonce}`,
      requested_at_iso8601: new Date().toISOString(),
      coach_user_id: coach.userId,
      athlete_user_id: athleteUserId,
      template_id: template.template_id,
      activity_id: "crossfit",
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
  "FULL-UI-82C crossfit group workouts: a real complex and a real AMRAP group build, execute and complete atomically through the real HTTP routes",
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

      const coach = await setUpCoach(baseUrl, "Full82c Coach", nonce);
      userIds.push(coach.userId);

      const athlete = await setUpAthlete(baseUrl, "Full82c Athlete", nonce);
      userIds.push(athlete.userId);

      await connectRelationship(baseUrl, coach.userId, athlete.userId, `relationship_${nonce}`, timestamp);

      const sessionId = await createSessionForAthlete(baseUrl, coach, athlete.userId, nonce);
      sessionIds.push(sessionId);

      assertStatus(
        await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/start`, {}),
        200,
        "start session"
      );

      // --- The complex group must surface as ONE bundled GROUP_WORKOUT step,
      //     not as its first member alone. ---
      const stateBeforeComplex = await getState(baseUrl, sessionId);
      assert.equal(stateBeforeComplex.current_step?.type, "GROUP_WORKOUT", "expected the complex group to surface as a bundled step");
      assert.equal(stateBeforeComplex.current_step.group_type, "complex");
      assert.deepEqual(
        stateBeforeComplex.current_step.exercises.map((exercise) => exercise.exercise_id),
        ["power_clean", "push_jerk", "thruster"]
      );
      assert.deepEqual(
        stateBeforeComplex.trace.remaining_ids.slice(0, 3),
        ["power_clean", "push_jerk", "thruster"]
      );

      // --- COMPLETE_GROUP resolves every remaining member of the complex at
      //     once, with exactly one new runtime_events row. ---
      const eventsBeforeComplete = await getEvents(baseUrl, sessionId);

      const completeComplex = await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
        type: "COMPLETE_GROUP",
        group_id: "complex1"
      });
      assertStatus(completeComplex, 201, "complete the complex group");

      const eventsAfterComplete = await getEvents(baseUrl, sessionId);
      assert.equal(
        eventsAfterComplete.length,
        eventsBeforeComplete.length + 1,
        "COMPLETE_GROUP must insert exactly one runtime_events row, not one per member"
      );
      assert.equal(eventsAfterComplete.at(-1).event.type, "COMPLETE_GROUP");
      assert.equal(eventsAfterComplete.at(-1).event.group_id, "complex1");

      const stateAfterComplex = await getState(baseUrl, sessionId);
      for (const exerciseId of ["power_clean", "push_jerk", "thruster"]) {
        assert.ok(
          stateAfterComplex.trace.completed_ids.includes(exerciseId),
          `expected ${exerciseId} to be completed after COMPLETE_GROUP`
        );
        assert.ok(!stateAfterComplex.trace.remaining_ids.includes(exerciseId));
      }

      // --- Replaying COMPLETE_GROUP against an already-resolved group must
      //     be rejected, not silently re-applied. ---
      const replayCompleteComplex = await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
        type: "COMPLETE_GROUP",
        group_id: "complex1"
      });
      assertStatus(replayCompleteComplex, 409, "replaying COMPLETE_GROUP against a resolved group must be rejected");
      assert.equal(replayCompleteComplex.json.details?.failure_token, "phase6_runtime_resolved_group_replay");

      // --- The AMRAP group is now current, and also bundled as one step. ---
      const stateBeforeAmrap = await getState(baseUrl, sessionId);
      assert.equal(stateBeforeAmrap.current_step?.type, "GROUP_WORKOUT", "expected the amrap group to surface as a bundled step");
      assert.equal(stateBeforeAmrap.current_step.group_type, "amrap");
      assert.equal(stateBeforeAmrap.current_step.time_cap_seconds, 720);
      assert.deepEqual(
        stateBeforeAmrap.current_step.exercises.map((exercise) => exercise.exercise_id),
        ["toes_to_bar", "pull_up"]
      );

      // --- An AMRAP result with an out-of-shape field must be rejected. ---
      const badAmrapResult = await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
        type: "AMRAP_RESULT_REPORT",
        group_id: "amrapA",
        rounds_completed: 5,
        extra_reps: 3,
        notes: "felt great"
      });
      assertStatus(badAmrapResult, 400, "an AMRAP result with an unlisted key must be rejected");
      assert.equal(badAmrapResult.json.details?.failure_token, "phase6_runtime_group_result_report_invalid_shape");

      // --- AMRAP_RESULT_REPORT resolves both remaining members at once, with
      //     exactly one new runtime_events row. ---
      const eventsBeforeAmrap = await getEvents(baseUrl, sessionId);

      const amrapResult = await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
        type: "AMRAP_RESULT_REPORT",
        group_id: "amrapA",
        rounds_completed: 6,
        extra_reps: 4
      });
      assertStatus(amrapResult, 201, "submit the amrap result");

      const eventsAfterAmrap = await getEvents(baseUrl, sessionId);
      assert.equal(
        eventsAfterAmrap.length,
        eventsBeforeAmrap.length + 1,
        "AMRAP_RESULT_REPORT must insert exactly one runtime_events row, not one per member"
      );
      assert.equal(eventsAfterAmrap.at(-1).event.rounds_completed, 6);
      assert.equal(eventsAfterAmrap.at(-1).event.extra_reps, 4);

      const terminalState = await getState(baseUrl, sessionId);
      for (const exerciseId of ["toes_to_bar", "pull_up"]) {
        assert.ok(terminalState.trace.completed_ids.includes(exerciseId));
      }
      assert.ok(
        terminalState.execution_status === "completed" || terminalState.execution_status === "partial",
        `expected a terminal execution_status, received ${terminalState.execution_status}`
      );
      assert.equal(terminalState.current_step, null, "no remaining exercises means no current_step");

      // --- Fresh-process recovery: a brand new server process must
      //     reconstruct the exact same terminal state from the database alone. ---
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
