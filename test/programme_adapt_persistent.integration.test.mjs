// Copy and adapt: a coach makes a new draft from one of their programmes in
// one step - fewer days, a different length, loads heavier or lighter, RPE
// a point up or down - and the original is left as it was.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";

async function request(base, method, route, body, options = {}) {
  const headers = { origin: base };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (options.cookie) headers.cookie = options.cookie;
  if (options.csrf) headers["x-kolosseum-csrf"] = options.csrf;
  const response = await fetch(`${base}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const buffer = Buffer.from(await response.arrayBuffer());
  const text = buffer.toString("utf8");
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { response, text, json, buffer };
}

function cookieOf(result, name) {
  const found = result.response.headers.getSetCookie().find((value) => value.startsWith(`${name}=`));
  assert.ok(found, `expected ${name} cookie`);
  return found.split(";")[0];
}

function expect(result, status, label) {
  assert.equal(result.response.status, status, `${label}: ${result.text.slice(0, 300)}`);
  return result.json;
}

test("copy and adapt makes a new draft: fewer days, a different length, heavier or lighter", { timeout: 180000 }, async (t) => {
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const userIds = [];
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.query("DELETE FROM product_coaching_requests WHERE athlete_user_id = ANY($1::text[]) OR coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_coach_share_links WHERE coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_coach_gyms WHERE coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_notifications WHERE recipient_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    for (const id of userIds) for (const table of ["product_account_events", "product_auth_sessions", "product_auth_challenges", "product_accounts", "beta_accounts"]) await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [id]).catch(() => {});
    await pool.query("DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.end();
  });

  const register = async (actor, label, name = `${label} Person`) => {
    const email = `adapt_${label}_${nonce}@example.com`;
    const reg = await request(base, "POST", "/account/register", {
      actor_type: actor, display_name: name, email, password: `ShareLink${nonce}!2026`, ...(actor === "athlete" ? { activity_id: "powerlifting" } : {}),
      accepted_terms: true, accepted_consent: true, accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1", date_of_birth: "1991-03-03"
    });
    expect(reg, 201, `${label} registers`);
    userIds.push(reg.json.account.user_id);
    return { userId: reg.json.account.user_id, email, cookie: cookieOf(reg, "kolosseum_session"), csrf: reg.json.csrf_token };
  };
  const finishCoachSetup = async (who, name) => {
    for (const [method, path, body] of [["PATCH", "/account/coach-onboarding/profile", { display_name: name, email: who.email }], ["POST", "/account/coach-onboarding/terms", { accepted: true, terms_version: "terms_v1" }], ["PATCH", "/account/coach-onboarding/accessibility", { accessibility_preferences: { larger_text: false, high_contrast: false, reduced_motion: false, screen_reader_optimised: false } }], ["POST", "/account/coach-onboarding/complete", { completion_confirmed: true }]]) {
      const result = await request(base, method, path, body, who);
      assert.ok(result.response.status < 300, `${path}: ${result.text}`);
    }
  };

  const coach = await register("coach", "coach", "Chris Roberts");
  await finishCoachSetup(coach, "Chris Roberts");
  const other = await register("coach", "other", "Pat Other");
  await finishCoachSetup(other, "Pat Other");
  const sessionsOf = (week) => week.days.flatMap((d) => d.sessions);
  const weeksOf = (template) => template.template_structure.blocks.flatMap((b) => b.weeks);
  const itemsOf = (template) => weeksOf(template).flatMap((w) => sessionsOf(w).flatMap((s) => s.work_items));
  const percentOf = (item) => (item.loading_reference?.type === "percent_1rm" ? item.loading_reference.value : null);

  // An 8-week, 3-day powerlifting programme to copy.
  const source = expect(await request(base, "POST", "/templates/quick-build", { activity_id: "powerlifting", experience_level: "amateur", days_per_week: 3, weeks: 8, goal: "build", equipment: "full_gym" }, coach), 201, "source").template;
  assert.equal(weeksOf(source).length, 8);
  const adapt = (body, who = coach, id = source.template_id) => request(base, "POST", `/templates/${encodeURIComponent(id)}/adapt`, body, who);

  // Checked, and only the coach's own programmes.
  for (const [body, field] of [
    [{ template_name: "" }, "template_name"],
    [{ template_name: "x", days_per_week: 4 }, "days_per_week"],
    [{ template_name: "x", weeks: 0 }, "weeks"],
    [{ template_name: "x", weeks: 60 }, "weeks"],
    [{ template_name: "x", load_change_percent: 15 }, "load_change_percent"],
    [{ template_name: "x", rpe_change: 2 }, "rpe_change"]
  ]) assert.ok(expect(await adapt(body), 422, JSON.stringify(body)).field_errors[field], `${field} explained`);
  expect(await adapt({ template_name: "Mine now" }, other), 404, "another coach's programme");
  expect(await adapt({ template_name: "x" }, { cookie: coach.cookie }), 403, "needs CSRF");

  // Two days, six weeks, 5% heavier: a new draft of its own.
  const shorter = expect(await adapt({ template_name: "Sam - 2 days", days_per_week: 2, weeks: 6, load_change_percent: 5 }), 201, "shorter").template;
  assert.notEqual(shorter.template_id, source.template_id);
  assert.notEqual(shorter.template_family_id, source.template_family_id, "its own programme, not a new version");
  assert.equal(shorter.template_status, "draft");
  assert.equal(shorter.template_name, "Sam - 2 days");
  assert.equal(weeksOf(shorter).length, 6);
  assert.deepEqual(shorter.template_structure.blocks.map((b) => b.weeks.length), [4, 2], "weeks cut from the end");
  assert.ok(weeksOf(shorter).every((w) => sessionsOf(w).length === 2), "first two days kept");
  assert.match(shorter.description, /^Copied from .*\(2 days a week, 6 weeks, loads \+5%\)\. About the original: Quick build:/u);
  const firstSourceDay = sessionsOf(weeksOf(source)[0])[0].work_items;
  const firstCopyDay = sessionsOf(weeksOf(shorter)[0])[0].work_items;
  assert.deepEqual(firstCopyDay.map((w) => w.exercise_id), firstSourceDay.map((w) => w.exercise_id), "same exercises");
  assert.deepEqual(firstCopyDay.map((w) => [w.planned_sets, w.planned_reps]), firstSourceDay.map((w) => [w.planned_sets, w.planned_reps]), "same sets and reps");
  const percents = firstSourceDay.map((w, i) => [percentOf(w), percentOf(firstCopyDay[i])]).filter(([a]) => typeof a === "number");
  assert.ok(percents.length > 0, "the source has % of max work");
  for (const [before, after] of percents) assert.equal(after, Math.min(100, Math.round((before * 1.05) / 0.5) * 0.5), `${before}% -> ${after}%`);

  // The original is untouched.
  const list = expect(await request(base, "GET", `/templates?coach_user_id=${coach.userId}`, undefined, coach), 200, "library");
  const templates = list.templates ?? list.items ?? [];
  const original = templates.find((t) => t.template_id === source.template_id);
  assert.ok(original, "original still there");
  assert.equal(original.week_count ?? weeksOf(original).length, 8);

  // Longer repeats the last block; lighter rounds to the nearest 0.5%.
  const longer = expect(await adapt({ template_name: "Ten weeks", weeks: 10, load_change_percent: -2.5 }), 201, "longer").template;
  assert.deepEqual(longer.template_structure.blocks.map((b) => b.weeks.length), [4, 4, 2]);
  assert.match(longer.template_structure.blocks[2].name, /\(repeat\)$/u);
  for (const item of itemsOf(longer)) {
    const value = percentOf(item);
    if (typeof value === "number" && item.loading_reference?.type === "percent_1rm") assert.equal(value * 2, Math.round(value * 2), `${value} is on a 0.5 step`);
  }

  // It completes like any other draft.
  expect(await request(base, "POST", `/templates/${encodeURIComponent(shorter.template_id)}/complete`, { coach_user_id: coach.userId }, coach), 200, "complete");
});

test("loads, set weights, set-by-set lines and RPE adapt; reps and sets don't", async () => {
  const { adaptWorkItem } = await import("../dist/src/api/programme_adapt_service.js");
  assert.deepEqual(
    adaptWorkItem({ load_mode: "percent_1rm", percent_1rm: 80, percent_1rm_max: 85, planned_sets: 5, planned_reps: 3 }, 1.05, 0),
    { load_mode: "percent_1rm", percent_1rm: 84, percent_1rm_max: 89.5, planned_sets: 5, planned_reps: 3 }
  );
  assert.equal(adaptWorkItem({ load_mode: "percent_1rm", percent_1rm: 98 }, 1.05, 0).percent_1rm, 100, "never above 100%");
  assert.deepEqual(adaptWorkItem({ load_mode: "fixed_weight", weight_value: 102.5, weight_unit: "kg" }, 0.9, 0).weight_value, 92.5);
  assert.deepEqual(adaptWorkItem({ load_mode: "fixed_weight", weight_value: 225, weight_unit: "lb" }, 1.025, 0).weight_value, 231);
  assert.equal(adaptWorkItem({ load_mode: "rpe", rpe_value: 10 }, 1, 1).rpe_value, 10, "RPE stays within 10");
  assert.equal(adaptWorkItem({ load_mode: "rpe", rpe_value: 8 }, 1, -1).rpe_value, 7);
  assert.deepEqual(
    adaptWorkItem({ load_mode: "percent_1rm", set_plan: [{ sets: 1, reps: 5, value: 70 }, { sets: 3, reps: 3, value: 80, amrap: true }] }, 1.05, 0).set_plan,
    [{ sets: 1, reps: 5, value: 73.5 }, { sets: 3, reps: 3, value: 84, amrap: true }]
  );
  assert.deepEqual(adaptWorkItem({ load_mode: "bodyweight", planned_reps: 10 }, 1.1, 1), { load_mode: "bodyweight", planned_reps: 10 });
});
