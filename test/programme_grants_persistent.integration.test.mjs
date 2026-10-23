// A coach sells her 8-week programme outside the app and gives it in it. Sam
// (no coach) accepts it and trains from it - he isn't her client and uses no
// seat, but he counts toward her programme-athlete allowance (here 1). Full,
// she can't give it to Tia; once Sam hasn't trained for 28 days he's dormant
// and stops counting, so Tia gets it. She can take Tia's back before Tia
// accepts, never Sam's.
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

test("a coach gives a programme she sold; it counts toward her allowance while the athlete trains, not when dormant", { timeout: 120000 }, async (t) => {
  process.env.KOLOSSEUM_PROGRAMME_ATHLETE_ALLOWANCE = "1";
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const userIds = [];
  t.after(async () => {
    delete process.env.KOLOSSEUM_PROGRAMME_ATHLETE_ALLOWANCE;
    await new Promise((resolve) => server.close(resolve));
    for (const userId of userIds) {
      await pool.query("DELETE FROM sessions WHERE beta_subject_user_id = $1", [userId]).catch(() => {});
      for (const table of ["product_account_events", "product_auth_sessions", "product_auth_challenges", "product_accounts"]) await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]).catch(() => {});
    }
    await pool.query("DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.end();
  });
  const register = async (c, actorType, name, extra = {}) => {
    const email = `grants_${name}_${nonce}@example.com`;
    ok(await c.req("POST", "/account/register", {
      actor_type: actorType, display_name: name, email, password: "GrantsTest!2026", date_of_birth: "1994-06-06",
      accepted_terms: true, accepted_consent: true, accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1", ...extra
    }), 201, `register ${name}`);
    const detail = await c.refresh();
    userIds.push(detail.account.user_id);
    return { email, userId: detail.account.user_id };
  };

  const coach = client(baseUrl);
  const coachAccount = await register(coach, "coach", "cara");
  for (const [method, route, body] of [
    ["PATCH", "/account/coach-onboarding/profile", { display_name: "Cara Coach", email: coachAccount.email }],
    ["POST", "/account/coach-onboarding/terms", { accepted: true, terms_version: "terms_v1" }],
    ["PATCH", "/account/coach-onboarding/accessibility", { accessibility_preferences: { larger_text: false, high_contrast: false, reduced_motion: false, screen_reader_optimised: false } }],
    ["POST", "/account/coach-onboarding/complete", { completion_confirmed: true }]
  ]) await coach.req(method, route, body);
  const item = (exercise_id, i) => ({
    work_item_id: "", order_index: i + 1, exercise_id, planned_sets: 3, rep_mode: "fixed", planned_reps: 8, rep_min: 8, rep_max: 8,
    load_mode: "rpe", percent_1rm: 70, weight_value: 20, weight_unit: "kg", rpe_value: 7, rest_seconds: 120,
    role: i ? "accessory" : "primary", coaching_notes: "", segment: "working", group_id: "", group_type: "straight"
  });
  const saved = ok(await coach.req("POST", "/templates", {
    coach_user_id: coachAccount.userId, template_version: 1, template_name: `8-week strength ${nonce}`, description: "", activity_id: "general_strength",
    blocks: [{ block_id: "", order_index: 1, name: "Base", description: "", block_type: "strength", week_count: 1,
      weeks: [{ week_id: "", order_index: 1, sessions: [
        { session_id: "", order_index: 1, title: "Day A", coaching_notes: "", work_items: [item("goblet_squat", 0), item("bench_press", 1)] },
        { session_id: "", order_index: 2, title: "Day B", coaching_notes: "", work_items: [item("romanian_deadlift", 0), item("chin_up", 1)] }
      ] }] }],
    updated_at_iso8601: new Date().toISOString()
  }), 201, "programme");
  const templateId = saved.json.template.template_id;
  const grantsRoute = `/templates/${templateId}/programme-grants`;
  // Not active yet: nothing to give.
  assert.equal((await coach.req("POST", grantsRoute, { athlete_email: "x@example.com", client_request_id: `g0_${nonce}` })).status, 409);
  ok(await coach.req("POST", `/templates/${templateId}/complete`, { coach_user_id: coachAccount.userId }), 200, "complete");
  ok(await coach.req("POST", `/templates/${templateId}/activate`, { coach_user_id: coachAccount.userId }), 200, "activate");

  // Sam, self-coached.
  const sam = client(baseUrl);
  const samAccount = await register(sam, "athlete", "sam", { activity_id: "general_strength" });
  const fields = { activity_id: "general_strength", experience_level: "amateur", execution_scope: "individual", product_acknowledged: true, jurisdiction_code: "england_wales", jurisdiction_acknowledged: true, training_days_per_week: 2, accessibility_preferences: { larger_text: false, high_contrast: false, reduced_motion: false, screen_reader_optimised: false }, instruction_density: "standard" };
  for (const stage of STAGES.slice(1)) ok(await sam.req("PATCH", "/account/onboarding/draft", { current_stage: stage, fields }), 200, `Sam ${stage}`);
  ok(await sam.req("POST", "/account/onboarding/confirm", { review_confirmed: true }), 200, "Sam onboarded");

  // Cara gives it to Sam (the same request twice is one grant).
  const given = ok(await coach.req("POST", grantsRoute, { athlete_email: ` ${samAccount.email.toUpperCase()} `, client_request_id: `g1_${nonce}` }), 201, "given to Sam").json;
  assert.equal(given.added, true);
  assert.equal(ok(await coach.req("POST", grantsRoute, { athlete_email: samAccount.email, client_request_id: `g1_${nonce}` }), 201, "again").json.added, false);
  const list = async () => ok(await coach.req("GET", "/templates/programme-grants"), 200, "Cara's grants").json;
  let mine = await list();
  assert.deepEqual([mine.grants.map((g) => g.state), mine.usage.active, mine.usage.allowance], [["pending"], 0, 1], "waiting for Sam; nothing counts yet");

  // Sam sees it, starts it and trains from it.
  await sam.refresh();
  const offered = ok(await sam.req("GET", "/account/onboarding/programme-grants"), 200, "Sam's programmes").json;
  assert.deepEqual(offered.grants.map((g) => [g.title, g.coach_name, g.accepted, g.running]), [[`8-week strength ${nonce}`, "Cara Coach", false, false]]);
  const started = ok(await sam.req("POST", `/account/onboarding/programme-grants/${given.grant.grant_id}/start`, {}), 200, "Sam starts it").json;
  assert.equal(started.grants[0].running, true);
  const detail = await sam.refresh();
  const session = ok(await sam.req("POST", "/blocks/compile?create_session=true&beta_path=true", {
    phase1_input: detail.bootstrap.declaration_record.engine_phase1_input,
    beta_path_context: { auth_record: detail.bootstrap.auth_record, acknowledgement_record: detail.bootstrap.acknowledgement_record, declaration_record: detail.bootstrap.declaration_record }
  }), 201, "Sam's first session").json;
  assert.equal(session.planned_session.programme_run.session_title, "Day A");
  assert.deepEqual(session.planned_session.exercises.filter((e) => (e.segment ?? "working") === "working").map((e) => e.exercise_id), ["goblet_squat", "bench_press"]);
  mine = await list();
  assert.deepEqual([mine.grants[0].state, mine.usage.active], ["active", 1], "Sam counts while he trains");

  // Full: Tia can't be given it - and Sam's can't be taken back.
  const tiaEmail = `grants_tia_${nonce}@example.com`;
  const full = await coach.req("POST", grantsRoute, { athlete_email: tiaEmail, client_request_id: `g2_${nonce}` });
  assert.deepEqual([full.status, full.json.error], [409, "programme_grant_allowance_full"]);
  const keep = await coach.req("POST", `/templates/programme-grants/${given.grant.grant_id}/revoke`, {});
  assert.deepEqual([keep.status, keep.json.error], [409, "programme_grant_already_accepted"]);

  // 30 days on with no session, Sam is dormant and Tia gets it; Cara takes
  // Tia's back before she's accepted.
  await pool.query("UPDATE sessions SET created_at = now() - interval '30 days' WHERE beta_subject_user_id = $1", [samAccount.userId]);
  await pool.query("UPDATE product_account_events SET event_payload = jsonb_set(event_payload, '{started_at}', to_jsonb((now() - interval '31 days')::text)) WHERE user_id = $1 AND event_type = 'athlete_programme_run_started'", [samAccount.userId]);
  mine = await list();
  assert.deepEqual([mine.grants[0].state, mine.usage.active], ["dormant", 0]);
  const tia = ok(await coach.req("POST", grantsRoute, { athlete_email: tiaEmail, client_request_id: `g3_${nonce}` }), 201, "given to Tia").json;
  ok(await coach.req("POST", `/templates/programme-grants/${tia.grant.grant_id}/revoke`, {}), 200, "Tia's taken back");
  mine = await list();
  assert.deepEqual(mine.grants.map((g) => g.state).sort(), ["dormant", "revoked"]);

  // Someone else can't start Sam's.
  const eve = client(baseUrl);
  await register(eve, "athlete", "eve", { activity_id: "general_strength" });
  assert.equal((await eve.req("POST", `/account/onboarding/programme-grants/${given.grant.grant_id}/start`, {})).status, 404);
});
