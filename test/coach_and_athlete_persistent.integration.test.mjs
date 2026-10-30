// One login, both roles (real database and server): a coach adds an athlete
// side and switches between coaching and their own training; their athlete
// side sets up like any athlete's; they can't take themselves on as a client;
// another coach can invite them as an athlete; and an admin can give an
// athlete the coach role, keeping their athlete side.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";

async function request(baseUrl, method, route, body, options = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (options.cookie) headers.cookie = options.cookie;
  if (options.csrf) headers["x-kolosseum-csrf"] = options.csrf;
  const response = await fetch(`${baseUrl}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { status: response.status, json, text: text.slice(0, 400), response };
}

const cookieOf = (result, name) => result.response.headers.getSetCookie().find((v) => v.startsWith(`${name}=`)).split(";")[0];

async function createAdmin(email, password) {
  const salt = crypto.randomBytes(24).toString("base64url");
  const hash = await new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? reject(e) : resolve(Buffer.from(k).toString("base64url")))));
  const userId = `admin_${crypto.randomUUID().replaceAll("-", "")}`;
  await pool.query(`INSERT INTO product_admin_accounts (user_id, email_canonical, display_name, password_salt, password_hash) VALUES ($1,$2,$3,$4,$5)`, [userId, email, "Roles Admin", salt, hash]);
  return userId;
}

test("one login can be both a coach and an athlete", { timeout: 180000 }, async (testContext) => {
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const userIds = [];
  const adminIds = [];
  testContext.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.query("DELETE FROM product_admin_audit_records WHERE actor_user_id = ANY($1::text[])", [adminIds]).catch(() => {});
    await pool.query("DELETE FROM product_admin_sessions WHERE user_id = ANY($1::text[])", [adminIds]).catch(() => {});
    await pool.query("DELETE FROM product_admin_accounts WHERE user_id = ANY($1::text[])", [adminIds]).catch(() => {});
    for (const userId of userIds) {
      for (const table of ["product_account_events", "product_auth_sessions", "product_auth_challenges", "product_accounts", "beta_accounts"]) await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]).catch(() => {});
    }
    await pool.query("DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.end();
  });

  const register = async (actor, label) => {
    const email = `roles_${label}_${nonce}@example.com`;
    const result = await request(baseUrl, "POST", "/account/register", {
      actor_type: actor, display_name: `${label} Person`, email, password: "BothRolesPlease!2026", ...(actor === "athlete" ? { activity_id: "general_strength" } : {}),
      accepted_terms: true, accepted_consent: true, accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1", date_of_birth: "1988-08-08"
    });
    assert.equal(result.status, 201, result.text);
    userIds.push(result.json.account.user_id);
    return { userId: result.json.account.user_id, email, cookie: cookieOf(result, "kolosseum_session"), csrf: result.json.csrf_token };
  };
  const finishCoachSetup = async (who) => {
    for (const [method, path, body] of [["PATCH", "/account/coach-onboarding/profile", { display_name: "Coach", email: who.email }], ["POST", "/account/coach-onboarding/terms", { accepted: true, terms_version: "terms_v1" }], ["PATCH", "/account/coach-onboarding/accessibility", { accessibility_preferences: { larger_text: false, high_contrast: false, reduced_motion: false, screen_reader_optimised: false } }], ["POST", "/account/coach-onboarding/complete", { completion_confirmed: true }]]) {
      const result = await request(baseUrl, method, path, body, who);
      assert.ok(result.status < 300, `${path}: ${result.text}`);
    }
  };
  const detail = async (who) => (await request(baseUrl, "GET", "/account/detail", undefined, who)).json.account;

  // A coach adds an athlete side: same account, now acting as the athlete.
  const coach = await register("coach", "coach");
  await finishCoachSetup(coach);
  assert.deepEqual((await detail(coach)).roles, ["coach"]);
  const added = await request(baseUrl, "POST", "/account/roles", { role: "athlete" }, coach);
  assert.equal(added.status, 201, added.text);
  assert.deepEqual([added.json.account.actor_type, added.json.account.roles, added.json.account.actor_home_route], ["athlete", ["coach", "athlete"], "#/athlete/today"]);
  assert.equal(added.json.account.user_id, coach.userId, "the same login and account");
  assert.equal((await request(baseUrl, "POST", "/account/roles", { role: "athlete" }, coach)).status, 409, "already held");

  // Their athlete side works like any athlete's: onboarding, athlete-only pages; coach pages wait.
  const draft = await request(baseUrl, "PATCH", "/account/onboarding/draft", { current_stage: "experience_level", fields: { activity_id: "powerlifting", experience_level: "amateur" } }, coach);
  assert.equal(draft.status, 200, draft.text);
  assert.equal((await request(baseUrl, "GET", "/coach-workspace/relationships/mine", undefined, coach)).status, 200, "athlete pages open");
  assert.equal((await request(baseUrl, "GET", "/coach-workspace/analysis", undefined, coach)).status, 403, "coach pages wait for the coaching side");

  // Back to coaching.
  const back = await request(baseUrl, "POST", "/account/roles/active", { role: "coach" }, coach);
  assert.equal(back.status, 200, back.text);
  assert.equal(back.json.account.actor_type, "coach");
  assert.equal((await request(baseUrl, "GET", "/coach-workspace/analysis", undefined, coach)).status, 200);
  assert.equal((await request(baseUrl, "POST", "/account/roles/active", { role: "admin" }, coach)).status, 409, "a role they don't hold");

  // They can't take themselves on as a client...
  const self = await request(baseUrl, "POST", "/coach-workspace/relationship-invitations", { athlete_email: coach.email }, coach);
  assert.notEqual(self.status, 201);
  assert.match(self.text, /self_not_allowed/u);
  // ...but another coach can invite their athlete side.
  const otherCoach = await register("coach", "other");
  await finishCoachSetup(otherCoach);
  const invited = await request(baseUrl, "POST", "/coach-workspace/relationship-invitations", { athlete_email: coach.email }, otherCoach);
  assert.equal(invited.status, 201, invited.text);

  // A fresh sign-in starts as the role they signed up as; switching is per session.
  const signIn = await request(baseUrl, "POST", "/account/sign-in", { email: coach.email, password: "BothRolesPlease!2026" });
  assert.equal(signIn.json.account.actor_type, "coach");
  assert.deepEqual(signIn.json.account.roles, ["coach", "athlete"]);

  // An admin gives an athlete the coach role, keeping their athlete side.
  const athlete = await register("athlete", "athlete");
  const adminEmail = `roles_admin_${nonce}@example.com`;
  adminIds.push(await createAdmin(adminEmail, "RolesAdminPassword1234"));
  const adminSignIn = await request(baseUrl, "POST", "/admin/sign-in", { email: adminEmail, password: "RolesAdminPassword1234" });
  const admin = { cookie: cookieOf(adminSignIn, "kolosseum_admin_session"), csrf: adminSignIn.json.csrf_token };
  const addCoach = (correlation, auth = admin) => request(baseUrl, "POST", `/admin/accounts/${athlete.userId}/add-coach-role`, { correlation_id: correlation }, auth);
  assert.equal((await addCoach(`r0_${nonce}`, { cookie: athlete.cookie, csrf: athlete.csrf })).status, 401, "admins only");
  const given = await addCoach(`r1_${nonce}`);
  assert.equal(given.status, 200, given.text);
  assert.deepEqual(given.json.audit.after_state, { roles: ["athlete", "coach"] });
  assert.equal((await addCoach(`r1_${nonce}`)).json.audit.idempotent_replay, true);
  assert.equal((await addCoach(`r2_${nonce}`)).status, 409, "already a coach");
  const adminView = await request(baseUrl, "GET", `/admin/accounts/${athlete.userId}`, undefined, admin);
  assert.deepEqual(adminView.json.account.roles, ["athlete", "coach"]);
  // Still signed in as the athlete; switches to coaching and sets it up.
  assert.equal((await detail(athlete)).actor_type, "athlete");
  const toCoach = await request(baseUrl, "POST", "/account/roles/active", { role: "coach" }, athlete);
  assert.equal(toCoach.json.account.actor_type, "coach");
  await finishCoachSetup(athlete);
});
