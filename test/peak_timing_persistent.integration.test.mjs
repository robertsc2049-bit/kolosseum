// A coach's meet prep is timed to the athlete's meet: a powerlifter whose
// meet is 16 days away when her coach assigns a six-week prep (five build
// weeks and a taper week) starts at week 4, so the taper lands in meet week -
// not three weeks after it - and the taper never starts early
// (src/api/peak_timing.ts).
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import test from "node:test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";

function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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

function sessionCookie(result, label) {
  const values =
    typeof result.response.headers.getSetCookie === "function"
      ? result.response.headers.getSetCookie()
      : [result.response.headers.get("set-cookie")].filter(Boolean);

  const session = values.find((value) => String(value).startsWith("kolosseum_session="));
  assert.ok(session, `${label}: expected session cookie`);
  return String(session).split(";")[0];
}

function assertStatus(result, status, label) {
  assert.equal(
    result.response.status,
    status,
    `${label}: expected ${status}, received ${result.response.status}. raw=${result.text}`
  );
}

function dateOnlyFromNow(offset) {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
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


function prepBlocks() {
  const week = (n, title) => ({ week_id: "", order_index: n, sessions: [{ session_id: "", order_index: 1, title, work_items: workItems() }] });
  return [
    { block_id: "", order_index: 1, name: "Build", description: "", block_type: "strength", week_count: 5, weeks: [1, 2, 3, 4, 5].map((n) => week(n, `Week ${n}`)) },
    { block_id: "", order_index: 2, name: "Taper and meet", description: "", block_type: "deload", week_count: 1, weeks: [week(1, "Taper")] }
  ];
}

const STAGES = ["activity", "experience_level", "training_plan", "execution_scope", "product_acknowledgement", "jurisdiction", "accessibility", "instruction_density", "review"];

test("a powerlifter whose meet is 16 days away starts her coach's six-week prep at week 4, then week 5 - the missed build weeks go - never tapers early, and comes back lighter after 15 days ill", { timeout: 180000 }, async (testContext) => {
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  const userIds = [];
  const server = await listen();
  testContext.after(async () => {
    await closeServer(server);
    for (const userId of userIds.filter(Boolean)) {
      await pool.query("DELETE FROM sessions WHERE beta_subject_user_id = $1", [userId]).catch(() => {});
      for (const table of ["product_account_events", "product_auth_sessions", "product_auth_challenges", "product_accounts"]) await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]).catch(() => {});
    }
    await pool.query("DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])", [userIds.filter(Boolean)]).catch(() => {});
    await pool.end();
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const coach = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach", display_name: "Peak Timing Coach", email: `peak_timing_coach_${nonce}@example.com`, password: "PeakTimingCoach!2026",
    accepted_terms: true, accepted_consent: true, accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1", date_of_birth: "1985-01-15"
  });
  assertStatus(coach, 201, "coach registration");
  const coachUserId = coach.json.account.user_id;
  userIds.push(coachUserId);
  const coachAuth = { cookie: sessionCookie(coach, "coach"), csrf: coach.json.csrf_token };

  const athlete = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete", display_name: "Peak Timing Lifter", email: `peak_timing_athlete_${nonce}@example.com`, password: "PeakTimingLifter!2026", activity_id: "powerlifting",
    accepted_terms: true, accepted_consent: true, accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1", date_of_birth: "1994-01-15"
  });
  assertStatus(athlete, 201, "athlete registration");
  const athleteUserId = athlete.json.account.user_id;
  userIds.push(athleteUserId);
  const athleteAuth = { cookie: sessionCookie(athlete, "athlete"), csrf: athlete.json.csrf_token };

  // Her meet, declared in her training plan: 16 days away.
  const meet = dateOnlyFromNow(16);
  const fields = {
    activity_id: "powerlifting", experience_level: "amateur", execution_scope: "coach_managed", product_acknowledged: true,
    jurisdiction_code: "england_wales", jurisdiction_acknowledged: true,
    accessibility_preferences: { larger_text: false, high_contrast: false, reduced_motion: false, screen_reader_optimised: false },
    instruction_density: "standard", training_days_per_week: 4, competition_date: meet, competition_event: "full_power"
  };
  for (const stage of STAGES.slice(1)) assertStatus(await request(baseUrl, "PATCH", "/account/onboarding/draft", { current_stage: stage, fields }, athleteAuth), 200, `onboarding ${stage}`);
  assertStatus(await request(baseUrl, "POST", "/account/onboarding/confirm", { review_confirmed: true }, athleteAuth), 200, "confirm onboarding");

  const at = new Date().toISOString();
  assertStatus(await request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
    relationship_id: `peak_timing_relationship_${nonce}`, coach_user_id: coachUserId, athlete_user_id: athleteUserId,
    relationship_state: "accepted", relationship_scope: "individual_coach_athlete", accepted_at_iso8601: at, created_at_iso8601: at,
    updated_at_iso8601: at, revoked_at_iso8601: null, expires_at_iso8601: null
  }), 201, "relationship");
  await request(baseUrl, "POST", "/coach-workspace/athlete-strength-profile", {
    coach_user_id: coachUserId, athlete_user_id: athleteUserId, preferred_weight_unit: "kg", load_rounding_increment: 2.5, bodyweight: 70, bodyweight_unit: "kg",
    benchmarks: [["back_squat", 140], ["bench_press", 85], ["deadlift", 170], ["overhead_press", 55]].map(([exercise_id, value]) => ({
      benchmark_id: "", exercise_id, value, unit: "kg", basis: "tested_1rm", effective_date: dateOnlyFromNow(0), source_note: "peak timing proof"
    })),
    expected_current_record_sha256: null
  }, coachAuth);

  const saved = await request(baseUrl, "POST", "/templates", {
    coach_user_id: coachUserId, template_version: 1, template_name: `Meet prep ${nonce}`, description: "Six-week meet prep.",
    activity_id: "powerlifting", event_plan: null, blocks: prepBlocks(), updated_at_iso8601: new Date().toISOString()
  });
  assertStatus(saved, 201, "save the prep");
  const templateId = saved.json.template.template_id;
  assertStatus(await request(baseUrl, "POST", `/templates/${templateId}/complete`, { coach_user_id: coachUserId }), 200, "complete");
  const active = await request(baseUrl, "POST", `/templates/${templateId}/activate`, { coach_user_id: coachUserId });
  assertStatus(active, 200, "activate");
  assertStatus(await request(baseUrl, "POST", "/coach-workspace/athlete-assignment", {
    request_id: `peak_timing_assignment_${nonce}`, requested_at_iso8601: new Date().toISOString(),
    coach_user_id: coachUserId, athlete_user_id: athleteUserId, template_id: active.json.template.template_id, activity_id: "powerlifting", event_id: ""
  }, coachAuth), 201, "assign the prep");

  const declared = await request(baseUrl, "GET", "/account/detail", undefined, athleteAuth);
  const phase1Input = declared.json.bootstrap.declaration_record.engine_phase1_input;
  const compile = () => request(baseUrl, "POST", "/blocks/compile?create_session=true&beta_path=true", {
    phase1_input: phase1Input, beta_user_id: athleteUserId, beta_coach_user_id: coachUserId
  });

  const first = await compile();
  assertStatus(first, 201, "first session");
  assert.equal(first.json.planned_session.template_position.template_session_index, 3, "week 4 of 6: weeks 1-3 dropped");
  assert.deepEqual(first.json.planned_session.template_position.peak_timing, { adjustment: "skipped", weeks: 3, competition_date: meet });


  const second = await compile();
  assertStatus(second, 201, "second session");
  assert.equal(second.json.planned_session.template_position.template_session_index, 4, "week 5 follows week 4, not week 2");

  // Racing through the build in one day: with the meet still 16 days out the
  // taper would come too early, so week 5 repeats.
  const third = await compile();
  assertStatus(third, 201, "third session");
  assert.equal(third.json.planned_session.template_position.template_session_index, 4, "week 5 again");
  assert.equal(third.json.planned_session.template_position.peak_timing.adjustment, "held");

  // Then ill for 15 days: her first session back on her coach's programme is
  // a lighter re-entry session - a set fewer - never the next one unchanged.
  await pool.query("UPDATE sessions SET created_at = created_at - interval '15 days' WHERE beta_subject_user_id = $1", [athleteUserId]);
  const back = await compile();
  assertStatus(back, 201, "back after 15 days");
  assert.equal(back.json.planned_session.template_position.reentry.reentry_week, true);
  assert.ok(back.json.planned_session.template_position.reentry.gap_days >= 15);
  const squat = back.json.planned_session.exercises.find((e) => e.exercise_id === "back_squat");
  assert.deepEqual([squat.sets, squat.reentry_lighter], [3, true], "4 sets of squats become 3");

  // Her coach sees why on the review screen: the skipped weeks, the held
  // week and the lighter week back.
  const reviews = await request(baseUrl, "GET", `/coach-workspace/reviews?coach_user_id=${encodeURIComponent(coachUserId)}`, undefined, coachAuth);
  assertStatus(reviews, 200, "coach reviews");
  const lines = reviews.json.records.flatMap((r) => r.programme_adjustments ?? []);
  assert.ok(lines.some((l) => /^Skipped 3 build weeks so the taper lands in competition week/u.test(l)), JSON.stringify(lines));
  assert.ok(lines.some((l) => /^Repeating the last build week/u.test(l)), JSON.stringify(lines));
  assert.ok(lines.some((l) => /^Back after 1\d days away: a lighter first week/u.test(l)), JSON.stringify(lines));
});
