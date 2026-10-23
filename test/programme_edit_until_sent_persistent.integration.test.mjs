// A coach finishes a programme, spots a mistake before sending it and fixes
// it: until it has been sent (assigned, given, listed) a finished programme
// can still be edited, and saving makes it a draft again. Once an athlete
// has it, that version never changes under them - the coach edits a new one.
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
const ok = (result, status, label) => { assert.equal(result.status, status, `${label}: ${result.text}`); return result; };

test("a finished programme can be edited until it is sent; after that the coach edits a new version", { timeout: 120000 }, async (t) => {
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const userIds = [];
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    for (const userId of userIds) {
      for (const table of ["product_account_events", "product_auth_sessions", "product_auth_challenges", "product_accounts"]) await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]).catch(() => {});
    }
    await pool.query("DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.end();
  });
  const register = async (c, actorType, name, extra = {}) => {
    const email = `edit_${name}_${nonce}@example.com`;
    ok(await c.req("POST", "/account/register", {
      actor_type: actorType, display_name: name, email, password: "EditUntilSent!2026", date_of_birth: "1994-06-06",
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
  const item = (sets) => ({
    work_item_id: "", order_index: 1, exercise_id: "back_squat", planned_sets: sets, rep_mode: "fixed", planned_reps: 5, rep_min: 5, rep_max: 5,
    load_mode: "rpe", percent_1rm: 75, weight_value: 20, weight_unit: "kg", rpe_value: 8, rest_seconds: 180,
    role: "primary", coaching_notes: "", segment: "working", group_id: "", group_type: "straight"
  });
  const programme = (sets, ids = {}) => ({
    coach_user_id: coachAccount.userId, template_version: 1, template_name: `Squat ${nonce}`, description: "", activity_id: "powerlifting", ...ids,
    blocks: [{ block_id: "", order_index: 1, name: "Base", description: "", block_type: "strength", week_count: 1,
      weeks: [{ week_id: "", order_index: 1, sessions: [{ session_id: "", order_index: 1, title: "Squat day", coaching_notes: "", work_items: [item(sets)] }] }] }],
    updated_at_iso8601: new Date().toISOString()
  });
  const saved = ok(await coach.req("POST", "/templates", programme(4)), 201, "draft").json.template;
  const ids = { template_id: saved.template_id, template_family_id: saved.template_family_id };
  ok(await coach.req("POST", `/templates/${saved.template_id}/complete`, { coach_user_id: coachAccount.userId }), 200, "complete");
  ok(await coach.req("POST", `/templates/${saved.template_id}/activate`, { coach_user_id: coachAccount.userId }), 200, "activate");
  const listed = async () => ok(await coach.req("GET", `/templates?coach_user_id=${coachAccount.userId}`), 200, "library").json.templates.find((entry) => entry.template_id === saved.template_id);
  const before = await listed();
  assert.deepEqual([before.template_status, before.sent], ["active", false]);

  // Not sent yet: the 4 sets should have been 3 - fixed in place, a draft again.
  const fixed = ok(await coach.req("POST", "/templates", programme(3, ids)), 201, "fix before sending").json.template;
  assert.equal(fixed.template_id, saved.template_id, "the same version");
  assert.equal((await listed()).template_status, "draft");
  ok(await coach.req("POST", `/templates/${saved.template_id}/complete`, { coach_user_id: coachAccount.userId }), 200, "complete again");
  ok(await coach.req("POST", `/templates/${saved.template_id}/activate`, { coach_user_id: coachAccount.userId }), 200, "activate again");

  // Sent to an athlete: now this version can't change under them.
  const athlete = client(baseUrl);
  const account = await register(athlete, "athlete", "ath", { activity_id: "powerlifting" });
  const fields = { activity_id: "powerlifting", experience_level: "amateur", execution_scope: "coach_managed", product_acknowledged: true, jurisdiction_code: "england_wales", jurisdiction_acknowledged: true, training_days_per_week: 3, no_fixed_date: true, accessibility_preferences: { larger_text: false, high_contrast: false, reduced_motion: false, screen_reader_optimised: false }, instruction_density: "standard" };
  for (const stage of STAGES.slice(1)) await athlete.req("PATCH", "/account/onboarding/draft", { current_stage: stage, fields });
  ok(await athlete.req("POST", "/account/onboarding/confirm", { review_confirmed: true }), 200, "onboarded");
  ok(await coach.req("POST", "/coach-workspace/relationship-invitations", { athlete_email: account.email }), 201, "invited");
  await athlete.refresh();
  const invitations = (await athlete.req("GET", "/coach-workspace/relationship-invitations")).json;
  const relationshipId = (invitations.invitations ?? invitations.records ?? invitations.relationships ?? [])[0]?.relationship_id;
  ok(await athlete.req("POST", `/coach-workspace/relationship-invitations/${encodeURIComponent(relationshipId)}/accept`, {}), 201, "accepts");
  ok(await coach.req("POST", "/coach-workspace/athlete-assignment", {
    request_id: `edit_${nonce}`, requested_at_iso8601: new Date().toISOString(), coach_user_id: coachAccount.userId,
    athlete_user_id: account.userId, template_id: saved.template_id, activity_id: "powerlifting", event_id: ""
  }), 201, "assigned");
  await coach.refresh();
  assert.equal((await listed()).sent, true);
  const refused = await coach.req("POST", "/templates", programme(5, ids));
  assert.ok(refused.status >= 400 && refused.status < 500, refused.text);
  assert.match(refused.text, /template_sent_edit_new_version/u);
  assert.equal((await listed()).template_status, "active", "the athlete keeps the version they were sent");
});
