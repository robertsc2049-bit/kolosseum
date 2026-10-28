// A coach is told when an athlete finishes a block of their programme - and
// when they finish the whole programme - so its block report is ready to send
// (product_notification_service.ts: athlete_block_completed). Nothing comes
// mid-block, nothing before the block's last session is actually done, one
// notification per block however often the coach's bell refreshes, and the
// athlete never gets it.
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
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function request(baseUrl, method, route, body, options = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (options.cookie) headers.cookie = options.cookie;
  if (options.csrf) headers["x-kolosseum-csrf"] = options.csrf;
  const response = await fetch(`${baseUrl}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { response, text, json };
}

function sessionCookie(result, label) {
  const values = typeof result.response.headers.getSetCookie === "function"
    ? result.response.headers.getSetCookie()
    : [result.response.headers.get("set-cookie")].filter(Boolean);
  const session = values.find((value) => String(value).startsWith("kolosseum_session="));
  assert.ok(session, `${label}: expected session cookie`);
  return String(session).split(";")[0];
}

function assertStatus(result, status, label) {
  assert.equal(result.response.status, status, `${label}: expected ${status}, received ${result.response.status}. raw=${result.text}`);
}

function workItems() {
  return [["back_squat", 75], ["bench_press", 75]].map(([exerciseId, percent], index) => ({
    work_item_id: "", order_index: index + 1, exercise_id: exerciseId, planned_sets: 3, rep_mode: "fixed", planned_reps: 5, rep_min: 5, rep_max: 5,
    load_mode: "percent_1rm", percent_1rm: percent, weight_value: 20, weight_unit: "kg", rest_seconds: 180, role: index === 0 ? "primary" : "accessory",
    coaching_notes: "", segment: "working", group_id: "", group_type: "straight"
  }));
}

// Accumulation: two weeks, one session each. Intensification: one week.
function blocks() {
  const week = (n, title) => ({ week_id: "", order_index: n, sessions: [{ session_id: "", order_index: 1, title, work_items: workItems() }] });
  return [
    { block_id: "", order_index: 1, name: "Accumulation", description: "", block_type: "strength", week_count: 2, weeks: [week(1, "Volume 1"), week(2, "Volume 2")] },
    { block_id: "", order_index: 2, name: "Intensification", description: "", block_type: "strength", week_count: 1, weeks: [week(1, "Heavy")] }
  ];
}

const STAGES = ["activity", "experience_level", "training_plan", "execution_scope", "product_acknowledgement", "jurisdiction", "accessibility", "instruction_density", "review"];

test("a coach is told their athlete finished a block, then the programme - once each, and only once the last session is done", { timeout: 180000 }, async (testContext) => {
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  const userIds = [];
  const server = await listen();
  testContext.after(async () => {
    await closeServer(server);
    const ids = userIds.filter(Boolean);
    await pool.query("DELETE FROM product_notifications WHERE recipient_user_id = ANY($1::text[])", [ids]).catch(() => {});
    for (const userId of ids) {
      await pool.query("DELETE FROM sessions WHERE beta_subject_user_id = $1", [userId]).catch(() => {});
      for (const table of ["product_account_events", "product_auth_sessions", "product_auth_challenges", "product_accounts"]) await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]).catch(() => {});
    }
    await pool.query("DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])", [ids]).catch(() => {});
    await pool.end();
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const coach = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach", display_name: "Block Report Coach", email: `block_report_coach_${nonce}@example.com`, password: "BlockReportCoach!2026",
    accepted_terms: true, accepted_consent: true, accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1", date_of_birth: "1985-01-15"
  });
  assertStatus(coach, 201, "coach registration");
  const coachUserId = coach.json.account.user_id;
  userIds.push(coachUserId);
  const coachAuth = { cookie: sessionCookie(coach, "coach"), csrf: coach.json.csrf_token };

  const athlete = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete", display_name: "Block Report Lifter", email: `block_report_athlete_${nonce}@example.com`, password: "BlockReportLifter!2026", activity_id: "general_strength",
    accepted_terms: true, accepted_consent: true, accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1", date_of_birth: "1994-01-15"
  });
  assertStatus(athlete, 201, "athlete registration");
  const athleteUserId = athlete.json.account.user_id;
  userIds.push(athleteUserId);
  const athleteAuth = { cookie: sessionCookie(athlete, "athlete"), csrf: athlete.json.csrf_token };

  const fields = {
    activity_id: "general_strength", experience_level: "amateur", execution_scope: "coach_managed", product_acknowledged: true,
    jurisdiction_code: "england_wales", jurisdiction_acknowledged: true,
    accessibility_preferences: { larger_text: false, high_contrast: false, reduced_motion: false, screen_reader_optimised: false },
    instruction_density: "standard", training_days_per_week: 3
  };
  for (const stage of STAGES.slice(1)) assertStatus(await request(baseUrl, "PATCH", "/account/onboarding/draft", { current_stage: stage, fields }, athleteAuth), 200, `onboarding ${stage}`);
  assertStatus(await request(baseUrl, "POST", "/account/onboarding/confirm", { review_confirmed: true }, athleteAuth), 200, "confirm onboarding");

  const at = new Date().toISOString();
  assertStatus(await request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
    relationship_id: `block_report_relationship_${nonce}`, coach_user_id: coachUserId, athlete_user_id: athleteUserId,
    relationship_state: "accepted", relationship_scope: "individual_coach_athlete", accepted_at_iso8601: at, created_at_iso8601: at,
    updated_at_iso8601: at, revoked_at_iso8601: null, expires_at_iso8601: null
  }), 201, "relationship");
  await request(baseUrl, "POST", "/coach-workspace/athlete-strength-profile", {
    coach_user_id: coachUserId, athlete_user_id: athleteUserId, preferred_weight_unit: "kg", load_rounding_increment: 2.5, bodyweight: 80, bodyweight_unit: "kg",
    benchmarks: [["back_squat", 140], ["bench_press", 100]].map(([exercise_id, value]) => ({
      benchmark_id: "", exercise_id, value, unit: "kg", basis: "tested_1rm", effective_date: at.slice(0, 10), source_note: "block report proof"
    })),
    expected_current_record_sha256: null
  }, coachAuth);

  const saved = await request(baseUrl, "POST", "/templates", {
    coach_user_id: coachUserId, template_version: 1, template_name: `Strength block ${nonce}`, description: "Two blocks.",
    activity_id: "general_strength", event_plan: null, blocks: blocks(), updated_at_iso8601: new Date().toISOString()
  });
  assertStatus(saved, 201, "save the programme");
  const templateId = saved.json.template.template_id;
  assertStatus(await request(baseUrl, "POST", `/templates/${templateId}/complete`, { coach_user_id: coachUserId }), 200, "complete");
  const active = await request(baseUrl, "POST", `/templates/${templateId}/activate`, { coach_user_id: coachUserId });
  assertStatus(active, 200, "activate");
  assertStatus(await request(baseUrl, "POST", "/coach-workspace/athlete-assignment", {
    request_id: `block_report_assignment_${nonce}`, requested_at_iso8601: new Date().toISOString(),
    coach_user_id: coachUserId, athlete_user_id: athleteUserId, template_id: active.json.template.template_id, activity_id: "general_strength", event_id: ""
  }, coachAuth), 201, "assign the programme");

  const declared = await request(baseUrl, "GET", "/account/detail", undefined, athleteAuth);
  const phase1Input = declared.json.bootstrap.declaration_record.engine_phase1_input;
  const nextSession = async (expectedIndex) => {
    const compiled = await request(baseUrl, "POST", "/blocks/compile?create_session=true&beta_path=true", {
      phase1_input: phase1Input, beta_user_id: athleteUserId, beta_coach_user_id: coachUserId
    });
    assertStatus(compiled, 201, `session ${expectedIndex + 1}`);
    assert.equal(compiled.json.planned_session.template_position.template_session_index, expectedIndex);
    return compiled.json;
  };
  const finish = async (compiled) => {
    const sessionId = compiled.session_id;
    await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/start`, {});
    for (const exercise of compiled.planned_session.exercises) {
      assertStatus(await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, { type: "COMPLETE_EXERCISE", exercise_id: exercise.exercise_id }), 201, `complete ${exercise.exercise_id}`);
    }
  };
  const blockNotifications = async (auth) => {
    const list = await request(baseUrl, "GET", "/account/notifications", undefined, auth);
    assertStatus(list, 200, "notifications");
    return list.json.notifications.filter((n) => n.notification_type === "athlete_block_completed");
  };

  // Week 1 of Accumulation done: mid-block, nothing yet.
  await finish(await nextSession(0));
  assert.deepEqual(await blockNotifications(coachAuth), [], "no report is due mid-block");

  // The block's last session, started but not finished: still nothing.
  const lastOfBlock = await nextSession(1);
  assert.deepEqual(await blockNotifications(coachAuth), [], "not until the session is done");

  await finish(lastOfBlock);
  let notifications = await blockNotifications(coachAuth);
  assert.equal(notifications.length, 1, "Accumulation finished");
  assert.deepEqual(notifications[0].notification_payload, { athlete_user_id: athleteUserId, block_name: "Accumulation", programme_finished: false });
  assert.deepEqual(notifications[0].deep_link, { route_id: "coach_progress_overview", params: { athlete_id: athleteUserId, report: "block" } }, "opens the athlete's block report in Analysis");
  assert.equal(notifications[0].target_available, true);

  // The programme's last session: the whole programme is finished.
  await finish(await nextSession(2));
  notifications = await blockNotifications(coachAuth);
  assert.equal(notifications.length, 2);
  const finished = notifications.find((n) => n.notification_payload.programme_finished === true);
  assert.ok(finished, "programme finished");
  assert.equal(finished.notification_payload.block_name, "Intensification");
  assert.equal(finished.deep_link.params.report, "programme", "opens the programme report");

  // However often the bell refreshes: one per block.
  assert.equal((await blockNotifications(coachAuth)).length, 2, "no duplicates");
  // The athlete never gets these.
  assert.deepEqual(await blockNotifications(athleteAuth), []);
});
