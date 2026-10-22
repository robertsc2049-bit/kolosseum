// A coach's programme meets the fixture list. Two lifters on their coach's
// programme (squat at 75% of a 160 kg max): Paddy's match is tomorrow, so his
// "Squat day" leaves the heavy legs out; Liam played yesterday, so his squat
// is a recovery dose and the weight he's told to lift drops with it. The
// coach's review says why.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";

const STAGES = ["activity", "experience_level", "training_plan", "execution_scope", "product_acknowledgement", "jurisdiction", "accessibility", "instruction_density", "review"];
const day = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

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
const ok = (result, status, label) => { assert.equal(result.status, status, `${label}: ${result.text}`); return result; };

test("a coach's Squat day the day before a match leaves the heavy legs out; the day after, the squat is a lighter recovery dose", { timeout: 120000 }, async (t) => {
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const userIds = [];
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    for (const userId of userIds) {
      await pool.query("DELETE FROM sessions WHERE beta_subject_user_id = $1", [userId]).catch(() => {});
      for (const table of ["product_account_events", "product_auth_sessions", "product_auth_challenges", "product_accounts"]) await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]).catch(() => {});
    }
    await pool.query("DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.end();
  });
  const register = async (c, actorType, name, extra = {}) => {
    const email = `match_week_${name}_${nonce}@example.com`;
    ok(await c.req("POST", "/account/register", {
      actor_type: actorType, display_name: name, email, password: "MatchWeekTest!2026", date_of_birth: "1994-06-06",
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
  const item = (exercise_id, i, pct) => ({
    work_item_id: "", order_index: i + 1, exercise_id, planned_sets: 4, rep_mode: "fixed", planned_reps: 5, rep_min: 5, rep_max: 5,
    load_mode: pct ? "percent_1rm" : "rpe", percent_1rm: pct ?? 75, weight_value: 20, weight_unit: "kg", rpe_value: 8, rest_seconds: 180,
    role: i ? "accessory" : "primary", coaching_notes: "", segment: "working", group_id: "", group_type: "straight"
  });
  const saved = ok(await coach.req("POST", "/templates", {
    coach_user_id: coachAccount.userId, template_version: 1, template_name: `MD-4 strength ${nonce}`, description: "", activity_id: "powerlifting",
    blocks: [{ block_id: "", order_index: 1, name: "In-season", description: "", block_type: "strength", week_count: 1,
      weeks: [{ week_id: "", order_index: 1, sessions: [{ session_id: "", order_index: 1, title: "Squat day", coaching_notes: "", work_items: [item("back_squat", 0, 75), item("bench_press", 1)] }] }] }],
    updated_at_iso8601: new Date().toISOString()
  }), 201, "programme");
  const templateId = saved.json.template.template_id;
  ok(await coach.req("POST", `/templates/${templateId}/complete`, { coach_user_id: coachAccount.userId }), 200, "complete");
  ok(await coach.req("POST", `/templates/${templateId}/activate`, { coach_user_id: coachAccount.userId }), 200, "activate");

  const lifter = async (name, tpl = templateId) => {
    const athlete = client(baseUrl);
    const account = await register(athlete, "athlete", name, { activity_id: "powerlifting" });
    const fields = { activity_id: "powerlifting", experience_level: "amateur", execution_scope: "coach_managed", product_acknowledged: true, jurisdiction_code: "england_wales", jurisdiction_acknowledged: true, training_days_per_week: 3, no_fixed_date: true, accessibility_preferences: { larger_text: false, high_contrast: false, reduced_motion: false, screen_reader_optimised: false }, instruction_density: "standard" };
    for (const stage of STAGES.slice(1)) await athlete.req("PATCH", "/account/onboarding/draft", { current_stage: stage, fields });
    ok(await athlete.req("POST", "/account/onboarding/confirm", { review_confirmed: true }), 200, `${name} onboarded`);
    ok(await coach.req("POST", "/coach-workspace/relationship-invitations", { athlete_email: account.email }), 201, `${name} invited`);
    await athlete.refresh();
    const invitations = (await athlete.req("GET", "/coach-workspace/relationship-invitations")).json;
    const relationshipId = (invitations.invitations ?? invitations.records ?? invitations.relationships ?? [])[0]?.relationship_id;
    ok(await athlete.req("POST", `/coach-workspace/relationship-invitations/${encodeURIComponent(relationshipId)}/accept`, {}), 201, `${name} accepts`);
    ok(await coach.req("POST", "/coach-workspace/athlete-assignment", {
      request_id: `match_week_${name}_${nonce}`, requested_at_iso8601: new Date().toISOString(), coach_user_id: coachAccount.userId,
      athlete_user_id: account.userId, template_id: tpl, activity_id: "powerlifting", event_id: ""
    }), 201, `${name} assigned`);
    await coach.refresh();
    ok(await coach.req("POST", "/coach-workspace/athlete-strength-profile", {
      coach_user_id: coachAccount.userId, athlete_user_id: account.userId, preferred_weight_unit: "kg", load_rounding_increment: 2.5, bodyweight: 90, bodyweight_unit: "kg",
      benchmarks: [{ benchmark_id: "", exercise_id: "back_squat", value: 160, unit: "kg", basis: "tested_1rm", effective_date: day(-3), source_note: "" }],
      expected_current_record_sha256: null
    }), 201, `${name} maxes`);
    return { athlete, account };
  };
  const session = async ({ athlete, account }) => {
    const detail = await athlete.refresh();
    return athlete.req("POST", "/blocks/compile?create_session=true&beta_path=true", { phase1_input: detail.bootstrap.declaration_record.engine_phase1_input, beta_user_id: account.userId, beta_coach_user_id: coachAccount.userId });
  };

  // Paddy: the match is tomorrow.
  const paddy = await lifter("paddy");
  ok(await paddy.athlete.req("PUT", "/account/onboarding/match-week", { match_days: [], fixtures: [{ date: day(1), label: "v Northside" }] }), 200, "fixture");
  const dayBefore = ok(await session(paddy), 201, "Paddy's session the day before").json.planned_session;
  assert.deepEqual(dayBefore.exercises.filter((e) => !e.segment || e.segment === "working").map((e) => e.exercise_id), ["bench_press"], "no squat the day before the match");
  assert.equal(dayBefore.match_week.role, "day_before");

  // Liam: he played yesterday (and logged it).
  const liam = await lifter("liam");
  ok(await liam.athlete.req("PUT", "/account/onboarding/match-week", { match_days: [], fixtures: [{ date: day(-1), label: "v Northside" }] }), 200, "fixture");
  const dayAfter = ok(await session(liam), 201, "Liam's session the day after").json.planned_session;
  const squat = dayAfter.exercises.find((e) => e.exercise_id === "back_squat");
  assert.deepEqual([squat.sets, squat.intensity.value], [2, 60], "half the sets, 15 points lighter");
  assert.equal(squat.resolved_load.value, 95, "and the weight follows: 60% of 160 kg, not the 120 kg of 75%");
  assert.equal(dayAfter.match_week.role, "day_after");

  // Will: his coach logs a hamstring strain, out of training. No session until
  // it's moved on; on modified training he trains with a reminder.
  const will = await lifter("will");
  const injuries = `/coach-workspace/athletes/${will.account.userId}/injuries`;
  const logged = ok(await coach.req("POST", injuries, { area: "thigh_back", side: "left", type: "muscle", mechanism: "non_contact", context: "training", status: "out", expected_return: day(14), client_request_id: `inj_${nonce}_will` }), 200, "hamstring logged").json;
  const refused = await session(will);
  assert.equal(refused.status, 400);
  assert.equal(refused.json.details.failure_token, "injury_out", "out of training means no session");
  assert.equal(refused.json.details.details.injury, "left hamstring (muscle strain)");
  const status = ok(await will.athlete.req("GET", "/account/onboarding/injury-status"), 200, "his own injury status").json;
  assert.deepEqual([status.injury.status, status.injury.name], ["out", "left hamstring (muscle strain)"]);
  ok(await coach.req("POST", `${injuries}/${logged.injury.id}/status`, { status: "modified", client_request_id: `inj_${nonce}_will_mod` }), 200, "moved on to modified");
  const modified = ok(await session(will), 201, "a session on modified training").json.planned_session;
  assert.equal(modified.injury_modified.injury, "left hamstring (muscle strain)");

  // Ollie played yesterday and plays again tomorrow, and his next session is
  // the coach's power day (jumps, front squats): the day before the match
  // drops the heavy legs, the day after drops the jumps - nothing is left,
  // so he's told to rest rather than given an empty session.
  const power = ok(await coach.req("POST", "/templates", {
    coach_user_id: coachAccount.userId, template_version: 1, template_name: `MD-2 power ${nonce}`, description: "", activity_id: "powerlifting",
    blocks: [{ block_id: "", order_index: 1, name: "In-season", description: "", block_type: "strength", week_count: 1,
      weeks: [{ week_id: "", order_index: 1, sessions: [{ session_id: "", order_index: 1, title: "Power day", coaching_notes: "", work_items: [item("front_squat", 0), item("countermovement_jump", 1)] }] }] }],
    updated_at_iso8601: new Date().toISOString()
  }), 201, "power programme").json.template.template_id;
  ok(await coach.req("POST", `/templates/${power}/complete`, { coach_user_id: coachAccount.userId }), 200, "complete power");
  ok(await coach.req("POST", `/templates/${power}/activate`, { coach_user_id: coachAccount.userId }), 200, "activate power");
  const ollie = await lifter("ollie", power);
  ok(await ollie.athlete.req("PUT", "/account/onboarding/match-week", { match_days: [], fixtures: [{ date: day(1), label: "v Eastside" }] }), 200, "fixture tomorrow");
  ok(await ollie.athlete.req("POST", "/account/onboarding/other-training", { date: day(0), kind: "match", minutes: 80, srpe: 8, note: "v Northside", client_request_id: `ot_${nonce}_ollie` }), 200, "today's match logged");
  const rest = await session(ollie);
  assert.equal(rest.status, 400, rest.text);
  assert.equal(rest.json.details.failure_token, "sport_load_rest", "rest, not an empty session");
});
