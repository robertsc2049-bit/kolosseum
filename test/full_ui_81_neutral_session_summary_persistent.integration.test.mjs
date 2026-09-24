// DEV NOTE: FULL-UI-81 neutral session summary, real-Postgres proof: a real
// athlete and a real linked coach (both authenticated via the real
// product-account session cookie, mirroring full_ui_23's modern registration
// pattern rather than full_ui_16c's older cookie-less beta-only athlete
// identity) fetch GET /sessions/:sessionId/summary for a real, compiled and
// partially-executed session; an unrelated athlete/coach and an
// unauthenticated caller are rejected.
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

  const cookie = values.find((value) => String(value).startsWith("kolosseum_session="));
  assert.ok(cookie, `${label}: expected session cookie`);
  return String(cookie).split(";")[0];
}

async function registerAccount(baseUrl, actorType, label, nonce) {
  const registration = await request(baseUrl, "POST", "/account/register", {
    actor_type: actorType,
    display_name: label,
    email: `${label.toLowerCase().replaceAll(/[^a-z0-9]/gu, "_")}_${nonce}@example.com`,
    password: "FullUi81SessionSummary!2026",
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

  return coach;
}

async function connectRelationship(baseUrl, coachUserId, athleteUserId, relationshipId, timestamp) {
  const result = await request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
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
  assertStatus(result, 201, "connect athlete (accepted relationship)");
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
      source_note: "FULL-UI-81 session summary proof"
    })),
    expected_current_record_sha256: null
  }, { cookie: coach.cookie, csrf: coach.csrf }), 201, "strength profile");
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
    role: index === 0 ? "primary" : "accessory",
    coaching_notes: "",
    segment: "working",
    group_id: "",
    group_type: "straight"
  }));
}

async function createActivatedTemplate(baseUrl, coachUserId, name) {
  const saved = await request(baseUrl, "POST", "/templates", {
    coach_user_id: coachUserId,
    template_version: 1,
    template_name: name,
    description: "FULL-UI-81 session summary proof.",
    activity_id: "powerlifting",
    event_plan: null,
    blocks: [{
      block_id: "",
      order_index: 1,
      name: "Full-UI-81 Block",
      description: "",
      block_type: "strength",
      week_count: 1,
      weeks: [{
        week_id: "",
        order_index: 1,
        sessions: [{ session_id: "", order_index: 1, title: "Session 1", work_items: workItems() }]
      }]
    }],
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

async function assignTemplate(baseUrl, coach, athleteUserId, templateId, nonce) {
  const assignment = await request(
    baseUrl,
    "POST",
    "/coach-workspace/athlete-assignment",
    {
      request_id: `full_ui_81_request_${nonce}`,
      requested_at_iso8601: new Date().toISOString(),
      coach_user_id: coach.userId,
      athlete_user_id: athleteUserId,
      template_id: templateId,
      activity_id: "powerlifting",
      event_id: ""
    },
    { cookie: coach.cookie, csrf: coach.csrf }
  );
  assertStatus(assignment, 201, "athlete assignment");
  return assignment.json.assignment;
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

async function compileSession(baseUrl, coachUserId, athleteUserId) {
  const compiled = await request(baseUrl, "POST", "/blocks/compile?create_session=true&beta_path=true", {
    phase1_input: phase1Input(),
    beta_user_id: athleteUserId,
    beta_coach_user_id: coachUserId
  });
  assertStatus(compiled, 201, "compile session");
  const sessionId = compiled.json.session_id;
  assert.ok(sessionId, "expected a created session id");
  return sessionId;
}

async function getSummary(baseUrl, sessionId, options) {
  return request(baseUrl, "GET", `/sessions/${encodeURIComponent(sessionId)}/summary`, undefined, options);
}

test(
  "FULL-UI-81 neutral session summary: real athlete/coach access, cross-account rejection, unauthenticated/non-existent handling, and fresh-process restart reconstruction",
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

      const coach = await setUpCoach(baseUrl, "Full81 Coach", nonce);
      userIds.push(coach.userId);
      const athlete = await registerAccount(baseUrl, "athlete", "Full81 Athlete", nonce);
      userIds.push(athlete.userId);

      const otherCoach = await setUpCoach(baseUrl, "Full81 Other Coach", nonce);
      userIds.push(otherCoach.userId);
      const otherAthlete = await registerAccount(baseUrl, "athlete", "Full81 Other Athlete", nonce);
      userIds.push(otherAthlete.userId);

      await connectRelationship(baseUrl, coach.userId, athlete.userId, `relationship_${nonce}`, timestamp);
      await setUpStrengthProfile(baseUrl, coach, athlete.userId);

      const template = await createActivatedTemplate(baseUrl, coach.userId, `Full81 Programme ${nonce}`);
      await assignTemplate(baseUrl, coach, athlete.userId, template.template_id, nonce);

      const sessionId = await compileSession(baseUrl, coach.userId, athlete.userId);
      sessionIds.push(sessionId);

      // --- Real, partial execution: one exercise completed plus a real
      //     extra-work report against it, one skipped, one split then
      //     return-continue, one left remaining. ---
      assertStatus(await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/start`, {}), 200, "session start");

      assertStatus(
        await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
          type: "COMPLETE_EXERCISE", exercise_id: "back_squat"
        }),
        201,
        "complete back_squat"
      );
      assertStatus(
        await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
          type: "EXTRA_SET_REPORT", exercise_id: "back_squat", reps: 3
        }),
        201,
        "extra set report on back_squat"
      );
      assertStatus(
        await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
          type: "COMPLETE_EXERCISE", exercise_id: "bench_press"
        }),
        201,
        "complete bench_press"
      );
      assertStatus(
        await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
          type: "SKIP_EXERCISE", exercise_id: "deadlift", reason_code: "time_constraint"
        }),
        201,
        "skip deadlift"
      );
      assertStatus(
        await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, { type: "SPLIT_SESSION" }),
        201,
        "split session"
      );
      assertStatus(
        await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, { type: "RETURN_CONTINUE" }),
        201,
        "return-continue"
      );

      const rawEvents = await request(baseUrl, "GET", `/sessions/${encodeURIComponent(sessionId)}/events`);
      assertStatus(rawEvents, 200, "raw runtime events");
      const expectedEventCount = rawEvents.json.events.length;
      assert.ok(expectedEventCount > 0, "expected at least one recorded runtime event");

      function assertSummaryShape(summary) {
        assert.deepEqual(
          Object.keys(summary).sort(),
          [
            "completed_at_utc", "extra_work_event_count", "prescribed_items_completed",
            "prescribed_items_remaining", "prescribed_items_skipped", "prescribed_items_total",
            "return_continue_count", "return_skip_count", "run_id", "runtime_event_count",
            "session_id", "split_event_count", "started_at_utc", "status"
          ].sort()
        );
        for (const bannedKey of ["score", "quality", "readiness", "recommendation", "trend", "risk"]) {
          assert.ok(!Object.prototype.hasOwnProperty.call(summary, bannedKey), `unexpected banned key: ${bannedKey}`);
        }
        assert.equal(summary.session_id, sessionId);
        assert.equal(summary.run_id, sessionId);
        assert.equal(summary.prescribed_items_total, 4);
        assert.equal(summary.prescribed_items_completed, 2);
        assert.equal(summary.prescribed_items_skipped, 1);
        assert.equal(summary.prescribed_items_remaining, 1);
        assert.equal(summary.extra_work_event_count, 1);
        assert.equal(summary.split_event_count, 1);
        assert.equal(summary.return_continue_count, 1);
        assert.equal(summary.return_skip_count, 0);
        assert.equal(summary.runtime_event_count, expectedEventCount);
        assert.equal(summary.status, "in_progress");
      }

      // --- As the owning athlete. ---
      const asAthlete = await getSummary(baseUrl, sessionId, { cookie: athlete.cookie });
      assertStatus(asAthlete, 200, "summary as owning athlete");
      assertSummaryShape(asAthlete.json);

      // --- As the linked coach - same data. ---
      const asCoach = await getSummary(baseUrl, sessionId, { cookie: coach.cookie });
      assertStatus(asCoach, 200, "summary as linked coach");
      assertSummaryShape(asCoach.json);
      assert.deepEqual(asCoach.json, asAthlete.json);

      // --- As an unrelated athlete/coach - forbidden. ---
      const asOtherAthlete = await getSummary(baseUrl, sessionId, { cookie: otherAthlete.cookie });
      assertStatus(asOtherAthlete, 403, "summary as unrelated athlete");

      const asOtherCoach = await getSummary(baseUrl, sessionId, { cookie: otherCoach.cookie });
      assertStatus(asOtherCoach, 403, "summary as unrelated coach");

      // --- Unauthenticated - real existing session requires a session
      //     cookie once ownership is confirmed to exist. ---
      const unauthenticated = await getSummary(baseUrl, sessionId, {});
      assertStatus(unauthenticated, 401, "summary unauthenticated");

      // --- Non-existent session - 404 regardless of authentication. ---
      const missing = await getSummary(baseUrl, `${sessionId}_does_not_exist`, {});
      assertStatus(missing, 404, "summary for a non-existent session");

      // --- Fresh-process restart reconstruction. ---
      await closeServer(server);
      server = await listen();
      address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;

      const afterRestart = await getSummary(baseUrl, sessionId, { cookie: athlete.cookie });
      assertStatus(afterRestart, 200, "summary after restart");
      assertSummaryShape(afterRestart.json);
    }
    finally {
      await closeServer(server);
      await cleanup();
    }
  }
);
