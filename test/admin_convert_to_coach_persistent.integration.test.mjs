// An admin makes an athlete account a coach account (real database and
// server): same login and user id, both account tables say coach, the old
// sessions are ended, the coach profile exists, and the next sign-in lands at
// the coach home and can use coach setup. Only an admin, with CSRF, can do it;
// a coach can't be converted again; a repeated request replays the audit.
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
  await pool.query(`INSERT INTO product_admin_accounts (user_id, email_canonical, display_name, password_salt, password_hash) VALUES ($1,$2,$3,$4,$5)`, [userId, email, "Convert Admin", salt, hash]);
  return userId;
}

test("an admin makes an athlete account a coach: same login, signed out, coach home and coach setup next time", { timeout: 120000 }, async (testContext) => {
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

  const email = `convert_${nonce}@example.com`;
  const password = "ConvertMeToCoach!2026";
  const registered = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete", display_name: "Robin Convert", email, password, activity_id: "general_strength",
    accepted_terms: true, accepted_consent: true, accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1", date_of_birth: "1990-03-03"
  });
  assert.equal(registered.status, 201, registered.text);
  const userId = registered.json.account.user_id;
  userIds.push(userId);
  const athleteCookie = cookieOf(registered, "kolosseum_session");
  const athleteCsrf = registered.json.csrf_token;

  const adminEmail = `convert_admin_${nonce}@example.com`;
  adminIds.push(await createAdmin(adminEmail, "ConvertAdminPassword1234"));
  const adminSignIn = await request(baseUrl, "POST", "/admin/sign-in", { email: adminEmail, password: "ConvertAdminPassword1234" });
  assert.equal(adminSignIn.status, 200, adminSignIn.text);
  const admin = { cookie: cookieOf(adminSignIn, "kolosseum_admin_session"), csrf: adminSignIn.json.csrf_token };
  const convert = (correlation, auth = admin) => request(baseUrl, "POST", `/admin/accounts/${userId}/convert-to-coach`, { correlation_id: correlation }, auth);

  // Only an admin, with CSRF.
  assert.equal((await convert(`c0_${nonce}`, { cookie: athleteCookie, csrf: athleteCsrf })).status, 401);
  assert.notEqual((await convert(`c0_${nonce}`, { cookie: admin.cookie })).status, 200);

  const done = await convert(`c1_${nonce}`);
  assert.equal(done.status, 200, done.text);
  assert.deepEqual(done.json.audit.before_state, { actor_type: "athlete" });
  assert.equal(done.json.audit.after_state.actor_type, "coach");
  assert.equal(done.json.audit.after_state.sessions_ended >= 1, true);

  const accountRow = (await pool.query("SELECT actor_type FROM product_accounts WHERE user_id = $1", [userId])).rows[0];
  const betaRow = (await pool.query("SELECT actor_type FROM beta_accounts WHERE user_id = $1", [userId])).rows[0];
  assert.deepEqual([accountRow.actor_type, betaRow.actor_type], ["coach", "coach"]);

  // The old athlete session no longer works.
  assert.notEqual((await request(baseUrl, "GET", "/account/detail", undefined, { cookie: athleteCookie })).status, 200);

  // A repeat replays; a coach can't be converted again.
  const replay = await convert(`c1_${nonce}`);
  assert.equal(replay.json.audit.idempotent_replay, true);
  assert.equal((await convert(`c2_${nonce}`)).status, 409);

  // Same login: a coach now, at the coach home, with coach setup to do.
  const signIn = await request(baseUrl, "POST", "/account/sign-in", { email, password });
  assert.equal(signIn.status, 200, signIn.text);
  const coachCookie = cookieOf(signIn, "kolosseum_session");
  const detail = await request(baseUrl, "GET", "/account/detail", undefined, { cookie: coachCookie });
  assert.equal(detail.json.account.user_id, userId, "the same account");
  assert.equal(detail.json.account.actor_type, "coach");
  assert.equal(detail.json.account.actor_home_route, "#/coach/overview");
  const coachCsrf = detail.json.csrf_token;
  const profile = await request(baseUrl, "PATCH", "/account/coach-onboarding/profile", { display_name: "Robin Convert", email }, { cookie: coachCookie, csrf: coachCsrf });
  assert.equal(profile.status, 200, profile.text);
  const templates = await request(baseUrl, "GET", "/templates/exercises", undefined, { cookie: coachCookie });
  assert.equal(templates.status, 200, "coach tools open to them");
});
