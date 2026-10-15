// A coach assigns a general-strength programme - like the Kolosseum ones
// written for several sports (Collision off-season for rugby and American
// football) - to a rugby player. It used to be refused at three separate
// checks (the assign form, the assignment, the session) because the
// programme's activity isn't rugby; the player now trains from it, and the
// session carries the programme's own title (src/api/session_title.ts).
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

function item(exerciseId, index) {
  return {
    work_item_id: "", order_index: index + 1, exercise_id: exerciseId, planned_sets: 3, rep_mode: "fixed", planned_reps: 5, rep_min: 5, rep_max: 5,
    load_mode: "rpe", percent_1rm: 75, weight_value: 20, weight_unit: "kg", rpe_value: 7, rest_seconds: 120,
    role: index ? "accessory" : "primary", coaching_notes: "", segment: "working", group_id: "", group_type: "straight"
  };
}

async function activeProgramme(coach, coachUserId, name, activityId, sessionTitle, exercises) {
  const saved = ok(await coach.req("POST", "/templates", {
    coach_user_id: coachUserId, template_version: 1, template_name: name, description: "", activity_id: activityId,
    blocks: [{ block_id: "", order_index: 1, name: "Build", description: "", block_type: "general", week_count: 1,
      weeks: [{ week_id: "", order_index: 1, sessions: [{ session_id: "", order_index: 1, title: sessionTitle, coaching_notes: "", work_items: exercises.map(item) }] }] }],
    updated_at_iso8601: new Date().toISOString()
  }), 201, `save ${name}`);
  const templateId = saved.json.template.template_id;
  ok(await coach.req("POST", `/templates/${templateId}/complete`, { coach_user_id: coachUserId }), 200, `complete ${name}`);
  return ok(await coach.req("POST", `/templates/${templateId}/activate`, { coach_user_id: coachUserId }), 200, `activate ${name}`).json.template.template_id;
}

test("a rugby player assigned a general-strength programme trains from it, and the session is titled from the programme", { timeout: 120000 }, async (testContext) => {
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
    const email = `general_any_sport_${name}_${nonce}@example.com`;
    ok(await c.req("POST", "/account/register", {
      actor_type: actorType, display_name: name, email, password: "GeneralAnySport!2026", date_of_birth: "1994-06-06",
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
  const general = await activeProgramme(coach, coachAccount.userId, `Collision off-season ${nonce}`, "general_strength", "Lower power", ["back_squat", "romanian_deadlift"]);

  const athlete = client(baseUrl);
  const athleteAccount = await register(athlete, "athlete", "prop", { activity_id: "rugby_union" });
  const fields = {
    activity_id: "rugby_union", experience_level: "amateur", execution_scope: "coach_managed", product_acknowledged: true,
    jurisdiction_code: "england_wales", jurisdiction_acknowledged: true, training_days_per_week: 3, no_fixed_date: true,
    accessibility_preferences: { larger_text: false, high_contrast: false, reduced_motion: false, screen_reader_optimised: false }, instruction_density: "standard"
  };
  for (const stage of STAGES.slice(1)) await athlete.req("PATCH", "/account/onboarding/draft", { current_stage: stage, fields });
  ok(await athlete.req("POST", "/account/onboarding/confirm", { review_confirmed: true }), 200, "confirm onboarding");
  ok(await coach.req("POST", "/coach-workspace/relationship-invitations", { athlete_email: athleteAccount.email }), 201, "invite");
  await athlete.refresh();
  const invitations = (await athlete.req("GET", "/coach-workspace/relationship-invitations")).json;
  const relationshipId = (invitations.invitations ?? invitations.records ?? invitations.relationships ?? [])[0]?.relationship_id;
  ok(await athlete.req("POST", `/coach-workspace/relationship-invitations/${encodeURIComponent(relationshipId)}/accept`, {}), 201, "accept");

  // His sport is on the coach's roster - not a default "powerlifting".
  const roster = (await coach.req("GET", "/coach-workspace/relationships")).json;
  assert.equal((roster.relationships ?? roster.records ?? roster.athletes).find((a) => a.athlete_user_id === athleteAccount.userId)?.activity_id, "rugby_union");

  const assign = (templateId, label) => coach.req("POST", "/coach-workspace/athlete-assignment", {
    request_id: `general_any_sport_${label}_${nonce}`, requested_at_iso8601: new Date().toISOString(), coach_user_id: coachAccount.userId,
    athlete_user_id: athleteAccount.userId, template_id: templateId, activity_id: "rugby_union", event_id: ""
  });
  ok(await assign(general, "general"), 201, "assign the general programme to a rugby player");

  const detail = await athlete.refresh();
  const session = ok(await athlete.req("POST", "/blocks/compile?create_session=true&beta_path=true", {
    phase1_input: detail.bootstrap.declaration_record.engine_phase1_input, beta_user_id: athleteAccount.userId, beta_coach_user_id: coachAccount.userId
  }), 201, "his session is built from it");
  assert.equal(session.json.planned_session.title, "Lower power");
  const training = session.json.planned_session.exercises.filter((e) => e.segment !== "warm_up" && e.segment !== "cool_down").map((e) => e.exercise_id);
  assert.deepEqual(training, ["back_squat", "romanian_deadlift"]);

  const reviews = (await coach.req("GET", `/coach-workspace/reviews?coach_user_id=${encodeURIComponent(coachAccount.userId)}`)).json;
  assert.equal(reviews.records.find((r) => r.session_id === session.json.session_id)?.session_title, "Lower power", "the coach's review list names it");

  // A programme for a different single sport is still refused.
  const tennis = await activeProgramme(coach, coachAccount.userId, `Tennis block ${nonce}`, "tennis", "Serve power", ["back_squat"]);
  const refused = await assign(tennis, "tennis");
  assert.equal(refused.status, 400, `a tennis programme isn't assigned to a rugby player: ${refused.text}`);
});
