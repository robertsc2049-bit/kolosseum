// An athlete's own coaching requests: they see where each stands, withdraw
// one still waiting, are told kindly when a coach can't take them on, and
// can ask that coach again after 30 days.
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

test("an athlete follows their coaching requests: waiting, withdrawn, invited, not taken on, ask again later", { timeout: 180000 }, async (t) => {
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
    const email = `share_${label}_${nonce}@example.com`;
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
  const business = `Old Tyme Strength ${nonce}`;
  expect(await request(base, "POST", "/coach-branding", { brand_color: "#8a5a2b", business_name: business }, coach), 201, "branding");
  const slug = `ots-${nonce}`;
  expect(await request(base, "PUT", "/coach-branding/share-link", { slug, enabled: true }, coach), 200, "link on");
  const other = await register("coach", "other", "Pat Other");
  await finishCoachSetup(other, "Pat Other");
  const otherSlug = `pat-${nonce}`;
  expect(await request(base, "PUT", "/coach-branding/share-link", { slug: otherSlug, enabled: true }, other), 200, "other link on");

  const athlete = await register("athlete", "athlete", "Sam Lifter");
  const mine = async (who = athlete) => expect(await request(base, "GET", "/account/onboarding/coaching-requests", undefined, who), 200, "my requests").requests;
  assert.deepEqual(await mine(), []);
  expect(await request(base, "GET", "/account/onboarding/coaching-requests", undefined, coach), 403, "coaches have no list here");

  // Waiting, then withdrawn - which takes it off the coach's list too.
  expect(await request(base, "POST", "/account/onboarding/coaching-requests", { coach_link: otherSlug }, athlete), 201, "ask Pat");
  let list = await mine();
  assert.deepEqual(list.map((r) => [r.coach_display_name, r.status, r.via_share_link]), [["Pat Other", "waiting", true]]);
  expect(await request(base, "POST", `/account/onboarding/coaching-requests/${list[0].request_id}/withdraw`, {}, { cookie: athlete.cookie }), 403, "withdraw needs CSRF");
  const someoneElse = await register("athlete", "someone", "Someone Else");
  expect(await request(base, "POST", `/account/onboarding/coaching-requests/${list[0].request_id}/withdraw`, {}, someoneElse), 404, "only their own");
  assert.deepEqual(expect(await request(base, "POST", `/account/onboarding/coaching-requests/${list[0].request_id}/withdraw`, {}, athlete), 200, "withdraw").requests, []);
  expect(await request(base, "POST", `/account/onboarding/coaching-requests/${list[0].request_id}/withdraw`, {}, athlete), 404, "not twice");
  assert.deepEqual(expect(await request(base, "GET", "/coach-workspace/coaching-requests", undefined, other), 200, "Pat's list").requests, []);
  expect(await request(base, "POST", "/account/onboarding/coaching-requests", { coach_link: otherSlug }, athlete), 201, "can ask Pat again after withdrawing");

  // Chris turns them down: the athlete is told, kindly, and can't ask again for 30 days.
  expect(await request(base, "POST", "/account/onboarding/coaching-requests", { coach_link: slug, note: "Hoping to compete." }, athlete), 201, "ask Chris");
  const chrisList = expect(await request(base, "GET", "/coach-workspace/coaching-requests", undefined, coach), 200, "Chris's list").requests;
  expect(await request(base, "POST", `/coach-workspace/coaching-requests/${chrisList[0].request_id}/decision`, { decision: "dismiss" }, coach), 200, "dismiss");
  list = await mine();
  const declined = list.find((r) => r.coach_display_name === "Chris Roberts");
  assert.equal(declined.status, "not_taken_on");
  assert.equal(declined.coach_business_name, business);
  assert.equal(declined.note, "Hoping to compete.");
  const askAgain = new Date(declined.ask_again_from).getTime() - new Date(declined.decided_at).getTime();
  assert.equal(askAgain, 30 * 86400000);
  const notes = expect(await request(base, "GET", "/account/notifications", undefined, athlete), 200, "athlete bell").notifications;
  const told = notes.filter((n) => n.notification_type === "coaching_request_declined");
  assert.equal(told.length, 1);
  assert.deepEqual([told[0].notification_payload.coach_display_name, told[0].notification_payload.coach_business_name], ["Chris Roberts", business]);
  assert.equal(told[0].deep_link.route_id, "shared_account");
  const again = expect(await request(base, "POST", "/account/onboarding/coaching-requests", { coach_link: slug }, athlete), 409, "too soon");
  assert.equal(again.error, "coaching_request_recently_declined");
  assert.equal(again.field_errors.ask_again_from, declined.ask_again_from);

  // After 30 days they can ask again.
  await pool.query("UPDATE product_coaching_requests SET decided_at = now() - interval '31 days' WHERE request_id = $1", [declined.request_id]);
  expect(await request(base, "POST", "/account/onboarding/coaching-requests", { coach_link: slug }, athlete), 201, "asks again after 30 days");

  // Pat invites; then they accept and Pat is coaching them.
  const patList = expect(await request(base, "GET", "/coach-workspace/coaching-requests", undefined, other), 200, "Pat's list again").requests;
  expect(await request(base, "POST", `/coach-workspace/coaching-requests/${patList[0].request_id}/decision`, { decision: "invite" }, other), 200, "Pat invites");
  assert.equal((await mine()).find((r) => r.coach_display_name === "Pat Other").status, "invited");
  const invitation = expect(await request(base, "GET", "/coach-workspace/relationship-invitations", undefined, athlete), 200, "invitations").invitations.find((i) => i.coach_user_id === other.userId);
  expect(await request(base, "POST", `/coach-workspace/relationship-invitations/${invitation.relationship_id}/accept`, {}, athlete), 201, "accept");
  list = await mine();
  assert.deepEqual(list.map((r) => [r.coach_display_name, r.status]), [["Chris Roberts", "waiting"], ["Chris Roberts", "not_taken_on"], ["Pat Other", "coaching"]], "newest first, withdrawn left out");
});
