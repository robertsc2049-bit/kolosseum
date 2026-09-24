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

async function registerAccount(baseUrl, actorType, label, nonce, activityId) {
  const registration = await request(baseUrl, "POST", "/account/register", {
    actor_type: actorType,
    display_name: label,
    email: `${label.toLowerCase().replaceAll(/[^a-z0-9]/gu, "_")}_${nonce}@example.com`,
    password: "Full83ActivityChange!2026",
    activity_id: activityId,
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
  const coach = await registerAccount(baseUrl, "coach", label, nonce, null);
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

function accessibilityPreferences() {
  return { reduced_motion: false, high_contrast: false, larger_text: false, screen_reader_optimised: false };
}

async function completeAthleteOnboarding(baseUrl, athlete, activityId) {
  const draft = await request(
    baseUrl,
    "PATCH",
    "/account/onboarding/draft",
    {
      current_stage: "review",
      fields: {
        activity_id: activityId,
        execution_scope: "coach_managed",
        product_acknowledged: true,
        jurisdiction_code: "england_wales",
        jurisdiction_acknowledged: true,
        accessibility_preferences: accessibilityPreferences(),
        instruction_density: "standard"
      }
    },
    { cookie: athlete.cookie, csrf: athlete.csrf }
  );
  assertStatus(draft, 200, "athlete onboarding draft");

  const confirm = await request(
    baseUrl,
    "POST",
    "/account/onboarding/confirm",
    { review_confirmed: true },
    { cookie: athlete.cookie, csrf: athlete.csrf }
  );
  assertStatus(confirm, 200, "athlete onboarding confirm");
  return confirm.json;
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
  assertStatus(result, 201, "coach-athlete relationship");
}

function workItems() {
  return [["back_squat", 40], ["bench_press", 30]].map(([exerciseId, weight], index) => ({
    work_item_id: "",
    order_index: index + 1,
    exercise_id: exerciseId,
    planned_sets: 3,
    rep_mode: "fixed",
    planned_reps: 5,
    rep_min: 5,
    rep_max: 5,
    load_mode: "fixed_weight",
    weight_value: weight,
    weight_unit: "kg",
    rest_seconds: 120,
    role: index === 0 ? "primary" : "accessory",
    coaching_notes: "",
    segment: "working",
    group_id: "",
    group_type: "straight"
  }));
}

function blockWithSessions() {
  return {
    block_id: "",
    order_index: 1,
    name: "Full-83 Block",
    description: "",
    block_type: "general",
    week_count: 1,
    weeks: [{
      week_id: "",
      order_index: 1,
      sessions: [{ session_id: "", order_index: 1, title: "Session 1", work_items: workItems() }]
    }]
  };
}

async function createActivatedTemplate(baseUrl, coachUserId, name) {
  const saved = await request(baseUrl, "POST", "/templates", {
    coach_user_id: coachUserId,
    template_version: 1,
    template_name: name,
    description: "FULL-UI-83 activity-change proof.",
    activity_id: "crossfit",
    event_plan: null,
    blocks: [blockWithSessions()],
    updated_at_iso8601: new Date().toISOString()
  });
  assertStatus(saved, 201, `${name}: draft save`);
  const template = saved.json.template;

  assertStatus(
    await request(baseUrl, "POST", `/templates/${encodeURIComponent(template.template_id)}/complete`, { coach_user_id: coachUserId }),
    200, `${name}: complete`
  );
  assertStatus(
    await request(baseUrl, "POST", `/templates/${encodeURIComponent(template.template_id)}/activate`, { coach_user_id: coachUserId }),
    200, `${name}: activate`
  );
  return template;
}

function phase1Input(activityId) {
  return {
    consent_granted: true,
    engine_version: "EB2-1.0.0",
    enum_bundle_version: "EB2-1.0.0",
    phase1_schema_version: "1.0.0",
    actor_type: "athlete",
    execution_scope: "individual",
    activity_id: activityId,
    nd_mode: false,
    instruction_density: "standard",
    exposure_prompt_density: "standard",
    bias_mode: "none"
  };
}

async function createInProgressSession(baseUrl, coach, athleteUserId, nonce) {
  const template = await createActivatedTemplate(baseUrl, coach.userId, `Full83 Programme ${nonce}`);

  const assignment = await request(
    baseUrl, "POST", "/coach-workspace/athlete-assignment",
    {
      request_id: `full_ui_83_request_${nonce}`,
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
    baseUrl, "POST", "/blocks/compile?create_session=true&beta_path=true",
    { phase1_input: phase1Input("crossfit"), beta_user_id: athleteUserId, beta_coach_user_id: coach.userId }
  );
  assertStatus(compiled, 201, "compile session");
  const sessionId = compiled.json.session_id;
  assert.ok(sessionId, "expected a created session id");

  assertStatus(await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/start`, {}), 200, "start session");
  return sessionId;
}

async function getState(baseUrl, sessionId) {
  const result = await request(baseUrl, "GET", `/sessions/${encodeURIComponent(sessionId)}/state`);
  assertStatus(result, 200, "get session state");
  return result.json;
}

async function driveSessionToTerminal(baseUrl, sessionId) {
  for (let i = 0; i < 10; i += 1) {
    const probe = await getState(baseUrl, sessionId);
    if (!probe.current_step) break;
    const exerciseId = probe.current_step.exercise?.exercise_id;
    assert.ok(exerciseId, "expected an exercise_id on the current step");
    await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, { type: "COMPLETE_EXERCISE", exercise_id: exerciseId });
  }
}

async function getOnboardingState(baseUrl, athlete) {
  const result = await request(baseUrl, "GET", "/account/onboarding/", undefined, { cookie: athlete.cookie });
  assertStatus(result, 200, "get onboarding state");
  return result.json;
}

async function getActivityChangeState(baseUrl, athlete) {
  const result = await request(baseUrl, "GET", "/account/onboarding/activity-change", undefined, { cookie: athlete.cookie });
  assertStatus(result, 200, "get activity-change state");
  return result.json.activity_change;
}

test(
  "FULL-UI-83 athlete activity change: self-service immediate, self-service deferred-until-session-completion, and coach-proposed decline/confirm",
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
        await pool.query("DELETE FROM product_notifications WHERE recipient_user_id = $1", [userId]).catch(() => {});
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

      const coach = await setUpCoach(baseUrl, "Full83 Coach", nonce);
      userIds.push(coach.userId);

      const athlete = await registerAccount(baseUrl, "athlete", "Full83 Athlete", nonce, "powerlifting");
      userIds.push(athlete.userId);

      await completeAthleteOnboarding(baseUrl, athlete, "powerlifting");
      await connectRelationship(baseUrl, coach.userId, athlete.userId, `relationship_${nonce}`, timestamp);

      // --- 1. Self-service, immediate. ---
      const immediateChange = await request(
        baseUrl, "PATCH", "/account/onboarding/activity",
        { new_activity_id: "crossfit", apply_at: "immediately" },
        { cookie: athlete.cookie, csrf: athlete.csrf }
      );
      assertStatus(immediateChange, 200, "self-service immediate activity change");
      assert.equal(immediateChange.json.request_state, "applied");

      const afterImmediate = await getOnboardingState(baseUrl, athlete);
      assert.equal(afterImmediate.current_effective_declaration.fields.activity_id, "crossfit");
      assert.equal(afterImmediate.current_effective_declaration.declaration_version, 2);

      // --- 2. Self-service, deferred until the athlete's current session finishes. ---
      const sessionId = await createInProgressSession(baseUrl, coach, athlete.userId, nonce);
      sessionIds.push(sessionId);

      const deferredChange = await request(
        baseUrl, "PATCH", "/account/onboarding/activity",
        { new_activity_id: "hyrox", apply_at: "after_current_session" },
        { cookie: athlete.cookie, csrf: athlete.csrf }
      );
      assertStatus(deferredChange, 200, "self-service deferred activity change");
      assert.equal(deferredChange.json.request_state, "queued");
      assert.equal(deferredChange.json.queued_for_session_id, sessionId);

      const beforeSessionEnds = await getOnboardingState(baseUrl, athlete);
      assert.equal(beforeSessionEnds.current_effective_declaration.fields.activity_id, "crossfit", "must not change before the queued session finishes");

      const pendingState = await getActivityChangeState(baseUrl, athlete);
      assert.equal(pendingState.request_state, "queued");
      assert.equal(pendingState.new_activity_id, "hyrox");

      await driveSessionToTerminal(baseUrl, sessionId);

      const afterSessionEnds = await getOnboardingState(baseUrl, athlete);
      assert.equal(afterSessionEnds.current_effective_declaration.fields.activity_id, "hyrox", "must change automatically once the queued session finishes");

      const notificationsAfterDeferred = await request(baseUrl, "GET", "/account/notifications", undefined, { cookie: athlete.cookie });
      assertStatus(notificationsAfterDeferred, 200, "list athlete notifications");
      assert.ok(
        notificationsAfterDeferred.json.notifications.some((entry) => entry.notification_type === "activity_change_applied"),
        "expected a courtesy activity_change_applied notification for the deferred change"
      );

      // --- 3. Coach-proposed: decline first, then propose again and confirm. ---
      const proposal = await request(
        baseUrl, "POST", "/coach-workspace/athlete-activity-change-proposal",
        { athlete_user_id: athlete.userId, activity_id: "strongman" },
        { cookie: coach.cookie, csrf: coach.csrf }
      );
      assertStatus(proposal, 201, "coach proposes activity change");
      assert.equal(proposal.json.proposal.request_state, "proposed");

      const stillHyroxAfterProposal = await getOnboardingState(baseUrl, athlete);
      assert.equal(stillHyroxAfterProposal.current_effective_declaration.fields.activity_id, "hyrox", "a proposal alone must never mutate the athlete's declaration");

      const notificationsAfterProposal = await request(baseUrl, "GET", "/account/notifications", undefined, { cookie: athlete.cookie });
      assert.ok(
        notificationsAfterProposal.json.notifications.some((entry) => entry.notification_type === "activity_change_proposed"),
        "expected an activity_change_proposed notification"
      );

      const decline = await request(
        baseUrl, "POST", "/account/onboarding/activity-proposal-response",
        { request_id: proposal.json.proposal.request_id, response: "declined" },
        { cookie: athlete.cookie, csrf: athlete.csrf }
      );
      assertStatus(decline, 200, "athlete declines the proposal");
      assert.equal(decline.json.request_state, "declined");

      const afterDecline = await getOnboardingState(baseUrl, athlete);
      assert.equal(afterDecline.current_effective_declaration.fields.activity_id, "hyrox", "a decline must not change the declaration");

      const secondProposal = await request(
        baseUrl, "POST", "/coach-workspace/athlete-activity-change-proposal",
        { athlete_user_id: athlete.userId, activity_id: "strongman" },
        { cookie: coach.cookie, csrf: coach.csrf }
      );
      assertStatus(secondProposal, 201, "coach proposes a second activity change");

      const confirm = await request(
        baseUrl, "POST", "/account/onboarding/activity-proposal-response",
        { request_id: secondProposal.json.proposal.request_id, response: "confirmed", apply_at: "immediately" },
        { cookie: athlete.cookie, csrf: athlete.csrf }
      );
      assertStatus(confirm, 200, "athlete confirms the proposal");
      assert.equal(confirm.json.request_state, "applied");

      const afterConfirm = await getOnboardingState(baseUrl, athlete);
      assert.equal(afterConfirm.current_effective_declaration.fields.activity_id, "strongman");

      // --- 4. Fresh-process recovery. ---
      await closeServer(server);
      server = await listen();
      address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;

      const freshOnboardingState = await getOnboardingState(baseUrl, athlete);
      assert.equal(freshOnboardingState.current_effective_declaration.fields.activity_id, "strongman");
    }
    finally {
      await closeServer(server);
      await cleanup();
    }
  }
);
