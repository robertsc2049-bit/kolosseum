// Quick build: sport, level, days a week, length, goal, session length and
// equipment build a whole draft programme - 4-week blocks through the
// goal's phases, each ending in a deload, exercises that fit the equipment,
// accessory work trimmed to the session length.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
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

test("quick build makes a whole periodised draft from one short form", { timeout: 180000 }, async (t) => {
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const userIds = [];
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.query("DELETE FROM beta_product_records WHERE actor_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_coaching_requests WHERE athlete_user_id = ANY($1::text[]) OR coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_coach_share_links WHERE coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_coach_gyms WHERE coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_notifications WHERE recipient_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    for (const id of userIds) for (const table of ["product_account_events", "product_auth_sessions", "product_auth_challenges", "product_accounts", "beta_accounts"]) await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [id]).catch(() => {});
    await pool.query("DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.end();
  });

  const register = async (actor, label, name = `${label} Person`) => {
    const email = `qb_${label}_${nonce}@example.com`;
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
  const registry = JSON.parse(fs.readFileSync(new URL("../registries/exercise/exercise.registry.json", import.meta.url), "utf8"));
  const exercises = registry.entries ?? registry;
  const build = (body, who = coach) => request(base, "POST", "/templates/quick-build", body, who);
  const sessionsOf = (week) => week.days.flatMap((d) => d.sessions);
  const itemsOf = (template) => template.template_structure.blocks.flatMap((b) => b.weeks.flatMap((w) => sessionsOf(w).flatMap((s) => s.work_items)));

  // Goals depend on the sport.
  const goals = async (activity) => expect(await request(base, "GET", `/templates/quick-build/goals?activity_id=${activity}`, undefined, coach), 200, `${activity} goals`).goals.map((g) => g.goal_id);
  assert.deepEqual(await goals("powerlifting"), ["build", "peak"]);
  assert.deepEqual(await goals("rugby_union"), ["off_season", "pre_season", "in_season"]);
  assert.deepEqual(await goals("hyrox"), ["base", "event_prep"]);
  expect(await request(base, "GET", "/templates/quick-build/goals?activity_id=quidditch", undefined, coach), 422, "unknown sport");
  const athlete = await register("athlete", "athlete", "Sam Lifter");
  expect(await request(base, "GET", "/templates/quick-build/goals?activity_id=powerlifting", undefined, athlete), 403, "coaches only");

  // Checked.
  const good = { activity_id: "powerlifting", experience_level: "amateur", days_per_week: 4, weeks: 12, goal: "peak", session_minutes: null, equipment: "full_gym" };
  for (const [change, field] of [[{ weeks: 6 }, "weeks"], [{ goal: "in_season" }, "goal"], [{ session_minutes: 50 }, "session_minutes"], [{ equipment: "garage" }, "equipment"], [{ days_per_week: 7 }, "days_per_week"]]) {
    const refused = expect(await build({ ...good, ...change }), 422, JSON.stringify(change));
    assert.ok(refused.field_errors[field], `${field} explained`);
  }
  expect(await build(good, { cookie: coach.cookie }), 403, "needs CSRF");

  // Powerlifting, 12 weeks, peaking: volume, intensity, then peak - each block 4 weeks ending in a deload.
  const peak = expect(await build(good), 201, "powerlifting peak").template;
  assert.equal(peak.template_status, "draft");
  assert.equal(peak.template_name, "Powerlifting - Peak for a competition, Amateur, 12 weeks");
  const blocks = peak.template_structure.blocks;
  assert.deepEqual(blocks.map((b) => b.name), ["Block 1 - Volume", "Block 2 - Intensity", "Block 3 - Peak"]);
  assert.ok(blocks.every((b) => b.weeks.length === 4));
  const squatSets = (week) => sessionsOf(week).flatMap((s) => s.work_items).filter((w) => w.exercise_id === "back_squat").reduce((n, w) => n + w.planned_sets, 0);
  for (const block of blocks) assert.ok(squatSets(block.weeks[3]) < squatSets(block.weeks[0]), `${block.name}: week 4 is a deload`);
  assert.equal(sessionsOf(blocks[0].weeks[0]).length, 4, "4 days in the volume block");
  assert.equal(sessionsOf(blocks[2].weeks[0]).length, 3, "a peak keeps it to 3 sessions");

  // Rugby in-season: two sessions a week, whatever days are free.
  const inSeason = expect(await build({ activity_id: "rugby_union", experience_level: "pro", days_per_week: 5, weeks: 8, goal: "in_season", equipment: "full_gym" }), 201, "rugby in-season").template;
  assert.ok(inSeason.template_structure.blocks.every((b) => b.weeks.every((w) => sessionsOf(w).length === 2)));
  const preSeason = expect(await build({ activity_id: "rugby_union", experience_level: "amateur", days_per_week: 3, weeks: 16, goal: "pre_season", equipment: "full_gym" }), 201, "rugby pre-season").template;
  assert.deepEqual(preSeason.template_structure.blocks.map((b) => b.name), ["Block 1 - Off-season", "Block 2 - Off-season", "Block 3 - Off-season", "Block 4 - Pre-season"]);

  // Equipment: a home gym or bodyweight only never gets exercises that need more.
  for (const [equipment, have] of [["home_gym", ["barbell", "rack", "bench", "plate", "dumbbell", "pull_up_bar", "resistance_band"]], ["bodyweight", []]]) {
    const template = expect(await build({ activity_id: "general_strength", experience_level: "amateur", days_per_week: 3, weeks: 4, goal: "build", equipment }), 201, equipment).template;
    const allowed = new Set([...have, "bodyweight", "open_floor_space"]);
    const cannot = [...new Set(itemsOf(template).map((w) => w.exercise_id))].filter((id) => {
      const missing = (exercises[id]?.equipment_requirements ?? []).filter((e) => !allowed.has(e));
      return missing.length > 1 || (missing.length === 1 && !(exercises[id]?.equipment_alternatives ?? []).some((e) => allowed.has(e)));
    });
    assert.deepEqual(cannot, [], `${equipment}: everything can be done with that kit`);
  }

  // Every sport builds with every kit: movements nothing in the kit can do
  // are left out and named, and no session is left empty.
  const sports = Object.keys(JSON.parse(fs.readFileSync(new URL("../registries/activity/activity.registry.json", import.meta.url), "utf8")).entries);
  let named = 0;
  const tooLimited = [];
  let sweeper = null;
  for (const [index, activity] of sports.entries()) {
    // Builds are limited to 60 per account every 15 minutes.
    if (index % 20 === 0) {
      sweeper = await register("coach", `sweep${index}`, `Sweep Coach ${index}`);
      await finishCoachSetup(sweeper, `Sweep Coach ${index}`);
    }
    const goal = (await goals(activity))[0];
    for (const equipment of ["home_gym", "bodyweight"]) {
      const built = await build({ activity_id: activity, experience_level: "amateur", days_per_week: 3, weeks: 4, goal, equipment }, sweeper);
      if (built.response.status === 422) {
        assert.equal(built.json.error, "quick_build_equipment_too_limited", `${activity} ${equipment}: ${built.text}`);
        tooLimited.push(`${activity} ${equipment}`);
        continue;
      }
      const template = expect(built, 201, `${activity} ${equipment}`).template;
      const sessions = template.template_structure.blocks.flatMap((b) => b.weeks.flatMap(sessionsOf));
      assert.ok(sessions.every((session) => session.work_items.length > 0), `${activity} ${equipment}: no empty session`);
      if (template.description.includes("Left out - needs equipment that isn't there:")) named += 1;
    }
  }
  assert.ok(named > 0, "left-out movements are named");
  assert.ok(!tooLimited.some((entry) => entry.endsWith("home_gym")), `a home gym builds for every sport (${tooLimited.join("; ")})`);
  console.log(`bodyweight only isn't enough for: ${tooLimited.join(", ") || "none"}`);

  // A session length trims accessory work, never the main lifts.
  const long = expect(await build({ ...good, weeks: 4, goal: "build" }), 201, "no limit").template;
  const short = expect(await build({ ...good, weeks: 4, goal: "build", session_minutes: 45 }), 201, "45 minutes").template;
  const count = (t, role) => itemsOf(t).filter((w) => w.role === role).length;
  assert.equal(count(short, "primary"), count(long, "primary"), "main lifts kept");
  assert.ok(count(short, "accessory") < count(long, "accessory"), "accessories trimmed");
  assert.match(short.description, /about 45 minutes a session/);

  // Weights by RPE: no % of max work at all, so no maxes are needed to
  // assign it; heavier % lines become higher RPE targets.
  expect(await build({ ...good, weights: "kg" }), 422, "unknown weights");
  const byRpe = expect(await build({ ...good, weeks: 4, goal: "build", weights: "rpe" }), 201, "by RPE").template;
  const rpeItems = itemsOf(byRpe);
  assert.equal(rpeItems.filter((w) => w.loading_reference?.type === "percent_1rm").length, 0, "no % of max left");
  const rpes = rpeItems.filter((w) => w.loading_reference?.type === "rpe").map((w) => w.loading_reference.value);
  assert.ok(rpes.length > 0 && rpes.every((v) => Number.isInteger(v) && v >= 5 && v <= 10), `RPE targets 5-10: ${[...new Set(rpes)]}`);
  assert.match(byRpe.description, /weights by RPE \(no maxes needed\)/u);
  const { rpeForPercent } = await import("../dist/src/api/kolosseum_starter_template_service.js");
  assert.deepEqual([rpeForPercent(80, 5), rpeForPercent(90, 3), rpeForPercent(70, 8), rpeForPercent(60, 5), rpeForPercent(100, 1)], [8, 10, 5, 5, 10]);

  // It's an ordinary draft: it completes and activates.
  expect(await request(base, "POST", `/templates/${encodeURIComponent(peak.template_id)}/complete`, { coach_user_id: coach.userId }, coach), 200, "complete");
  expect(await request(base, "POST", `/templates/${encodeURIComponent(peak.template_id)}/activate`, { coach_user_id: coach.userId }, coach), 200, "activate");
});
