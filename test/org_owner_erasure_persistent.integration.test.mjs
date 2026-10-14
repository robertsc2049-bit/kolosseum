// Org-owner GDPR erasure end to end (real database and server): a gym owner
// with two organisations asks to be deleted. The admin hands the one with a
// coach to that coach and the empty one is closed. The coach then takes it
// over from their own coach account by choosing an org-app password, and can
// sign in to the organisation app and see it. Nobody can claim it by email.
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
const cookieOf = (result, name) => result.response.headers.getSetCookie().find((v) => v.startsWith(`${name}=`))?.split(";")[0];

async function createAdmin(email, password) {
  const salt = crypto.randomBytes(24).toString("base64url");
  const hash = await new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? reject(e) : resolve(Buffer.from(k).toString("base64url")))));
  const userId = `admin_${crypto.randomUUID().replaceAll("-", "")}`;
  await pool.query(`INSERT INTO product_admin_accounts (user_id, email_canonical, display_name, password_salt, password_hash) VALUES ($1,$2,$3,$4,$5)`, [userId, email, "Org Erasure Admin", salt, hash]);
  return userId;
}

test("an erased gym owner's organisation is handed to its coach, who takes it over from their coach account; the empty one closes", { timeout: 180_000 }, async () => {
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const nonce = crypto.randomUUID().slice(0, 8);
  const adminIds = [];
  try {
    // The owner and two organisations.
    const ownerEmail = `org_owner_${nonce}@example.com`;
    const reg = await request(baseUrl, "POST", "/org/register", { email: ownerEmail, display_name: "Gym Owner", password: "GymOwnerPassword2026!" });
    assert.ok(reg.status < 300, reg.text);
    const owner = { cookie: cookieOf(reg, "kolosseum_org_owner_session"), csrf: reg.json.csrf_token };
    const gym = await request(baseUrl, "POST", "/org/organisations", { org_name: `Iron Gym ${nonce}`, activity_id: "powerlifting", visibility_mode: "individual" }, owner);
    assert.ok(gym.status < 300, gym.text);
    const empty = await request(baseUrl, "POST", "/org/organisations", { org_name: `Empty Club ${nonce}`, activity_id: "powerlifting", visibility_mode: "individual" }, owner);
    assert.ok(empty.status < 300, empty.text);
    const gymId = gym.json.organisation?.org_id ?? gym.json.org_id;
    const emptyId = empty.json.organisation?.org_id ?? empty.json.org_id;
    assert.ok(gymId && emptyId, gym.text);

    // A coach who works at the gym.
    const coachEmail = `org_coach_${nonce}@example.com`;
    const coachReg = await request(baseUrl, "POST", "/account/register", {
      actor_type: "coach", display_name: "Head Coach", email: coachEmail, password: "HeadCoachPassword2026!",
      activity_id: "powerlifting", accepted_terms: true, accepted_consent: true, accepted_terms_version: "terms_v1", date_of_birth: "1988-02-02", accepted_consent_version: "consent_v1"
    });
    assert.equal(coachReg.status, 201, coachReg.text);
    const coach = { userId: coachReg.json.account.user_id, cookie: cookieOf(coachReg, "kolosseum_session"), csrf: coachReg.json.csrf_token };
    await pool.query(
      `INSERT INTO product_org_coach_memberships (membership_id, org_id, coach_user_id, membership_status, activated_at) VALUES ($1,$2,$3,'active',now())`,
      [`membership_${nonce}`, gymId, coach.userId]
    );

    // The owner asks to be deleted.
    const asked = await request(baseUrl, "POST", "/org/data-rights/deletion", { confirmation: "DELETE", client_request_id: `org_erase_${nonce}` }, owner);
    assert.ok(asked.status < 300, asked.text);
    const requestId = asked.json.deletion_request_id ?? asked.json.request?.deletion_request_id;
    assert.ok(requestId, asked.text);

    const adminEmail = `org_erase_admin_${nonce}@example.com`;
    adminIds.push(await createAdmin(adminEmail, "OrgEraseAdminPassword1234"));
    const adminSignIn = await request(baseUrl, "POST", "/admin/sign-in", { email: adminEmail, password: "OrgEraseAdminPassword1234" });
    const admin = { cookie: cookieOf(adminSignIn, "kolosseum_admin_session"), csrf: adminSignIn.json.csrf_token };

    // The plan: the gym with its coach, the empty club with none.
    const plan = await request(baseUrl, "GET", `/admin/org-owner-data-rights/deletions/${requestId}/erase-plan`, undefined, admin);
    assert.equal(plan.status, 200, plan.text);
    const byId = Object.fromEntries(plan.json.plan.organisations.map((o) => [o.org_id, o]));
    assert.deepEqual(byId[gymId].coaches.map((c) => c.coach_user_id), [coach.userId]);
    assert.deepEqual(byId[emptyId].coaches, []);

    // Every organisation needs a decision; the coach must be one of its own.
    const erase = (handovers, correlation) => request(baseUrl, "POST", `/admin/org-owner-data-rights/deletions/${requestId}/erase`, { correlation_id: correlation, handovers }, admin);
    assert.equal((await erase({ [emptyId]: null }, `c1_${nonce}`)).status, 400, "the gym needs a decision");
    assert.equal((await erase({ [gymId]: "coach_somebody_else", [emptyId]: null }, `c2_${nonce}`)).status, 400, "only one of its active coaches");
    assert.equal((await erase({ [gymId]: null, [emptyId]: null }, `c3_${nonce}`)).status, 400, "a gym with a coach can't just be closed");

    const erased = await erase({ [gymId]: coach.userId, [emptyId]: null }, `c4_${nonce}`);
    assert.equal(erased.status, 200, erased.text);
    assert.equal((await erase({ [gymId]: coach.userId, [emptyId]: null }, `c5_${nonce}`)).status, 409, "already erased");

    // The owner is gone: tombstone, can't sign in.
    const ownerRow = (await pool.query(`SELECT email_canonical, display_name, account_state FROM product_org_owner_accounts WHERE user_id = (SELECT owner_user_id FROM product_organisations WHERE org_id = $1)`, [gymId])).rows[0];
    assert.equal(ownerRow.display_name, "Erased account");
    assert.equal(ownerRow.account_state, "closed");
    assert.match(ownerRow.email_canonical, /^erased\+.*@erased\.invalid$/u);
    assert.notEqual((await request(baseUrl, "POST", "/org/sign-in", { email: ownerEmail, password: "GymOwnerPassword2026!" })).status, 200);
    // The empty club closed; the gym is waiting for its coach.
    assert.equal((await pool.query(`SELECT org_state FROM product_organisations WHERE org_id = $1`, [emptyId])).rows[0].org_state, "closed");

    // Claiming by email alone doesn't work: someone registering an org
    // account with the coach's email gets no organisation - and the coach's
    // take-over refuses to attach the gym to an account they may not control.
    const impostor = await request(baseUrl, "POST", "/org/register", { email: coachEmail, display_name: "Not The Coach", password: "ImpostorPassword2026!" });
    assert.ok(impostor.status < 300, impostor.text);
    const impostorOrgs = await request(baseUrl, "GET", "/org/organisations", undefined, { cookie: cookieOf(impostor, "kolosseum_org_owner_session") });
    assert.equal((impostorOrgs.json.organisations ?? []).some((o) => o.org_id === gymId), false, "the impostor gets nothing");
    const refused = await request(baseUrl, "POST", `/coach-workspace/org-handovers/${gymId}/accept`, { password: "NewOrgPassword2026!" }, { cookie: coach.cookie, csrf: coach.csrf });
    assert.equal(refused.status, 409, refused.text);
    assert.match(refused.text, /org_handover_email_in_use/u);
    // (Support removes the impostor account; the coach then takes over.)
    await pool.query("DELETE FROM product_org_owner_sessions WHERE user_id = (SELECT user_id FROM product_org_owner_accounts WHERE email_canonical = $1)", [coachEmail]);
    await pool.query("DELETE FROM product_org_owner_accounts WHERE email_canonical = $1", [coachEmail]);

    // The coach takes it over from their own signed-in coach account.
    const pending = await request(baseUrl, "GET", "/coach-workspace/org-handovers", undefined, { cookie: coach.cookie });
    assert.deepEqual(pending.json.handovers.map((h) => h.org_id), [gymId]);
    assert.equal((await request(baseUrl, "POST", `/coach-workspace/org-handovers/${gymId}/accept`, { password: "short" }, { cookie: coach.cookie, csrf: coach.csrf })).status, 400, "org-app password rules apply");
    assert.notEqual((await request(baseUrl, "POST", `/coach-workspace/org-handovers/${gymId}/accept`, { password: "NewOrgPassword2026!" }, { cookie: coach.cookie })).status, 200, "CSRF required");
    const taken = await request(baseUrl, "POST", `/coach-workspace/org-handovers/${gymId}/accept`, { password: "NewOrgPassword2026!" }, { cookie: coach.cookie, csrf: coach.csrf });
    assert.equal(taken.status, 200, taken.text);
    assert.equal(taken.json.handover.org_owner_email, coachEmail);
    assert.deepEqual((await request(baseUrl, "GET", "/coach-workspace/org-handovers", undefined, { cookie: coach.cookie })).json.handovers, []);

    // The coach signs in to the organisation app and runs the gym.
    const orgSignIn = await request(baseUrl, "POST", "/org/sign-in", { email: coachEmail, password: "NewOrgPassword2026!" });
    assert.equal(orgSignIn.status, 200, orgSignIn.text);
    const orgs = await request(baseUrl, "GET", "/org/organisations", undefined, { cookie: cookieOf(orgSignIn, "kolosseum_org_owner_session") });
    const owned = (orgs.json.organisations ?? []).map((o) => o.org_id);
    assert.ok(owned.includes(gymId), orgs.text);
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM product_org_audit_records WHERE org_id = $1 AND action_type = 'org_ownership_handed_over'`, [gymId])).rows[0].n, 1);
    // Their coach membership is untouched.
    assert.equal((await pool.query(`SELECT membership_status FROM product_org_coach_memberships WHERE org_id = $1 AND coach_user_id = $2`, [gymId, coach.userId])).rows[0].membership_status, "active");
  }
  finally {
    await pool.query("DELETE FROM product_admin_audit_records WHERE actor_user_id = ANY($1::text[])", [adminIds]).catch(() => {});
    await pool.query("DELETE FROM product_admin_sessions WHERE user_id = ANY($1::text[])", [adminIds]).catch(() => {});
    await pool.query("DELETE FROM product_admin_accounts WHERE user_id = ANY($1::text[])", [adminIds]).catch(() => {});
    await new Promise((resolve) => server.close(resolve));
    await pool.end().catch(() => {});
  }
});
