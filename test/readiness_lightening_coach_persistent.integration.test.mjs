// A low readiness check-in changes a coached athlete's session only when
// their coach has chosen that rule for them - off by default. Dan and Eve
// both slept badly before squat day. Dan's coach hasn't turned the rule on:
// his session is exactly as written, his check-in recorded for the coach.
// Eve's coach has: her squat is a set shorter and 5% lighter, the weight
// worked out again from her max, and the session says it's her coach's rule.
// Another coach can neither see nor change the setting.
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

test("a coached athlete's bad night lightens the session only when their coach turned that rule on", { timeout: 120000 }, async (t) => {
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const userIds = [];
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    for (const userId of userIds) {
      await pool.query("DELETE FROM sessions WHERE beta_subject_user_id = $1", [userId]).catch(() => {});
      await pool.query("DELETE FROM product_notifications WHERE recipient_user_id = $1", [userId]).catch(() => {});
      for (const table of ["product_account_events", "product_auth_sessions", "product_auth_challenges", "product_accounts"]) await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]).catch(() => {});
    }
    await pool.query("DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.end();
  });
  const register = async (c, actorType, name, extra = {}) => {
    const email = `lighten_${name}_${nonce}@example.com`;
    ok(await c.req("POST", "/account/register", {
      actor_type: actorType, display_name: name, email, password: "LightenTest!2026", date_of_birth: "1994-06-06",
      accepted_terms: true, accepted_consent: true, accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1", ...extra
    }), 201, `register ${name}`);
    const detail = await c.refresh();
    userIds.push(detail.account.user_id);
    return { email, userId: detail.account.user_id };
  };
  const onboardCoach = async (c, account) => {
    for (const [method, route, body] of [
      ["PATCH", "/account/coach-onboarding/profile", { display_name: "Coach", email: account.email }],
      ["POST", "/account/coach-onboarding/terms", { accepted: true, terms_version: "terms_v1" }],
      ["PATCH", "/account/coach-onboarding/accessibility", { accessibility_preferences: { larger_text: false, high_contrast: false, reduced_motion: false, screen_reader_optimised: false } }],
      ["POST", "/account/coach-onboarding/complete", { completion_confirmed: true }]
    ]) await c.req(method, route, body);
  };

  const coach = client(baseUrl);
  const coachAccount = await register(coach, "coach", "coach");
  await onboardCoach(coach, coachAccount);
  const stranger = client(baseUrl);
  const strangerAccount = await register(stranger, "coach", "stranger");
  await onboardCoach(stranger, strangerAccount);
  await stranger.refresh();

  const saved = ok(await coach.req("POST", "/templates", {
    coach_user_id: coachAccount.userId, template_version: 1, template_name: `Squat ${nonce}`, description: "", activity_id: "powerlifting",
    blocks: [{ block_id: "", order_index: 1, name: "Base", description: "", block_type: "strength", week_count: 1,
      weeks: [{ week_id: "", order_index: 1, sessions: [{ session_id: "", order_index: 1, title: "Squat day", coaching_notes: "", work_items: [{
        work_item_id: "", order_index: 1, exercise_id: "back_squat", planned_sets: 4, rep_mode: "fixed", planned_reps: 5, rep_min: 5, rep_max: 5,
        load_mode: "percent_1rm", percent_1rm: 75, weight_value: 20, weight_unit: "kg", rpe_value: 8, rest_seconds: 180,
        role: "primary", coaching_notes: "", segment: "working", group_id: "", group_type: "straight"
      }] }] }] }],
    updated_at_iso8601: new Date().toISOString()
  }), 201, "programme");
  const templateId = saved.json.template.template_id;
  ok(await coach.req("POST", `/templates/${templateId}/complete`, { coach_user_id: coachAccount.userId }), 200, "complete");
  ok(await coach.req("POST", `/templates/${templateId}/activate`, { coach_user_id: coachAccount.userId }), 200, "activate");

  const lifter = async (name) => {
    const athlete = client(baseUrl);
    const account = await register(athlete, "athlete", name, { activity_id: "powerlifting" });
    const fields = { activity_id: "powerlifting", experience_level: "amateur", execution_scope: "coach_managed", product_acknowledged: true, jurisdiction_code: "england_wales", jurisdiction_acknowledged: true, training_days_per_week: 3, no_fixed_date: true, accessibility_preferences: { larger_text: false, high_contrast: false, reduced_motion: false, screen_reader_optimised: false }, instruction_density: "standard" };
    for (const stage of STAGES.slice(1)) await athlete.req("PATCH", "/account/onboarding/draft", { current_stage: stage, fields });
    ok(await athlete.req("POST", "/account/onboarding/confirm", { review_confirmed: true }), 200, `${name} onboarded`);
    await coach.refresh();
    ok(await coach.req("POST", "/coach-workspace/relationship-invitations", { athlete_email: account.email }), 201, `${name} invited`);
    await athlete.refresh();
    const invitations = (await athlete.req("GET", "/coach-workspace/relationship-invitations")).json;
    const relationshipId = (invitations.invitations ?? invitations.records ?? invitations.relationships ?? [])[0]?.relationship_id;
    ok(await athlete.req("POST", `/coach-workspace/relationship-invitations/${encodeURIComponent(relationshipId)}/accept`, {}), 201, `${name} accepts`);
    ok(await coach.req("POST", "/coach-workspace/athlete-assignment", {
      request_id: `lighten_${name}_${nonce}`, requested_at_iso8601: new Date().toISOString(), coach_user_id: coachAccount.userId,
      athlete_user_id: account.userId, template_id: templateId, activity_id: "powerlifting", event_id: ""
    }), 201, `${name} assigned`);
    await coach.refresh();
    ok(await coach.req("POST", "/coach-workspace/athlete-strength-profile", {
      coach_user_id: coachAccount.userId, athlete_user_id: account.userId, preferred_weight_unit: "kg", load_rounding_increment: 2.5, bodyweight: 90, bodyweight_unit: "kg",
      benchmarks: [{ benchmark_id: "", exercise_id: "back_squat", value: 150, unit: "kg", basis: "tested_1rm", effective_date: day(-3), source_note: "" }],
      expected_current_record_sha256: null
    }), 201, `${name} squat max`);
    await athlete.refresh();
    const badNight = ok(await athlete.req("PUT", "/account/onboarding/readiness", { sleep: 1, soreness: 3, stress: 3 }), 200, `${name} slept badly`).json;
    assert.equal(badNight.low, true);
    return { athlete, account };
  };
  const squatOf = async ({ athlete, account }) => {
    const detail = await athlete.refresh();
    const created = ok(await athlete.req("POST", "/blocks/compile?create_session=true&beta_path=true", { phase1_input: detail.bootstrap.declaration_record.engine_phase1_input, beta_user_id: account.userId, beta_coach_user_id: coachAccount.userId }), 201, "session");
    return created.json.planned_session.exercises.find((e) => e.exercise_id === "back_squat");
  };
  const setting = (id) => `/coach-workspace/athletes/${id}/readiness-lightening`;

  // Dan: the rule is off (the default) - his session is as written.
  const dan = await lifter("dan");
  assert.equal(ok(await coach.req("GET", setting(dan.account.userId)), 200, "Dan's setting").json.enabled, false, "off by default");
  const danSquat = await squatOf(dan);
  assert.equal(danSquat.sets, 4);
  assert.equal(danSquat.intensity.value, 75);
  assert.equal(danSquat.resolved_load.value, 112.5, "75% of 150 kg");
  assert.equal(danSquat.readiness, undefined, "a low check-in alone changes nothing");

  // Eve: her coach turns the rule on.
  const eve = await lifter("eve");
  assert.equal(ok(await stranger.req("GET", setting(eve.account.userId)), 403, "another coach can't see it").json.ok, false);
  ok(await stranger.req("PUT", setting(eve.account.userId), { enabled: true }), 403, "another coach can't change it");
  ok(await coach.req("PUT", setting(eve.account.userId), { enabled: "on" }), 422, "on or off only");
  assert.equal(ok(await coach.req("PUT", setting(eve.account.userId), { enabled: true }), 200, "Eve's coach turns it on").json.enabled, true);
  const eveView = ok(await eve.athlete.req("GET", "/account/onboarding/readiness"), 200, "Eve's view").json;
  assert.deepEqual(eveView.lightening, { own: false, coach_on: true }, "Eve sees her coach turned it on");
  assert.equal(ok(await coach.req("GET", setting(dan.account.userId)), 200, "Dan's setting again").json.enabled, false, "per athlete");

  const eveSquat = await squatOf(eve);
  assert.equal(eveSquat.sets, 3, "a set shorter");
  assert.equal(eveSquat.intensity.value, 70, "5% lighter");
  assert.equal(eveSquat.resolved_load.value, 105, "the weight follows: 70% of 150 kg");
  assert.deepEqual(eveSquat.readiness, { sleep: 1, soreness: 3, stress: 3, low: true, rule: "coach" });
});
