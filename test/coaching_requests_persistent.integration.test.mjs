// Finding a coach by gym: an athlete sees the coaches a gym has confirmed
// and asks one to coach them; the coach is told, sees who asked (name,
// email, gym, note) and invites them through the usual invitation, which
// the athlete accepts - or dismisses the request.
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
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { response, text, json };
}

function cookieOf(result, name) {
  const found = result.response.headers.getSetCookie().find((value) => value.startsWith(`${name}=`));
  assert.ok(found, `expected ${name} cookie`);
  return found.split(";")[0];
}

function expect(result, status, label) {
  assert.equal(result.response.status, status, `${label}: ${result.text}`);
  return result.json;
}

test("an athlete finds a coach at their gym and asks them; the coach invites them", { timeout: 180000 }, async (t) => {
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const userIds = [];
  let ownerId = "";
  let adminId = "";
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.query("DELETE FROM product_coaching_requests WHERE athlete_user_id = ANY($1::text[]) OR coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_coach_gyms WHERE coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM product_notifications WHERE recipient_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    if (ownerId) {
      await pool.query("DELETE FROM product_gym_listings WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = $1)", [ownerId]).catch(() => {});
      await pool.query("DELETE FROM product_org_audit_records WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = $1)", [ownerId]).catch(() => {});
      await pool.query("DELETE FROM product_organisations WHERE owner_user_id = $1", [ownerId]).catch(() => {});
      await pool.query("DELETE FROM product_org_owner_sessions WHERE user_id = $1", [ownerId]).catch(() => {});
      await pool.query("DELETE FROM product_org_owner_accounts WHERE user_id = $1", [ownerId]).catch(() => {});
    }
    if (adminId) {
      await pool.query("DELETE FROM product_admin_sessions WHERE user_id = $1", [adminId]).catch(() => {});
      await pool.query("DELETE FROM product_admin_accounts WHERE user_id = $1", [adminId]).catch(() => {});
    }
    for (const id of userIds) for (const table of ["product_account_events", "product_auth_sessions", "product_auth_challenges", "product_accounts", "beta_accounts"]) await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [id]).catch(() => {});
    await pool.query("DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.end();
  });

  const register = async (actor, label) => {
    const email = `creq_${label}_${nonce}@example.com`;
    const reg = await request(base, "POST", "/account/register", {
      actor_type: actor, display_name: `${label} Person`, email, password: `CoachReq${nonce}!2026`, ...(actor === "athlete" ? { activity_id: "powerlifting" } : {}),
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

  // A gym, approved; a coach it confirms; a coach still waiting.
  const ownerReg = await request(base, "POST", "/org/register", { email: `creq_owner_${nonce}@example.com`, display_name: "Gym Owner", password: `GymOwner${nonce}!2026` });
  ownerId = expect(ownerReg, 201, "owner").org_owner.user_id;
  const owner = { cookie: cookieOf(ownerReg, "kolosseum_org_owner_session"), csrf: ownerReg.json.csrf_token };
  const gymName = `Forge ${nonce}`;
  const orgId = expect(await request(base, "POST", "/org/organisations", { org_name: gymName, activity_id: "powerlifting", visibility_mode: "individual" }, owner), 201, "gym").organisation.org_id;
  expect(await request(base, "PUT", `/org/organisations/${orgId}/gym-listing`, { display_name: gymName, area: "York", equipment: ["barbell", "rack"] }, owner), 200, "listing");
  const adminEmail = `creq_admin_${nonce}@example.com`;
  const adminPassword = `CoachReqAdmin${nonce}!2026`;
  const salt = crypto.randomBytes(24).toString("base64url");
  const hash = await new Promise((resolve, reject) => crypto.scrypt(adminPassword, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? reject(e) : resolve(Buffer.from(k).toString("base64url")))));
  adminId = `admin_${crypto.randomUUID().replaceAll("-", "")}`;
  await pool.query("INSERT INTO product_admin_accounts (user_id, email_canonical, display_name, password_salt, password_hash) VALUES ($1,$2,$3,$4,$5)", [adminId, adminEmail, "Admin", salt, hash]);
  const adminIn = await request(base, "POST", "/admin/sign-in", { email: adminEmail, password: adminPassword });
  expect(await request(base, "POST", `/admin/gym-listings/${orgId}/review`, { decision: "approve" }, { cookie: cookieOf(adminIn, "kolosseum_admin_session"), csrf: adminIn.json.csrf_token }), 200, "approve");

  const coach = await register("coach", "coach");
  await finishCoachSetup(coach, "Chris Roberts");
  expect(await request(base, "POST", "/coach-branding", { brand_color: "#336699", business_name: "Old Tyme Strength" }, coach), 201, "business name");
  expect(await request(base, "POST", "/coach-branding/gyms", { org_id: orgId }, coach), 201, "coach adds gym");
  const waiting = await register("coach", "waiting");
  await finishCoachSetup(waiting, "Pat Waiting");
  expect(await request(base, "POST", "/coach-branding/gyms", { org_id: orgId }, waiting), 201, "second coach adds gym");
  const gymCoaches = expect(await request(base, "GET", `/org/organisations/${orgId}/gym-coaches`, undefined, owner), 200, "gym's coaches").coaches;
  const chrisLink = gymCoaches.find((c) => c.display_name === "Chris Roberts").coach_gym_id;
  expect(await request(base, "POST", `/org/organisations/${orgId}/gym-coaches/${chrisLink}/decision`, { decision: "confirm" }, owner), 200, "confirm Chris");

  // The athlete searches gyms and sees only the confirmed coach.
  const athlete = await register("athlete", "athlete");
  const found = expect(await request(base, "GET", `/account/onboarding/gyms/search?q=${encodeURIComponent(nonce)}`, undefined, athlete), 200, "search").gyms;
  assert.equal(found.length, 1);
  assert.deepEqual(found[0].coaches.map((c) => [c.display_name, c.business_name, c.asked]), [["Chris Roberts", "Old Tyme Strength", false]], "only confirmed coaches, never one still waiting");
  assert.ok(!JSON.stringify(found).includes(coach.email) && !JSON.stringify(found).includes(coach.userId), "no coach email or id");
  const coachGymId = found[0].coaches[0].coach_gym_id;

  // Chosen as their gym, the coaches show there too.
  expect(await request(base, "PUT", "/account/onboarding/gyms", { gym_org_ids: [orgId] }, athlete), 200, "choose gym");
  const equipment = expect(await request(base, "GET", "/account/onboarding/equipment", undefined, athlete), 200, "equipment");
  assert.deepEqual(equipment.gyms[0].coaches.map((c) => c.display_name), ["Chris Roberts"]);

  // They ask.
  expect(await request(base, "POST", "/account/onboarding/coaching-requests", { coach_gym_id: "nope" }, athlete), 404, "unknown coach");
  expect(await request(base, "POST", "/account/onboarding/coaching-requests", { coach_gym_id: coachGymId, note: "x".repeat(301) }, athlete), 422, "note too long");
  expect(await request(base, "POST", "/account/onboarding/coaching-requests", { coach_gym_id: coachGymId, note: "Looking to compete next spring." }, athlete), 201, "ask");
  expect(await request(base, "POST", "/account/onboarding/coaching-requests", { coach_gym_id: coachGymId }, athlete), 409, "not twice");
  const waitingLink = gymCoaches.find((c) => c.display_name === "Pat Waiting").coach_gym_id;
  expect(await request(base, "POST", "/account/onboarding/coaching-requests", { coach_gym_id: waitingLink }, athlete), 404, "not a coach the gym hasn't confirmed");
  const after = expect(await request(base, "GET", `/account/onboarding/gyms/search?q=${encodeURIComponent(nonce)}`, undefined, athlete), 200, "search after").gyms;
  assert.equal(after[0].coaches[0].asked, true);
  expect(await request(base, "POST", "/account/onboarding/coaching-requests", { coach_gym_id: coachGymId }, coach), 403, "coaches can't ask");

  // The coach is told, and sees who asked.
  const notes = expect(await request(base, "GET", "/account/notifications", undefined, coach), 200, "coach bell").notifications;
  const asked = notes.filter((n) => n.notification_type === "coaching_requested");
  assert.equal(asked.length, 1);
  assert.deepEqual([asked[0].notification_payload.athlete_display_name, asked[0].notification_payload.org_name], ["athlete Person", gymName]);
  const list = expect(await request(base, "GET", "/coach-workspace/coaching-requests", undefined, coach), 200, "requests").requests;
  assert.deepEqual(list.map((r) => [r.athlete_display_name, r.athlete_email, r.gym_name, r.note]), [["athlete Person", athlete.email, gymName, "Looking to compete next spring."]]);
  assert.deepEqual(expect(await request(base, "GET", "/coach-workspace/coaching-requests", undefined, waiting), 200, "other coach").requests, [], "only the coach who was asked");
  expect(await request(base, "POST", `/coach-workspace/coaching-requests/${list[0].request_id}/decision`, { decision: "invite" }, waiting), 404, "another coach can't act on it");

  // The coach invites; the athlete sees the usual invitation and accepts.
  expect(await request(base, "POST", `/coach-workspace/coaching-requests/${list[0].request_id}/decision`, { decision: "maybe" }, coach), 422, "unknown decision");
  const decided = expect(await request(base, "POST", `/coach-workspace/coaching-requests/${list[0].request_id}/decision`, { decision: "invite" }, coach), 200, "invite");
  assert.deepEqual(decided.requests, []);
  const invitations = expect(await request(base, "GET", "/coach-workspace/relationship-invitations", undefined, athlete), 200, "athlete invitations").invitations;
  const invitation = invitations.find((i) => i.coach_user_id === coach.userId);
  assert.ok(invitation, "the athlete has the coach's invitation");
  assert.equal(invitation.coach_business_name, "Old Tyme Strength");
  expect(await request(base, "POST", `/coach-workspace/relationship-invitations/${invitation.relationship_id}/accept`, {}, athlete), 201, "accept");

  // Now coached, they can't ask again; a dismissed request from someone else
  // simply leaves the list.
  expect(await request(base, "POST", "/account/onboarding/coaching-requests", { coach_gym_id: coachGymId }, athlete), 409, "already coached");
  const second = await register("athlete", "second");
  expect(await request(base, "POST", "/account/onboarding/coaching-requests", { coach_gym_id: coachGymId }, second), 201, "second athlete asks");
  const secondList = expect(await request(base, "GET", "/coach-workspace/coaching-requests", undefined, coach), 200, "requests again").requests;
  assert.equal(secondList.length, 1);
  assert.equal(secondList[0].note, null);
  assert.deepEqual(expect(await request(base, "POST", `/coach-workspace/coaching-requests/${secondList[0].request_id}/decision`, { decision: "dismiss" }, coach), 200, "dismiss").requests, []);
});
