// A coach lists the gyms they work out of. A gym on Kolosseum confirms them
// first; one that isn't on Kolosseum yet is typed in and linked once it
// joins. The gym sees the coaches who linked to it - name and business
// name - and confirms, declines or removes them. The coach's athletes see
// the confirmed gyms and the typed-in ones, never ones still waiting.
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

test("a coach lists their gyms, the gym confirms them, and their athletes see where they coach", { timeout: 180000 }, async (t) => {
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const userIds = [];
  let ownerId = "";
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.query("DELETE FROM product_coach_gyms WHERE coach_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    if (ownerId) {
      await pool.query("DELETE FROM product_gym_listings WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = $1)", [ownerId]).catch(() => {});
      await pool.query("DELETE FROM product_org_audit_records WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = $1)", [ownerId]).catch(() => {});
      await pool.query("DELETE FROM product_organisations WHERE owner_user_id = $1", [ownerId]).catch(() => {});
      await pool.query("DELETE FROM product_org_owner_sessions WHERE user_id = $1", [ownerId]).catch(() => {});
      await pool.query("DELETE FROM product_org_owner_accounts WHERE user_id = $1", [ownerId]).catch(() => {});
    }
    for (const id of userIds) for (const table of ["product_account_events", "product_auth_sessions", "product_auth_challenges", "product_accounts", "beta_accounts"]) await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [id]).catch(() => {});
    await pool.query("DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.end();
  });

  const register = async (actor, label) => {
    const email = `cgym_${label}_${nonce}@example.com`;
    const reg = await request(base, "POST", "/account/register", {
      actor_type: actor, display_name: `${label} Person`, email, password: `CoachGyms${nonce}!2026`, ...(actor === "athlete" ? { activity_id: "powerlifting" } : {}),
      accepted_terms: true, accepted_consent: true, accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1", date_of_birth: "1990-05-05"
    });
    expect(reg, 201, `${label} registers`);
    userIds.push(reg.json.account.user_id);
    return { userId: reg.json.account.user_id, email, cookie: cookieOf(reg, "kolosseum_session"), csrf: reg.json.csrf_token };
  };
  const finishCoachSetup = async (who) => {
    for (const [method, path, body] of [["PATCH", "/account/coach-onboarding/profile", { display_name: "Chris Roberts", email: who.email }], ["POST", "/account/coach-onboarding/terms", { accepted: true, terms_version: "terms_v1" }], ["PATCH", "/account/coach-onboarding/accessibility", { accessibility_preferences: { larger_text: false, high_contrast: false, reduced_motion: false, screen_reader_optimised: false } }], ["POST", "/account/coach-onboarding/complete", { completion_confirmed: true }]]) {
      const result = await request(base, method, path, body, who);
      assert.ok(result.response.status < 300, `${path}: ${result.text}`);
    }
  };

  const coach = await register("coach", "coach");
  await finishCoachSetup(coach);
  expect(await request(base, "POST", "/coach-branding", { brand_color: "#336699", business_name: "Old Tyme Strength" }, coach), 201, "business name");
  const athlete = await register("athlete", "athlete");

  // The gym's owner lists the gym; it isn't approved yet.
  const ownerReg = await request(base, "POST", "/org/register", { email: `cgym_owner_${nonce}@example.com`, display_name: "Gym Owner", password: `GymOwner${nonce}!2026` });
  expect(ownerReg, 201, "owner registers");
  ownerId = ownerReg.json.org_owner.user_id;
  const owner = { cookie: cookieOf(ownerReg, "kolosseum_org_owner_session"), csrf: ownerReg.json.csrf_token };
  const gymName = `Iron Temple ${nonce}`;
  const orgId = expect(await request(base, "POST", "/org/organisations", { org_name: gymName, activity_id: "powerlifting", visibility_mode: "individual" }, owner), 201, "create gym").organisation.org_id;
  expect(await request(base, "PUT", `/org/organisations/${orgId}/gym-listing`, { display_name: gymName, area: "Leeds", equipment: ["barbell"] }, owner), 200, "list gym");

  // The coach types it in - it isn't on Kolosseum yet as far as they can find.
  const q = encodeURIComponent(nonce);
  assert.deepEqual(expect(await request(base, "GET", `/coach-branding/gyms/search?q=${q}`, undefined, coach), 200, "search before approval").gyms, []);
  expect(await request(base, "POST", "/coach-branding/gyms", { gym_name: "", area: "" }, coach), 422, "a name is needed");
  expect(await request(base, "POST", "/coach-branding/gyms", { gym_name: gymName, area: "Leeds", extra: 1 }, coach), 422, "unknown fields");
  let mine = expect(await request(base, "POST", "/coach-branding/gyms", { gym_name: gymName.toUpperCase(), area: "Leeds" }, coach), 201, "type in the gym");
  expect(await request(base, "POST", "/coach-branding/gyms", { gym_name: gymName.toUpperCase(), area: "Leeds" }, coach), 409, "not twice");
  const typed = mine.gyms[0];
  assert.equal(typed.link_status, "unlisted");
  assert.deepEqual(typed.now_on_kolosseum, [], "not on Kolosseum until it's approved");
  expect(await request(base, "POST", "/coach-branding/gyms", { gym_name: "Garage Gym", area: "" }, coach), 201, "a second typed-in gym");

  // An athlete can't use the coach routes.
  expect(await request(base, "GET", "/coach-branding/gyms", undefined, athlete), 403, "athletes can't");

  // The admin approves the listing; the coach is shown it next to the gym
  // they typed in, and links it.
  const adminEmail = `cgym_admin_${nonce}@example.com`;
  const adminPassword = `CoachGymAdmin${nonce}!2026`;
  const salt = crypto.randomBytes(24).toString("base64url");
  const hash = await new Promise((resolve, reject) => crypto.scrypt(adminPassword, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? reject(e) : resolve(Buffer.from(k).toString("base64url")))));
  const adminId = `admin_${crypto.randomUUID().replaceAll("-", "")}`;
  await pool.query("INSERT INTO product_admin_accounts (user_id, email_canonical, display_name, password_salt, password_hash) VALUES ($1,$2,$3,$4,$5)", [adminId, adminEmail, "Gym Admin", salt, hash]);
  t.after(async () => {
    await pool.query("DELETE FROM product_admin_sessions WHERE user_id = $1", [adminId]).catch(() => {});
    await pool.query("DELETE FROM product_admin_accounts WHERE user_id = $1", [adminId]).catch(() => {});
  });
  const adminIn = await request(base, "POST", "/admin/sign-in", { email: adminEmail, password: adminPassword });
  const admin = { cookie: cookieOf(adminIn, "kolosseum_admin_session"), csrf: adminIn.json.csrf_token };
  expect(await request(base, "POST", `/admin/gym-listings/${orgId}/review`, { decision: "approve" }, admin), 200, "approve");

  mine = expect(await request(base, "GET", "/coach-branding/gyms", undefined, coach), 200, "coach's gyms");
  const suggested = mine.gyms.find((gym) => gym.coach_gym_id === typed.coach_gym_id);
  assert.deepEqual(suggested.now_on_kolosseum, [{ org_id: orgId, display_name: gymName, area: "Leeds" }], "the gym they typed in is now on Kolosseum");
  assert.deepEqual(mine.gyms.find((gym) => gym.gym_name === "Garage Gym").now_on_kolosseum, []);
  expect(await request(base, "POST", "/coach-branding/gyms", { org_id: orgId }, coach), 201, "adding the listed gym directly is also fine");
  expect(await request(base, "POST", `/coach-branding/gyms/${typed.coach_gym_id}/link`, { org_id: orgId }, coach), 409, "already listed via the search");
  const direct = (await request(base, "GET", "/coach-branding/gyms", undefined, coach)).json.gyms.find((gym) => gym.org_id === orgId);
  expect(await request(base, "DELETE", `/coach-branding/gyms/${direct.coach_gym_id}`, undefined, coach), 200, "remove the direct one");
  mine = expect(await request(base, "POST", `/coach-branding/gyms/${typed.coach_gym_id}/link`, { org_id: orgId }, coach), 200, "link the typed-in gym");
  const linked = mine.gyms.find((gym) => gym.coach_gym_id === typed.coach_gym_id);
  assert.equal(linked.link_status, "pending");
  assert.equal(linked.gym_name, gymName, "now the gym's own name");

  // Until the gym confirms, the coach's athletes don't see it.
  const invite = expect(await request(base, "POST", "/coach-workspace/relationship-invitations", { athlete_email: athlete.email }, coach), 201, "invite");
  const relationshipId = invite.relationship?.relationship_id ?? invite.invitation?.relationship_id ?? invite.relationship_id;
  const pendingList = expect(await request(base, "GET", "/coach-workspace/relationship-invitations", undefined, athlete), 200, "athlete's invitations");
  const pendingEntry = (pendingList.invitations ?? pendingList.relationships ?? []).find((entry) => entry.coach_user_id === coach.userId);
  assert.ok(pendingEntry, "the athlete sees the invitation");
  assert.equal(pendingEntry.coach_business_name, "Old Tyme Strength");
  assert.deepEqual(pendingEntry.coach_gyms.map((gym) => gym.gym_name), ["Garage Gym"], "only the typed-in gym until the gym confirms");
  assert.ok(relationshipId || pendingEntry.relationship_id);

  // The gym sees the coach - name and business name - and confirms them.
  const gymRaw = await request(base, "GET", `/org/organisations/${orgId}/gym-coaches`, undefined, owner);
  let gymView = expect(gymRaw, 200, "gym's coaches");
  assert.deepEqual(gymView.coaches.map((c) => [c.display_name, c.business_name, c.link_status]), [["Chris Roberts", "Old Tyme Strength", "pending"]]);
  assert.ok(!gymRaw.text.includes(coach.email), "no coach email reaches the gym");
  assert.ok(!gymRaw.text.includes(coach.userId), "no coach id reaches the gym");
  const coachGymId = gymView.coaches[0].coach_gym_id;
  expect(await request(base, "POST", `/org/organisations/${orgId}/gym-coaches/${coachGymId}/decision`, { decision: "remove" }, owner), 409, "can't remove before confirming");
  expect(await request(base, "POST", `/org/organisations/${orgId}/gym-coaches/${coachGymId}/decision`, { decision: "maybe" }, owner), 422, "unknown decision");
  gymView = expect(await request(base, "POST", `/org/organisations/${orgId}/gym-coaches/${coachGymId}/decision`, { decision: "confirm" }, owner), 200, "confirm");
  assert.equal(gymView.coaches[0].link_status, "confirmed");

  const confirmedList = expect(await request(base, "GET", "/coach-workspace/relationship-invitations", undefined, athlete), 200, "athlete's invitations again");
  const confirmedEntry = (confirmedList.invitations ?? confirmedList.relationships ?? []).find((entry) => entry.coach_user_id === coach.userId);
  assert.deepEqual(confirmedEntry.coach_gyms, [
    { gym_name: gymName, area: "Leeds", on_kolosseum: true },
    { gym_name: "Garage Gym", area: "", on_kolosseum: false }
  ]);

  // Another gym's owner can't see or decide on this gym's coaches.
  const otherReg = await request(base, "POST", "/org/register", { email: `cgym_other_${nonce}@example.com`, display_name: "Other Owner", password: `OtherOwner${nonce}!2026` });
  const otherId = otherReg.json.org_owner.user_id;
  t.after(async () => {
    await pool.query("DELETE FROM product_org_owner_sessions WHERE user_id = $1", [otherId]).catch(() => {});
    await pool.query("DELETE FROM product_org_owner_accounts WHERE user_id = $1", [otherId]).catch(() => {});
  });
  const other = { cookie: cookieOf(otherReg, "kolosseum_org_owner_session"), csrf: otherReg.json.csrf_token };
  expect(await request(base, "GET", `/org/organisations/${orgId}/gym-coaches`, undefined, other), 403, "not their gym");
  expect(await request(base, "POST", `/org/organisations/${orgId}/gym-coaches/${coachGymId}/decision`, { decision: "remove" }, other), 403, "not their gym");

  // The gym removes the coach; the coach sees it wasn't confirmed and the
  // athletes stop seeing it.
  expect(await request(base, "POST", `/org/organisations/${orgId}/gym-coaches/${coachGymId}/decision`, { decision: "remove" }, owner), 200, "remove");
  mine = expect(await request(base, "GET", "/coach-branding/gyms", undefined, coach), 200, "coach's gyms after removal");
  assert.equal(mine.gyms.find((gym) => gym.coach_gym_id === coachGymId).link_status, "declined");
  assert.deepEqual(expect(await request(base, "GET", `/org/organisations/${orgId}/gym-coaches`, undefined, owner), 200, "gym's coaches after").coaches, []);

  // Up to 5 gyms.
  for (const n of [1, 2, 3]) expect(await request(base, "POST", "/coach-branding/gyms", { gym_name: `Gym ${n}`, area: "" }, coach), 201, `gym ${n}`);
  expect(await request(base, "POST", "/coach-branding/gyms", { gym_name: "Gym 4", area: "" }, coach), 409, "a sixth is too many");
});
