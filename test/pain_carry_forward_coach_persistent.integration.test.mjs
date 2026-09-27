// DEV NOTE: Pain carry-forward, coach side, over real HTTP and a real database: a coached
// athlete's pain report notifies her coach and opens a flag only that coach can see or clear.
// Server and account helpers mirror coach_progress_rollup_persistent.integration.test.mjs.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";

function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

async function listen() {
  return await new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
    server.once("error", reject);
  });
}

async function closeServer(server) {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
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

function cookieNamed(result, cookieName, label) {
  const values =
    typeof result.response.headers.getSetCookie === "function"
      ? result.response.headers.getSetCookie()
      : [result.response.headers.get("set-cookie")].filter(Boolean);

  const found = values.find((value) => String(value).startsWith(`${cookieName}=`));
  assert.ok(found, `${label}: expected ${cookieName} cookie`);
  return String(found).split(";")[0];
}

function assertStatus(result, status, label) {
  assert.equal(
    result.response.status,
    status,
    `${label}: expected ${status}, received ${result.response.status}. raw=${result.text}`
  );
}

function daysAgoDateOnly(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

async function registerCoach(baseUrl, nonce, label) {
  const email = `roster_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Roster ${label} Coach`,
    email,
    password: `Roster${label}Coach!2026`,
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  assertStatus(result, 201, `${label} coach registration`);
  const cookie = cookieNamed(result, "kolosseum_session", `${label} coach registration`);
  const csrf = result.json?.csrf_token;

  assertStatus(await request(
    baseUrl, "PATCH", "/account/coach-onboarding/profile",
    { display_name: `Roster ${label} Coach`, email },
    { cookie, csrf }
  ), 200, `${label} coach onboarding profile`);

  assertStatus(await request(
    baseUrl, "POST", "/account/coach-onboarding/terms",
    { accepted: true, terms_version: "terms_v1" },
    { cookie, csrf }
  ), 200, `${label} coach onboarding terms`);

  assertStatus(await request(
    baseUrl, "PATCH", "/account/coach-onboarding/accessibility",
    { accessibility_preferences: { reduced_motion: false, high_contrast: false, larger_text: false, screen_reader_optimised: false } },
    { cookie, csrf }
  ), 200, `${label} coach onboarding accessibility`);

  assertStatus(await request(
    baseUrl, "POST", "/account/coach-onboarding/complete",
    { completion_confirmed: true },
    { cookie, csrf }
  ), 200, `${label} coach onboarding complete`);

  return { userId: result.json?.account?.user_id ?? "", email, cookie, csrf };
}

async function registerAthlete(baseUrl, nonce, label) {
  const email = `pain_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Pain ${label} Athlete`,
    email,
    password: `Roster${label}Athlete!2026`,
    activity_id: "powerlifting",
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  assertStatus(result, 201, `${label} athlete registration`);
  return {
    userId: result.json?.account?.user_id ?? "",
    email,
    cookie: cookieNamed(result, "kolosseum_session", `${label} athlete registration`),
    csrf: result.json?.csrf_token
  };
}

async function seedRelationship(baseUrl, { relationshipId, coachUserId, athleteUserId, state }) {
  const now = new Date().toISOString();

  const result = await request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
    relationship_id: relationshipId,
    coach_user_id: coachUserId,
    athlete_user_id: athleteUserId,
    relationship_state: state,
    relationship_scope: "individual_coach_athlete",
    accepted_at_iso8601: state === "accepted" ? now : null,
    created_at_iso8601: now,
    updated_at_iso8601: now,
    revoked_at_iso8601: state === "revoked" ? now : null,
    expires_at_iso8601: null
  });
  assertStatus(result, 201, `seed ${state} relationship ${relationshipId}`);
}

function workItems() {
  return [{
    work_item_id: "",
    order_index: 1,
    exercise_id: "back_squat",
    planned_sets: 3,
    rep_mode: "fixed",
    planned_reps: 5,
    rep_min: 5,
    rep_max: 5,
    load_mode: "percent_1rm",
    percent_1rm: 75,
    weight_value: 20,
    weight_unit: "kg",
    rest_seconds: 120,
    role: "primary",
    coaching_notes: "",
    segment: "working",
    group_id: "",
    group_type: "straight"
  }];
}

function blockWithOneSession() {
  return {
    block_id: "",
    order_index: 1,
    name: "Coach Roster Rollup Block",
    description: "",
    block_type: "strength",
    week_count: 1,
    weeks: [{
      week_id: "",
      order_index: 1,
      // Three sessions, each with the back squat.
      sessions: [1, 2, 3].map((n) => ({
        session_id: "",
        order_index: n,
        title: `Session ${n}`,
        work_items: workItems()
      }))
    }]
  };
}

async function createActivatedTemplate(baseUrl, coachUserId, name) {
  const saved = await request(baseUrl, "POST", "/templates", {
    coach_user_id: coachUserId,
    template_version: 1,
    template_name: name,
    description: "Coach roster rollup proof.",
    activity_id: "powerlifting",
    event_plan: null,
    blocks: [blockWithOneSession()],
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


function compileCoachSession(baseUrl, coach, athlete) {
  return request(baseUrl, "POST", "/blocks/compile?create_session=true&beta_path=true", {
    phase1_input: {
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
    },
    beta_user_id: athlete.userId,
    beta_coach_user_id: coach.userId
  });
}

test(
  "pain carry-forward, coach side: a coached lifter's knee pain notifies her coach, shows as an open flag only her own coach can see, blocks the coach's next squat session until a check-in, and the coach can clear it",
  async (testContext) => {
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
    let server = null;
    const userIds = [];
    const sessionIds = [];

    testContext.after(async () => {
      await closeServer(server);
      for (const sessionId of sessionIds) {
        await pool.query("DELETE FROM session_event_requests WHERE session_id = $1", [sessionId]).catch(() => {});
        await pool.query("DELETE FROM runtime_events WHERE session_id = $1", [sessionId]).catch(() => {});
        await pool.query("DELETE FROM session_event_seq WHERE session_id = $1", [sessionId]).catch(() => {});
      }
      await pool.query(
        `DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])`,
        [userIds]
      ).catch(() => {});
      for (const userId of userIds) {
        await pool.query("DELETE FROM product_notifications WHERE recipient_user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_account_events WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_challenges WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_accounts WHERE user_id = $1", [userId]).catch(() => {});
      }
    });

    server = await listen();
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    const coach = await registerCoach(baseUrl, nonce, "a");
    const strangerCoach = await registerCoach(baseUrl, nonce, "b");
    const athlete = await registerAthlete(baseUrl, nonce, "1");
    userIds.push(coach.userId, strangerCoach.userId, athlete.userId);
    await seedRelationship(baseUrl, {
      relationshipId: `pain_rel_${nonce}`, coachUserId: coach.userId, athleteUserId: athlete.userId, state: "accepted"
    });
    assertStatus(
      await request(baseUrl, "POST", "/coach-workspace/athlete-strength-profile", {
        coach_user_id: coach.userId,
        athlete_user_id: athlete.userId,
        preferred_weight_unit: "kg",
        load_rounding_increment: 2.5,
        bodyweight: null,
        bodyweight_unit: "kg",
        benchmarks: [{
          benchmark_id: `pain_back_squat_${nonce}`,
          exercise_id: "back_squat",
          value: 150,
          unit: "kg",
          basis: "tested_1rm",
          effective_date: daysAgoDateOnly(0),
          source_note: "pain carry-forward proof",
          replaces_reference_id: null
        }],
        expected_current_record_sha256: null
      }, { cookie: coach.cookie, csrf: coach.csrf }),
      201,
      "athlete strength profile"
    );
    const template = await createActivatedTemplate(baseUrl, coach.userId, `Pain Carry-forward Programme ${nonce}`);
    assertStatus(
      await request(baseUrl, "POST", "/coach-workspace/athlete-assignment", {
        request_id: `pain_request_${nonce}`,
        requested_at_iso8601: new Date().toISOString(),
        coach_user_id: coach.userId,
        athlete_user_id: athlete.userId,
        template_id: template.template_id,
        activity_id: "powerlifting",
        event_id: ""
      }, { cookie: coach.cookie, csrf: coach.csrf }),
      201,
      "athlete assignment"
    );

    // Her knee hurts during the coach's back squat.
    const first = await compileCoachSession(baseUrl, coach, athlete);
    assertStatus(first, 201, "first coach session");
    const sessionId = first.json.session_id;
    sessionIds.push(sessionId);
    assert.ok(first.json.planned_session.exercises.some((e) => e.exercise_id === "back_squat"));
    assertStatus(await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/start`, {}), 200, "start");
    assertStatus(
      await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
        type: "PAIN_REPORT", exercise_id: "back_squat", pain_reported: true, pain_area: "knee"
      }),
      201,
      "report knee pain"
    );

    // Her coach is notified, and sees the open flag on her profile.
    const notifications = await request(baseUrl, "GET", "/account/notifications", undefined, { cookie: coach.cookie });
    assertStatus(notifications, 200, "coach notifications");
    const pain = notifications.json.notifications.find((n) => n.notification_type === "athlete_pain_reported");
    assert.ok(pain, "coach notified of the pain report");
    assert.deepEqual(pain.notification_payload, { athlete_user_id: athlete.userId, exercise_id: "back_squat", pain_area: "knee" });
    assert.equal(pain.deep_link.route_id, "coach_athlete_detail");
    assert.equal(pain.deep_link.params.athlete_id, athlete.userId);

    const coachView = await request(baseUrl, "GET", `/pain-flags/coach/${athlete.userId}`, undefined, { cookie: coach.cookie });
    assertStatus(coachView, 200, "coach sees flags");
    assert.deepEqual(coachView.json.flags.map((f) => f.flag_key), ["area:knee"]);
    assert.equal(coachView.json.flags[0].latest_check_in, null);

    // Nobody else's coach can see or clear it.
    assertStatus(await request(baseUrl, "GET", `/pain-flags/coach/${athlete.userId}`, undefined, { cookie: strangerCoach.cookie }), 403, "stranger coach cannot see");
    assertStatus(
      await request(baseUrl, "POST", `/pain-flags/coach/${athlete.userId}/clear`, { flag_key: "area:knee" }, { cookie: strangerCoach.cookie, csrf: strangerCoach.csrf }),
      403,
      "stranger coach cannot clear"
    );
    assertStatus(await request(baseUrl, "GET", `/pain-flags/coach/${athlete.userId}`, undefined, {}), 401, "signed-out cannot see");

    // The coach's next squat session waits for her check-in.
    const refused = await compileCoachSession(baseUrl, coach, athlete);
    assertStatus(refused, 400, "coach session needs a check-in");
    assert.equal(refused.json.details.failure_token, "pain_check_in_required");

    // Her coach assesses it and clears the flag: the session goes ahead as written.
    const cleared = await request(baseUrl, "POST", `/pain-flags/coach/${athlete.userId}/clear`, { flag_key: "area:knee" }, { cookie: coach.cookie, csrf: coach.csrf });
    assertStatus(cleared, 200, "coach clears the flag");
    assert.deepEqual(cleared.json.flags, []);
    assertStatus(
      await request(baseUrl, "POST", `/pain-flags/coach/${athlete.userId}/clear`, { flag_key: "area:knee" }, { cookie: coach.cookie, csrf: coach.csrf }),
      404,
      "a closed flag cannot be cleared again"
    );
    const athleteView = await request(baseUrl, "GET", "/account/onboarding/pain-flags", undefined, { cookie: athlete.cookie });
    assertStatus(athleteView, 200, "athlete flags");
    assert.deepEqual(athleteView.json.flags, []);
    const after = await compileCoachSession(baseUrl, coach, athlete);
    assertStatus(after, 201, "coach session after clearing");
    sessionIds.push(after.json.session_id);
    assert.ok(after.json.planned_session.exercises.some((e) => e.exercise_id === "back_squat"));
  }
);
