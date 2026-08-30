// DEV NOTE: Progress graphs slice 3 - coach roster-wide progress rollup
// lifecycle proof. Proves GET /progress-insights/coach-roster returns one
// entry per accepted (non-expired, non-revoked) athlete with real
// computed insights, excludes a revoked relationship entirely (it never
// even reaches getProgressInsightsForCoach - listConnectedCoachAthletes
// filters it out first), returns an empty roster (not an error) for a
// coach with zero accepted athletes, and is rejected outright for an
// unauthenticated caller or a non-coach account. The per-athlete metric
// computation itself (all 4 metric shapes, series included) is already
// exhaustively proven by
// test/full_ui_36_progress_insights_persistent.integration.test.mjs -
// this test only proves the NEW roster-aggregation behavior layered on
// top of it.

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
    baseUrl, "POST", "/account/coach-onboarding/complete",
    { completion_confirmed: true },
    { cookie, csrf }
  ), 200, `${label} coach onboarding complete`);

  return { userId: result.json?.account?.user_id ?? "", email, cookie, csrf };
}

async function registerAthlete(baseUrl, nonce, label) {
  const email = `roster_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Roster ${label} Athlete`,
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

async function compileAndCompleteSession(baseUrl, coach, athlete) {
  const compiled = await request(
    baseUrl,
    "POST",
    "/blocks/compile?create_session=true&beta_path=true",
    {
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
    }
  );
  assertStatus(compiled, 201, "compile session");
  const sessionId = compiled.json.session_id;
  assert.ok(sessionId, "expected a created session id");

  assertStatus(await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/start`, {}), 201, "start session");
  assertStatus(
    await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
      type: "COMPLETE_EXERCISE", exercise_id: "back_squat"
    }),
    201,
    "complete back_squat"
  );

  return sessionId;
}

test(
  "Coach roster progress rollup: one entry per accepted athlete with real computed insights, a revoked relationship excluded, an empty roster for a coach with no athletes, and rejection for non-coach/unauthenticated callers",
  async (testContext) => {
    const root = repoRoot();
    void root;
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);

    let server = null;
    const coachUserIds = [];
    const athleteUserIds = [];
    const sessionIds = [];

    const cleanup = async () => {
      const allUserIds = [...coachUserIds, ...athleteUserIds].filter(Boolean);
      for (const sessionId of sessionIds) {
        await pool.query("DELETE FROM session_event_requests WHERE session_id = $1", [sessionId]).catch(() => {});
        await pool.query("DELETE FROM runtime_events WHERE session_id = $1", [sessionId]).catch(() => {});
        await pool.query("DELETE FROM session_event_seq WHERE session_id = $1", [sessionId]).catch(() => {});
      }
      if (allUserIds.length > 0) {
        await pool.query(
          `DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])`,
          [allUserIds]
        ).catch(() => {});
      }
      for (const userId of allUserIds) {
        await pool.query("DELETE FROM product_account_events WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_challenges WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_accounts WHERE user_id = $1", [userId]).catch(() => {});
      }
    };

    testContext.after(async () => {
      await closeServer(server);
      await cleanup();
    });

    server = await listen();
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const coach = await registerCoach(baseUrl, nonce, "a");
    coachUserIds.push(coach.userId);
    const strangerCoach = await registerCoach(baseUrl, nonce, "b");
    coachUserIds.push(strangerCoach.userId);

    const athleteWithData = await registerAthlete(baseUrl, nonce, "1");
    athleteUserIds.push(athleteWithData.userId);
    const athleteWithoutData = await registerAthlete(baseUrl, nonce, "2");
    athleteUserIds.push(athleteWithoutData.userId);
    const revokedAthlete = await registerAthlete(baseUrl, nonce, "3");
    athleteUserIds.push(revokedAthlete.userId);

    await seedRelationship(baseUrl, {
      relationshipId: `roster_rel_1_${nonce}`, coachUserId: coach.userId, athleteUserId: athleteWithData.userId, state: "accepted"
    });
    await seedRelationship(baseUrl, {
      relationshipId: `roster_rel_2_${nonce}`, coachUserId: coach.userId, athleteUserId: athleteWithoutData.userId, state: "accepted"
    });
    await seedRelationship(baseUrl, {
      relationshipId: `roster_rel_3_${nonce}`, coachUserId: coach.userId, athleteUserId: revokedAthlete.userId, state: "revoked"
    });

    const template = await createActivatedTemplate(baseUrl, coach.userId, `Roster Rollup Programme ${nonce}`);
    assertStatus(
      await request(
        baseUrl,
        "POST",
        "/coach-workspace/athlete-assignment",
        {
          request_id: `roster_rollup_request_${nonce}`,
          requested_at_iso8601: new Date().toISOString(),
          coach_user_id: coach.userId,
          athlete_user_id: athleteWithData.userId,
          template_id: template.template_id,
          activity_id: "powerlifting",
          event_id: ""
        },
        { cookie: coach.cookie, csrf: coach.csrf }
      ),
      201,
      "athlete assignment"
    );

    const sessionId = await compileAndCompleteSession(baseUrl, coach, athleteWithData);
    sessionIds.push(sessionId);

    // ============================================================
    // A coach with two accepted athletes (one with real session data,
    // one with none) and one revoked relationship (excluded entirely).
    // ============================================================
    const rosterResult = await request(baseUrl, "GET", "/progress-insights/coach-roster", undefined, { cookie: coach.cookie });
    assertStatus(rosterResult, 200, "coach reads roster progress rollup");
    const roster = rosterResult.json?.roster;
    assert.ok(Array.isArray(roster), "expected roster to be an array");
    assert.equal(roster.length, 2, "expected exactly the two accepted (non-revoked) athletes");

    const revokedEntry = roster.find((entry) => entry.athlete_user_id === revokedAthlete.userId);
    assert.equal(revokedEntry, undefined, "a revoked relationship's athlete must never appear in the roster");

    const withDataEntry = roster.find((entry) => entry.athlete_user_id === athleteWithData.userId);
    assert.ok(withDataEntry, "expected an entry for the athlete with real session data");
    assert.equal(withDataEntry.display_name, "Roster 1 Athlete");
    assert.ok(withDataEntry.insights, "expected non-null insights for the athlete with real data");
    assert.equal(withDataEntry.insights.session_adherence.total_sessions, 1, "adherence: total_sessions");
    assert.equal(withDataEntry.insights.session_adherence.completed_sessions, 1, "adherence: completed_sessions");
    assert.equal(withDataEntry.insights.session_adherence.adherence_percentage, 100, "adherence: adherence_percentage");
    assert.equal(withDataEntry.insights.session_adherence.series.length, 6, "adherence: series has 6 windows");
    const currentWindow = withDataEntry.insights.session_adherence.series[5];
    assert.equal(currentWindow.total_sessions, 1, "adherence series: current window total_sessions");
    assert.equal(currentWindow.window_end_date, daysAgoDateOnly(0), "adherence series: current window ends today");

    const withoutDataEntry = roster.find((entry) => entry.athlete_user_id === athleteWithoutData.userId);
    assert.ok(withoutDataEntry, "expected an entry for the athlete with no session data");
    assert.equal(withoutDataEntry.display_name, "Roster 2 Athlete");
    assert.ok(withoutDataEntry.insights, "an athlete with zero sessions still gets a real (zero-filled) insights object, not null");
    assert.equal(withoutDataEntry.insights.session_adherence.total_sessions, 0);
    assert.equal(withoutDataEntry.insights.session_adherence.has_sufficient_data, false);
    assert.equal(withoutDataEntry.insights.session_adherence.series.length, 6);

    // ============================================================
    // A coach with zero accepted athletes gets an empty roster - not an
    // error.
    // ============================================================
    const strangerRosterResult = await request(baseUrl, "GET", "/progress-insights/coach-roster", undefined, { cookie: strangerCoach.cookie });
    assertStatus(strangerRosterResult, 200, "stranger coach reads their (empty) roster progress rollup");
    assert.deepEqual(strangerRosterResult.json?.roster, [], "expected an empty roster array, not an error");

    // ============================================================
    // Non-coach and unauthenticated callers are rejected outright.
    // ============================================================
    const athleteCallerResult = await request(baseUrl, "GET", "/progress-insights/coach-roster", undefined, { cookie: athleteWithData.cookie });
    assertStatus(athleteCallerResult, 403, "an athlete account cannot read the coach roster progress rollup");

    const unauthenticatedResult = await request(baseUrl, "GET", "/progress-insights/coach-roster", undefined, {});
    assertStatus(unauthenticatedResult, 401, "an unauthenticated caller cannot read the coach roster progress rollup");
  }
);
