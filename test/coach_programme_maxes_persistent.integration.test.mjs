// A coach's programme in % of max meets athletes without every max. Bea is a
// beginner with no maxes: she isn't held up - her squat and paused bench are
// worked by feel (RPE 6), and her coach's review says so. Alex (amateur) has
// a bench max: his paused bench is loaded from it. He has no squat max, so his
// session waits and his coach is notified - until the coach gives him an RPE
// for that squat, and he trains.
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

test("a beginner without maxes trains by RPE 6; a variation uses the competition lift's max; a missing max tells the coach", { timeout: 120000 }, async (t) => {
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
    const email = `maxes_${name}_${nonce}@example.com`;
    ok(await c.req("POST", "/account/register", {
      actor_type: actorType, display_name: name, email, password: "MaxesTest!2026", date_of_birth: "1994-06-06",
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
    load_mode: "percent_1rm", percent_1rm: pct, weight_value: 20, weight_unit: "kg", rpe_value: 8, rest_seconds: 180,
    role: i ? "accessory" : "primary", coaching_notes: "", segment: "working", group_id: "", group_type: "straight"
  });
  const saved = ok(await coach.req("POST", "/templates", {
    coach_user_id: coachAccount.userId, template_version: 1, template_name: `Strength ${nonce}`, description: "", activity_id: "powerlifting",
    blocks: [{ block_id: "", order_index: 1, name: "Base", description: "", block_type: "strength", week_count: 1,
      weeks: [{ week_id: "", order_index: 1, sessions: [{ session_id: "", order_index: 1, title: "Squat day", coaching_notes: "", work_items: [item("back_squat", 0, 75), item("paused_bench_press", 1, 70)] }] }] }],
    updated_at_iso8601: new Date().toISOString()
  }), 201, "programme");
  const templateId = saved.json.template.template_id;
  ok(await coach.req("POST", `/templates/${templateId}/complete`, { coach_user_id: coachAccount.userId }), 200, "complete");
  ok(await coach.req("POST", `/templates/${templateId}/activate`, { coach_user_id: coachAccount.userId }), 200, "activate");

  const lifter = async (name, level, benchmarks) => {
    const athlete = client(baseUrl);
    const account = await register(athlete, "athlete", name, { activity_id: "powerlifting" });
    const fields = { activity_id: "powerlifting", experience_level: level, execution_scope: "coach_managed", product_acknowledged: true, jurisdiction_code: "england_wales", jurisdiction_acknowledged: true, training_days_per_week: 3, no_fixed_date: true, accessibility_preferences: { larger_text: false, high_contrast: false, reduced_motion: false, screen_reader_optimised: false }, instruction_density: "standard" };
    for (const stage of STAGES.slice(1)) await athlete.req("PATCH", "/account/onboarding/draft", { current_stage: stage, fields });
    ok(await athlete.req("POST", "/account/onboarding/confirm", { review_confirmed: true }), 200, `${name} onboarded`);
    ok(await coach.req("POST", "/coach-workspace/relationship-invitations", { athlete_email: account.email }), 201, `${name} invited`);
    await athlete.refresh();
    const invitations = (await athlete.req("GET", "/coach-workspace/relationship-invitations")).json;
    const relationshipId = (invitations.invitations ?? invitations.records ?? invitations.relationships ?? [])[0]?.relationship_id;
    ok(await athlete.req("POST", `/coach-workspace/relationship-invitations/${encodeURIComponent(relationshipId)}/accept`, {}), 201, `${name} accepts`);
    ok(await coach.req("POST", "/coach-workspace/athlete-assignment", {
      request_id: `maxes_${name}_${nonce}`, requested_at_iso8601: new Date().toISOString(), coach_user_id: coachAccount.userId,
      athlete_user_id: account.userId, template_id: templateId, activity_id: "powerlifting", event_id: ""
    }), 201, `${name} assigned`);
    await coach.refresh();
    if (benchmarks.length) {
      ok(await coach.req("POST", "/coach-workspace/athlete-strength-profile", {
        coach_user_id: coachAccount.userId, athlete_user_id: account.userId, preferred_weight_unit: "kg", load_rounding_increment: 2.5, bodyweight: 90, bodyweight_unit: "kg",
        benchmarks: benchmarks.map(([exercise_id, value]) => ({ benchmark_id: "", exercise_id, value, unit: "kg", basis: "tested_1rm", effective_date: day(-3), source_note: "" })),
        expected_current_record_sha256: null
      }), 201, `${name} maxes`);
    }
    return { athlete, account };
  };
  const session = async ({ athlete, account }) => {
    const detail = await athlete.refresh();
    return athlete.req("POST", "/blocks/compile?create_session=true&beta_path=true", { phase1_input: detail.bootstrap.declaration_record.engine_phase1_input, beta_user_id: account.userId, beta_coach_user_id: coachAccount.userId });
  };
  const byId = (planned, id) => planned.exercises.find((e) => e.exercise_id === id);
  const missingNotices = async () => {
    await coach.refresh();
    const list = ok(await coach.req("GET", "/account/notifications"), 200, "coach notifications").json.notifications;
    return list.filter((n) => n.notification_type === "athlete_strength_reference_missing");
  };

  // Bea, a beginner with no maxes at all.
  const bea = await lifter("bea", "beginner", []);
  const beaSession = ok(await session(bea), 201, "Bea's first session").json.planned_session;
  assert.deepEqual(byId(beaSession, "back_squat").intensity, { type: "rpe", value: 6 }, "squat by feel");
  assert.deepEqual(byId(beaSession, "paused_bench_press").intensity, { type: "rpe", value: 6 });
  assert.deepEqual(beaSession.template_position.max_fallbacks.map((f) => [f.exercise_id, f.fallback]), [["back_squat", "beginner_rpe"], ["paused_bench_press", "beginner_rpe"]]);

  // Alex, an amateur with only a bench max.
  const alex = await lifter("alex", "amateur", [["bench_press", 100]]);
  const held = await session(alex);
  assert.equal(held.status, 400, "no squat max: the session waits");
  assert.equal(held.json.details.reason, "athlete_one_rep_max_missing");
  assert.deepEqual((await missingNotices()).map((n) => n.notification_payload), [{ athlete_user_id: alex.account.userId, exercise_id: "back_squat" }], "told about the squat only - the paused bench uses his bench max");
  assert.equal((await session(alex)).status, 400, "still waiting");
  assert.equal((await missingNotices()).length, 1, "not told twice");

  // The coach gives Alex an RPE for that squat in this session.
  ok(await coach.req("POST", `/coach-workspace/athletes/${alex.account.userId}/programme-overrides`, { session_index: 0, exercise_id: "back_squat", rpe: 7, client_request_id: `ovr_${nonce}_alex` }), 200, "squat at RPE 7 for Alex");
  const alexSession = ok(await session(alex), 201, "Alex trains").json.planned_session;
  assert.deepEqual(byId(alexSession, "back_squat").intensity, { type: "rpe", value: 7 });
  const paused = byId(alexSession, "paused_bench_press");
  assert.equal(paused.resolved_load.value, 70, "70% of his 100 kg bench");
  assert.equal(paused.resolved_load.max_from_exercise_id, "bench_press");
  assert.deepEqual(alexSession.template_position.max_fallbacks, [{ exercise_id: "back_squat", fallback: "coach_rpe" }]);
});
