// An athlete who finishes a block of their coach's programme earns the
// block-complete award (GET /account/onboarding/block-awards): once, when its
// last session is done, kept when the programme is taken away. A one-week
// block and a block ended with nothing trained earn nothing.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";

const STAGES = ["activity", "experience_level", "training_plan", "execution_scope", "product_acknowledgement", "jurisdiction", "accessibility", "instruction_density", "review"];

function client(baseUrl) {
  const jar = new Map();
  let csrf = "";
  async function req(method, route, body) {
    const headers = { origin: baseUrl };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (jar.size) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    if (csrf && method !== "GET") headers["x-kolosseum-csrf"] = csrf;
    const response = await fetch(baseUrl + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const i = pair.indexOf("=");
      jar.set(pair.slice(0, i).trim(), pair.slice(i + 1));
    }
    const text = await response.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch {}
    return { status: response.status, json, text };
  }
  async function refresh() {
    const detail = await req("GET", "/account/detail");
    csrf = detail.json?.csrf_token ?? csrf;
    return detail.json;
  }
  return { req, refresh };
}

function ok(result, status, label) {
  assert.equal(result.status, status, `${label}: expected ${status}, received ${result.status}. raw=${result.text}`);
  return result;
}

function item(exerciseId) {
  return {
    work_item_id: "", order_index: 1, exercise_id: exerciseId, planned_sets: 3, rep_mode: "fixed", planned_reps: 5, rep_min: 5, rep_max: 5,
    load_mode: "rpe", percent_1rm: 75, weight_value: 20, weight_unit: "kg", rpe_value: 7, rest_seconds: 120,
    role: "primary", coaching_notes: "", segment: "working", group_id: "", group_type: "straight"
  };
}
const week = (order, exerciseId) => ({ week_id: "", order_index: order, sessions: [{ session_id: "", order_index: 1, title: `Day ${order}`, coaching_notes: "", work_items: [item(exerciseId)] }] });
const block = (order, name, weeks) => ({ block_id: "", order_index: order, name, description: "", block_type: "strength", week_count: weeks.length, weeks });
const blocks = [
  block(1, "Strength block", [week(1, "back_squat"), week(2, "bench_press")]),
  block(2, "Easy week", [week(1, "back_squat")]),
  block(3, "Left out", [week(1, "back_squat"), week(2, "bench_press")])
];

test("finishing a block earns its award once, and it stays earned", { timeout: 120000 }, async (testContext) => {
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const userIds = [];
  testContext.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    for (const userId of userIds) {
      await pool.query("DELETE FROM sessions WHERE beta_subject_user_id = $1", [userId]).catch(() => {});
      for (const table of ["product_account_events", "product_auth_sessions", "product_auth_challenges", "product_accounts"]) await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]).catch(() => {});
    }
    await pool.query("DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.end();
  });
  const register = async (c, actorType, name, extra = {}) => {
    const email = `block_award_${name}_${nonce}@example.com`;
    ok(await c.req("POST", "/account/register", {
      actor_type: actorType, display_name: name, email, password: "BlockAwardTest!2026", date_of_birth: "1994-06-06",
      accepted_terms: true, accepted_consent: true, accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1", ...extra
    }), 201, `register ${name}`);
    const detail = await c.refresh();
    userIds.push(detail.account.user_id);
    return { email, userId: detail.account.user_id };
  };

  const coach = client(baseUrl);
  const coachAccount = await register(coach, "coach", "coach");
  for (const [method, route, body] of [
    ["PATCH", "/account/coach-onboarding/profile", { display_name: "Coach", email: coachAccount.email }],
    ["POST", "/account/coach-onboarding/terms", { accepted: true, terms_version: "terms_v1" }],
    ["PATCH", "/account/coach-onboarding/accessibility", { accessibility_preferences: { larger_text: false, high_contrast: false, reduced_motion: false, screen_reader_optimised: false } }],
    ["POST", "/account/coach-onboarding/complete", { completion_confirmed: true }]
  ]) await coach.req(method, route, body);
  const saved = ok(await coach.req("POST", "/templates", {
    coach_user_id: coachAccount.userId, template_version: 1, template_name: `Award prep ${nonce}`, description: "", activity_id: "powerlifting", adjust_for_breaks: true, blocks,
    updated_at_iso8601: new Date().toISOString()
  }), 201, "save programme");
  const templateId = saved.json.template.template_id;
  ok(await coach.req("POST", `/templates/${templateId}/complete`, { coach_user_id: coachAccount.userId }), 200, "complete");
  ok(await coach.req("POST", `/templates/${templateId}/activate`, { coach_user_id: coachAccount.userId }), 200, "activate");

  const athlete = client(baseUrl);
  const athleteAccount = await register(athlete, "athlete", "lifter", { activity_id: "powerlifting" });
  const fields = {
    activity_id: "powerlifting", experience_level: "amateur", execution_scope: "coach_managed", product_acknowledged: true,
    jurisdiction_code: "england_wales", jurisdiction_acknowledged: true, training_days_per_week: 3, no_fixed_date: true,
    accessibility_preferences: { larger_text: false, high_contrast: false, reduced_motion: false, screen_reader_optimised: false }, instruction_density: "standard"
  };
  for (const stage of STAGES.slice(1)) await athlete.req("PATCH", "/account/onboarding/draft", { current_stage: stage, fields });
  ok(await athlete.req("POST", "/account/onboarding/confirm", { review_confirmed: true }), 200, "confirm onboarding");
  assert.equal(ok(await athlete.req("GET", "/account/onboarding/my-programme"), 200, "before any programme").json.status, "none");

  ok(await coach.req("POST", "/coach-workspace/relationship-invitations", { athlete_email: athleteAccount.email }), 201, "invite");
  await athlete.refresh();
  const invitations = (await athlete.req("GET", "/coach-workspace/relationship-invitations")).json;
  const relationshipId = (invitations.invitations ?? invitations.records ?? invitations.relationships ?? [])[0]?.relationship_id;
  ok(await athlete.req("POST", `/coach-workspace/relationship-invitations/${encodeURIComponent(relationshipId)}/accept`, {}), 201, "accept");
  ok(await coach.req("POST", "/coach-workspace/athlete-assignment", {
    request_id: `block_award_${nonce}`, requested_at_iso8601: new Date().toISOString(), coach_user_id: coachAccount.userId,
    athlete_user_id: athleteAccount.userId, template_id: templateId, activity_id: "powerlifting", event_id: ""
  }), 201, "assign");
  await coach.refresh();
  const awards = async () => ok(await athlete.req("GET", "/account/onboarding/block-awards"), 200, "awards").json;
  const train = async (complete) => {
    const detail = await athlete.refresh();
    const created = ok(await athlete.req("POST", "/blocks/compile?create_session=true&beta_path=true", {
      phase1_input: detail.bootstrap.declaration_record.engine_phase1_input, beta_user_id: athleteAccount.userId, beta_coach_user_id: coachAccount.userId
    }), 201, "session").json;
    ok(await athlete.req("POST", `/sessions/${created.session_id}/start`, {}), 200, "start");
    for (const exercise of created.planned_session.exercises) {
      ok(await athlete.req("POST", `/sessions/${created.session_id}/events`, { event: complete ? { type: "COMPLETE_EXERCISE", exercise_id: exercise.exercise_id } : { type: "SKIP_EXERCISE", exercise_id: exercise.exercise_id, reason_code: "time_constraint" } }), 201, "exercise");
    }
  };

  assert.deepEqual((await awards()).awards, [], "nothing before training");
  await train(true);
  assert.deepEqual((await awards()).awards, [], "nothing half way through");
  await train(true);
  const earned = await awards();
  assert.equal(earned.athlete_name, "lifter");
  assert.equal(earned.awards.length, 1);
  const { award_id: awardId, finished_at: finishedAt, ...award } = earned.awards[0];
  assert.deepEqual(award, {
    block_name: "Strength block", programme_name: `Award prep ${nonce}`, coach_name: "Coach", source: "coach", weeks: 2, sessions_done: 2, sessions_total: 2
  });
  assert.equal(finishedAt.slice(0, 10), new Date().toISOString().slice(0, 10));
  assert.equal(/percent|1rm|\bkg\b/iu.test(JSON.stringify(earned)), false, "says what was finished, nothing about strength");

  await train(true);
  assert.equal((await awards()).awards.length, 1, "a one-week block earns nothing");
  await train(false);
  await train(false);
  assert.equal((await awards()).awards.length, 1, "a block ended with nothing trained earns nothing");

  // Taken away: still theirs, and the same one.
  const assignmentId = (await pool.query(
    `SELECT record_payload->>'assignment_id' AS id FROM beta_product_records
     WHERE record_type = 'beta17_assignment_trigger' AND subject_user_id = $1 ORDER BY created_at DESC LIMIT 1`, [athleteAccount.userId])).rows[0].id;
  await pool.query("DELETE FROM beta_product_records WHERE record_type = 'beta17_assignment_trigger' AND record_payload->>'assignment_id' = $1", [assignmentId]);
  assert.deepEqual((await awards()).awards.map((entry) => entry.award_id), [awardId]);

  // Only their own; a coach has none, and signed out gets nothing.
  assert.equal((await coach.req("GET", "/account/onboarding/block-awards")).status >= 400, true, "athlete-only");
  assert.equal((await client(baseUrl).req("GET", "/account/onboarding/block-awards")).status, 401);
});
