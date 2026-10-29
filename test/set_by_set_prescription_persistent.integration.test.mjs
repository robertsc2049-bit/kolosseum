// Set by set (beta18_programme_template_service.ts set_plan): a coach writes
// a lift as "5 @ 50%, 4 @ 60%, 2 x 3 @ 70%, 3+ @ 75%" - each set its own reps
// and load - and puts the same lift in the session a second time (Boring But
// Big's 5 x 10). The athlete's session gets every set's own weight from their
// max, the repeat as its own exercise (back_squat__r2), and each logs
// separately.
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

const base = { coaching_notes: "", segment: "working", group_id: "", group_type: "straight", rest_seconds: 180, weight_value: 20, weight_unit: "kg" };
const squatBySet = {
  ...base, work_item_id: "", order_index: 1, exercise_id: "back_squat", planned_sets: 5, rep_mode: "fixed", planned_reps: 5, rep_min: 5, rep_max: 5,
  load_mode: "percent_1rm", percent_1rm: 50, role: "primary",
  set_plan: [{ sets: 1, reps: 5, value: 50 }, { sets: 1, reps: 4, value: 60 }, { sets: 2, reps: 3, value: 70 }, { sets: 1, reps: 3, value: 75, amrap: true }]
};
const squatFiveByTen = {
  ...base, work_item_id: "", order_index: 2, exercise_id: "back_squat", planned_sets: 5, rep_mode: "fixed", planned_reps: 10, rep_min: 10, rep_max: 10,
  load_mode: "percent_1rm", percent_1rm: 50, role: "accessory"
};

const STAGES = ["activity", "experience_level", "training_plan", "execution_scope", "product_acknowledgement", "jurisdiction", "accessibility", "instruction_density", "review"];

test("a lift written set by set reaches the athlete with each set's own weight, and the same lift again is its own exercise", { timeout: 180000 }, async (testContext) => {
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  const userIds = [];
  const server = await listen();
  testContext.after(async () => {
    await closeServer(server);
    const ids = userIds.filter(Boolean);
    for (const userId of ids) {
      await pool.query("DELETE FROM sessions WHERE beta_subject_user_id = $1", [userId]).catch(() => {});
      for (const table of ["product_account_events", "product_auth_sessions", "product_auth_challenges", "product_accounts"]) await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]).catch(() => {});
    }
    await pool.query("DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])", [ids]).catch(() => {});
    await pool.end();
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const coach = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach", display_name: "Set Plan Coach", email: `set_plan_coach_${nonce}@example.com`, password: "SetPlanCoach!2026",
    accepted_terms: true, accepted_consent: true, accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1", date_of_birth: "1985-01-15"
  });
  assertStatus(coach, 201, "coach registration");
  const coachUserId = coach.json.account.user_id;
  userIds.push(coachUserId);
  const coachAuth = { cookie: sessionCookie(coach, "coach"), csrf: coach.json.csrf_token };

  const athlete = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete", display_name: "Set Plan Lifter", email: `set_plan_athlete_${nonce}@example.com`, password: "SetPlanLifter!2026", activity_id: "general_strength",
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
    relationship_id: `set_plan_relationship_${nonce}`, coach_user_id: coachUserId, athlete_user_id: athleteUserId,
    relationship_state: "accepted", relationship_scope: "individual_coach_athlete", accepted_at_iso8601: at, created_at_iso8601: at,
    updated_at_iso8601: at, revoked_at_iso8601: null, expires_at_iso8601: null
  }), 201, "relationship");
  await request(baseUrl, "POST", "/coach-workspace/athlete-strength-profile", {
    coach_user_id: coachUserId, athlete_user_id: athleteUserId, preferred_weight_unit: "kg", load_rounding_increment: 2.5, bodyweight: 80, bodyweight_unit: "kg",
    benchmarks: [{ benchmark_id: "", exercise_id: "back_squat", value: 140, unit: "kg", basis: "tested_1rm", effective_date: at.slice(0, 10), source_note: "set plan proof" }],
    expected_current_record_sha256: null
  }, coachAuth);

  // Bad plans are refused.
  const save = (workItems, name) => request(baseUrl, "POST", "/templates", {
    coach_user_id: coachUserId, template_version: 1, template_name: name, description: "", activity_id: "general_strength", event_plan: null,
    blocks: [{ block_id: "", order_index: 1, name: "Block", description: "", block_type: "strength", week_count: 1, weeks: [{ week_id: "", order_index: 1, sessions: [{ session_id: "", order_index: 1, title: "Squat", work_items: workItems }] }] }],
    updated_at_iso8601: new Date().toISOString()
  });
  const tooHeavy = await save([{ ...squatBySet, set_plan: [{ sets: 1, reps: 5, value: 120 }] }], `Too heavy ${nonce}`);
  assert.equal(tooHeavy.response.status, 400);
  assert.match(tooHeavy.text, /set_plan_value_invalid/u);
  const withRange = await save([{ ...squatBySet, load_range_mode: "range", percent_1rm_max: 80 }], `With range ${nonce}`);
  assert.match(withRange.text, /set_plan_with_range/u);

  const saved = await save([squatBySet, squatFiveByTen], `Set by set ${nonce}`);
  assertStatus(saved, 201, "save the programme");
  const stored = saved.json.template.template_structure.blocks[0].weeks[0].days[0].sessions[0].work_items;
  assert.equal(stored[0].planned_sets, 5, "the plan's sets in all");
  assert.deepEqual(stored[0].loading_reference, { type: "percent_1rm", value: 50, maximum: 75 }, "the load range is the plan's lowest to highest");
  assert.equal(stored[0].set_plan.length, 4);
  assert.equal(stored[1].exercise_id, "back_squat", "the same lift again is stored as itself");

  const templateId = saved.json.template.template_id;
  assertStatus(await request(baseUrl, "POST", `/templates/${templateId}/complete`, { coach_user_id: coachUserId }), 200, "complete");
  const active = await request(baseUrl, "POST", `/templates/${templateId}/activate`, { coach_user_id: coachUserId });
  assertStatus(active, 200, "activate");
  assertStatus(await request(baseUrl, "POST", "/coach-workspace/athlete-assignment", {
    request_id: `set_plan_assignment_${nonce}`, requested_at_iso8601: new Date().toISOString(),
    coach_user_id: coachUserId, athlete_user_id: athleteUserId, template_id: active.json.template.template_id, activity_id: "general_strength", event_id: ""
  }, coachAuth), 201, "assign the programme");

  const declared = await request(baseUrl, "GET", "/account/detail", undefined, athleteAuth);
  const compiled = await request(baseUrl, "POST", "/blocks/compile?create_session=true&beta_path=true", {
    phase1_input: declared.json.bootstrap.declaration_record.engine_phase1_input, beta_user_id: athleteUserId, beta_coach_user_id: coachUserId
  });
  assertStatus(compiled, 201, "session");
  const working = compiled.json.planned_session.exercises.filter((exercise) => exercise.segment === "working");
  const bySet = working.find((exercise) => exercise.exercise_id === "back_squat");
  const repeat = working.find((exercise) => exercise.exercise_id === "back_squat__r2");
  assert.ok(bySet && repeat, `both squats are in the session: ${working.map((e) => e.exercise_id).join(", ")}`);

  assert.equal(bySet.sets, 5);
  assert.deepEqual(
    bySet.set_targets.map((target) => [target.set_index, target.reps, target.resolved_load.value, target.amrap === true]),
    [[1, 5, 70, false], [2, 4, 85, false], [3, 3, 97.5, false], [4, 3, 97.5, false], [5, 3, 105, true]],
    "50/60/70/70/75% of a 140 kg squat, rounded to 2.5 kg; the last set as many as they can"
  );
  assert.equal(repeat.sets, 5);
  assert.equal(repeat.reps, 10);
  assert.equal(repeat.resolved_load.value, 70, "the 5 x 10 at 50% of the same max");
  assert.equal(repeat.set_targets, undefined);

  // Each logs on its own.
  const sessionId = compiled.json.session_id;
  await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/start`, {});
  for (const [exerciseId, setIndex, reps, load] of [["back_squat", 2, 4, 85], ["back_squat__r2", 1, 10, 70]]) {
    assertStatus(await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
      type: "SET_LOG_REPORT", client_request_id: crypto.randomUUID(), exercise_id: exerciseId, set_index: setIndex, reps, load_value: load, load_unit: "kg"
    }), 201, `log ${exerciseId} set ${setIndex}`);
  }
});
